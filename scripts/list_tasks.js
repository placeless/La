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
  
  // Get query from argv if provided
  const query = argv.length > 0 ? argv[0].toLowerCase() : '';
  
  // Get all tasks from config and filter based on query
  const tasks = Object.keys(config.tasks)
    .filter(task => 
      task.toLowerCase().includes(query) || 
      (config.tasks[task].description && config.tasks[task].description.toLowerCase().includes(query))
    );
  
  // Format items for Alfred List Filter
  const items = tasks.map(task => ({
    uid: task,
    title: task,
    subtitle: config.tasks[task].description || "No description available",
    arg: task,
    valid: true,
    autocomplete: task,
    icon: {
      path: "icon.png"
    }
  }));
  
  // Return Alfred List Filter format
  return JSON.stringify({
    items: items,
    variables: {
      action: "list"
    }
  });
} 