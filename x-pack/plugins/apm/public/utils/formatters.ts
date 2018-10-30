/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { memoize } from 'lodash';

// TODO Add DefinitelyTyped definitions for @types/elastic__numeral
// import numeral from '@elastic/numeral';
import numeral = require('@elastic/numeral');

const UNIT_CUT_OFF = 10 * 1000000; // 10 seconds in microseconds

export function asSeconds(value: number, withUnit: boolean = true) {
  const formatted = asDecimal(value / 1000000);
  return `${formatted}${withUnit ? ' s' : ''}`;
}

export function asMillis(value: number, withUnit: boolean = true) {
  const formatted = asInteger(value / 1000);
  return `${formatted}${withUnit ? ' ms' : ''}`;
}

export function asMillisWithDefault(value?: number) {
  if (value == null) {
    return `N/A`;
  }
  return asMillis(value);
}

export const getTimeFormatter: (
  max: any
) => (value: any, withUnit?: boolean) => string = memoize(
  (max: any) => (max > UNIT_CUT_OFF ? asSeconds : asMillis)
);

export function timeUnit(max: any) {
  return max > UNIT_CUT_OFF ? 's' : 'ms';
}

/*
 * value: time in microseconds
 */
export function asTime(value: number): string {
  return getTimeFormatter(value)(value);
}

export function asDecimal(value: number): string {
  return numeral(value).format('0,0.0');
}

export function asInteger(value: number): string {
  return numeral(value).format('0,0');
}

export function tpmUnit(type: string): string {
  return type === 'request' ? 'rpm' : 'tpm';
}

export function getDurationPercent(
  itemDuration: number,
  totalDuration: number = 0,
  fallbackResult: any = ''
): string {
  if (totalDuration === 0) {
    return fallbackResult;
  }
  return numeral(itemDuration / totalDuration).format('0.00%');
}
