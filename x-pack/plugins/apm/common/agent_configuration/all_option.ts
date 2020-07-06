/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { i18n } from '@kbn/i18n';
import { ENVIRONMENT_NOT_DEFINED } from '../environment_filter_values';

export const ALL_OPTION_VALUE = 'ALL_OPTION_VALUE';

// human-readable label for service and environment. The "All" option should be translated.
// Everything else should be returned verbatim
export function getOptionLabel(value: string | undefined) {
  if (value === undefined || value === ALL_OPTION_VALUE) {
    return i18n.translate('xpack.apm.agentConfig.allOptionLabel', {
      defaultMessage: 'All',
    });
  }

  if (value === ENVIRONMENT_NOT_DEFINED) {
    return i18n.translate('xpack.apm.filter.environment.notDefinedLabel', {
      defaultMessage: 'Not defined',
    });
  }

  return value;
}

export function omitAllOption(value?: string) {
  return value === ALL_OPTION_VALUE ? undefined : value;
}
