/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
import cytoscape from 'cytoscape';
import { CSSProperties } from 'react';
import {
  SERVICE_NAME,
  SPAN_DESTINATION_SERVICE_RESOURCE,
} from '../../../../common/elasticsearch_fieldnames';
import { EuiTheme } from '../../../../../observability/public';
import { defaultIcon, iconForNode } from './icons';
import { ServiceAnomalyStats } from '../../../../common/anomaly_detection';
import { severity, getSeverity } from './Popover/getSeverity';

export const popoverWidth = 280;

export function getSeverityColor(theme: EuiTheme, nodeSeverity?: string) {
  switch (nodeSeverity) {
    case severity.warning:
      return theme.eui.euiColorVis0;
    case severity.minor:
    case severity.major:
      return theme.eui.euiColorVis5;
    case severity.critical:
      return theme.eui.euiColorVis9;
    default:
      return;
  }
}

function getNodeSeverity(el: cytoscape.NodeSingular) {
  const serviceAnomalyStats: ServiceAnomalyStats | undefined = el.data(
    'serviceAnomalyStats'
  );
  return getSeverity(serviceAnomalyStats?.anomalyScore);
}

function getBorderColorFn(
  theme: EuiTheme
): cytoscape.Css.MapperFunction<cytoscape.NodeSingular, string> {
  return (el: cytoscape.NodeSingular) => {
    const hasAnomalyDetectionJob = el.data('serviceAnomalyStats') !== undefined;
    const nodeSeverity = getNodeSeverity(el);
    if (hasAnomalyDetectionJob) {
      return (
        getSeverityColor(theme, nodeSeverity) || theme.eui.euiColorMediumShade
      );
    }
    if (el.hasClass('primary') || el.selected()) {
      return theme.eui.euiColorPrimary;
    }
    return theme.eui.euiColorMediumShade;
  };
}

const getBorderStyle: cytoscape.Css.MapperFunction<
  cytoscape.NodeSingular,
  cytoscape.Css.LineStyle
> = (el: cytoscape.NodeSingular) => {
  const nodeSeverity = getNodeSeverity(el);
  if (nodeSeverity === severity.critical) {
    return 'double';
  } else {
    return 'solid';
  }
};

function getBorderWidth(el: cytoscape.NodeSingular) {
  const nodeSeverity = getNodeSeverity(el);

  if (nodeSeverity === severity.minor || nodeSeverity === severity.major) {
    return 4;
  } else if (nodeSeverity === severity.critical) {
    return 8;
  } else {
    return 4;
  }
}

// IE 11 does not properly load some SVGs or draw certain shapes. This causes
// a runtime error and the map fails work at all. We would prefer to do some
// kind of feature detection rather than browser detection, but some of these
// limitations are not well documented for older browsers.
//
// This method of detecting IE is from a Stack Overflow answer:
// https://stackoverflow.com/a/21825207
//
// @ts-ignore `documentMode` is not recognized as a valid property of `document`.
const isIE11 = !!window.MSInputMethodContext && !!document.documentMode;

export const getAnimationOptions = (
  theme: EuiTheme
): cytoscape.AnimationOptions => ({
  duration: parseInt(theme.eui.euiAnimSpeedNormal, 10),
  // @ts-ignore The cubic-bezier options here are not recognized by the cytoscape types
  easing: theme.eui.euiAnimSlightBounce,
});

const zIndexNode = 200;
const zIndexEdge = 100;
const zIndexEdgeHighlight = 110;
const zIndexEdgeHover = 120;

export const getNodeHeight = (theme: EuiTheme): number =>
  parseInt(theme.eui.avatarSizing.l.size, 10);

function isService(el: cytoscape.NodeSingular) {
  return el.data(SERVICE_NAME) !== undefined;
}

const getStyle = (theme: EuiTheme): cytoscape.Stylesheet[] => {
  const lineColor = theme.eui.euiColorMediumShade;
  return [
    {
      selector: 'node',
      style: {
        'background-color': theme.eui.euiColorGhost,
        // The DefinitelyTyped definitions don't specify that a function can be
        // used here.
        //
        // @ts-ignore
        'background-image': isIE11
          ? undefined
          : (el: cytoscape.NodeSingular) => iconForNode(el) ?? defaultIcon,
        'background-height': (el: cytoscape.NodeSingular) =>
          isService(el) ? '60%' : '40%',
        'background-width': (el: cytoscape.NodeSingular) =>
          isService(el) ? '60%' : '40%',
        'border-color': getBorderColorFn(theme),
        'border-style': getBorderStyle,
        'border-width': getBorderWidth,
        color: (el: cytoscape.NodeSingular) =>
          el.hasClass('primary') || el.selected()
            ? theme.eui.euiColorPrimaryText
            : theme.eui.textColors.text,
        // theme.euiFontFamily doesn't work here for some reason, so we're just
        // specifying a subset of the fonts for the label text.
        'font-family': 'Inter UI, Segoe UI, Helvetica, Arial, sans-serif',
        'font-size': theme.eui.euiFontSizeS,
        ghost: 'yes',
        'ghost-offset-x': 0,
        'ghost-offset-y': 2,
        'ghost-opacity': 0.15,
        height: getNodeHeight(theme),
        label: (el: cytoscape.NodeSingular) =>
          isService(el)
            ? el.data(SERVICE_NAME)
            : el.data(SPAN_DESTINATION_SERVICE_RESOURCE),
        'min-zoomed-font-size': parseInt(theme.eui.euiSizeS, 10),
        'overlay-opacity': 0,
        shape: (el: cytoscape.NodeSingular) =>
          isService(el) ? (isIE11 ? 'rectangle' : 'ellipse') : 'diamond',
        'text-background-color': theme.eui.euiColorPrimary,
        'text-background-opacity': (el: cytoscape.NodeSingular) =>
          el.hasClass('primary') || el.selected() ? 0.1 : 0,
        'text-background-padding': theme.eui.paddingSizes.xs,
        'text-background-shape': 'roundrectangle',
        'text-margin-y': parseInt(theme.eui.paddingSizes.s, 10),
        'text-max-width': '200px',
        'text-valign': 'bottom',
        'text-wrap': 'ellipsis',
        width: theme.eui.avatarSizing.l.size,
        'z-index': zIndexNode,
      },
    },
    {
      selector: 'edge',
      style: {
        'curve-style': 'unbundled-bezier',
        'line-color': lineColor,
        'overlay-opacity': 0,
        'target-arrow-color': lineColor,
        'target-arrow-shape': isIE11 ? 'none' : 'triangle',
        // The DefinitelyTyped definitions don't specify this property since it's
        // fairly new.
        //
        // @ts-ignore
        'target-distance-from-node': isIE11
          ? undefined
          : theme.eui.paddingSizes.xs,
        width: 1,
        'source-arrow-shape': 'none',
        'z-index': zIndexEdge,
      },
    },
    {
      selector: 'edge[bidirectional]',
      style: {
        'source-arrow-shape': isIE11 ? 'none' : 'triangle',
        'source-arrow-color': lineColor,
        'target-arrow-shape': isIE11 ? 'none' : 'triangle',
        // @ts-ignore
        'source-distance-from-node': isIE11
          ? undefined
          : parseInt(theme.eui.paddingSizes.xs, 10),
        'target-distance-from-node': isIE11
          ? undefined
          : parseInt(theme.eui.paddingSizes.xs, 10),
      },
    },
    {
      selector: 'edge[isInverseEdge]',
      // @ts-ignore DefinitelyTyped says visibility is "none" but it's
      // actually "hidden"
      style: { visibility: 'hidden' },
    },
    {
      selector: 'edge.nodeHover',
      style: {
        width: 4,
        // @ts-ignore
        'z-index': zIndexEdgeHover,
        'line-color': theme.eui.euiColorDarkShade,
        'source-arrow-color': theme.eui.euiColorDarkShade,
        'target-arrow-color': theme.eui.euiColorDarkShade,
      },
    },
    {
      selector: 'node.hover',
      style: {
        'border-width': getBorderWidth,
      },
    },
    {
      selector: 'edge.highlight',
      style: {
        width: 4,
        'line-color': theme.eui.euiColorPrimary,
        'source-arrow-color': theme.eui.euiColorPrimary,
        'target-arrow-color': theme.eui.euiColorPrimary,
        // @ts-ignore
        'z-index': zIndexEdgeHighlight,
      },
    },
  ];
};

// The CSS styles for the div containing the cytoscape element. Makes a
// background grid of dots.
export const getCytoscapeDivStyle = (theme: EuiTheme): CSSProperties => ({
  background: `linear-gradient(
  90deg,
  ${theme.eui.euiPageBackgroundColor}
    calc(${theme.eui.euiSizeL} - calc(${theme.eui.euiSizeXS} / 2)),
  transparent 1%
)
center,
linear-gradient(
  ${theme.eui.euiPageBackgroundColor}
    calc(${theme.eui.euiSizeL} - calc(${theme.eui.euiSizeXS} / 2)),
  transparent 1%
)
center,
${theme.eui.euiColorLightShade}`,
  backgroundSize: `${theme.eui.euiSizeL} ${theme.eui.euiSizeL}`,
  margin: `-${theme.eui.gutterTypes.gutterLarge}`,
  marginTop: 0,
});

export const getCytoscapeOptions = (
  theme: EuiTheme
): cytoscape.CytoscapeOptions => ({
  // autoungrabify: true,
  boxSelectionEnabled: false,
  maxZoom: 3,
  minZoom: 0.2,
  style: getStyle(theme),
});
