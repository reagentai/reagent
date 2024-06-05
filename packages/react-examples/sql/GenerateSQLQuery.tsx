import { createAgentNode, z } from "@reagentai/reagent/agent";
import { faker } from "@faker-js/faker";
import { format as formatSql } from "sql-formatter";
import Markdown from "react-markdown";
import hljs from "highlight.js";
import sql from "highlight.js/lib/languages/sql";
import "highlight.js/styles/atom-one-light.min.css";

hljs.registerLanguage("sql", sql);

const outputSchema = z.object({
  error: z.string().describe("Error when running the query"),
});

const GenerateSQLQuery = createAgentNode({
  id: "@reagentai/demo-agents/generate-sql-query",
  name: "Generate SQL query",
  description: `Generate SQL query for provided tables and columns`,
  version: "0.0.1",
  input: z.object({
    sql: z.string().describe("SQL query"),
  }),
  output: outputSchema,
  async *execute(context, input) {
    const query = formatSql(input.sql);
    const ui = context.render<any>(
      (props) => <QueryComponent {...props.data} />,
      {
        sql: query,
        state: "running",
      }
    );

    await new Promise((r) => {
      setTimeout(() => {
        r(null);
      }, 1000);
    });
    ui.update({
      sql: query,
      result: [
        {
          id: "1",
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
        },
        {
          id: "2",
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
        },
        {
          id: "3",
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
        },
      ],
    });
  },
});

const QueryComponent = (props: {
  sql: string;
  state?: "running";
  result?: any[];
}) => {
  return (
    <div className="space-y-4">
      <div className="text-base font-semibold text-gray-700">
        Generated query
      </div>
      <div className="px-4 py-4 max-h-64 bg-slate-100 overflow-scroll rounded">
        <Markdown
          remarkPlugins={[]}
          children={"```sql\n" + props.sql + "\n```"}
          components={{
            code(props) {
              const sql = hljs.highlight(props.children as string, {
                language: "sql",
              });
              return (
                <div dangerouslySetInnerHTML={{ __html: sql.value }}></div>
              );
            },
          }}
        />
      </div>
      {props.state == "running" && (
        <div>
          <div className="text-gray-700">Running query...</div>
        </div>
      )}
      {props.result?.length != undefined && (
        <div className="mt-8 flow-root">
          <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
                      >
                        Id
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        First name
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Last name
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {props.result.map((user) => (
                      <tr key={user.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                          {user.id}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {user.firstName}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {user.lastName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { GenerateSQLQuery };
