export interface ISignatureTemplate {
  _id: string;
  insurance: string;
  type: string;
  fields: ISignatureTemplateField[];
}

export interface ISignatureTemplateField {
  fieldName: string;
  label: string;
  role: 'insured' | 'driver' | 'other'
  page: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IEndorsement {
  _id: string;
  customer: ICustomer;
  signature_template: ISignatureTemplate;
  type: string;
  url: string;
  status: 'signature' | 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export interface ICustomer {
  _id: string;
  firstName: string | null,
  lastName: string | null,
  corporationName: string | null,
  phoneNumber: string,
}
