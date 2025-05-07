#!/usr/bin/osascript -l JavaScript

const STATUS = {
  HEALTHY: "healthy",
  ERROR: "error",
  WARNING: "warning",
};

function envVar(varName) {
    return $.NSProcessInfo.processInfo.environment.objectForKey(varName)?.js;
}

function read(path) {
    try {
        return $.NSString.stringWithContentsOfFileEncodingError(
            path,
            $.NSUTF8StringEncoding,
            undefined,
        ).js;
    } catch (error) {
        return null;
    }
}

function _validateTask(taskName, task, config, results, configPath /* Added configPath for prompt file check */) {
    // Check if task has provider
    if (!task.provider) {
        results.status = STATUS.ERROR;
        results.errors.push(`Task '${taskName}' is missing provider configuration`);
        return; // Use return instead of continue as we are in a separate function
    }

    // Check if provider exists
    if (!config.providers[task.provider]) {
        results.status = STATUS.ERROR;
        results.errors.push(`Task '${taskName}' references non-existent provider: '${task.provider}'`);
        return; // Use return
    }

    // Check api_style if present
    if (task.api_style && !['google', 'openai'].includes(task.api_style)) {
        results.status = STATUS.ERROR;
        results.errors.push(`Task '${taskName}' has invalid api_style: '${task.api_style}'. Must be either 'google' or 'openai'`);
    }

    // Check cf_aig_mode if present
    if (task.cf_aig_mode !== undefined && typeof task.cf_aig_mode !== 'boolean') {
        results.status = STATUS.ERROR;
        results.errors.push(`Task '${taskName}' has invalid cf_aig_mode: must be a boolean value`);
    }

    // Check model configuration (skip for cloudflare provider)
    const provider = config.providers[task.provider];
    if (provider.provider !== 'cloudflare' && task.model && !provider.models?.[task.model]) {
        results.status = STATUS.ERROR;
        results.errors.push(`Task '${taskName}' references non-existent model '${task.model}' in provider '${task.provider}'`);
    }

    // Check prompts configuration
    if (!task.prompts) {
        results.status = STATUS.ERROR;
        results.errors.push(`Task '${taskName}' is missing prompts configuration`);
    } else if (typeof task.prompts === "string" && task.prompts.endsWith(".md")) {
        // Check if prompt file exists
        // configPath is needed here to correctly resolve relative prompt file paths
        const promptPath = `${configPath.split("/").slice(0, -1).join("/")}/prompts/${task.prompts}`;
        const promptContent = read(promptPath); // Assuming 'read' is accessible globally or passed in
        if (!promptContent) {
            results.status = STATUS.ERROR;
            results.errors.push(`Task '${taskName}' references non-existent prompt file: '${promptPath}'`);
        }
    }
}

function _validateProvider(providerName, provider, results) {
    // Check endpoint
    if (!provider.endpoint) {
        results.status = STATUS.ERROR;
        results.errors.push(`Provider '${providerName}' is missing endpoint configuration`);
    }

    // Check API key (optional for cloudflare provider)
    if (!provider.api_key && providerName !== 'cloudflare') { // Consider using a CONST for 'cloudflare'
        results.status = STATUS.WARNING;
        results.warnings.push(`Provider '${providerName}' is missing API key configuration`);
    }

    // Check model configurations (not required for cloudflare provider)
    if (providerName !== 'cloudflare' && (!provider.models || Object.keys(provider.models).length === 0)) { // Consider using a CONST for 'cloudflare'
        results.status = STATUS.WARNING;
        results.warnings.push(`Provider '${providerName}' has no models configured`);
    }
}

function checkConfigHealth(configPath) {
    const results = {
        status: STATUS.HEALTHY,
        errors: [],
        warnings: []
    };

    // Check if config file exists
    const configContent = read(configPath);
    if (!configContent) {
        results.status = STATUS.ERROR;
        results.errors.push(`Config file does not exist or cannot be read: ${configPath}`);
        return results;
    }

    // Check JSON parsing
    let config;
    try {
        config = JSON.parse(configContent);
    } catch (error) {
        results.status = STATUS.ERROR;
        results.errors.push(`Config file JSON parsing error: ${error.message}`);
        return results;
    }

    // Check required top-level keys
    const requiredTopLevelKeys = ["tasks", "providers"];
    for (const key of requiredTopLevelKeys) {
        if (!config[key]) {
            results.status = STATUS.ERROR;
            results.errors.push(`Config missing required top-level key: '${key}'`);
        }
    }

    // Return early if no tasks or providers
    if (!config.tasks || !config.providers) {
        return results;
    }

    // Check task configurations
    for (const [taskName, task] of Object.entries(config.tasks)) {
        _validateTask(taskName, task, config, results, configPath);
    }

    // Check provider configurations
    for (const [providerName, provider] of Object.entries(config.providers)) {
        _validateProvider(providerName, provider, results);
    }

    // If there are warnings but no errors, status is warning
    if (results.status === STATUS.HEALTHY && results.warnings.length > 0) {
        results.status = STATUS.WARNING;
    }

    return results;
}

function run(argv) {
    // Get config path
    const configPath = envVar("config") || argv[0];

    if (!configPath) {
        return JSON.stringify({
            status: STATUS.ERROR,
            errors: ['No config file path provided. Please provide via \'config\' environment variable or command line argument.'],
            warnings: []
        });
    }

    const healthResults = checkConfigHealth(configPath);
    return JSON.stringify({
        response: "```json\n" + JSON.stringify(healthResults, null, 2) + "\n```",
        behaviour: { scroll: "end" },
    })
} 