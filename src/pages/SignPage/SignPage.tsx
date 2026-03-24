import './SignPage.scss';

import { Document, Page, pdfjs } from 'react-pdf';
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from 'react'
import SignatureCanvas from 'react-signature-canvas';

import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import { PDFDocument } from 'pdf-lib';
import Header from "../../layout/Header/Header.tsx";
import Footer from "../../layout/Footer/Footer.tsx";
import { useParams } from "react-router";
import type { ISignatureTemplate, ICustomer, IEndorsement } from "../../types/document.ts";
import { useSearchParams } from 'react-router-dom';

function SignPage () {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const { endorsementId } = useParams();

  const [endorsement, setEndorsement] = useState<IEndorsement>({
    _id: endorsementId ?? '',
    customer: {} as ICustomer,
    signature_template: {
      fields: []
    } as ISignatureTemplate,
    type: '',
    url: '',
    status: 'signature',
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  const fetchEndorsementById = async () => {
    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/endorsements/${endorsementId}/locations?token=${token}`, {
      method: 'GET',
      headers: {
        'X-Tenant-ID': import.meta.env.VITE_MAIN_TENANT
      }
    });

    const data = await response.json();

    setEndorsement(data);
  }

  useEffect(() => {
    fetchEndorsementById()
  }, []);

  const [numPages, setNumPages] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const sigRef = useRef<SignatureCanvas>(null);

  // signatures keyed by fieldName
  const [signatures, setSignatures] = useState<Record<string, string>>({});
  // which field is currently being signed
  const [activeField, setActiveField] = useState<string | null>(null);

  const handleClear = () => sigRef.current?.clear();

  const handleSignField = (fieldName: string) => {
    setActiveField(fieldName);
  };

  const handleSubmitSignature = () => {
    if (sigRef.current?.isEmpty()) {
      alert('Please provide a signature');
      return;
    }
    const dataUrl = sigRef.current!.toDataURL('image/png');
    setSignatures(prev => ({ ...prev, [activeField!]: dataUrl }));
    setActiveField(null);
    handleClear();
  };

  const allFieldsSigned = endorsement.signature_template.fields.length > 0 &&
    endorsement.signature_template.fields.every(f => signatures[f.fieldName]);

  const handleSubmitGenerate = async () => {
    const pdfBytes = await fetch(endorsement.url).then(res => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();

    for (const field of endorsement.signature_template.fields) {
      const dataUrl = signatures[field.fieldName];
      if (!dataUrl) continue;

      const signatureImageBytes = await fetch(dataUrl).then(res => res.arrayBuffer());
      const embeddedImage = await pdfDoc.embedPng(signatureImageBytes);

      const targetPage = pages[+field.page];

      targetPage.drawImage(embeddedImage, {
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
      });
    }

    const signedPdfBytes = await pdfDoc.save();

    // convert to base64 to send to backend
    const base64 = btoa(String.fromCharCode(...new Uint8Array(signedPdfBytes)));

    await fetch(`${import.meta.env.VITE_BACKEND_URL}/endorsements/${endorsementId}/sign?token=${token}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': import.meta.env.VITE_MAIN_TENANT,
      },
      body: JSON.stringify({
        signedAt: new Date(),
        signedUserAgent: navigator.userAgent,
        buffer: base64,
      }),
    });

    // download for the customer
    const blob = new Blob([signedPdfBytes as unknown as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'signed.pdf';
    a.click();
  };

  const getFieldStyle = (field: ISignatureTemplate['fields'][0]): CSSProperties => {
    const containerHeight = containerRef.current?.offsetHeight ?? 1;
    const containerWidth = containerRef.current?.offsetWidth ?? 1;
    const pageHeight = containerHeight / numPages;

    const pdfWidth = 612;
    const pdfHeight = 792;

    const scaleX = containerWidth / pdfWidth;
    const scaleY = pageHeight / pdfHeight;

    const screenX = (field.x * scaleX);
    const yWithinPage = (pdfHeight - field.y) * scaleY;

    const screenY = +field.page * pageHeight + yWithinPage;

    const screenWidth = field.width * scaleX;
    const screenHeight = field.height * scaleY;

    return {
      position: 'absolute',
      left: screenX,
      top: screenY,
      width: screenWidth,
      height: screenHeight,
      zIndex: 99,
    };
  };

  return (
    <div className='container'>
      <Header/>
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

          {numPages > 0 && endorsement.signature_template.fields.map((field) => (
            <div key={field.fieldName} style={getFieldStyle(field)}>
              {signatures[field.fieldName] ? (
                // signed — show the signature image
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
                // unsigned — show click to sign box
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
                >
                  ✎ {field.label || 'Click to sign'}
                </button>
              )}
            </div>
          ))}
        </div>

        <div className='signature'>
          <div className='signature_container'>

            {/* field progress list */}
            <div className='fields_panel'>
              <p className='fields_panel_title'>Signature fields</p>
              <div className='fields_list'>
                {endorsement.signature_template.fields.map((field, index) => (
                  <div
                    key={field.fieldName}
                    className={`fields_list_item ${activeField === field.fieldName ? 'fields_list_item--active' : ''}`}
                    onClick={() => handleSignField(field.fieldName)}
                  >
                    <span
                      className={`fields_list_badge ${signatures[field.fieldName] ? 'fields_list_badge--done' : ''}`}>
                      {signatures[field.fieldName] ? '✓' : index + 1}
                    </span>
                    {field.label || `Signature field ${index + 1}`}
                  </div>
                ))}
              </div>
            </div>

            {/* signature pad — only show when a field is active */}
            {activeField && (
              <div className='signature_canvas_container'>
                <p className='signature_label'>
                  Signing: <strong>{endorsement.signature_template.fields.find(f => f.fieldName === activeField)?.label || activeField}</strong>
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
                  <button onClick={handleSubmitSignature} className='btn_primary'>Confirm signature</button>
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
      <Footer/>
    </div>
  );
}

export default SignPage;
