import React from "react";
import { createAgentNode, z } from "@portal/reagent/agent";

const GetWeather = createAgentNode({
  id: "@portal/demo-agents/getWeather",
  name: "Get weather",
  description: `Get the weather info of a city at any given time. Current date time is ${new Date().toISOString()}`,
  version: "0.0.1",
  input: z.object({
    date: z.string().datetime().optional().describe("Date time in ISO string"),
    city: z.string(),
    country: z.string(),
    unit: z.enum(["celsius", "fahrenheit"]),
  }),
  output: z.object({
    temperature: z.number(),
    unit: z.enum(["celsius", "fahrenheit"]),
  }),
  async *execute(context, input) {
    const weather = {
      temperature: Math.floor(Math.random() * 50),
      unit: input.unit,
    };
    context.render(
      (props) => {
        return (
          <div>
            <div>Temperature: {props.data.weather.temperature}</div>
          </div>
        );
      },
      {
        weather,
      }
    );

    yield weather;
  },
});

export { GetWeather };
