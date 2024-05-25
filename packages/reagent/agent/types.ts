import z, { ZodObject, ZodRawShape } from "zod";

export type ZodObjectSchema<O = {}> =
  | ZodObject<ZodRawShape, "strip", z.ZodTypeAny, O, {}>
  | ZodObject<ZodRawShape, "passthrough", z.ZodTypeAny, O, {}>;

export type AtLeastOne<T> = {
  [K in keyof T]-?: Pick<Required<T>, K> & Partial<Omit<T, K>>;
}[keyof T];

export type AsyncGeneratorWithField<T> = AsyncGenerator<T, void, void>;
