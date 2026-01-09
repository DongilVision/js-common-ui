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

// 날짜 입력 검사 및 변환 (YYYY-MM-DD 또는 MM-DD 허용)
const validateAndConvertDate = (value) => {
  if (!value || value.trim() === '') return { valid: true, value: '' };
  const trimmed = value.trim();

  // YYYY-MM-DD 형식
  const fullMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (fullMatch) {
    const [, year, month, day] = fullMatch;
    const m = month.padStart(2, '0');
    const d = day.padStart(2, '0');
    if (parseInt(m) >= 1 && parseInt(m) <= 12 && parseInt(d) >= 1 && parseInt(d) <= 31) {
      return { valid: true, value: `${year}-${m}-${d}` };
    }
  }

  // MM-DD 형식 (현재 연도 사용)
  const shortMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})$/);
  if (shortMatch) {
    const [, month, day] = shortMatch;
    const m = month.padStart(2, '0');
    const d = day.padStart(2, '0');
    if (parseInt(m) >= 1 && parseInt(m) <= 12 && parseInt(d) >= 1 && parseInt(d) <= 31) {
      const year = new Date().getFullYear();
      return { valid: true, value: `${year}-${m}-${d}` };
    }
  }

  return { valid: false, value: trimmed };
};

// 숫자 입력 검사
const validateNumber = (value) => {
  // null, undefined, 빈 문자열 처리
  if (value == null || value === '') return { valid: true, value: '' };
  // 숫자 타입인 경우 바로 반환
  if (typeof value === 'number') return { valid: true, value: value };
  // 문자열로 변환
  const str = String(value).trim();
  if (str === '') return { valid: true, value: '' };
  const trimmed = str.replace(/,/g, '');
  const num = parseFloat(trimmed);
  if (isNaN(num)) return { valid: false, value: trimmed };
  return { valid: true, value: num };
};

// 타입별 포맷팅
const formatByType = (value, type) => {
  if (value == null || value === '') return '';
  switch (type) {
    case 'date':
    case 'datetime':
      return formatDate(value);
    case 'number':
    case 'currency':
    case 'integer':
    case 'float': {
      const num = Number(value);
      // 소수점 이하가 없으면 정수로 표시
      if (Number.isInteger(num)) {
        return num.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
      }
      return num.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
    }
    default:
      return value;
  }
};

// URL 체크
const isUrl = (value) => typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'));

// 날짜 선택 모달 컴포넌트
const DatePickerModal = ({ value, x, y, onSelect, onClose }) => {
  const [currentDate, setCurrentDate] = useState(() => {
    if (value) {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? new Date() : parsed;
    }
    return new Date();
  });
  const [viewDate, setViewDate] = useState(currentDate);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(`.${styles.datePickerModal}`)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const days = [];

  // 빈 셀 추가 (월 시작 전)
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(<div key={`empty-${i}`} className={styles.dayEmpty}></div>);
  }

  // 날짜 셀 추가
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isSelected = value === dateStr;
    const isToday = formatDate(new Date()) === dateStr;
    days.push(
      <button
        key={day}
        type="button"
        className={`${styles.dayCell} ${isSelected ? styles.daySelected : ''} ${isToday ? styles.dayToday : ''}`}
        onClick={() => onSelect(dateStr)}
      >
        {day}
      </button>
    );
  }

  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const prevYear = () => setViewDate(new Date(year - 1, month, 1));
  const nextYear = () => setViewDate(new Date(year + 1, month, 1));

  // 화면 경계 체크
  const modalStyle = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 260),
    top: Math.min(y, window.innerHeight - 300)
  };

  return (
    <div className={styles.datePickerModal} style={modalStyle}>
      <div className={styles.datePickerHeader}>
        <button type="button" onClick={prevYear} className={styles.navBtn}>«</button>
        <button type="button" onClick={prevMonth} className={styles.navBtn}>‹</button>
        <span className={styles.monthYear}>{year}년 {monthNames[month]}</span>
        <button type="button" onClick={nextMonth} className={styles.navBtn}>›</button>
        <button type="button" onClick={nextYear} className={styles.navBtn}>»</button>
      </div>
      <div className={styles.weekDays}>
        <div className={styles.weekDay}>일</div>
        <div className={styles.weekDay}>월</div>
        <div className={styles.weekDay}>화</div>
        <div className={styles.weekDay}>수</div>
        <div className={styles.weekDay}>목</div>
        <div className={styles.weekDay}>금</div>
        <div className={styles.weekDay}>토</div>
      </div>
      <div className={styles.daysGrid}>{days}</div>
      <div className={styles.datePickerFooter}>
        <button type="button" onClick={() => onSelect(formatDate(new Date()))} className={styles.todayBtn}>오늘</button>
        <button type="button" onClick={() => onSelect('')} className={styles.clearBtn}>지우기</button>
      </div>
    </div>
  );
};

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
  showCheckbox = false,
  onSelectionChange,
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
  // 초기 필터값 (옵션)
  initialFilterValues = {},
}) => {
  // 컬럼 상태
  const [columns, setColumns] = useState(defaultColumns);
  const [formColumns, setFormColumns] = useState(defaultFormColumns);
  const [formWidth, setFormWidth] = useState(500);
  const [pageTitle, setPageTitle] = useState('');
  const [rowNumberEnabled, setRowNumberEnabled] = useState(showRowNumber);
  const [checkboxEnabled, setCheckboxEnabled] = useState(showCheckbox);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [filterValues, setFilterValues] = useState(initialFilterValues);
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
  const [datePicker, setDatePicker] = useState({ visible: false, rowId: null, field: null, value: '', x: 0, y: 0 });
  const clickTimer = useRef(null);
  const dateInputRef = useRef(null);
  const tableContainerRef = useRef(null);

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
        if (result.show_row_number !== undefined) {
          setRowNumberEnabled(!!result.show_row_number);
        }
        if (result.show_checkbox !== undefined) {
          setCheckboxEnabled(!!result.show_checkbox);
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

  // selectedRowId가 있으면 해당 행으로 스크롤
  useEffect(() => {
    if (selectedRowId && tableContainerRef.current && displayData.length > 0) {
      const rowIndex = displayData.findIndex(row => row.id === selectedRowId);
      if (rowIndex >= 0) {
        // 약간의 지연 후 스크롤 (렌더링 완료 후)
        setTimeout(() => {
          const container = tableContainerRef.current;
          const rows = container?.querySelectorAll('tbody tr');
          if (rows && rows[rowIndex]) {
            rows[rowIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    }
  }, [selectedRowId, displayData]);

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
      // 날짜 타입: T 이후 시간 부분 제거
      if ((col.type === 'date' || col.type === 'datetime') && currentValue?.includes?.('T')) {
        initialValue = currentValue.split('T')[0];
      }
      // 숫자 타입: 문자열로 변환 (소수점 이하가 없으면 정수로 표시)
      if (col.type === 'number' || col.type === 'currency' || col.type === 'integer' || col.type === 'float') {
        if (currentValue != null) {
          const num = Number(currentValue);
          initialValue = Number.isInteger(num) ? String(Math.round(num)) : String(num);
        } else {
          initialValue = '';
        }
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
    const saveField = col?.editField || field;
    let saveValue = customValue !== null ? customValue : cellValue;

    // 타입별 입력 검사
    if (col?.type === 'date' || col?.type === 'datetime') {
      const result = validateAndConvertDate(saveValue);
      if (!result.valid) {
        alert('날짜 형식이 올바르지 않습니다.\n허용 형식: YYYY-MM-DD 또는 MM-DD');
        return;
      }
      saveValue = result.value;
    } else if (col?.type === 'number' || col?.type === 'currency' || col?.type === 'integer' || col?.type === 'float') {
      const result = validateNumber(saveValue);
      if (!result.valid) {
        alert('숫자 형식이 올바르지 않습니다.');
        return;
      }
      saveValue = result.value;
    }

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

  // 체크박스 선택 핸들러
  const handleRowSelect = (rowId, checked) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(rowId);
      } else {
        newSet.delete(rowId);
      }
      // 콜백 호출
      if (onSelectionChange) {
        const selectedData = data.filter(row => newSet.has(row.id));
        onSelectionChange(Array.from(newSet), selectedData);
      }
      return newSet;
    });
  };

  // 전체 선택/해제 핸들러 (체크박스용)
  const handleSelectAll = (checked) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (checked) {
        displayData.forEach(row => newSet.add(row.id));
      } else {
        displayData.forEach(row => newSet.delete(row.id));
      }
      // 콜백 호출
      if (onSelectionChange) {
        const selectedData = data.filter(row => newSet.has(row.id));
        onSelectionChange(Array.from(newSet), selectedData);
      }
      return newSet;
    });
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
      // 날짜 타입: 텍스트 입력 + 달력 버튼
      if (col.type === 'date' || col.type === 'datetime') {
        const openDatePicker = (e) => {
          e.stopPropagation();
          const rect = e.currentTarget.closest('td').getBoundingClientRect();
          setDatePicker({
            visible: true,
            rowId: row.id,
            field: col.field,
            value: cellValue || formatDate(new Date()),
            x: rect.left,
            y: rect.bottom + 4
          });
        };
        return (
          <div className={styles.dateInputWrapper}>
            <input
              type="text"
              value={cellValue ?? ''}
              onChange={(e) => setCellValue(e.target.value)}
              onBlur={() => handleCellSave()}
              onKeyDown={handleKeyDown}
              autoFocus
              className={styles.editableDateInput}
              placeholder="YYYY-MM-DD"
            />
            <button
              type="button"
              className={styles.calendarBtn}
              onMouseDown={(e) => e.preventDefault()}
              onClick={openDatePicker}
              title="달력"
            >📅</button>
          </div>
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
      <div ref={tableContainerRef} className={styles.tableContainer} style={maxHeight ? { maxHeight, overflowY: 'auto' } : {}}>
        <table className={styles.blackGridTable}>
          <thead className={styles.stickyHeader}>
            <tr>
              {checkboxEnabled && (
                <th className={styles.checkboxHeader}>
                  <input
                    type="checkbox"
                    checked={displayData.length > 0 && displayData.every(row => selectedRows.has(row.id))}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className={styles.checkbox}
                  />
                </th>
              )}
              {rowNumberEnabled && <th className={styles.rowNumberHeader}>#</th>}
              {visibleColumns.map(col => {
                const isNumberType = ['number', 'currency', 'integer', 'float'].includes(col.type);
                return (
                  <th
                    key={col.field}
                    onClick={() => requestSort(col.field, col.sortable)}
                    className={`${styles.sortableHeader} ${col.sortable === false ? styles.noSort : ''} ${isNumberType ? styles.numberHeader : ''}`}
                    style={col.width ? { width: `${col.width}px`, minWidth: `${col.width}px` } : {}}
                  >
                    {col.headerName}
                    {col.sortable !== false && (
                      <span className={styles.sortIndicator}>
                        {sortConfig.key === col.field ? (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼') : null}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {displayData.length > 0 ? (
              displayData.map((row, rowIndex) => (
                <tr
                  key={row.id || rowIndex}
                  onClick={() => handleRowClick(row)}
                  onContextMenu={(e) => handleContextMenu(e, row)}
                  className={`${row.id === selectedRowId ? styles.selectedRow : ''} ${selectedRows.has(row.id) ? styles.checkedRow : ''}`}
                >
                  {checkboxEnabled && (
                    <td className={styles.checkboxCell} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedRows.has(row.id)}
                        onChange={(e) => handleRowSelect(row.id, e.target.checked)}
                        className={styles.checkbox}
                      />
                    </td>
                  )}
                  {rowNumberEnabled && (
                    <td className={styles.rowNumberCell}>
                      {pagination ? (pagination.page - 1) * pagination.pageSize + rowIndex + 1 : rowIndex + 1}
                    </td>
                  )}
                  {visibleColumns.map(col => {
                    const value = getCellValue(row, col);
                    const isNumberType = ['number', 'currency', 'integer', 'float'].includes(col.type);
                    const cellClass = [
                      isUrl(value) ? styles.urlCell : '',
                      isNumberType ? styles.numberCell : ''
                    ].filter(Boolean).join(' ');
                    return (
                      <td
                        key={col.field}
                        onClick={(e) => handleCellClick(e, value, col, row)}
                        onDoubleClick={() => handleDoubleClick(row, col.field, row[col.field], col)}
                        style={col.width ? { width: `${col.width}px`, minWidth: `${col.width}px` } : {}}
                        className={cellClass}
                      >
                        {renderCellContent(row, col, rowIndex)}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={visibleColumns.length + (rowNumberEnabled ? 1 : 0) + (checkboxEnabled ? 1 : 0)} className={styles.noData}>
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

      {/* 날짜 선택 모달 */}
      {datePicker.visible && (
        <DatePickerModal
          value={datePicker.value}
          x={datePicker.x}
          y={datePicker.y}
          onSelect={(date) => {
            setCellValue(date);
            setDatePicker({ visible: false, rowId: null, field: null, value: '', x: 0, y: 0 });
          }}
          onClose={() => {
            setDatePicker({ visible: false, rowId: null, field: null, value: '', x: 0, y: 0 });
          }}
        />
      )}

      {/* 컬럼 설정 모달 (열릴 때만 마운트) */}
      {pageName && showColumnConfig && (
        <BlackColumnModal
          isOpen={showColumnConfig}
          onClose={() => {
            setShowColumnConfig(false);
            // 모달이 닫힐 때 설정 다시 로드
            setIsColumnsLoaded(false);
          }}
          pageName={pageName}
          tableName={tableName}
          defaultColumns={columns}
          onSave={setColumns}
          onFormColumnsSave={setFormColumns}
          api={api}
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
