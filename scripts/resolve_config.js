#!/usr/bin/osascript -l JavaScript

function envVar(varName) {
  return $.NSProcessInfo.processInfo.environment.objectForKey(varName).js;
}

function read(path) {
  return $.NSString.stringWithContentsOfFileEncodingError(
    path,
    $.NSUTF8StringEncoding,
    undefined,
  ).js;
}

function run(argv) {
  const confPath = envVar("config");
  const config = JSON.parse(read(confPath));

  const task = envVar("task");
  const recipe = config.tasks[task];
  const provider = config.providers[recipe.provider];
  recipe.endpoint = provider.endpoint;
  recipe.api_key = provider["api_key"];
  
  // Always resolve the model ID first
  recipe.model = provider.models[recipe.model];
  
  // Handle Cloudflare AI Gateway mode
  if (recipe.cf_aig_mode) {
    // For Cloudflare AI Gateway, we need to keep the original provider info
    recipe.provider = recipe.provider;
    // Get Cloudflare provider's endpoint and API key
    const cfProvider = config.providers.cloudflare;
    if (cfProvider) {
      recipe.cf_endpoint = cfProvider.endpoint;
      recipe.cf_api_key = cfProvider.api_key;
    }
  }
  
  // Ensure api_style is passed through if not set
  recipe.api_style = recipe.api_style || 'openai';

  if (recipe.prompts.endsWith(".md")) {
    recipe.prompts = read(
      `${confPath.split("/").slice(0, -1).join("/")}/prompts/${recipe.prompts}`,
    );
  }

  if (recipe.extra && recipe.extra.endsWith(".md")) {
    recipe.extra = read(
      `${confPath.split("/").slice(0, -1).join("/")}/prompts/${recipe.extra}`,
    );

    if (recipe.extra?.trim()) {
      recipe.prompts = `<EXTRA_REFERENCE>\n${recipe.extra}\n</EXTRA_REFERENCE>\n\n` + recipe.prompts;
    }
  }

  const context = envVar("context");
  if (context?.trim()) {
    recipe.prompts = recipe.prompts.replace(
      new RegExp("<context_placeholder>", "g"),
      context.trim(),
    );
  }

  return JSON.stringify(recipe);
}
