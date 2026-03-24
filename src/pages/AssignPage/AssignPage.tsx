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
import type { ICustomer, IEndorsement, ISignatureTemplate } from "../../types/document.ts";
import { useSearchParams } from "react-router-dom";

function AssignPage () {
  const { endorsementId } = useParams();

  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [signatureRoles, setSignatureRoles] = useState<string[]>([]);

  const [endorsement, setEndorsement] = useState<IEndorsement>({
      _id: endorsementId ?? '',
      customer: {} as ICustomer,
      signature_template: {} as ISignatureTemplate,
      type: '',
      url: '',
      meta: {},
      status: 'signature',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  );

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

  const [signatureDataUrls, setSignatureDataUrls] = useState<string[]>([]);
  const [sigPositions, setSigPositions] = useState<{ x: number, y: number }[]>([]);
  const dragRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleCreateField = () => {
    setSignatureDataUrls(prev => [...prev, `field_${prev.length}`]);
    setSigPositions(prev => [...prev, { x: 0, y: 0 }]);
    setSignatureRoles(prev => [...prev, '']);
  };

  const handleSubmitGenerate = async () => {
    const containerHeight = containerRef.current?.offsetHeight ?? 1;
    const containerWidth = containerRef.current?.offsetWidth ?? 1;
    const pageHeight = containerHeight / numPages;

    // fetch pdf to get its dimensions
    const pdfBytes = await fetch(endorsement.url)
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
        x: Math.round((sigPos.x + 350) * scaleX),
        label: signatureRoles[index],
        role: signatureRoles[index].toLowerCase(),
        // 20 is the header of the signature field
        y: Math.round(pdfHeight - ((yWithinPage + 77) * scaleY)) - 20,
        width: Math.round(200 * scaleX),
        height: Math.round(77 * scaleY),
      };
    });

    const signatureTemplateResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/signature/${endorsement.signature_template._id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json', 'X-Tenant-ID': import.meta.env.VITE_MAIN_TENANT,
      },
      credentials: "include",
      body: JSON.stringify({ fields, endorsementId })
    });

    const signatureData = await signatureTemplateResponse.json();

    console.log(signatureData)

    await fetch(`${import.meta.env.VITE_BACKEND_URL}/email/invite-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'X-Tenant-ID': import.meta.env.VITE_MAIN_TENANT,
      },
      credentials: "include",
      body: JSON.stringify({
        ...endorsement,
        signature_template: signatureData
      })
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
            file={endorsement.url}
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
                  className='field_wrapper'
                >
                  <div className="drag-handle field_handle">
                    <span>✥</span> Signature field {index + 1}
                  </div>
                  <div className='field_box'>
                    <span className='field_box_label'>Sign here</span>
                  </div>
                </div>
              </Draggable>
            );
          })}
        </div>

        <div className='signature'>
          <div className='signature_container'>
            <div className='fields_panel'>
              <p className='fields_panel_title'>Signature fields</p>
              <p className='fields_panel_hint'>
                Create a field and drag it to the exact position where the customer should sign.
              </p>

              {signatureDataUrls.map((_, index) => (
                <div className='fields_list_item'>
                  <div className='field_item_top'>
                    <span className='fields_list_badge'>{index + 1}</span>
                    <span className='field_item_label'>Signature field {index + 1}</span>
                  </div>
                  <div className='role_selector'>
                    {['Insured', 'Driver', 'Other'].map(role => (
                      <button
                        key={role}
                        className={`role_btn ${
                          signatureRoles[index] === role
                            ? `role_btn--active ${role.toLowerCase()}`
                            : ''
                        }`}
                        onClick={() =>
                          setSignatureRoles(prev => {
                            const updated = [...prev];
                            updated[index] = prev[index] === role ? '' : role;
                            return updated;
                          })
                        }
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <button onClick={handleCreateField} className='btn_create'>
                <span>+</span> Create a field
              </button>
            </div>
          </div>

          <div className='submit_wrapper'>
            <button
              onClick={handleSubmitGenerate}
              disabled={!signatureDataUrls.length}
              className={`btn_submit ${!signatureDataUrls.length ? 'btn_submit--disabled' : ''}`}
            >
              Save fields
            </button>
          </div>
        </div>
      </div>
      <Footer/>
    </div>
  )
}

export default AssignPage;
