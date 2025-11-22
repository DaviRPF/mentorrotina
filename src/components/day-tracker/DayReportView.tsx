'use client';

import { CheckCircle, XCircle, Star, AlertTriangle, Lightbulb, TrendingUp, Battery, Smile } from 'lucide-react';
import { DayReport } from '@/store/day-tracker-store';

interface DayReportViewProps {
  report: DayReport;
}

export function DayReportView({ report }: DayReportViewProps) {
  const getRatingStars = (rating: number | null) => {
    if (!rating) return null;
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
      />
    ));
  };

  const getCompletionColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
    if (rate >= 50) return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30';
    return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30';
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      {/* Summary */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
        <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">Resumo do Dia</h3>
        <p className="text-gray-700 dark:text-gray-300">{report.summary}</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4">
        {/* Completion Rate */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Taxa de Conclusão</span>
          </div>
          <div className={`text-2xl font-bold rounded-lg px-2 py-1 inline-block ${getCompletionColor(report.completionRate)}`}>
            {report.completionRate}%
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {report.completedEvents} de {report.plannedEvents} eventos
          </p>
        </div>

        {/* Energy & Mood */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          {report.energyLevel && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <Battery className="w-4 h-4 text-orange-500" />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Energia</span>
              </div>
              <div className="flex gap-0.5">{getRatingStars(report.energyLevel)}</div>
            </div>
          )}
          {report.moodRating && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Smile className="w-4 h-4 text-pink-500" />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Humor</span>
              </div>
              <div className="flex gap-0.5">{getRatingStars(report.moodRating)}</div>
            </div>
          )}
          {!report.energyLevel && !report.moodRating && (
            <p className="text-sm text-gray-500">Sem avaliação</p>
          )}
        </div>
      </div>

      {/* Completed Tasks */}
      {report.completedTasks.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <h4 className="font-medium text-gray-900 dark:text-white">Concluídos</h4>
          </div>
          <ul className="space-y-2">
            {report.completedTasks.map((task, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="text-green-500 mt-0.5">✓</span>
                {task}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Skipped Tasks */}
      {report.skippedTasks.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="w-5 h-5 text-red-500" />
            <h4 className="font-medium text-gray-900 dark:text-white">Não realizados</h4>
          </div>
          <ul className="space-y-2">
            {report.skippedTasks.map((task, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="text-red-500 mt-0.5">✗</span>
                {task}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Highlights */}
      {report.highlights.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-5 h-5 text-yellow-500" />
            <h4 className="font-medium text-gray-900 dark:text-white">Destaques</h4>
          </div>
          <ul className="space-y-2">
            {report.highlights.map((highlight, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="text-yellow-500 mt-0.5">★</span>
                {highlight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Challenges */}
      {report.challenges.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <h4 className="font-medium text-gray-900 dark:text-white">Desafios</h4>
          </div>
          <ul className="space-y-2">
            {report.challenges.map((challenge, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="text-orange-500 mt-0.5">!</span>
                {challenge}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Insights */}
      {report.insights.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-purple-500" />
            <h4 className="font-medium text-gray-900 dark:text-white">Insights</h4>
          </div>
          <ul className="space-y-2">
            {report.insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="text-purple-500 mt-0.5">💡</span>
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
