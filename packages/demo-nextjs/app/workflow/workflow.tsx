import { createReagentNode, z, Workflow, Context } from "@reagentai/reagent";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const outputSchema = z.object({
  query: z.string(),
  done: z.boolean(),
});

const FirstStep = createReagentNode({
  id: "step-1",
  name: "Step One",
  description: `Description for step 1`,
  version: "0.0.1",
  input: z.object({
    query: z.string(),
  }),
  // target: "client",
  output: outputSchema,
  async *execute(context, input) {
    console.log("EXECUTING STEP 1: input =", input);
    yield { done: true, query: input.query };
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
        "prompt-1",
        ({ data, submit }) => {
          // pipe(
          //   { memoize: true },
          //   () => {
          //     window.location.reload();
          //   },
          //   () => {
          //     submit("VALUE " + data);
          //   }
          // );
          setTimeout(() => {
            submit("VALUE " + data);
          }, 2_000);
          return <div>Running step 3, prompt index = {data}</div>;
        },
        {
          key: "prompt-" + i,
          data: i,
          transform(value) {
            return "[PROMOT TRANSFORMED]: " + value;
          },
        }
      );
      console.log("value =", value);
    }
    console.log("PROMPT value =", value);

    const provider = {
      prompt(options: { key: string; data: any }) {
        return context.prompt(
          "prompt-2",
          ({ data, submit }) => {
            // pipe(
            //   { memoize: true },
            //   () => {
            //     window.location.reload();
            //   },
            //   () => {
            //     submit("VALUE " + data);
            //   }
            // );
            setTimeout(() => {
              submit("VALUE " + data);
            }, 2_000);
            return <div>[PROMPTS] Running prompts, prompt index = {data}</div>;
          },
          options
        );
      },
    };

    yield* prompts(provider);
    yield { done: true };
  },
});

function* prompts(provider: any) {
  for (let i = 0; i < 3; i++) {
    yield provider.prompt({
      key: "prompts-prompt-" + i,
      data: i,
    });
  }
}

const FourthStep = createReagentNode({
  id: "step-4",
  name: "Step Four",
  description: `Description for step 4`,
  version: "0.0.1",
  // target: "client",
  input: z.object({
    query: z.string(),
    start: z.boolean(),
  }),
  output: z.object({
    text: z.string(),
  }),
  async *execute(context, input) {
    console.log("EXECUTING STEP 4: input =", input);
    // yield { done: true };

    console.log("input =", input);
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt: input.query,
    });
    yield { text };
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
  query: step1.output.query,
  start: step1.output.done,
});

workflow.bind({
  ui: [step2.renderOutput, step3.renderOutput],
  markdown: [step4.output.text],
});

export default workflow;
export const nodes = [FirstStep, SecondStep, ThirdStep, FourthStep];
export const __reagentai_exports__ = true;
