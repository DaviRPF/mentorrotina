import {
  addDays,
  addWeeks,
  addMonths,
  setHours,
  setMinutes,
  startOfDay,
  endOfDay,
  nextMonday,
  nextTuesday,
  nextWednesday,
  nextThursday,
  nextFriday,
  nextSaturday,
  nextSunday,
  isAfter,
  isBefore,
} from 'date-fns';

interface ParsedDeadline {
  deadline: Date | null;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  cleanContent: string;
}

// Patterns for deadline extraction
const deadlinePatterns = [
  // "até sexta 18h" or "até sexta às 18:00"
  /até\s+(segunda|terça|quarta|quinta|sexta|sábado|domingo)(?:\s+(?:às?\s*)?(\d{1,2})(?::(\d{2}))?(?:h|hrs?)?)?/i,
  // "até amanhã 14h"
  /até\s+amanhã(?:\s+(?:às?\s*)?(\d{1,2})(?::(\d{2}))?(?:h|hrs?)?)?/i,
  // "até hoje 23h"
  /até\s+hoje(?:\s+(?:às?\s*)?(\d{1,2})(?::(\d{2}))?(?:h|hrs?)?)?/i,
  // "até dia 25" or "até 25/12"
  /até\s+(?:dia\s+)?(\d{1,2})(?:\/(\d{1,2}))?(?:\s+(?:às?\s*)?(\d{1,2})(?::(\d{2}))?(?:h|hrs?)?)?/i,
  // "essa semana"
  /essa\s+semana/i,
  // "semana que vem"
  /semana\s+que\s+vem/i,
  // "esse mês" or "este mês"
  /ess?[ea]\s+mês/i,
  // "urgente" or "agora"
  /\b(urgente|agora|imediato)\b/i,
];

const dayNameToNext: Record<string, (date: Date) => Date> = {
  'segunda': nextMonday,
  'terça': nextTuesday,
  'quarta': nextWednesday,
  'quinta': nextThursday,
  'sexta': nextFriday,
  'sábado': nextSaturday,
  'sabado': nextSaturday,
  'domingo': nextSunday,
};

export function parseDeadline(text: string): ParsedDeadline {
  const now = new Date();
  let deadline: Date | null = null;
  let priority: 'urgent' | 'high' | 'medium' | 'low' = 'medium';
  let cleanContent = text;

  // Check for urgent keywords
  if (/\b(urgente|agora|imediato)\b/i.test(text)) {
    deadline = endOfDay(now);
    priority = 'urgent';
    cleanContent = text.replace(/\b(urgente|agora|imediato)\b/i, '').trim();
    return { deadline, priority, cleanContent };
  }

  // "até hoje"
  const hojeMatch = text.match(/até\s+hoje(?:\s+(?:às?\s*)?(\d{1,2})(?::(\d{2}))?(?:h|hrs?)?)?/i);
  if (hojeMatch) {
    const hour = hojeMatch[1] ? parseInt(hojeMatch[1]) : 23;
    const minute = hojeMatch[2] ? parseInt(hojeMatch[2]) : 59;
    deadline = setMinutes(setHours(now, hour), minute);
    priority = 'urgent';
    cleanContent = text.replace(hojeMatch[0], '').trim();
    return { deadline, priority, cleanContent };
  }

  // "até amanhã"
  const amanhaMatch = text.match(/até\s+amanhã(?:\s+(?:às?\s*)?(\d{1,2})(?::(\d{2}))?(?:h|hrs?)?)?/i);
  if (amanhaMatch) {
    const tomorrow = addDays(now, 1);
    const hour = amanhaMatch[1] ? parseInt(amanhaMatch[1]) : 23;
    const minute = amanhaMatch[2] ? parseInt(amanhaMatch[2]) : 59;
    deadline = setMinutes(setHours(tomorrow, hour), minute);
    priority = 'high';
    cleanContent = text.replace(amanhaMatch[0], '').trim();
    return { deadline, priority, cleanContent };
  }

  // "até [dia da semana]"
  const dayMatch = text.match(/até\s+(segunda|terça|quarta|quinta|sexta|sábado|sabado|domingo)(?:\s+(?:às?\s*)?(\d{1,2})(?::(\d{2}))?(?:h|hrs?)?)?/i);
  if (dayMatch) {
    const dayName = dayMatch[1].toLowerCase();
    const nextDayFn = dayNameToNext[dayName];
    if (nextDayFn) {
      let targetDay = nextDayFn(now);
      // If it's the same day, get next week
      if (targetDay.getDay() === now.getDay() && isAfter(now, startOfDay(targetDay))) {
        targetDay = addWeeks(targetDay, 1);
      }
      const hour = dayMatch[2] ? parseInt(dayMatch[2]) : 23;
      const minute = dayMatch[3] ? parseInt(dayMatch[3]) : 59;
      deadline = setMinutes(setHours(targetDay, hour), minute);

      // Calculate days until deadline for priority
      const daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 2) priority = 'high';
      else if (daysUntil <= 5) priority = 'medium';
      else priority = 'low';

      cleanContent = text.replace(dayMatch[0], '').trim();
      return { deadline, priority, cleanContent };
    }
  }

  // "até dia X" or "até X/Y"
  const dateMatch = text.match(/até\s+(?:dia\s+)?(\d{1,2})(?:\/(\d{1,2}))?(?:\s+(?:às?\s*)?(\d{1,2})(?::(\d{2}))?(?:h|hrs?)?)?/i);
  if (dateMatch) {
    const day = parseInt(dateMatch[1]);
    const month = dateMatch[2] ? parseInt(dateMatch[2]) - 1 : now.getMonth();
    const hour = dateMatch[3] ? parseInt(dateMatch[3]) : 23;
    const minute = dateMatch[4] ? parseInt(dateMatch[4]) : 59;

    let year = now.getFullYear();
    let targetDate = new Date(year, month, day, hour, minute);

    // If date is in the past, assume next year
    if (isBefore(targetDate, now)) {
      targetDate = new Date(year + 1, month, day, hour, minute);
    }

    deadline = targetDate;
    const daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 1) priority = 'urgent';
    else if (daysUntil <= 3) priority = 'high';
    else if (daysUntil <= 7) priority = 'medium';
    else priority = 'low';

    cleanContent = text.replace(dateMatch[0], '').trim();
    return { deadline, priority, cleanContent };
  }

  // "essa semana"
  if (/essa\s+semana/i.test(text)) {
    deadline = nextSunday(now);
    deadline = setMinutes(setHours(deadline, 23), 59);
    priority = 'medium';
    cleanContent = text.replace(/essa\s+semana/i, '').trim();
    return { deadline, priority, cleanContent };
  }

  // "semana que vem"
  if (/semana\s+que\s+vem/i.test(text)) {
    deadline = addWeeks(nextSunday(now), 1);
    deadline = setMinutes(setHours(deadline, 23), 59);
    priority = 'low';
    cleanContent = text.replace(/semana\s+que\s+vem/i, '').trim();
    return { deadline, priority, cleanContent };
  }

  // "esse mês"
  if (/ess?[ea]\s+mês/i.test(text)) {
    deadline = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    priority = 'low';
    cleanContent = text.replace(/ess?[ea]\s+mês/i, '').trim();
    return { deadline, priority, cleanContent };
  }

  // No deadline found - return as is
  return { deadline: null, priority: 'medium', cleanContent: text.trim() };
}

// Calculate priority based on deadline
export function calculatePriority(deadline: Date | null): 'urgent' | 'high' | 'medium' | 'low' {
  if (!deadline) return 'medium';

  const now = new Date();
  const hoursUntil = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntil <= 24) return 'urgent';
  if (hoursUntil <= 72) return 'high';
  if (hoursUntil <= 168) return 'medium'; // 7 days
  return 'low';
}
