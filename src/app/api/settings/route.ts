import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET - Get all user settings with relations
export async function GET() {
  try {
    let settings = await prisma.userSettings.findUnique({
      where: { id: 'default' },
      include: {
        memories: {
          orderBy: { createdAt: 'desc' },
        },
        bookReferences: {
          orderBy: { createdAt: 'desc' },
        },
        timeContexts: true,
      },
    });

    // Create default settings if not exists
    if (!settings) {
      settings = await prisma.userSettings.create({
        data: { id: 'default' },
        include: {
          memories: true,
          bookReferences: true,
          timeContexts: true,
        },
      });

      // Create default time contexts
      const timeContextTypes = ['weekly', 'monthly', 'quarterly', 'sixMonth', 'yearly'];
      await prisma.timeContext.createMany({
        data: timeContextTypes.map(type => ({
          type,
          userSettingsId: 'default',
        })),
      });

      // Refetch with created time contexts
      settings = await prisma.userSettings.findUnique({
        where: { id: 'default' },
        include: {
          memories: true,
          bookReferences: true,
          timeContexts: true,
        },
      });
    }

    // Transform timeContexts array to object for frontend compatibility
    const timeContextsObj: Record<string, { content: string; updatedAt: number | null }> = {};
    for (const tc of settings!.timeContexts) {
      timeContextsObj[tc.type] = {
        content: tc.content,
        updatedAt: tc.contentUpdatedAt ? tc.contentUpdatedAt.getTime() : null,
      };
    }

    // Ensure all time context types exist
    const allTypes = ['weekly', 'monthly', 'quarterly', 'sixMonth', 'yearly'];
    for (const type of allTypes) {
      if (!timeContextsObj[type]) {
        timeContextsObj[type] = { content: '', updatedAt: null };
      }
    }

    // Transform memories to frontend format
    const memories = settings!.memories.map(m => ({
      id: m.id,
      content: m.content,
      createdAt: m.createdAt.getTime(),
      updatedAt: m.updatedAt.getTime(),
    }));

    // Transform book references to frontend format
    const bookReferences = settings!.bookReferences.map(b => ({
      id: b.id,
      title: b.title,
      topics: b.topics,
      enabled: b.enabled,
    }));

    // Parse workingDays from JSON string
    let workingDays: number[] = [1, 2, 3, 4, 5];
    try {
      workingDays = JSON.parse(settings!.workingDays);
    } catch {
      // Use default if parse fails
    }

    return NextResponse.json({
      // AI Settings
      geminiModel: settings!.geminiModel,
      aiEnabled: settings!.aiEnabled,

      // Mentor Orientations
      generalOrientations: settings!.generalOrientations,

      // Calendar Settings
      weekStartsOn: settings!.weekStartsOn,
      defaultView: settings!.defaultView,
      defaultEventDuration: settings!.defaultEventDuration,
      defaultReminderMinutes: settings!.defaultReminderMinutes,

      // Appearance
      theme: settings!.theme,
      compactMode: settings!.compactMode,
      showWeekNumbers: settings!.showWeekNumbers,

      // Notifications
      enableNotifications: settings!.enableNotifications,
      soundEnabled: settings!.soundEnabled,

      // Time format
      use24HourFormat: settings!.use24HourFormat,

      // Working hours
      workingHoursStart: settings!.workingHoursStart,
      workingHoursEnd: settings!.workingHoursEnd,
      workingDays,

      // Relations
      memories,
      bookReferences,
      timeContexts: timeContextsObj,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// PATCH - Update scalar settings fields only
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    // Only allow updating scalar fields, not relations
    const allowedFields = [
      'geminiModel',
      'aiEnabled',
      'generalOrientations',
      'weekStartsOn',
      'defaultView',
      'defaultEventDuration',
      'defaultReminderMinutes',
      'theme',
      'compactMode',
      'showWeekNumbers',
      'enableNotifications',
      'soundEnabled',
      'use24HourFormat',
      'workingHoursStart',
      'workingHoursEnd',
      'workingDays',
    ];

    const updateData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'workingDays') {
          // Store as JSON string
          updateData[field] = JSON.stringify(body[field]);
        } else {
          updateData[field] = body[field];
        }
      }
    }

    const settings = await prisma.userSettings.upsert({
      where: { id: 'default' },
      update: updateData,
      create: {
        id: 'default',
        ...updateData,
      },
    });

    // Parse workingDays for response
    let workingDays: number[] = [1, 2, 3, 4, 5];
    try {
      workingDays = JSON.parse(settings.workingDays);
    } catch {
      // Use default
    }

    return NextResponse.json({
      ...settings,
      workingDays,
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
