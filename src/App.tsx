import './App.css';

import { Document, Page, pdfjs } from 'react-pdf';
import { useRef, useState } from "react";
import SignatureCanvas from 'react-signature-canvas';

import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import { PDFDocument } from 'pdf-lib';

import Draggable from 'react-draggable';

function App () {
  const [numPages, setNumPages] = useState(0);
  const sigRef = useRef<SignatureCanvas>(null);

  const [sigPosition, setSigPosition] = useState({ x: 100, y: 100 });

  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);

  const dragRef = useRef(null)

  const handleClear = () => {
    sigRef.current?.clear();
  };

  const handleSubmitSignature = async () => {
    if (sigRef.current?.isEmpty()) {
      alert('Please provide a signature');
      return;
    }

    const signatureImage = sigRef.current?.toDataURL('image/png');
    setSignatureDataUrl(signatureImage);
  };

  console.log(sigPosition)

  const handleSubmitGenerate = async () => {
    const pdfBytes = await fetch('https://tlcify.nyc3.cdn.digitaloceanspaces.com/signed%20(2)-1.pdf')
      .then(res => res.arrayBuffer());

    const pdfDoc = await PDFDocument.load(pdfBytes);

    const signatureImageBytes = await fetch(signatureDataUrl!).then(res => res.arrayBuffer());

    const embeddedImage = await pdfDoc.embedPng(signatureImageBytes);

    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];

    const { width: pdfWidth, height: pdfHeight } = lastPage.getSize();

    const containerEl = dragRef.current?.parentElement;
    const containerHeight = containerEl?.offsetHeight ?? 1;
    const containerWidth = containerEl?.offsetWidth ?? 1;

    const scaleX = pdfWidth / containerWidth;
    const scaleY = pdfHeight / containerHeight;

    const pdfX = sigPosition.x * scaleX + 200;
    console.log(scaleY, sigPosition.y);
    const pdfY = pdfHeight - (sigPosition.y * scaleY) - 60;

    lastPage.drawImage(embeddedImage, {
      x: pdfX,
      y: pdfY,
      width: 200 * scaleX,
      height: 60 * scaleY,
    });

    const signedPdfBytes = await pdfDoc.save();
    const blob = new Blob([signedPdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'signed.pdf';
    a.click();
  }

  return (
    <div className='main'>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <Document
          className='document'
          file='https://tlcify.nyc3.cdn.digitaloceanspaces.com/signed%20(2)-1.pdf'
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          onLoadError={(error) => console.log(error)}
        >
          {Array.from({ length: numPages }, (_, i) => (
            <Page key={i + 1} pageNumber={i + 1} width={1000} />
          ))}
        </Document>

        {signatureDataUrl && (
          <Draggable
            nodeRef={dragRef}
            bounds="parent"
            handle=".drag-handle"
            defaultPosition={{ x: 0, y: 0 }}
            onStop={(e, data) => setSigPosition({ x: data.x, y: data.y })}
          >
            <div ref={dragRef} style={{ position: 'absolute', zIndex: '99', display: 'inline-block', top: 100, left: '35%' }}>
              <div className="drag-handle" style={{
                background: '#1a1a1a',
                color: '#fff',
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: '4px 4px 0 0',
                cursor: 'grab',
                userSelect: 'none'
              }}>
                ✥ drag
              </div>
              <img
                alt='signature-image'
                src={signatureDataUrl}
                width={200}
                height={60}
                style={{ pointerEvents: 'none', display: 'block' }}
              />
            </div>
          </Draggable>
        )}
      </div>

      <div style={{ maxWidth: 560, paddingTop: 24 }}>
        <div style={{
          background: 'var(--color-background-primary)',
          border: '0.5px solid #e0e0e0',
          borderRadius: 12,
          padding: 24
        }}>
          <p style={{ fontSize: 13, color: '#888', margin: '0 0 10px' }}>Sign below</p>
          <SignatureCanvas
            ref={sigRef}
            penColor='#1a1a1a'
            canvasProps={{
              style: {
                width: '100%',
                height: 140,
                borderRadius: 8,
                border: '0.5px solid #ccc',
                background: '#fafafa',
                display: 'block',
              }
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>Draw your signature with mouse or finger</p>
            <button onClick={handleClear} style={{
              fontSize: 13,
              padding: '6px 14px',
              borderRadius: 8,
              border: '0.5px solid #ccc',
              background: 'transparent',
              cursor: 'pointer'
            }}>Clear
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button style={{
            flex: 1,
            padding: 10,
            borderRadius: 8,
            border: '0.5px solid #ccc',
            background: 'transparent',
            fontSize: 14,
            cursor: 'pointer'
          }}>Cancel
          </button>
          <button onClick={handleSubmitSignature} style={{
            flex: 2,
            padding: 10,
            borderRadius: 8,
            border: 'none',
            background: '#1a1a1a',
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer'
          }}>Submit signature
          </button>
        </div>

        <div>
          <button onClick={handleSubmitGenerate}>SUBMIT</button>
        </div>
      </div>
    </div>
  );
}

export default App;
