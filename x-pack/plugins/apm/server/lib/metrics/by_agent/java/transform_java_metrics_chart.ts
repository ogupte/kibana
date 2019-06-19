/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
import { AggregationSearchResponse } from 'elasticsearch';
import theme from '@elastic/eui/dist/eui_theme_light.json';
import {
  ChartBase,
  MetricSeriesKeys,
  JavaGcMetricsAggs
} from '../../types';
import { GenericMetricsChart } from '../../transform_metrics_chart';

const colors = [
  theme.euiColorVis0,
  theme.euiColorVis1,
  theme.euiColorVis2,
  theme.euiColorVis3,
  theme.euiColorVis4,
  theme.euiColorVis5,
  theme.euiColorVis6
];

export function mergeTimeseriesDataBuckets(
  buckets: AggregationSearchResponse<
    void,
    JavaGcMetricsAggs<MetricSeriesKeys>
  >['aggregations']['perLabelName']['buckets'][0]['perAgent']['buckets'],
  chartBase: ChartBase<MetricSeriesKeys>
) {
  type PerAgentBucket = typeof buckets[0];
  type TimeseriesDataBucket = PerAgentBucket['timeseriesData']['buckets'][0];
  if (buckets.length === 1) {
    return buckets[0].timeseriesData;
  }
  const seriesKeys = Object.keys(chartBase.series) as Array<
    keyof typeof chartBase.series
  >;
  const timeseriesBucketMap = new Map<
    TimeseriesDataBucket['key'],
    TimeseriesDataBucket
  >();
  const timeseriesDataBucketMap = buckets.reduce(
    (tsDataBucketMap, perAgentBucket: PerAgentBucket) => {
      return perAgentBucket.timeseriesData.buckets.reduce(
        (map, timeseriesBucket: TimeseriesDataBucket) => {
          const bucketData = map.get(timeseriesBucket.key) || {};
          timeseriesBucketMap.set(timeseriesBucket.key, timeseriesBucket);
          map.set(timeseriesBucket.key, bucketData);
          seriesKeys.forEach(seriesKey => {
            bucketData[seriesKey] =
              (bucketData[seriesKey] || 0) +
              (timeseriesBucket &&
              timeseriesBucket[seriesKey] &&
              timeseriesBucket[seriesKey].value
                ? (timeseriesBucket[seriesKey].value as number)
                : 0);
          });
          return map;
        },
        tsDataBucketMap
      );
    },
    new Map<number, { [seriesKey: string]: number }>()
  );
  return {
    buckets: Array.from(timeseriesDataBucketMap.entries())
      .map(([timeseriesDataKey, timeseriesDataObject]) => {
        return {
          ...timeseriesBucketMap.get(timeseriesDataKey),
          ...timeseriesDataObject
        } as TimeseriesDataBucket;
      })
      .sort(({ key: key0 }, { key: key1 }) => key0 - key1)
  };
}

export function transformJavaGcDataToMetricsChart<T extends MetricSeriesKeys>(
  result: AggregationSearchResponse<void, JavaGcMetricsAggs<T>>,
  chartBase: ChartBase<T>
) {
  const { aggregations, hits } = result;
  const { perLabelName } = aggregations;
  let colorId = 0;

  return {
    title: chartBase.title,
    key: chartBase.key,
    yUnit: chartBase.yUnit,
    totalHits: hits.total,
    series: perLabelName.buckets
      .reduce(
        (
          acc: GenericMetricsChart['series'],
          { key: labelName, perAgent },
          labelIdx
        ) => {
          const timeseriesData = mergeTimeseriesDataBuckets(
            perAgent.buckets,
            chartBase
          );

          return [
            ...acc,
            ...Object.keys(chartBase.series).map((seriesKey, i) => {
              colorId++;
              return {
                title: `${chartBase.series[seriesKey].title} (${labelName})`,
                key: seriesKey,
                type: chartBase.type,
                color: colors[colorId - (1 % colors.length)],
                overallValue: perAgent.buckets[0][seriesKey].value,
                data: timeseriesData.buckets.map(bucket => {
                  let y = null;
                  if (bucket[seriesKey]) {
                    const { value } = bucket[seriesKey];
                    if (value !== null && !isNaN(value)) {
                      y = value;
                    }
                  }
                  return {
                    x: bucket.key,
                    y
                  };
                })
              };
            })
          ];
        },
        []
      )
      .sort(
        ({ overallValue: overallValue0 }, { overallValue: overallValue1 }) =>
          (overallValue1 || 0) - (overallValue0 || 0)
      )
  };
}
