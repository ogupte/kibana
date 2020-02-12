/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { createStaticIndexPattern } from './create_static_index_pattern';
import { Setup } from '../helpers/setup_request';
import * as HistoricalAgentData from '../services/get_services/has_historical_agent_data';
import { APMRequestHandlerContext } from '../../routes/typings';

function getMockContext(config: Record<string, unknown>) {
  return ({
    config,
    core: {
      savedObjects: {
        client: {
          create: jest.fn()
        }
      }
    }
  } as unknown) as APMRequestHandlerContext;
}

describe('createStaticIndexPattern', () => {
  it(`should not create index pattern if 'xpack.apm.autocreateApmIndexPattern=false'`, async () => {
    const setup = {} as Setup;
    const context = getMockContext({
      'xpack.apm.autocreateApmIndexPattern': false
    });
    await createStaticIndexPattern(setup, context);
    expect(context.core.savedObjects.client.create).not.toHaveBeenCalled();
  });

  it(`should not create index pattern if no APM data is found`, async () => {
    const setup = {} as Setup;
    const context = getMockContext({
      'xpack.apm.autocreateApmIndexPattern': true
    });

    // does not have APM data
    jest
      .spyOn(HistoricalAgentData, 'hasHistoricalAgentData')
      .mockResolvedValue(false);

    await createStaticIndexPattern(setup, context);
    expect(context.core.savedObjects.client.create).not.toHaveBeenCalled();
  });

  it(`should create index pattern`, async () => {
    const setup = {} as Setup;
    const context = getMockContext({
      'xpack.apm.autocreateApmIndexPattern': true
    });

    // does have APM data
    jest
      .spyOn(HistoricalAgentData, 'hasHistoricalAgentData')
      .mockResolvedValue(true);
    await createStaticIndexPattern(setup, context);

    expect(context.core.savedObjects.client.create).toHaveBeenCalled();
  });
});
