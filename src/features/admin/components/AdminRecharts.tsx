"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type AnalyticsPoint = {
  label: string;
  enquiries: number;
  converted: number;
};

type PieSegment = {
  label: string;
  value: number;
  color: string;
};

const tooltipStyle = {
  borderRadius: 8,
  borderColor: "#d7c5ad",
  color: "#071739",
  fontWeight: 800,
};

const axisTick = { fill: "#a68768", fontSize: 12, fontWeight: 800 };

export function EnquiryBarChart({ data }: { data: AnalyticsPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ left: -18, right: 8, top: 10 }}>
        <CartesianGrid stroke="#ead7bd" strokeDasharray="4 4" vertical={false} />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisTick} />
        <YAxis axisLine={false} tickLine={false} tick={axisTick} />
        <Tooltip
          cursor={{ fill: "rgba(194,232,255,0.28)" }}
          contentStyle={tooltipStyle}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, fontWeight: 800 }} />
        <Bar
          dataKey="enquiries"
          name="Enquiries"
          radius={[6, 6, 0, 0]}
          fill="#123f76"
        />
        <Bar
          dataKey="converted"
          name="Converted"
          radius={[6, 6, 0, 0]}
          fill="#e3c39d"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ConversionAreaChart({ data }: { data: AnalyticsPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ left: -18, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="adminConversions" x1="0" x2="0" y1="0" y2="1">
            <stop offset="5%" stopColor="#123f76" stopOpacity={0.32} />
            <stop offset="95%" stopColor="#c2e8ff" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#ead7bd" strokeDasharray="4 4" vertical={false} />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisTick} />
        <YAxis axisLine={false} tickLine={false} tick={axisTick} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area
          type="monotone"
          dataKey="converted"
          name="Converted"
          stroke="#123f76"
          strokeWidth={3}
          fill="url(#adminConversions)"
          activeDot={{
            r: 5,
            fill: "#e3c39d",
            stroke: "#071739",
            strokeWidth: 2,
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function StatusPieChart({ data }: { data: PieSegment[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip contentStyle={tooltipStyle} />
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius={68}
          outerRadius={104}
          paddingAngle={3}
          cornerRadius={5}
        >
          {data.map((segment) => (
            <Cell key={segment.label} fill={segment.color} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
