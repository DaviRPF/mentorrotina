import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH - Update a memory
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { content } = await request.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    const memory = await prisma.memory.update({
      where: { id },
      data: { content },
    });

    return NextResponse.json({
      id: memory.id,
      content: memory.content,
      createdAt: memory.createdAt.getTime(),
      updatedAt: memory.updatedAt.getTime(),
    });
  } catch (error) {
    console.error('Error updating memory:', error);
    if ((error as { code?: string }).code === 'P2025') {
      return NextResponse.json(
        { error: 'Memory not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update memory' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a memory
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    await prisma.memory.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting memory:', error);
    if ((error as { code?: string }).code === 'P2025') {
      return NextResponse.json({ success: true, message: 'Memory already deleted' });
    }
    return NextResponse.json(
      { error: 'Failed to delete memory' },
      { status: 500 }
    );
  }
}
