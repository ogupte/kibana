/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import React, { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';

cytoscape.use(dagre);

function useCytoscape(
  options: cytoscape.CytoscapeOptions,
  onMount?: (cy: cytoscape.Core) => void
) {
  const ref = useRef(null);
  const cy = useRef(null);

  useEffect(() => {
    cy.current = cytoscape({ ...options, container: ref.current });
    if (onMount) {
      onMount(cy.current);
    }
  });

  return [ref, cy.current] as [
    React.MutableRefObject<any>,
    cytoscape.Core | null
  ];
}

const initialCytoscapeOptions = {
  elements: [
    { data: { id: 'A', typeLabel: 'JS', label: 'selected instance' } },
    { data: { id: 'B', typeLabel: 'JS', label: 'service label5' } },
    { data: { source: 'A', target: 'B' } },
    { data: { id: 'C', typeLabel: 'JS', label: 'checkout service' } },
    { data: { source: 'A', target: 'C' } },
    { data: { id: 'D', typeLabel: 'DN', label: 'payment service' } },
    { data: { source: 'C', target: 'D' } },
    { data: { id: 'E', typeLabel: 'CO', label: 'database' } },
    { data: { source: 'D', target: 'E' } }
  ],
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
  ],
  layout: {
    // name: 'dagre',
    // rankDir: 'LR',
    // fit: true,
    // nodeDimensionsIncludeLabels: false,
    // padding: 100
  }
};

export function ServiceMap() {
  const [ref] = useCytoscape(initialCytoscapeOptions, cy => {
    console.log('onmount', { cy });
  });

  return <div style={{ height: '100vh' }} ref={ref}></div>;
}
