"use client";

// ✅ 이 컴포넌트는 Next.js dynamic() + ssr:false 로만 로드됩니다.
// Recharts는 SSR 환경에서 window 크기를 -1로 계산해 앱 전체를 크래시시키기 때문입니다.

import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface ChartData {
    monthName: string;
    scheduled: number;
    published: number;
    manualArticles: number;
    naverArticles: number;
}

interface ReportsChartProps {
    data: ChartData[];
    onBarClick?: (month: string) => void;
}

export default function ReportsChart({ data, onBarClick }: ReportsChartProps) {
    return (
        <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer width="100%" height={400}>
                <ComposedChart
                    data={data}
                    margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                    onClick={(chartData: any) => {
                        if (chartData && chartData.activeLabel && onBarClick) {
                            const month = chartData.activeLabel.replace('월', '');
                            onBarClick(month);
                        }
                    }}
                    style={{ cursor: 'pointer' }}
                >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="monthName" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                    <YAxis
                        yAxisId="left"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12 }}
                        domain={[0, (dataMax: number) => Math.max(dataMax, 5)]}
                        label={{ value: '기사(건)', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fill: '#64748b' }}
                    />
                    <YAxis
                        yAxisId="right"
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12 }}
                        domain={[0, 5]}
                        ticks={[0, 1, 2, 3, 4, 5]}
                        allowDecimals={false}
                        label={{ value: '배포(건)', angle: 90, position: 'insideRight', offset: 10, fontSize: 10, fill: '#64748b' }}
                    />
                    <Tooltip
                        cursor={false}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                        wrapperStyle={{ pointerEvents: 'none' }}
                    />
                    <Legend verticalAlign="top" height={36} />
                    <Bar
                        yAxisId="right"
                        dataKey="scheduled"
                        name="배포 예정"
                        fill="#facc15"
                        radius={[4, 4, 0, 0]}
                        barSize={20}
                        style={{ cursor: 'pointer' }}
                    />
                    <Bar
                        yAxisId="right"
                        dataKey="published"
                        name="배포 완료"
                        fill="#3b82f6"
                        radius={[4, 4, 0, 0]}
                        barSize={20}
                        style={{ cursor: 'pointer' }}
                    />
                    <Line
                        yAxisId="left"
                        type="linear"
                        dataKey="manualArticles"
                        name="뉴스 기사 수"
                        stroke="#18181b"
                        strokeWidth={3}
                        dot={{ r: 6, fill: '#18181b', strokeWidth: 2, stroke: '#fff', cursor: 'pointer' }}
                        activeDot={{ r: 8, strokeWidth: 2, stroke: '#fff', cursor: 'pointer' }}
                        legendType="circle"
                        connectNulls={true}
                        isAnimationActive={false}
                    />
                    <Line
                        yAxisId="left"
                        type="linear"
                        dataKey="naverArticles"
                        name="네이버 뉴스 기사 수"
                        stroke="#16a34a"
                        strokeWidth={3}
                        dot={{ r: 6, fill: '#16a34a', strokeWidth: 2, stroke: '#fff', cursor: 'pointer' }}
                        activeDot={{ r: 8, strokeWidth: 2, stroke: '#fff', cursor: 'pointer' }}
                        legendType="circle"
                        connectNulls={true}
                        isAnimationActive={false}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}
