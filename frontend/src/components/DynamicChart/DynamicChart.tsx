/**
 * Dynamic Chart Component
 * Reusable chart component with data metric and chart type selection
 */

import React from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { X } from 'lucide-react';

export type ChartType = 'bar' | 'pie' | 'line' | 'donut' | 'area';
export type DataMetric =
  | 'job-status'
  | 'job-success-rate'
  | 'server-os-distribution'
  | 'server-status'
  | 'server-environment';
export type TimeRange = '7days' | '30days' | '3months' | '6months' | '1year' | 'all' | 'custom';

interface DynamicChartProps {
  chartId: string;
  initialMetric: DataMetric;
  initialChartType: ChartType;
  initialTimeRange: TimeRange;
  data: any;
  onRemove: (id: string) => void;
  onMetricChange: (id: string, metric: DataMetric) => void;
  onChartTypeChange: (id: string, type: ChartType) => void;
  onTimeRangeChange: (id: string, timeRange: TimeRange) => void;
}

// Status-specific color mapping to match Job Status Overview (lighter shades)
const STATUS_COLORS: Record<string, string> = {
  'Pending': '#9CA3AF',   // Light Gray
  'Running': '#60A5FA',   // Light Blue/Info
  'Success': '#34D399',   // Light Green
  'Failed': '#F87171',    // Light Red/Error
  'Cancelled': '#FBBF24', // Light Orange/Warning
};

// Helper function to get color by name
const getColorByName = (name: string): string => {
  return STATUS_COLORS[name] || '#8B5CF6'; // Default to primary color
};

const METRIC_LABELS: Record<DataMetric, string> = {
  'job-status': 'Jobs by Status',
  'job-success-rate': 'Job Success Rate',
  'server-os-distribution': 'Server Distribution by OS',
  'server-status': 'Server Status',
  'server-environment': 'Servers by Environment',
};

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '7days': 'Last 7 days',
  '30days': 'Last 30 days',
  '3months': 'Last 3 months',
  '6months': 'Last 6 months',
  '1year': 'Last year',
  'all': 'All time',
};

export const DynamicChart: React.FC<DynamicChartProps> = ({
  chartId,
  initialMetric,
  initialChartType,
  initialTimeRange,
  data,
  onRemove,
  onMetricChange,
  onChartTypeChange,
  onTimeRangeChange,
}) => {
  const [metric, setMetric] = React.useState<DataMetric>(initialMetric);
  const [chartType, setChartType] = React.useState<ChartType>(initialChartType);
  const [timeRange, setTimeRange] = React.useState<TimeRange>(initialTimeRange);

  const handleMetricChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMetric = e.target.value as DataMetric;
    setMetric(newMetric);
    onMetricChange(chartId, newMetric);
  };

  const handleChartTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as ChartType;
    setChartType(newType);
    onChartTypeChange(chartId, newType);
  };

  const handleTimeRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRange = e.target.value as TimeRange;
    setTimeRange(newRange);
    onTimeRangeChange(chartId, newRange);
  };

  const renderChart = () => {
    const chartData = data[metric] || [];

    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <defs>
                <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#667eea" stopOpacity={0.9}/>
                  <stop offset="95%" stopColor="#764ba2" stopOpacity={0.7}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="name" stroke="#666" style={{ fontSize: '12px', fontWeight: 500 }} />
              <YAxis stroke="#666" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                  border: '2px solid #667eea',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }} 
              />
              <Bar 
                dataKey="value" 
                fill="url(#colorBar)" 
                radius={[8, 8, 0, 0]}
                animationDuration={800}
              >
                {chartData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={getColorByName(entry.name)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <defs>
                {chartData.map((entry: any, index: number) => (
                  <radialGradient key={`gradient-${index}`} id={`pieGradient${index}`}>
                    <stop offset="0%" stopColor={getColorByName(entry.name)} stopOpacity={1} />
                    <stop offset="100%" stopColor={getColorByName(entry.name)} stopOpacity={0.7} />
                  </radialGradient>
                ))}
              </defs>
              {/* Shadow layer for 3D effect */}
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="52%"
                outerRadius={95}
                fill="#000000"
                opacity={0.1}
              />
              {/* Main pie with gradient */}
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                labelLine={{ stroke: '#666', strokeWidth: 1 }}
                animationDuration={800}
                animationBegin={0}
              >
                {chartData.map((_: any, index: number) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={`url(#pieGradient${index})`}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                  border: '2px solid #667eea',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }} 
              />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'donut':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <defs>
                {chartData.map((entry: any, index: number) => (
                  <radialGradient key={`donutGradient-${index}`} id={`donutGradient${index}`}>
                    <stop offset="30%" stopColor={getColorByName(entry.name)} stopOpacity={1} />
                    <stop offset="100%" stopColor={getColorByName(entry.name)} stopOpacity={0.6} />
                  </radialGradient>
                ))}
              </defs>
              {/* Bottom shadow layer */}
              <Pie
                data={chartData}
                dataKey="value"
                cx="50%"
                cy="52%"
                innerRadius={58}
                outerRadius={98}
                fill="#000000"
                opacity={0.15}
              />
              {/* Middle shadow layer */}
              <Pie
                data={chartData}
                dataKey="value"
                cx="50%"
                cy="51%"
                innerRadius={59}
                outerRadius={99}
                fill="#000000"
                opacity={0.1}
              />
              {/* Main donut with gradient */}
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                labelLine={{ stroke: '#666', strokeWidth: 1 }}
                animationDuration={800}
                paddingAngle={2}
              >
                {chartData.map((_: any, index: number) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={`url(#donutGradient${index})`}
                    stroke="#fff"
                    strokeWidth={3}
                  />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                  border: '2px solid #667eea',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }} 
              />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <defs>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#667eea" />
                  <stop offset="50%" stopColor="#764ba2" />
                  <stop offset="100%" stopColor="#f093fb" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="name" stroke="#666" style={{ fontSize: '12px', fontWeight: 500 }} />
              <YAxis stroke="#666" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                  border: '2px solid #667eea',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }} 
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="url(#lineGradient)" 
                strokeWidth={4}
                dot={{ fill: '#667eea', r: 6, strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 8, fill: '#764ba2', stroke: '#fff', strokeWidth: 2 }}
                animationDuration={800}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4facfe" stopOpacity={0.9}/>
                  <stop offset="95%" stopColor="#00f2fe" stopOpacity={0.3}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="name" stroke="#666" style={{ fontSize: '12px', fontWeight: 500 }} />
              <YAxis stroke="#666" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                  border: '2px solid #4facfe',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }} 
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#4facfe" 
                strokeWidth={3}
                fill="url(#colorArea)"
                animationDuration={800}
                dot={{ fill: '#4facfe', r: 4, strokeWidth: 2, stroke: '#fff' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 border border-primary-200 rounded-xl shadow-xl p-6 transform transition-all hover:shadow-2xl hover:-translate-y-1" style={{ 
      boxShadow: '0 10px 25px rgba(0,0,0,0.1), 0 6px 12px rgba(102, 126, 234, 0.1)',
      background: 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)'
    }}>
      {/* Chart Header with Controls */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{METRIC_LABELS[metric]}</h3>
        <button
          onClick={() => onRemove(chartId)}
          className="text-gray-400 hover:text-error-500 transition-colors"
          title="Remove chart"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Chart Controls */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Data Metric</label>
          <select
            value={metric}
            onChange={handleMetricChange}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
          >
            <option value="job-status">Jobs by Status</option>
            <option value="job-success-rate">Job Success Rate</option>
            <option value="server-os-distribution">Server Distribution by OS</option>
            <option value="server-status">Server Status</option>
            <option value="server-environment">Servers by Environment</option>
          </select>
        </div>

        <div className="flex-1 min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Chart Type</label>
          <select
            value={chartType}
            onChange={handleChartTypeChange}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
          >
            <option value="bar">Bar Chart</option>
            <option value="pie">Pie Chart</option>
            <option value="line">Line Chart</option>
            <option value="donut">Donut Chart</option>
            <option value="area">Area Chart</option>
          </select>
        </div>

        <div className="flex-1 min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Time Range</label>
          <select
            value={timeRange}
            onChange={handleTimeRangeChange}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
          >
            <option value="7days">Last 7 days</option>
            <option value="30days">Last 30 days</option>
            <option value="3months">Last 3 months</option>
            <option value="6months">Last 6 months</option>
            <option value="1year">Last year</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      {/* Chart Rendering */}
      <div className="mt-4">{renderChart()}</div>
    </div>
  );
};
