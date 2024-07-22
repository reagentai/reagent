const LAZY = Symbol("__REAGENT_WORKFLOW_LAZY__");

type Lazy<Value> = () => Value;

type LazyOp = {
  <V>(cb: () => V): Lazy<V>;
  isLazy(lazy: any): boolean;
};

const lazy = (<Value>(cb: () => Value) => {
  return Object.defineProperties(cb, {
    LAZY: {
      value: LAZY,
      enumerable: false,
      configurable: false,
      writable: false,
    },
  }) as Lazy<Value>;
}) as unknown as LazyOp;

Object.defineProperties(lazy, {
  isLazy: {
    value: function (obj: any) {
      return obj.LAZY == LAZY;
    },
    enumerable: false,
    configurable: false,
    writable: false,
  },
}) as unknown as Lazy<unknown>;

export { lazy };
export type { Lazy };
