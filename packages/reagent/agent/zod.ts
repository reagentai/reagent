import z from "zod";

type UISchema = {
  type?: "textarea";
};

z.ZodType.prototype.label = function (label: string) {
  this._def.label = label;
  return this;
};

z.ZodType.prototype.uiSchema = function (uiSchema: UISchema) {
  this._def.uiSchema = uiSchema;
  return this;
};

declare module "zod" {
  interface ZodTypeDef {
    label?: string;
    uiSchema?: UISchema;
  }

  interface ZodType<
    Output = any,
    Def extends ZodTypeDef = ZodTypeDef,
    Input = Output,
  > {
    label<T extends z.ZodTypeAny>(this: T, label: string): T;
  }

  interface ZodType<
    Output = any,
    Def extends ZodTypeDef = ZodTypeDef,
    Input = Output,
  > {
    uiSchema<T extends z.ZodTypeAny>(this: T, uiSchema: UISchema): T;
  }
}

export { z };
