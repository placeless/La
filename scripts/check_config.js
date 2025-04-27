#!/usr/bin/osascript -l JavaScript

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

function checkConfigHealth(configPath) {
    const results = {
        status: "healthy",
        errors: [],
        warnings: []
    };

    // Check if config file exists
    const configContent = read(configPath);
    if (!configContent) {
        results.status = "error";
        results.errors.push(`Config file does not exist or cannot be read: ${configPath}`);
        return results;
    }

    // Check JSON parsing
    let config;
    try {
        config = JSON.parse(configContent);
    } catch (error) {
        results.status = "error";
        results.errors.push(`Config file JSON parsing error: ${error.message}`);
        return results;
    }

    // Check required top-level keys
    const requiredTopLevelKeys = ["tasks", "providers"];
    for (const key of requiredTopLevelKeys) {
        if (!config[key]) {
            results.status = "error";
            results.errors.push(`Config missing required top-level key: '${key}'`);
        }
    }

    // Return early if no tasks or providers
    if (!config.tasks || !config.providers) {
        return results;
    }

    // Check task configurations
    for (const [taskName, task] of Object.entries(config.tasks)) {
        // Check if task has provider
        if (!task.provider) {
            results.status = "error";
            results.errors.push(`Task '${taskName}' is missing provider configuration`);
            continue;
        }

        // Check if provider exists
        if (!config.providers[task.provider]) {
            results.status = "error";
            results.errors.push(`Task '${taskName}' references non-existent provider: '${task.provider}'`);
            continue;
        }

        // Check model configuration
        const provider = config.providers[task.provider];
        if (task.model && !provider.models?.[task.model]) {
            results.status = "error";
            results.errors.push(`Task '${taskName}' references non-existent model '${task.model}' in provider '${task.provider}'`);
        }

        // Check prompts configuration
        if (!task.prompts) {
            results.status = "error";
            results.errors.push(`Task '${taskName}' is missing prompts configuration`);
        } else if (typeof task.prompts === "string" && task.prompts.endsWith(".md")) {
            // Check if prompt file exists
            const promptPath = `${configPath.split("/").slice(0, -1).join("/")}/prompts/${task.prompts}`;
            const promptContent = read(promptPath);
            if (!promptContent) {
                results.status = "error";
                results.errors.push(`Task '${taskName}' references non-existent prompt file: '${promptPath}'`);
            }
        }
    }

    // Check provider configurations
    for (const [providerName, provider] of Object.entries(config.providers)) {
        // Check endpoint
        if (!provider.endpoint) {
            results.status = "error";
            results.errors.push(`Provider '${providerName}' is missing endpoint configuration`);
        }

        // Check API key
        if (!provider.api_key) {
            results.status = "warning";
            results.warnings.push(`Provider '${providerName}' is missing API key configuration`);
        }

        // Check model configurations
        if (!provider.models || Object.keys(provider.models).length === 0) {
            results.status = "warning";
            results.warnings.push(`Provider '${providerName}' has no models configured`);
        }
    }

    // If there are warnings but no errors, status is warning
    if (results.status === "healthy" && results.warnings.length > 0) {
        results.status = "warning";
    }

    return results;
}

function run(argv) {
    // Get config path
    const configPath = envVar("config") || argv[0];

    if (!configPath) {
        return JSON.stringify({
            status: "error",
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