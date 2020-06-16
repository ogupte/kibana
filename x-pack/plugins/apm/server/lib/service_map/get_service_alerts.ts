/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
import { Setup } from '../helpers/setup_request';

export async function getServiceAlerts(setup: Setup, serviceNames: string[]) {
  const { alerting } = setup;
  if (!alerting) {
    return [];
  }
  const alertsClient = alerting.getAlertsClient();
  const result = await alertsClient.find({
    options: {
      filter: 'alert.attributes.consumer:"apm"',
    },
  });
  if (result.total === 0) {
    return;
  }

  const taskList = result.data.map(({ id, params }) =>
    (async () => {
      const alertState = await alertsClient.getAlertState({ id });
      return { id, params, alertState };
    })()
  );
  const alertStates = await Promise.all(taskList);
  const serviceAlerts = alertStates.map(({ id, params, alertState }) => {
    return {
      id,
      'service.name': params.serviceName,
      'service.environment': params.environment,
      hasAlertViolations:
        Object.keys(alertState?.alertInstances ?? {}).length > 0,
    };
  });
  return serviceAlerts;
}

// GET /api/apm/service-map/alerts

// [
//   {
//     "id": "3d1f7311-88a8-4f4d-a191-ef6e22067319",
//     "service.name": "opbeans-java",
//     "service.environment": "production",
//     "hasAlertViolations": false
//   },
//   {
//     "id": "12db7239-f607-4a27-abf3-9b156205703a",
//     "service.name": "opbeans-node",
//     "service.environment": "ENVIRONMENT_ALL",
//     "hasAlertViolations": false
//   },
//   {
//     "id": "432e01e3-c8f1-4d0b-a468-2bd220e10805",
//     "service.name": "opbeans-go",
//     "service.environment": "testing",
//     "hasAlertViolations": false
//   },
//   {
//     "id": "779ff4da-dc04-46c9-9a96-c0d38e7ff7bb",
//     "service.name": "opbeans-python",
//     "service.environment": "ENVIRONMENT_ALL",
//     "hasAlertViolations": true
//   }
// ]
