import './SignatureResult.scss';
import type { IEndorsement } from '../../types/document.ts';
import { endorsementTypeOptions } from "../../utils/main.ts";

interface SignatureResultProps {
  status: 'loading' | 'success' | 'error';
  endorsement: IEndorsement;
  error?: string;
  onRetry?: () => void;
  onBack?: () => void;
}

function SignatureResult ({ status, endorsement, error, onRetry }: SignatureResultProps) {
  const insuredFields = endorsement.signature_template.fields.filter(f => f.role === 'insured');
  const driverFields = endorsement.signature_template.fields.filter(f => f.role === 'driver');

  const renderIcon = () => {
    if (status === 'success') return (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M6 14L11.5 19.5L22 8" stroke="#2d7a55" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
    if (status === 'error') return (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M14 8v8M14 20v.5" stroke="#c0392b" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    );
    return (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className='spin'>
        <circle cx="14" cy="14" r="10" stroke="#e0dbd3" strokeWidth="2.5"/>
        <path d="M14 4a10 10 0 0 1 10 10" stroke="#1e2a38" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    );
  };

  const config = {
    loading: {
      iconMod: 'result_icon--loading',
      labelMod: 'result_label--loading',
      label: 'Please wait',
      title: 'Saving fields...',
      desc: "We're saving your signature fields and sending invitation emails to all signers.",
    },
    success: {
      iconMod: 'result_icon--success',
      labelMod: 'result_label--success',
      label: 'Fields Saved',
      title: 'Signature fields assigned',
      desc: 'The signature fields have been saved and invitation emails have been sent to all required signers.',
    },
    error: {
      iconMod: 'result_icon--error',
      labelMod: 'result_label--error',
      label: 'Failed',
      title: 'Something went wrong',
      desc: 'The signature fields could not be saved. Please try again or contact support if the issue persists.',
    },
  }[status];

  return (
    <div className='result_wrapper'>
      <div className='result_card'>

        <div className='result_top'>
          <div className={`result_icon ${config.iconMod}`}>
            {renderIcon()}
          </div>
          <p className={`result_label ${config.labelMod}`}>{config.label}</p>
          <h1 className='result_title'>{config.title}</h1>
          <p className='result_desc'>{config.desc}</p>
        </div>

        {status !== 'loading' && (
          <div className='result_body'>

            {status === 'success' && (
              <>
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

                {/*<button onClick={onBack} className='btn btn--primary'>Back to endorsements</button>*/}
              </>
            )}

            {status === 'error' && (
              <>
                {error && <div className='error_box'>{error}</div>}
                <button onClick={onRetry} className='btn btn--danger'>Try again</button>
                {/*<button onClick={onBack} className='btn btn--secondary'>Back to endorsements</button>*/}
              </>
            )}

          </div>
        )}

      </div>
    </div>
  );
}

export default SignatureResult;
