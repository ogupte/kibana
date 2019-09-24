/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
import cytoscape from 'cytoscape';
import { PromiseReturnType } from '../../../typings/common';
import { Setup } from '../helpers/setup_request';

export type ServiceMapResponse = PromiseReturnType<typeof getServiceMap>;
export async function getServiceMap(
  // serviceName: string,
  setup: Setup
): Promise<cytoscape.ElementDefinition[]> {
  // const { start, end, client, config } = setup;

  return [
    { data: { id: 'A', typeLabel: 'JS', label: 'selected instance' } },
    { data: { id: 'B', typeLabel: 'JS', label: 'service label5' } },
    { data: { source: 'A', target: 'B' } },
    { data: { id: 'C', typeLabel: 'JS', label: 'checkout service' } },
    { data: { source: 'A', target: 'C' } },
    { data: { id: 'D', typeLabel: 'DN', label: 'payment service' } },
    { data: { source: 'C', target: 'D' } },
    { data: { id: 'E', typeLabel: 'CO', label: 'database' } },
    { data: { source: 'D', target: 'E' } }
  ];
}
