#!/usr/bin/osascript -l JavaScript

function envVar(varName) {
  return $.NSProcessInfo
    .processInfo
    .environment
    .objectForKey(varName).js
}

function dirContents(path) {
  return $.NSFileManager.defaultManager.contentsOfDirectoryAtURLIncludingPropertiesForKeysOptionsError(
    $.NSURL.fileURLWithPath(path), undefined, $.NSDirectoryEnumerationSkipsHiddenFiles, undefined)
    .js.map(p => p.path.js).sort()
}

function readChat(path) {
  const chatString = $.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, undefined).js
  return JSON.parse(chatString)
}

function trashChat(path) {
  const fileURL = $.NSURL.fileURLWithPath(path)
  $.NSFileManager.defaultManager.trashItemAtURLResultingItemURLError(fileURL, undefined, undefined)
}

function noArchives() {
  return JSON.stringify({ items: [{
    title: "No Chat Histories Found",
    subtitle: "Archives are created when starting new conversations",
    valid: false
  }]})
}

function run() {
  const archiveDir = `${envVar("alfred_workflow_data")}/archive`
  if (!$.NSFileManager.defaultManager.fileExistsAtPath(archiveDir)) return noArchives()

  const sfItems = dirContents(archiveDir)
    .filter(file => file.endsWith(".json"))
    .toReversed()
    .flatMap(file => {
      const chatContents = readChat(file)
      const firstQuestion = chatContents.find(item => item["role"] === "user")?.["content"]
      const lastQuestion = chatContents.toReversed().find(item => item["role"] === "user")?.["content"]

      // Delete invalid chats
      if (!firstQuestion) trashChat(file)

      return {
        type: "file",
        title: firstQuestion,
        subtitle: lastQuestion,
        match: `${firstQuestion} ${lastQuestion}`,
        arg: file
      }
    })

  if (sfItems.length === 0) return noArchives()

  return JSON.stringify({ items: sfItems })
}
