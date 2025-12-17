import React, { useState, useMemo, useRef, useEffect } from 'react';
import BlackColumnModal from './BlackColumnModal';
import BlackForm from './BlackForm';
import styles from './BlackGrid.module.css';

// 기본 API 클라이언트 (fetch 기반)
const defaultApi = {
  get: async (url) => {
    const res = await fetch(url);
    return res.json();
  }
};

// 날짜 포맷 (YYYY-MM-DD)
const formatDate = (value) => {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  } catch {
    return value;
  }
};

// 타입별 포맷팅
const formatByType = (value, type) => {
  if (value == null || value === '') return '';
  switch (type) {
    case 'date':
      return formatDate(value);
    case 'number':
    case 'currency':
    case 'integer':
      return Number(value).toLocaleString('ko-KR', { maximumFractionDigits: 0 });
    case 'float':
      return Number(value).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    default:
      return value;
  }
};

// URL 체크
const isUrl = (value) => typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'));

/**
 * BlackGrid - 통합 데이터 그리드 + 폼
 *
 * 기본 Props:
 * - data: 데이터 배열
 * - onRowClick: 행 클릭 핸들러
 * - onCellChange: 셀 변경 핸들러
 * - onEdit/onDelete: 컨텍스트 메뉴 핸들러
 * - onAddRow: 행 추가 핸들러
 *
 * 컬럼 설정 Props (통합):
 * - pageName: 페이지 식별자 (컬럼 저장/로드용)
 * - tableName: DB 테이블명
 * - defaultColumns: 기본 컬럼 정의
 * - defaultFormColumns: 기본 폼 컬럼 정의
 * - onFormConfig: (formColumns, formWidth) => void - 폼 설정 콜백
 * - columnExtender: (columns) => columns - 컬럼 확장 함수 (actions 등 추가)
 *
 * 폼 통합 Props:
 * - enableForm: 폼 기능 활성화 (true면 더블클릭/추가 시 폼 열림)
 * - formTitle: 폼 대화창 제목
 * - onFormSave: 폼 저장 콜백 (formData, isEdit) => Promise
 * - onFormDelete: 폼 삭제 콜백 (data) => Promise
 */
const BlackGrid = ({
  data,
  onRowClick,
  onRowDoubleClick,
  onCellChange,
  onEdit,
  onDelete,
  onAddRow,
  showRowNumber = false,
  maxHeight = null,
  selectedRowId = null,
  // 컬럼 설정 통합
  pageName,
  tableName,
  defaultColumns = [],
  defaultFormColumns = [],
  onFormConfig,
  columnExtender,
  // 페이지네이션
  pagination = null,
  onPageChange,
  // 폼 통합
  enableForm = false,
  formTitle = '데이터 입력',
  onFormSave,
  onFormDelete,
  // API 클라이언트 (옵션)
  api = defaultApi,
}) => {
  // 컬럼 상태
  const [columns, setColumns] = useState(defaultColumns);
  const [formColumns, setFormColumns] = useState(defaultFormColumns);
  const [formWidth, setFormWidth] = useState(500);
  const [pageTitle, setPageTitle] = useState('');
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [filterValues, setFilterValues] = useState({});
  const [isColumnsLoaded, setIsColumnsLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 폼 상태
  const [showForm, setShowForm] = useState(false);
  const [formEditData, setFormEditData] = useState(null);

  // 그리드 상태
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [editingCell, setEditingCell] = useState({ rowId: null, field: null });
  const [cellValue, setCellValue] = useState('');
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, row: null });
  const clickTimer = useRef(null);

  // 컬럼 설정 직접 로드 (BlackColumnModal 대신)
  useEffect(() => {
    if (!pageName || !tableName || isColumnsLoaded) return;

    const loadColumns = async () => {
      try {
        const result = await api.get(`/api/col-def?page_name=${pageName}&table_name=${tableName}`);
        if (result.columns && result.columns.length > 0) {
          setColumns(result.columns);
        }
        if (result.form_columns) {
          setFormColumns(result.form_columns);
        }
        if (result.form_width) {
          setFormWidth(result.form_width);
        }
        if (result.page_title) {
          setPageTitle(result.page_title);
        }
      } catch (e) {
        // API 실패 시 defaultColumns 사용
      }
      setIsColumnsLoaded(true);
    };

    loadColumns();
  }, [pageName, tableName, isColumnsLoaded]);

  // 폼 설정 변경 시 콜백 호출
  useEffect(() => {
    if (onFormConfig && (formColumns.length > 0 || formWidth !== 500)) {
      onFormConfig(formColumns, formWidth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formColumns, formWidth]);

  // 컨텍스트 메뉴 닫기
  useEffect(() => {
    if (!contextMenu.visible) return;
    const close = () => setContextMenu({ visible: false, x: 0, y: 0, row: null });
    document.addEventListener('click', close);
    document.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('scroll', close, true);
    };
  }, [contextMenu.visible]);

  // 컬럼 확장 적용
  const extendedColumns = useMemo(() => {
    const cols = columnExtender ? columnExtender(columns) : columns;
    return cols;
  }, [columns, columnExtender]);

  // 컬럼 정규화
  const normalizedColumns = useMemo(() => extendedColumns.map(col => ({
    field: col.field,
    headerName: col.headerName || col.field,
    width: col.width,
    type: col.type || 'string',
    editable: col.editable ?? false,
    sortable: col.sortable ?? true,
    filterable: col.filterable ?? false,
    searchable: col.searchable ?? false,
    visible: col.visible ?? true,
    valueGetter: col.valueGetter,
    valueFormatter: col.valueFormatter,
    renderCell: col.renderCell,
    renderEditCell: col.renderEditCell,  // 커스텀 편집 셀 렌더러
    editField: col.editField,  // 실제 저장할 필드명 (다른 필드로 매핑)
    valueOptions: col.valueOptions,
    getActions: col.getActions,
  })), [extendedColumns]);

  // 필터 가능한 컬럼
  const filterColumns = useMemo(() =>
    normalizedColumns.filter(col => col.filterable && col.visible),
    [normalizedColumns]
  );

  // 검색 가능한 컬럼
  const searchableColumns = useMemo(() =>
    normalizedColumns.filter(col => col.searchable && col.visible),
    [normalizedColumns]
  );

  // 표시할 컬럼
  const visibleColumns = useMemo(() =>
    normalizedColumns.filter(col => col.visible && !col.filterable),
    [normalizedColumns]
  );

  // 고유 값 추출 (필터용)
  const getUniqueValues = (field) => {
    const values = data.map(row => row[field]).filter(v => v != null && v !== '');
    return [...new Set(values)].sort();
  };

  // 필터링된 데이터
  const filteredData = useMemo(() => {
    let result = data;

    // 필터 적용
    if (Object.keys(filterValues).length > 0) {
      result = result.filter(row => {
        return filterColumns.every(col => {
          const filterValue = filterValues[col.field];
          if (!filterValue) return true;
          return String(row[col.field]) === String(filterValue);
        });
      });
    }

    // 검색 적용
    if (searchTerm && searchableColumns.length > 0) {
      const term = searchTerm.toLowerCase();
      result = result.filter(row => {
        return searchableColumns.some(col => {
          const value = row[col.field];
          if (value == null) return false;
          return String(value).toLowerCase().includes(term);
        });
      });
    }

    return result;
  }, [data, filterValues, filterColumns, searchTerm, searchableColumns]);

  // 정렬된 데이터
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return [...filteredData];
    const col = normalizedColumns.find(c => c.field === sortConfig.key);
    return [...filteredData].sort((a, b) => {
      let aVal = col?.valueGetter ? col.valueGetter({ row: a, value: a[sortConfig.key] }) : a[sortConfig.key];
      let bVal = col?.valueGetter ? col.valueGetter({ row: b, value: b[sortConfig.key] }) : b[sortConfig.key];
      if (aVal == null) return sortConfig.direction === 'ascending' ? 1 : -1;
      if (bVal == null) return sortConfig.direction === 'ascending' ? -1 : 1;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'ascending' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig, normalizedColumns]);

  // 페이지네이션 적용된 데이터
  const displayData = useMemo(() => {
    if (!pagination) return sortedData;
    const { page = 1, pageSize = 20 } = pagination;
    const start = (page - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, pagination]);

  const totalPages = pagination
    ? Math.ceil((pagination.totalCount ?? sortedData.length) / (pagination.pageSize || 20))
    : 1;

  // 정렬 요청
  const requestSort = (field, sortable) => {
    if (sortable === false) return;
    setSortConfig(prev => ({
      key: field,
      direction: prev.key === field && prev.direction === 'ascending' ? 'descending' : 'ascending'
    }));
  };

  // 셀 값 계산
  const getCellValue = (row, col) => {
    const rawValue = row[col.field];
    return col.valueGetter ? col.valueGetter({ row, value: rawValue, field: col.field }) : rawValue;
  };

  // 이벤트 핸들러
  const handleRowClick = (row) => {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      if (onRowClick) onRowClick(row);
    }, 200);
  };

  const handleCellClick = (e, value, col, row) => {
    if (isUrl(value)) {
      e.stopPropagation();
      window.open(value, '_blank');
      return;
    }
    if (!col.editable && onRowClick) {
      onRowClick(row);
    }
  };

  const handleContextMenu = (e, row) => {
    if (!onEdit && !onDelete) return;
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, row });
  };

  const handleContextAction = (action) => {
    const row = contextMenu.row;
    setContextMenu({ visible: false, x: 0, y: 0, row: null });
    if (action === 'edit' && onEdit) onEdit(row);
    if (action === 'delete' && onDelete) onDelete(row);
  };

  const handleDoubleClick = (row, field, currentValue, col) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    // 폼 모드가 활성화된 경우 폼 열기
    if (enableForm && formColumns.length > 0) {
      setFormEditData(row);
      setShowForm(true);
      return;
    }
    if (onCellChange && col.editable) {
      let initialValue = currentValue;
      if (col.type === 'date' && currentValue?.includes?.('T')) {
        initialValue = currentValue.split('T')[0];
      }
      setEditingCell({ rowId: row.id, field });
      setCellValue(initialValue ?? '');
    } else if (onRowDoubleClick) {
      onRowDoubleClick(row);
    }
  };

  const handleCellSave = async (customValue = null) => {
    if (editingCell.rowId == null) return;
    const { rowId, field } = editingCell;
    const col = normalizedColumns.find(c => c.field === field);
    const saveField = col?.editField || field;  // editField가 있으면 그 필드로 저장
    const saveValue = customValue !== null ? customValue : cellValue;
    const originalRow = data.find(row => row.id === rowId);
    const originalValue = col?.editField ? originalRow[col.editField] : originalRow[field];
    if (originalRow && String(originalValue) !== String(saveValue)) {
      await onCellChange?.(rowId, saveField, saveValue);
    }
    setEditingCell({ rowId: null, field: null });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleCellSave(); }
    else if (e.key === 'Escape') setEditingCell({ rowId: null, field: null });
  };

  // 폼 핸들러
  const handleFormOpen = (rowData = null) => {
    setFormEditData(rowData);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setFormEditData(null);
  };

  const handleFormSave = async (formData) => {
    if (onFormSave) {
      const isEdit = !!formEditData?.id;
      await onFormSave(formData, isEdit);
    }
    handleFormClose();
  };

  const handleFormDelete = async (rowData) => {
    if (onFormDelete) {
      await onFormDelete(rowData);
    }
    handleFormClose();
  };

  // 행 추가 핸들러 (폼 모드 지원)
  const handleAddRowClick = () => {
    if (enableForm && formColumns.length > 0) {
      handleFormOpen(null);
    } else if (onAddRow) {
      onAddRow();
    }
  };

  // 셀 렌더링
  const renderCellContent = (row, col, rowIndex) => {
    const value = getCellValue(row, col);
    const params = { row, value, field: col.field, id: row.id, rowIndex };

    if (col.type === 'actions' && col.getActions) {
      return <div className={styles.actionsCell}>{col.getActions(params)}</div>;
    }

    if (editingCell.rowId === row.id && editingCell.field === col.field && col.editable) {
      // 커스텀 편집 셀 렌더러가 있으면 사용
      if (col.renderEditCell) {
        const onSave = (val) => handleCellSave(val);
        const onCancel = () => setEditingCell({ rowId: null, field: null });
        return col.renderEditCell(params, onSave, onCancel);
      }
      if (col.type === 'singleSelect' && col.valueOptions) {
        return (
          <select
            value={String(cellValue ?? '')}
            onChange={(e) => setCellValue(e.target.value)}
            onBlur={() => handleCellSave()}
            onKeyDown={handleKeyDown}
            autoFocus
            className={styles.editableInput}
          >
            {col.valueOptions.map(opt => {
              const v = typeof opt === 'object' ? opt.value : opt;
              const l = typeof opt === 'object' ? opt.label : opt;
              return <option key={String(v)} value={String(v)}>{l}</option>;
            })}
          </select>
        );
      }
      return (
        <input
          type="text"
          value={cellValue ?? ''}
          onChange={(e) => setCellValue(e.target.value)}
          onBlur={() => handleCellSave()}
          onKeyDown={handleKeyDown}
          autoFocus
          className={styles.editableInput}
          placeholder={col.type === 'date' ? 'YYYY-MM-DD' : ''}
        />
      );
    }

    if (col.renderCell) return col.renderCell(params);
    if (col.valueFormatter) return col.valueFormatter({ value, row, field: col.field });
    return formatByType(value, col.type);
  };

  // 필터 초기화
  const clearFilters = () => {
    setFilterValues({});
    setSearchTerm('');
  };
  const hasActiveFilters = Object.values(filterValues).some(v => v) || searchTerm;

  const showToolbar = filterColumns.length > 0 || searchableColumns.length > 0 || onAddRow || enableForm || pageName || pageTitle;

  return (
    <div className={styles.gridWrapper}>
      {/* 툴바 */}
      {showToolbar && (
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            {pageTitle && (
              <span className={styles.pageTitle}>{pageTitle}</span>
            )}
            {filterColumns.length > 0 && (
              <>
                {filterColumns.map(col => (
                  <div key={col.field} className={styles.filterItem}>
                    <label>{col.headerName}</label>
                    <select
                      value={filterValues[col.field] || ''}
                      onChange={(e) => setFilterValues(prev => ({ ...prev, [col.field]: e.target.value }))}
                    >
                      <option value="">전체</option>
                      {getUniqueValues(col.field).map(value => (
                        <option key={value} value={value}>{formatByType(value, col.type)}</option>
                      ))}
                    </select>
                  </div>
                ))}
                {hasActiveFilters && (
                  <button onClick={clearFilters} className={styles.clearFilterBtn}>초기화</button>
                )}
              </>
            )}
          </div>
          <div className={styles.toolbarRight}>
            {searchableColumns.length > 0 && (
              <div className={styles.searchBox}>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={searchableColumns.map(c => c.headerName).join(', ')}
                  className={styles.searchInput}
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className={styles.clearSearchBtn}>✕</button>
                )}
              </div>
            )}
            {(onAddRow || enableForm) && (
              <button onClick={handleAddRowClick} className={styles.addRowBtn} title="행 추가">＋</button>
            )}
            {pageName && (
              <button onClick={() => setShowColumnConfig(true)} className={styles.configBtn} title="컬럼 설정">⚙</button>
            )}
          </div>
        </div>
      )}

      {/* 테이블 */}
      <div className={styles.tableContainer} style={maxHeight ? { maxHeight, overflowY: 'auto' } : {}}>
        <table className={styles.blackGridTable}>
          <thead className={styles.stickyHeader}>
            <tr>
              {showRowNumber && <th className={styles.rowNumberHeader}>#</th>}
              {visibleColumns.map(col => (
                <th
                  key={col.field}
                  onClick={() => requestSort(col.field, col.sortable)}
                  className={`${styles.sortableHeader} ${col.sortable === false ? styles.noSort : ''}`}
                  style={col.width ? { width: `${col.width}px`, minWidth: `${col.width}px` } : {}}
                >
                  {col.headerName}
                  {col.sortable !== false && (
                    <span className={styles.sortIndicator}>
                      {sortConfig.key === col.field ? (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼') : null}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayData.length > 0 ? (
              displayData.map((row, rowIndex) => (
                <tr
                  key={row.id || rowIndex}
                  onClick={() => handleRowClick(row)}
                  onContextMenu={(e) => handleContextMenu(e, row)}
                  className={row.id === selectedRowId ? styles.selectedRow : ''}
                >
                  {showRowNumber && (
                    <td className={styles.rowNumberCell}>
                      {pagination ? (pagination.page - 1) * pagination.pageSize + rowIndex + 1 : rowIndex + 1}
                    </td>
                  )}
                  {visibleColumns.map(col => {
                    const value = getCellValue(row, col);
                    return (
                      <td
                        key={col.field}
                        onClick={(e) => handleCellClick(e, value, col, row)}
                        onDoubleClick={() => handleDoubleClick(row, col.field, row[col.field], col)}
                        style={col.width ? { width: `${col.width}px`, minWidth: `${col.width}px` } : {}}
                        className={isUrl(value) ? styles.urlCell : ''}
                      >
                        {renderCellContent(row, col, rowIndex)}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={visibleColumns.length + (showRowNumber ? 1 : 0)} className={styles.noData}>
                  검색된 데이터 없음
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 푸터 */}
      {pagination && (
        <div className={styles.gridFooter}>
          <div className={styles.footerLeft}>
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button onClick={() => onPageChange?.(1)} disabled={pagination.page <= 1} className={styles.pageBtn}>«</button>
                <button onClick={() => onPageChange?.(pagination.page - 1)} disabled={pagination.page <= 1} className={styles.pageBtn}>‹</button>
                <span className={styles.pageInfo}>{pagination.page} / {totalPages}</span>
                <button onClick={() => onPageChange?.(pagination.page + 1)} disabled={pagination.page >= totalPages} className={styles.pageBtn}>›</button>
                <button onClick={() => onPageChange?.(totalPages)} disabled={pagination.page >= totalPages} className={styles.pageBtn}>»</button>
              </div>
            )}
            <span className={styles.totalCount}>{sortedData.length}건</span>
          </div>
        </div>
      )}

      {/* 컨텍스트 메뉴 */}
      {contextMenu.visible && (onEdit || onDelete) && (
        <div className={styles.contextMenu} style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()}>
          {onEdit && <button className={styles.contextMenuItem} onClick={() => handleContextAction('edit')}>수정</button>}
          {onDelete && <button className={`${styles.contextMenuItem} ${styles.deleteItem}`} onClick={() => handleContextAction('delete')}>삭제</button>}
        </div>
      )}

      {/* 컬럼 설정 모달 (열릴 때만 마운트) */}
      {pageName && showColumnConfig && (
        <BlackColumnModal
          isOpen={showColumnConfig}
          onClose={() => setShowColumnConfig(false)}
          pageName={pageName}
          tableName={tableName}
          defaultColumns={columns}
          onSave={setColumns}
          onFormColumnsSave={setFormColumns}
        />
      )}

      {/* 폼 대화창 (내장) */}
      {enableForm && (
        <BlackForm
          open={showForm}
          title={formTitle}
          formColumns={formColumns}
          data={formEditData}
          onSave={handleFormSave}
          onDelete={onFormDelete ? handleFormDelete : undefined}
          onClose={handleFormClose}
          width={formWidth}
        />
      )}
    </div>
  );
};

export default BlackGrid;
