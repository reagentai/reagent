import { createReagentNode, z } from "@reagentai/reagent/workflow";
import { generateMock } from "@anatine/zod-mock";

const outputSchema = z.object({
  temperature: z.number().max(100),
  unit: z.enum(["celsius", "fahrenheit"]),
  conditions: z.enum([
    "Clear/Sunny",
    "Partly Cloudy",
    "Cloudy",
    "Overcast",
    "Rain",
  ]),
  humidity: z.number().min(0).max(100),
  windSpeed: z.number().max(150),
  feelsLike: z.number().max(100),
});

const GetWeather = createReagentNode({
  id: "@reagentai/react-examples/getWeather",
  name: "Get weather",
  description: `Get the weather info of a city at any given time`,
  version: "0.0.1",
  input: z.object({
    date: z.string().datetime().optional().describe("Date time in ISO string"),
    city: z.string().describe("Name of the city"),
    country: z.string().describe("Name of the country"),
    unit: z.enum(["celsius", "fahrenheit"]),
  }),
  output: outputSchema,
  async *execute(context, input) {
    const randomData = generateMock(outputSchema);
    const weather = {
      ...randomData,
      date: input.date,
      city: input.city,
      country: input.country,
      unit: input.unit,
    };
    context.render(
      "weather",
      (props) => {
        return <Component {...props.data} />;
      },
      { data: weather }
    );

    yield weather;
  },
});

const Component = (props: any) => {
  const currentHour = new Date(props.datetime).getHours();
  const isDayTime = currentHour >= 6 && currentHour < 18;
  return (
    <div className={`${isDayTime ? "" : "dark"}`}>
      <div
        className={`p-6 rounded-lg shadow-lg text-white bg-gradient-to-br from-yellow-100 dark:from-slate-400 via-50% via-blue-300 dark:via-slate-500 to-blue-400 dark:to-slate-600 transition-colors duration-500`}
      >
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-3xl font-bold mb-1 text-slate-600 dark:text-slate-100">
              {props.city}, {props.country}
            </h2>
            <p className="text-xl">{props.condition}</p>
          </div>
          <div className="text-right">
            <p className="text-6xl font-semibold dark:text-slate-200">
              {props.temperature}°C
            </p>
          </div>
        </div>
        <div className="flex justify-around text-lg text-white dark:text-slate-300">
          <div className="flex flex-col items-center">
            <span className="font-semibold">Humidity</span>
            <span>{props.humidity}%</span>
          </div>
          <div className="flex flex-col items-center">
            <span>Wind</span>
            <span>{props.windSpeed} km/h</span>
          </div>
          <div className="flex flex-col items-center">
            <span>Feels Like</span>
            <span>{props.feelsLike}°C</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export { GetWeather };
