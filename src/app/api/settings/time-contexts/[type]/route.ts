import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ type: string }>;
}

const validTypes = ['weekly', 'monthly', 'quarterly', 'sixMonth', 'yearly'];

// PATCH - Update a time context
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { type } = await params;

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid time context type' },
        { status: 400 }
      );
    }

    const { content } = await request.json();

    if (content === undefined || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    // Ensure default settings exists
    await prisma.userSettings.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });

    const context = await prisma.timeContext.upsert({
      where: {
        userSettingsId_type: {
          userSettingsId: 'default',
          type,
        },
      },
      update: {
        content,
        contentUpdatedAt: content.trim() ? new Date() : null,
      },
      create: {
        type,
        content,
        contentUpdatedAt: content.trim() ? new Date() : null,
        userSettingsId: 'default',
      },
    });

    return NextResponse.json({
      type: context.type,
      content: context.content,
      updatedAt: context.contentUpdatedAt ? context.contentUpdatedAt.getTime() : null,
    });
  } catch (error) {
    console.error('Error updating time context:', error);
    return NextResponse.json(
      { error: 'Failed to update time context' },
      { status: 500 }
    );
  }
}

// DELETE - Clear a time context
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { type } = await params;

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid time context type' },
        { status: 400 }
      );
    }

    await prisma.timeContext.updateMany({
      where: {
        userSettingsId: 'default',
        type,
      },
      data: {
        content: '',
        contentUpdatedAt: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing time context:', error);
    return NextResponse.json(
      { error: 'Failed to clear time context' },
      { status: 500 }
    );
  }
}
