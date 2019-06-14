/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

export interface Coordinate {
  x: number;
  y: number | null;
}

export interface RectCoordinate {
  x: number;
  x0: number;
}

export type ChartType = 'area' | 'linemark' | 'bar';
export type YUnit = 'percent' | 'bytes' | 'number' | 'integer';
