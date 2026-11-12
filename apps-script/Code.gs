const SUBMISSIONS_FILE_NAME = "free-web-dev-submissions.json";
const DIGEST_HANDLER = "sendWeeklyDigest";
const MAX_PROJECT_DESCRIPTION_LENGTH = 2000;

function doPost(event) {
  const parameters = event && event.parameter ? event.parameter : {};
  const requestId = String(parameters.requestId || "");

  if (!/^[a-zA-Z0-9-]{1,80}$/.test(requestId)) {
    return submissionResponse_("", false);
  }

  if (String(parameters.website || "").trim()) {
    return submissionResponse_(requestId, true);
  }

  try {
    const submission = validateSubmission_(parameters);
    appendSubmission_(submission);
    return submissionResponse_(requestId, true);
  } catch (error) {
    console.error("Could not save an application: " + error.message);
    return submissionResponse_(requestId, false);
  }
}

function validateSubmission_(parameters) {
  const fullName = singleLine_(parameters.fullName, 120);
  const email = singleLine_(parameters.email, 254).toLowerCase();
  const phone = singleLine_(parameters.phone, 80);
  const projectDescription = multiline_(
    parameters.projectDescription,
    MAX_PROJECT_DESCRIPTION_LENGTH
  );

  if (!fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !projectDescription) {
    throw new Error("Required application fields are missing or invalid.");
  }

  return {
    submittedAt: new Date().toISOString(),
    fullName: fullName,
    email: email,
    phone: phone,
    projectDescription: projectDescription,
    emailedAt: ""
  };
}

function singleLine_(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function multiline_(value, maxLength) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLength);
}

function appendSubmission_(submission) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const file = getSubmissionsFile_();
    const submissions = readSubmissions_(file);
    submissions.push(submission);
    file.setContent(JSON.stringify(submissions, null, 2));
  } finally {
    lock.releaseLock();
  }
}

function sendWeeklyDigest() {
  const recipient = PropertiesService.getScriptProperties().getProperty("RECIPIENT_EMAIL");
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new Error("Set a valid RECIPIENT_EMAIL in the script properties.");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const file = getSubmissionsFile_();
    const submissions = readSubmissions_(file);
    const pending = submissions.filter(function (submission) {
      return !submission.emailedAt;
    });

    if (!pending.length) return;

    const body = [
      "Weekly applications received: " + pending.length,
      "",
      pending.map(formatSubmission_).join("\n\n------------------------------\n\n")
    ].join("\n");

    MailApp.sendEmail({
      to: recipient,
      subject: "Free Web App applications - weekly summary (" + pending.length + ")",
      body: body
    });

    const sentAt = new Date().toISOString();
    pending.forEach(function (submission) {
      submission.emailedAt = sentAt;
    });
    file.setContent(JSON.stringify(submissions, null, 2));
  } finally {
    lock.releaseLock();
  }
}

function formatSubmission_(submission, index) {
  return [
    "Application " + (index + 1),
    "Submitted (UTC): " + submission.submittedAt,
    "Name: " + submission.fullName,
    "Email: " + submission.email,
    "Phone: " + (submission.phone || "Not provided"),
    "Project idea:",
    submission.projectDescription
  ].join("\n");
}

function initializeSubmissionStorage() {
  getSubmissionsFile_();
}

function installWeeklyDigestTrigger() {
  const recipient = PropertiesService.getScriptProperties().getProperty("RECIPIENT_EMAIL");
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new Error("Set a valid RECIPIENT_EMAIL in the script properties first.");
  }

  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === DIGEST_HANDLER) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger(DIGEST_HANDLER)
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9)
    .create();
}

function getSubmissionsFile_() {
  const properties = PropertiesService.getScriptProperties();
  const fileId = properties.getProperty("SUBMISSIONS_FILE_ID");

  if (fileId) {
    return DriveApp.getFileById(fileId);
  }

  const file = DriveApp.createFile(
    SUBMISSIONS_FILE_NAME,
    "[]",
    "application/json"
  );
  properties.setProperty("SUBMISSIONS_FILE_ID", file.getId());
  return file;
}

function readSubmissions_(file) {
  const content = file.getBlob().getDataAsString("UTF-8");
  const submissions = JSON.parse(content || "[]");

  if (!Array.isArray(submissions)) {
    throw new Error("The submissions JSON file must contain an array.");
  }

  return submissions;
}

function submissionResponse_(requestId, success) {
  const message = JSON.stringify({
    type: "application-submission-result",
    requestId: requestId,
    success: success
  }).replace(/</g, "\\u003c");

  const html = [
    "<!doctype html><html><head><meta charset=\"utf-8\"></head><body>",
    "<script>window.parent.postMessage(",
    message,
    ", \"*\");</script>",
    "</body></html>"
  ].join("");

  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
