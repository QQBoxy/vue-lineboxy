<script setup lang="ts">
import { computed } from 'vue';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'vue-chartjs';
import type { TrendData } from '@/services/workout/trend';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

interface Props {
  data: TrendData;
  metric: 'reps' | 'weight' | 'duration';
  title: string;
}

const props = defineProps<Props>();

const chartData = computed(() => {
  const dates = Array.from(
    new Set([
      ...props.data.points.map((p) => p.date),
      ...props.data.repsSpecs.map((s) => s.date),
      ...props.data.weightSpecs.map((s) => s.date),
      ...props.data.durationSpecs.map((s) => s.date),
    ]),
  ).sort();

  const specs =
    props.metric === 'reps'
      ? props.data.repsSpecs
      : props.metric === 'weight'
        ? props.data.weightSpecs
        : props.data.durationSpecs;

  // The actual points
  const pointData = dates.map((d) => {
    const pt = props.data.points.find((p) => p.date === d);
    if (!pt) return null;
    return props.metric === 'reps'
      ? pt.reps
      : props.metric === 'weight'
        ? pt.weightKg
        : pt.durationSeconds;
  });

  const pointStyles = dates.map((d) => {
    const pt = props.data.points.find((p) => p.date === d);
    return pt?.isSpec ? 'rect' : 'circle';
  });

  const pointBackgrounds = dates.map((d) => {
    const pt = props.data.points.find((p) => p.date === d);
    return pt?.isSpec ? 'transparent' : '#0f766e'; // hollow for spec, solid for actual
  });

  // Background spec band (min and max)
  const specMinData = dates.map((d) => {
    const s = specs.find((spec) => spec.date === d);
    return s ? s.min : null;
  });

  const specMaxData = dates.map((d) => {
    const s = specs.find((spec) => spec.date === d);
    return s ? (s.max ?? s.min) : null;
  });

  return {
    labels: dates.map((d) => d.slice(5)), // MM-DD
    datasets: [
      {
        label: '最高要求 (Spec Max)',
        data: specMaxData,
        borderColor: 'transparent',
        backgroundColor: 'transparent',
        pointRadius: 0,
        fill: false,
      },
      {
        label: '最低要求 (Spec Min)',
        data: specMinData,
        borderColor: 'transparent',
        backgroundColor: 'rgba(20, 184, 166, 0.1)', // Shaded area
        pointRadius: 0,
        fill: '-1', // Fill to previous dataset (Spec Max)
      },
      {
        label: props.title,
        data: pointData,
        borderColor: '#0f766e',
        backgroundColor: pointBackgrounds,
        pointStyle: pointStyles,
        pointBorderColor: '#0f766e',
        pointBorderWidth: 2,
        pointRadius: 5,
        fill: false,
        tension: 0.2, // slight curve
      },
    ],
  };
});

const chartOptions = computed(() => {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
      },
    },
    plugins: {
      legend: {
        display: false, // Hide the legend for cleaner look, tooltip will show info
      },
      title: {
        display: true,
        text: props.title,
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y;
            }
            // Check if it's the actual points dataset and if it's a spec
            if (context.datasetIndex === 2) {
              const date = context.chart.data.labels[context.dataIndex];
              const pt = props.data.points.find((p) => p.date.endsWith(date));
              if (pt && pt.isSpec) {
                label += ' (照表完成)';
              } else {
                label += ' (實際輸入)';
              }
            }
            return label;
          },
        },
      },
    },
  };
});
</script>

<template>
  <div class="trend-chart-container">
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>

<style scoped>
.trend-chart-container {
  width: 100%;
  height: 250px;
  position: relative;
}
</style>
