import React, { useState, useMemo, useCallback } from 'react';
import {
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Line,
  TooltipProps,
  CartesianGrid,
} from 'recharts';
import { parseISO, format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';
import { UploadCloud } from 'lucide-react';

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
  y: number;
}

interface UniqueMetric {
  id: string;
  color: string;
}

const CustomDot = ({ cx, payload, plotAreaHeight, selectedMetricIds }: any) => {
  const { color, isSolid, metricId } = payload;
  
  const isSelected = selectedMetricIds.includes(metricId);
  // Dim if there's a selection and this metric is not part of it.
  const isDimmed = selectedMetricIds.length > 0 && !isSelected;

  return (
    <line
      x1={cx}
      y1={0}
      x2={cx}
      y2={plotAreaHeight} // Use calculated plot area height to prevent overflow
      stroke={color}
      strokeWidth={isSelected ? 3 : 1.5}
      strokeOpacity={isDimmed ? 0.2 : 1}
      strokeDasharray={isSolid ? undefined : "4 4"}
    />
  );
};

const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ProcessedLine;
    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg">
        <p className="font-bold text-base" style={{ color: data.color }}>{data.label}</p>
        <p className="text-sm text-muted-foreground mt-1">
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
  const [expectedColor, setExpectedColor] = useState<string>('#3b82f6');
  const [actualColor, setActualColor] = useState<string>('#ef4444');
  const [selectedMetricIds, setSelectedMetricIds] = useState<string[]>([]);
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
            description: "Failed to parse CSV file. Please check the format.",
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

      const color = isExpected ? expectedColor : actualColor;
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
  }, [csvData, expectedMetrics, actualMetrics, expectedColor, actualColor]);

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
  const chartMargin = { top: 5, right: 20, left: -10, bottom: 20 };
  const plotAreaHeight = chartHeight - chartMargin.top - chartMargin.bottom;

  const handleLegendClick = (metricId: string) => {
    setSelectedMetricIds(prev => 
      prev.includes(metricId) 
        ? prev.filter(id => id !== metricId)
        : [...prev, metricId]
    );
  };

  return (
    <Card className="w-full mx-auto">
      <CardHeader>
        <CardTitle>Configuration</CardTitle>
        <CardDescription>Upload your data and define the metrics and colors you want to track.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label htmlFor="csv-upload">1. Upload CSV File</Label>
            <Input id="csv-upload" type="file" accept=".csv" onChange={handleFileUpload} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expected-metrics">2. Expected Metric IDs</Label>
            <Textarea id="expected-metrics" placeholder="e.g., metric_A,metric_B" value={expectedMetricsInput} onChange={(e) => setExpectedMetricsInput(e.target.value)} className="min-h-[40px]" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="actual-metrics">3. Actual Metric IDs</Label>
            <Textarea id="actual-metrics" placeholder="e.g., metric_C,metric_D" value={actualMetricsInput} onChange={(e) => setActualMetricsInput(e.target.value)} className="min-h-[40px]" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
            <div className="space-y-2 md:col-start-2">
                <Label htmlFor="expected-color">Expected Metric Color</Label>
                <Input id="expected-color" type="color" value={expectedColor} onChange={(e) => setExpectedColor(e.target.value)} className="p-1 h-10 w-full"/>
            </div>
            <div className="space-y-2">
                <Label htmlFor="actual-color">Actual Metric Color</Label>
                <Input id="actual-color" type="color" value={actualColor} onChange={(e) => setActualColor(e.target.value)} className="p-1 h-10 w-full"/>
            </div>
        </div>
      </CardContent>
      
      <Separator className="my-4" />

      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-4">
            {processedGraphData.length > 0 ? (
              <div style={{ height: `${chartHeight}px`, width: '100%' }}>
                <ResponsiveContainer>
                  <LineChart
                    data={processedGraphData}
                    margin={chartMargin}
                  >
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.5} />
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
                      dot={<CustomDot plotAreaHeight={plotAreaHeight} selectedMetricIds={selectedMetricIds} />}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg" style={{ height: `${chartHeight}px` }}>
                <UploadCloud className="w-16 h-16 mb-4" />
                <p className="text-lg font-medium">Awaiting Data</p>
                <p>Upload a CSV file to begin visualization.</p>
              </div>
            )}
          </div>
          <div className="lg:col-span-1 border-l pl-4">
            <h3 className="font-semibold mb-2 text-lg">Metrics Legend</h3>
            <p className="text-sm text-muted-foreground mb-2">Click to select/deselect.</p>
            <div className="max-h-[580px] overflow-y-auto pr-2">
              <ul>
                {uniqueMetrics.map((metric) => (
                  <li
                    key={metric.id}
                    className={cn(
                      "flex items-center p-2 rounded-md cursor-pointer transition-colors",
                      selectedMetricIds.includes(metric.id) && "bg-accent"
                    )}
                    onClick={() => handleLegendClick(metric.id)}
                  >
                    <span
                      className="w-3 h-3 rounded-full mr-3 shrink-0"
                      style={{ backgroundColor: metric.color }}
                    ></span>
                    <span className="truncate text-sm font-medium">{metric.id}</span>
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