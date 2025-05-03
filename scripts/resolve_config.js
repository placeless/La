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
  recipe.model = provider.models[recipe.model];

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
