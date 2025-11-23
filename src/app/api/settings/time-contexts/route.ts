import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET - List all time contexts
export async function GET() {
  try {
    // Ensure default settings exists
    await prisma.userSettings.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });

    const contexts = await prisma.timeContext.findMany({
      where: { userSettingsId: 'default' },
    });

    // Transform to object format
    const result: Record<string, { content: string; updatedAt: number | null }> = {};
    const allTypes = ['weekly', 'monthly', 'quarterly', 'sixMonth', 'yearly'];

    for (const type of allTypes) {
      const ctx = contexts.find(c => c.type === type);
      result[type] = {
        content: ctx?.content || '',
        updatedAt: ctx?.contentUpdatedAt ? ctx.contentUpdatedAt.getTime() : null,
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching time contexts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch time contexts' },
      { status: 500 }
    );
  }
}
