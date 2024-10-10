import { createReagentNode, z, Workflow } from "@reagentai/reagent";

const outputSchema = z.object({
  done: z.boolean(),
});

const FirstStep = createReagentNode({
  id: "step-1",
  name: "Step One",
  description: `Description for step 1`,
  version: "0.0.1",
  input: z.object({}),
  target: "client",
  output: outputSchema,
  async *execute(context, input) {
    console.log("EXECUTING STEP 1");
    yield { done: true };
  },
});

const SecondStep = createReagentNode({
  id: "step-2",
  name: "Step Two",
  description: `Description for step 2`,
  version: "0.0.1",
  // target: "client",
  input: z.object({
    start: z.boolean(),
  }),
  output: z.object({
    done: z.boolean(),
  }),
  async *execute(context, input) {
    console.log("EXECUTING STEP 2: input =", input);
    yield { done: true };
  },
});

const ThirdStep = createReagentNode({
  id: "step-3",
  name: "Step Three",
  description: `Description for step 3`,
  version: "0.0.1",
  // target: "client",
  input: z.object({
    start: z.boolean(),
    date: z.date(),
  }),
  output: z.object({
    done: z.boolean(),
  }),
  async *execute(context, input): any {
    console.log("EXECUTING STEP 3: input =", input);

    const s = await context.step("step1", () => {
      console.log("EXECUTING STEP 3: sub step 1");
      return "STEP_1_RESULT";
    });
    console.log("RESULT OF STEP 3: sub step 1 =", s);

    let value = null;
    for (let i = 0; i < 3; i++) {
      value = yield context.prompt(
        (props) => {
          // <form
          //   onSubmit={(e: any) => {
          //     e.preventDefault();
          //     var formData = new FormData(e.target);
          //     props.submit(Object.fromEntries(formData.entries()));
          //   }}
          //   className="p-4 border border-gray-100"
          // >
          //   <div>Enter some text</div>
          //   <input
          //     name="text"
          //     className="px-3 py-1 border border-gray-200"
          //     placeholder="Enter some text..."
          //   />
          // </form>

          setTimeout(() => {
            props.submit("VALUE " + props.data);
          }, 2_000);
          return <div>Running step 3, prompt index = {props.data}</div>;
        },
        {
          key: "prompt-" + i,
          data: i,
        }
      );
      console.log("value =", value);
    }
    console.log("PROMPT value =", value);
    yield { done: true };
  },
});

const FourthStep = createReagentNode({
  id: "step-4",
  name: "Step Four",
  description: `Description for step 4`,
  version: "0.0.1",
  // target: "client",
  input: z.object({
    start: z.boolean(),
  }),
  output: z.object({
    done: z.boolean(),
  }),
  async *execute(context, input) {
    console.log("EXECUTING STEP 4: input =", input);
    yield { done: true };
  },
});

const workflow = new Workflow({
  name: "Client side workflow",
  description: "This workflow is meant to run on the client side",
});

const step1 = workflow.addNode("input", new FirstStep());
const step2 = workflow.addNode("step-2", new SecondStep());
const step3 = workflow.addNode("step-3", new ThirdStep());
const step4 = workflow.addNode("step-4", new FourthStep());

step2.bind({
  start: step1.output.done,
});

step3.bind({
  start: step2.output.done,
  date: new Date(),
});

step4.bind({
  start: step3.output.done,
});

workflow.bind({
  ui: [step2.renderOutput, step3.renderOutput],
});

export default workflow;
export const nodes = [FirstStep, SecondStep, ThirdStep, FourthStep];
export const __reagentai_exports__ = true;
