export type AtLeastOne<T> = {
  [K in keyof T]-?: Pick<Required<T>, K> & Partial<Omit<T, K>>;
}[keyof T];

export type AsyncGeneratorWithField<T> = AsyncGenerator<T, void, void>;
