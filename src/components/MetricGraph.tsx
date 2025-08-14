import React, { useState, useMemo, useCallback } from 'react';
import {
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import { parseISO, format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface MetricData {
  METRICID: string;
  TIMESTAMP: string;
}

interface ProcessedMetric {
  metricId: string;
  timestamps: Date[];
  type: 'line' | 'area';
  color: string;
  label: string;
}

const MetricGraph: React.FC = () => {
  const [csvData, setCsvData] = useState<MetricData[]>([]);
  const [expectedMetricsInput, setExpectedMetricsInput] = useState<string>('');
  const [actualMetricsInput, setActualMetricsInput] = useState<string>('');
  const { toast } = useToast();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        try {
          const parsed = parseCsv(text);
          setCsvData(parsed);
          toast({
            title: "CSV Uploaded",
            description: "Metric data loaded successfully.",
          });
        } catch (error) {
          console.error("Error parsing CSV:", error);
          toast({
            title: "Error",
            description: "Failed to parse CSV file. Please check the format. Ensure 'METRICID' and 'TIMESTAMP' columns exist.",
            variant: "destructive",
          });
        }
      };
      reader.readAsText(file);
    }
  };

  const parseCsv = (csvString: string): MetricData[] => {
    const lines = csvString.trim().split('\n');
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const metricIdIndex = headers.indexOf('METRICID');
    const timestampIndex = headers.indexOf('TIMESTAMP');

    if (metricIdIndex === -1 || timestampIndex === -1) {
      throw new Error("CSV must contain 'METRICID' and 'TIMESTAMP' columns.");
    }

    const data: MetricData[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length > Math.max(metricIdIndex, timestampIndex)) {
        data.push({
          METRICID: values[metricIdIndex],
          TIMESTAMP: values[timestampIndex],
        });
      }
    }
    return data;
  };

  const expectedMetrics = useMemo(() => {
    return new Set(expectedMetricsInput.split(',').map(s => s.trim()).filter(Boolean));
  }, [expectedMetricsInput]);

  const actualMetrics = useMemo(() => {
    return new Set(actualMetricsInput.split(',').map(s => s.trim()).filter(Boolean));
  }, [actualMetricsInput]);

  const processedGraphData = useMemo(() => {
    const metricMap = new Map<string, Date[]>();

    csvData.forEach(item => {
      const timestamp = parseISO(item.TIMESTAMP);
      if (isNaN(timestamp.getTime())) {
        console.warn(`Invalid timestamp for METRICID ${item.METRICID}: ${item.TIMESTAMP}`);
        return;
      }
      if (!metricMap.has(item.METRICID)) {
        metricMap.set(item.METRICID, []);
      }
      metricMap.get(item.METRICID)?.push(timestamp);
    });

    const graphElements: ProcessedMetric[] = [];

    metricMap.forEach((timestamps, metricId) => {
      timestamps.sort((a, b) => a.getTime() - b.getTime());

      const isExpected = expectedMetrics.has(metricId);
      const isActual = actualMetrics.has(metricId);

      if (!isExpected && !isActual) {
        return;
      }

      const color = isExpected ? 'hsl(var(--sidebar-ring))' : 'hsl(var(--destructive))';
      const label = isExpected ? `Expected: ${metricId}` : `Actual: ${metricId}`;

      if (timestamps.length === 1) {
        graphElements.push({
          metricId,
          timestamps,
          type: 'line',
          color,
          label,
        });
      } else if (timestamps.length === 2) {
        graphElements.push({
          metricId,
          timestamps,
          type: 'area',
          color,
          label,
        });
      } else {
        console.warn(`METRICID ${metricId} has ${timestamps.length} timestamps. Only 1 or 2 are supported.`);
      }
    });

    return graphElements;
  }, [csvData, expectedMetrics, actualMetrics]);

  const chartDomain = useMemo(() => {
    if (processedGraphData.length === 0) return [0, 1];

    const allTimestamps = processedGraphData.flatMap(p => p.timestamps);
    if (allTimestamps.length === 0) return [0, 1];

    const minTime = Math.min(...allTimestamps.map(ts => ts.getTime()));
    const maxTime = Math.max(...allTimestamps.map(ts => ts.getTime()));

    const padding = (maxTime - minTime) * 0.05;
    return [minTime - padding, maxTime + padding];
  }, [processedGraphData]);

  const formatXAxisTick = useCallback((tickItem: number) => {
    return format(new Date(tickItem), 'HH:mm:ss');
  }, []);

  return (
    <Card className="w-full max-w-4xl mx-auto my-8">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">Metric Visualization Graph</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <Label htmlFor="csv-upload" className="mb-2 block">Upload CSV File (METRICID, TIMESTAMP)</Label>
            <Input id="csv-upload" type="file" accept=".csv" onChange={handleFileUpload} />
          </div>
          <div>
            <Label htmlFor="expected-metrics" className="mb-2 block">Expected Metric IDs (comma-separated)</Label>
            <Textarea
              id="expected-metrics"
              placeholder="metric_A,metric_B"
              value={expectedMetricsInput}
              onChange={(e) => setExpectedMetricsInput(e.target.value)}
              className="min-h-[60px]"
            />
          </div>
          <div>
            <Label htmlFor="actual-metrics" className="mb-2 block">Actual Metric IDs (comma-separated)</Label>
            <Textarea
              id="actual-metrics"
              placeholder="metric_C,metric_D"
              value={actualMetricsInput}
              onChange={(e) => setActualMetricsInput(e.target.value)}
              className="min-h-[60px]"
            />
          </div>
        </div>

        <div className="mb-4 text-center text-sm">
          <span className="font-semibold">Legend: </span>
          <span className="text-[hsl(var(--sidebar-ring))] mr-4">Expected Metrics (Blue)</span>
          <span className="text-[hsl(var(--destructive))]">Actual Metrics (Red)</span>
        </div>

        {csvData.length > 0 ? (
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <XAxis
                  type="number"
                  dataKey="timestamp"
                  domain={chartDomain}
                  tickFormatter={formatXAxisTick}
                  scale="time"
                  label={{ value: 'Time', position: 'insideBottom', offset: -3 }}
                />
                <YAxis
                  type="number"
                  domain={[0, 1]}
                  ticks={[0, 1]}
                  label={{ value: 'Value', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  labelFormatter={(label) => format(new Date(label), 'yyyy-MM-dd HH:mm:ss')}
                  formatter={(value, name, props) => [`${props.payload.label}`, name]}
                />

                {processedGraphData.map((metric, index) => {
                  if (metric.type === 'line') {
                    return (
                      <ReferenceLine
                        key={`line-${metric.metricId}-${index}`}
                        x={metric.timestamps[0].getTime()}
                        stroke={metric.color}
                        strokeDasharray="3 3"
                        label={{ value: metric.label, position: 'top', fill: metric.color, fontSize: 12 }}
                      />
                    );
                  } else if (metric.type === 'area') {
                    return (
                      <ReferenceArea
                        key={`area-${metric.metricId}-${index}`}
                        x1={metric.timestamps[0].getTime()}
                        x2={metric.timestamps[1].getTime()}
                        y1={0}
                        y2={1}
                        fill={metric.color}
                        fillOpacity={0.3}
                        stroke={metric.color}
                        strokeOpacity={0.8}
                        label={{ value: metric.label, position: 'top', fill: metric.color, fontSize: 12 }}
                      />
                    );
                  }
                  return null;
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-center text-gray-500">Upload a CSV file to visualize metrics.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default MetricGraph;