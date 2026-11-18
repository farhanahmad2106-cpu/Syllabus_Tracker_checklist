import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Flame,
  Layers,
  RefreshCw,
  Sparkles,
  TrendingUp,
  FileText,
  Bookmark,
} from 'lucide-react';
import {
  fetchDueRevisions,
  fetchSyllabusAnalytics,
  submitRevisionReview,
} from '../lib/api';
import { enqueueMutation } from '../lib/offlineStore';
import type {
  DueRevisionItem,
  SyllabusAnalytics,
} from '../types/syllabus';

interface AnalyticsDashboardProps {
  syllabusId: string;
  syllabusTitle: string;
  completedLeafIds?: string[];
  onOpenNoteDrawer?: (leafId: string, leafTitle: string) => void;
  onOpenResourceModal?: (
    nodeId: string,
    nodeType: 'subtopic' | 'module',
    nodeTitle: string
  ) => void;
  isOnline?: boolean;
  onReviewCompleted?: () => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  syllabusId,
  syllabusTitle: _syllabusTitle,
  completedLeafIds: _completedLeafIds,
  onOpenNoteDrawer,
  onOpenResourceModal,
  isOnline = true,
  onReviewCompleted,
}) => {
  const [analytics, setAnalytics] = useState<SyllabusAnalytics | null>(null);
  const [dueRevisions, setDueRevisions] = useState<DueRevisionItem[]>([]);
  const [totalDue, setTotalDue] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [includeUpcoming, setIncludeUpcoming] = useState<boolean>(false);
  const [reviewingLeafId, setReviewingLeafId] = useState<string | null>(null);
  const [hoveredDayIdx, setHoveredDayIdx] = useState<number | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Auto-dismiss notifications after 4 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const loadData = useCallback(
    async (showLoadingSpinner = true) => {
      if (showLoadingSpinner) setIsLoading(true);
      setError(null);

      try {
        const [analyticsRes, revisionsRes] = await Promise.all([
          fetchSyllabusAnalytics(syllabusId),
          fetchDueRevisions(syllabusId, includeUpcoming, 50),
        ]);

        setAnalytics(analyticsRes);
        setDueRevisions(revisionsRes.items);
        setTotalDue(revisionsRes.total_due);

        // Cache snapshot in localStorage for offline resilience
        try {
          localStorage.setItem(
            `analytics_cache_${syllabusId}`,
            JSON.stringify({
              analytics: analyticsRes,
              dueRevisions: revisionsRes.items,
              totalDue: revisionsRes.total_due,
              cachedAt: Date.now(),
            })
          );
        } catch {
          // Ignore localStorage quota errors
        }
      } catch (err: any) {
        // Attempt restoring from offline cache if network failed
        try {
          const cached = localStorage.getItem(`analytics_cache_${syllabusId}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            setAnalytics(parsed.analytics);
            setDueRevisions(parsed.dueRevisions || []);
            setTotalDue(parsed.totalDue || 0);
            setError(
              'Operating in offline preview mode. Displaying cached study analytics.'
            );
            return;
          }
        } catch {
          // Ignore cache read errors
        }

        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load study analytics and revision queue.'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [syllabusId, includeUpcoming]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData(false);
  };

  // Submit Spaced-Repetition Review with optimistic UI update
  const handleRateTopic = async (
    item: DueRevisionItem,
    quality: 1 | 2 | 3 | 4
  ) => {
    setReviewingLeafId(item.leaf_id);

    // Optimistically remove reviewed item from current list
    const previousList = [...dueRevisions];
    setDueRevisions((prev) => prev.filter((r) => r.leaf_id !== item.leaf_id));
    setTotalDue((prev) => Math.max(0, prev - 1));

    const idempotencyKey = `rev_${item.leaf_id}_${Date.now()}`;

    try {
      if (!isOnline) {
        // Enqueue offline mutation
        await enqueueMutation({
          syllabusId,
          type: 'SUBMIT_REVISION_REVIEW',
          payload: {
            leafId: item.leaf_id,
            quality,
            clientReviewDate: new Date().toISOString().split('T')[0],
          },
        });
        setNotification({
          type: 'success',
          text: `Offline review recorded for "${item.leaf_title}". Queued for background synchronization.`,
        });
      } else {
        await submitRevisionReview(syllabusId, item.leaf_id, {
          quality,
          idempotency_key: idempotencyKey,
        });

        const qualityLabels = {
          1: 'Again (Reset to 1d)',
          2: 'Hard (Short progression)',
          3: 'Good (Normal interval)',
          4: 'Easy (Accelerated interval)',
        };

        setNotification({
          type: 'success',
          text: `Revision rated: ${qualityLabels[quality]}. Next interval updated.`,
        });
      }

      onReviewCompleted?.();
    } catch (err: any) {
      // Rollback optimistic update on failure
      setDueRevisions(previousList);
      setTotalDue((prev) => prev + 1);
      setNotification({
        type: 'error',
        text: `Failed to record review: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`,
      });
    } finally {
      setReviewingLeafId(null);
    }
  };

  // SVG Chart Dimensions & Computations
  const chartData = useMemo(() => {
    if (!analytics || !analytics.velocity_14d.length) return null;

    const days = analytics.velocity_14d;
    const maxDayCount = Math.max(
      5,
      ...days.map((d) => Math.max(d.completed_count, d.uncompleted_count))
    );

    const width = 640;
    const height = 180;
    const paddingLeft = 36;
    const paddingRight = 16;
    const paddingTop = 20;
    const paddingBottom = 28;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;
    const barGroupWidth = chartWidth / days.length;
    const barWidth = Math.max(4, barGroupWidth * 0.35);

    return {
      days,
      maxDayCount,
      width,
      height,
      paddingLeft,
      paddingRight,
      paddingTop,
      paddingBottom,
      chartWidth,
      chartHeight,
      barGroupWidth,
      barWidth,
    };
  }, [analytics]);

  if (isLoading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[360px] text-[var(--text-muted)] gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
        <span className="text-sm font-medium">
          Aggregating study analytics & revision schedules...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3.5 rounded-xl border text-xs sm:text-sm font-medium flex items-center justify-between shadow-md transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            )}
            <span>{notification.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-xs hover:underline cursor-pointer opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Banner / Error Banner */}
      {error && (
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs sm:text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Section 1: KPI Summary Cards (4 Cards Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Overall Completion */}
        <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-[var(--text-muted)] text-xs font-medium">
            <span>Overall Completion</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
              {analytics?.overall_completion_percentage ?? 0}%
            </span>
            <span className="text-xs text-[var(--text-secondary)] tabular-nums">
              {analytics?.completed_eligible_leaves ?? 0} /{' '}
              {analytics?.total_eligible_leaves ?? 0} topics
            </span>
          </div>
          <div className="w-full bg-[var(--bg-surface-hover)] rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
              style={{
                width: `${analytics?.overall_completion_percentage ?? 0}%`,
              }}
            />
          </div>
        </div>

        {/* Card 2: Study Streak */}
        <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-[var(--text-muted)] text-xs font-medium">
            <span>Current Study Streak</span>
            <Flame
              className={`w-4 h-4 ${
                analytics?.streak.is_active_today
                  ? 'text-amber-500 animate-pulse'
                  : 'text-[var(--text-muted)]'
              }`}
            />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
              {analytics?.streak.current_streak ?? 0}{' '}
              <span className="text-sm font-normal text-[var(--text-secondary)]">
                days
              </span>
            </span>
            {analytics?.streak.is_active_today && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                Active Today
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            Longest streak: {analytics?.streak.longest_streak ?? 0} days
          </p>
        </div>

        {/* Card 3: Due for Revision */}
        <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-[var(--text-muted)] text-xs font-medium">
            <span>Due for Revision</span>
            <Clock className="w-4 h-4 text-sky-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
              {(analytics?.revision_queue.due_today_count ?? 0) +
                (analytics?.revision_queue.overdue_count ?? 0)}
            </span>
            {(analytics?.revision_queue.overdue_count ?? 0) > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium">
                {analytics?.revision_queue.overdue_count} overdue
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            {analytics?.revision_queue.upcoming_7d_count ?? 0} upcoming next 7
            days
          </p>
        </div>

        {/* Card 4: Mastered Topics */}
        <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-[var(--text-muted)] text-xs font-medium">
            <span>Mastered Topics</span>
            <Award className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
              {analytics?.revision_queue.mastered_count ?? 0}
            </span>
            <span className="text-xs text-[var(--text-secondary)] tabular-nums">
              of {analytics?.revision_queue.total_scheduled ?? 0} scheduled
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            Interval $\ge$ 21 days or 3+ consecutive successful reviews
          </p>
        </div>
      </div>

      {/* Section 2: 14-Day Study Activity Chart (Native SVG) */}
      <div className="p-5 sm:p-6 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-500" />
              <span>14-Day Study Activity & Completion Velocity</span>
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Derived strictly from immutable completion audit events. Hover over
              any bar to inspect daily activity.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium self-end sm:self-auto">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
              <span className="text-[var(--text-secondary)]">Completed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" />
              <span className="text-[var(--text-secondary)]">Uncompleted</span>
            </div>
          </div>
        </div>

        {/* Native SVG Chart Canvas */}
        {chartData ? (
          <div className="relative w-full overflow-x-auto custom-scrollbar pt-2">
            <svg
              viewBox={`0 0 ${chartData.width} ${chartData.height}`}
              className="w-full min-w-[540px] h-48 select-none"
              role="img"
              aria-label="14-Day Study Activity Bar Chart"
            >
              {/* Horizontal Grid lines */}
              {[0, 0.5, 1].map((pct, idx) => {
                const y =
                  chartData.paddingTop + chartData.chartHeight * (1 - pct);
                const val = Math.round(chartData.maxDayCount * pct);
                return (
                  <g key={idx}>
                    <line
                      x1={chartData.paddingLeft}
                      y1={y}
                      x2={chartData.width - chartData.paddingRight}
                      y2={y}
                      stroke="currentColor"
                      strokeDasharray="3 3"
                      className="text-[var(--border-hairline)]"
                    />
                    <text
                      x={chartData.paddingLeft - 6}
                      y={y + 3}
                      textAnchor="end"
                      className="text-[9px] fill-[var(--text-muted)] font-mono"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Day Columns */}
              {chartData.days.map((day, i) => {
                const xGroup =
                  chartData.paddingLeft + i * chartData.barGroupWidth;
                const xComp = xGroup + chartData.barGroupWidth * 0.15;
                const xUncomp = xComp + chartData.barWidth + 1;

                const compH =
                  (day.completed_count / chartData.maxDayCount) *
                  chartData.chartHeight;
                const uncompH =
                  (day.uncompleted_count / chartData.maxDayCount) *
                  chartData.chartHeight;

                const yComp =
                  chartData.paddingTop + chartData.chartHeight - compH;
                const yUncomp =
                  chartData.paddingTop + chartData.chartHeight - uncompH;

                const isHovered = hoveredDayIdx === i;
                const dateLabel = day.date.slice(5); // MM-DD

                return (
                  <g
                    key={day.date}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredDayIdx(i)}
                    onMouseLeave={() => setHoveredDayIdx(null)}
                  >
                    {/* Hover Column Highlight */}
                    {isHovered && (
                      <rect
                        x={xGroup}
                        y={chartData.paddingTop}
                        width={chartData.barGroupWidth}
                        height={chartData.chartHeight}
                        fill="currentColor"
                        className="text-emerald-500/10"
                        rx="4"
                      />
                    )}

                    {/* Completed Bar */}
                    {day.completed_count > 0 && (
                      <rect
                        x={xComp}
                        y={yComp}
                        width={chartData.barWidth}
                        height={Math.max(2, compH)}
                        fill="#10b981"
                        rx="2"
                        className="transition-all"
                      />
                    )}

                    {/* Uncompleted Bar */}
                    {day.uncompleted_count > 0 && (
                      <rect
                        x={xUncomp}
                        y={yUncomp}
                        width={chartData.barWidth}
                        height={Math.max(2, uncompH)}
                        fill="#f43f5e"
                        rx="2"
                        className="transition-all"
                      />
                    )}

                    {/* Empty Day Indicator */}
                    {day.completed_count === 0 &&
                      day.uncompleted_count === 0 && (
                        <circle
                          cx={xGroup + chartData.barGroupWidth / 2}
                          cy={chartData.paddingTop + chartData.chartHeight - 4}
                          r="1.5"
                          className="fill-[var(--border-subtle)]"
                        />
                      )}

                    {/* X-Axis Date Label */}
                    <text
                      x={xGroup + chartData.barGroupWidth / 2}
                      y={chartData.height - 8}
                      textAnchor="middle"
                      className={`text-[9px] font-mono transition-colors ${
                        isHovered
                          ? 'fill-emerald-500 font-bold'
                          : 'fill-[var(--text-muted)]'
                      }`}
                    >
                      {dateLabel}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip Box */}
            {hoveredDayIdx !== null && chartData.days[hoveredDayIdx] && (
              <div
                className="mt-2 p-2.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-xs flex items-center justify-between gap-4 shadow-sm"
                aria-live="polite"
              >
                <div className="font-semibold text-[var(--text-primary)]">
                  Date: {chartData.days[hoveredDayIdx].date}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-500 font-medium">
                    +{chartData.days[hoveredDayIdx].completed_count} completed
                  </span>
                  <span className="text-rose-500 font-medium">
                    -{chartData.days[hoveredDayIdx].uncompleted_count} uncompleted
                  </span>
                  <span className="text-[var(--text-secondary)] font-mono">
                    Net: {chartData.days[hoveredDayIdx].net_change}
                  </span>
                  <span className="text-[var(--text-primary)] font-semibold font-mono">
                    Cumulative: {chartData.days[hoveredDayIdx].cumulative_completed}
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-[var(--text-muted)]">
            No study activity events recorded yet. Complete topics in the
            curriculum tree to begin activity tracking.
          </div>
        )}
      </div>

      {/* Section 3: Interactive Spaced-Repetition Revision Queue */}
      <div className="p-5 sm:p-6 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>Spaced-Repetition Revision Queue</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono">
                {totalDue} Due
              </span>
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Deterministic SM-2-v1 schedule. Topics appear for review after
              initial curriculum completion.
            </p>
          </div>

          {/* Toggle Due Now vs Upcoming */}
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setIncludeUpcoming(false);
              }}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                !includeUpcoming
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-[var(--bg-surface-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Due Now
            </button>
            <button
              type="button"
              onClick={() => {
                setIncludeUpcoming(true);
              }}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                includeUpcoming
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-[var(--bg-surface-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Next 7 Days
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              className="min-h-[44px] p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              title="Refresh revision queue"
              aria-label="Refresh revision queue"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Revision Queue List */}
        {dueRevisions.length > 0 ? (
          <div className="space-y-3 pt-1">
            {dueRevisions.map((item) => {
              const isItemReviewing = reviewingLeafId === item.leaf_id;

              return (
                <div
                  key={item.leaf_id}
                  className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]/60 hover:bg-[var(--bg-surface-elevated)] transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      {/* Breadcrumbs */}
                      <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] truncate flex-wrap">
                        <span>{item.semester_title}</span>
                        <span>&rsaquo;</span>
                        <span className="font-medium text-[var(--text-secondary)]">
                          {item.subject_code} - {item.subject_title}
                        </span>
                        <span>&rsaquo;</span>
                        <span>{item.module_title}</span>
                      </div>

                      {/* Leaf Title */}
                      <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                        {item.leaf_title}
                      </h4>
                    </div>

                    {/* Status Badges */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {item.is_overdue ? (
                        <span className="text-[11px] px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-500" />
                          <span>{item.days_overdue}d overdue</span>
                        </span>
                      ) : (
                        <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3 text-emerald-500" />
                          <span>Due {item.due_date}</span>
                        </span>
                      )}

                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] font-mono">
                        Rep {item.repetition_count} &bull; {item.interval_days}d
                        &bull; EF {item.ease_factor.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Notes & Resource Quick Actions */}
                  <div className="flex items-center gap-3 text-xs pt-1 border-t border-[var(--border-hairline)]">
                    {onOpenNoteDrawer && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenNoteDrawer(item.leaf_id, item.leaf_title)
                        }
                        className="inline-flex items-center gap-1 text-[var(--text-secondary)] hover:text-emerald-500 transition-colors cursor-pointer"
                        title="View or edit notes for this topic"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{item.has_notes ? 'View Notes' : 'Add Notes'}</span>
                      </button>
                    )}

                    {onOpenResourceModal && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenResourceModal(
                            item.leaf_id,
                            'subtopic',
                            item.leaf_title
                          )
                        }
                        className="inline-flex items-center gap-1 text-[var(--text-secondary)] hover:text-indigo-500 transition-colors cursor-pointer"
                        title="View learning resources"
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                        <span>
                          {item.resource_count > 0
                            ? `${item.resource_count} Resources`
                            : 'Resources'}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Rating Buttons (4 Buttons with >= 44px touch targets) */}
                  <div className="pt-2">
                    <p className="text-[11px] text-[var(--text-muted)] mb-2 font-medium">
                      Rate your recall to schedule next review:
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        disabled={isItemReviewing}
                        onClick={() => handleRateTopic(item, 1)}
                        className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 active:scale-[0.98] transition-all flex flex-col items-center justify-center cursor-pointer disabled:opacity-50"
                      >
                        <span>1 &bull; Again</span>
                        <span className="text-[10px] font-normal opacity-80">
                          Reset (1d)
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={isItemReviewing}
                        onClick={() => handleRateTopic(item, 2)}
                        className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 active:scale-[0.98] transition-all flex flex-col items-center justify-center cursor-pointer disabled:opacity-50"
                      >
                        <span>2 &bull; Hard</span>
                        <span className="text-[10px] font-normal opacity-80">
                          Difficult
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={isItemReviewing}
                        onClick={() => handleRateTopic(item, 3)}
                        className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold border border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 active:scale-[0.98] transition-all flex flex-col items-center justify-center cursor-pointer disabled:opacity-50"
                      >
                        <span>3 &bull; Good</span>
                        <span className="text-[10px] font-normal opacity-80">
                          Standard
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={isItemReviewing}
                        onClick={() => handleRateTopic(item, 4)}
                        className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 active:scale-[0.98] transition-all flex flex-col items-center justify-center cursor-pointer disabled:opacity-50"
                      >
                        <span>4 &bull; Easy</span>
                        <span className="text-[10px] font-normal opacity-80">
                          Effortless
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-10 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">
              All caught up!
            </h4>
            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
              There are zero topics due for review right now. Complete more
              topics in the curriculum tree or switch to &quot;Next 7 Days&quot;
              to view upcoming reviews.
            </p>
          </div>
        )}
      </div>

      {/* Section 4: Subject Mastery Breakdown */}
      <div className="p-5 sm:p-6 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-500" />
            <span>Enrolled Subject Coverage & Mastery</span>
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Progress aggregated across enrolled courses. Excluded electives are
            strictly isolated.
          </p>
        </div>

        {analytics && analytics.subject_coverage.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {analytics.subject_coverage.map((subj) => (
              <div
                key={subj.subject_id}
                className="p-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-elevated)]/40 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--text-primary)] truncate">
                    {subj.subject_code} &bull; {subj.subject_title}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {subj.is_lab && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold">
                        LAB
                      </span>
                    )}
                    <span className="tabular-nums font-bold text-[var(--text-primary)]">
                      {subj.completion_percentage}%
                    </span>
                  </div>
                </div>

                <div className="w-full bg-[var(--bg-surface-hover)] rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${subj.completion_percentage}%` }}
                  />
                </div>

                <div className="text-[11px] text-[var(--text-muted)] flex justify-between">
                  <span>
                    {subj.completed_leaves} of {subj.total_leaves} topics completed
                  </span>
                  <span>
                    {subj.total_leaves - subj.completed_leaves} remaining
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">
            No enrolled subjects found in syllabus.
          </p>
        )}
      </div>

      {/* Section 5: Upcoming Exam & Deadline Risk Panel */}
      <div className="p-5 sm:p-6 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <span>Upcoming Exam & Deadline Risk Forecast</span>
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Pacing risk calculations derived from target deadlines and actual
            14-day completion velocity.
          </p>
        </div>

        {analytics && analytics.exam_risks.length > 0 ? (
          <div className="space-y-3 pt-1">
            {analytics.exam_risks.map((risk) => {
              const badgeColors = {
                Critical:
                  'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
                High: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30',
                Moderate:
                  'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
                Low: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
              }[risk.risk_level];

              return (
                <div
                  key={risk.node_id}
                  className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]/60 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-mono uppercase text-[var(--text-muted)]">
                        {risk.node_type} Target
                      </span>
                      <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                        {risk.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${badgeColors}`}
                      >
                        {risk.risk_level} Risk
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-[var(--bg-surface-hover)] space-y-0.5">
                      <span className="text-[10px] text-[var(--text-muted)]">
                        Target Date
                      </span>
                      <p className="font-semibold text-[var(--text-primary)]">
                        {risk.target_date}
                      </p>
                    </div>

                    <div className="p-2 rounded-lg bg-[var(--bg-surface-hover)] space-y-0.5">
                      <span className="text-[10px] text-[var(--text-muted)]">
                        Days Remaining
                      </span>
                      <p className="font-semibold text-[var(--text-primary)] tabular-nums">
                        {risk.days_remaining}d
                      </p>
                    </div>

                    <div className="p-2 rounded-lg bg-[var(--bg-surface-hover)] space-y-0.5">
                      <span className="text-[10px] text-[var(--text-muted)]">
                        Remaining Topics
                      </span>
                      <p className="font-semibold text-[var(--text-primary)] tabular-nums">
                        {risk.incomplete_leaves}
                      </p>
                    </div>

                    <div className="p-2 rounded-lg bg-[var(--bg-surface-hover)] space-y-0.5">
                      <span className="text-[10px] text-[var(--text-muted)]">
                        Required Velocity
                      </span>
                      <p className="font-semibold text-[var(--text-primary)] tabular-nums">
                        {risk.required_velocity_per_day} /day
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-[var(--text-secondary)] italic">
                    {risk.risk_reason} (Current 14d pace:{' '}
                    {risk.current_velocity_per_day} topics/day)
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-[var(--text-muted)] space-y-1">
            <p>No target deadlines configured for this syllabus.</p>
            <p>
              Set exam target dates in the curriculum view to activate
              pacing velocity forecasting and risk alerts.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
