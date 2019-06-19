/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
import { find } from 'lodash';
import { AggregationSearchResponse } from 'elasticsearch';
import {
  MetricSeriesKeys,
  AggValue,
  ChartBase,
  JavaGcMetricsAggs
} from './../../../types';
import { mergeTimeseriesDataBuckets, transformJavaGcDataToMetricsChart } from '../transform_java_metrics_chart';
import perAgentBuckets from './per_agent_buckets.json'
import javaGcMetricsResponse from './java-gc-metrics-response.json'

describe('mergeTimeseriesDataBuckets', () => {
  describe.skip('dev', () => {
    it('should work', () => {
      const testBucket0 = find(perAgentBuckets[0].timeseriesData.buckets, {"key": 1560884400000});
      const testBucket1 = find(perAgentBuckets[1].timeseriesData.buckets, {"key": 1560884400000});
      console.log(testBucket0);
      console.log(testBucket1);
      const timeseriesData = mergeTimeseriesDataBuckets(perAgentBuckets, chartBase);
      const resultBucket = find(timeseriesData.buckets, {"key": 1560884400000});
      console.log(resultBucket);
      expect(timeseriesData).toBeDefined();
    });
  });
});

describe('transformJavaGcDataToMetricsChart', () => {
  describe('dev', () => {
    it('should work', () => {
      const javaGCRateMetricsChart = transformJavaGcDataToMetricsChart<
        JavaGCRateMetricsSeriesAggs
      >(apiResponse, chartBase);
      expect(javaGCRateMetricsChart).toHaveProperty('title', chartBase.title);
    });
  });
});

export type JavaGCRateMetricsSeriesAggs =
  | { [P in keyof typeof chartBaseSeries]: AggValue }
  | MetricSeriesKeys;

export const chartBaseSeries = {
  gcCountMax: {
    title: 'GC cycles max',
    color: 'blue'
  }
};
export const chartBase: ChartBase<JavaGCRateMetricsSeriesAggs> = {
  title: 'Garbage collection rate',
  key: 'gc_rate_line_chart',
  type: 'linemark',
  yUnit: 'number',
  series: chartBaseSeries
};
export const apiResponse: AggregationSearchResponse<
  void,
  JavaGcMetricsAggs<JavaGCRateMetricsSeriesAggs>
> = {
  took: 5,
  timed_out: false,
  _shards: {
    total: 2,
    successful: 2,
    skipped: 0,
    failed: 0
  },
  hits: {
    // total: {
    //   value: 9744,
    //   relation: 'eq'
    // },
    total: 9744,
    // max_score: null,
    max_score: 0,
    hits: []
  },
  aggregations: {
    perLabelName: {
      doc_count_error_upper_bound: 0,
      sum_other_doc_count: 0,
      buckets: [
        {
          key: 'G1 Old Generation',
          doc_count: 3248,
          perAgent: {
            doc_count_error_upper_bound: 0,
            sum_other_doc_count: 0,
            buckets: [
              {
                key: 'd193abcc-9a88-4105-b647-864d466319a7',
                doc_count: 3248,
                timeseriesData: {
                  buckets: [
                    {
                      key_as_string: '2019-06-11T23:40:00.000Z',
                      key: 1560296400000,
                      doc_count: 0,
                      gcCountMax: {
                        value: null
                      },
                      gcCountAll: {
                        value: 0
                      }
                    },
                    {
                      key_as_string: '2019-06-11T23:50:00.000Z',
                      key: 1560297000000,
                      doc_count: 3,
                      gcCountMax: {
                        value: 0
                      },
                      gcCountAll: {
                        value: 0
                      },
                      gcCount: {
                        value: 0
                      }
                    },
                    {
                      key_as_string: '2019-06-12T00:00:00.000Z',
                      key: 1560297600000,
                      doc_count: 20,
                      gcCountMax: {
                        value: 0
                      },
                      gcCountAll: {
                        value: 0
                      },
                      gcCount: {
                        value: 0
                      }
                    }
                  ]
                },
                gcCountAll: {
                  value: 0
                }
              }
            ]
          }
        },
        {
          key: 'G1 Young Generation',
          doc_count: 3248,
          perAgent: {
            doc_count_error_upper_bound: 0,
            sum_other_doc_count: 0,
            buckets: [
              {
                key: 'd193abcc-9a88-4105-b647-864d466319a7',
                doc_count: 3248,
                timeseriesData: {
                  buckets: [
                    {
                      key_as_string: '2019-06-11T23:40:00.000Z',
                      key: 1560296400000,
                      doc_count: 0,
                      gcCountMax: {
                        value: null
                      },
                      gcCountAll: {
                        value: 0
                      }
                    },
                    {
                      key_as_string: '2019-06-11T23:50:00.000Z',
                      key: 1560297000000,
                      doc_count: 3,
                      gcCountMax: {
                        value: 29
                      },
                      gcCountAll: {
                        value: 0
                      },
                      gcCount: {
                        value: 29
                      }
                    },
                    {
                      key_as_string: '2019-06-12T00:00:00.000Z',
                      key: 1560297600000,
                      doc_count: 20,
                      gcCountMax: {
                        value: 49
                      },
                      gcCountAll: {
                        value: 20
                      },
                      gcCount: {
                        value: 49
                      }
                    }
                  ]
                },
                gcCountAll: {
                  value: 20
                }
              }
            ]
          }
        }
      ]
    }
  }
};
