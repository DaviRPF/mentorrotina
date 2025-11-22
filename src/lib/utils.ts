import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function formatDateLong(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function getHourFromY(y: number, hourHeight: number): number {
  return Math.floor(y / hourHeight);
}

export function getMinutesFromY(y: number, hourHeight: number): number {
  const hour = y / hourHeight;
  return Math.round((hour % 1) * 60 / 15) * 15; // Round to nearest 15 min
}

export function getYFromTime(hours: number, minutes: number, hourHeight: number): number {
  return (hours + minutes / 60) * hourHeight;
}
