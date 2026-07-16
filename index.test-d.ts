import {type ChildProcess} from 'node:child_process';
import {expectType} from 'tsd';
import open, {openApp, apps} from './index.js';

expectType<Promise<ChildProcess>>(open('foo'));
expectType<Promise<ChildProcess>>(open('foo', {app: {name: 'bar'}}));
expectType<Promise<ChildProcess>>(open('foo', {app: {name: 'bar', arguments: ['--arg']}}));
expectType<Promise<ChildProcess>>(open('foo', {app: [{name: 'bar'}, {name: 'baz'}]}));
expectType<Promise<ChildProcess>>(open('foo', {wait: true}));
expectType<Promise<ChildProcess>>(open('foo', {background: true}));

expectType<Promise<ChildProcess>>(openApp(apps.chrome));
expectType<Promise<ChildProcess>>(openApp(apps.chrome, {arguments: ['--incognito']}));
expectType<Promise<ChildProcess>>(openApp(apps.browser));
expectType<Promise<ChildProcess>>(openApp(apps.browserPrivate));
expectType<Promise<ChildProcess>>(openApp(apps.safari));
expectType<string | readonly string[]>(apps.firefox);
expectType<string | readonly string[]>(apps.edge);
expectType<string | readonly string[]>(apps.brave);
