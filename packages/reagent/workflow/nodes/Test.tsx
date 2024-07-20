// import { useEffect, useState } from "react";
// import { create } from 'zustand'
// import { persist } from 'zustand/middleware';

// import { z, Context, createReagentNode } from "../index.js";
// // import { createReagentNode, z } from "@reagentai/reagent/agent";
// // import { useIntegrationContext } from "../../context";

// const DownloadPaystubs = createReagentNode({
//   id: "@rippling/download-paystubs",
//   name: "Download paystubs",
//   description: "Download all my pay stubs",
//   version: "0.1.0",
//   output: z.object({}),
//   async *execute(context, input) {
//     const render = context.render(
//       ({ data, useAgentNode }) => {
//         const { state, setState } = useAgentNode();
//         // const useFishStore = create(
//         //     persist(
//         //       (set, get) => ({
//         //         fishes: 0,
//         //         addAFish: () => set({ fishes: get().fishes + 1 }),
//         //       }),
//         //       {
//         //         name: 'food-storage', // name of the item in the storage (must be unique)
//         //         storage: createJSONStorage(() => sessionStorage), // (optional) by default, 'localStorage' is used
//         //       },
//         //     ),
//         //   );
//         // const context = useIntegrationContext();
//         useEffect(() => {
//           if (!state) {
//             setState({
//               status: "started",
//               donwloadUrl: null,
//             });
//             console.log("I AM NOT DONE!");
//             fetch(
//               `https://app.rippling.com/api/payroll/api/payroll_runs/bulk_download_paystubs_for_role_url/?roleId=${context.defaultHeaders["Role"]}`,
//               {
//                 headers: {
//                   ...context.defaultHeaders,
//                   "content-type": "application/json",
//                 },
//               }
//             ).then(async (res) => {
//               const payload = await res.json();
//               console.log("JSON =", payload);
//               setState((prev) => {
//                 return {
//                   ...prev,
//                   donwloadUrl: payload.url,
//                 };
//               });
//             });
//           }
//         }, []);
//         console.log("context =", context);
//         return (
//           <div>
//             {!state.donwloadUrl && <div>Generating download link...</div>}
//             {state.donwloadUrl && <div>Download your pay stubs here</div>}
//           </div>
//         );
//       },
//       {
//         done: false,
//       }
//     );

//     render.update({
//       done: true,
//     });
//   },
// });

// export const nodes = [DownloadPaystubs];
// export { DownloadPaystubs };
