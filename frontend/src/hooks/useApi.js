import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Generic data fetching hook with loading/error/data states.
 * @param {Function} apiFn - The API function to call
 * @param {any[]} deps - Dependencies to re-fetch on change
 * @param {Object} options
 */
const useApi = (apiFn, deps = [], options = {}) => {
  const { immediate = true, params = null, onSuccess, onError } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const response = await (args.length > 0 ? apiFn(...args) : params ? apiFn(params) : apiFn());
      if (mountedRef.current) {
        const result = response.data;
        setData(result);
        onSuccess?.(result);
        return result;
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err);
        onError?.(err);
      }
      throw err;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiFn, ...deps]);

  useEffect(() => {
    if (immediate) execute();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execute]);

  return { data, loading, error, execute, setData };
};

/**
 * Paginated list fetching hook.
 */
export const usePaginatedApi = (apiFn, initialParams = {}) => {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [params, setParams] = useState({ page: 1, page_size: 20, ...initialParams });

  const fetch = useCallback(async (overrideParams) => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = overrideParams || params;
      const response = await apiFn(queryParams);
      const result = response.data;
      if (result.results !== undefined) {
        setData(result.results);
        setTotal(result.count || 0);
      } else if (Array.isArray(result)) {
        setData(result);
        setTotal(result.length);
      } else {
        setData([]);
        setTotal(0);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [apiFn, params]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const updateParams = (newParams) => {
    setParams((prev) => ({ ...prev, ...newParams, page: newParams.page || 1 }));
  };

  const goToPage = (page) => {
    setParams((prev) => ({ ...prev, page }));
  };

  const refresh = () => fetch();

  return { data, total, loading, error, params, updateParams, goToPage, refresh, setData };
};

export default useApi;
