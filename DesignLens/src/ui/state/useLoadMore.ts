import { useEffect, useState } from "react";

/**
 * Renders large result sets (an audit can easily produce tens of thousands of issues) in
 * bounded chunks. Without this, switching to a view that mounts one DOM node per item freezes
 * the plugin UI thread — capping the initial render and growing on demand keeps navigation snappy
 * regardless of library size.
 */
export function useLoadMore<T>(items: T[], pageSize = 100) {
  const [count, setCount] = useState(pageSize);

  useEffect(() => {
    setCount(pageSize);
  }, [items, pageSize]);

  return {
    visible: items.slice(0, count),
    hasMore: count < items.length,
    remaining: Math.max(0, items.length - count),
    total: items.length,
    loadMore: () => setCount((c) => c + pageSize)
  };
}
