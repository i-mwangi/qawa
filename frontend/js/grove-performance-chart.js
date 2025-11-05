/**
 * Grove Performance Chart
 * Interactive chart showing harvest performance over time
 * Similar to crypto charts on Kraken/Binance
 */

class GrovePerformanceChart {
    constructor(canvasId, data) {
        this.canvasId = canvasId;
        this.data = data;
        this.chart = null;
    }

    render() {
        const canvas = document.getElementById(this.canvasId);
        if (!canvas) {
            console.error('Canvas not found:', this.canvasId);
            return;
        }

        const ctx = canvas.getContext('2d');

        // Prepare data for chart
        const labels = this.data.harvests.map((h, i) => {
            const date = new Date(h.harvestDate * 1000);
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        });

        const revenueData = this.data.harvests.map(h => h.totalRevenue);
        const qualityData = this.data.harvests.map(h => h.qualityGrade);
        const yieldData = this.data.harvests.map(h => h.yieldKg);

        // Create gradient for revenue line
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(75, 192, 192, 0.4)');
        gradient.addColorStop(1, 'rgba(75, 192, 192, 0.0)');

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Revenue ($)',
                        data: revenueData,
                        borderColor: 'rgb(75, 192, 192)',
                        backgroundColor: gradient,
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        pointBackgroundColor: 'rgb(75, 192, 192)',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Quality Score',
                        data: qualityData,
                        borderColor: 'rgb(255, 159, 64)',
                        backgroundColor: 'rgba(255, 159, 64, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        pointBackgroundColor: 'rgb(255, 159, 64)',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        yAxisID: 'y1',
                        hidden: true // Hidden by default
                    },
                    {
                        label: 'Yield (kg)',
                        data: yieldData,
                        borderColor: 'rgb(153, 102, 255)',
                        backgroundColor: 'rgba(153, 102, 255, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        pointBackgroundColor: 'rgb(153, 102, 255)',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        yAxisID: 'y2',
                        hidden: true // Hidden by default
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: {
                                size: 12,
                                weight: '500'
                            }
                        },
                        onClick: (e, legendItem, legend) => {
                            const index = legendItem.datasetIndex;
                            const ci = legend.chart;
                            const meta = ci.getDatasetMeta(index);
                            meta.hidden = meta.hidden === null ? !ci.data.datasets[index].hidden : null;
                            ci.update();
                        }
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    if (context.datasetIndex === 0) {
                                        label += '$' + context.parsed.y.toLocaleString();
                                    } else if (context.datasetIndex === 1) {
                                        label += context.parsed.y + '/100';
                                    } else {
                                        label += context.parsed.y.toLocaleString() + ' kg';
                                    }
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                size: 11
                            }
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Revenue ($)',
                            font: {
                                size: 12,
                                weight: '600'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: false,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Quality Score',
                            font: {
                                size: 12,
                                weight: '600'
                            }
                        },
                        min: 0,
                        max: 100,
                        grid: {
                            drawOnChartArea: false
                        }
                    },
                    y2: {
                        type: 'linear',
                        display: false,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Yield (kg)',
                            font: {
                                size: 12,
                                weight: '600'
                            }
                        },
                        grid: {
                            drawOnChartArea: false
                        },
                        ticks: {
                            callback: function(value) {
                                return value.toLocaleString() + ' kg';
                            }
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeInOutQuart'
                }
            }
        });
    }

    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
}

// Export for use in other modules
window.GrovePerformanceChart = GrovePerformanceChart;
