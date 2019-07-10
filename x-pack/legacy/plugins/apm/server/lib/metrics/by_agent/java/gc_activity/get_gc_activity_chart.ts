import { Setup } from '../../../../helpers/setup_request';
import {
  PROCESSOR_EVENT,
  SERVICE_NAME,
  SERVICE_AGENT_NAME
} from '../../../../../../common/elasticsearch_fieldnames';
import { rangeFilter } from '../../../../helpers/range_filter';
import { ChartBase } from '../../../types';
import { AggregationSearchResponse, AggregatedValue } from 'elasticsearch';
import { colors } from '../../../transform_metrics_chart';
import { i18n } from '@kbn/i18n';
import theme from '@elastic/eui/dist/eui_theme_light.json';
import { getMetricsDateHistogramParams } from '../../../../helpers/metrics';

const series = {
  gcCountAvg: {
    title: i18n.translate('xpack.apm.agentMetrics.java.gcCountAvg', {
      defaultMessage: 'Avg GC events/min'
    }),
    color: theme.euiColorVis0
  },
  gcCountMax: {
    title: i18n.translate('xpack.apm.agentMetrics.java.gcCountMax', {
      defaultMessage: 'Max GC events/min'
    }),
    color: theme.euiColorVis1
  }
};

const chartBase: ChartBase = {
  title: i18n.translate('xpack.apm.agentMetrics.java.gcCountChartTitle', {
    defaultMessage: 'Garbage Collections per minute'
  }),
  key: 'gc_count_line_chart',
  type: 'linemark',
  yUnit: 'number',
  series
};

export async function getGCActivityChart(
  setup: Setup,
  serviceName: string,
  gcLabel: string
) {
  const { start, end, uiFiltersES, client, config } = setup;

  const params = {
    index: config.get<string>('apm_oss.metricsIndices'),
    body: {
      size: 0,
      query: {
        bool: {
          filter: [
            { term: { [SERVICE_NAME]: serviceName } },
            { term: { [PROCESSOR_EVENT]: 'metric' } },
            {
              range: rangeFilter(start, end)
            },
            { term: { [SERVICE_AGENT_NAME]: 'java' } },
            { term: { ['labels.name']: gcLabel } },
            ...uiFiltersES
          ]
        }
      },
      aggs: {
        perAgent: {
          terms: {
            field: 'agent.ephemeral_id',
            size: 10
          },
          aggs: {
            timeseriesData: {
              date_histogram: getMetricsDateHistogramParams(start, end),
              aggs: {
                gcCountMax: {
                  max_bucket: {
                    buckets_path: 'perMinuteTimeseriesData>gcCountDifference'
                  }
                },
                gcCountAvg: {
                  avg_bucket: {
                    buckets_path: 'perMinuteTimeseriesData>gcCountDifference'
                  }
                },
                perMinuteTimeseriesData: {
                  date_histogram: {
                    field: '@timestamp',
                    fixed_interval: '60s'
                  },
                  aggs: {
                    gcCountBucketMin: {
                      min: {
                        field: 'jvm.gc.count'
                      }
                    },
                    gcCountBucketMax: {
                      max: {
                        field: 'jvm.gc.count'
                      }
                    },
                    gcCountDifference: {
                      bucket_script: {
                        buckets_path: {
                          bucketMin: 'gcCountBucketMin',
                          bucketMax: 'gcCountBucketMax'
                        },
                        script: 'params.bucketMax - params.bucketMin'
                      }
                    }
                  }
                }
              }
            },
            gcCountMaxOverall: {
              max_bucket: {
                buckets_path: 'timeseriesData>gcCountMax'
              }
            },
            gcCountAvgOverall: {
              avg_bucket: {
                buckets_path: 'timeseriesData>gcCountAvg'
              }
            }
          }
        }
      }
    }
  };

  const response = await client.search(params);
  return transformDataToMetricsChart(response, chartBase, gcLabel);
}

export interface AggregatedParams {
  body: {
    aggs: {
      perAgent: {
        terms: {
          field: string;
          size: number;
        };
        aggs: {
          timeseriesData: {
            date_histogram: any;
            aggs: {
              gcCountMax?: any;
              gcCountAvg?: any;
              perMinuteTimeseriesData: {
                date_histogram: any;
                aggs: {
                  gcCountBucketMin?: any;
                  gcCountBucketMax?: any;
                  gcCountDifference?: any;
                };
              };
            };
          };
          gcCountMaxOverall?: any;
          gcCountAvgOverall?: any;
        };
      };
    };
  };
}

export function transformDataToMetricsChart<Params extends AggregatedParams>(
  result: AggregationSearchResponse<unknown, Params>,
  chartBase: ChartBase,
  gcLabel: string
) {
  const { aggregations, hits } = result;
  const {
    timeseriesData,
    gcCountAvgOverall,
    gcCountMaxOverall
  } = aggregations.perAgent.buckets[0]; // TODO merge buckets into single timeseries data

  return {
    title: chartBase.title + ` (${gcLabel})`,
    key: chartBase.key,
    yUnit: chartBase.yUnit,
    totalHits: hits.total,
    series: [
      {
        title: series.gcCountAvg.title,
        key: 'gcCountAvg',
        type: 'linemark',
        color: colors[0],
        overallValue: (gcCountAvgOverall as AggregatedValue).value,
        data: timeseriesData.buckets.map(bucket => {
          return {
            x: bucket.key,
            y: (bucket.gcCountAvg as AggregatedValue).value
          };
        })
      },
      {
        title: series.gcCountMax.title,
        key: 'gcCountMax',
        type: 'linemark',
        color: colors[1],
        overallValue: (gcCountMaxOverall as AggregatedValue).value,
        data: timeseriesData.buckets.map(bucket => {
          return {
            x: bucket.key,
            y: (bucket.gcCountMax as AggregatedValue).value
          };
        })
      }
    ]
  };
}
