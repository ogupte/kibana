/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import React, { useState } from 'react';
import { i18n } from '@kbn/i18n';
import {
  EuiTitle,
  EuiFlexGroup,
  EuiFlexItem,
  EuiButtonEmpty,
  EuiPanel,
  EuiBetaBadge,
  EuiSpacer,
  EuiCallOut,
  EuiEmptyPrompt,
  EuiButton
} from '@elastic/eui';
import { loadCMList } from '../../../services/rest/apm/settings';
import { useFetcher } from '../../../hooks/useFetcher';
import { ITableColumn, ManagedTable } from '../../shared/ManagedTable';
import { CMListAPIResponse } from '../../../../server/lib/settings/cm/list_configurations';
import { AddSettingsFlyout } from './AddSettings/AddSettingFlyout';
import { DeleteModal } from './DeleteModal';
import { APMLink } from '../../shared/Links/APMLink';

type Config = CMListAPIResponse[0];

export function ListSettings() {
  const { data = [], refresh } = useFetcher(loadCMList, []);
  const [configToBeDeleted, setConfigToBeDeleted] = useState<Config | null>(
    null
  );
  const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);

  const COLUMNS: Array<ITableColumn<Config>> = [
    {
      field: 'service.name',
      name: i18n.translate('xpack.apm.settingsTable.serviceNameColumnLabel', {
        defaultMessage: 'Service name'
      }),
      width: '50%',
      sortable: true,
      render: (value: string) => value
    },
    {
      field: 'service.environment',
      name: i18n.translate('xpack.apm.settingsTable.environmentColumnLabel', {
        defaultMessage: 'Service environment'
      }),
      sortable: true,
      render: (value: string) => value
    },
    {
      field: 'settings.sample_rate',
      name: i18n.translate('xpack.apm.settingsTable.sampelRateColumnLabel', {
        defaultMessage: 'Sample rate'
      }),
      sortable: true,
      render: (value: string) => value
    },
    {
      name: 'Delete',
      actions: [
        {
          name: 'Delete',
          description: 'Delete this config',
          icon: 'trash',
          color: 'danger',
          type: 'icon',
          onClick: (config: Config) => {
            setConfigToBeDeleted(config);
          }
        }
      ]
    }
  ];

  const RETURN_TO_OVERVIEW_LINK_LABEL = i18n.translate(
    'xpack.apm.returnToOverviewLinkLabel',
    {
      defaultMessage: 'Return to overview'
    }
  );

  const hasConfigurations = data.length !== 0;

  return (
    <>
      <DeleteModal
        configToBeDeleted={configToBeDeleted}
        onCancel={() => {
          setConfigToBeDeleted(null);
        }}
        onConfirm={() => {
          setConfigToBeDeleted(null);
          refresh();
        }}
      />
      <AddSettingsFlyout
        isOpen={isFlyoutOpen}
        onClose={() => setIsFlyoutOpen(false)}
        onSubmit={() => {
          setIsFlyoutOpen(false);
          refresh();
        }}
      />

      <EuiFlexGroup alignItems="center">
        <EuiFlexItem grow={false}>
          <EuiTitle size="l">
            <h1>Settings</h1>
          </EuiTitle>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <APMLink path="/">
            <EuiButtonEmpty size="s" color="primary" iconType="arrowLeft">
              {RETURN_TO_OVERVIEW_LINK_LABEL}
            </EuiButtonEmpty>
          </APMLink>
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiSpacer size="l" />

      <EuiPanel>
        <EuiFlexGroup alignItems="center">
          <EuiFlexItem grow={false}>
            <EuiTitle>
              <h2>Configurations</h2>
            </EuiTitle>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiBetaBadge
              label="Beta"
              tooltipContent="This module is not GA. Please help us by reporting any bugs."
            />
          </EuiFlexItem>
          {hasConfigurations ? (
            <EuiFlexItem>
              <EuiFlexGroup alignItems="center" justifyContent="flexEnd">
                <EuiFlexItem grow={false}>
                  <EuiButton
                    color="primary"
                    fill
                    iconType="plusInCircle"
                    onClick={() => setIsFlyoutOpen(true)}
                  >
                    Create configuration
                  </EuiButton>
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiFlexItem>
          ) : null}
        </EuiFlexGroup>

        <EuiSpacer size="m" />

        <EuiCallOut
          title="APM Central Configuration (BETA)"
          iconType="iInCircle"
        >
          <p>
            We're excited to bring you a first look at how you can manage your
            services by updating agent configurations directly from the APM UI.
            Read more on this new feature.
          </p>
        </EuiCallOut>

        <EuiSpacer size="m" />

        {hasConfigurations ? (
          <ManagedTable columns={COLUMNS} items={data} initialPageSize={50} />
        ) : (
          <EuiEmptyPrompt
            iconType="editorStrike"
            title={<h2>Nothing to see here.</h2>}
            body={
              <>
                <p>
                  Let's change that! Central configuration enables you to
                  configure specific variables in your agents based on your
                  environment directly from the APM UI. To begin with, you can
                  change the transaction sample rate and sync the change to your
                  services.
                </p>
              </>
            }
            actions={
              <EuiButton
                color="primary"
                fill
                onClick={() => setIsFlyoutOpen(true)}
              >
                Create configuration
              </EuiButton>
            }
          />
        )}
      </EuiPanel>
    </>
  );
}
