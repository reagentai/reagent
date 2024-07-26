import z, { ZodObject, ZodRawShape } from "zod";

type FieldUI = {
  type?: "textarea";
  // disabling the field hides the node handle for that field
  // default: false
  disabled?: boolean;
};

z.ZodType.prototype.label = function (label: string) {
  this._def.label = label;
  return this;
};

z.ZodType.prototype.ui = function (ui: FieldUI) {
  this._def.ui = ui;
  return this;
};

declare module "zod" {
  interface ZodTypeDef {
    label?: string;
    ui?: FieldUI;
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
    ui<T extends z.ZodTypeAny>(this: T, ui: FieldUI): T;
  }
}
export type ZodObjectSchema<O = {}> =
  | ZodObject<ZodRawShape, "strip", z.ZodTypeAny, O, {}>
  | ZodObject<ZodRawShape, "passthrough", z.ZodTypeAny, O, {}>;

export { z };
