import { useCallback, useEffect, useRef, useState } from "react";

// Drives every list/table screen. Pass a fetcher that takes a params object
// and resolves to either { data, total, page, pages } (paginated endpoints)
// or a plain array. Returns the rows plus `params`/`setParams` (merge-updates
// and refetches) and a manual `reload()`.
export function useList(fetcher, initialParams = {}) {
  const [params, setParamsState] = useState(initialParams);
  const [state, setState] = useState({
    loading: true,
    error: null,
    data: [],
    total: 0,
    page: 1,
    pages: 1,
  });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback((p) => {
    setState((s) => ({ ...s, loading: true }));
    fetcherRef.current(p)
      .then((res) => {
        const norm = Array.isArray(res)
          ? { data: res, total: res.length, page: 1, pages: 1 }
          : res;
        setState({ loading: false, error: null, ...norm });
      })
      .catch((err) =>
        setState((s) => ({
          ...s,
          loading: false,
          error: typeof err === "string" ? err : "Failed to load.",
        }))
      );
  }, []);

  useEffect(() => {
    load(params);
  }, [load, params]);

  const setParams = useCallback((patch) => {
    setParamsState((prev) => {
      const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
      // reset to page 1 whenever a non-page filter changes
      if (!("page" in (typeof patch === "function" ? {} : patch))) next.page = 1;
      return next;
    });
  }, []);

  return { ...state, params, setParams, reload: () => load(params) };
}
