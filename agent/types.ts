import z, { ZodObject, ZodRawShape } from "zod";

export type ZodObjectSchema<O = {}> =
  | ZodObject<ZodRawShape, "strip", z.ZodTypeAny, O, {}>
  | ZodObject<ZodRawShape, "passthrough", z.ZodTypeAny, O, {}>;

export type AtLeastOne<T> = {
  [K in keyof T]-?: Required<Pick<T, K>> & Partial<T>;
}[keyof T];

export type AsyncGeneratorWithField<T, R> = AsyncGenerator<T, R, void>;
