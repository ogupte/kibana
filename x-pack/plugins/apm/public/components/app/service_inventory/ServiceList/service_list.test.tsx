/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import React, { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ServiceHealthStatus } from '../../../../../common/service_health_status';
import { MockApmPluginContextWrapper } from '../../../../context/apm_plugin/mock_apm_plugin_context';
import { mockMoment, renderWithTheme } from '../../../../utils/testHelpers';
import { getServiceColumns, ServiceList } from './';
import { items } from './__fixtures__/service_api_mock_data';

function Wrapper({ children }: { children?: ReactNode }) {
  return (
    <MockApmPluginContextWrapper>
      <MemoryRouter>{children}</MemoryRouter>
    </MockApmPluginContextWrapper>
  );
}

describe('ServiceList', () => {
  beforeAll(() => {
    mockMoment();
  });

  it('renders empty state', () => {
    expect(() =>
      renderWithTheme(<ServiceList items={[]} />, { wrapper: Wrapper })
    ).not.toThrowError();
  });

  it('renders with data', () => {
    expect(() =>
      renderWithTheme(<ServiceList items={items} />, { wrapper: Wrapper })
    ).not.toThrowError();
  });

  it('renders columns correctly', () => {
    const service: any = {
      serviceName: 'opbeans-python',
      agentName: 'python',
      trafficPerMinute: {
        value: 86.93333333333334,
        timeseries: [],
      },
      errorsPerMinute: {
        value: 12.6,
        timeseries: [],
      },
      avgResponseTime: {
        value: 91535.42944785276,
        timeseries: [],
      },
      environments: ['test'],
    };
    const renderedColumns = getServiceColumns({
      showTransactionTypeColumn: false,
    }).map((c) => c.render!(service[c.field!], service));

    expect(renderedColumns[0]).toMatchInlineSnapshot(`
      <HealthBadge
        healthStatus="unknown"
      />
    `);
  });

  describe('without ML data', () => {
    it('does not render the health column', () => {
      const { queryByText } = renderWithTheme(<ServiceList items={items} />, {
        wrapper: Wrapper,
      });
      const healthHeading = queryByText('Health');

      expect(healthHeading).toBeNull();
    });

    it('sorts by traffic per min', async () => {
      const { findByTitle } = renderWithTheme(<ServiceList items={items} />, {
        wrapper: Wrapper,
      });

      expect(
        await findByTitle('Traffic (per min); Sorted in descending order')
      ).toBeInTheDocument();
    });
  });

  describe('with ML data', () => {
    it('renders the health column', async () => {
      const { findByTitle } = renderWithTheme(
        <ServiceList
          items={items.map((item) => ({
            ...item,
            healthStatus: ServiceHealthStatus.warning,
          }))}
        />,
        { wrapper: Wrapper }
      );

      expect(
        await findByTitle('Health; Sorted in descending order')
      ).toBeInTheDocument();
    });
  });
});
