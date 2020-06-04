/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
import { chunk, intersection } from 'lodash';
import {
  AGENT_NAME,
  SERVICE_ENVIRONMENT,
  SERVICE_NAME,
} from '../../../common/elasticsearch_fieldnames';
import { getMlIndex } from '../../../common/ml_job_constants';
import { getServicesProjection } from '../../../common/projections/services';
import { mergeProjection } from '../../../common/projections/util/merge_projection';
import { PromiseReturnType } from '../../../typings/common';
import { rangeFilter } from '../helpers/range_filter';
import { Setup, SetupTimeRange } from '../helpers/setup_request';
import { transformServiceMapResponses } from './transform_service_map_responses';
import { getServiceMapFromTraceIds } from './get_service_map_from_trace_ids';
import { getTraceSampleIds } from './get_trace_sample_ids';
import { Job as AnomalyDetectionJob } from '../../../../ml/server';
import { join } from 'bluebird';

export interface IEnvOptions {
  setup: Setup & SetupTimeRange;
  serviceName?: string;
  environment?: string;
}

async function getConnectionData({
  setup,
  serviceName,
  environment,
}: IEnvOptions) {
  const { traceIds } = await getTraceSampleIds({
    setup,
    serviceName,
    environment,
  });

  const chunks = chunk(
    traceIds,
    setup.config['xpack.apm.serviceMapMaxTracesPerRequest']
  );

  const init = {
    connections: [],
    discoveredServices: [],
  };

  if (!traceIds.length) {
    return init;
  }

  const chunkedResponses = await Promise.all(
    chunks.map((traceIdsChunk) =>
      getServiceMapFromTraceIds({
        setup,
        serviceName,
        environment,
        traceIds: traceIdsChunk,
      })
    )
  );

  return chunkedResponses.reduce((prev, current) => {
    return {
      connections: prev.connections.concat(current.connections),
      discoveredServices: prev.discoveredServices.concat(
        current.discoveredServices
      ),
    };
  });
}

async function getServicesData(options: IEnvOptions) {
  const { setup } = options;

  const projection = getServicesProjection({
    setup: { ...setup, uiFiltersES: [] },
  });

  const { filter } = projection.body.query.bool;

  const params = mergeProjection(projection, {
    body: {
      size: 0,
      query: {
        bool: {
          ...projection.body.query.bool,
          filter: options.serviceName
            ? filter.concat({
                term: {
                  [SERVICE_NAME]: options.serviceName,
                },
              })
            : filter,
        },
      },
      aggs: {
        services: {
          terms: {
            field: projection.body.aggs.services.terms.field,
            size: 500,
          },
          aggs: {
            agent_name: {
              terms: {
                field: AGENT_NAME,
              },
            },
          },
        },
      },
    },
  });

  const { client } = setup;

  const response = await client.search(params);

  return (
    response.aggregations?.services.buckets.map((bucket) => {
      return {
        [SERVICE_NAME]: bucket.key as string,
        [AGENT_NAME]:
          (bucket.agent_name.buckets[0]?.key as string | undefined) || '',
        [SERVICE_ENVIRONMENT]: options.environment || null,
      };
    }) || []
  );
}

function _getAnomaliesData(options: IEnvOptions) {
  const { start, end, client } = options.setup;
  const rangeQuery = { range: rangeFilter(start, end, 'timestamp') };

  const params = {
    index: getMlIndex('*'),
    body: {
      size: 0,
      query: {
        bool: { filter: [{ term: { result_type: 'record' } }, rangeQuery] },
      },
      aggs: {
        jobs: {
          terms: { field: 'job_id', size: 10 },
          aggs: {
            top_score_hits: {
              top_hits: {
                sort: [{ record_score: { order: 'desc' as const } }],
                _source: ['job_id', 'record_score', 'typical', 'actual'],
                size: 1,
              },
            },
          },
        },
      },
    },
  };

  return client.search(params);
}

const getApmMlJobCategory = (
  mlJob: AnomalyDetectionJob,
  knownServiceNames: string[]
) => {
  const apmJobGroups = mlJob.groups.filter(groupName => groupName !== 'apm');
  if (apmJobGroups.length === mlJob.groups.length) {
    throw new Error('ML job missing "apm" group name.');
  }
  const [serviceName] = intersection(apmJobGroups, knownServiceNames);
  if (!serviceName) {
    throw new Error('APM ML job service name cannot be found.');
  }
  const [transactionType] = apmJobGroups.filter(
    groupName => groupName !== serviceName
  );
  if (!transactionType) {
    throw new Error('APM ML job transaction type cannot be found.');
  }
  return { jobId: mlJob.job_id, serviceName, transactionType };
};

async function getAnomaliesData(
  options: IEnvOptions,
  servicesData: ServicesResponse
) {
  const { start, end, ml } = options.setup;

  if (!ml) {
    return;
  }

  const serviceNames = servicesData.map(
    serviceData => serviceData[SERVICE_NAME]
  );

  const apmMlJobs = await ml.mlJobs('apm');
  const apmMlJobCategories = apmMlJobs.map(job =>
    getApmMlJobCategory(job, serviceNames)
  );
  const apmJobIds = apmMlJobs.map(job => job.job_id);
  const rangeQuery = { range: rangeFilter(start, end, 'timestamp') };
  const params = {
    body: {
      size: 0,
      query: {
        bool: {
          filter: [
            { term: { result_type: 'bucket' } },
            {
              terms: {
                job_id: apmJobIds
              }
            },
            rangeQuery
          ]
        }
      },
      aggs: {
        jobs: {
          terms: { field: 'job_id', size: apmJobIds.length },
          aggs: {
            top_score_hits: {
              top_hits: {
                sort: [{ anomaly_score: { order: 'desc' as const } }],
                _source: ['anomaly_score', 'timestamp'],
                size: 1
              }
            }
          }
        }
      }
    }
  };
  console.log(JSON.stringify(apmMlJobCategories));
  console.log(JSON.stringify(params));

  const response = await ml.mlSearch(params);
  const anomalyScores: Array<{
    jobId: string;
    anomalyScore: number;
    timestamp: number;
  }> = response.aggregations.jobs.buckets.map(jobBucket => {
    const jobId = jobBucket.key;
    const bucketSource = jobBucket.top_score_hits.hits.hits?.[0]?._source;
    // bucketSource.anomaly_score;
    // bucketSource.timestamp;
    return {
      jobId,
      anomalyScore: bucketSource.anomaly_score,
      timestamp: bucketSource.timestamp
    };
  });

  // return leftJoin(apmMlJobCategories, 'jobId', anomalyScores);
  return {apmMlJobCategories, anomalyScores};

  return response;
}
// interface AnomalyScore {
//   jobId: string;
//   anomalyScore: number;
//   timestamp: number;
// }
// type ApmMlJobCategory = ReturnType<typeof getApmMlJobCategory>;
// type Foo = Pick<
//   ApmMlJobCategory,
//   Extract<keyof AnomalyScore, keyof ApmMlJobCategory>
// >;
// type Bar = Extract<keyof AnomalyScore, keyof ApmMlJobCategory>;

// interface Foo {
//   jobId: string;
//   anomalyScore: number;
//   timestamp: number;
// }
// interface Bar {
//   jobId: string;
//   serviceName: string;
//   transactionType: string;
// }

type LeftJoin<LObj, RObj> = {
  [P in keyof (LObj & RObj)]: P extends keyof LObj
    ? LObj[P]
    : RObj[Extract<keyof RObj, P>] | undefined;
};

// type ASD = LeftJoin<Foo, Bar>;

// function leftJoin<TL, K extends Extract<keyof TL, keyof TR>, TR>(
//   apmMlJobCategories: TL[],
//   key: K,
//   anomalyScores: TR[]
// ): Array<LeftJoin<TL, TR>> {
//   return apmMlJobCategories.map(jobCategory => {
//     const anomalyScore = anomalyScores.find(
//       record => record[key] === jobCategory[key]
//     );
//     return (anomalyScore
//       ? { ...jobCategory, ...anomalyScore }
//       : { ...jobCategory }) as LeftJoin<TL, TR>;
//   });
// }

function leftJoin<TL, K extends Extract<keyof TL, keyof TR>, TR>(
  apmMlJobCategories: TL[],
  key: K,
  anomalyScores: TR[]
) {
  return apmMlJobCategories.map(jobCategory => {
    const anomalyScore = anomalyScores.find(record => {
      // @ts-ignore
      return jobCategory[key] === record[key];
    });
    return (anomalyScore
      ? { ...jobCategory, ...anomalyScore }
      : { ...jobCategory }) as any;
    // return (anomalyScore
    //   ? { ...jobCategory, ...anomalyScore }
    //   : { ...jobCategory }) as LeftJoin<TL, TR>;
  });
}

export type AnomaliesResponse = PromiseReturnType<typeof getAnomaliesData>;
export type ConnectionsResponse = PromiseReturnType<typeof getConnectionData>;
export type ServicesResponse = PromiseReturnType<typeof getServicesData>;
export type ServiceMapAPIResponse = PromiseReturnType<typeof getServiceMap>;

export async function getServiceMap(options: IEnvOptions) {
  const servicesData = await getServicesData(options);
  return await getAnomaliesData(options, servicesData);

  const [connectionData, /*servicesData,*/ anomaliesData]: [
    // explicit types to avoid TS "excessively deep" error
    ConnectionsResponse,
    // ServicesResponse,
    AnomaliesResponse
    // @ts-ignore
  ] = await Promise.all([
    getConnectionData(options),
    // getServicesData(options),
    getAnomaliesData(options),
  ]);

  // return transformServiceMapResponses({
  //   ...connectionData,
  //   anomalies: anomaliesData,
  //   services: servicesData
  // });

  const serviceMapData = transformServiceMapResponses({
    ...connectionData,
    anomalies: anomaliesData,
    services: servicesData,
  });
  return serviceMapData;
}
