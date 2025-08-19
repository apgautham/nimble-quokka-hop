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

const CustomDot = ({ cx, cy, payload, plotAreaHeight, selectedMetricIds, hoveredMetricId }: any) => {
  const { color, isSolid, metricId } = payload;

  const isClicked = selectedMetricIds.includes(metricId);
  const isHovered = hoveredMetricId === metricId;
  const isActive = isClicked || isHovered;
  
  const isFilteredView = selectedMetricIds.length > 0 || hoveredMetricId !== null;
  const isDimmed = isFilteredView && !isActive;

  // The 'cy' prop gives the y-coordinate of the data point on the chart.
  // We draw the line from the top of the plot area down to this point.
  return (
    <line
      x1={cx}
      y1={0}
      x2={cx}
      y2={cy} // Draw line down to the y-coordinate of the data point (which is on the x-axis)
      stroke={color}
      strokeWidth={isActive ? 3 : 1.5}
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
  const [noiseMetricsInput, setNoiseMetricsInput] = useState<string>(''); // New state
  const [missingMetricsInput, setMissingMetricsInput] = useState<string>(''); // New state

  const [expectedColor, setExpectedColor] = useState<string>('#3b82f6');
  const [actualColor, setActualColor] = useState<string>('#ef4444');
  const [noiseColor, setNoiseColor] = useState<string>('#f59e0b'); // New state
  const [missingColor, setMissingColor] = useState<string>('#6b7280'); // New state

  const [selectedMetricIds, setSelectedMetricIds] = useState<string[]>([]);
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

  const noiseMetrics = useMemo(() => { // New memoized set
    return new Set(noiseMetricsInput.split(',').map(s => s.trim()).filter(Boolean));
  }, [noiseMetricsInput]);

  const missingMetrics = useMemo(() => { // New memoized set
    return new Set(missingMetricsInput.split(',').map(s => s.trim()).filter(Boolean));
  }, [missingMetricsInput]);

  const { processedGraphData, uniqueMetrics } = useMemo(() => {
    const metricMap = new Map<string, Date[]>();
    const allCsvMetricIds = new Set<string>(); // To track all metric IDs present in CSV

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
      allCsvMetricIds.add(item.METRICID);
    });

    const graphElements: ProcessedLine[] = [];
    const uniqueMetricsSet = new Map<string, UniqueMetric>();

    // Process metrics found in CSV data
    metricMap.forEach((timestamps, metricId) => {
      timestamps.sort((a, b) => a.getTime() - b.getTime());

      let color = '';
      let baseLabel = '';

      // Determine category precedence: Expected > Actual > Missing (if found in CSV) > Noise
      if (expectedMetrics.has(metricId)) {
        color = expectedColor;
        baseLabel = `Expected: ${metricId}`;
      } else if (actualMetrics.has(metricId)) {
        color = actualColor;
        baseLabel = `Actual: ${metricId}`;
      } else if (missingMetrics.has(metricId)) { // If a "missing" metric is actually found in CSV
        color = missingColor;
        baseLabel = `Missing (Found): ${metricId}`;
      } else if (noiseMetrics.has(metricId)) {
        color = noiseColor;
        baseLabel = `Noise: ${metricId}`;
      } else {
        // If a metric is in CSV but not in any defined category, skip it for now
        return;
      }
      
      if (!uniqueMetricsSet.has(metricId)) {
        uniqueMetricsSet.set(metricId, { id: metricId, color });
      }

      if (timestamps.length === 1) {
        graphElements.push({ metricId, timestamp: timestamps[0], color, label: baseLabel, isSolid: false, y: 0 });
      } else if (timestamps.length >= 2) {
        if (timestamps.length > 2) {
          console.warn(`METRICID ${metricId} has ${timestamps.length} timestamps. Using oldest and latest.`);
        }
        const oldest = timestamps[0];
        const latest = timestamps[timestamps.length - 1];
        graphElements.push({ metricId, timestamp: oldest, color, label: `${baseLabel} (start)`, isSolid: false, y: 0 });
        graphElements.push({ metricId, timestamp: latest, color, label: `${baseLabel} (end)`, isSolid: true, y: 0 });
      }
    });

    // Add "truly missing" metrics (those in missingMetricsInput but NOT in csvData)
    missingMetrics.forEach(metricId => {
      if (!allCsvMetricIds.has(metricId)) {
        // For truly missing metrics, we can't plot them on the timeline.
        // We'll just add them to uniqueMetricsSet for the legend.
        if (!uniqueMetricsSet.has(metricId)) {
          uniqueMetricsSet.set(metricId, { id: metricId, color: missingColor });
        }
      }
    });
    
    graphElements.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
      processedGraphData: graphElements,
      uniqueMetrics: Array.from(uniqueMetricsSet.values()).sort((a, b) => a.id.localeCompare(b.id)),
    };
  }, [csvData, expectedMetrics, actualMetrics, noiseMetrics, missingMetrics, expectedColor, actualColor, noiseColor, missingColor]);

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
  const chartMargin = { top: 20, right: 20, left: -10, bottom: 40 };

  const handleLegendClick = (metricId: string) => {
    setSelectedMetricIds(prev => 
      prev.includes(metricId) 
        ? prev.filter(id => id !== metricId)
        : [...prev, metricId]
    );
  };

  const handleChartMouseMove = (e: any) => {
    if (e && e.activePayload && e.activePayload.length > 0) {
      const metricId = e.activePayload[0].payload.metricId;
      if (hoveredMetricId !== metricId) {
        setHoveredMetricId(metricId);
      }
    } else {
      if (hoveredMetricId !== null) {
        setHoveredMetricId(null);
      }
    }
  };

  const handleChartMouseLeave = () => {
    setHoveredMetricId(null);
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
            <div className="space-y-2">
                <Label htmlFor="noise-metrics">4. Noise Metric IDs</Label>
                <Textarea id="noise-metrics" placeholder="e.g., metric_E,metric_F" value={noiseMetricsInput} onChange={(e) => setNoiseMetricsInput(e.target.value)} className="min-h-[40px]" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="missing-metrics">5. Missing Metric IDs</Label>
                <Textarea id="missing-metrics" placeholder="e.g., metric_G,metric_H" value={missingMetricsInput} onChange={(e) => setMissingMetricsInput(e.target.value)} className="min-h-[40px]" />
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-4">
            <div className="space-y-2">
                <Label htmlFor="expected-color">Expected Metric Color</Label>
                <Input id="expected-color" type="color" value={expectedColor} onChange={(e) => setExpectedColor(e.target.value)} className="p-1 h-10 w-full"/>
            </div>
            <div className="space-y-2">
                <Label htmlFor="actual-color">Actual Metric Color</Label>
                <Input id="actual-color" type="color" value={actualColor} onChange={(e) => setActualColor(e.target.value)} className="p-1 h-10 w-full"/>
            </div>
            <div className="space-y-2">
                <Label htmlFor="noise-color">Noise Metric Color</Label>
                <Input id="noise-color" type="color" value={noiseColor} onChange={(e) => setNoiseColor(e.target.value)} className="p-1 h-10 w-full"/>
            </div>
            <div className="space-y-2">
                <Label htmlFor="missing-color">Missing Metric Color</Label>
                <Input id="missing-color" type="color" value={missingColor} onChange={(e) => setMissingColor(e.target.value)} className="p-1 h-10 w-full"/>
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
                    onMouseMove={handleChartMouseMove}
                    onMouseLeave={handleChartMouseLeave}
                  >
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.5} />
                    <XAxis
                      type="number"
                      dataKey={(d) => d.timestamp.getTime()}
                      domain={chartDomain}
                      tickFormatter={formatXAxisTick}
                      scale="time"
                      name="Time"
                      label={{ value: 'Time', position: 'insideBottom', offset: -20 }}
                      axisLine={{ transform: 'translate(0, 10)' }}
                      tickLine={{ transform: 'translate(0, 10)' }}
                    />
                    <YAxis domain={[-0.1, 1]} hide />
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
                      dot={<CustomDot selectedMetricIds={selectedMetricIds} hoveredMetricId={hoveredMetricId} />}
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
            <p className="text-sm text-muted-foreground mb-2">Click to select, hover to highlight.</p>
            <div className="max-h-[580px] overflow-y-auto pr-2">
              <ul>
                {uniqueMetrics.map((metric) => (
                  <li
                    key={metric.id}
                    className={cn(
                      "flex items-center p-2 rounded-md cursor-pointer transition-colors",
                      selectedMetricIds.includes(metric.id) && "bg-accent",
                      hoveredMetricId === metric.id && "bg-accent"
                    )}
                    onClick={() => handleLegendClick(metric.id)}
                    onMouseEnter={() => setHoveredMetricId(metric.id)}
                    onMouseLeave={() => setHoveredMetricId(null)}
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