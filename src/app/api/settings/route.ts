import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET - Get user settings
export async function GET() {
  try {
    let settings = await prisma.userSettings.findUnique({
      where: { id: 'default' },
    });

    // Create default settings if not exists
    if (!settings) {
      settings = await prisma.userSettings.create({
        data: {
          id: 'default',
          personalContext: '',
          generalOrientations: '',
          bookSummaries: '[]',
          timeContexts: '{}',
        },
      });
    }

    // Parse JSON fields
    return NextResponse.json({
      ...settings,
      bookSummaries: JSON.parse(settings.bookSummaries || '[]'),
      timeContexts: JSON.parse(settings.timeContexts || '{}'),
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// PATCH - Update user settings
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { personalContext, generalOrientations, bookSummaries, timeContexts } = body;

    const updateData: Record<string, string> = {};

    if (personalContext !== undefined) {
      updateData.personalContext = personalContext;
    }
    if (generalOrientations !== undefined) {
      updateData.generalOrientations = generalOrientations;
    }
    if (bookSummaries !== undefined) {
      updateData.bookSummaries = JSON.stringify(bookSummaries);
    }
    if (timeContexts !== undefined) {
      updateData.timeContexts = JSON.stringify(timeContexts);
    }

    const settings = await prisma.userSettings.upsert({
      where: { id: 'default' },
      update: updateData,
      create: {
        id: 'default',
        personalContext: personalContext || '',
        generalOrientations: generalOrientations || '',
        bookSummaries: JSON.stringify(bookSummaries || []),
        timeContexts: JSON.stringify(timeContexts || {}),
      },
    });

    return NextResponse.json({
      ...settings,
      bookSummaries: JSON.parse(settings.bookSummaries || '[]'),
      timeContexts: JSON.parse(settings.timeContexts || '{}'),
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
