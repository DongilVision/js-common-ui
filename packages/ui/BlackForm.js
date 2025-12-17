import React, { useState, useEffect } from 'react';
import styles from './BlackForm.module.css';

/**
 * BlackForm - 데이터 입력/편집 대화창
 *
 * Props:
 * - open: 대화창 표시 여부
 * - title: 대화창 제목
 * - formColumns: 필드 정의 배열
 *   [{ field, headerName, type, required, editable, valueOptions, row, placeholder }]
 * - data: 편집할 데이터 (null이면 신규)
 * - onSave: 저장 콜백 (formData) => void
 * - onDelete: 삭제 콜백 (data) => void (옵션)
 * - onClose: 닫기 콜백
 *
 * Column Type:
 * - text: 텍스트 입력
 * - number: 숫자 입력
 * - date: 날짜 입력
 * - select: 드롭다운 (valueOptions 필요)
 * - textarea: 멀티라인 텍스트
 *
 * Column row:
 * - 같은 row 값을 가진 필드들은 한 줄에 배치됨
 */
export default function BlackForm({
  open,
  title = '데이터 입력',
  formColumns = [],
  data = null,
  onSave,
  onDelete,
  onClose,
  width = 500,
}) {
  const [formData, setFormData] = useState({});
  const isEditMode = !!data?.id;

  // 초기 데이터 설정
  useEffect(() => {
    if (open) {
      if (data) {
        setFormData({ ...data });
      } else {
        // 빈 폼 데이터 초기화
        const emptyData = {};
        formColumns.forEach(col => {
          if (col.type === 'select' && col.valueOptions?.length > 0) {
            emptyData[col.field] = col.valueOptions[0].value;
          } else {
            emptyData[col.field] = '';
          }
        });
        setFormData(emptyData);
      }
    }
  }, [open, data, formColumns]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // 필수 필드 검증 (password는 수정 모드에서 생략 가능)
    const requiredFields = formColumns.filter(col => col.required);
    for (const col of requiredFields) {
      const skipPassword = col.type === 'password' && isEditMode;
      if (!skipPassword && (!formData[col.field] || formData[col.field].toString().trim() === '')) {
        alert(`${col.headerName}을(를) 입력해주세요.`);
        return;
      }
    }

    onSave(formData);
  };

  const handleDelete = () => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      onDelete(data);
    }
  };

  // row별로 컬럼 그룹화
  const groupedColumns = formColumns.reduce((groups, col) => {
    const rowKey = col.row ?? col.field;
    if (!groups[rowKey]) {
      groups[rowKey] = [];
    }
    groups[rowKey].push(col);
    return groups;
  }, {});

  const renderInput = (col) => {
    const value = formData[col.field] ?? '';
    const isDisabled = col.editable === false && isEditMode;

    switch (col.type) {
      case 'select':
        return (
          <select
            id={col.field}
            name={col.field}
            value={value}
            onChange={handleChange}
            disabled={isDisabled}
            required={col.required}
          >
            {col.valueOptions?.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'textarea':
        return (
          <textarea
            id={col.field}
            name={col.field}
            value={value}
            onChange={handleChange}
            disabled={isDisabled}
            required={col.required}
            rows={col.rows || 4}
            placeholder={col.placeholder || ''}
          />
        );

      case 'date':
        return (
          <input
            id={col.field}
            name={col.field}
            type="date"
            value={value ? value.split('T')[0] : ''}
            onChange={handleChange}
            disabled={isDisabled}
            required={col.required}
          />
        );

      case 'number':
        return (
          <input
            id={col.field}
            name={col.field}
            type="number"
            value={value}
            onChange={handleChange}
            disabled={isDisabled}
            required={col.required}
            placeholder={col.placeholder || ''}
          />
        );

      case 'password':
        return (
          <input
            id={col.field}
            name={col.field}
            type="password"
            value={value}
            onChange={handleChange}
            disabled={isDisabled}
            required={col.required && !isEditMode}
            placeholder={isEditMode ? '(변경 시에만 입력)' : ''}
          />
        );

      default: // text
        return (
          <input
            id={col.field}
            name={col.field}
            type="text"
            value={value}
            onChange={handleChange}
            disabled={isDisabled}
            required={col.required}
            placeholder={col.placeholder || ''}
          />
        );
    }
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} style={{ width: `${width}px` }} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{isEditMode ? title.replace('입력', '수정') : title}</h2>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formBody}>
            {Object.entries(groupedColumns).map(([rowKey, cols]) => (
              <div key={rowKey} className={styles.formRow}>
                {cols.map(col => (
                  <div key={col.field} className={styles.formField} style={{ flex: col.flex || 1 }}>
                    <label htmlFor={col.field}>
                      {col.headerName}
                      {col.required && <span className={styles.required}>*</span>}
                    </label>
                    {renderInput(col)}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className={styles.actions}>
            {isEditMode && onDelete && (
              <button type="button" className={styles.deleteBtn} onClick={handleDelete}>
                삭제
              </button>
            )}
            <div className={styles.rightActions}>
              <button type="button" className={styles.cancelBtn} onClick={onClose}>
                취소
              </button>
              <button type="submit" className={styles.submitBtn}>
                {isEditMode ? '수정' : '저장'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
