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
  gcTimeAvg: {
    title: i18n.translate('xpack.apm.agentMetrics.java.gcTimeAvg', {
      defaultMessage: 'Avg GC % of min'
    }),
    color: theme.euiColorVis0
  },
  gcTimeMax: {
    title: i18n.translate('xpack.apm.agentMetrics.java.gcTimeMax', {
      defaultMessage: 'Max GC % of min'
    }),
    color: theme.euiColorVis1
  }
};

const chartBase: ChartBase = {
  title: i18n.translate('xpack.apm.agentMetrics.java.gcTimeChartTitle', {
    defaultMessage: 'Garbage Collection time spent per minute'
  }),
  key: 'gc_time_line_chart',
  type: 'linemark',
  yUnit: 'percent',
  series
};

export async function getGCTimeChart(
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
                gcTimeMax: {
                  max_bucket: {
                    buckets_path: 'perMinuteTimeseriesData>gcTimeDifference'
                  }
                },
                gcTimeAvg: {
                  avg_bucket: {
                    buckets_path: 'perMinuteTimeseriesData>gcTimeDifference'
                  }
                },
                perMinuteTimeseriesData: {
                  date_histogram: {
                    field: '@timestamp',
                    fixed_interval: '60s'
                  },
                  aggs: {
                    gcTimeBucketMin: {
                      min: {
                        field: 'jvm.gc.time'
                      }
                    },
                    gcTimeBucketMax: {
                      max: {
                        field: 'jvm.gc.time'
                      }
                    },
                    gcTimeDifference: {
                      bucket_script: {
                        buckets_path: {
                          bucketMin: 'gcTimeBucketMin',
                          bucketMax: 'gcTimeBucketMax'
                        },
                        script: 'params.bucketMax - params.bucketMin'
                      }
                    }
                  }
                }
              }
            },
            gcTimeMaxOverall: {
              max_bucket: {
                buckets_path: 'timeseriesData>gcTimeMax'
              }
            },
            gcTimeAvgOverall: {
              avg_bucket: {
                buckets_path: 'timeseriesData>gcTimeAvg'
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
              gcTimeMax?: any;
              gcTimeAvg?: any;
              perMinuteTimeseriesData: {
                date_histogram: any;
                aggs: {
                  gcTimeBucketMin?: any;
                  gcTimeBucketMax?: any;
                  gcTimeDifference?: any;
                };
              };
            };
          };
          gcTimeMaxOverall?: any;
          gcTimeAvgOverall?: any;
        };
      };
    };
  };
}

function getPercentMsOfMinute(ms: number) {
  return (ms * 100) / 60000;
}

export function transformDataToMetricsChart<Params extends AggregatedParams>(
  result: AggregationSearchResponse<unknown, Params>,
  chartBase: ChartBase,
  gcLabel: string
) {
  const { aggregations, hits } = result;
  const {
    timeseriesData,
    gcTimeAvgOverall,
    gcTimeMaxOverall
  } = aggregations.perAgent.buckets[0]; // TODO merge buckets into single timeseries data

  return {
    title: chartBase.title + ` (${gcLabel})`,
    key: chartBase.key,
    yUnit: chartBase.yUnit,
    totalHits: hits.total,
    series: [
      {
        title: series.gcTimeAvg.title,
        key: 'gcTimeAvg',
        type: 'linemark',
        color: colors[0],
        overallValue: getPercentMsOfMinute(
          (gcTimeAvgOverall as AggregatedValue).value || 0
        ),
        data: timeseriesData.buckets.map(bucket => {
          return {
            x: bucket.key,
            y: getPercentMsOfMinute(
              (bucket.gcTimeAvg as AggregatedValue).value || 0
            )
          };
        })
      },
      {
        title: series.gcTimeMax.title,
        key: 'gcTimeMax',
        type: 'linemark',
        color: colors[1],
        overallValue: getPercentMsOfMinute(
          (gcTimeMaxOverall as AggregatedValue).value || 0
        ),
        data: timeseriesData.buckets.map(bucket => {
          return {
            x: bucket.key,
            y: getPercentMsOfMinute(
              (bucket.gcTimeMax as AggregatedValue).value || 0
            )
          };
        })
      }
    ]
  };
}
