#!/usr/bin/osascript -l JavaScript

// Core Utilities
const Env = {
  get(name) {
    return $.NSProcessInfo.processInfo.environment.objectForKey(name).js;
  },
  str(data) {
    return JSON.stringify(data);
  },
  getTimeoutSeconds() {
    const timeout = this.get("timeout");
    return timeout ? parseInt(timeout) : 5; // Default to 5 seconds
  },
  getTimeoutMs() {
    return this.getTimeoutSeconds() * 1000; // Convert seconds to milliseconds
  },
};

// File System Operations
const Files = {
  exists(path) {
    return $.NSFileManager.defaultManager.fileExistsAtPath(path);
  },

  read(path) {
    return $.NSString.stringWithContentsOfFileEncodingError(
      path,
      $.NSUTF8StringEncoding,
      undefined,
    ).js;
  },

  write(path, content) {
    return $(content).writeToFileAtomicallyEncodingError(
      path,
      true,
      $.NSUTF8StringEncoding,
      undefined,
    );
  },

  create(path) {
    $.NSFileManager.defaultManager.createFileAtPathContentsAttributes(
      path,
      undefined,
      undefined,
    );
  },

  delete(path) {
    $.NSFileManager.defaultManager.removeItemAtPathError(path, undefined);
  },

  mtime(path) {
    return $.NSFileManager.defaultManager
      .attributesOfItemAtPathError(path, undefined)
      .js["NSFileModificationDate"].js.getTime();
  },
};

// Chat History Management
const Chat = {
  init(path) {
    this.path = path;
    this.messages = this.load();
    return this;
  },

  load() {
    return JSON.parse(Files.read(this.path) || "[]");
  },

  save(message) {
    this.messages.push(message);
    Files.write(this.path, JSON.stringify(this.messages));
  },

  tag(message, config = null) {
    return message.role === "assistant" && config
      ? { ...message, ...this.metadata(config) }
      : message;
  },

  metadata(config) {
    return {
      task: config.task,
      provider: config.provider,
      model: config.model,
    };
  },

  format(messages, inStreaming = false) {
    return messages.reduce((output, msg, i, arr) => {
      if (msg.role === "assistant") return `${output}${msg.content}\n\n`;
      if (msg.role !== "user") return output;

      const userMessage = `##### ⊙ You\n\n${msg.content}\n\n##### ⊚ Assistant`;
      const isLast = i === arr.length - 1;
      const nextIsUser = arr[i + 1]?.role === "user";
      const interrupted = nextIsUser || (isLast && !inStreaming);

      return `${output}${userMessage}\n\n${interrupted ? "[Interrupted]\n\n" : ""}`;
    }, "");
  },
};

// AI Service Integration
const AI = {
  mapGeminiParameters(params) {
    const parameterMap = {
      temperature: 'temperature',
      max_tokens: 'maxOutputTokens',
      top_p: 'topP',
      top_k: 'topK',
      presence_penalty: 'presencePenalty',
      frequency_penalty: 'frequencyPenalty',
      stop: 'stopSequences',
      response_modalities: "responseModalities",
      response_mimetype: "responseMimeType"
    };

    const geminiParams = {};
    for (const [openAIParam, geminiParam] of Object.entries(parameterMap)) {
      if (params[openAIParam] !== undefined) {
        geminiParams[geminiParam] = params[openAIParam];
      }
    }
    return geminiParams;
  },

  payload(config, messages) {
    if (!config.endpoint) return null;

    // Handle Cloudflare AI Gateway mode
    if (config.cf_aig_mode) {
      // Get the original payload based on api_style
      const originalPayload = this.getOriginalPayload(config, messages);
      if (!originalPayload) return null;

      // Construct the Cloudflare AI Gateway payload
      const cfPayload = [{
        provider: config.provider,
        endpoint: this.getEndpointPath(config),
        headers: this.getHeaders(config),
        query: originalPayload
      }];

      return cfPayload;
    }

    // Regular payload handling
    return this.getOriginalPayload(config, messages);
  },

  getOriginalPayload(config, messages) {
    if (config.api_style === 'google') {
      // Gemini has a different format for messages
      const contents = [];
      
      // Add system prompt if it exists
      if (config.prompts) {
        contents.push({
          role: 'user',
          parts: [{ text: config.prompts }]
        });
        contents.push({
          role: 'model',
          parts: [{ text: 'I understand and will follow these instructions.' }]
        });
      }

      // Add conversation messages
      contents.push(...messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      })));

      // Convert OpenAI style parameters to Gemini format and wrap in generationConfig
      const geminiParams = this.mapGeminiParameters(config.parameters || {});

      const payload = {
        contents,
        // Include tools if they exist
        ...(config.tools ? { tools: config.tools } : {}),
        generationConfig: {
          ...geminiParams
        },
        safetySettings: []  // Add if needed
      };

      return payload;
    }

    // Default OpenAI/Azure format
    return {
      model: config.model,
      messages: config.prompts
        ? [{ role: "system", content: config.prompts }, ...messages]
        : messages,
      ...config.parameters,
      stream: true,
    };
  },

  getEndpointPath(config) {
    if (config.api_style === 'google') {
      return `v1beta/models/${config.model}:streamGenerateContent?alt=sse`;
    }
    const url = $.NSURL.URLWithString(config.endpoint);
    const path = ObjC.unwrap(url.path);
    return path;
    // return 'v1/chat/completions';
  },

  getHeaders(config) {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (config.api_style === 'google') {
      headers['x-goog-api-key'] = config.api_key;
    } else if (config.provider === 'azure') {
      headers['api-key'] = config.api_key;
    } else {
      headers['Authorization'] = `Bearer ${config.api_key}`;
    }

    return headers;
  },

  command(config, messages) {
    const payload = this.payload(config, messages);
    if (!payload) return null;

    // Get timeout in seconds for curl's --speed-time parameter
    const timeoutSeconds = Env.getTimeoutSeconds();

    let endpoint;
    let headers = [
      "--header", "Content-Type: application/json",
      "--header", "Accept: text/event-stream",
    ];

    // Handle Cloudflare AI Gateway mode
    if (config.cf_aig_mode) {
      // Use Cloudflare AI Gateway endpoint
      endpoint = config.cf_endpoint;

      // Get the Cloudflare provider's API key
      const cfApiKey = config.cf_api_key;

      // Add Cloudflare AI Gateway authorization header if API key is present
      if (cfApiKey) {
        headers.push("--header", `cf-aig-authorization: Bearer ${cfApiKey}`);
      }
    } else {
      // Regular endpoint handling
      endpoint = config.endpoint;
      if (config.api_style === 'google') {
        const url = $.NSURL.URLWithString(endpoint);
        const scheme = ObjC.unwrap(url.scheme);
        const host = ObjC.unwrap(url.host);
        const baseURL = `${scheme}://${host}`;
        endpoint = `${baseURL}/v1beta/models/${config.model}:streamGenerateContent?alt=sse`;
        headers.push("--header", `x-goog-api-key: ${config.api_key}`);
      } else if (config.provider === 'azure') {
        headers.push("--header", `api-key: ${config.api_key}`);
      } else {
        headers.push("--header", `Authorization: Bearer ${config.api_key}`);
      }
    }

    // For debugging
    console.log(`\n-----> Command: ${JSON.stringify({
      endpoint,
      headers,
      payload
    }, null, 2)}\n`);

    return [
      endpoint,
      "--speed-limit", "0",
      "--speed-time", timeoutSeconds.toString(),
      "--silent",
      "--no-buffer",
      "--show-error",
      ...headers,
      "--data", JSON.stringify(payload),
    ];
  },
};

// Streaming Operations
const Stream = {
  init(config, paths) {
    Object.assign(this, { config, ...paths });
    return this;
  },

  start(messages) {
    Files.create(this.stream);

    const command = AI.command(this.config, messages);
    const task = $.NSTask.alloc.init;
    const pipe = $.NSPipe.pipe;
    task.executableURL = $.NSURL.fileURLWithPath("/usr/bin/curl");
    task.arguments = [
      ...command,
      "--output",
      this.stream,
      "--stderr",
      this.stream,
    ];
    task.standardOutput = pipe;
    task.launchAndReturnError(false);

    Files.write(this.pid, task.processIdentifier.toString());
  },

  process() {
    const data = Files.read(this.stream);
    if (this.isError(data)) return { text: data, finished: "error" };
    const { text, finished } = this.parse(data);
    if (this.isStalled(this.stream)) return { text: text, finished: "stalled" };
    return { text, finished };
  },

  parse(data) {
    let text = "";
    let finished = null;
    let groundingMetadata = null;

    try {
      // For Gemini, the response comes as SSE format with data: prefix
      if (this.config.api_style === 'google') {
        data
          .split('\n')
          .filter(Boolean)
          .map(line => line.replace(/^data: /, ''))  // Remove SSE prefix
          .filter(line => line !== '[DONE]')         // Filter out SSE end marker
          .forEach(line => {
            try {
              const chunk = JSON.parse(line);
              if (chunk.candidates?.[0]) {
                const candidate = chunk.candidates[0];

                // Store grounding metadata if present
                if (candidate.groundingMetadata) {
                  groundingMetadata = candidate.groundingMetadata;
                }

                // Extract text from the parts array
                text += candidate.content?.parts?.[0]?.text || '';

                // Check for finish reason
                if (candidate.finishReason) {
                  finished = candidate.finishReason;
                }
              }
            } catch (error) {
              // Ignore parse errors for incomplete chunks
            }
          });

        // Process references if groundingMetadata exists
        if (groundingMetadata?.groundingChunks) {
          const chunks = groundingMetadata.groundingChunks;
          // Replace [1], [2,3], etc. with clickable links
          text = text.replace(/\[(\d+(?:,\s*\d+)*)\]/g, (match, numbers) => {
            const indices = numbers.split(',').map(n => parseInt(n.trim()) - 1);
            const links = indices.map(index => {
              if (chunks[index]?.web) {
                const { uri, title } = chunks[index].web;
                return `[${index + 1}](${uri})`;
              }
              return `[${index + 1}]`;
            });
            return `[${links.join(', ')}]`;
          });
        }
      } else {
        // Original OpenAI/Azure format
        data
          .split("\n")
          .filter(Boolean)
          .map((line) => line.replace(/^data: /, ""))
          .forEach((line) => {
            try {
              const parsed = JSON.parse(line);
              text += parsed.choices?.[0]?.delta?.content || "";
              finished = parsed.choices?.[0]?.finish_reason || finished;
            } catch (error) {
              return [];
            }
          });
      }
    } catch (error) {
      console.log('Parse error:', error);
      return { text: '', finished: null };
    }

    return { text, finished };
  },

  isValidJSON(data) {
    try {
      JSON.parse(data);
      return true;
    } catch (e) {
      return false;
    }
  },

  isError(data) {
    // Handle curl errors first
    if (data.startsWith("curl:")) {
      return true;
    }

    if (this.config.api_style === 'google') {
      try {
        // For SSE format, look for the first data: line
        const firstChunk = data
          .split('\n')
          .find(line => line.startsWith('data: '))
          ?.replace(/^data: /, '');

        if (!firstChunk) {
          return true;
        }

        // Skip [DONE] marker
        if (firstChunk === '[DONE]') {
          return false;
        }

        // Parse and check for error
        const parsed = JSON.parse(firstChunk);
        if (parsed.error) {
          return true;
        }

        // Verify we have valid content
        return !parsed.candidates?.[0]?.content?.parts?.[0]?.text;
      } catch (e) {
        // If we can't parse the response, it's an error
        return true;
      }
    }

    // Original OpenAI/Azure error detection
    return (
      // For OpenAI, a complete JSON (not a data: stream) usually means error
      (this.isValidJSON(data) && !data.startsWith('[')) ||
      !/^(data: (?!\{"error)|(?!(data: )))/.test(data.trim())
    );
  },

  isStalled(data) {
    return Date.now() - Files.mtime(data) > Env.getTimeoutMs();
  },

  cleanup() {
    Files.delete(this.stream);
    Files.delete(this.pid);
  },
};

// Main Workflow
function run(argv) {
  const query = argv[0]?.trim();
  const config = JSON.parse(Env.get("recipe"));
  config.max_context ||= 4;
  const isStreaming = Env.get("streaming_now") === "1";

  const dataPath = Env.get("alfred_workflow_data");
  const cachePath = Env.get("alfred_workflow_cache");
  const paths = {
    chat: `${dataPath}/chat.json`,
    stream: `${cachePath}/stream.txt`,
    pid: `${cachePath}/pid.txt`,
  };

  const chat = Chat.init(paths.chat);
  const stream = Stream.init(config, paths);

  if (isStreaming) {
    const { text, finished } = stream.process();

    if (text.length === 0) {
      return Env.str({
        rerun: 0.1,
        variables: { streaming_now: true },
      });
    }

    const responseText = chat.format(chat.messages, true) + text;

    if (finished) {
      const reason = finished.toLowerCase();
      const view = {
        response:
          reason === "stalled"
            ? `${responseText}\n[Connection Stalled]`
            : responseText,
        variables: { streaming_now: false },
        footer: `[${config.provider}: ${config.model}]: ${reason}`,
      };
      chat.save({ role: "assistant", content: text });
      stream.cleanup();
      return Env.str(view);
    }

    return Env.str({
      rerun: 0.1,
      variables: { streaming_now: true },
      response: responseText,
      behaviour: { response: "replacelast" },
    });
  }

  // Restore interrupted session (esc)
  if (Files.exists(paths.stream)) {
    return Env.str({
      rerun: 0.1,
      variables: { streaming_now: true },
      response: chat.format(chat.messages, true),
      behaviour: { scroll: "end" },
    });
  }

  if (query.length === 0) {
    return Env.str({
      response: chat.format(chat.messages),
      behaviour: { scroll: "end" },
    });
  }

  userQuery = { role: "user", content: query };
  chat.save(userQuery);
  const context = chat.messages.slice(-(config.max_context + 1));
  stream.start(context);

  return Env.str({
    rerun: 0.1,
    variables: { streaming_now: true },
    response: chat.format(chat.messages, true),
  });
}
