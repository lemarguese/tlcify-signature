import './PlaygroundPage.scss';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, DragEvent as RDragEvent, MouseEvent as RMouseEvent } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useParams } from 'react-router';

import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import Header from '../../layout/Header/Header.tsx';
import Footer from '../../layout/Footer/Footer.tsx';
import type { ICustomer, IEndorsement, ISignatureTemplate } from "../../types/document.ts";
import { useSearchParams } from "react-router-dom";

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldType = 'text' | 'signature' | 'date' | 'number' | 'checkbox';

type SignatureRole = 'Insured' | 'Driver' | 'Other';

interface PlaygroundField {
  id: string;
  type: FieldType;
  label: string;
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  readonly: boolean;
  fontSize: number;
  value: string;
  page: number; // 0-indexed
  role: SignatureRole | ''; // who signs (used by signature fields)
}

export interface IPlaygroundFieldPayload {
  fieldName: string;
  label: string;
  type: FieldType;
  fontSize: number;
  page: number;
  x: number;
  y: number; // PDF-space (origin bottom-left)
  width: number;
  height: number;
  readonly: boolean;
  role?: string; // lowercase: 'insured' | 'driver' | 'other' (signature fields only)
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PDF_W = 595;
const PDF_H = 842;

const FIELD_DEFAULTS: Record<FieldType, { w: number; h: number }> = {
  text: { w: 140, h: 22 },
  signature: { w: 180, h: 56 },
  date: { w: 110, h: 22 },
  number: { w: 80, h: 22 },
  checkbox: { w: 20, h: 20 },
};

const TYPE_LABELS: Record<FieldType, string> = {
  text: 'Text', signature: 'Signature', date: 'Date', number: 'Number', checkbox: 'Checkbox',
};

const SIGNATURE_ROLES: SignatureRole[] = ['Insured', 'Driver', 'Other'];

// custom drag type so we only react to our own tool buttons (not files/text)
const DRAG_MIME = 'application/x-playground-field';

const playgroundFields: { type: FieldType; disabled: boolean }[] = [
  { type: 'text', disabled: false },
  { type: 'signature', disabled: false },
  { type: 'date', disabled: true },
  { type: 'number', disabled: true },
  { type: 'checkbox', disabled: true },
];

let _counter = 1;
const uid = () => `f_${crypto.randomUUID()}`;

function toPdfPayload (f: PlaygroundField): IPlaygroundFieldPayload {
  const isSignature = f.type === 'signature';

  return {
    fieldName: f.key,
    // for signature fields the label is the role name (same as the assign page)
    label: isSignature ? f.role : f.value,
    type: f.type,
    fontSize: f.fontSize,
    page: f.page,
    x: Math.round(f.x),
    y: Math.round(PDF_H - f.y - f.h),
    width: Math.round(f.w),
    height: Math.round(f.h),
    readonly: !isSignature,
    ...(isSignature ? { role: f.role.toLowerCase() } : {}),
  };
}

function FieldIcon ({ type, strokeWidth = 2 }: { type: FieldType; strokeWidth?: number }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth };
  switch (type) {
    case 'text':
      return <svg {...common}>
        <path d="M4 7V5h16v2M9 20h6M12 5v15"/>
      </svg>;
    case 'signature':
      return (
        <svg {...common}>
          <path d="M3 17c2.5 0 3.5-9 5.5-9S9 15 11 15s2-4 3.5-4 1 4 3 4c1 0 1.5-.5 2.5-1.5"/>
          <path d="M3 21h18"/>
        </svg>
      );
    case 'date':
      return <svg {...common}>
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <path d="M16 2v4M8 2v4M3 10h18"/>
      </svg>;
    case 'number':
      return <svg {...common}>
        <path d="M4 9h16M4 15h16M10 3l-4 18M18 3l-4 18"/>
      </svg>;
    case 'checkbox':
      return <svg {...common}>
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M7 12l4 4 6-6"/>
      </svg>;
  }
}

interface FieldOverlayProps {
  field: PlaygroundField;
  selected: boolean;
  zoom: number;
  onSelect: (id: string) => void;
  onDragStart: (e: RMouseEvent, id: string) => void;
  onResizeStart: (e: RMouseEvent, id: string) => void;
  onLabelCommit: (id: string, value: string) => void;
}

function FieldOverlay ({
                         field, selected, zoom,
                         onSelect, onDragStart, onResizeStart, onLabelCommit,
                       }: FieldOverlayProps) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // sync if label changes externally (props panel)
  useEffect(() => { setEditVal(field.label); }, [field.label]);

  const startEdit = (e: RMouseEvent) => {
    e.stopPropagation();
    setEditVal(field.value);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitEdit = () => {
    setEditing(false);
    const trimmed = editVal.trim();
    if (trimmed) onLabelCommit(field.id, trimmed);
    else setEditVal(field.value);
  };

  const style: CSSProperties = {
    position: 'absolute',
    left: field.x * zoom,
    top: field.y * zoom,
    width: field.w * zoom,
    height: field.h * zoom,
  };

  const isSignature = field.type === 'signature';
  const roleClass = isSignature && field.role ? `playground_field--role-${field.role.toLowerCase()}` : '';

  return (
    <div
      className={`playground_field ${selected ? 'playground_field--selected' : ''} playground_field--${field.type} ${roleClass}`}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(field.id);
      }}
      onDoubleClick={startEdit}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).dataset.resize) return;
        if (editing) return;
        onDragStart(e, field.id);
      }}
    >
      <div className="playground_field__label">
        {field.label}
        {isSignature && (
          <span className={`playground_field__role ${field.role ? '' : 'playground_field__role--empty'}`}>
            {field.role || 'No role'}
          </span>
        )}
      </div>

      <div
        className="playground_field__box"
        style={isSignature ? undefined : { fontSize: field.fontSize * zoom }}
      >
        {editing ? (
          <input
            ref={inputRef}
            className="playground_field__inline_input"
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') {
                setEditing(false);
                setEditVal(field.label);
              }
              e.stopPropagation();
            }}
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
          />
        ) : isSignature ? (
          <div className="playground_field__signature">
            <span className="playground_field__signature_x">×</span>
            <span className="playground_field__signature_hint">Sign here</span>
            <span className="playground_field__signature_line"/>
          </div>
        ) : (
          field.value
        )}
      </div>

      <div
        className="playground_field__resize"
        data-resize="true"
        onMouseDown={(e) => {
          e.stopPropagation();
          onResizeStart(e, field.id);
        }}
      />
    </div>
  );
}

function PlaygroundPage () {
  const { endorsementId: endorsementId } = useParams();
  const [searchParams] = useSearchParams();
  const endorsementToken = searchParams.get('token');

  const [fields, setFields] = useState<PlaygroundField[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1.5);
  const [pdfFile, setPdfFile] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(0); // 0-indexed
  const [generateStatus, setGenerateStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [toast, setToast] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  const selectedField = useMemo(
    () => fields.find(f => f.id === selectedId) ?? null,
    [fields, selectedId]
  );

  // fields visible on current page
  const pageFields = useMemo(
    () => fields.filter(f => f.page === currentPage),
    [fields, currentPage]
  );

  // ── Toast ──
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const [endorsement, setEndorsement] = useState<IEndorsement>({
    _id: endorsementId ?? '',
    customer: {} as ICustomer,
    signature_template: {
      _id: '',
      insurance: '',
      type: '',
      fields: []
    } as ISignatureTemplate,
    feeAmount: 0,
    signatures: [],
    meta: {},
    type: '',
    url: '',
    status: 'signature',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const fetchEndorsementById = async () => {
    const response = await fetch(
      `${import.meta.env.VITE_BACKEND_URL}/endorsements/${endorsementId}/locations?token=${endorsementToken}`,
      { method: 'GET', headers: { 'X-Tenant-ID': import.meta.env.VITE_MAIN_TENANT } }
    );
    const data = await response.json();
    setEndorsement(data);
  };

  useEffect(() => {
    fetchEndorsementById();
  }, []);

  useEffect(() => {
    if (!endorsement.url) return;
    setPdfFile(endorsement.url);
    setCurrentPage(0);
  }, [endorsement]);

  // ── Keyboard delete ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedId &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLSelectElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        setFields(prev => prev.filter(f => f.id !== selectedId));
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId]);

  // ── Drop from toolbox → place field ──
  const handleCanvasDragOver = useCallback((e: RDragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault(); // required, otherwise the browser won't allow a drop
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleCanvasDragLeave = useCallback((e: RDragEvent<HTMLDivElement>) => {
    // ignore leave events fired when moving over child elements
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsDragOver(false);
  }, []);

  const handleCanvasDrop = useCallback((e: RDragEvent<HTMLDivElement>) => {
    setIsDragOver(false);
    const type = e.dataTransfer.getData(DRAG_MIME) as FieldType;
    if (!type || !(type in FIELD_DEFAULTS)) return;
    e.preventDefault();

    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    const { w, h } = FIELD_DEFAULTS[type];

    const newField: PlaygroundField = {
      id: uid(),
      type,
      label: `${TYPE_LABELS[type]} ${_counter}`,
      key: `${type}_${_counter}`,
      x: Math.round(Math.max(0, Math.min(PDF_W - w, x - w / 2))),
      y: Math.round(Math.max(0, Math.min(PDF_H - h, y - h / 2))),
      w, h,
      fontSize: 12,
      value: '',
      readonly: true,
      page: currentPage,
      role: '',
    };

    setFields(prev => [...prev, newField]);
    setSelectedId(newField.id);
  }, [zoom, currentPage]);

  // ── Drag ──
  const handleDragStart = useCallback((e: RMouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const field = fields.find(f => f.id === id);
    if (!field) return;
    setSelectedId(id);

    const offsetX = e.clientX - field.x * zoom;
    const offsetY = e.clientY - field.y * zoom;

    const onMove = (mv: MouseEvent) => {
      setFields(prev => prev.map(f => f.id !== id ? f : {
        ...f,
        x: Math.round(Math.max(0, Math.min(PDF_W - f.w, (mv.clientX - offsetX) / zoom))),
        y: Math.round(Math.max(0, Math.min(PDF_H - f.h, (mv.clientY - offsetY) / zoom))),
      }));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [fields, zoom]);

  // ── Resize ──
  const handleResizeStart = useCallback((e: RMouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const field = fields.find(f => f.id === id);
    if (!field) return;

    const startX = e.clientX, startY = e.clientY;
    const startW = field.w, startH = field.h;

    const onMove = (mv: MouseEvent) => {
      setFields(prev => prev.map(f => f.id !== id ? f : {
        ...f,
        w: Math.round(Math.max(30, startW + (mv.clientX - startX) / zoom)),
        h: Math.round(Math.max(14, startH + (mv.clientY - startY) / zoom)),
      }));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [fields, zoom]);

  // ── Props update ──
  const updateField = useCallback(<K extends keyof PlaygroundField> (key: K, value: PlaygroundField[K]) => {
    setFields(prev => prev.map(f => f.id === selectedId ? { ...f, [key]: value } : f));
  }, [selectedId]);

  // ── Label commit from inline double-click edit ──
  const handleLabelCommit = useCallback((id: string, value: string) => {
    setFields(prev => prev.map(f => f.id !== id ? f : {
      ...f,
      value: value,
      key: f.key === `${f.type}_${f.id.replace('f_', '')}` ? value.toLowerCase().replace(/\s+/g, '_') : f.key,
    }));
  }, []);

  // ── Zoom ──
  const handleZoom = (delta: number) => {
    setZoom(prev => Math.round(Math.min(2, Math.max(0.4, prev + delta)) * 10) / 10);
  };

  // ── Page navigation ──
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(0, Math.min(numPages - 1, page)));
    setSelectedId(null);
  };

  // ── Generate (PATCH signature template) ──
  const handleGenerate = async () => {
    if (!fields.length) return;

    // every signature field must have a role (Insured / Driver / Other)
    const missingRole = fields.find(f => f.type === 'signature' && !f.role);
    if (missingRole) {
      if (missingRole.page !== currentPage) setCurrentPage(missingRole.page);
      setSelectedId(missingRole.id);
      showToast('Choose a role (Insured / Driver / Other) for every signature field');
      return;
    }

    const payload = fields.map(toPdfPayload);

    setGenerateStatus('loading');
    try {
      if (!endorsement.signature_template._id) {
        throw new Error('signatureTemplateId is missing — cannot PATCH');
      }

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/signature/${endorsement.signature_template._id}?token=${endorsementToken}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': import.meta.env.VITE_MAIN_TENANT,
        },
        credentials: 'include',
        body: JSON.stringify({
          fields: payload,
          endorsementId,
        }),
      });

      if (!response.ok) {
        throw new Error(`PATCH /signature/${endorsement.signature_template._id} failed with ${response.status}`);
      }

      setGenerateStatus('success');
      showToast(`✓ ${fields.length} field${fields.length !== 1 ? 's' : ''} saved`);
    } catch (err) {
      console.error('PlaygroundPage submit error', err);
      setGenerateStatus('error');
      showToast('Failed to save — check console');
    } finally {
      setTimeout(() => setGenerateStatus('idle'), 2000);
    }
  };

  return (
    <div className="playground_container">
      <Header/>

      <div className="playground">

        {/* ── Sidebar ── */}
        <aside className="playground_sidebar">

          {/* Tool selector */}
          <div className="playground_sidebar__tools">
            <p className="playground_sidebar__section_label">Add field</p>
            <div className="playground_tools_grid">
              {playgroundFields.map(record => (
                <button
                  key={record.type}
                  type="button"
                  disabled={record.disabled}
                  draggable={!record.disabled}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DRAG_MIME, record.type);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  className={`playground_tool_btn playground_tool_btn--${record.type}`}
                  title={record.disabled ? `${TYPE_LABELS[record.type]} (coming soon)` : `Drag a ${TYPE_LABELS[record.type]} field onto the document`}
                >
                  <span className="playground_tool_btn__icon">
                    <FieldIcon type={record.type} strokeWidth={1.8}/>
                  </span>
                  {TYPE_LABELS[record.type]}
                </button>
              ))}
            </div>
          </div>

          {/* Fields list */}
          <div className="playground_fields_list">
            <p className="playground_sidebar__section_label">
              Fields
              <span className="playground_fields_count">{fields.length}</span>
            </p>

            {fields.length === 0 ? (
              <div className="playground_fields_empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M12 8v8M8 12h8"/>
                </svg>
                <span>Drag a field onto the document to place it</span>
              </div>
            ) : (
              fields.map(f => (
                <div
                  key={f.id}
                  className={`playground_field_item ${selectedId === f.id ? 'playground_field_item--selected' : ''} playground_field_item--${f.type}`}
                  onClick={() => {
                    // navigate to that field's page when clicking from sidebar
                    if (f.page !== currentPage) setCurrentPage(f.page);
                    setSelectedId(f.id);
                  }}
                >
                  <div className="playground_field_item__icon">
                    <FieldIcon type={f.type}/>
                  </div>
                  <div className="playground_field_item__info">
                    <span className="playground_field_item__name">{f.label}</span>
                    <span className="playground_field_item__meta">
                      {f.key}
                      {f.type === 'signature' && (
                        <span
                          className={`playground_field_item__role ${f.role ? `playground_field_item__role--${f.role.toLowerCase()}` : 'playground_field_item__role--empty'}`}>
                          {f.role || 'No role'}
                        </span>
                      )}
                      {numPages > 1 && <span className="playground_field_item__page">p.{f.page + 1}</span>}
                    </span>
                  </div>
                  <button
                    className="playground_field_item__delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFields(prev => prev.filter(x => x.id !== f.id));
                      if (selectedId === f.id) setSelectedId(null);
                    }}
                    title="Remove field"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Properties panel */}
          {selectedField && (
            <div className="playground_props">
              <p className="playground_sidebar__section_label">Properties</p>

              <div className="playground_props__row">
                <label className="playground_props__label">Label</label>
                <input
                  className="playground_props__input"
                  type="text"
                  value={selectedField.label}
                  onChange={e => updateField('label', e.target.value)}
                  placeholder={selectedField.type === 'signature' ? 'e.g. Customer signature' : 'e.g. Full name'}
                />
              </div>

              <div className="playground_props__row">
                <label className="playground_props__label">Field key</label>
                <input
                  className="playground_props__input"
                  type="text"
                  value={selectedField.key}
                  onChange={e => updateField('key', e.target.value)}
                  placeholder={selectedField.type === 'signature' ? 'e.g. customer_signature' : 'e.g. full_name'}
                />
              </div>

              {selectedField.type === 'signature' && (
                <div className="playground_props__row">
                  <label className="playground_props__label">Signature type</label>
                  <div className="playground_role_selector">
                    {SIGNATURE_ROLES.map(role => (
                      <button
                        key={role}
                        type="button"
                        className={`playground_role_btn ${
                          selectedField.role === role
                            ? `playground_role_btn--active ${role.toLowerCase()}`
                            : ''
                        }`}
                        onClick={() => updateField('role', selectedField.role === role ? '' : role)}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedField.type !== 'signature' && (
                <>
                  <div className="playground_props__row">
                    <label className="playground_props__label">Value</label>
                    <input
                      className="playground_props__input"
                      type="text"
                      value={selectedField.value}
                      onChange={e => updateField('value', e.target.value)}
                      placeholder="Optional"
                    />
                  </div>

                  <div className="playground_props__row">
                    <label className="playground_props__label">Font size</label>
                    <input
                      className="playground_props__input"
                      type="number"
                      min={8}
                      max={48}
                      value={selectedField.fontSize}
                      onChange={e => updateField('fontSize', +e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="playground_props__row playground_props__row--2col">
                <div>
                  <label className="playground_props__label">Width</label>
                  <input className="playground_props__input" type="number" min={30} value={Math.round(selectedField.w)}
                         onChange={e => updateField('w', +e.target.value)}/>
                </div>
                <div>
                  <label className="playground_props__label">Height</label>
                  <input className="playground_props__input" type="number" min={14} value={Math.round(selectedField.h)}
                         onChange={e => updateField('h', +e.target.value)}/>
                </div>
              </div>

              <div className="playground_props__row playground_props__row--2col">
                <div>
                  <label className="playground_props__label">X</label>
                  <input className="playground_props__input" type="number" value={Math.round(selectedField.x)}
                         onChange={e => updateField('x', +e.target.value)}/>
                </div>
                <div>
                  <label className="playground_props__label">Y</label>
                  <input className="playground_props__input" type="number" value={Math.round(selectedField.y)}
                         onChange={e => updateField('y', +e.target.value)}/>
                </div>
              </div>
            </div>
          )}

          {/* Generate button */}
          <div className="playground_sidebar__footer">
            {fields.length > 0 && (
              <button className="playground_clear_btn" onClick={() => {
                setFields([]);
                setSelectedId(null);
              }}>
                Clear all
              </button>
            )}
            <button
              className={`playground_generate_btn ${generateStatus === 'loading' ? 'playground_generate_btn--loading' : ''}`}
              onClick={handleGenerate}
              disabled={fields.length === 0 || generateStatus === 'loading'}
            >
              {generateStatus === 'loading' ? 'Saving…' : `Generate form (${fields.length})`}
            </button>
          </div>
        </aside>

        {/* ── Canvas area ── */}
        <main className="playground_main">

          {/* Toolbar */}
          <div className="playground_toolbar">
            <div className="playground_toolbar__left">
              <span className="playground_toolbar__label">Zoom</span>
              <button className="playground_toolbar__zoom_btn" onClick={() => handleZoom(-0.1)}>−</button>
              <span className="playground_toolbar__zoom_val">{Math.round(zoom * 100)}%</span>
              <button className="playground_toolbar__zoom_btn" onClick={() => handleZoom(+0.1)}>+</button>
              <button className="playground_toolbar__zoom_btn" onClick={() => setZoom(1)}>Reset</button>
            </div>
            <div className="playground_toolbar__right">
              <span className="playground_toolbar__hint">
                {fields.length === 0
                  ? 'Double-click field to rename'
                  : `${fields.length} field${fields.length !== 1 ? 's' : ''} · double-click to rename · Del to remove`}
              </span>
            </div>
          </div>

          {/* Paginator — only shown when PDF has multiple pages */}
          {numPages > 1 && (
            <div className="playground_paginator">
              <button
                className="playground_paginator__btn"
                disabled={currentPage === 0}
                onClick={() => goToPage(currentPage - 1)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}>
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
              </button>

              <div className="playground_paginator__pages">
                {Array.from({ length: numPages }, (_, i) => (
                  <button
                    key={i}
                    className={`playground_paginator__page ${currentPage === i ? 'playground_paginator__page--active' : ''}`}
                    onClick={() => goToPage(i)}
                  >
                    {i + 1}
                    {fields.filter(f => f.page === i).length > 0 && (
                      <span className="playground_paginator__dot"/>
                    )}
                  </button>
                ))}
              </div>

              <button
                className="playground_paginator__btn"
                disabled={currentPage === numPages - 1}
                onClick={() => goToPage(currentPage + 1)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}>
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>

              <span className="playground_paginator__label">
                Page {currentPage + 1} of {numPages}
                {pageFields.length > 0 && ` · ${pageFields.length} field${pageFields.length !== 1 ? 's' : ''}`}
              </span>
            </div>
          )}

          {/* Document canvas */}
          <div className="playground_canvas_wrap">
            <div
              ref={canvasRef}
              className={`playground_canvas ${isDragOver ? 'playground_canvas--drop' : ''}`}
              style={{ width: PDF_W * zoom, height: PDF_H * zoom }}
              onDragOver={handleCanvasDragOver}
              onDragLeave={handleCanvasDragLeave}
              onDrop={handleCanvasDrop}
              onMouseDown={(e) => {
                if (!(e.target as HTMLElement).closest('.playground_field')) {
                  setSelectedId(null);
                }
              }}
            >
              {/* PDF render or upload prompt */}
              {pdfFile ? (
                <Document
                  file={pdfFile}
                  className="playground_pdf_document"
                  onLoadSuccess={({ numPages }) => {
                    setNumPages(numPages);
                    setCurrentPage(0);
                  }}
                  onLoadError={(err) => console.error('PDF load error', err)}
                >
                  <Page
                    pageNumber={currentPage + 1}
                    width={PDF_W * zoom}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                  />
                </Document>
              ) : (
                <label className="playground_upload_zone">
                  <div style={{ display: 'none' }}
                    // onChange={handlePdfUpload}
                  />
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2}
                       className="playground_upload_zone__icon">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <path d="M14 2v6h6M12 18v-6M9 15l3-3 3 3"/>
                  </svg>
                  <span className="playground_upload_zone__title">Uploading your PDF…</span>
                  <span className="playground_upload_zone__hint">
  Please wait a moment while the document loads. You can start placing text and signature fields as soon as it's ready.
</span>
                </label>
              )}

              {/* Field overlays — only current page */}
              {pageFields.map(f => (
                <FieldOverlay
                  key={f.id}
                  field={f}
                  selected={selectedId === f.id}
                  zoom={zoom}
                  onSelect={setSelectedId}
                  onDragStart={handleDragStart}
                  onResizeStart={handleResizeStart}
                  onLabelCommit={handleLabelCommit}
                />
              ))}
            </div>
          </div>
        </main>
      </div>

      <Footer/>
      {toast && <div className="playground_toast">{toast}</div>}
    </div>
  );
}

export default PlaygroundPage;
