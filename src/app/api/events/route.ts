import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const search = searchParams.get('search');
    const calendarId = searchParams.get('calendarId');

    const where: Record<string, unknown> = {};

    if (start && end) {
      where.OR = [
        {
          startTime: {
            gte: new Date(start),
            lte: new Date(end),
          },
        },
        {
          endTime: {
            gte: new Date(start),
            lte: new Date(end),
          },
        },
        {
          AND: [
            { startTime: { lte: new Date(start) } },
            { endTime: { gte: new Date(end) } },
          ],
        },
        // Include recurring events that might have occurrences in the range
        {
          recurrenceRule: { not: null },
        },
      ];
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    if (calendarId) {
      where.calendarId = calendarId;
    }

    // Only get parent events (not instances)
    where.parentEventId = null;

    const events = await prisma.event.findMany({
      where,
      orderBy: { startTime: 'asc' },
      include: {
        calendar: true,
      },
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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
    } = body;

    if (!title || !startTime || !endTime || !calendarId) {
      return NextResponse.json(
        { error: 'Title, start time, end time, and calendar ID are required' },
        { status: 400 }
      );
    }

    const event = await prisma.event.create({
      data: {
        title,
        description,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        color: color || '#3b82f6',
        isAllDay: isAllDay || false,
        calendarId,
        recurrenceRule: recurrenceRule ? JSON.stringify(recurrenceRule) : null,
        recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate) : null,
        reminderMinutes,
      },
      include: {
        calendar: true,
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}
