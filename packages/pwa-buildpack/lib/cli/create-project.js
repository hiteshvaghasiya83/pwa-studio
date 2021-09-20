const { resolve, relative } = require('path');
const fetch = require('node-fetch');
const os = require('os');
const tar = require('tar');
const camelspace = require('camelspace');
const fse = require('fs-extra');
const findCacheDir = require('find-cache-dir');
const prettyLogger = require('../util/pretty-logger');
const chalk = require('chalk');
const createProject = require('../Utilities/createProject');
const { handler: createEnvFile } = require('./create-env-file');
const execa = require('execa');
const sampleBackends = require('../../sampleBackends.json');

module.exports.sampleBackends = sampleBackends;

module.exports.command = 'create-project <directory>';

module.exports.describe =
    'Create a PWA project in <directory> based on template.';

module.exports.builder = yargs =>
    yargs
        .version()
        .showHelpOnFail(false)
        .positional('directory', {
            describe:
                'Name or path to a directory to create and fill with the project files. This directory will be the project root.',
            normalize: true
        })
        .group(
            ['template', 'backendUrl', 'backendEdition', 'braintreeToken'],
            'Project configuration:'
        )
        .options({
            template: {
                describe:
                    'Name of a "template" to clone and customize. Currently only the "@magento/venia-concept" template is supported. Version labels are supported. For instance: @magento/venia-concept@8.0.0'
            },
            backendUrl: {
                alias: 'b',
                describe:
                    'URL of the Magento 2.3 instance to use as a backend. Will be added to `.env` file.'
            },
            backendEdition: {
                describe:
                    'Edition of the magento store (Enterprise Edition or Community Edition)'
            },
            braintreeToken: {
                describe:
                    'Braintree API token to use to communicate with your Braintree instance. Will be added to `.env` file.'
            }
        })
        .group(['name', 'author'], 'Metadata:')
        .options({
            name: {
                alias: 'n',
                describe:
                    'Short name of the project to put in the package.json "name" field. Uses <directory> by default.'
            },
            author: {
                alias: 'a',
                describe:
                    'Name and (optionally <email address>) of the author to put in the package.json "author" field.'
            }
        })
        .group(['install', 'npmClient', 'cache'], 'Package management:')
        .options({
            install: {
                boolean: true,
                describe: 'Install package dependencies after creating project',
                default: true
            },
            npmClient: {
                describe: 'NPM package management client to use.',
                choices: ['npm', 'yarn'],
                default: 'npm'
            },
            cache: {
                boolean: true,
                describe: 'Use cache for template packages and dependencies.',
                default: true
            }
        })
        .help();

module.exports.handler = async function buildpackCli(argv) {
    function getCacheDir() {
        const cacheDir = findCacheDir({
            name: '@magento/pwa-buildpack',
            cwd: __dirname,
            create: true
        });
        return cacheDir && resolve(cacheDir, 'scaffold-templates');
    }

    async function getPackageFromCache(packageName) {
        const cacheDir = getCacheDir();
        const packageDir = resolve(cacheDir, packageName);
        // NPM extracts a tarball to './package'
        const packageRoot = resolve(packageDir, 'package');
        try {
            if ((await fse.readdir(packageRoot)).includes('package.json')) {
                prettyLogger.info(`Found ${packageName} template in cache`);
                return packageRoot;
            }
        } catch (e) {
            // Not cached.
            return false;
        }
        return packageRoot;
    }

    async function getPackageFromRegistry(packageName) {
        const cacheDir = cache ? getCacheDir() : os.tmpdir();
        const packageDir = resolve(cacheDir, packageName);
        let tarballUrl;
        try {
            prettyLogger.info(`Finding ${packageName} tarball on NPM`);
            tarballUrl = JSON.parse(
                execa.shellSync(`npm view --json ${packageName}`, {
                    encoding: 'utf-8'
                }).stdout
            ).dist.tarball;
        } catch (e) {
            throw new Error(
                `Invalid template: could not get tarball url from npm: ${
                    e.message
                }`
            );
        }

        let tarballStream;
        try {
            prettyLogger.info(`Downloading and unpacking ${tarballUrl}`);
            tarballStream = (await fetch(tarballUrl)).body;
        } catch (e) {
            throw new Error(
                `Invalid template: could not download tarball from NPM: ${
                    e.message
                }`
            );
        }

        await fse.ensureDir(packageDir);
        return new Promise((res, rej) => {
            const untarStream = tar.extract({
                cwd: packageDir
            });
            tarballStream.pipe(untarStream);
            untarStream.on('finish', () => {
                prettyLogger.info(`Unpacked ${packageName}`);
                // NPM extracts a tarball to './package'
                const packageRoot = resolve(packageDir, 'package');
                res(packageRoot);
            });
            untarStream.on('error', rej);
            tarballStream.on('error', rej);
        });
    }

    async function makeDirFromDevPackage(packageName) {
        // assume we are in pwa-studio repo
        prettyLogger.warn(
            `Env var DEBUG_PROJECT_CREATION=1. Bypassing cache and NPM registry.`
        );
        if (packageName !== '@magento/venia-concept') {
            throw new Error(
                `DEBUG_PROJECT_CREATION=1 is set, but scaffolding debug mode currently only works using "@magento/venia-concept" as the template. Supplied template name "${packageName}" is unsupported.`
            );
        }
        const siblingPackagePath = resolve(__dirname, '../../../venia-concept');
        prettyLogger.warn(
            `Attempting to resolve "${packageName}" as a sibling package from ${relative(
                process.cwd(),
                siblingPackagePath
            )}.`
        );
        return siblingPackagePath;
    }

    async function makeDirFromNpmPackage(packageName) {
        let packageDir;
        if (process.env.DEBUG_PROJECT_CREATION) {
            return makeDirFromDevPackage(packageName);
        }
        if (!cache) {
            prettyLogger.warn(`Bypassing cache to get "${packageName}"`);
        } else {
            packageDir = await getPackageFromCache(packageName);
        }
        return packageDir || getPackageFromRegistry(packageName);
    }

    async function findTemplateDir(templateName) {
        try {
            await fse.readdir(templateName);
            prettyLogger.info(`Found ${templateName} directory`);
            // if that succeeded, then...
            return templateName;
        } catch (e) {
            return makeDirFromNpmPackage(templateName);
        }
    }

    const cache = !process.env.DEBUG_PROJECT_CREATION && argv.cache;

    const params = {
        ...argv,
        name: argv.name || argv.directory,
        template: await findTemplateDir(argv.template)
    };
    const { directory, name } = params;
    await fse.ensureDir(directory);

    // Create the new PWA project.
    prettyLogger.info(`Creating a new PWA project '${name}' in ${directory}`);
    await createProject(params);

    // Update process.env with backendUrl, backendEdition and braintreeToken
    // vars if necessary.
    if (params.backendUrl) {
        const magentoNS = camelspace('magento');
        const { backendUrl } = magentoNS.fromEnv(process.env);
        if (backendUrl && backendUrl !== params.backendUrl) {
            prettyLogger.warn(
                `Command line option --backend-url was set to '${
                    params.backendUrl
                }', but environment variable ${JSON.stringify(
                    magentoNS.toEnv({ backendUrl })
                )} conflicts with it. Environment variable overrides!`
            );
        } else {
            Object.assign(
                process.env,
                magentoNS.toEnv({ backendUrl: params.backendUrl })
            );
        }
    }

    if (params.backendEdition) {
        const magentoNS = camelspace('magento');
        const { backendEdition } = magentoNS.fromEnv(process.env);
        if (backendEdition && backendEdition !== params.backendEdition) {
            prettyLogger.warn(
                `Command line option --backend-edition was set to '${
                    params.backendEdition
                }', but environment variable ${JSON.stringify(
                    magentoNS.toEnv({ backendEdition })
                )} conflicts with it. Environment variable overrides!`
            );
        } else {
            Object.assign(
                process.env,
                magentoNS.toEnv({ backendEdition: params.backendEdition })
            );
        }
    }

    if (params.braintreeToken) {
        // Corresponds to the CHECKOUT section in envVarDefinitions.json.
        const checkoutNS = camelspace('checkout');
        const { braintreeToken } = checkoutNS.fromEnv(process.env);
        if (braintreeToken && braintreeToken !== params.braintreeToken) {
            // The user has CHECKOUT_BRAINTREE_TOKEN already set in their .env
            // and it doesn't match the command line arg.
            prettyLogger.warn(
                `Command line option --braintree-token was set to '${
                    params.braintreeToken
                }', but environment variable ${JSON.stringify(
                    checkoutNS.toEnv({ braintreeToken })
                )} conflicts with it. Environment variable overrides!`
            );
        } else {
            // The user doesn't have CHECKOUT_BRAINTREE_TOKEN set in their .env
            // or they do but it matches the command line arg.
            Object.assign(
                process.env,
                checkoutNS.toEnv({ braintreeToken: params.braintreeToken })
            );
        }
    }

    // Create the .env file for the new project.
    createEnvFile({ directory });

    // Install the project if instructed to do so.
    if (params.install) {
        await execa.shell(`${params.npmClient} install`, {
            cwd: directory,
            stdio: 'inherit'
        });
        prettyLogger.success(`Installed dependencies for '${name}' project`);
    }

    const showCommand = command =>
        ' - ' + chalk.whiteBright(`${params.npmClient} ${command}`);
    const buildpackPrefix = params.npmClient === 'npm' ? ' --' : '';
    const customOriginCommand = `run buildpack${buildpackPrefix} create-custom-origin .`;
    const prerequisites = [];
    if (process.cwd() !== resolve(directory)) {
        prerequisites.push(`cd ${directory}`);
    }
    if (!params.install) {
        prerequisites.push(`${params.npmClient} install`);
    }
    const prerequisiteCommand = prerequisites.join(' && ');
    const prerequisiteNotice =
        prerequisiteCommand.length > 0
            ? `- ${chalk.whiteBright(
                  prerequisiteCommand
              )} before running the below commands.`
            : '';
    prettyLogger.warn(`Created new PWA project ${params.name}. Next steps:
    ${prerequisiteNotice}
    ${showCommand(
        customOriginCommand
    )} to generate a unique, secure custom domain for your new project. ${chalk.greenBright(
        'Highly recommended.'
    )}
    ${showCommand(
        'run watch'
    )} to start the dev server and do real-time development.
    ${showCommand(
        'run storybook'
    )} to start Storybook dev server and view available components in your app.
    ${showCommand(
        'run build'
    )} to build the project into optimized assets in the '/dist' directory.
    ${showCommand(
        'start'
    )} after build to preview the app on a local staging server.

`);
};
