import './SignatureSigned.scss';
import type { IEndorsement } from '../../types/document.ts';
import { endorsementTypeOptions } from "../../utils/main.ts";
import * as dayjs from 'dayjs';

interface SignatureSignedProps {
  endorsement: IEndorsement;
  signatureType: string | null;
}

function SignatureSigned ({ endorsement, signatureType }: SignatureSignedProps) {
  const insuredFields = endorsement.signature_template.fields.filter(f => f.role === 'insured');
  const driverFields = endorsement.signature_template.fields.filter(f => f.role === 'driver');

  const foundSignature = endorsement.signatures.find(s => s.role === signatureType);

  return (
    <div className='result_wrapper'>
      <div className='result_card'>
        <div className='result_top'>
          <div className={`result_icon result_icon--success`}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M6 14L11.5 19.5L22 8" stroke="#2d7a55" strokeWidth="2.5" strokeLinecap="round"
                    strokeLinejoin="round"/>
            </svg>
          </div>
          <p className={`result_label result_label--success`}>Already Signed</p>
          <h1 className='result_title'>Thank you — you're all set.</h1>
          <p className='result_desc'>This signature link has already been used. Your signature was recorded and no
            further action is needed.</p>
        </div>

        <div className='result_body'>
          <div className='result_details'>
            <div className='detail_row'>
              <span className='detail_label'>Endorsement</span>
              <span className='detail_value'>
                      {endorsementTypeOptions[endorsement.type]}
                    </span>
            </div>
            <div className='detail_row'>
              <span className='detail_label'>Fields assigned</span>
              <span className='detail_value'>{endorsement.signature_template.fields.length} fields</span>
            </div>
            <div className='detail_row'>
              <span className='detail_label'>Status</span>
              <span className='badge badge--sent'>Emails sent</span>
            </div>
          </div>

          <div className='recipients'>
            {insuredFields.length > 0 && (
              <div className='recipient_row'>
                <span className='badge badge--insured'>Insured</span>
                <span className='recipient_email'>{endorsement.customer.email}</span>
              </div>
            )}
            {driverFields.length > 0 && (
              <div className='recipient_row'>
                <span className='badge badge--driver'>Driver</span>
                <span className='recipient_email'>{endorsement.meta?.driverEmail}</span>
              </div>
            )}
          </div>
          <div className='result_details'>
            <div className='detail_row'>
              <span className='detail_label'>Endorsement</span>
              <span className='detail_value'>
                    {endorsementTypeOptions[endorsement.type]}
                  </span>
            </div>
            {foundSignature && (
              <div className='detail_row'>
                <span className='detail_label'>Signed on</span>
                <span className='detail_value'>{dayjs(foundSignature.signedAt).format('MMM D, YYYY')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignatureSigned;
