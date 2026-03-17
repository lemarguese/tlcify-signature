export interface ISignatureTemplate {
  insurance: string;
  type: string;
  url: string;
  fields: ISignatureTemplateField[];
}

export interface ISignatureTemplateField {
  fieldName: string;
  label: string;
  page: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
