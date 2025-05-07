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

const AIUtils = {
  isGoogleApiStyle(config) {
    // Add a check for config and config.api_style to prevent errors if config is undefined/null
    return config && config.api_style === 'google';
  }
};

// Chat History Management
const ChatValidator = {
  isValidMessage(message) {
    return message 
      && typeof message === 'object'
      && ['user', 'assistant'].includes(message.role)
      && typeof message.content === 'string'
      && message.content.trim().length > 0;
  },

  validateMessages(messages) {
    if (!Array.isArray(messages)) {
      throw new Error('Chat history must be an array');
    }
    return messages.every(msg => this.isValidMessage(msg));
  }
};

const ChatStorage = {
  init(path) {
    this.path = path;
    this.messages = this.load();
    return this;
  },

  load() {
    try {
      const content = Files.read(this.path);
      const messages = JSON.parse(content || "[]");
      ChatValidator.validateMessages(messages);
      return messages;
    } catch (error) {
      console.log('Error loading chat history:', error);
      return [];
    }
  },

  save(message) {
    if (!ChatValidator.isValidMessage(message)) {
      throw new Error('Invalid message format');
    }

    try {
      this.messages.push(message);
      Files.write(this.path, JSON.stringify(this.messages));
    } catch (error) {
      console.log('Error saving message:', error);
      throw error;
    }
  },

  getContext(maxContext) {
    return this.messages.slice(-(maxContext + 1));
  },

  clear() {
    try {
      this.messages = [];
      Files.write(this.path, "[]");
    } catch (error) {
      console.log('Error clearing chat history:', error);
      throw error;
    }
  }
};

const ChatFormatter = {
  formatMessage(message, isLast = false, inStreaming = false) {
    if (message.role === "assistant") {
      return `${message.content}\n\n`;
    }

    if (message.role !== "user") {
      return "";
    }

    const userMessage = `##### ⊙ You\n\n${message.content}\n\n##### ⊚ Assistant`;
    const interrupted = !inStreaming && isLast;

    return `${userMessage}\n\n${interrupted ? "[Interrupted]\n\n" : ""}`;
  },

  format(messages, inStreaming = false) {
    return messages.reduce((output, msg, i, arr) => {
      const isLast = i === arr.length - 1;
      return output + this.formatMessage(msg, isLast, inStreaming);
    }, "");
  },

  addMetadata(message, config) {
    if (!config || message.role !== "assistant") {
      return message;
    }

    return {
      ...message,
      task: config.task,
      provider: config.provider,
      model: config.model
    };
  }
};

// Main Chat object that coordinates between components
const Chat = {
  init(path) {
    this.storage = ChatStorage.init(path);
    return this;
  },

  save(message) {
    this.storage.save(message);
  },

  format(messages, inStreaming = false) {
    return ChatFormatter.format(messages, inStreaming);
  },

  tag(message, config = null) {
    return ChatFormatter.addMetadata(message, config);
  },

  get messages() {
    return this.storage.messages;
  },

  getContext(maxContext) {
    return this.storage.getContext(maxContext);
  }
};

// AI Service Integration
const AIParameterMapper = {
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

    return Object.entries(parameterMap).reduce((geminiParams, [openAIParam, geminiParam]) => {
      if (params[openAIParam] !== undefined) {
        geminiParams[geminiParam] = params[openAIParam];
      }
      return geminiParams;
    }, {});
  }
};

const AIStrategyFactory = {
  _getBaseStrategy(config) {
    // Internal helper to get the non-decorated strategy
    if (AIUtils.isGoogleApiStyle(config)) {
      return GoogleGeminiStrategy;
    } else {
      // Assuming non-Google is OpenAI for now
      return OpenAIStrategy;
    }
  },

  getStrategy(config) {
    const baseStrategy = this._getBaseStrategy(config);
    if (config.cf_aig_mode) {
      // Wrap the base strategy with the Cloudflare decorator
      return CloudflareAIGStrategyDecorator.init(baseStrategy);
    }
    return baseStrategy;
  },

  getBaseStrategy(config) {
    // Public method to get the base strategy, ignoring decorator
    return this._getBaseStrategy(config);
  }
};

// Decorator for Cloudflare AI Gateway
const CloudflareAIGStrategyDecorator = {
  init(originalStrategy) {
    this.originalStrategy = originalStrategy;
    return this;
  },

  buildPayload(config, messages) {
    // Get the payload from the original strategy
    const originalPayload = this.originalStrategy.buildPayload(config, messages);
    if (!originalPayload) return null;

    // Wrap it in the Cloudflare AI Gateway format
    return [{
      provider: config.provider,
      endpoint: this.originalStrategy.getEndpointPath(config), // Use original path here
      headers: this.originalStrategy.getHeaders(config),       // Use original headers here
      query: originalPayload
    }];
  },

  // Delegate other strategy methods if needed elsewhere, though not strictly required
  // for the current buildCommand implementation if it uses the factory correctly.
  getEndpointPath(config) {
    return this.originalStrategy.getEndpointPath(config);
  },

  getHeaders(config) {
    return this.originalStrategy.getHeaders(config);
  }
};


// Strategy objects for different AI providers
const GoogleGeminiStrategy = {
  buildPayload(config, messages) {
    const contents = [];
    
    if (config.prompts) {
      contents.push(
        { role: 'user', parts: [{ text: config.prompts }] },
        { role: 'model', parts: [{ text: 'I understand and will follow these instructions.' }] }
      );
    }

    contents.push(...messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    })));

    return {
      contents,
      ...(config.tools ? { tools: config.tools } : {}),
      generationConfig: {
        ...AIParameterMapper.mapGeminiParameters(config.parameters || {})
      },
      safetySettings: []
    };
  },

  _processGroundingMetadata(text, chunks) { // Moved from StreamProcessor
    return text.replace(/\[(\d+(?:,\s*\d+)*)\]/g, (match, numbers) => {
      const indices = numbers.split(',').map(n => parseInt(n.trim()) - 1);
      const links = indices.map(index => {
        if (chunks[index]?.web) {
          const { uri } = chunks[index].web;
          return `[${index + 1}](${uri})`;
        }
        return `[${index + 1}]`;
      });
      return `[${links.join(', ')}]`;
    });
  },

  parseResponse(data) { // Moved from StreamProcessor.parseGeminiResponse
    let text = "";
    let finished = null;
    let groundingMetadata = null;

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

            if (candidate.groundingMetadata) {
              groundingMetadata = candidate.groundingMetadata;
            }

            text += candidate.content?.parts?.[0]?.text || '';

            if (candidate.finishReason) {
              finished = candidate.finishReason;
            }
          }
        } catch (error) {
          // Ignore parse errors for incomplete chunks
        }
      });

    if (groundingMetadata?.groundingChunks) {
      text = this._processGroundingMetadata(text, groundingMetadata.groundingChunks);
    }

    return { text, finished };
  },

  isError(responseData) { // Moved from StreamProcessor.isGeminiError
    try {
      const firstChunk = responseData
        .split('\n')
        .find(line => line.startsWith('data: '))
        ?.replace(/^data: /, '');

      if (!firstChunk) {
        return true;
      }
      if (firstChunk === '[DONE]') {
        return false;
      }

      const parsed = JSON.parse(firstChunk);
      return parsed.error || !parsed.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (e) {
      return true;
    }
  },

  getEndpointPath(config) {
    // Specific endpoint for Google Gemini stream
    return `v1beta/models/${config.model}:streamGenerateContent?alt=sse`;
  },

  getHeaders(config) {
    const headers = {
      'Content-Type': 'application/json' // Common header
    };
    headers['x-goog-api-key'] = config.api_key;
    return headers;
  }
};

const OpenAIStrategy = {
  buildPayload(config, messages) {
    return {
      model: config.model,
      messages: config.prompts
        ? [{ role: "system", content: config.prompts }, ...messages]
        : messages,
      ...config.parameters,
      stream: true,
    };
  },

  parseResponse(data) { // Moved from StreamProcessor.parseOpenAIResponse
    let text = "";
    let finished = null;

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
          // Ignore parse errors for incomplete chunks
        }
      });

    return { text, finished };
  },

  isError(responseData) { // Moved from StreamProcessor.isOpenAIError
    // Assuming StreamProcessor.isValidJSON is available or moved too.
    // For now, let's assume it's accessible or we can inline it if it's simple.
    // To keep this diff focused, I'll assume StreamProcessor.isValidJSON is still callable.
    // A more complete refactor might move isValidJSON to a general utility or duplicate if small.
    return (
      (StreamProcessor.isValidJSON(responseData) && !responseData.startsWith('[')) ||
      !/^(data: (?!\{"error)|(?!(data: )))/.test(responseData.trim())
    );
  },

  getEndpointPath(config) {
    // For OpenAI, the path is usually part of the full endpoint URL
    const url = $.NSURL.URLWithString(config.endpoint);
    return ObjC.unwrap(url.path);
  },

  getHeaders(config) {
    const headers = {
      'Content-Type': 'application/json' // Common header
    };
    // Handles OpenAI and Azure OpenAI header auth
    if (config.provider === 'azure') {
      headers['api-key'] = config.api_key;
    } else {
      headers['Authorization'] = `Bearer ${config.api_key}`;
    }
    return headers;
  }
};

const AIPayloadBuilder = {
  // buildGeminiPayload and buildOpenAIPayload methods are now moved to their respective strategy objects.

  buildPayload(config, messages) {
    if (!config.endpoint) return null;

    // Fetch original payload once after the initial endpoint check.
    const originalPayload = this.getOriginalPayload(config, messages);
    if (!originalPayload) return null; // If original payload itself is null, return.

    // The factory now returns the correct strategy (potentially decorated)
    // The decorator handles the cf_aig_mode wrapping if necessary.
    const strategy = AIStrategyFactory.getStrategy(config);
    return strategy.buildPayload(config, messages);
  },

  getOriginalPayload(config, messages) {
    const strategy = AIStrategyFactory.getStrategy(config);
    return strategy.buildPayload(config, messages);
  }
};

const AIEndpointHandler = {
  // getEndpointPath and getHeaders are removed as their logic is now fully
  // handled by strategies or within getCommandEndpoint/getCommandHeaders.

  buildCommand(config, messages) {
    const payload = AIPayloadBuilder.buildPayload(config, messages);
    if (!payload) return null;

    const timeoutSeconds = Env.getTimeoutSeconds();
    const headers = this.getCommandHeaders(config);
    const endpoint = this.getCommandEndpoint(config);

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

  getCommandHeaders(config) {
    // Base headers required for streaming
    const headers = [
      "--header", "Content-Type: application/json",
      "--header", "Accept: text/event-stream",
    ];

    // Add Cloudflare AIG header if applicable
    if (config.cf_aig_mode && config.cf_api_key) {
      headers.push("--header", `cf-aig-authorization: Bearer ${config.cf_api_key}`);
    } else {
      // Add provider-specific auth headers by getting the *base* strategy's headers
      // and formatting them for curl.
      const baseStrategy = AIStrategyFactory.getBaseStrategy(config);
      const providerHeaders = baseStrategy.getHeaders(config);
      for (const key in providerHeaders) {
        // Skip Content-Type as it's already added
        if (key.toLowerCase() !== 'content-type') {
          headers.push("--header", `${key}: ${providerHeaders[key]}`);
        }
      }
    }
    return headers;
  },

  getCommandEndpoint(config) {
    // If using Cloudflare, the endpoint is the Cloudflare endpoint
    if (config.cf_aig_mode) {
      return config.cf_endpoint;
    }

    // Otherwise, determine the endpoint based on the base provider strategy
    const baseStrategy = AIStrategyFactory.getBaseStrategy(config);

    if (baseStrategy === GoogleGeminiStrategy) {
      // Reconstruct the specific Google streaming URL from the base endpoint parts
      const url = $.NSURL.URLWithString(config.endpoint); // Base URL like https://generativelanguage.googleapis.com
      const scheme = ObjC.unwrap(url.scheme);
      const host = ObjC.unwrap(url.host);
      const googlePath = baseStrategy.getEndpointPath(config); // Gets the specific path part
      return `${scheme}://${host}/${googlePath}`;
    } else {
      // For OpenAI and others, assume the config.endpoint is the full URL
      return config.endpoint;
    }
  }
};

// Main AI object that coordinates between components
const AI = {
  command(config, messages) {
    return AIEndpointHandler.buildCommand(config, messages);
  }
};

// Streaming Operations
const StreamProcessor = {
  // parseGeminiResponse, parseOpenAIResponse, and processGroundingMetadata are moved to strategies.

  parse(data, config) {
    try {
      // Use the base strategy for parsing, as CF AIG decorator doesn't change response format
      const strategy = AIStrategyFactory.getBaseStrategy(config);
      return strategy.parseResponse(data);
    } catch (error) {
      console.log('Parse error:', error);
      return { text: '', finished: null };
    }
  },

  isValidJSON(data) {
    try {
      JSON.parse(data);
      return true;
    } catch (e) {
      return false;
    }
  },

  // isGeminiError and isOpenAIError are now part of their respective strategies.

  isError(data, config) {
    if (data.startsWith("curl:")) { // Generic curl error check
      return true;
    }
    // Use the base strategy for error checking
    const strategy = AIStrategyFactory.getBaseStrategy(config);
    return strategy.isError(data);
  }
};

const StreamManager = {
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
    if (StreamProcessor.isError(data, this.config)) {
      return { text: data, finished: "error" };
    }

    const { text, finished } = StreamProcessor.parse(data, this.config);
    if (this.isStalled()) {
      return { text, finished: "stalled" };
    }

    return { text, finished };
  },

  isStalled() {
    return Date.now() - Files.mtime(this.stream) > Env.getTimeoutMs();
  },

  cleanup() {
    Files.delete(this.stream);
    Files.delete(this.pid);
  }
};

// Main Workflow
const WorkflowConfig = {
  init() {
    const config = JSON.parse(Env.get("recipe"));
    config.max_context ||= 4;
    return config;
  },

  getPaths() {
    const dataPath = Env.get("alfred_workflow_data");
    const cachePath = Env.get("alfred_workflow_cache");
    return {
      chat: `${dataPath}/chat.json`,
      stream: `${cachePath}/stream.txt`,
      pid: `${cachePath}/pid.txt`,
    };
  },

  isStreaming() {
    return Env.get("streaming_now") === "1";
  }
};

const WorkflowResponse = {
  createStreamingResponse(responseText) {
    return {
      rerun: 0.1,
      variables: { streaming_now: true },
      response: responseText,
      behaviour: { response: "replacelast" },
    };
  },

  createFinishedResponse(responseText, config, reason) {
    return {
      response: reason === "stalled"
        ? `${responseText}\n[Connection Stalled]`
        : responseText,
      variables: { streaming_now: false },
      footer: `[${config.provider}: ${config.model}]: ${reason}`,
    };
  },

  createEmptyResponse() {
    return {
      rerun: 0.1,
      variables: { streaming_now: true },
    };
  },

  createRestoreResponse(chat) {
    return {
      rerun: 0.1,
      variables: { streaming_now: true },
      response: chat.format(chat.messages, true),
      behaviour: { scroll: "end" },
    };
  },

  createHistoryResponse(chat) {
    return {
      response: chat.format(chat.messages),
      behaviour: { scroll: "end" },
    };
  }
};

const WorkflowManager = {
  init() {
    const config = WorkflowConfig.init();
    const paths = WorkflowConfig.getPaths();
    const chat = Chat.init(paths.chat);
    const stream = StreamManager.init(config, paths);
    return { config, chat, stream };
  },

  handleStreaming(chat, stream, config) {
    const { text, finished } = stream.process();

    if (text.length === 0) {
      return WorkflowResponse.createEmptyResponse();
    }

    const responseText = chat.format(chat.messages, true) + text;

    if (finished) {
      const reason = finished.toLowerCase();
      chat.save({ role: "assistant", content: text });
      stream.cleanup();
      return WorkflowResponse.createFinishedResponse(responseText, config, reason);
    }

    return WorkflowResponse.createStreamingResponse(responseText);
  },

  handleNewQuery(chat, stream, config, query) {
    const userQuery = { role: "user", content: query };
    chat.save(userQuery);
    const context = chat.getContext(config.max_context);
    stream.start(context);

    return WorkflowResponse.createStreamingResponse(chat.format(chat.messages, true));
  }
};

function run(argv) {
  const query = argv[0]?.trim();
  const { config, chat, stream } = WorkflowManager.init();
  const paths = WorkflowConfig.getPaths();

  // Handle streaming state
  if (WorkflowConfig.isStreaming()) {
    return Env.str(WorkflowManager.handleStreaming(chat, stream, config));
  }

  // Restore interrupted session
  if (Files.exists(paths.stream)) {
    return Env.str(WorkflowResponse.createRestoreResponse(chat));
  }

  // Handle empty query
  if (query.length === 0) {
    return Env.str(WorkflowResponse.createHistoryResponse(chat));
  }

  // Handle new query
  return Env.str(WorkflowManager.handleNewQuery(chat, stream, config, query));
}
