/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import React, { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
// @ts-ignore
import dagre from 'cytoscape-dagre';
import { useUrlParams } from '../../../hooks/useUrlParams';
import { useFetcher } from '../../../hooks/useFetcher';
import { callApmApi } from '../../../services/rest/callApmApi';

cytoscape.use(dagre);

function useCytoscape(
  options: cytoscape.CytoscapeOptions,
  onMount?: (cy: cytoscape.Core) => void
): [React.RefObject<HTMLDivElement>, React.RefObject<cytoscape.Core | null>] {
  const ref = useRef(null);
  const cy = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    cy.current = cytoscape({ ...options, container: ref.current });
    if (onMount) {
      onMount(cy.current);
    }
  });

  return [ref, cy];
}

const initialCytoscapeOptions = {
  // elements: [
  //   { data: { id: 'A', typeLabel: 'JS', label: 'selected instance' } },
  //   { data: { id: 'B', typeLabel: 'JS', label: 'service label5' } },
  //   { data: { source: 'A', target: 'B' } },
  //   { data: { id: 'C', typeLabel: 'JS', label: 'checkout service' } },
  //   { data: { source: 'A', target: 'C' } },
  //   { data: { id: 'D', typeLabel: 'DN', label: 'payment service' } },
  //   { data: { source: 'C', target: 'D' } },
  //   { data: { id: 'E', typeLabel: 'CO', label: 'database' } },
  //   { data: { source: 'D', target: 'E' } }
  // ],
  zoomingEnabled: false,
  panningEnabled: false,
  boxSelectionEnabled: false,
  autoungrabify: true,
  autounselectify: true,
  style: [
    {
      selector: 'node',
      style: {
        label: 'data(label)'
      }
    },
    {
      selector: 'edge',
      style: {
        'target-arrow-shape': 'triangle'
      }
    }
  ]
  // layout: {
  // name: 'dagre',
  // rankDir: 'LR',
  // fit: true,
  // nodeDimensionsIncludeLabels: false,
  // padding: 100
  // }
};

export function ServiceMap() {
  const {
    urlParams: { start, end },
    uiFilters
  } = useUrlParams();
  const { data = [] /* , status*/ } = useFetcher(async () => {
    if (start && end) {
      return callApmApi({
        pathname: '/api/apm/service-map',
        params: { query: { start, end } }
      });
    }
  }, [start, end]);

  const [elRef, cyRef] = useCytoscape(initialCytoscapeOptions, cy => {
    // console.log('onmount', { cy });
  });

  useEffect(() => {
    if (cyRef.current) {
      const cy = cyRef.current;
      cy.remove('*');
      cy.add(data);
      cy.layout({
        name: 'dagre',
        fit: true,
        nodeDimensionsIncludeLabels: false,
        padding: 100
      }).run();
    }
  }, [cyRef, data]);

  return <div style={{ height: '100vh' }} ref={elRef}></div>;
}
