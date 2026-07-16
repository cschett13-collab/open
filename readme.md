# open

> Open stuff like URLs, files, executables. Cross-platform.

[![CI](https://github.com/cschett13-collab/open/actions/workflows/main.yml/badge.svg)](https://github.com/cschett13-collab/open/actions/workflows/main.yml)
[![npm version](https://img.shields.io/npm/v/open.svg)](https://www.npmjs.com/package/open)

This is meant to be used in command-line tools and scripts, not in the browser.

If you need this for Electron, use [`shell.openPath()`](https://www.electronjs.org/docs/api/shell#shellopenpathpath) instead.

This package does not make any security guarantees. If you pass in untrusted input, it's up to you to properly sanitize it.

## Who this project is for

- **Package users**: want a reliable way to open URLs/files/apps from Node.js.
- **Contributors**: want clear contribution and review expectations.
- **Maintainers**: want consistent issue triage and release expectations.

## Use in 30 seconds

```sh
npm install open
```

```js
import open from 'open';

await open('https://example.com');
```

## Download / Install

- **Install from npm**: `npm install open`
- **npm package page**: https://www.npmjs.com/package/open
- **Latest source tarball/zip**: https://github.com/cschett13-collab/open/archive/refs/heads/main.zip
- **Releases**: https://github.com/cschett13-collab/open/releases

#### Why?

- Actively maintained.
- Supports app arguments.
- Safer as it uses `spawn` instead of `exec`.
- Fixes most of the original `node-open` issues.
- Includes the latest [`xdg-open` script](https://gitlab.freedesktop.org/xdg/xdg-utils/-/blob/master/scripts/xdg-open.in) for Linux.
- Supports WSL paths to Windows apps.

## Install

```sh
npm install open
```

**Warning:** This package is native [ESM](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) and no longer provides a CommonJS export. If your project uses CommonJS, you will have to [convert to ESM](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c) or use the [dynamic `import()`](https://v8.dev/features/dynamic-import) function. Please don't open issues for questions regarding CommonJS / ESM.

## Usage

```js
import open, {openApp, apps} from 'open';

// Opens the image in the default image viewer and waits for the opened app to quit.
await open('unicorn.png', {wait: true});
console.log('The image viewer app quit');

// Opens the URL in the default browser.
await open('https://sindresorhus.com');

// Opens the URL in a specified browser.
await open('https://sindresorhus.com', {app: {name: 'firefox'}});

// Specify app arguments.
await open('https://sindresorhus.com', {app: {name: 'google chrome', arguments: ['--incognito']}});

// Opens the URL in the default browser in incognito mode.
await open('https://sindresorhus.com', {app: {name: apps.browserPrivate}});

// Open an app.
await openApp('xcode');

// Open an app with arguments.
await openApp(apps.chrome, {arguments: ['--incognito']});
```

## Quick start checklist

1. Install Node.js 20+.
2. Install the package: `npm install open`.
3. Import `open` in an ESM module.
4. Call `open(target)` with a URL, file path, or executable.
5. Use options like `wait`, `app`, and app arguments when needed.

## API

It uses the command `open` on macOS, PowerShell (`Start-Process`) on Windows, and `xdg-open` on other platforms.

### open(target, options?)

Returns a promise for the [spawned child process](https://nodejs.org/api/child_process.html#child_process_class_childprocess). You would normally not need to use this for anything, but it can be useful if you'd like to attach custom event listeners or perform other operations directly on the spawned process.

#### target

Type: `string`

The thing you want to open. Can be a URL, file, or executable.

Opens in the default app for the file type. For example, URLs opens in your default browser.

#### options

Type: `object`

##### wait

Type: `boolean`\
Default: `false`

Wait for the opened app to exit before fulfilling the promise. If `false` it's fulfilled immediately when opening the app.

Note that it waits for the app to exit, not just for the window to close.

On Windows, you have to explicitly specify an app for it to be able to wait.

> [!WARNING]
> When opening URLs in browsers while the browser is already running, the `wait` option will not work as expected. Browsers use a single-instance architecture where new URLs are passed to the existing process, causing the command to exit immediately. Use the `newInstance` option on macOS to force a new browser instance, or avoid using `wait` with browsers.

##### background <sup>(macOS only)</sup>

Type: `boolean`\
Default: `false`

Do not bring the app to the foreground.

##### newInstance <sup>(macOS only)</sup>

Type: `boolean`\
Default: `false`

Open a new instance of the app even it's already running.

A new instance is always opened on other platforms.

##### app

Type: `{name: string | string[], arguments?: string[]} | Array<{name: string | string[], arguments: string[]}>`

Specify the `name` of the app to open the `target` with, and optionally, app `arguments`. `app` can be an array of apps to try to open and `name` can be an array of app names to try. If each app fails, the last error will be thrown.

The app name is platform dependent. Don't hard code it in reusable modules. For example, Chrome is `google chrome` on macOS, `google-chrome` on Linux and `chrome` on Windows. If possible, use [`apps`](#apps) which auto-detects the correct binary to use.

You may also pass in the app's full path. For example on WSL, this can be `/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe` for the Windows installation of Chrome.

The app `arguments` are app dependent. Check the app's documentation for what arguments it accepts.

##### allowNonzeroExitCode

Type: `boolean`\
Default: `false`

Allow the opened app to exit with nonzero exit code when the `wait` option is `true`.

We do not recommend setting this option. The convention for success is exit code zero.

### openApp(name, options?)

Open an app.

Returns a promise for the [spawned child process](https://nodejs.org/api/child_process.html#child_process_class_childprocess). You would normally not need to use this for anything, but it can be useful if you'd like to attach custom event listeners or perform other operations directly on the spawned process.

#### name

Type: `string`

The app name is platform dependent. Don't hard code it in reusable modules. For example, Chrome is `google chrome` on macOS, `google-chrome` on Linux and `chrome` on Windows. If possible, use [`apps`](#apps) which auto-detects the correct binary to use.

You may also pass in the app's full path. For example on WSL, this can be `/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe` for the Windows installation of Chrome.

#### options

Type: `object`

Same options as [`open`](#options) except `app` and with the following additions:

##### arguments

Type: `string[]`\
Default: `[]`

Arguments passed to the app.

These arguments are app dependent. Check the app's documentation for what arguments it accepts.

### apps

An object containing auto-detected binary names for common apps. Useful to work around [cross-platform differences](#app).

```js
import open, {apps} from 'open';

await open('https://google.com', {
	app: {
		name: apps.chrome
	}
});
```

`browser` and `browserPrivate` can also be used to access the user's default browser through [`default-browser`](https://github.com/sindresorhus/default-browser).

#### Supported apps

- [`chrome`](https://www.google.com/chrome) - Web browser
- [`firefox`](https://www.mozilla.org/firefox) - Web browser
- [`edge`](https://www.microsoft.com/edge) - Web browser
- [`brave`](https://brave.com/) - Web browser
- `safari` - Web browser (macOS only)
- `browser` - Default web browser
- `browserPrivate` - Default web browser in incognito mode

`browser` and `browserPrivate` support `chrome`, `firefox`, `edge`, `brave`, and `safari` (Safari cannot open in private mode via CLI).

## WSL (Windows Subsystem for Linux)

The package automatically uses Windows integration (PowerShell) when available, and falls back to `xdg-open` if PowerShell is inaccessible (e.g., sandboxed environments).

To use Linux GUI apps instead:

```javascript
await open('https://example.com', {app: {name: 'xdg-open'}});
```

## FAQ

### Why doesn't `wait` work with a browser?

Most browsers use a single running process. Opening a new URL often returns immediately. See the `newInstance` option for macOS if you need separate app instances.

### Does this package support CommonJS?

No. This package is native ESM. Use dynamic `import()` from CommonJS if needed.

### Is untrusted input safe to pass to `open`?

No guarantee is provided. Validate and sanitize input before passing it to this package.

## Troubleshooting

- Verify Node.js version is **20+** (`node --version`).
- Ensure app names are platform-correct or use `apps` for known browsers.
- On Linux/WSL, confirm `xdg-open` or PowerShell integration is available.
- For project setup issues, run:
  - `npm install`
  - `npm test`

## Security and support

- Security policy: [`.github/security.md`](.github/security.md)
- For security reports, use the private channel in the security policy.
- For general support/questions, open a GitHub issue using the provided templates.

## Related

- [open-cli](https://github.com/sindresorhus/open-cli) - CLI for this module
- [open-editor](https://github.com/sindresorhus/open-editor) - Open files in your editor at a specific line and column
- [reveal-file](https://github.com/sindresorhus/reveal-file) - Reveal a file in the system file manager
