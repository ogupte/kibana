/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import theme from '@elastic/eui/dist/eui_theme_light.json';
import React, { useMemo, useEffect, useState } from 'react';
import { ServiceMapAPIResponse } from '../../../../server/lib/service_map/get_service_map';
import {
  Connection,
  ServiceConnectionNode,
  ConnectionNode
} from '../../../../common/service_map';
import { useLicense } from '../../../hooks/useLicense';
import { useUrlParams } from '../../../hooks/useUrlParams';
import { Controls } from './Controls';
import { Cytoscape } from './Cytoscape';
import { PlatinumLicensePrompt } from './PlatinumLicensePrompt';
import { useCallApmApi } from '../../../hooks/useCallApmApi';
import { useDeepObjectIdentity } from '../../../hooks/useDeepObjectIdentity';

interface ServiceMapProps {
  serviceName?: string;
}

const cytoscapeDivStyle = {
  height: '85vh',
  background: `linear-gradient(
  90deg,
  ${theme.euiPageBackgroundColor}
    calc(${theme.euiSizeL} - calc(${theme.euiSizeXS} / 2)),
  transparent 1%
)
center,
linear-gradient(
  ${theme.euiPageBackgroundColor}
    calc(${theme.euiSizeL} - calc(${theme.euiSizeXS} / 2)),
  transparent 1%
)
center,
${theme.euiColorLightShade}`,
  backgroundSize: `${theme.euiSizeL} ${theme.euiSizeL}`,
  margin: `-${theme.gutterTypes.gutterLarge}`
};

const MAX_REQUESTS = 5;

function getConnectionNodeId(
  node: ConnectionNode,
  destMap: Record<string, ServiceConnectionNode> = {}
): string {
  if ('destination.address' in node) {
    const mapped = destMap[node['destination.address']];
    return mapped
      ? getConnectionNodeId(mapped, destMap)
      : node['destination.address'];
  }
  return node['service.name'];
}

function getEdgeId(source: ConnectionNode, destination: ConnectionNode) {
  return `${getConnectionNodeId(source)}~${getConnectionNodeId(destination)}`;
}

export function ServiceMap({ serviceName }: ServiceMapProps) {
  const { urlParams, uiFilters } = useUrlParams();

  const callApmApi = useCallApmApi();

  const params = useDeepObjectIdentity({
    start: urlParams.start,
    end: urlParams.end,
    environment: urlParams.environment,
    serviceName,
    uiFilters: {
      ...uiFilters,
      environment: undefined
    }
  });

  const [responses, setResponses] = useState<ServiceMapAPIResponse[]>([]);

  const getNext = (input: { reset?: boolean; after?: string | undefined }) => {
    const { start, end, uiFilters: strippedUiFilters, ...query } = params;

    if (input.reset) {
      setResponses([]);
    }

    if (start && end) {
      callApmApi({
        pathname: '/api/apm/service-map',
        params: {
          query: {
            ...query,
            start,
            end,
            uiFilters: JSON.stringify(strippedUiFilters),
            after: input.after
          }
        }
      }).then(data => {
        setResponses(resp => resp.concat(data));

        const shouldGetNext = responses.length + 1 < MAX_REQUESTS && data.after;

        if (shouldGetNext) {
          getNext({ after: data.after });
        }
      });
    }
  };

  useEffect(() => {
    getNext({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const elements = useMemo(() => {
    const destMap = responses.reduce((prev, response) => {
      return {
        ...prev,
        ...response.destinationMap
      };
    }, {} as Record<string, ServiceConnectionNode>);

    const nodesById = responses
      .flatMap(response => response.connections)
      .reduce((acc, connection) => {
        const sourceId = getConnectionNodeId(connection.source, destMap);
        const destId = getConnectionNodeId(connection.destination, destMap);

        return {
          ...acc,
          [sourceId]: destMap[sourceId] || connection.source,
          [destId]: destMap[destId] || connection.destination
        };
      }, {} as Record<string, ConnectionNode>);

    const edgesById = responses
      .flatMap(response => response.connections)
      .reduce((acc, connection) => {
        const source =
          nodesById[getConnectionNodeId(connection.source, destMap)];
        const destination =
          nodesById[getConnectionNodeId(connection.destination, destMap)];

        if (source === destination) {
          return acc;
        }

        return {
          ...acc,
          [getEdgeId(source, destination)]: {
            source,
            destination
          }
        };
      }, {} as Record<string, Connection>);

    return [
      ...(Object.values(nodesById) as ConnectionNode[]).map(node => {
        return {
          group: 'nodes' as const,
          data: {
            id: getConnectionNodeId(node, destMap),
            ...('agent.name' in node ? { agentName: node['agent.name'] } : {})
          }
        };
      }),
      ...(Object.values(edgesById) as Connection[]).map(connection => {
        return {
          group: 'edges' as const,
          data: {
            id: getEdgeId(connection.source, connection.destination),
            source: getConnectionNodeId(connection.source, destMap),
            target: getConnectionNodeId(connection.destination, destMap)
          }
        };
      })
    ];
  }, [responses]);

  const license = useLicense();

  const isValidPlatinumLicense =
    license?.isActive &&
    (license?.type === 'platinum' || license?.type === 'trial');

  return isValidPlatinumLicense ? (
    <Cytoscape
      elements={elements}
      serviceName={serviceName}
      style={cytoscapeDivStyle}
    >
      <Controls />
    </Cytoscape>
  ) : (
    <PlatinumLicensePrompt />
  );
}
