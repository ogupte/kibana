/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { Setup } from '../../helpers/setup_request';
import { AgentConfiguration } from './configuration_types';

export async function markAppliedByAgent({
  id,
  body,
  setup
}: {
  id: string;
  body: AgentConfiguration;
  setup: Setup;
}) {
  const {
    client,
    indices: { apm_oss }
  } = setup;

  const params = {
    index: apm_oss.apmAgentConfigurationIndex,
    id, // by specifying the `id` elasticsearch will do an "upsert"
    body: {
      ...body,
      applied_by_agent: true
    }
  };

  return client.index<AgentConfiguration>(params);
}
