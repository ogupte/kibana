/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { i18n } from '@kbn/i18n';
import { Server } from 'hapi';
// import { Legacy } from 'kibana';
import { resolve } from 'path';
import {
  InternalCoreSetup,
  PluginInitializerContext
} from '../../../../src/core/server';
import { LegacyPluginInitializer } from '../../../../src/legacy/types';
import mappings from './mappings.json';
import { plugin } from './server/new-platform/index';
//@ts-ignore
import { TaskManager, RunContext } from '../legacy/plugins/task_manager';
import { serviceMapRun } from './server/lib/servicemap';
import { TaskInstance } from '../task_manager';

export const apm: LegacyPluginInitializer = kibana => {
  return new kibana.Plugin({
    require: [
      'kibana',
      'elasticsearch',
      'xpack_main',
      'apm_oss',
      'task_manager'
    ],
    id: 'apm',
    configPrefix: 'xpack.apm',
    publicDir: resolve(__dirname, 'public'),

    uiExports: {
      app: {
        title: 'APM',
        description: i18n.translate('xpack.apm.apmForESDescription', {
          defaultMessage: 'APM for the Elastic Stack'
        }),
        main: 'plugins/apm/index',
        icon: 'plugins/apm/icon.svg',
        euiIconType: 'apmApp',
        order: 8100
      },
      styleSheetPaths: resolve(__dirname, 'public/index.scss'),
      home: ['plugins/apm/register_feature'],

      // TODO: get proper types
      injectDefaultVars(server: Server) {
        const config = server.config();
        return {
          apmUiEnabled: config.get('xpack.apm.ui.enabled'),
          // TODO: rename to apm_oss.indexPatternTitle in 7.0 (breaking change)
          apmIndexPatternTitle: config.get('apm_oss.indexPattern'),
          apmServiceMapEnabled: config.get('xpack.apm.serviceMapEnabled'),
          apmTransactionIndices: config.get('apm_oss.transactionIndices')
        };
      },
      hacks: ['plugins/apm/hacks/toggle_app_link_in_nav'],
      savedObjectSchemas: {
        'apm-telemetry': {
          isNamespaceAgnostic: true
        }
      },
      mappings
    },

    // TODO: get proper types
    config(Joi: any) {
      return Joi.object({
        // display menu item
        ui: Joi.object({
          enabled: Joi.boolean().default(true),
          transactionGroupBucketSize: Joi.number().default(100),
          maxTraceItems: Joi.number().default(1000)
        }).default(),

        // enable plugin
        enabled: Joi.boolean().default(true),

        // buckets
        minimumBucketSize: Joi.number().default(15),
        bucketTargetCount: Joi.number().default(15),

        // service map
        serviceMapEnabled: Joi.boolean().default(false)
      }).default();
    },

    // TODO: get proper types
    init(server: Server) {
      server.plugins.xpack_main.registerFeature({
        id: 'apm',
        name: i18n.translate('xpack.apm.featureRegistry.apmFeatureName', {
          defaultMessage: 'APM'
        }),
        icon: 'apmApp',
        navLinkId: 'apm',
        app: ['apm', 'kibana'],
        catalogue: ['apm'],
        privileges: {
          all: {
            api: ['apm'],
            catalogue: ['apm'],
            savedObject: {
              all: [],
              read: []
            },
            ui: ['show', 'save']
          },
          read: {
            api: ['apm'],
            catalogue: ['apm'],
            savedObject: {
              all: [],
              read: []
            },
            ui: ['show']
          }
        }
      });

      // fires off the job
      // needed this during debugging
      server.route({
        method: 'GET',
        path: '/api/apm/servicemap',
        options: {
          tags: ['access:apm']
        },
        handler: req => {
          //@ts-ignore
          return serviceMapRun(this.kbnServer, this.kbnServer.config);
          // return serviceMapRun(server, server.config);
        }
      });

      // const { taskManager } = server;
      const taskManager = server.plugins.task_manager;
      // console.log('#$#$#$#$#$#$#$');
      // console.log(server.plugins.task_manager);
      // console.log('--------------');
      // console.log(taskManager);
      // console.log('#$#$#$#$#$#$#$');
      // const taskManager = server.plugins.task_manager;
      if (taskManager) {
        //@ts-ignore
        const kbnServer = this.kbnServer;
        // console.log('registering task');
        taskManager.registerTaskDefinitions({
          // serviceMap is the task type, and must be unique across the entire system
          serviceMap: {
            // Human friendly name, used to represent this task in logs, UI, etc
            title: 'ServiceMapTask',
            type: 'serviceMap',

            // Optional, human-friendly, more detailed description
            description: 'Extract connections in traces for service maps',

            // Optional, how long, in minutes, the system should wait before
            // a running instance of this task is considered to be timed out.
            // This defaults to 5 minutes.
            timeout: '5m',

            // The serviceMap task occupies 2 workers, so if the system has 10 worker slots,
            // 5 serviceMap tasks could run concurrently per Kibana instance. This value is
            // overridden by the `override_num_workers` config value, if specified.
            // numWorkers: 1,

            // The createTaskRunner function / method returns an object that is responsible for
            // performing the work of the task. context: { taskInstance, kbnServer }, is documented below.
            createTaskRunner({ /*kbnServer, */taskInstance }: RunContext) {
              // Perform the work of the task. The return value should fit the TaskResult interface, documented
              // below. Invalid return values will result in a logged warning.
              return {
                async run() {
                  const { state } = taskInstance;

                  const { mostRecent } = await serviceMapRun(
                    // kbnServer,
                    // kbnServer.config,
                    kbnServer,
                    kbnServer.config,
                    state.lastRun
                  );
                  console.log(mostRecent);
                  console.log((state.count || 0) + 1);

                  return {
                    state: {
                      count: (state.count || 0) + 1,
                      lastRun: mostRecent
                    }
                  };
                }
              };
            }
          }
        });

        //@ts-ignore
        this.kbnServer.afterPluginsInit(async () => {
          // server.afterPluginsInit(() => {
          // console.log('ahout to schedule');
          // const task = taskManager.schedule({
          //   id: 'servicemap-processor',
          //   taskType: 'serviceMap',
          //   interval: '1m',
          //   scope: ['apm']
          // });
          // .catch(e => console.log('Err scheduling', e));
          // console.log('scheduled', JSON.stringify(task));
          const fetchedTasks = await taskManager.fetch({
            query: {
              bool: {
                must: [
                  {
                    term: {
                      '_id': 'task:servicemap-processor'
                    }
                  },
                  {
                    term: {
                      'task.taskType': 'serviceMap'
                    }
                  }
                ]
              }
            }
          });
          console.log('#$#$#$#$#$#$#$');
          // console.log('--------------');
          console.log(fetchedTasks.docs);
          console.log('#$#$#$#$#$#$#$');
          if (fetchedTasks.docs.length) {
            console.log('taskManager.remove(servicemap-processor)');
            await taskManager.remove('servicemap-processor');
          }
          const task = await taskManager.schedule({
            id: 'servicemap-processor',
            taskType: 'serviceMap',
            // interval: '1m',
            interval: '10s',
            scope: ['apm'],
            params: {},
            state: {}
          });
          console.log(task);
        });

        const initializerContext = {} as PluginInitializerContext;
        const core = {
          http: {
            server
          }
        } as InternalCoreSetup;
        plugin(initializerContext).setup(core);
      }
    }
  });
};
