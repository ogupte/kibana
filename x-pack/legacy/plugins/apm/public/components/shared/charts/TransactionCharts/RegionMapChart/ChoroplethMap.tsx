/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { isEqual } from 'lodash';
import {
  Map,
  MapboxOptions,
  NavigationControl,
  Popup,
  GeoJSONSourceOptions
} from 'mapbox-gl';
import { GeoJsonProperties } from 'geojson';

interface ChoroplethDataElement {
  key: string;
  value: number;
  [property: string]: any;
}

interface Props {
  style?: React.CSSProperties;
  geojsonSource: NonNullable<GeoJSONSourceOptions['data']>;
  geojsonKeyProperty: string;
  data: ChoroplethDataElement[];
  renderTooltip: (props: {
    geojsonProperties: NonNullable<mapboxgl.MapboxGeoJSONFeature['properties']>;
    data?: ChoroplethDataElement;
  }) => React.ReactElement | null;
  initialMapboxOptions?: Partial<MapboxOptions>;
}

const CHOROPLETH_LAYER_ID = 'choropleth_layer';
const CHOROPLETH_POLYGONS_SOURCE_ID = 'choropleth_polygons';

const linearScale = (x: number, range = { min: 0, max: 1 }) =>
  (range.max - range.min) * x + range.min;
const quadradicScale = (x: number, range = { min: 0, max: 1 }) =>
  4 * (range.max - range.min) * (x ** 2 - x) + range.max;

export function getProgressionColor(scale: number) {
  const hue = quadradicScale(scale, { min: 200, max: 218 });
  const saturation = 55;
  const lightness = Math.round(linearScale(1 - scale, { min: 35, max: 98 }));
  return `hsl(${hue},${saturation}%,${lightness}%)`;
}

export function getDataRange(data: Props['data']) {
  const firstValue = data[0] ? data[0].value : 0;
  return data.reduce(
    ([min, max], { value }) => [Math.min(min, value), Math.max(max, value)],
    [firstValue, firstValue]
  );
}

export const ChoroplethMap: React.SFC<Props> = props => {
  const {
    style,
    geojsonSource,
    geojsonKeyProperty,
    data,
    renderTooltip: ToolTip,
    initialMapboxOptions
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<Map | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const popupContainerRef = useRef<HTMLDivElement>(null);
  const enableScrollZoom = useRef(false);
  const [hoverState, setHoverState] = useState<{
    geojsonProperties?: GeoJsonProperties;
    data?: ChoroplethDataElement;
  }>({});

  const getValueScale = useCallback(
    (value: number) => {
      const [min, max] = getDataRange(data);
      return (value - min) / (max - min);
    },
    [data]
  );

  const controlScrollZoomOnWheel = useCallback((event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
    } else {
      event.stopPropagation();
    }
  }, []);

  const updateHoverStateOnMousemove = useCallback(
    (event: mapboxgl.MapMouseEvent & mapboxgl.EventData) => {
      if (map && popupRef.current && data.length) {
        popupRef.current.setLngLat(event.lngLat);
        const hoverFeatures = map.queryRenderedFeatures(event.point, {
          layers: [CHOROPLETH_LAYER_ID]
        });
        if (hoverFeatures[0]) {
          const geojsonProperties = hoverFeatures[0].properties;
          if (!isEqual(geojsonProperties, hoverState.geojsonProperties)) {
            const matchedData = data.find(
              ({ key }) =>
                geojsonProperties &&
                key === geojsonProperties[geojsonKeyProperty]
            );
            setHoverState({ geojsonProperties, data: matchedData });
          }
        } else {
          setHoverState({});
        }
      }
    },
    [map, data, hoverState.geojsonProperties, geojsonKeyProperty]
  );

  const updateHoverStateOnMousemoveRef = useRef<
    ((event: mapboxgl.MapMouseEvent & mapboxgl.EventData) => void) | null
  >(null);

  const updateHoverStateOnMouseout = useCallback(
    (event: mapboxgl.MapMouseEvent & mapboxgl.EventData) => {
      enableScrollZoom.current = false;
      setHoverState({});
    },
    []
  );

  const updateHoverStateOnMouseoutRef = useRef<
    ((event: mapboxgl.MapMouseEvent & mapboxgl.EventData) => void) | null
  >(null);

  useEffect(() => {
    if (containerRef.current !== null) {
      // set up Map object
      const mapboxMap = new Map({
        attributionControl: false,
        container: containerRef.current,
        style:
          'https://tiles.maps.elastic.co/styles/osm-bright-desaturated/style.json',
        ...initialMapboxOptions
      });
      mapboxMap.dragRotate.disable();
      mapboxMap.touchZoomRotate.disableRotation();
      mapboxMap.addControl(
        new NavigationControl({ showCompass: false }),
        'top-left'
      );

      // set up Popup object
      popupRef.current = new Popup({
        closeButton: false,
        closeOnClick: false
      });

      // only scroll zoom when key is pressed
      const canvasElement = mapboxMap.getCanvas();
      canvasElement.addEventListener('wheel', controlScrollZoomOnWheel);

      mapboxMap.on('load', () => {
        mapboxMap.addSource(CHOROPLETH_POLYGONS_SOURCE_ID, {
          type: 'geojson',
          data: geojsonSource
        });
        setMap(mapboxMap);
      });

      // cleanup function called when component unmounts
      return () => {
        canvasElement.removeEventListener('wheel', controlScrollZoomOnWheel);
      };
    }
  }, [controlScrollZoomOnWheel, geojsonSource, initialMapboxOptions]);

  useEffect(() => {
    if (map) {
      if (
        updateHoverStateOnMousemoveRef.current &&
        updateHoverStateOnMouseoutRef.current
      ) {
        map.off('mousemove', updateHoverStateOnMousemoveRef.current);
        map.off('mouseout', updateHoverStateOnMouseoutRef.current);
      }
      map.on('mousemove', updateHoverStateOnMousemove);
      map.on('mouseout', updateHoverStateOnMouseout);
      updateHoverStateOnMousemoveRef.current = updateHoverStateOnMousemove;
      updateHoverStateOnMouseoutRef.current = updateHoverStateOnMouseout;
    }
  }, [map, updateHoverStateOnMousemove, updateHoverStateOnMouseout]);

  useEffect(() => {
    if (map) {
      const symbolLayer = (map.getStyle().layers || []).find(
        ({ type }) => type === 'symbol'
      );
      if (map.getLayer(CHOROPLETH_LAYER_ID)) {
        map.removeLayer(CHOROPLETH_LAYER_ID);
      }
      if (data.length) {
        map.addLayer(
          {
            id: CHOROPLETH_LAYER_ID,
            type: 'fill',
            source: CHOROPLETH_POLYGONS_SOURCE_ID,
            layout: {},
            paint: {
              'fill-opacity': 0.75,
              'fill-color': data.length
                ? {
                    property: geojsonKeyProperty,
                    stops: data.map(({ key, value }) => [
                      key,
                      getProgressionColor(getValueScale(value))
                    ]),
                    type: 'categorical',
                    default: 'transparent'
                  }
                : 'transparent'
            }
          },
          symbolLayer ? symbolLayer.id : undefined
        );
      }
    }
  }, [map, data, getValueScale, geojsonKeyProperty]);

  useEffect(() => {
    if (popupContainerRef.current && map && popupRef.current) {
      if (hoverState.geojsonProperties && hoverState.data) {
        popupRef.current.setDOMContent(popupContainerRef.current).addTo(map);
        if (popupContainerRef.current.parentElement) {
          popupContainerRef.current.parentElement.style.pointerEvents = 'none';
        }
      } else {
        popupRef.current.remove();
      }
    }
  }, [map, hoverState]);

  return (
    <>
      <div ref={containerRef} style={{ height: 256, ...style }} />
      <div style={{ display: 'none' }}>
        <div ref={popupContainerRef}>
          <ToolTip
            geojsonProperties={hoverState.geojsonProperties || {}}
            data={hoverState.data}
          />
        </div>
      </div>
    </>
  );
};
