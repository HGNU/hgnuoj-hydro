#!/usr/bin/env node

/* eslint-disable consistent-return */

const os = require('os');
const path = require('path');
const cluster = require('cluster');
const fs = require('fs-extra');
const argv = require('cac')().parse();
const child = require('child_process');
const esbuild = require('esbuild');

const major = +process.version.split('.')[0].split('v')[1];
const minor = +process.version.split('.')[1];

let transformTimeUsage = 0;
let transformCount = 0;
let displayTimeout;
function transform(type, filename) {
    const start = new Date();
    const result = esbuild.buildSync({
        entryPoints: [filename],
        sourcemap: 'inline',
        platform: 'node',
        format: 'cjs',
        target: `node${major}.${minor}`,
        jsx: 'transform',
        write: false,
    });
    if (result.warnings.length) console.warn(result.warnings);
    transformTimeUsage += new Date().getTime() - start.getTime();
    transformCount++;
    if (displayTimeout) clearTimeout(displayTimeout);
    displayTimeout = setTimeout(() => console.log(`Transformed ${transformCount} files. (${transformTimeUsage}ms)`), 1000);
    return result.outputFiles[0].text;
}
if (major < 14) {
    require.extensions['.js'] = function loader(module, filename) {
        return module._compile(transform('js', filename), filename);
    };
}
require.extensions['.ts'] = function loader(module, filename) {
    return module._compile(transform('ts', filename), filename);
};
require.extensions['.tsx'] = function loader(module, filename) {
    return module._compile(transform('tsx', filename), filename);
};

function buildUrl(opts) {
    let mongourl = `${opts.protocol || 'mongodb'}://`;
    if (opts.username) mongourl += `${opts.username}:${opts.password}@`;
    mongourl += `${opts.host}:${opts.port}/${opts.name}`;
    if (opts.url) mongourl = opts.url;
    return mongourl;
}

if (!cluster.isMaster) {
    const hydro = require('../src/loader');
    // Forked by hydro
    hydro.load().catch((e) => {
        console.error(e);
        process.exit(1);
    });
} else {
    const hydroPath = path.resolve(os.homedir(), '.hydro');
    fs.ensureDirSync(hydroPath);
    const addonPath = path.resolve(hydroPath, 'addon.json');
    if (!fs.existsSync(addonPath)) fs.writeFileSync(addonPath, '[]');
    let addons = JSON.parse(fs.readFileSync(addonPath).toString());

    if (argv.args[0] === 'db') {
        const dbConfig = fs.readFileSync(path.resolve(hydroPath, 'config.json'), 'utf-8');
        const url = buildUrl(JSON.parse(dbConfig));
        return child.spawn('mongo', [url], { stdio: 'inherit' });
    }

    if (!addons.includes('@hydrooj/ui-default')) {
        try {
            const ui = argv.options.ui || '@hydrooj/ui-default';
            require.resolve(ui);
            addons.push(ui);
        } catch (e) {
            console.error('Please also install @hydrooj/ui-default');
        }
    }

    if (argv.args[0] && argv.args[0] !== 'cli') {
        const operation = argv.args[0];
        const arg1 = argv.args[1];
        const arg2 = argv.args[2];
        if (operation === 'addon') {
            if (arg1 === 'create') {
                fs.mkdirSync('/root/addon');
                child.execSync('yarn init -y', { cwd: '/root/addon' });
                fs.mkdirSync('/root/addon/templates');
                fs.mkdirSync('/root/addon/locales');
                fs.mkdirSync('/root/addon/public');
                addons.push('/root/addon');
            } else if (arg1 === 'add') {
                for (let i = 0; i < addons.length; i++) {
                    if (addons[i] === arg2) {
                        addons.splice(i, 1);
                        break;
                    }
                }
                addons.push(arg2);
            } else if (arg1 === 'remove') {
                for (let i = 0; i < addons.length; i++) {
                    if (addons[i] === arg2) {
                        addons.splice(i, 1);
                        break;
                    }
                }
            }
            addons = Array.from(new Set(addons));
            console.log('Current Addons: ', addons);
            fs.writeFileSync(addonPath, JSON.stringify(addons, null, 2));
        }
    } else {
        const hydro = require('../src/loader');
        addons = Array.from(new Set(addons));
        for (const addon of addons) hydro.addon(addon);
        (argv.args[0] === 'cli' ? hydro.loadCli : hydro.load)().catch((e) => {
            console.error(e);
            process.exit(1);
        });
    }
}
