#!/usr/bin/osascript -l JavaScript

// Helpers
function envVar(varName) {
  return $.NSProcessInfo.processInfo.environment.objectForKey(varName).js;
}

function makeDir(path) {
  $.NSFileManager.defaultManager.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(
    path,
    true,
    undefined,
    undefined,
  );
}

function writeFile(path, text) {
  $(text).writeToFileAtomicallyEncodingError(
    path,
    true,
    $.NSUTF8StringEncoding,
    undefined,
  );
}

function mv(initPath, targetPath) {
  $.NSFileManager.defaultManager.moveItemAtPathToPathError(
    initPath,
    targetPath,
    undefined,
  );
}

function rm(path) {
  return $.NSFileManager.defaultManager.removeItemAtPathError(path, undefined);
}

function padDate(number) {
  return number.toString().padStart(2, "0");
}

function readChat(path) {
  const chatString = $.NSString.stringWithContentsOfFileEncodingError(
    path,
    $.NSUTF8StringEncoding,
    undefined,
  ).js;
  return JSON.parse(chatString);
}

function countUniqueRoles(messages) {
  const uniqueRoles = new Set(messages.map((item) => item.role));
  return uniqueRoles.size;
}

function fileExists(path) {
  return $.NSFileManager.defaultManager.fileExistsAtPath(path);
}

// Constants for archive file name
const uid = $.NSProcessInfo.processInfo.globallyUniqueString.js.split("-")[0];
const currentDate = new Date();
const currentYear = currentDate.getFullYear();
const currentMonth = padDate(currentDate.getMonth() + 1); // Months are zero-based
const currentDay = padDate(currentDate.getDate());
const currentHour = padDate(currentDate.getHours());
const currentMinute = padDate(currentDate.getMinutes());
const currentSecond = padDate(currentDate.getSeconds());

// Main
const currentChat = `${envVar("alfred_workflow_data")}/chat.json`;
const replacementChat = envVar("replace_with_chat");
const archiveDir = `${envVar("alfred_workflow_data")}/archive`;
const archivedChat = `${archiveDir}/${currentYear}.${currentMonth}.${currentDay}.${currentHour}.${currentMinute}.${currentSecond}-${uid}.json`;

makeDir(archiveDir);

if (fileExists(currentChat)) {
  const messages = readChat(currentChat);
  if (messages.length > 1 && countUniqueRoles(messages) > 1)
    mv(currentChat, archivedChat);
}

if (replacementChat) {
  rm(currentChat);
  mv(replacementChat, currentChat);
} else {
  writeFile(currentChat, "[]");
}
