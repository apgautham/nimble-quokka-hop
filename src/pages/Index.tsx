import { MadeWithDyad } from "@/components/made-with-dyad";
import MetricGraph from "@/components/MetricGraph";

const Index = () => {
  return (
    <main className="min-h-screen w-full bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100">Metric Visualization App</h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          Upload your metric data and visualize events.
        </p>
      </div>
      <MetricGraph />
      <MadeWithDyad />
    </main>
  );
};

export default Index;