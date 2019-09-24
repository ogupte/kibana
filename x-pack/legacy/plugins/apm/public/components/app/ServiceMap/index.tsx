/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import React from 'react';
import styled from 'styled-components';
import theme from '@elastic/eui/dist/eui_theme_light.json';
import { useUrlParams } from '../../../hooks/useUrlParams';
import { useFetcher } from '../../../hooks/useFetcher';
import { callApmApi } from '../../../services/rest/callApmApi';
import { Cytoscape } from './Cytoscape';

const Background = styled('div')`
  background-image: radial-gradient(
    ${theme.euiColorLightShade} 20%,
    transparent 1%
  );
  background-color: ${theme.euiColorLightestShade};
  background-size: ${theme.paddingSizes.s} ${theme.paddingSizes.s};
  margin: -${theme.gutterTypes.gutterLarge};
`;

interface ServiceMapProps {
  serviceName?: string;
}

const cytoscapeDivStyle = { height: '85vh' };

export function ServiceMap({ serviceName }: ServiceMapProps) {
  const {
    urlParams: { start, end }
  } = useUrlParams();

  const { data = [] } = useFetcher(async () => {
    if (start && end) {
      return callApmApi({
        pathname: '/api/apm/service-map',
        params: { query: { start, end } }
      });
    }
  }, [start, end]);

  return (
    <Background>
      <Cytoscape
        elements={data}
        serviceName={serviceName}
        style={cytoscapeDivStyle}
      />
    </Background>
  );
}
