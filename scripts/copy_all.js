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

function markdownChat(messages, ignoreLastInterrupted = true) {
  return messages.reduce((accumulator, current, index, allMessages) => {
    if (current["role"] === "assistant")
      return `${accumulator}${current["content"]}\n\n`

    if (current["role"] === "user") {
      const userTwice = allMessages[index + 1]?.["role"] === "user" // "user" role twice in a row
      const lastMessage = index === allMessages.length - 1 // "user is last message

      return userTwice || (lastMessage && !ignoreLastInterrupted) ?
        `${accumulator}### ${current["content"]}\n\n[Answer Interrupted]\n\n` :
        `${accumulator}### ${current["content"]}\n\n`
    }

    // Ignore any other role
    return accumulator
  }, "")
}

// Main
function run() {
  const chatFile = `${envVar("alfred_workflow_data")}/chat.json`
  return markdownChat(readChat(chatFile), false)
}
