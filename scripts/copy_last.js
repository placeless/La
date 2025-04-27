#!/usr/bin/osascript -l JavaScript

// Helpers
function envVar(varName) {
  return $.NSProcessInfo
    .processInfo
    .environment
    .objectForKey(varName).js
}

function readChat(path) {
  const chatString = $.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, undefined).js
  return JSON.parse(chatString)
}

// Main
function run() {
  const chatFile = `${envVar("alfred_workflow_data")}/chat.json`
  return readChat(chatFile).findLast(message => message["role"] === "assistant")["content"]
}
