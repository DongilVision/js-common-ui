'use client';

import React, { useState, useEffect } from 'react';
import styles from './BlackColumnModal.module.css';

// 기본 API 클라이언트 (fetch 기반)
const defaultApi = {
  get: async (url) => {
    const res = await fetch(url);
    return res.json();
  },
  post: async (url, data) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  }
};

// 타입 옵션
const TYPE_OPTIONS = [
  { value: 'string', label: '문자열' },
  { value: 'date', label: '날짜' },
  { value: 'time', label: '시간' },
  { value: 'currency', label: '통화' },
  { value: 'number', label: '정수' },
  { value: 'float', label: '실수' },
  { value: 'singleSelect', label: '선택' },
];

// 기본 컬럼 템플릿
const DEFAULT_COLUMN_TEMPLATES = {
  id: { field: 'id', headerName: 'ID', type: 'number', width: 60, editable: false },
  created_at: { field: 'created_at', headerName: '생성일', type: 'date', width: 100, editable: false },
  updated_at: { field: 'updated_at', headerName: '수정일', type: 'date', width: 100, editable: false },
  title: { field: 'title', headerName: '제목', type: 'string', width: 200, editable: true },
  owner: { field: 'owner', headerName: '담당자', type: 'string', width: 100, editable: true },
  description: { field: 'description', headerName: '설명', type: 'string', width: 200, editable: true },
};

// 보호된 컬럼 (삭제 불가)
const PROTECTED_COLUMNS = ['id', 'created_at', 'updated_at'];

/**
 * 컬럼 정의 대화창 (MUI DataGrid 호환 포맷)
 * @param {boolean} isOpen - 모달 열림 여부
 * @param {function} onClose - 닫기 핸들러
 * @param {string} pageName - 페이지명 (col-def API 호출에 사용, 설정 시 내부에서 API 호출)
 * @param {array} defaultColumns - 기본 컬럼 정의 (API 결과가 없을 때 사용)
 * @param {function} onLoad - 초기 로드 완료 콜백 (loadedColumns) => void (마운트 시 호출)
 * @param {function} onSave - 저장 완료 콜백 (updatedColumns) => void (선택)
 * @param {string} tableName - 실제 DB 테이블명 (필수 - DB 컬럼 관리에 사용)
 * @param {array} data - 테이블 데이터 배열 (엑셀 내보내기용)
 * @param {function} onDataImport - 데이터 가져오기 핸들러 (importedData) => Promise
 */
// 폼 타입 옵션
const FORM_TYPE_OPTIONS = [
  { value: 'text', label: '텍스트' },
  { value: 'number', label: '숫자' },
  { value: 'date', label: '날짜' },
  { value: 'select', label: '선택' },
  { value: 'textarea', label: '텍스트영역' },
];

const BlackColumnModal = ({ isOpen, onClose, pageName, defaultColumns = [], onLoad, onSave, tableName, formColumns: initialFormColumns, onFormColumnsSave, api = defaultApi }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [localColumns, setLocalColumns] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dbColumnStatus, setDbColumnStatus] = useState({});
  const [isCheckingDb, setIsCheckingDb] = useState(false);

  // 탭 상태
  const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'columns' | 'form'

  // 기본 설정 상태
  const [pageTitle, setPageTitle] = useState('');

  // 폼 컬럼 상태
  const [formColumns, setFormColumns] = useState([]);
  const [formWidth, setFormWidth] = useState(500);

  // 컬럼 배열을 내부 포맷으로 변환
  const mapColumnsToLocal = (columns) => {
    return columns.map((col, index) => {
      const field = col.field || col.accessor;
      const headerName = col.headerName || col.header || col.label || field;
      return {
        id: index,
        field,
        headerName,
        visible: col.visible !== false,
        editable: col.editable || false,
        sortable: col.sortable !== false,
        filterable: col.filterable || false,
        searchable: col.searchable || false,
        width: col.width || 100,
        type: col.type || 'string',
      };
    });
  };

  // col-def API에서 컬럼 설정 로드
  const fetchColumnConfig = async () => {
    if (!pageName || !tableName) return null;
    try {
      const result = await api.get(`/api/col-def?page_name=${pageName}&table_name=${tableName}`);
      return {
        columns: result.columns || null,
        formColumns: result.form_columns || null,
        formWidth: result.form_width || 500,
        pageTitle: result.page_title || ''
      };
    } catch (e) {
      console.error('컬럼 설정 로드 실패:', e);
      return null;
    }
  };

  // 마운트 시 컬럼 로드
  useEffect(() => {
    let isMounted = true;

    const initialLoad = async () => {
      if (isLoaded) return;

      let columnsToUse = defaultColumns;
      let formColumnsFromApi = null;
      let loadedFormWidth = 500;
      let loadedPageTitle = '';

      if (pageName && tableName) {
        const apiResult = await fetchColumnConfig();
        if (apiResult?.columns && apiResult.columns.length > 0) {
          columnsToUse = apiResult.columns;
        }
        if (apiResult?.formColumns) {
          formColumnsFromApi = apiResult.formColumns;
        }
        if (apiResult?.formWidth) {
          loadedFormWidth = apiResult.formWidth;
        }
        if (apiResult?.pageTitle) {
          loadedPageTitle = apiResult.pageTitle;
        }
      }

      if (!isMounted) return;

      if (columnsToUse && columnsToUse.length > 0) {
        const mapped = mapColumnsToLocal(columnsToUse);
        setLocalColumns(mapped);
        setIsLoaded(true);

        if (onLoad) {
          const columnsForParent = mapped.map(({ id, ...rest }) => rest);
          onLoad(columnsForParent, formColumnsFromApi, loadedFormWidth, loadedPageTitle);
        }

        // API에서 폼 컬럼을 로드한 경우 설정
        if (formColumnsFromApi) {
          setFormColumns(formColumnsFromApi.map((col, idx) => ({ ...col, id: idx })));
        }

        // 폼 폭 설정
        setFormWidth(loadedFormWidth);

        // 페이지 제목 설정
        setPageTitle(loadedPageTitle);
      }
    };

    initialLoad();

    return () => {
      isMounted = false;
    };
  }, [pageName, tableName]);

  // 모달이 열릴 때 DB 컬럼 상태 확인
  useEffect(() => {
    if (isOpen && tableName && localColumns.length > 0) {
      checkDbColumns(localColumns.map(c => c.field));
    }
  }, [isOpen]);

  // 폼 컬럼 초기화 (props나 자동 생성 - API 로드는 마운트 시 useEffect에서 처리)
  useEffect(() => {
    // 이미 폼 컬럼이 있으면 (API에서 로드됨) 건너뛰기
    if (formColumns.length > 0) return;

    if (initialFormColumns && initialFormColumns.length > 0) {
      setFormColumns(initialFormColumns.map((col, idx) => ({ ...col, id: idx })));
    } else if (localColumns.length > 0) {
      // 그리드 컬럼에서 자동 생성
      const autoFormColumns = localColumns
        .filter(col => col.editable && !['id', 'created_at', 'updated_at', 'actions'].includes(col.field))
        .map((col, idx) => ({
          id: idx,
          field: col.field,
          headerName: col.headerName,
          type: mapGridTypeToFormType(col.type),
          required: false,
          row: idx + 1,
        }));
      setFormColumns(autoFormColumns);
    }
  }, [isOpen, localColumns, initialFormColumns]);

  // 그리드 타입을 폼 타입으로 변환
  const mapGridTypeToFormType = (type) => {
    const map = { 'date': 'date', 'number': 'number', 'currency': 'number', 'integer': 'number', 'singleSelect': 'select' };
    return map[type] || 'text';
  };

  // DB 컬럼 존재 여부 확인
  const checkDbColumns = async (columnNames) => {
    if (!tableName) return;

    setIsCheckingDb(true);
    try {
      const response = await api.post('/api/col-def', {
        check_columns: columnNames,
        table_name: tableName
      });
      setDbColumnStatus(response.columns || {});
    } catch (e) {
      console.error('DB 컬럼 확인 실패:', e);
    } finally {
      setIsCheckingDb(false);
    }
  };

  // DB 컬럼 삭제
  const deleteDbColumn = async (columnName) => {
    if (!tableName) throw new Error('테이블명이 없습니다.');
    const response = await api.delete(`/api/col-def?table_name=${tableName}&column_name=${columnName}`);
    if (!response.success) throw new Error(response.message);
    return response;
  };

  // DB 컬럼 추가
  const addDbColumns = async (columnsToAdd) => {
    if (!tableName) throw new Error('테이블명이 없습니다.');
    return await api.post('/api/col-def', {
      add_columns: columnsToAdd,
      table_name: tableName
    });
  };

  // 셀 값 변경
  const handleCellChange = (rowIndex, field, value) => {
    setLocalColumns(prev => prev.map((col, idx) => {
      if (idx !== rowIndex) return col;
      if (['visible', 'editable', 'sortable', 'filterable', 'searchable'].includes(field)) {
        return { ...col, [field]: value === 'true' || value === true };
      }
      if (field === 'width') {
        // 빈 문자열이면 그대로 유지 (입력 중), 숫자만 허용
        if (value === '') return { ...col, [field]: '' };
        const numValue = value.replace(/[^0-9]/g, '');
        return { ...col, [field]: numValue };
      }
      return { ...col, [field]: value };
    }));
  };

  // 컬럼 삭제 (DB도 함께 삭제)
  const handleDelete = async (index) => {
    const col = localColumns[index];

    if (PROTECTED_COLUMNS.includes(col.field.toLowerCase())) {
      alert(`'${col.field}' 컬럼은 삭제할 수 없습니다.`);
      return;
    }

    const existsInDb = dbColumnStatus[col.field] === true;
    const confirmMsg = existsInDb
      ? `"${col.headerName}" 컬럼을 삭제하시겠습니까?\n\n⚠️ DB에서 컬럼과 데이터가 영구 삭제됩니다!`
      : `"${col.headerName}" 컬럼을 삭제하시겠습니까?`;

    if (confirm(confirmMsg)) {
      // DB에 존재하면 DB에서도 삭제
      if (existsInDb && tableName) {
        try {
          await deleteDbColumn(col.field);
          setDbColumnStatus(prev => {
            const next = { ...prev };
            delete next[col.field];
            return next;
          });
        } catch (error) {
          alert('DB 컬럼 삭제 실패: ' + error.message);
          return;
        }
      }
      setLocalColumns(prev => prev.filter((_, idx) => idx !== index));
    }
  };

  // DB에서 컬럼 완전 삭제
  const handleDeleteFromDb = async (index) => {
    const col = localColumns[index];

    if (PROTECTED_COLUMNS.includes(col.field.toLowerCase())) {
      alert(`'${col.field}' 컬럼은 삭제할 수 없습니다.`);
      return;
    }

    const existsInDb = dbColumnStatus[col.field] === true;
    if (!existsInDb) {
      alert('이 컬럼은 DB에 존재하지 않습니다.');
      return;
    }

    if (confirm(`"${col.headerName}" 컬럼을 DB에서 완전히 삭제하시겠습니까?\n\n⚠️ 경고: 실제 DB에서 컬럼과 데이터가 영구 삭제됩니다!\n이 작업은 복구할 수 없습니다.`)) {
      try {
        await deleteDbColumn(col.field);
        setLocalColumns(prev => prev.filter((_, idx) => idx !== index));
        setDbColumnStatus(prev => {
          const next = { ...prev };
          delete next[col.field];
          return next;
        });
        alert(`'${col.field}' 컬럼이 DB에서 삭제되었습니다.`);
      } catch (error) {
        alert('컬럼 삭제 실패: ' + error.message);
      }
    }
  };

  // 컬럼 직접 추가
  const handleAdd = async () => {
    const newField = prompt('새 컬럼명(DB field)을 입력하세요:');
    if (!newField || !newField.trim()) return;

    const field = newField.trim();

    if (localColumns.some(col => col.field === field)) {
      alert('이미 존재하는 컬럼명입니다.');
      return;
    }

    const typeChoice = prompt('컬럼 타입을 입력하세요:\n1. string (문자열)\n2. number (정수)\n3. float (실수)\n4. date (날짜)\n5. currency (통화)', '1');
    const typeMap = { '1': 'string', '2': 'number', '3': 'float', '4': 'date', '5': 'currency' };
    const type = typeMap[typeChoice] || 'string';

    const newColumn = {
      id: Date.now(),
      field,
      headerName: field,
      visible: true,
      editable: true,
      sortable: true,
      width: 100,
      type,
    };

    if (tableName && confirm(`"${field}" 컬럼을 DB 테이블에도 추가하시겠습니까?`)) {
      try {
        const result = await addDbColumns([{ field, type }]);
        if (result.addedColumns?.length > 0) {
          setDbColumnStatus(prev => ({ ...prev, [field]: true }));
          alert(`✅ DB에 컬럼 추가됨: ${field}`);
        } else if (result.failedColumns?.length > 0) {
          alert(`❌ DB 컬럼 추가 실패: ${result.failedColumns[0].error}`);
        }
      } catch (e) {
        alert('DB 컬럼 추가 실패: ' + e.message);
      }
    }

    setLocalColumns(prev => [...prev, newColumn]);
  };

  // DB 컬럼 동기화 (DB에 있지만 목록에 없는 컬럼 추가)
  const handleSyncDbColumns = async () => {
    if (!tableName) {
      alert('테이블명이 설정되지 않았습니다.');
      return;
    }

    try {
      // DB 컬럼 목록 가져오기
      const response = await api.post('/api/col-def', {
        check_columns: [],
        table_name: tableName,
        get_all_columns: true
      });

      if (!response.allColumns || response.allColumns.length === 0) {
        alert('DB 컬럼 정보를 가져올 수 없습니다.');
        return;
      }

      const existingFields = localColumns.map(col => col.field);
      const newColumns = [];

      for (const dbCol of response.allColumns) {
        if (!existingFields.includes(dbCol.field)) {
          newColumns.push({
            id: Date.now() + Math.random(),
            field: dbCol.field,
            headerName: dbCol.headerName || dbCol.field,
            visible: true,
            editable: true,
            sortable: true,
            filterable: false,
            searchable: false,
            width: 100,
            type: dbCol.type || 'string',
          });
        }
      }

      if (newColumns.length === 0) {
        alert('추가할 새 DB 컬럼이 없습니다.');
        return;
      }

      if (confirm(`다음 DB 컬럼을 추가하시겠습니까?\n\n${newColumns.map(c => c.field).join(', ')}`)) {
        setLocalColumns(prev => [...prev, ...newColumns]);
        setDbColumnStatus(prev => {
          const newStatus = { ...prev };
          newColumns.forEach(col => { newStatus[col.field] = true; });
          return newStatus;
        });
        alert(`${newColumns.length}개 컬럼이 추가되었습니다.`);
      }
    } catch (e) {
      console.error('DB 동기화 실패:', e);
      alert('DB 동기화 실패: ' + e.message);
    }
  };

  // 기본 컬럼 추가
  const handleAddDefaults = async () => {
    const toAdd = [];
    const existing = [];
    const notInDb = [];

    let currentDbStatus = { ...dbColumnStatus };
    if (tableName) {
      try {
        const response = await api.post('/api/col-def', {
          check_columns: Object.keys(DEFAULT_COLUMN_TEMPLATES),
          table_name: tableName
        });
        currentDbStatus = response.columns || {};
      } catch (e) {
        console.error('컬럼 확인 실패:', e);
      }
    }

    const columnsToAddToDb = [];

    Object.keys(DEFAULT_COLUMN_TEMPLATES).forEach(key => {
      const template = DEFAULT_COLUMN_TEMPLATES[key];
      const isInList = localColumns.some(col => col.field === template.field);

      if (currentDbStatus[template.field] === false) {
        notInDb.push(template.field);
        columnsToAddToDb.push({ field: template.field, type: template.type });
      }

      if (isInList) {
        existing.push(template.field);
      } else {
        toAdd.push({
          id: Date.now() + Math.random(),
          field: template.field,
          headerName: template.headerName,
          visible: true,
          editable: template.editable,
          sortable: true,
          width: template.width,
          type: template.type,
        });
      }
    });

    let dbAddResult = null;
    if (columnsToAddToDb.length > 0 && tableName) {
      if (confirm(`DB 테이블에 없는 컬럼이 있습니다:\n${notInDb.join(', ')}\n\n실제 DB 테이블에 컬럼을 추가하시겠습니까?`)) {
        try {
          dbAddResult = await addDbColumns(columnsToAddToDb);
          if (dbAddResult.addedColumns) {
            const newStatus = { ...dbColumnStatus };
            dbAddResult.addedColumns.forEach(col => { newStatus[col] = true; });
            setDbColumnStatus(newStatus);
          }
        } catch (e) {
          console.error('DB 컬럼 추가 실패:', e);
          alert('DB 컬럼 추가 실패: ' + e.message);
        }
      }
    }

    let message = '';
    if (dbAddResult?.addedColumns?.length > 0) {
      message += `✅ DB에 컬럼 추가됨: ${dbAddResult.addedColumns.join(', ')}\n\n`;
    }
    if (dbAddResult?.failedColumns?.length > 0) {
      message += `❌ DB 컬럼 추가 실패: ${dbAddResult.failedColumns.map(c => c.name).join(', ')}\n\n`;
    }
    if (existing.length > 0) {
      message += `이미 목록에 있는 컬럼: ${existing.join(', ')}\n\n`;
    }
    if (toAdd.length > 0) {
      message += `새로 추가된 컬럼: ${toAdd.map(c => c.field).join(', ')}`;
      setLocalColumns(prev => [...prev, ...toAdd]);
    }

    if (toAdd.length === 0 && existing.length === 0 && notInDb.length === 0) {
      alert('기본 컬럼이 모두 이미 존재합니다.');
      return;
    }

    if (message) alert(message);
  };

  // 순서 이동
  const handleMoveUp = (index) => {
    if (index === 0) return;
    setLocalColumns(prev => {
      const newColumns = [...prev];
      [newColumns[index - 1], newColumns[index]] = [newColumns[index], newColumns[index - 1]];
      return newColumns;
    });
  };

  const handleMoveDown = (index) => {
    if (index === localColumns.length - 1) return;
    setLocalColumns(prev => {
      const newColumns = [...prev];
      [newColumns[index], newColumns[index + 1]] = [newColumns[index + 1], newColumns[index]];
      return newColumns;
    });
  };

  // 드래그 앤 드롭
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    setLocalColumns(prev => {
      const newColumns = [...prev];
      const draggedItem = newColumns[draggedIndex];
      newColumns.splice(draggedIndex, 1);
      newColumns.splice(index, 0, draggedItem);
      return newColumns;
    });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => setDraggedIndex(null);

  // 저장
  const handleSave = async () => {
    const columnsToSave = localColumns.map(({ id, ...rest }) => ({
      ...rest,
      width: parseInt(rest.width) || 100  // 빈 값이나 유효하지 않은 값은 100으로
    }));

    const formColumnsToSave = formColumns.length > 0
      ? formColumns.map(({ id, ...rest }) => rest)
      : null;

    if (pageName) {
      try {
        await api.post('/api/col-def', {
          page_name: pageName,
          page_title: pageTitle,
          columns: columnsToSave,
          form_columns: formColumnsToSave,
          form_width: formWidth
        });
      } catch (e) {
        console.error('컬럼 설정 저장 실패:', e);
        alert('컬럼 설정 저장에 실패했습니다.');
        return;
      }
    }

    if (onSave) onSave(columnsToSave);

    // 폼 컬럼 콜백
    if (onFormColumnsSave && formColumnsToSave) {
      onFormColumnsSave(formColumnsToSave);
    }

    onClose();
  };

  // 전체 선택/해제
  const handleSelectAll = (field) => {
    const allChecked = localColumns.every(col => col[field]);
    setLocalColumns(prev => prev.map(col => ({ ...col, [field]: !allChecked })));
  };

  // === 폼 컬럼 관련 함수 ===
  const handleFormCellChange = (index, field, value) => {
    setFormColumns(prev => prev.map((col, idx) => {
      if (idx !== index) return col;
      if (field === 'required') return { ...col, [field]: value === 'true' || value === true };
      if (field === 'row') return { ...col, [field]: parseInt(value) || 1 };
      return { ...col, [field]: value };
    }));
  };

  const handleFormAddField = () => {
    const availableFields = localColumns
      .filter(col => !formColumns.some(fc => fc.field === col.field) && col.field !== 'actions')
      .map(col => col.field);

    if (availableFields.length === 0) {
      alert('추가할 수 있는 필드가 없습니다.');
      return;
    }

    const fieldName = prompt(`추가할 필드를 선택하세요:\n${availableFields.join(', ')}`);
    if (!fieldName || !availableFields.includes(fieldName)) return;

    const gridCol = localColumns.find(c => c.field === fieldName);
    const maxRow = Math.max(...formColumns.map(c => c.row || 1), 0);

    setFormColumns(prev => [...prev, {
      id: Date.now(),
      field: fieldName,
      headerName: gridCol?.headerName || fieldName,
      type: mapGridTypeToFormType(gridCol?.type),
      required: false,
      row: maxRow + 1,
    }]);
  };

  const handleFormDeleteField = (index) => {
    if (confirm('이 필드를 폼에서 제거하시겠습니까?')) {
      setFormColumns(prev => prev.filter((_, idx) => idx !== index));
    }
  };

  const handleFormMoveUp = (index) => {
    if (index === 0) return;
    setFormColumns(prev => {
      const newColumns = [...prev];
      [newColumns[index - 1], newColumns[index]] = [newColumns[index], newColumns[index - 1]];
      return newColumns;
    });
  };

  const handleFormMoveDown = (index) => {
    if (index === formColumns.length - 1) return;
    setFormColumns(prev => {
      const newColumns = [...prev];
      [newColumns[index], newColumns[index + 1]] = [newColumns[index + 1], newColumns[index]];
      return newColumns;
    });
  };

  const handleAutoArrangeRows = () => {
    // 같은 row 값끼리 그룹화하여 재정렬
    const sorted = [...formColumns].sort((a, b) => (a.row || 1) - (b.row || 1));
    setFormColumns(sorted.map((col, idx) => ({ ...col, id: idx })));
  };

  const generateFormCode = () => {
    const code = `const FORM_COLUMNS = [\n${formColumns.map(col =>
      `  { field: '${col.field}', headerName: '${col.headerName}', type: '${col.type}'${col.required ? ', required: true' : ''}, row: ${col.row || 1} },`
    ).join('\n')}\n];`;

    navigator.clipboard.writeText(code);
    alert('폼 컬럼 코드가 클립보드에 복사되었습니다.');
  };

  // 마운트 유지, UI만 숨김
  if (!isOpen) return <></>;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} style={{ width: '84vw', minWidth: '1100px' }} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>컬럼 설정</h2>
          <button className={styles.closeButton} onClick={onClose}>&times;</button>
        </div>

        {/* 탭 */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'settings' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            기본설정
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'columns' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('columns')}
          >
            테이블컬럼
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'form' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('form')}
          >
            입력폼
          </button>
        </div>

        {/* 기본설정 탭 */}
        {activeTab === 'settings' && (
          <div className={styles.modalBody}>
            <div className={styles.settingsContainer}>
              <div className={styles.settingRow}>
                <span className={styles.settingLabel}>제목:</span>
                <input
                  type="text"
                  value={pageTitle}
                  onChange={(e) => setPageTitle(e.target.value)}
                  placeholder="페이지 제목 입력"
                  className={styles.settingInput}
                />
              </div>

              <div className={styles.settingRow}>
                <span className={styles.settingLabel}>필터:</span>
                <div className={styles.checkboxList}>
                  {localColumns.filter(col => col.visible && !col.searchable).map((col) => (
                    <label key={col.field} className={styles.checkboxItem}>
                      <input
                        type="checkbox"
                        checked={col.filterable}
                        onChange={(e) => {
                          const index = localColumns.findIndex(c => c.field === col.field);
                          if (index >= 0) {
                            handleCellChange(index, 'filterable', e.target.checked);
                            if (e.target.checked) {
                              handleCellChange(index, 'searchable', false);
                            }
                          }
                        }}
                      />
                      <span>{col.headerName}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className={styles.settingRow}>
                <span className={styles.settingLabel}>검색:</span>
                <div className={styles.checkboxList}>
                  {localColumns.filter(col => col.visible && !col.filterable).map((col) => (
                    <label key={col.field} className={styles.checkboxItem}>
                      <input
                        type="checkbox"
                        checked={col.searchable}
                        onChange={(e) => {
                          const index = localColumns.findIndex(c => c.field === col.field);
                          if (index >= 0) {
                            handleCellChange(index, 'searchable', e.target.checked);
                            if (e.target.checked) {
                              handleCellChange(index, 'filterable', false);
                            }
                          }
                        }}
                      />
                      <span>{col.headerName}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className={styles.settingRow}>
                <span className={styles.settingLabel}>폼폭:</span>
                <input
                  type="number"
                  value={formWidth}
                  onChange={(e) => setFormWidth(parseInt(e.target.value) || 500)}
                  placeholder="500"
                  className={styles.settingInput}
                  style={{ maxWidth: '120px' }}
                />
                <span style={{ color: '#888', fontSize: '0.85rem' }}>px</span>
              </div>
            </div>
          </div>
        )}

        {/* 그리드 컬럼 탭 */}
        {activeTab === 'columns' && (
        <>
        <div className={styles.modalToolbar}>
          <label className={styles.selectAllLabel}>
            <input type="checkbox" checked={localColumns.every(col => col.visible)} onChange={() => handleSelectAll('visible')} />
            전체 표시
          </label>
          <label className={styles.selectAllLabel}>
            <input type="checkbox" checked={localColumns.every(col => col.editable)} onChange={() => handleSelectAll('editable')} />
            전체 편집
          </label>
          <label className={styles.selectAllLabel}>
            <input type="checkbox" checked={localColumns.every(col => col.sortable)} onChange={() => handleSelectAll('sortable')} />
            전체 정렬
          </label>
          <div className={styles.addButtons}>
            {tableName && <button onClick={handleSyncDbColumns} className={styles.syncDbBtn}>⟳ DB동기화</button>}
            <button onClick={handleAddDefaults} className={styles.defaultColumnBtn}>+ 기본추가</button>
            <button onClick={handleAdd} className={styles.addColumnBtn}>+ 직접 추가</button>
          </div>
        </div>

        <div className={styles.modalBody}>
          <table className={styles.columnTable}>
            <thead>
              <tr>
                <th className={styles.orderHeader}>순서</th>
                <th className={styles.accessorHeader}>컬럼명 (DB)</th>
                <th className={styles.dbStatusHeader}>DB</th>
                <th className={styles.labelHeader}>헤더명</th>
                <th>타입</th>
                <th>크기(px)</th>
                <th>표시</th>
                <th>편집</th>
                <th>정렬</th>
                <th className={styles.deleteHeader}>삭제</th>
              </tr>
            </thead>
            <tbody>
              {localColumns.map((col, index) => (
                <tr
                  key={col.field}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={draggedIndex === index ? styles.dragging : ''}
                >
                  <td className={styles.orderCell}>
                    <div className={styles.orderButtons}>
                      <button onClick={() => handleMoveUp(index)} disabled={index === 0} className={styles.orderBtn} title="위로">▲</button>
                      <button onClick={() => handleMoveDown(index)} disabled={index === localColumns.length - 1} className={styles.orderBtn} title="아래로">▼</button>
                      <span className={styles.dragHandle} title="드래그하여 이동">☰</span>
                    </div>
                  </td>
                  <td className={styles.accessorCell}>
                    <span className={Object.keys(DEFAULT_COLUMN_TEMPLATES).includes(col.field) ? styles.accessorTextDefault : styles.accessorText}>{col.field}</span>
                  </td>
                  <td className={styles.dbStatusCell}>
                    {isCheckingDb ? (
                      <span className={styles.dbChecking}>...</span>
                    ) : dbColumnStatus[col.field] === true ? (
                      <span className={styles.dbExists} title="DB에 존재">✓</span>
                    ) : dbColumnStatus[col.field] === false ? (
                      <span className={styles.dbMissing} title="DB에 없음">✗</span>
                    ) : (
                      <span className={styles.dbUnknown} title="확인 안됨">-</span>
                    )}
                  </td>
                  <td className={styles.labelCell}>
                    <input type="text" value={col.headerName} onChange={(e) => handleCellChange(index, 'headerName', e.target.value)} className={styles.labelInput} />
                  </td>
                  <td>
                    <select value={col.type || 'string'} onChange={(e) => handleCellChange(index, 'type', e.target.value)} className={styles.typeSelect}>
                      {TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </td>
                  <td>
                    <input type="text" value={col.width} onChange={(e) => handleCellChange(index, 'width', e.target.value)} className={styles.widthInput} placeholder="100" />
                  </td>
                  <td className={styles.checkboxCell}>
                    <input type="checkbox" checked={col.visible} onChange={(e) => handleCellChange(index, 'visible', e.target.checked)} className={styles.checkbox} />
                  </td>
                  <td className={styles.checkboxCell}>
                    <input type="checkbox" checked={col.editable} onChange={(e) => handleCellChange(index, 'editable', e.target.checked)} className={styles.checkbox} />
                  </td>
                  <td className={styles.checkboxCell}>
                    <input type="checkbox" checked={col.sortable} onChange={(e) => handleCellChange(index, 'sortable', e.target.checked)} className={styles.checkbox} />
                  </td>
                  <td className={styles.deleteCell}>
                    <button onClick={() => handleDelete(index)} className={styles.deleteBtn} title="목록에서 제거">✕</button>
                    {dbColumnStatus[col.field] === true && (
                      <button onClick={() => handleDeleteFromDb(index)} className={styles.dbDeleteBtn} title="DB에서 완전 삭제">🗑</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
        )}

        {/* 폼 에디터 탭 */}
        {activeTab === 'form' && (
          <>
            <div className={styles.modalToolbar}>
              <div className={styles.formFieldRow}>
                <span className={styles.settingLabel}>폼필드:</span>
                <div className={styles.checkboxList}>
                  {localColumns.filter(col => col.visible && !['id', 'created_at', 'updated_at', 'actions'].includes(col.field)).map((col) => {
                    const isInForm = formColumns.some(fc => fc.field === col.field);
                    return (
                      <label key={col.field} className={styles.checkboxItem}>
                        <input
                          type="checkbox"
                          checked={isInForm}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const maxRow = Math.max(...formColumns.map(c => c.row || 1), 0);
                              setFormColumns(prev => [...prev, {
                                id: Date.now(),
                                field: col.field,
                                headerName: col.headerName,
                                type: mapGridTypeToFormType(col.type),
                                required: false,
                                row: maxRow + 1,
                              }]);
                            } else {
                              setFormColumns(prev => prev.filter(fc => fc.field !== col.field));
                            }
                          }}
                        />
                        <span>{col.headerName}</span>
                      </label>
                    );
                  })}
                </div>
                <button onClick={handleFormAddField} className={styles.addColumnBtn}>+ 필드 추가</button>
              </div>
            </div>
            <div className={styles.modalBody}>

              {formColumns.length > 0 && (
                <table className={styles.columnTable} style={{ marginTop: '1rem' }}>
                  <thead>
                    <tr>
                      <th className={styles.orderHeader}>순서</th>
                      <th>필드명</th>
                      <th>라벨</th>
                      <th>타입</th>
                      <th style={{ width: '60px', textAlign: 'center' }}>행</th>
                      <th style={{ width: '60px', textAlign: 'center' }}>필수</th>
                      <th className={styles.deleteHeader}>삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formColumns.map((col, index) => (
                      <tr key={col.field}>
                        <td className={styles.orderCell}>
                          <div className={styles.orderButtons}>
                            <button onClick={() => handleFormMoveUp(index)} disabled={index === 0} className={styles.orderBtn} title="위로">▲</button>
                            <button onClick={() => handleFormMoveDown(index)} disabled={index === formColumns.length - 1} className={styles.orderBtn} title="아래로">▼</button>
                          </div>
                        </td>
                        <td>
                          <span className={styles.accessorText}>{col.field}</span>
                        </td>
                        <td>
                          <input
                            type="text"
                            value={col.headerName}
                            onChange={(e) => handleFormCellChange(index, 'headerName', e.target.value)}
                            className={styles.labelInput}
                          />
                        </td>
                        <td>
                          <select
                            value={col.type || 'text'}
                            onChange={(e) => handleFormCellChange(index, 'type', e.target.value)}
                            className={styles.typeSelect}
                          >
                            {FORM_TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            value={col.row || 1}
                            onChange={(e) => handleFormCellChange(index, 'row', e.target.value)}
                            className={styles.rowInput}
                            min="1"
                          />
                        </td>
                        <td className={styles.checkboxCell}>
                          <input
                            type="checkbox"
                            checked={col.required}
                            onChange={(e) => handleFormCellChange(index, 'required', e.target.checked)}
                            className={styles.checkbox}
                          />
                        </td>
                        <td className={styles.deleteCell}>
                          <button onClick={() => handleFormDeleteField(index)} className={styles.deleteBtn} title="삭제">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        <div className={styles.modalFooter}>
          <button className={styles.saveButton} onClick={handleSave}>저장</button>
          <button className={styles.cancelButton} onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
};

export default BlackColumnModal;
