/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import * as t from 'io-ts';
import { setupRequest } from '../lib/helpers/setup_request';
import { getServiceDependencies } from '../lib/service_overview/get_service_dependencies';
import { createRoute } from './create_route';
import { rangeRt, uiFiltersRt } from './default_api_types';

export const serviceOverviewDependenciesRoute = createRoute(() => ({
  path: `/api/apm/service-overview/service/{serviceName}`,
  params: {
    path: t.type({
      serviceName: t.string,
    }),
    query: t.intersection([rangeRt, uiFiltersRt]),
  },
  handler: async ({ context, request }) => {
    const setup = await setupRequest(context, request);

    const {
      path: { serviceName },
    } = context.params;

    return getServiceDependencies({
      setup,
      serviceName,
    });
  },
}));
