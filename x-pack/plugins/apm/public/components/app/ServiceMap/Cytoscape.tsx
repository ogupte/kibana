/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import React, {
  createContext,
  CSSProperties,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import cytoscape from 'cytoscape';
import { debounce } from 'lodash';
import dagre from 'cytoscape-dagre';
import { useTheme } from '../../../hooks/useTheme';
import {
  getAnimationOptions,
  getCytoscapeOptions,
  getNodeHeight,
} from './cytoscapeOptions';
import { useUiTracker } from '../../../../../observability/public';

cytoscape.use(dagre);

export const CytoscapeContext = createContext<cytoscape.Core | undefined>(
  undefined
);

interface CytoscapeProps {
  children?: ReactNode;
  elements: cytoscape.ElementDefinition[];
  height: number;
  width: number;
  serviceName?: string;
  style?: CSSProperties;
  layout?: string;
  edgeType?: string;
}

function useCytoscape(options: cytoscape.CytoscapeOptions) {
  const [cy, setCy] = useState<cytoscape.Core | undefined>(undefined);
  const ref = useRef(null);

  useEffect(() => {
    if (!cy) {
      setCy(cytoscape({ ...options, container: ref.current }));
    }
  }, [options, cy]);

  // Destroy the cytoscape instance on unmount
  useEffect(() => {
    return () => {
      if (cy) {
        cy.destroy();
      }
    };
  }, [cy]);

  return [ref, cy] as [React.MutableRefObject<any>, cytoscape.Core | undefined];
}

function rotatePoint(
  { x, y }: { x: number; y: number },
  degreesRotated: number
) {
  const radiansPerDegree = Math.PI / 180;
  const θ = radiansPerDegree * degreesRotated;
  const cosθ = Math.cos(θ);
  const sinθ = Math.sin(θ);
  return {
    x: x * cosθ - y * sinθ,
    y: x * sinθ + y * cosθ,
  };
}

function getDagreLayout(cy: cytoscape.Core) {
  let longestPathSize = 1;
  cy.elements().depthFirstSearch({
    root: cy.nodes().roots(),
    visit(v, e, u, i, depth) {
      longestPathSize = Math.max(longestPathSize, depth);
    },
  });

  return cy.layout({
    name: 'dagre',
    // transform: (node: any, pos: cytoscape.Position) => rotatePoint(pos, -90),
    fit: true,
    // padding: nodeHeight,
    spacingFactor: 1.2,
    // boundingBox: { x1: 0, y1: 0, w: height, h: width },
    nodeSep: 64,
    edgeSep: 10,
    rankSep: 64,
    rankDir: 'LR',
    ranker: 'network-simplex', // 'network-simplex', 'tight-tree', 'longest-path'
    // minLen: (edge: cytoscape.EdgeSingular) => {
    //   const source = edge.source();
    //   const target = edge.target();
    //   if (source.data('agent.name') === 'rum-js' && target.data('span.type')) {
    //     return longestPathSize;
    //   }
    //   return 1;
    // },
    // edgeWeight: (edge: cytoscape.EdgeSingular) => {
    //   const source = edge.source();
    //   const target = edge.target();
    //   if (source.data('agent.name') && target.data('agent.name')) {
    //     if (source.data('agent.name') === target.data('agent.name')) {
    //       return 4;
    //     }
    //     return 2;
    //   }
    //   return 1;
    // },
  });
}

function getCoseLayout(cy: cytoscape.Core) {
  return cy.layout({
    name: 'cose',
    fit: true,
    componentSpacing: 64,
    idealEdgeLength: () => 64,
    animate: false,
  });
}

function getLayoutOptions(
  selectedRoots: string[],
  height: number,
  width: number,
  nodeHeight: number
): cytoscape.LayoutOptions {
  return {
    name: 'breadthfirst',
    // @ts-ignore DefinitelyTyped is incorrect here. Roots can be an Array
    roots: selectedRoots.length ? selectedRoots : undefined,
    fit: true,
    padding: nodeHeight,
    spacingFactor: 1.2,
    // @ts-ignore
    // Rotate nodes counter-clockwise to transform layout from top→bottom to left→right.
    // The extra 5° achieves the effect of separating overlapping taxi-styled edges.
    transform: (node: any, pos: cytoscape.Position) => rotatePoint(pos, -95),
    // swap width/height of boundingBox to compensate for the rotation
    boundingBox: { x1: 0, y1: 0, w: height, h: width },
  };
}

function selectRoots(cy: cytoscape.Core): string[] {
  const bfs = cy.elements().bfs({
    roots: cy.elements().leaves(),
  });
  const furthestNodeFromLeaves = bfs.path.last();
  return cy
    .elements()
    .roots()
    .union(furthestNodeFromLeaves)
    .map((el) => el.id());
}

export function Cytoscape({
  children,
  elements,
  height,
  width,
  serviceName,
  style,
  layout,
  edgeType,
}: CytoscapeProps) {
  const theme = useTheme();
  const [ref, cy] = useCytoscape({
    ...getCytoscapeOptions(theme, layout, edgeType),
    elements,
  });

  const nodeHeight = getNodeHeight(theme);

  // Add the height to the div style. The height is a separate prop because it
  // is required and can trigger rendering when changed.
  const divStyle = { ...style, height };

  const trackApmEvent = useUiTracker({ app: 'apm' });

  // Set up cytoscape event handlers
  useEffect(() => {
    const resetConnectedEdgeStyle = (node?: cytoscape.NodeSingular) => {
      if (cy) {
        cy.edges().removeClass('highlight');

        if (node) {
          node.connectedEdges().addClass('highlight');
        }
      }
    };

    const dataHandler: cytoscape.EventHandler = (event) => {
      if (cy && cy.elements().length > 0) {
        if (serviceName) {
          resetConnectedEdgeStyle(cy.getElementById(serviceName));
          // Add the "primary" class to the node if its id matches the serviceName.
          if (cy.nodes().length > 0) {
            cy.nodes().removeClass('primary');
            cy.getElementById(serviceName).addClass('primary');
          }
        } else {
          resetConnectedEdgeStyle();
        }

        const selectedRoots = selectRoots(event.cy);
        if (layout === 'dagre') {
          getDagreLayout(cy).run();
          return;
        }
        if (layout === 'cose') {
          getCoseLayout(cy).run();
          return;
        }
        cy.layout(
          getLayoutOptions(selectedRoots, height, width, nodeHeight)
        ).run();
      }
    };
    let layoutstopDelayTimeout: NodeJS.Timeout;
    const layoutstopHandler: cytoscape.EventHandler = (event) => {
      // This 0ms timer is necessary to prevent a race condition
      // between the layout finishing rendering and viewport centering
      layoutstopDelayTimeout = setTimeout(() => {
        if (serviceName) {
          event.cy.animate({
            ...getAnimationOptions(theme),
            fit: {
              eles: event.cy.elements(),
              padding: nodeHeight,
            },
            center: {
              eles: event.cy.getElementById(serviceName),
            },
          });
        } else {
          event.cy.fit(undefined, nodeHeight);
        }
      }, 0);
    };
    // debounce hover tracking so it doesn't spam telemetry with redundant events
    const trackNodeEdgeHover = debounce(
      () => trackApmEvent({ metric: 'service_map_node_or_edge_hover' }),
      1000
    );
    const mouseoverHandler: cytoscape.EventHandler = (event) => {
      trackNodeEdgeHover();
      event.target.addClass('hover');
      event.target.connectedEdges().addClass('nodeHover');
    };
    const mouseoutHandler: cytoscape.EventHandler = (event) => {
      event.target.removeClass('hover');
      event.target.connectedEdges().removeClass('nodeHover');
    };
    const selectHandler: cytoscape.EventHandler = (event) => {
      trackApmEvent({ metric: 'service_map_node_select' });
      resetConnectedEdgeStyle(event.target);
    };
    const unselectHandler: cytoscape.EventHandler = (event) => {
      resetConnectedEdgeStyle(
        serviceName ? event.cy.getElementById(serviceName) : undefined
      );
    };
    const debugHandler: cytoscape.EventHandler = (event) => {
      const debugEnabled = sessionStorage.getItem('apm_debug') === 'true';
      if (debugEnabled) {
        // eslint-disable-next-line no-console
        console.debug('cytoscape:', event);
      }
    };

    if (cy) {
      cy.on('data layoutstop select unselect', debugHandler);
      cy.on('data', dataHandler);
      cy.on('layoutstop', layoutstopHandler);
      cy.on('mouseover', 'edge, node', mouseoverHandler);
      cy.on('mouseout', 'edge, node', mouseoutHandler);
      cy.on('select', 'node', selectHandler);
      cy.on('unselect', 'node', unselectHandler);

      cy.remove(cy.elements());
      cy.add(elements);
      cy.trigger('data');
    }

    return () => {
      if (cy) {
        cy.removeListener(
          'data layoutstop select unselect',
          undefined,
          debugHandler
        );
        cy.removeListener('data', undefined, dataHandler);
        cy.removeListener('layoutstop', undefined, layoutstopHandler);
        cy.removeListener('mouseover', 'edge, node', mouseoverHandler);
        cy.removeListener('mouseout', 'edge, node', mouseoutHandler);
        cy.removeListener('select', 'node', selectHandler);
        cy.removeListener('unselect', 'node', unselectHandler);
      }
      clearTimeout(layoutstopDelayTimeout);
    };
  }, [
    cy,
    elements,
    height,
    serviceName,
    trackApmEvent,
    width,
    nodeHeight,
    theme,
    layout,
  ]);

  return (
    <CytoscapeContext.Provider value={cy}>
      <div ref={ref} style={divStyle}>
        {children}
      </div>
    </CytoscapeContext.Provider>
  );
}
