import {
  groupBy,
  map,
  mergeMap,
  merge,
  share,
  take,
  filter,
  of,
  reduce,
} from "rxjs";

import { AgentEvent, AgentEventType } from "../stream.js";
import type { OutputValueEvent, OutputValueProvider } from "./types";

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
  const stream = merge<OutputValueEvent<any>[]>(...renders)
    .pipe(groupBy((e) => e.session!.id))
    .pipe(
      map((group: any) => {
        const value = group
          .pipe(take(renders.length))
          .pipe(mergeMap((g: any) => g.value))
          .pipe(share());

        // TODO: removing this doesn't stream render events; BUT WHY?
        value.subscribe();
        return {
          session: {
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

function mergeMapOutputs<O1, O2, Output>(
  provider1: OutputValueProvider<O1> | O1,
  provider2: OutputValueProvider<O2> | O2,
  callback: (v1: O1, v2: O2) => Output
): OutputValueProvider<Output>;
function mergeMapOutputs<O1, O2, O3, Output>(
  provider1: OutputValueProvider<O1> | O1,
  provider2: OutputValueProvider<O2> | O2,
  provider3: OutputValueProvider<O3> | O3,
  callback: (v1: O1, v2: O2, v3: O3) => Output
): OutputValueProvider<Output>;
function mergeMapOutputs<O1, O2, O3, O4, Output>(
  provider1: OutputValueProvider<O1> | O1,
  provider2: OutputValueProvider<O2> | O2,
  provider3: OutputValueProvider<O3> | O3,
  provider4: OutputValueProvider<O4> | O4,
  callback: (v1: O1, v2: O2, v3: O3, v4: O4) => Output
): OutputValueProvider<Output>;
function mergeMapOutputs<O1, O2, O3, O4, O5, Output>(
  provider1: OutputValueProvider<O1> | O1,
  provider2: OutputValueProvider<O2> | O2,
  provider3: OutputValueProvider<O3> | O3,
  provider4: OutputValueProvider<O4> | O4,
  provider5: OutputValueProvider<O5> | O5,
  callback: (v1: O1, v2: O2, v3: O3, v4: O4, v5: O5) => Output
): OutputValueProvider<Output>;
function mergeMapOutputs<O1, O2, O3, O4, O5, O6, Output>(
  provider1: OutputValueProvider<O1> | O1,
  provider2: OutputValueProvider<O2> | O2,
  provider3: OutputValueProvider<O3> | O3,
  provider4: OutputValueProvider<O4> | O4,
  provider5: OutputValueProvider<O5> | O5,
  provider6: OutputValueProvider<O6> | O6,
  callback: (v1: O1, v2: O2, v3: O3, v4: O4, v5: O5, v6: O6) => Output
): OutputValueProvider<Output>;
function mergeMapOutputs<Output>(
  ...providers: (OutputValueProvider<any> | any)[]
): OutputValueProvider<Output> {
  const callback = providers.pop();
  const dependencies = providers.flatMap((r: any) => {
    const provider = r[VALUE_PROVIDER];
    if (!provider) {
      return [];
    }
    return provider.dependencies;
  });
  const firstOutputProvider = providers.find((p: any) => p[VALUE_PROVIDER]);
  if (!firstOutputProvider) {
    throw new Error(
      `[mapOutputProviders]: At least one provider must be a OutputValueProvider`
    );
  }

  const stream = firstOutputProvider
    .pipe(take(1))
    .pipe(
      mergeMap((e1: OutputValueEvent<any>) => {
        return merge<OutputValueEvent<any>[]>(
          ...providers.map((node: any) => {
            // must be a value then
            if (!node[VALUE_PROVIDER]) {
              return of({ value: node });
            }
            return (
              node
                .pipe(
                  filter(
                    (e: OutputValueEvent<any>) =>
                      e.session!.id == e1.session!.id
                  )
                )
                .pipe(take(1))
                // TODO: maybe remove the map since it might be redundant?
                .pipe(
                  map((outputEvent: any) => {
                    return {
                      type: AgentEventType.Output,
                      session: outputEvent.session,
                      value: outputEvent.value,
                    };
                  })
                )
            );
          })
        );
      })
    )
    .pipe(take(providers.length))
    .pipe(
      reduce(
        (acc, cur: any) => {
          if (!acc.session) {
            acc.session = cur.session;
          }
          acc.values.push(cur.value);
          return acc;
        },
        {
          session: null,
          values: [],
        } as any
      )
    )
    .pipe(
      map((reduced: any) => {
        return { session: reduced.session, value: callback(...reduced.values) };
      })
    )
    .pipe(share());
  return __tagValueProvider(stream, dependencies);
}

const __tagValueProvider = (
  stream: any,
  dependencies: (AgentEvent.EventNode & { field: string })[]
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
              value: cb(e.value, e.session),
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
  });
};

export { __tagValueProvider, mergeRenderStreams, mergeMapOutputs };
