import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH - Update a book reference
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, topics, enabled } = body;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (topics !== undefined) updateData.topics = topics;
    if (enabled !== undefined) updateData.enabled = enabled;

    const book = await prisma.bookReference.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      id: book.id,
      title: book.title,
      topics: book.topics,
      enabled: book.enabled,
    });
  } catch (error) {
    console.error('Error updating book reference:', error);
    if ((error as { code?: string }).code === 'P2025') {
      return NextResponse.json(
        { error: 'Book reference not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update book reference' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a book reference
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    await prisma.bookReference.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting book reference:', error);
    if ((error as { code?: string }).code === 'P2025') {
      return NextResponse.json({ success: true, message: 'Book already deleted' });
    }
    return NextResponse.json(
      { error: 'Failed to delete book reference' },
      { status: 500 }
    );
  }
}
