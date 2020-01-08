/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
import { uniq, take, sortBy } from 'lodash';
import {
  Setup,
  SetupUIFilters,
  SetupTimeRange
} from '../helpers/setup_request';
import { rangeFilter } from '../helpers/range_filter';
import { ESFilter } from '../../../typings/elasticsearch';
import {
  PROCESSOR_EVENT,
  SERVICE_NAME,
  SERVICE_ENVIRONMENT,
  TRANSACTION_TYPE,
  TRANSACTION_NAME,
  SPAN_TYPE,
  SPAN_SUBTYPE,
  DESTINATION_ADDRESS,
  TRACE_ID,
  TRANSACTION_SAMPLED
} from '../../../common/elasticsearch_fieldnames';

const MAX_TRACES_TO_INSPECT = 1000;

export async function getTraceSampleIds({
  after,
  serviceName,
  environment,
  setup
}: {
  after?: string;
  serviceName?: string;
  environment?: string;
  setup: Setup & SetupTimeRange & SetupUIFilters;
}) {
  const isTop = !after;

  const { start, end, client, indices, uiFiltersES, config } = setup;

  const rangeEnd = end;
  // const rangeStart = isTop
  //   ? rangeEnd - config['xpack.apm.serviceMapInitialTimeRange']
  //   : start;
  const rangeStart = start || config['xpack.apm.serviceMapInitialTimeRange'];

  const rangeQuery = { range: rangeFilter(rangeStart, rangeEnd) };

  const query = {
    bool: {
      filter: [
        {
          bool: {
            should: [
              { term: { [PROCESSOR_EVENT]: 'span' } },
              {
                bool: {
                  filter: [
                    {
                      term: {
                        [PROCESSOR_EVENT]: 'transaction'
                      }
                    },
                    {
                      term: {
                        [TRANSACTION_SAMPLED]: true
                      }
                    }
                  ]
                }
              }
            ],
            minimum_should_match: 1
          }
        },
        rangeQuery,
        ...uiFiltersES
      ] as ESFilter[]
    }
  } as { bool: { filter: ESFilter[]; must_not?: ESFilter[] | ESFilter } };

  if (serviceName) {
    query.bool.filter.push({ term: { [SERVICE_NAME]: serviceName } });
  }

  if (environment) {
    query.bool.filter.push({ term: { [SERVICE_ENVIRONMENT]: environment } });
  }

  const afterObj =
    after && after !== 'top'
      ? { after: JSON.parse(Buffer.from(after, 'base64').toString()) }
      : {};

  const params = {
    index: [
      indices['apm_oss.spanIndices'],
      indices['apm_oss.transactionIndices']
    ],
    body: {
      size: 0,
      query,
      aggs: {
        connections: {
          composite: {
            size: 1000,
            ...afterObj,
            sources: [
              { [SERVICE_NAME]: { terms: { field: SERVICE_NAME } } },
              {
                [SERVICE_ENVIRONMENT]: {
                  terms: { field: SERVICE_ENVIRONMENT, missing_bucket: true }
                }
              },
              {
                [TRANSACTION_TYPE]: {
                  terms: { field: TRANSACTION_TYPE, missing_bucket: true }
                }
              },
              {
                [TRANSACTION_NAME]: {
                  terms: { field: TRANSACTION_NAME, missing_bucket: true }
                }
              },
              {
                [SPAN_TYPE]: {
                  terms: { field: SPAN_TYPE, missing_bucket: true }
                }
              },
              {
                [SPAN_SUBTYPE]: {
                  terms: { field: SPAN_SUBTYPE, missing_bucket: true }
                }
              },
              {
                [DESTINATION_ADDRESS]: {
                  terms: { field: DESTINATION_ADDRESS, missing_bucket: false }
                }
              }
            ]
          },
          aggs: {
            sample_documents: {
              terms: {
                field: TRACE_ID,
                execution_hint: 'map' as const,
                // remove bias towards large traces by sorting on trace.id
                // which will be random-esque
                order: {
                  _key: 'desc' as const
                }
              }
            }
          }
        }
      }
    }
  };

  const tracesSampleResponse = await client.search<
    { trace: { id: string } },
    typeof params
  >(params);

  let nextAfter: string | undefined;

  const receivedAfterKey =
    tracesSampleResponse.aggregations?.connections.after_key;

  if (!after) {
    nextAfter = 'top';
  } else if (receivedAfterKey) {
    nextAfter = Buffer.from(JSON.stringify(receivedAfterKey)).toString(
      'base64'
    );
  }

  // make sure at least one trace per composite/connection bucket
  // is queried
  const traceIdsWithPriority =
    tracesSampleResponse.aggregations?.connections.buckets.flatMap(bucket =>
      bucket.sample_documents.buckets.map((sampleDocBucket, index) => ({
        traceId: sampleDocBucket.key as string,
        priority: index
      }))
    ) || [];

  const traceIds = take(
    uniq(
      sortBy(traceIdsWithPriority, 'priority').map(({ traceId }) => traceId)
    ),
    MAX_TRACES_TO_INSPECT
  );

  return {
    after: nextAfter,
    traceIds
  };
}
