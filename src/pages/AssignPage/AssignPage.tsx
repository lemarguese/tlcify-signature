import './AssignPage.scss';

import { Document, Page, pdfjs } from 'react-pdf';
import { useEffect, useRef, useState } from "react";
import type { RefObject } from 'react'

import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import { PDFDocument } from 'pdf-lib';
import Draggable from 'react-draggable';
import Footer from "../../layout/Footer/Footer.tsx";
import Header from "../../layout/Header/Header.tsx";
import { useParams } from "react-router";
import type { ISignatureTemplate } from "../../types/document.ts";

function AssignPage () {
  const { templateId } = useParams();

  const [template, setTemplate] = useState<ISignatureTemplate>({
    insurance: '',
    type: '',
    url: '',
    fields: []
  });

  const fetchTemplateById = async () => {
    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/signature_templates/${templateId}`, {
      method: 'GET',
    });

    const data = await response.json();

    setTemplate(data);
  }

  useEffect(() => {
    fetchTemplateById()
  }, []);

  const [numPages, setNumPages] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const [signatureDataUrls, setSignatureDataUrls] = useState<string[]>([]);
  const [sigPositions, setSigPositions] = useState<{ x: number, y: number }[]>([]);
  const dragRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleCreateField = () => {
    setSignatureDataUrls(prev => [...prev, `field_${prev.length}`]);
    setSigPositions(prev => [...prev, { x: 0, y: 0 }]);
  };

  const handleSubmitGenerate = async () => {
    const containerHeight = containerRef.current?.offsetHeight ?? 1;
    const containerWidth = containerRef.current?.offsetWidth ?? 1;
    const pageHeight = containerHeight / numPages;

    // fetch pdf to get its dimensions
    const pdfBytes = await fetch(template.url)
      .then(res => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();

    const fields = sigPositions.map((sigPos, index) => {
      const pageIndex = Math.min(
        Math.floor(sigPos.y / pageHeight),
        numPages - 1
      );

      const targetPage = pages[pageIndex];
      const { width: pdfWidth, height: pdfHeight } = targetPage.getSize();

      const scaleX = pdfWidth / containerWidth;
      const scaleY = pdfHeight / pageHeight;

      const yWithinPage = sigPos.y % pageHeight;

      return {
        fieldName: `signature_${index}`,
        page: pageIndex,
        x: (sigPos.x + 350) * scaleX,
        y: pdfHeight - ((yWithinPage + 77) * scaleY),
        width: 200 * scaleX,
        height: 77 * scaleY,
      };
    });

    await fetch(`${import.meta.env.VITE_BACKEND_URL}/signature_templates/${templateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });

    alert('Fields saved!');
  };

  return (
    <div className='container'>
      <Header/>
      <div className='main'>
        <div className='document_container' ref={containerRef}>
          <Document
            className='document'
            file={template.url}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            onLoadError={(error) => console.log(error)}
          >
            {Array.from({ length: numPages }, (_, i) => (
              <Page key={i + 1} pageNumber={i + 1} width={1000}/>
            ))}
          </Document>

          {signatureDataUrls.map((_, index) => {
            const nodeRef = { current: dragRefs.current[index] } as RefObject<HTMLDivElement | null>;

            return (
              <Draggable
                key={index}
                nodeRef={nodeRef}
                bounds="parent"
                handle=".drag-handle"
                defaultPosition={{ x: 0, y: 0 }}
                onStop={(_, data) => {
                  setSigPositions(prev => {
                    const updated = [...prev];
                    updated[index] = { x: data.x, y: data.y };
                    return updated;
                  });
                }}
              >
                <div
                  ref={el => {
                    dragRefs.current[index] = el;
                    nodeRef.current = el;
                  }}
                  style={{ position: 'absolute', zIndex: 99, display: 'inline-block', top: 100, left: '35%' }}
                >
                  <div className="drag-handle" style={{
                    background: '#1a1a1a',
                    color: '#fff',
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: '4px 4px 0 0',
                    cursor: 'grab',
                    userSelect: 'none'
                  }}>
                    ✥ ASSIGN THE SIGNATURE
                  </div>
                  <div style={{
                    width: 200,
                    height: 60,
                    border: '1px dashed #000',
                    background: 'rgba(0,0,0,0.03)'
                  }}/>
                </div>
              </Draggable>
            );
          })}
        </div>

        <div className='signature'>
          <div className='signature_container'>
            <div className='signature_buttons'>
              <button onClick={handleCreateField} style={{
                flex: 2, padding: 10, borderRadius: 8, border: 'none',
                background: '#1a1a1a', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer'
              }}>Create a field
              </button>
            </div>
          </div>

          <div style={{ width: '100%' }}>
            <button onClick={handleSubmitGenerate} disabled={!signatureDataUrls.length} style={{
              width: '100%', padding: '12px 8px', borderRadius: 8, border: 'none',
              background: '#1a1a1a', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer'
            }}>SUBMIT
            </button>
          </div>
        </div>
      </div>
      <Footer/>
    </div>
  )
}

export default AssignPage;
