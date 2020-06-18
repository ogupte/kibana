/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
import React, { useState } from 'react';
import { EuiFlexGroup, EuiFlexItem, EuiPanel, EuiText } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { useTransactionBreakdown } from '../../../hooks/useTransactionBreakdown';
import { TransactionBreakdownHeader } from './TransactionBreakdownHeader';
import { TransactionBreakdownKpiList } from './TransactionBreakdownKpiList';
import { TransactionBreakdownGraph } from './TransactionBreakdownGraph';
import { FETCH_STATUS } from '../../../hooks/useFetcher';
import { useUiTracker } from '../../../../../observability/public';

const emptyMessage = i18n.translate('xpack.apm.transactionBreakdown.noData', {
  defaultMessage: 'No data within this time range.',
});

const TransactionBreakdown: React.FC<{
  initialIsOpen?: boolean;
}> = ({ initialIsOpen }) => {
  const [showChart, setShowChart] = useState(!!initialIsOpen);
  const { data, status } = useTransactionBreakdown();
  const trackApmEvent = useUiTracker({ app: 'apm' });
  const { kpis, timeseries } = data;
  const noHits = data.kpis.length === 0 && status === FETCH_STATUS.SUCCESS;
  const showEmptyMessage = noHits && !showChart;

  return (
    <EuiPanel>
      <EuiFlexGroup direction="column" gutterSize="s">
        <EuiFlexItem grow={false}>
          <TransactionBreakdownHeader
            showChart={showChart}
            onToggleClick={() => {
              setShowChart(!showChart);
              if (showChart) {
                trackApmEvent({ metric: 'hide_breakdown_chart' });
              } else {
                trackApmEvent({ metric: 'show_breakdown_chart' });
              }
            }}
          />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          {showEmptyMessage ? (
            <EuiText>{emptyMessage}</EuiText>
          ) : (
            <TransactionBreakdownKpiList kpis={kpis} />
          )}
        </EuiFlexItem>
        {showChart ? (
          <EuiFlexItem grow={false}>
            <TransactionBreakdownGraph
              timeseries={fillTimeseriesGaps(timeseries)}
            />
          </EuiFlexItem>
        ) : null}
      </EuiFlexGroup>
    </EuiPanel>
  );
};

export { TransactionBreakdown };

interface Timeserie {
  title: string;
  color: string;
  type: string;
  data: Array<{
    x: number;
    y: number | null;
  }>;
  hideLegend: boolean;
}

function fillTimeseriesGaps(timeseries: Timeserie[]) {
  return timeseries.map((timeserie) => {
    const data: Timeserie['data'] = timeserie.data.map(
      (point, index, dataArray) => {
        if (point.y === null) {
          return { x: point.x, y: dataArray[index - 1]?.y ?? null };
        }
        return point;
      }
    );
    return { ...timeserie, data };
  });
}
