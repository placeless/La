# La 🌶️ - An LLM Alfred Workflow

## Setup

```
{
  "providers": {
    "google": {
      "endpoint": "https://generativelanguage.googleapis.com/v1beta/models",
      "api_key": "",
      "models": {
        "gemini-2.5-flash": "gemini-2.5-flash-preview-04-17",
        "gemini-2.0-flash": "gemini-2.0-flash"
      }
    },
    "google_openai": {
      "endpoint": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      "api_key": "",
      "models": {
        "gemini-2.0-flash-lite": "gemini-2.0-flash-lite-preview-02-05",
        "learnlm-1.5-pro": "learnlm-1.5-pro-experimental"
      }
    },
    "groq": {
      "endpoint": "https://api.groq.com/openai/v1/chat/completions",
      "api_key": "",
      "models": {
        "qwen-qwq-32b": "qwen-qwq-32b"
      }
    }
  },
  "tasks": {
    "explain": {
      "provider": "google_openai",
      "model": "gemini-2.0-flash",
      "parameters": {
        "temperature": 0.3,
        "maxTokens": 8192
      },
      "prompts": "explain.md"
    },
    "ask": {
      "provider": "google",
      "model": "gemini-2.5-flash",
      "parameters": {
        "temperature": 0.1
      },
      "tools": [
        {
          "googleSearch": {}
        }
      ],
      "max_context": 4,
      "prompts": "You are Gemini, an AI assistant created by Google.",
      "extra": "profile.md"
    }
  }
}
```

## Usage

### ChatGPT

Query ChatGPT via the `ask` keyword, the [Universal Action](https://www.alfredapp.com/help/features/universal-actions/), or the [Fallback Search](https://www.alfredapp.com/help/features/default-results/fallback-searches/).

![Start ChatGPT query](Workflow/images/about/chatgptkeyword.png)

![Querying ChatGPT](Workflow/images/about/chatgpttextview.png)

- <kbd>↩&#xFE0E;</kbd> Ask a new question.
- <kbd>⌘</kbd><kbd>↩&#xFE0E;</kbd> Continue chat.
- <kbd>⌥</kbd><kbd>↩&#xFE0E;</kbd> Copy last answer.
- <kbd>⌃</kbd><kbd>↩&#xFE0E;</kbd> Copy full chat.
- <kbd>⇧</kbd><kbd>↩&#xFE0E;</kbd> Stop generating answer.

#### Chat History

View Chat History with ⌥↩&#xFE0E; in the `chatgpt` keyword. Each result shows the first question as the title and the last as the subtitle.

![Viewing chat histories](Workflow/images/about/chatgpthistory.png)

<kbd>↩&#xFE0E;</kbd> to archive the current chat and load the selected one. Older chats can be trashed with the `Delete` [Universal Action](https://www.alfredapp.com/help/features/universal-actions/). Select multiple chats with the [File Buffer](https://www.alfredapp.com/help/features/file-search/#file-buffer).
