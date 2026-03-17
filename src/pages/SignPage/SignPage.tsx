import './SignPage.scss';

import { Document, Page, pdfjs } from 'react-pdf';
import { useRef, useState } from "react";
import type { RefObject } from 'react'

import SignatureCanvas from 'react-signature-canvas';

import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import { PDFDocument } from 'pdf-lib';
import Draggable from 'react-draggable';
import Header from "../../layout/Header/Header.tsx";
import Footer from "../../layout/Footer/Footer.tsx";

function SignPage () {
  const [numPages, setNumPages] = useState(0);
  const sigRef = useRef<SignatureCanvas>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [signatureDataUrls, setSignatureDataUrls] = useState<string[]>([]);
  const [sigPositions, setSigPositions] = useState<{ x: number, y: number }[]>([]);
  const dragRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleClear = () => sigRef.current?.clear();

  const handleSubmitSignature = () => {
    if (sigRef.current?.isEmpty()) {
      alert('Please provide a signature');
      return;
    }
    const signatureImage = sigRef.current!.toDataURL('image/png');
    setSignatureDataUrls(prev => [...prev, signatureImage]);
    setSigPositions(prev => [...prev, { x: 0, y: 0 }]);

    handleClear();
  };

  const handleSubmitGenerate = async () => {
    const pdfBytes = await fetch('https://tlcify.nyc3.cdn.digitaloceanspaces.com/endorsement-request%20(1).pdf')
      .then(res => res.arrayBuffer());

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();

    const containerHeight = containerRef.current?.offsetHeight ?? 1;
    const containerWidth = containerRef.current?.offsetWidth ?? 1;
    const pageHeight = containerHeight / numPages;
    const signatureCanvasHeight = sigRef.current?.getCanvas().offsetHeight ?? 77;

    for (let i = 0; i < signatureDataUrls.length; i++) {
      const sigPos = sigPositions[i];
      const dataUrl = signatureDataUrls[i];

      const signatureImageBytes = await fetch(dataUrl).then(res => res.arrayBuffer());
      const embeddedImage = await pdfDoc.embedPng(signatureImageBytes);

      const pageIndex = Math.min(
        Math.floor(sigPos.y / pageHeight),
        pages.length - 1
      );

      const targetPage = pages[pageIndex];
      const { width: pdfWidth, height: pdfHeight } = targetPage.getSize();

      const scaleX = pdfWidth / containerWidth;
      const scaleY = pdfHeight / pageHeight;

      const signatureX = (sigPos.x + 350) * scaleX;
      const signatureY = pdfHeight - (((sigPos.y % pageHeight) + signatureCanvasHeight) * scaleY) - 20;

      targetPage.drawImage(embeddedImage, {
        x: signatureX,
        y: signatureY,
        width: 200 * scaleX,
        height: 77 * scaleY,
      });
    }

    const signedPdfBytes = await pdfDoc.save();
    const blob = new Blob([signedPdfBytes as unknown as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'signed.pdf';
    a.click();
  };

  return (
    <div className='container'>
      <Header/>
      <div className='main'>
        <div className='document_container' ref={containerRef}>
          <Document
            className='document'
            file='https://tlcify.nyc3.cdn.digitaloceanspaces.com/endorsement-request%20(1).pdf'
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            onLoadError={(error) => console.log(error)}
          >
            {Array.from({ length: numPages }, (_, i) => (
              <Page key={i + 1} pageNumber={i + 1} width={1000}/>
            ))}
          </Document>

          {signatureDataUrls.map((sig, index) => {
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
                  className='field_wrapper'
                >
                  <div className="drag-handle field_handle">
                    ✥ SIGNATURE
                  </div>
                  <img
                    alt='signature-image'
                    src={sig}
                    width={200}
                    height={60}
                    className='field_image'
                  />
                </div>
              </Draggable>
            );
          })}
        </div>

        <div className='signature'>
          <div className='signature_container'>
            <div className='signature_canvas_container'>
              <p className='signature_label'>Sign below</p>
              <SignatureCanvas
                ref={sigRef}
                penColor='#1a1a1a'
                canvasProps={{ className: 'signature_canvas' }}
              />
              <div className='signature_canvas_footer'>
                <p className='signature_hint'>Draw your signature with mouse or finger</p>
                <button onClick={handleClear} className='btn_clear'>Clear</button>
              </div>
            </div>

            <div className='signature_buttons'>
              <button className='btn_cancel'>Cancel</button>
              <button onClick={handleSubmitSignature} className='btn_primary'>Submit signature</button>
            </div>
          </div>

          <div className='submit_wrapper'>
            <button
              onClick={handleSubmitGenerate}
              disabled={!signatureDataUrls.length}
              className={`btn_submit ${!signatureDataUrls.length ? 'btn_submit--disabled' : ''}`}
            >
              SUBMIT
            </button>
          </div>
        </div>
      </div>
      <Footer/>
    </div>
  )
}

export default SignPage;
