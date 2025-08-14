import { MadeWithDyad } from "@/components/made-with-dyad";
import MetricGraph from "@/components/MetricGraph";
import { BarChart3 } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen w-full p-4 sm:p-6 lg:p-8 flex flex-col">
      <header className="text-center mb-8">
        <div className="inline-flex items-center gap-3">
          <BarChart3 className="h-10 w-10 text-primary" />
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
            Metric Visualizer
          </h1>
        </div>
        <p className="text-lg text-gray-600 dark:text-gray-400 mt-2">
          Upload your metric data to visualize events and analyze timelines.
        </p>
      </header>
      <main className="flex-grow">
        <MetricGraph />
      </main>
      <MadeWithDyad />
    </div>
  );
};

export default Index;