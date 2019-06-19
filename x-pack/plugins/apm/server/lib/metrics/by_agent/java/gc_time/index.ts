/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import theme from '@elastic/eui/dist/eui_theme_light.json';
import { i18n } from '@kbn/i18n';
import { Setup } from '../../../../helpers/setup_request';
import { fetch, GcTimeMetrics } from './fetcher';
import { ChartBase } from '../../../types';
import { transformJavaGcDataToMetricsChart } from '../transform_java_metrics_chart';

const chartBase: ChartBase<GcTimeMetrics> = {
  title: i18n.translate('xpack.apm.agentMetrics.java.gcTimeChartTitle', {
    defaultMessage: 'Garbage collection time'
  }),
  key: 'gc_time_line_chart',
  type: 'linemark',
  yUnit: 'integer',
  series: {
    gcTimeMax: {
      title: i18n.translate('xpack.apm.agentMetrics.java.gcTimeMax', {
        defaultMessage: 'GC time max (ms)'
      }),
      color: theme.euiColorVis0
    },
    gcTimeAvg: {
      title: i18n.translate('xpack.apm.agentMetrics.java.gcTimeAvg', {
        defaultMessage: 'GC time avg (ms)'
      }),
      color: theme.euiColorVis1
    }
  }
};

export async function getGCTimeChartData(setup: Setup, serviceName: string) {
  const result = await fetch(setup, serviceName);
  return transformJavaGcDataToMetricsChart<GcTimeMetrics>(result, chartBase);
}
