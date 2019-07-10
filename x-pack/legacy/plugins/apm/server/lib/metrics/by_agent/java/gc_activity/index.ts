import { Setup } from '../../../../helpers/setup_request';
import {
  PROCESSOR_EVENT,
  SERVICE_NAME,
  SERVICE_AGENT_NAME
} from '../../../../../../common/elasticsearch_fieldnames';
import { rangeFilter } from '../../../../helpers/range_filter';
import { getGCActivityChart } from './get_gc_activity_chart';
import { getGCTimeChart } from './get_gc_time_chart';

export async function getGCActivityCharts(setup: Setup, serviceName: string) {
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
            ...uiFiltersES
          ]
        }
      },
      aggs: {
        perLabelName: {
          terms: {
            field: 'labels.name',
            size: 10
          }
        }
      }
    }
  };

  const response = await client.search(params);
  const gcLabels = response.aggregations.perLabelName.buckets.map(
    ({ key }) => key
  );

  const activityCharts = gcLabels.map(
    gcLabel =>
      new Promise(async (resolve, reject) => {
        try {
          resolve(await getGCActivityChart(setup, serviceName, gcLabel));
        } catch (error) {
          reject(error);
        }
      })
  );
  const timeCharts = gcLabels.map(
    gcLabel =>
      new Promise(async (resolve, reject) => {
        try {
          resolve(await getGCTimeChart(setup, serviceName, gcLabel));
        } catch (error) {
          reject(error);
        }
      })
  );

  return [...activityCharts, ...timeCharts];
}
