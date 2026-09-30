import { useState, useMemo } from 'react';

export default function DataPage({ title, subtitle, rows = [], columns = [], actions = null, stats = null, searchable = true }) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase().trim();
    return rows.filter(row => {
      return columns.some(col => {
        const val = row[col.key];
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(q);
      });
    });
  }, [rows, columns, searchQuery]);

  return (
    <>
      <div className="page-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle || 'Dữ liệu được lọc theo phiên đăng nhập và phạm vi quyền hiện hành.'}</p>
        </div>
        {actions}
      </div>

      {stats && stats.length > 0 && (
        <div className="kpi-stats-grid">
          {stats.map((s, idx) => (
            <div key={idx} className="stat-card">
              <div className="stat-card-header">
                <span className="stat-label">{s.label}</span>
              </div>
              <div className="stat-value">{s.value}</div>
              {s.subtext && <div className="stat-subtext">{s.subtext}</div>}
            </div>
          ))}
        </div>
      )}

      <div className="card table-card">
        <div className="table-header-bar">
          <div className="table-count-badge">
            <span className="count-dot" aria-hidden="true"></span>
            <span>Hiển thị <strong>{filteredRows.length}</strong>{filteredRows.length !== rows.length ? ` / ${rows.length}` : ''} bản ghi</span>
          </div>
          {searchable && rows.length > 0 && (
            <div className="table-search-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.3-4.3"/>
              </svg>
              <input
                type="text"
                placeholder="Lọc nhanh bản ghi..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                aria-label="Lọc nhanh dữ liệu bảng"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="table-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Xóa bộ lọc"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>
        <table className="data-table">
          <thead>
            <tr>{columns.map(c => <th key={c.key}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {filteredRows.length ? (
              filteredRows.map((row, i) => (
                <tr key={`${row.id || row.user_id || row.delegation_id || 'row'}-${i}`}>
                  {columns.map(c => (
                    <td key={c.key}>{c.render ? c.render(row) : (row[c.key] ?? '—')}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td className="empty-state" colSpan={columns.length || 1}>
                  {searchQuery ? `Không tìm thấy bản ghi khớp với "${searchQuery}"` : 'Không có dữ liệu phù hợp.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

