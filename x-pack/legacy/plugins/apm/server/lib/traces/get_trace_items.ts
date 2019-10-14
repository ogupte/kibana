/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import {
  PROCESSOR_EVENT,
  TRACE_ID,
  PARENT_ID,
  TRANSACTION_DURATION,
  SPAN_DURATION
} from '../../../common/elasticsearch_fieldnames';
import { Span } from '../../../typings/es_schemas/ui/Span';
import { Transaction } from '../../../typings/es_schemas/ui/Transaction';
import { rangeFilter } from '../helpers/range_filter';
import { Setup } from '../helpers/setup_request';

export async function getTraceItems(traceId: string, setup: Setup) {
  const {
    start,
    end,
    client,
    config,
    indices: { apm_oss }
  } = setup;
  const maxTraceItems = config.get<number>('xpack.apm.ui.maxTraceItems');

  const params = {
    index: [apm_oss.spanIndices, apm_oss.transactionIndices],
    body: {
      size: maxTraceItems,
      query: {
        bool: {
          filter: [
            { term: { [TRACE_ID]: traceId } },
            { terms: { [PROCESSOR_EVENT]: ['span', 'transaction'] } },
            { range: rangeFilter(start, end) }
          ],
          should: {
            exists: { field: PARENT_ID }
          }
        }
      },
      sort: [
        { _score: { order: 'asc' as const } },
        { [TRANSACTION_DURATION]: { order: 'desc' as const } },
        { [SPAN_DURATION]: { order: 'desc' as const } }
      ],
      track_total_hits: true
    }
  };

  const resp = await client.search<Transaction | Span>(params);

  return {
    items: resp.hits.hits.map(hit => hit._source),
    exceedsMax: resp.hits.total.value > maxTraceItems
  };
}
