import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  Layers,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  Info,
  X,
  Compass,
  Filter,
  FlaskConical,
  GraduationCap,
} from 'lucide-react';
import {
  buildCurriculumMasteryGraph,
  FOUNDATION_SATISFACTION_THRESHOLD,
  type CurriculumMasteryGraph,
  type PrerequisiteEdge,
} from '../lib/curriculumGraph';
import type {
  AcademicPlanResponse,
  ExamRiskItem,
  HierarchicalSyllabus,
  PacingMetrics,
} from '../types/syllabus';

export interface CurriculumMasteryMapProps {
  syllabus: HierarchicalSyllabus;
  completedLeafIds?: string[] | Set<string>;
  pacingData?: Record<string, PacingMetrics> | null;
  academicPlan?: AcademicPlanResponse | null;
  examRisks?: ExamRiskItem[] | null;
  onNavigateToNode?: (nodeId: string) => void;
  isOnline?: boolean;
}

type FilterOption = 'all' | 'at_risk' | 'in_progress' | 'mastered';

const EMPTY_COMPLETED_LEAVES: string[] = [];

export const CurriculumMasteryMap: React.FC<CurriculumMasteryMapProps> = ({
  syllabus,
  completedLeafIds = EMPTY_COMPLETED_LEAVES,
  pacingData = null,
  academicPlan = null,
  examRisks = null,
  onNavigateToNode,
}) => {
  // 1. Graph State & Derivation
  const graph: CurriculumMasteryGraph = useMemo(() => {
    return buildCurriculumMasteryGraph(
      syllabus,
      completedLeafIds,
      pacingData,
      academicPlan,
      examRisks
    );
  }, [syllabus, completedLeafIds, pacingData, academicPlan, examRisks]);

  // 2. Interactive Controls State
  const [filter, setFilter] = useState<FilterOption>('all');
  const [showPrereqs, setShowPrereqs] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [hoveredSubjectId, setHoveredSubjectId] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState<boolean>(false);

  // 3. Coordinate Tracking for SVG Connectors
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [cardPositions, setCardPositions] = useState<
    Map<string, { x: number; y: number; width: number; height: number }>
  >(new Map());

  // Set of card IDs that match the active filter
  const filteredSubjectIds = useMemo(() => {
    const ids = new Set<string>();
    graph.columns.forEach((col) => {
      col.subjects.forEach((subj) => {
        if (filter === 'all') {
          ids.add(subj.subjectId);
        } else if (filter === 'at_risk') {
          if (subj.riskStatus === 'overdue' || subj.riskStatus === 'behind') {
            ids.add(subj.subjectId);
          }
        } else if (filter === 'in_progress') {
          if (subj.masteryTier === 'in-progress') {
            ids.add(subj.subjectId);
          }
        } else if (filter === 'mastered') {
          if (subj.masteryTier === 'mastered') {
            ids.add(subj.subjectId);
          }
        }
      });
    });
    return ids;
  }, [graph, filter]);

  // Active Subject for Inspector
  const selectedSubject = useMemo(() => {
    if (!selectedSubjectId) return null;
    for (const col of graph.columns) {
      for (const subj of col.subjects) {
        if (subj.subjectId === selectedSubjectId) return subj;
      }
    }
    return null;
  }, [graph, selectedSubjectId]);

  // Interactive highlighting relationships for active or hovered subject
  const activeHighlightId = hoveredSubjectId || selectedSubjectId;

  const connectedNodes = useMemo(() => {
    if (!activeHighlightId) return null;
    const upstream = new Set<string>();
    const downstream = new Set<string>();
    const activeEdges: PrerequisiteEdge[] = [];

    graph.edges.forEach((edge) => {
      if (edge.toSubjectId === activeHighlightId) {
        upstream.add(edge.fromSubjectId);
        activeEdges.push(edge);
      } else if (edge.fromSubjectId === activeHighlightId) {
        downstream.add(edge.toSubjectId);
        activeEdges.push(edge);
      }
    });

    return {
      activeId: activeHighlightId,
      upstream,
      downstream,
      activeEdges,
    };
  }, [graph.edges, activeHighlightId]);

  // Recalculate card positions for SVG curves safely without infinite loops
  const updatePositions = useCallback(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft;
    const scrollTop = containerRef.current.scrollTop;

    const newPositions = new Map<
      string,
      { x: number; y: number; width: number; height: number }
    >();

    cardRefs.current.forEach((el, id) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        newPositions.set(id, {
          x: rect.left - containerRect.left + scrollLeft,
          y: rect.top - containerRect.top + scrollTop,
          width: rect.width,
          height: rect.height,
        });
      }
    });

    setCardPositions((prev) => {
      if (prev.size === 0 && newPositions.size === 0) return prev;
      if (prev.size === newPositions.size) {
        let same = true;
        for (const [id, pos] of newPositions.entries()) {
          const old = prev.get(id);
          if (
            !old ||
            Math.abs(old.x - pos.x) > 0.5 ||
            Math.abs(old.y - pos.y) > 0.5 ||
            Math.abs(old.width - pos.width) > 0.5 ||
            Math.abs(old.height - pos.height) > 0.5
          ) {
            same = false;
            break;
          }
        }
        if (same) return prev;
      }
      return newPositions;
    });
  }, []);

  useEffect(() => {
    updatePositions();
    const handleResize = () => updatePositions();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updatePositions, filter, zoomLevel, graph]);

  // Zoom handlers
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(1.4, Math.round((prev + 0.1) * 10) / 10));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(0.65, Math.round((prev - 0.1) * 10) / 10));
  const handleResetZoom = () => setZoomLevel(1);

  // SVG Connector Paths calculation
  const connectorPaths = useMemo(() => {
    if (!showPrereqs) return [];

    return graph.edges
      .map((edge) => {
        // Only render edge if both source and target are currently visible in the active filter
        if (!filteredSubjectIds.has(edge.fromSubjectId) || !filteredSubjectIds.has(edge.toSubjectId)) {
          return null;
        }

        const sourcePos = cardPositions.get(edge.fromSubjectId);
        const targetPos = cardPositions.get(edge.toSubjectId);

        let startX = 0;
        let startY = 0;
        let endX = 0;
        let endY = 0;

        if (sourcePos && targetPos) {
          startX = sourcePos.x + sourcePos.width;
          startY = sourcePos.y + sourcePos.height / 2;
          endX = targetPos.x;
          endY = targetPos.y + targetPos.height / 2;
        } else {
          // Deterministic fallback for headless/virtualized environments (e.g. tests)
          let sourceCol = 0;
          let sourceRow = 0;
          let targetCol = 0;
          let targetRow = 0;

          graph.columns.forEach((col, cIdx) => {
            col.subjects.forEach((subj, sIdx) => {
              if (subj.subjectId === edge.fromSubjectId) {
                sourceCol = cIdx;
                sourceRow = sIdx;
              }
              if (subj.subjectId === edge.toSubjectId) {
                targetCol = cIdx;
                targetRow = sIdx;
              }
            });
          });

          startX = sourceCol * 320 + 280;
          startY = 80 + sourceRow * 130 + 45;
          endX = targetCol * 320;
          endY = 80 + targetRow * 130 + 45;
        }

        const deltaX = Math.max(40, (endX - startX) * 0.45);
        const pathData = `M ${startX} ${startY} C ${startX + deltaX} ${startY}, ${endX - deltaX} ${endY}, ${endX} ${endY}`;

        const isHighlighted =
          connectedNodes &&
          (edge.fromSubjectId === connectedNodes.activeId ||
            edge.toSubjectId === connectedNodes.activeId);

        return {
          edge,
          pathData,
          isHighlighted,
        };
      })
      .filter(Boolean) as {
      edge: PrerequisiteEdge;
      pathData: string;
      isHighlighted: boolean;
    }[];
  }, [showPrereqs, graph.edges, filteredSubjectIds, cardPositions, graph.columns, connectedNodes]);

  return (
    <div
      className="flex flex-col h-full bg-[var(--bg-canvas)] text-[var(--text-primary)] rounded-xl border border-[var(--border-subtle)] overflow-hidden"
      data-testid="curriculum-mastery-map"
    >
      {/* 1. Header Toolbar */}
      <div className="p-3.5 sm:p-4 bg-[var(--bg-surface-elevated)] border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
        {/* Left: Overall Curriculum Metrics */}
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-gray-200 dark:text-gray-800"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-emerald-500 transition-all duration-500"
                strokeDasharray={`${graph.overallMasteryPercent}, 100`}
                strokeLinecap="round"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute text-xs font-bold font-mono">
              {Math.round(graph.overallMasteryPercent)}%
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-emerald-500" /> Curriculum Mastery Map
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                <Award className="w-3 h-3" /> {graph.totalCompletedLeaves} / {graph.totalEnrolledLeaves} Topics
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] flex items-center gap-2">
              <span>{graph.totalEnrolledSubjects} Enrolled Subjects</span>
              <span>•</span>
              <span>{graph.totalEnrolledCredits} Total Credits</span>
            </p>
          </div>
        </div>

        {/* Right: Controls & Zoom */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Prerequisite Toggle */}
          <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] font-medium px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={showPrereqs}
              onChange={(e) => setShowPrereqs(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
            />
            <span>Show Prerequisite Links</span>
          </label>

          {/* Zoom Controls */}
          <div className="flex items-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-0.5 text-xs">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 0.7}
              title="Zoom out"
              aria-label="Zoom out"
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 rounded hover:bg-[var(--bg-surface-hover)]"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              title="Reset zoom to 100%"
              aria-label="Reset zoom to 100%"
              className="px-1.5 py-0.5 text-[11px] font-mono font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 1.4}
              title="Zoom in"
              aria-label="Zoom in"
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 rounded hover:bg-[var(--bg-surface-hover)]"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Legend Toggle */}
          <button
            type="button"
            onClick={() => setShowLegend((prev) => !prev)}
            aria-expanded={showLegend}
            aria-label="Toggle map legend"
            className="p-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            title="Graph explanation and legend"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Filter Pills & Academic Disclaimer */}
      <div className="px-4 py-2.5 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[var(--text-muted)] font-medium flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>

          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              filter === 'all'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)]'
            }`}
          >
            All Enrolled ({graph.totalEnrolledSubjects})
          </button>

          <button
            type="button"
            onClick={() => setFilter('at_risk')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              filter === 'at_risk'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)]'
            }`}
          >
            At Risk / Behind
          </button>

          <button
            type="button"
            onClick={() => setFilter('in_progress')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              filter === 'in_progress'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)]'
            }`}
          >
            In Progress
          </button>

          <button
            type="button"
            onClick={() => setFilter('mastered')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              filter === 'mastered'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)]'
            }`}
          >
            Mastered (100%)
          </button>
        </div>

        {/* Clear Disclaimer */}
        <div className="text-[11px] text-[var(--text-muted)] italic flex items-center gap-1">
          <span>Inferred Academic Progression — Not Officially Verified Prerequisites</span>
        </div>
      </div>

      {/* Explanatory Legend (Collapsible) */}
      {showLegend && (
        <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-semibold flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-amber-600" /> Prerequisite Edge Legend:
            </span>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-emerald-500 inline-block rounded" />
              <span>Solid Emerald: Satisfied Foundation (≥ {FOUNDATION_SATISFACTION_THRESHOLD}% mastery)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 border-b-2 border-dashed border-amber-500 inline-block" />
              <span>Dashed Amber: In-Progress Foundation (&lt; {FOUNDATION_SATISFACTION_THRESHOLD}% mastery)</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowLegend(false)}
            aria-label="Close legend"
            className="text-amber-700 dark:text-amber-300 hover:text-amber-900 p-0.5 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. Main Map Canvas (Horizontally Scrollable) */}
      <div
        ref={containerRef}
        onScroll={updatePositions}
        className="flex-1 relative overflow-auto p-4 sm:p-6"
        data-testid="map-canvas-container"
      >
        {/* Empty State */}
        {graph.columns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <GraduationCap className="w-12 h-12 text-[var(--text-muted)] mb-3 opacity-50" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">No Enrolled Curriculum Found</h3>
            <p className="text-xs text-[var(--text-muted)] max-w-sm mt-1">
              Finalize elective enrollment or add subjects to visualize the semester progression map.
            </p>
          </div>
        ) : (
          <div
            className="inline-flex gap-8 relative pb-10 transition-transform origin-top-left"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            {/* SVG Connector Layer */}
            {showPrereqs && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none z-10"
                style={{ overflow: 'visible' }}
                data-testid="prerequisite-svg-canvas"
              >
                <defs>
                  <marker
                    id="arrow-satisfied"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 9 5 L 0 9 z" fill="#10b981" />
                  </marker>
                  <marker
                    id="arrow-unsatisfied"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 9 5 L 0 9 z" fill="#f59e0b" />
                  </marker>
                </defs>

                {connectorPaths.map(({ edge, pathData, isHighlighted }) => (
                  <path
                    key={`${edge.fromSubjectId}->${edge.toSubjectId}`}
                    d={pathData}
                    fill="none"
                    stroke={edge.isFoundationSatisfied ? '#10b981' : '#f59e0b'}
                    strokeWidth={isHighlighted ? 3 : 1.75}
                    strokeDasharray={edge.isFoundationSatisfied ? undefined : '5,4'}
                    markerEnd={`url(#${edge.isFoundationSatisfied ? 'arrow-satisfied' : 'arrow-unsatisfied'})`}
                    className={`transition-all duration-300 ${
                      connectedNodes
                        ? isHighlighted
                          ? 'opacity-100 shadow-md'
                          : 'opacity-15'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  />
                ))}
              </svg>
            )}

            {/* Semester Columns */}
            {graph.columns.map((column) => {
              // Visible subjects after filter
              const visibleSubjects = column.subjects.filter((subj) =>
                filteredSubjectIds.has(subj.subjectId)
              );

              return (
                <div
                  key={column.semesterId}
                  className="w-72 shrink-0 flex flex-col gap-3 relative z-20"
                  data-testid={`semester-column-${column.semesterId}`}
                >
                  {/* Semester Header */}
                  <div className="p-3 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border-subtle)] shadow-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <h3 className="text-xs font-bold text-[var(--text-primary)] truncate">
                        {column.semesterTitle}
                      </h3>
                      <span className="text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {Math.round(column.masteryPercent)}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${column.masteryPercent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                      <span>{column.completedLeaves} / {column.totalLeaves} Topics</span>
                      <span>{column.totalCredits} Credits</span>
                    </div>
                  </div>

                  {/* Subject Cards Stack */}
                  <div className="flex flex-col gap-2.5">
                    {visibleSubjects.length === 0 ? (
                      <div className="p-4 rounded-xl border border-dashed border-[var(--border-subtle)] text-center text-xs text-[var(--text-muted)] italic">
                        No matching subjects
                      </div>
                    ) : (
                      visibleSubjects.map((subj) => {
                        const isSelected = selectedSubjectId === subj.subjectId;
                        const isHovered = hoveredSubjectId === subj.subjectId;

                        // Check connectedness for dimming
                        const isConnected =
                          !connectedNodes ||
                          subj.subjectId === connectedNodes.activeId ||
                          connectedNodes.upstream.has(subj.subjectId) ||
                          connectedNodes.downstream.has(subj.subjectId);

                        const isUpstream = connectedNodes?.upstream.has(subj.subjectId);
                        const isDownstream = connectedNodes?.downstream.has(subj.subjectId);

                        return (
                          <div
                            key={subj.subjectId}
                            ref={(el) => {
                              if (el) cardRefs.current.set(subj.subjectId, el);
                              else cardRefs.current.delete(subj.subjectId);
                            }}
                            role="button"
                            tabIndex={0}
                            aria-pressed={isSelected}
                            aria-label={`${subj.title}, ${subj.courseCode || ''}, ${subj.masteryPercent}% mastered`}
                            data-testid={`subject-card-${subj.subjectId}`}
                            onClick={() => {
                              setSelectedSubjectId((prev) =>
                                prev === subj.subjectId ? null : subj.subjectId
                              );
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedSubjectId((prev) =>
                                  prev === subj.subjectId ? null : subj.subjectId
                                );
                              }
                            }}
                            onMouseEnter={() => setHoveredSubjectId(subj.subjectId)}
                            onMouseLeave={() => setHoveredSubjectId(null)}
                            className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer select-none text-left relative focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50 ${
                              isSelected
                                ? 'bg-[var(--bg-surface-elevated)] border-emerald-500 shadow-md ring-2 ring-emerald-500/30'
                                : isHovered
                                ? 'bg-[var(--bg-surface-hover)] border-[var(--border-strong)] shadow-xs'
                                : 'bg-[var(--bg-surface)] border-[var(--border-subtle)]'
                            } ${
                              connectedNodes && !isConnected
                                ? 'opacity-35 grayscale-30'
                                : 'opacity-100'
                            }`}
                          >
                            {/* Upstream/Downstream Relation Indicator Badges */}
                            {isUpstream && (
                              <span className="absolute -top-2 right-2 text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                                Prerequisite
                              </span>
                            )}
                            {isDownstream && (
                              <span className="absolute -top-2 right-2 text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700">
                                Progression
                              </span>
                            )}

                            {/* Top Badges Row */}
                            <div className="flex items-center justify-between gap-1.5 mb-1.5">
                              <span className="text-[11px] font-mono font-semibold text-[var(--text-secondary)] truncate">
                                {subj.courseCode || 'CORE'}
                              </span>

                              <div className="flex items-center gap-1 shrink-0">
                                {subj.isLab && (
                                  <span
                                    title="Laboratory subject"
                                    className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/50 flex items-center gap-0.5"
                                  >
                                    <FlaskConical className="w-2.5 h-2.5" /> LAB
                                  </span>
                                )}

                                {subj.credits !== null && (
                                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                                    {subj.credits} cr
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Title */}
                            <h4 className="text-xs font-semibold text-[var(--text-primary)] line-clamp-2 mb-2 leading-snug">
                              {subj.title}
                            </h4>

                            {/* Progress Bar & Percentage */}
                            <div className="space-y-1 mb-2">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-[var(--text-muted)]">
                                  {subj.completedLeaves} / {subj.totalLeaves} topics
                                </span>
                                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                  {Math.round(subj.masteryPercent)}%
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    subj.masteryTier === 'mastered'
                                      ? 'bg-emerald-500'
                                      : subj.masteryTier === 'in-progress'
                                      ? 'bg-teal-500'
                                      : 'bg-gray-400 dark:bg-gray-600'
                                  }`}
                                  style={{ width: `${subj.masteryPercent}%` }}
                                />
                              </div>
                            </div>

                            {/* Risk / Pacing Indicator */}
                            {subj.riskStatus !== 'none' && (
                              <div className="pt-1.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-[10px]">
                                {subj.riskStatus === 'overdue' && (
                                  <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold">
                                    <AlertCircle className="w-3 h-3" /> Overdue Deadline
                                  </span>
                                )}
                                {subj.riskStatus === 'behind' && (
                                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                                    <Clock className="w-3 h-3" /> Behind Schedule
                                  </span>
                                )}
                                {subj.riskStatus === 'on-track' && (
                                  <span className="flex items-center gap-1 text-teal-600 dark:text-teal-400">
                                    <CheckCircle2 className="w-3 h-3" /> On Track
                                  </span>
                                )}
                                {subj.riskStatus === 'ahead' && (
                                  <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                                    <Sparkles className="w-3 h-3" /> Ahead of Pace
                                  </span>
                                )}

                                {subj.examRiskLevel && (
                                  <span
                                    title={subj.examRiskReason || undefined}
                                    className={`px-1 rounded font-bold ${
                                      subj.examRiskLevel === 'Critical' || subj.examRiskLevel === 'High'
                                        ? 'text-rose-600 dark:text-rose-400'
                                        : 'text-amber-600 dark:text-amber-400'
                                    }`}
                                  >
                                    Exam: {subj.examRiskLevel}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Subject Mastery Inspector (Docked Panel) */}
      {selectedSubject && (
        <div
          className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] p-4 sm:p-5 max-h-72 overflow-y-auto animate-in slide-in-from-bottom-2 duration-200"
          data-testid="subject-mastery-inspector"
        >
          <div className="max-w-5xl mx-auto space-y-4">
            {/* Inspector Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                    {selectedSubject.courseCode || 'COURSE'}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] font-medium">
                    Semester {selectedSubject.semesterIndex}
                  </span>
                  {selectedSubject.isLab && (
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300">
                      Laboratory
                    </span>
                  )}
                  {selectedSubject.credits !== null && (
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                      {selectedSubject.credits} Credits
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  {selectedSubject.title}
                </h3>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {onNavigateToNode && (
                  <button
                    type="button"
                    onClick={() => onNavigateToNode(selectedSubject.subjectId)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    data-testid="jump-to-tree-btn"
                  >
                    <span>Jump to Syllabus Tree</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedSubjectId(null)}
                  aria-label="Close inspector"
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface-hover)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Metrics Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                <span className="text-[var(--text-muted)] block mb-0.5">Mastery Status</span>
                <span className="text-sm font-bold capitalize text-emerald-600 dark:text-emerald-400">
                  {selectedSubject.masteryTier.replace('-', ' ')} ({Math.round(selectedSubject.masteryPercent)}%)
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                <span className="text-[var(--text-muted)] block mb-0.5">Topic Completion</span>
                <span className="text-sm font-bold text-[var(--text-primary)]">
                  {selectedSubject.completedLeaves} / {selectedSubject.totalLeaves} Leaves
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                <span className="text-[var(--text-muted)] block mb-0.5">Deadline Pacing</span>
                <span className="text-sm font-bold capitalize text-[var(--text-primary)]">
                  {selectedSubject.riskStatus}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                <span className="text-[var(--text-muted)] block mb-0.5">Exam Forecast</span>
                <span className="text-sm font-bold text-[var(--text-primary)]">
                  {selectedSubject.examRiskLevel || 'Normal'}
                </span>
              </div>
            </div>

            {/* Module Breakdown List */}
            <div>
              <h4 className="text-xs font-bold text-[var(--text-secondary)] mb-2 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-600" /> Module Progress Breakdown
              </h4>
              {selectedSubject.modules.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] italic">No individual modules specified for this subject.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {selectedSubject.modules.map((mod) => (
                    <div
                      key={mod.moduleId}
                      className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[var(--text-primary)] truncate max-w-[200px]">
                          {mod.title}
                        </span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                          {Math.round(mod.masteryPercent)}%
                        </span>
                      </div>
                      <div className="w-full h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${mod.masteryPercent}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] block">
                        {mod.completedLeaves} / {mod.totalLeaves} topics completed
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
