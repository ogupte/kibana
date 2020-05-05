/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiHorizontalRule,
  EuiTitle,
  EuiIconTip,
  EuiHealth
} from '@elastic/eui';
import theme from '@elastic/eui/dist/eui_theme_light.json';
import { i18n } from '@kbn/i18n';
import cytoscape from 'cytoscape';
import React from 'react';
import styled from 'styled-components';
import { SERVICE_FRAMEWORK_NAME } from '../../../../../common/elasticsearch_fieldnames';
import { Buttons } from './Buttons';
import { Info } from './Info';
import { ServiceMetricFetcher } from './ServiceMetricFetcher';
import { MLJobLink } from '../../../shared/Links/MachineLearningLinks/MLJobLink';
import { getSeverityColor } from '../cytoscapeOptions';
import { asDecimal } from '../../../../utils/formatters';
import { getMetricChangeDescription } from '../../../../../../ml/public';

const popoverMinWidth = 280;

interface ContentsProps {
  isService: boolean;
  label: string;
  onFocusClick: () => void;
  selectedNodeData: cytoscape.NodeDataDefinition;
  selectedNodeServiceName: string;
}

const HealthStatusTitle = styled(EuiTitle)`
  display: inline;
  text-transform: uppercase;
`;

const VerticallyCentered = styled.div`
  display: flex;
  align-items: center;
`;

const SubduedText = styled.span`
  color: ${theme.euiTextSubduedColor};
`;

export const ContentLine = styled.section`
  line-height: 2;
`;

// IE 11 does not handle flex properties as expected. With browser detection,
// we can use regular div elements to render contents that are almost identical.
//
// This method of detecting IE is from a Stack Overflow answer:
// https://stackoverflow.com/a/21825207
//
// @ts-ignore `documentMode` is not recognized as a valid property of `document`.
const isIE11 = !!window.MSInputMethodContext && !!document.documentMode;

const FlexColumnGroup = (props: {
  children: React.ReactNode;
  style: React.CSSProperties;
  direction: 'column';
  gutterSize: 's';
}) => {
  if (isIE11) {
    const { direction, gutterSize, ...rest } = props;
    return <div {...rest} />;
  }
  return <EuiFlexGroup {...props} />;
};
const FlexColumnItem = (props: { children: React.ReactNode }) =>
  isIE11 ? <div {...props} /> : <EuiFlexItem {...props} />;

const ANOMALY_DETECTION_TITLE = i18n.translate(
  'xpack.apm.serviceMap.anomalyDetectionPopoverTitle',
  { defaultMessage: 'Anomaly Detection' }
);

const ANOMALY_DETECTION_INFO = i18n.translate(
  'xpack.apm.serviceMap.anomalyDetectionPopoverInfo',
  {
    defaultMessage:
      'Display the health of your service by enabling the anomaly detection feature in Machine Learning.'
  }
);

const ANOMALY_DETECTION_SCORE_METRIC = i18n.translate(
  'xpack.apm.serviceMap.anomalyDetectionPopoverScoreMetric',
  { defaultMessage: 'Score (max.)' }
);

const ANOMALY_DETECTION_LINK = i18n.translate(
  'xpack.apm.serviceMap.anomalyDetectionPopoverLink',
  { defaultMessage: 'View in Anomaly Explorer' }
);

export function Contents({
  selectedNodeData,
  isService,
  label,
  onFocusClick,
  selectedNodeServiceName
}: ContentsProps) {
  const frameworkName = selectedNodeData[SERVICE_FRAMEWORK_NAME];

  const severity = selectedNodeData.severity;
  const maxScore = selectedNodeData.max_score;
  const actualValue = selectedNodeData.actual_value;
  const typicalValue = selectedNodeData.typical_value;
  const hasAnomalyDetectionData = [
    severity,
    maxScore,
    actualValue,
    typicalValue
  ].every(value => value !== undefined);
  const anomalyDescription = hasAnomalyDetectionData
    ? getMetricChangeDescription(actualValue, typicalValue).message
    : null;
  return (
    <FlexColumnGroup
      direction="column"
      gutterSize="s"
      style={{ minWidth: popoverMinWidth }}
    >
      <FlexColumnItem>
        <EuiTitle size="xxs">
          <h3>{label}</h3>
        </EuiTitle>
        <EuiHorizontalRule margin="xs" />
      </FlexColumnItem>
      {hasAnomalyDetectionData && (
        <FlexColumnItem>
          <section>
            <HealthStatusTitle size="xxs">
              <h3>{ANOMALY_DETECTION_TITLE}</h3>
            </HealthStatusTitle>
            &nbsp;
            <EuiIconTip type="iInCircle" content={ANOMALY_DETECTION_INFO} />
          </section>
          <ContentLine>
            <EuiFlexGroup>
              <EuiFlexItem>
                <VerticallyCentered>
                  <EuiHealth
                    color={
                      (selectedNodeData.severity &&
                        getSeverityColor(selectedNodeData.severity)) ||
                      theme.euiColorLightShade
                    }
                  />
                  <SubduedText>{ANOMALY_DETECTION_SCORE_METRIC}</SubduedText>
                </VerticallyCentered>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <div>
                  {asDecimal(maxScore)}
                  <SubduedText>&nbsp;({anomalyDescription})</SubduedText>
                </div>
              </EuiFlexItem>
            </EuiFlexGroup>
          </ContentLine>
          <ContentLine>
            <MLJobLink jobId={selectedNodeData.job_id}>
              {ANOMALY_DETECTION_LINK}
            </MLJobLink>
          </ContentLine>
          <EuiHorizontalRule margin="xs" />
        </FlexColumnItem>
      )}
      <FlexColumnItem>
        {isService ? (
          <ServiceMetricFetcher
            frameworkName={frameworkName}
            serviceName={selectedNodeServiceName}
          />
        ) : (
          <Info {...selectedNodeData} />
        )}
      </FlexColumnItem>
      {isService && (
        <Buttons
          onFocusClick={onFocusClick}
          selectedNodeServiceName={selectedNodeServiceName}
        />
      )}
    </FlexColumnGroup>
  );
}
