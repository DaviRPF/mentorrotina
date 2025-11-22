import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const event = await prisma.event.findUnique({
      where: { id },
      include: { calendar: true },
    });

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error('Error fetching event:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      title,
      description,
      startTime,
      endTime,
      color,
      isAllDay,
      calendarId,
      recurrenceRule,
      recurrenceEndDate,
      reminderMinutes,
      exceptionDates,
    } = body;

    // Check if this is a recurring event instance (id contains a date)
    const isInstance = id.includes('-') && id.split('-').length > 5;

    if (isInstance) {
      // Extract the parent event ID
      const parts = id.split('-');
      const parentId = parts.slice(0, 5).join('-');

      // For recurring instances, we need to create an exception and a new single event
      // or update all future occurrences
      const updateType = body.updateType || 'this'; // 'this', 'future', 'all'

      if (updateType === 'all') {
        // Update the parent event
        const event = await prisma.event.update({
          where: { id: parentId },
          data: {
            ...(title !== undefined && { title }),
            ...(description !== undefined && { description }),
            ...(color !== undefined && { color }),
            ...(isAllDay !== undefined && { isAllDay }),
            ...(calendarId !== undefined && { calendarId }),
            ...(recurrenceRule !== undefined && {
              recurrenceRule: recurrenceRule ? JSON.stringify(recurrenceRule) : null
            }),
            ...(recurrenceEndDate !== undefined && {
              recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate) : null
            }),
            ...(reminderMinutes !== undefined && { reminderMinutes }),
          },
          include: { calendar: true },
        });
        return NextResponse.json(event);
      }

      // For 'this' or 'future', add exception date to parent
      const parentEvent = await prisma.event.findUnique({ where: { id: parentId } });
      if (parentEvent) {
        const instanceDate = parts.slice(5).join('-');
        const currentExceptions = parentEvent.exceptionDates
          ? JSON.parse(parentEvent.exceptionDates)
          : [];

        await prisma.event.update({
          where: { id: parentId },
          data: {
            exceptionDates: JSON.stringify([...currentExceptions, instanceDate]),
          },
        });

        // Create a new single event for this occurrence
        const newEvent = await prisma.event.create({
          data: {
            title: title || parentEvent.title,
            description: description ?? parentEvent.description,
            startTime: startTime ? new Date(startTime) : parentEvent.startTime,
            endTime: endTime ? new Date(endTime) : parentEvent.endTime,
            color: color || parentEvent.color,
            isAllDay: isAllDay ?? parentEvent.isAllDay,
            calendarId: calendarId || parentEvent.calendarId,
            reminderMinutes: reminderMinutes ?? parentEvent.reminderMinutes,
          },
          include: { calendar: true },
        });

        return NextResponse.json(newEvent);
      }
    }

    // Regular event update
    const event = await prisma.event.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(startTime !== undefined && { startTime: new Date(startTime) }),
        ...(endTime !== undefined && { endTime: new Date(endTime) }),
        ...(color !== undefined && { color }),
        ...(isAllDay !== undefined && { isAllDay }),
        ...(calendarId !== undefined && { calendarId }),
        ...(recurrenceRule !== undefined && {
          recurrenceRule: recurrenceRule ? JSON.stringify(recurrenceRule) : null
        }),
        ...(recurrenceEndDate !== undefined && {
          recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate) : null
        }),
        ...(reminderMinutes !== undefined && { reminderMinutes }),
        ...(exceptionDates !== undefined && {
          exceptionDates: exceptionDates ? JSON.stringify(exceptionDates) : null
        }),
      },
      include: { calendar: true },
    });

    return NextResponse.json(event);
  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const deleteType = searchParams.get('type') || 'this'; // 'this', 'future', 'all'

    // Check if this is a recurring event instance
    const isInstance = id.includes('-') && id.split('-').length > 5;

    if (isInstance) {
      const parts = id.split('-');
      const parentId = parts.slice(0, 5).join('-');
      const instanceDate = parts.slice(5).join('-');

      const parentEvent = await prisma.event.findUnique({ where: { id: parentId } });

      if (!parentEvent) {
        return NextResponse.json(
          { error: 'Parent event not found' },
          { status: 404 }
        );
      }

      if (deleteType === 'all') {
        // Delete the parent event (cascades to all)
        await prisma.event.delete({ where: { id: parentId } });
        return NextResponse.json({ success: true, deleted: 'all' });
      }

      if (deleteType === 'future') {
        // Set recurrence end date to this instance's date
        await prisma.event.update({
          where: { id: parentId },
          data: {
            recurrenceEndDate: new Date(instanceDate),
          },
        });
        return NextResponse.json({ success: true, deleted: 'future' });
      }

      // Delete just this instance - add to exceptions
      const currentExceptions = parentEvent.exceptionDates
        ? JSON.parse(parentEvent.exceptionDates)
        : [];

      await prisma.event.update({
        where: { id: parentId },
        data: {
          exceptionDates: JSON.stringify([...currentExceptions, instanceDate]),
        },
      });

      return NextResponse.json({ success: true, deleted: 'this' });
    }

    // Regular event deletion
    await prisma.event.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    );
  }
}
