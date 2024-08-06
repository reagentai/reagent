import dedent from "dedent";
import { Workflow } from "@reagentai/reagent";
import {
  ChatCompletionWithToolCalling,
  WorkflowInput,
} from "@reagentai/reagent/nodes";

import { AgentError } from "@reagentai/react/tools/AgentError.js";
import { GenerateSQLQuery } from "./GenerateSQLQuery.js";

const workflow = new Workflow({
  name: "SQL agent",
  description: "This agent generates and executes SQL queries",
});

const input = workflow.addNode("input", new WorkflowInput());
const error = workflow.addNode("error", new AgentError());

const storyGeneratorConfig = {
  systemPrompt:
    "You are an amazing AI assistant called Jarvis who is expert in SQL.",
  temperature: 0.9,
  stream: true,
};

const generateQuery = workflow.addNode(
  "generateQuery",
  new ChatCompletionWithToolCalling(),
  {
    config: storyGeneratorConfig,
    label: "Generate a SQL query",
  }
);

const runQuery = workflow.addNode("runQuery", new GenerateSQLQuery());

generateQuery.bind({
  model: input.output.model,
  query: input.output.query,
  // TODO: replace this with database tables info from a database
  context: dedent(`
    When generating a SQL query, use 'ilike %name' to pattern match string instead of using '='.
    When searching for users by first name or last name, use '%'. For example, "firstName ilike %john".

    Here's a list of tables in the database along with the columns:
  
    - name: users
      description: list of users and their info
      columns:
        - id: unique uuid <varchar>
        - first_name: first name of the user <varchar>
        - last_name: last name of the user <varchar>
        - created_at: UTC ISO of the date that the user was added <timestamp>
        - archived_at: UTC ISO of the date that the user was archived <timestamp>

    - name: workspaces
      description: list of workspaces; each workspace can have more than one user and a user can be in more than one workspace
      columns:
        - id: unique uuid <varchar>
        - name: workspace name <varchar>
        - created_at: UTC ISO of the date that the workspace was created <timestamp>

    - name: workspace_members
      description: list of users in a workspace
      columns:
        - workspace_id: id of the workspace from "workspaces" table
        - user_id: id of the user from "users" table
  `),
  tools: [
    runQuery.asTool({
      parameters: ["sql"],
    }),
  ],
});

error.bind({
  error: runQuery.output.error,
});

workflow.bind({
  markdown: [generateQuery.output.markdown],
  markdownStream: [generateQuery.output.stream],
  ui: [runQuery.renderOutput, error.renderOutput],
});

export default workflow;
export const nodes = [GenerateSQLQuery];
export const __reagentai_exports__ = true;
