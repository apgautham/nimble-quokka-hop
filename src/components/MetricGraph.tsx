import React, { useState, useMemo, useCallback } from 'react';
import {
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Line,
  TooltipProps,
} from 'recharts';
import { parseISO, format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface MetricData {
  METRICID: string;
  TIMESTAMP: string;
}

interface ProcessedLine {
  metricId: string;
  timestamp: Date;
  color: string;
  label: string;
  isSolid: boolean;
  y: number; // Added for plotting on the LineChart
}

interface UniqueMetric {
  id: string;
  color: string;
}

// Custom Dot renderer for the vertical lines
const CustomDot = ({ cx, payload, chartHeight, hoveredMetricId }: any) => {
  const { color, isSolid, metricId } = payload;
  const isHovered = hoveredMetricId === metricId;
  const isDimmed = hoveredMetricId && !isHovered;

  return (
    <line
      x1={cx}
      y1={0}
      x2={cx}
      y2={chartHeight}
      stroke={color}
      strokeWidth={isHovered ? 3 : 1.5}
      strokeOpacity={isDimmed ? 0.2 : 1}
      strokeDasharray={isSolid ? undefined : "4 4"}
    />
  );
};

// Custom Tooltip
const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ProcessedLine;
    return (
      <div className="bg-background border rounded-md p-2 shadow-lg">
        <p className="font-bold" style={{ color: data.color }}>{data.label}</p>
        <p className="text-sm text-muted-foreground">
          {format(data.timestamp, 'yyyy-MM-dd HH:mm:ss.SSS')}
        </p>
      </div>
    );
  }
  return null;
};

const MetricGraph: React.FC = () => {
  const [csvData, setCsvData] = useState<MetricData[]>([]);
  const [expectedMetricsInput, setExpectedMetricsInput] = useState<string>('');
  const [actualMetricsInput, setActualMetricsInput] = useState<string>('');
  const [hoveredMetricId, setHoveredMetricId] = useState<string | null>(null);
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

  const { processedGraphData, uniqueMetrics } = useMemo(() => {
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

    const graphElements: ProcessedLine[] = [];
    const uniqueMetricsSet = new Map<string, UniqueMetric>();

    metricMap.forEach((timestamps, metricId) => {
      timestamps.sort((a, b) => a.getTime() - b.getTime());

      const isExpected = expectedMetrics.has(metricId);
      const isActual = actualMetrics.has(metricId);

      if (!isExpected && !isActual) return;

      const color = isExpected ? 'hsl(var(--sidebar-ring))' : 'hsl(var(--destructive))';
      const baseLabel = isExpected ? `Expected: ${metricId}` : `Actual: ${metricId}`;
      
      if (!uniqueMetricsSet.has(metricId)) {
        uniqueMetricsSet.set(metricId, { id: metricId, color });
      }

      if (timestamps.length === 1) {
        graphElements.push({ metricId, timestamp: timestamps[0], color, label: baseLabel, isSolid: false, y: 0.5 });
      } else if (timestamps.length >= 2) {
        if (timestamps.length > 2) {
          console.warn(`METRICID ${metricId} has ${timestamps.length} timestamps. Using oldest and latest.`);
        }
        const oldest = timestamps[0];
        const latest = timestamps[timestamps.length - 1];
        graphElements.push({ metricId, timestamp: oldest, color, label: `${baseLabel} (start)`, isSolid: false, y: 0.5 });
        graphElements.push({ metricId, timestamp: latest, color, label: `${baseLabel} (end)`, isSolid: true, y: 0.5 });
      }
    });
    
    graphElements.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
      processedGraphData: graphElements,
      uniqueMetrics: Array.from(uniqueMetricsSet.values()),
    };
  }, [csvData, expectedMetrics, actualMetrics]);

  const chartDomain = useMemo(() => {
    if (processedGraphData.length === 0) return [0, 1];
    const allTimestamps = processedGraphData.map(p => p.timestamp.getTime());
    const minTime = Math.min(...allTimestamps);
    const maxTime = Math.max(...allTimestamps);
    const padding = (maxTime - minTime) * 0.05 || 10000;
    return [minTime - padding, maxTime + padding];
  }, [processedGraphData]);

  const formatXAxisTick = useCallback((tickItem: number) => format(new Date(tickItem), 'HH:mm:ss'), []);

  const chartHeight = 600;

  return (
    <Card className="w-full max-w-7xl mx-auto my-8">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">Metric Visualization Graph</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="md:col-span-1">
            <Label htmlFor="csv-upload" className="mb-2 block">Upload CSV File (METRICID, TIMESTAMP)</Label>
            <Input id="csv-upload" type="file" accept=".csv" onChange={handleFileUpload} />
          </div>
          <div className="md:col-span-1">
            <Label htmlFor="expected-metrics" className="mb-2 block">Expected Metric IDs (comma-separated)</Label>
            <Textarea id="expected-metrics" placeholder="metric_A,metric_B" value={expectedMetricsInput} onChange={(e) => setExpectedMetricsInput(e.target.value)} className="min-h-[60px]" />
          </div>
          <div className="md:col-span-1">
            <Label htmlFor="actual-metrics" className="mb-2 block">Actual Metric IDs (comma-separated)</Label>
            <Textarea id="actual-metrics" placeholder="metric_C,metric_D" value={actualMetricsInput} onChange={(e) => setActualMetricsInput(e.target.value)} className="min-h-[60px]" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="md:col-span-4">
            {csvData.length > 0 ? (
              <div style={{ height: `${chartHeight}px`, width: '100%' }}>
                <ResponsiveContainer>
                  <LineChart
                    data={processedGraphData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    onMouseLeave={() => setHoveredMetricId(null)}
                  >
                    <XAxis
                      type="number"
                      dataKey={(d) => d.timestamp.getTime()}
                      domain={chartDomain}
                      tickFormatter={formatXAxisTick}
                      scale="time"
                      name="Time"
                      label={{ value: 'Time', position: 'insideBottom', offset: -10 }}
                    />
                    <YAxis domain={[0, 1]} hide />
                    <Tooltip
                      content={<CustomTooltip />}
                      cursor={false}
                      position={{ y: 0 }}
                      isAnimationActive={false}
                    />
                    <Line
                      dataKey="y"
                      stroke="transparent"
                      isAnimationActive={false}
                      dot={<CustomDot chartHeight={chartHeight} hoveredMetricId={hoveredMetricId} />}
                      activeDot={(props: any) => {
                        if (props.payload.metricId !== hoveredMetricId) {
                          setHoveredMetricId(props.payload.metricId);
                        }
                        return <CustomDot {...props} chartHeight={chartHeight} hoveredMetricId={props.payload.metricId} />;
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center text-gray-500" style={{ height: `${chartHeight}px` }}>
                <p>Upload a CSV file and define metrics to visualize.</p>
              </div>
            )}
          </div>
          <div className="md:col-span-1 border-l pl-4">
            <h3 className="font-semibold mb-2">Metrics Legend</h3>
            <div className="max-h-[580px] overflow-y-auto">
              <ul>
                {uniqueMetrics.map((metric) => (
                  <li
                    key={metric.id}
                    className={cn(
                      "flex items-center p-2 rounded-md cursor-pointer transition-colors",
                      hoveredMetricId === metric.id && "bg-accent"
                    )}
                    onMouseEnter={() => setHoveredMetricId(metric.id)}
                    onMouseLeave={() => setHoveredMetricId(null)}
                  >
                    <span
                      className="w-3 h-3 rounded-full mr-2 inline-block"
                      style={{ backgroundColor: metric.color }}
                    ></span>
                    <span className="truncate text-sm">{metric.id}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MetricGraph;