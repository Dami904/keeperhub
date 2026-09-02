"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useRef } from "react";
import { buildRunsQuery } from "@/lib/analytics/runs-query";
import type { FacetDimension, RunFacets } from "@/lib/analytics/types";
import {
  analyticsCustomEndAtom,
  analyticsCustomStartAtom,
  analyticsDurationFilterAtom,
  analyticsFacetsAtom,
  analyticsGasFiltersAtom,
  analyticsNetworkFiltersAtom,
  analyticsProjectIdAtom,
  analyticsRangeAtom,
  analyticsSearchAtom,
  analyticsSourceFiltersAtom,
  analyticsStatusFiltersAtom,
} from "@/lib/atoms/analytics";

/**
 * Loads one facet dimension on demand.
 *
 * Network and gas counts both read `workflow_execution_logs`, which is the
 * table that took prod down when the run filters walked it too eagerly. Putting
 * them on the dashboard's ten-second poll would pay that cost for every open
 * tab forever, so they are fetched when the dropdown that shows them opens, and
 * only when the window or the other filters have actually moved since.
 */
export function useLazyFacet(dimension: FacetDimension): () => void {
  const setFacets = useSetAtom(analyticsFacetsAtom);
  const range = useAtomValue(analyticsRangeAtom);
  const statuses = useAtomValue(analyticsStatusFiltersAtom);
  const sources = useAtomValue(analyticsSourceFiltersAtom);
  const networks = useAtomValue(analyticsNetworkFiltersAtom);
  const gas = useAtomValue(analyticsGasFiltersAtom);
  const duration = useAtomValue(analyticsDurationFilterAtom);
  const search = useAtomValue(analyticsSearchAtom);
  const projectId = useAtomValue(analyticsProjectIdAtom);
  const customStart = useAtomValue(analyticsCustomStartAtom);
  const customEnd = useAtomValue(analyticsCustomEndAtom);
  const lastQuery = useRef<string | null>(null);

  return useCallback((): void => {
    const query = buildRunsQuery({
      range,
      statuses,
      sources,
      networks,
      gas,
      duration,
      search,
      projectId,
      customStart,
      customEnd,
      omitStatus: true,
      dimensions: [dimension],
    });
    // Opening the same dropdown twice over unchanged filters asks nothing.
    if (lastQuery.current === query) {
      return;
    }
    lastQuery.current = query;

    fetch(`/api/analytics/facets?${query}`)
      .then((res) => (res.ok ? (res.json() as Promise<RunFacets>) : null))
      .then((data) => {
        if (data) {
          setFacets((current) => ({ ...current, ...data }));
        }
      })
      .catch(() => {
        // A missing count leaves the option unlabelled; the filter still works.
        lastQuery.current = null;
      });
  }, [
    dimension,
    range,
    statuses,
    sources,
    networks,
    gas,
    duration,
    search,
    projectId,
    customStart,
    customEnd,
    setFacets,
  ]);
}
