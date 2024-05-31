import { groupBy, map, mergeMap, merge, share, take, filter } from "rxjs";
import { OutputValueProvider } from "./types";
import { AgentEvent } from "../stream";

export const VALUE_PROVIDER = Symbol("___RENDER_VALUE_PROVIDER__");

/**
 * Merges two streams into one
 *
 * If a node has a stream input but need to take in stream
 * from more than one output/render, then this can be used to combine the
 * streams;
 *
 * For example:
 * ```
 * user.mergeRenderStreams(error.render, getWeather.render),
 * ```
 *
 * @param renders
 * @returns
 */
const mergeRenderStreams = <O>(
  ...renders: OutputValueProvider<O>[]
): OutputValueProvider<O> => {
  const dependencies = renders.flatMap((r: any) => {
    const provider = r[VALUE_PROVIDER];
    if (!provider) {
      throw new Error(
        "Only `node.render` can be passed into mergeRenderStreams"
      );
    }
    return provider.dependencies;
  });
  // @ts-expect-error
  const stream = merge(...renders)
    .pipe(groupBy((e: any) => e.run.id))
    .pipe(
      map((group: any) => {
        const value = group
          .pipe(take(renders.length))
          .pipe(mergeMap((g: any) => g.value))
          .pipe(share());

        // TODO: removing this doesn't stream render events; BUT WHY?
        value.subscribe();
        return {
          run: {
            id: group.key,
          },
          value,
        };
      })
    )
    .pipe(share());

  return Object.defineProperties(stream, {
    [VALUE_PROVIDER]: {
      value: {
        type: "render",
        dependencies,
      },
      configurable: false,
      enumerable: false,
      writable: false,
    },
  }) as unknown as OutputValueProvider<O>;
};

const __tagValueProvider = (
  stream: any,
  dependencies: AgentEvent.EventNode[]
) => {
  return Object.defineProperties(stream, {
    _pipe: {
      value: stream.pipe,
      configurable: false,
      enumerable: false,
      writable: false,
    },
    map: {
      value: <O>(cb: any) => {
        const res = stream._pipe(
          map((e: any) => {
            return {
              ...e,
              value: cb(e.value, e.run),
            };
          })
        );
        return __tagValueProvider(res, dependencies) as OutputValueProvider<O>;
      },
    },
    [VALUE_PROVIDER]: {
      value: {
        type: "output",
        dependencies,
      },
      configurable: false,
      enumerable: false,
      writable: false,
    },
    select: {
      get value() {
        return (options: { runId: string }) => {
          return new Promise((resolve) => {
            this.pipe(filter((e: any) => e.run.id == options.runId)).subscribe(
              (e: any) => {
                resolve(e.value);
              }
            );
          });
        };
      },
      enumerable: false,
    },
  });
};

export { __tagValueProvider, mergeRenderStreams };
