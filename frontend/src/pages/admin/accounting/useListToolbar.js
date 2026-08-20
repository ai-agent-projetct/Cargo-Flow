import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { exportCsv } from '../../../utils/exportCsv';

// The accounting lists all carry the same three toolbar controls — Export,
// Favorites and a column toggle. This owns their behaviour so each list wires
// them up the same way instead of repeating it.
//
// `columns` is the full ordered list of column labels; `hidden` is what the
// user has switched off, remembered per list.
export const useListToolbar = ({ key, rows, columns = [], exportSpec }) => {
  const [hidden, setHidden] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`cargoflo.cols.${key}`)) || []; } catch { return []; }
  });
  const [favorite, setFavorite] = useState(() => !!localStorage.getItem(`cargoflo.fav.${key}`));
  const [colsOpen, setColsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(`cargoflo.cols.${key}`, JSON.stringify(hidden));
  }, [hidden, key]);

  useEffect(() => {
    setHidden(() => {
      try { return JSON.parse(localStorage.getItem(`cargoflo.cols.${key}`)) || []; } catch { return []; }
    });
    setFavorite(!!localStorage.getItem(`cargoflo.fav.${key}`));
  }, [key]);

  const shownColumns = columns.filter((c) => !hidden.includes(c));

  // Export what is on screen, so the file matches the filters in force.
  const onExport = () => {
    if (exportCsv(rows, exportSpec, key)) toast.success(`Exported ${rows.length} rows`);
    else toast.error('Nothing to export');
  };

  const toggleFavorite = (view) => {
    const k = `cargoflo.fav.${key}`;
    if (favorite) { localStorage.removeItem(k); setFavorite(false); toast('Removed from favourites'); return; }
    localStorage.setItem(k, JSON.stringify(view || {}));
    setFavorite(true);
    toast.success('Saved current view to favourites');
  };

  const toggleColumn = (c) =>
    setHidden((h) => (h.includes(c) ? h.filter((x) => x !== c) : [...h, c]));

  return {
    hidden, setHidden, shownColumns, toggleColumn,
    favorite, toggleFavorite,
    colsOpen, setColsOpen,
    onExport,
  };
};

export default useListToolbar;
