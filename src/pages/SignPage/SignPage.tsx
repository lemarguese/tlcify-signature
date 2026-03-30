import './SignPage.scss';

import { Document, Page, pdfjs } from 'react-pdf';
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from 'react'
import SignatureCanvas from 'react-signature-canvas';

import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import { useParams } from "react-router";
import type { ISignatureTemplate, IEndorsement, ICustomer } from "../../types/document.ts";
import { useSearchParams } from 'react-router-dom';
import SignatureResult from "../../components/SignatureResult/SignatureResult.tsx";
import Header from "../../layout/Header/Header.tsx";
import Footer from "../../layout/Footer/Footer.tsx";
import { endorsementTypeOptions } from "../../utils/main.ts";

function SignPage () {
  const { endorsementId } = useParams();

  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const signatureType = searchParams.get('signatureType');

  const [status, setStatus] = useState<'idle' | 'success' | 'loading' | 'error'>('idle');
  const [showDocument, setShowDocument] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
      `${import.meta.env.VITE_BACKEND_URL}/endorsements/${endorsementId}/locations?token=${token}`,
      { method: 'GET', headers: { 'X-Tenant-ID': import.meta.env.VITE_MAIN_TENANT } }
    );
    const data = await response.json();
    setEndorsement(data);
  };

  useEffect(() => { fetchEndorsementById(); }, []);

  const visibleFields = useMemo(() => {
    const fields = endorsement.signature_template.fields;
    if (!signatureType) return fields;
    return fields.filter(f => f.role?.toLowerCase() === signatureType.toLowerCase());
  }, [endorsement.signature_template.fields, signatureType]);

  const [numPages, setNumPages] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const sigRef = useRef<SignatureCanvas>(null);
  const [signatures, setSignatures] = useState<Record<string, string>>({});
  const [activeField, setActiveField] = useState<string | null>(null);

  const handleClear = () => sigRef.current?.clear();

  const handleSignField = (fieldName: string) => {
    if (visibleFields.length > 1 && Object.keys(signatures).length > 0) {
      setSignatures({});
    }
    setActiveField(fieldName);
  };

  const handleSubmitSignature = () => {
    if (sigRef.current?.isEmpty()) {
      alert('Please provide a signature');
      return;
    }
    const dataUrl = sigRef.current!.toDataURL('image/png');

    if (visibleFields.length > 1) {
      const allSigned = visibleFields.reduce((acc, field) => {
        acc[field.fieldName] = dataUrl;
        return acc;
      }, {} as Record<string, string>);
      setSignatures(prev => ({ ...prev, ...allSigned }));
    } else {
      setSignatures(prev => ({ ...prev, [activeField!]: dataUrl }));
    }

    setActiveField(null);
    handleClear();
  };

  const allFieldsSigned = visibleFields.length > 0 && visibleFields.every(f => signatures[f.fieldName]);

  const handleSubmitGenerate = async () => {
    setStatus('loading');
    const formData = new FormData();

    for (const field of visibleFields) {
      const dataUrl = signatures[field.fieldName];
      if (!dataUrl) continue;
      const blob = await fetch(dataUrl).then(r => r.blob());
      formData.append('files', blob, `${field.fieldName}.png`);
      formData.append('fieldNames', field.fieldName);
      formData.append('roles', field.role ?? '');
    }

    try {
      await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/endorsements/${endorsementId}/sign?token=${token}`,
        { method: 'PATCH', headers: { 'X-Tenant-ID': import.meta.env.VITE_MAIN_TENANT }, body: formData }
      );
      setStatus('success');
    } catch (e) {
      setStatus('error');
    }
  };

  const getFieldStyle = (field: ISignatureTemplate['fields'][0]): CSSProperties => {
    const containerHeight = containerRef.current?.offsetHeight ?? 1;
    const containerWidth = containerRef.current?.offsetWidth ?? 1;
    const pageHeight = containerHeight / numPages;
    const pdfWidth = 612;
    const pdfHeight = 792;
    const scaleX = containerWidth / pdfWidth;
    const scaleY = pageHeight / pdfHeight;
    const screenX = field.x * scaleX;
    const yWithinPage = (pdfHeight - field.y) * scaleY;
    const screenY = +field.page * pageHeight + yWithinPage;
    return {
      position: 'absolute',
      left: screenX,
      top: screenY,
      width: field.width * scaleX,
      height: field.height * scaleY,
      zIndex: 99,
    };
  };

  // mobile sign flow — no PDF, just context + signature pad
  const mobileSignFlow = (
    <div className='mobile_sign'>

      {/* context card */}
      <div className='mobile_sign_card'>
        <p className='mobile_sign_card_from'>Signature request from</p>
        <p className='mobile_sign_card_company'>Samkara Brokerage Inc.</p>
        <div className='mobile_sign_card_rows'>
          <div className='mobile_sign_card_row'>
            <span className='mobile_sign_card_label'>Type</span>
            <span className='mobile_sign_card_value'>
              {endorsementTypeOptions[endorsement.type]}
            </span>
          </div>
          <div className='mobile_sign_card_row'>
            <span className='mobile_sign_card_label'>Signing as</span>
            <span className='mobile_sign_card_value' style={{ textTransform: 'capitalize' }}>
              {signatureType ?? 'Insured'}
            </span>
          </div>
          <div className='mobile_sign_card_row'>
            <span className='mobile_sign_card_label'>Fields</span>
            <span
              className='mobile_sign_card_value'>{visibleFields.length} signature{visibleFields.length > 1 ? 's' : ''} required</span>
          </div>
        </div>
        <button className='mobile_sign_card_view' onClick={() => setShowDocument(v => !v)}>
          {showDocument ? 'Hide document' : 'View full document'}
        </button>
      </div>

      {/* collapsible PDF */}
      {showDocument && (
        <div className='mobile_document_container' ref={containerRef}>
          <Document
            className='document'
            file={endorsement.url}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          >
            {Array.from({ length: numPages }, (_, i) => (
              <Page key={i + 1} pageNumber={i + 1} width={window.innerWidth - 32}/>
            ))}
          </Document>
        </div>
      )}

      {/* signature area */}
      <div className='mobile_sign_pad'>
        <p className='mobile_sign_pad_label'>
          {allFieldsSigned ? '✓ Signed — tap to redo' : 'Draw your signature below'}
        </p>

        {allFieldsSigned ? (
          <div className='mobile_sign_preview' onClick={() => {
            setSignatures({});
            setActiveField(visibleFields[0]?.fieldName);
          }}>
            <img src={Object.values(signatures)[0]} alt='signature' className='mobile_sign_preview_img'/>
            <span className='mobile_sign_preview_redo'>Tap to redo</span>
          </div>
        ) : (
          <>
            <SignatureCanvas
              ref={sigRef}
              penColor='#1a1a1a'
              canvasProps={{ className: 'mobile_signature_canvas' }}
            />
            <div className='mobile_sign_pad_footer'>
              <button onClick={handleClear} className='btn_clear'>Clear</button>
              <button onClick={handleSubmitSignature} className='btn_primary'>
                {visibleFields.length > 1 ? `Apply to all ${visibleFields.length} fields` : 'Confirm signature'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* submit */}
      <div className='submit_wrapper'>
        <button
          onClick={handleSubmitGenerate}
          disabled={!allFieldsSigned}
          className={`btn_submit ${!allFieldsSigned ? 'btn_submit--disabled' : ''}`}
        >
          Submit
        </button>
      </div>
    </div>
  );

  // desktop flow — unchanged
  const desktopSignFlow = (
    <div className='main'>
      <div className='document_container' ref={containerRef}>
        <Document
          className='document'
          file={endorsement.url}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          onLoadError={(error) => console.log(error)}
        >
          {Array.from({ length: numPages }, (_, i) => (
            <Page key={i + 1} pageNumber={i + 1} width={1000}/>
          ))}
        </Document>

        {numPages > 0 && visibleFields.map((field) => (
          <div key={field.fieldName} style={getFieldStyle(field)}>
            {signatures[field.fieldName] ? (
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <img
                  src={signatures[field.fieldName]}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                  alt='signature'
                />
                <button
                  onClick={() => handleSignField(field.fieldName)}
                  style={{
                    position: 'absolute', top: -8, right: -8,
                    background: '#1a1a1a', color: '#fff',
                    border: 'none', borderRadius: '50%',
                    width: 20, height: 20, fontSize: 10,
                    cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center'
                  }}
                >✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleSignField(field.fieldName)}
                style={{
                  width: '100%', height: '100%',
                  border: '1.5px dashed #1a1a1a',
                  background: 'rgba(26,26,26,0.04)',
                  cursor: 'pointer', borderRadius: 4,
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 6,
                  fontSize: 12, color: '#1a1a1a', fontWeight: 500,
                }}
              >✎ {field.label || 'Click to sign'}</button>
            )}
          </div>
        ))}
      </div>

      <div className='signature'>
        <div className='signature_container'>
          <div className='fields_panel'>
            <p className='fields_panel_title'>Signature fields</p>
            <div className='fields_list'>
              {visibleFields.map((field, index) => (
                <div
                  key={field.fieldName}
                  className={`fields_list_item ${activeField === field.fieldName ? 'fields_list_item--active' : ''}`}
                  onClick={() => handleSignField(field.fieldName)}
                >
                  <span className={`fields_list_badge ${signatures[field.fieldName] ? 'fields_list_badge--done' : ''}`}>
                    {signatures[field.fieldName] ? '✓' : index + 1}
                  </span>
                  {field.label || `Signature field ${index + 1}`}
                </div>
              ))}
            </div>
          </div>

          {activeField && (
            <div className='signature_canvas_container'>
              <p className='signature_label'>
                Signing: <strong>{visibleFields.find(f => f.fieldName === activeField)?.label || activeField}</strong>
              </p>
              <SignatureCanvas
                ref={sigRef}
                penColor='#1a1a1a'
                canvasProps={{ className: 'signature_canvas' }}
              />
              <div className='signature_canvas_footer'>
                <p className='signature_hint'>Draw your signature with mouse or finger</p>
                <button onClick={handleClear} className='btn_clear'>Clear</button>
              </div>
              <div className='signature_buttons' style={{ marginTop: 12 }}>
                <button className='btn_cancel' onClick={() => setActiveField(null)}>Cancel</button>
                <button onClick={handleSubmitSignature} className='btn_primary'>
                  {visibleFields.length > 1 ? `Apply to all ${visibleFields.length} fields` : 'Confirm signature'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className='submit_wrapper'>
          <button
            onClick={handleSubmitGenerate}
            disabled={!allFieldsSigned}
            className={`btn_submit ${!allFieldsSigned ? 'btn_submit--disabled' : ''}`}
          >
            SUBMIT
          </button>
        </div>
      </div>
    </div>
  );

  const body = (() => {
    const options = {
      idle: isMobile ? mobileSignFlow : desktopSignFlow,
      loading: <SignatureResult status='loading' endorsement={endorsement}/>,
      success: <SignatureResult status='success' endorsement={endorsement}/>,
      error: <SignatureResult status='error' endorsement={endorsement} onRetry={() => setStatus('idle')}/>
    };
    return options[status];
  })();

  return (
    <div className='container'>
      <Header/>
      {body}
      <Footer/>
    </div>
  );
}

export default SignPage;
