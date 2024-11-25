# <img src='Workflow/icon.png' width='45' align='center' alt='icon'> LLM Alfred Workflow

## Setup

$$Magic = Wand + Gesture + Spell$$

```json
{
  "wands": {
    "google": {
      "endpoint": "https://generativelanguage.googleapis.com/v1beta/chat/completions",
      "api_key": ""
    },
    "azure": {
      "endpoint": "https://${resource}.openai.azure.com/openai/deployments/${deployment}/chat/completions?api-version=${api_version}",
      "api_key": ""
    },
    "groq": {
      "endpoint": "https://api.groq.com/openai/v1/chat/completions",
      "api_key": ""
    },
    "openai": {
      "endpoint": "https://api.openai.com/v1/chat/completions",
      "api_key": ""
    },
    "anthropic": {
      "endpoint": "https://api.anthropic.com/v1/messages",
      "api_key": ""
    },
    "xai": {
      "endpoint": "https://api.x.ai/v1/chat/completions",
      "api_key": ""
    }
  },
  "gestures": {
    "gemini-pro": {
      "model": "gemini-1.5-pro",
      "temperature": 1.0,
      "top_p": 0.95,
      "max_context": 6,
      "max_tokens": 1024
    },
    "gemini-flash": {
      "model": "gemini-1.5-flash",
      "temperature": 0,
      "top_p": 0.95,
      "max_context": 6,
      "max_tokens": 1024
    },
    "gemini-exp": {
      "model": "gemini-exp-1121",
      "temperature": 1,
      "top_p": 0.95,
      "max_context": 6,
      "max_tokens": 4096
    },
    "azure-openai": {
      "resource": "hola",
      "deployment": "gpt-4o-mini",
      "api_version": "2024-06-01",
      "temperature": 0,
      "top_p": 1,
      "max_context": 4,
      "max_tokens": 1024
    },
    "openai": {
      "model": "gpt-4o-mini",
      "temperature": 0.3,
      "top_p": 1,
      "max_context": 4,
      "max_tokens": 1024
    },
    "meta-llama": {
      "model": "llama-3.2-90b-vision-preview",
      "temperature": 0.1,
      "top_p": 0.95,
      "max_context": 10,
      "max_tokens": 8192
    },
    "grok": {
      "model": "grok-beta",
      "temperature": 0,
      "max_context": 4
    }
  },
  "spells": {
    "translate": "You're a multilingual expert. Your primary task is to translate the given content to <context_placeholder>.\n\nFollow these principles to think: Accuracy, Clarity, Naturalness, Context Relevance.\n\nFollow these steps to action:\n\n1. Carefully analyze the text, paying close attention to its context, structure and vocabularies\n\n2. Translate it to <context_placeholder> for the first time based on your analysis\n\n3. Critically review and proofread your initial translation against the original text and the expression habits of the <context_placeholder>.\n\n4. Refine your translation again based on your review and proofreading\n\n5. Ouput the refined translation only.\n\nHere are the content needed to be translate:\n\n",
    "improve": "Correct and improve my writing; return only the results.\n\nHere is the text: \n\n",
    "teach": "Here are instructions from the user outlining your goals and how you should respond:\n\nFirst, translate the keyword into Chinese, provide international phonetic alphabet (IPA, only for the given keyword), part of speech, and meaning. Then explain the word’s root, meaning, and how it has derived into the current meaning. If necessary, explain its etymology.\n\nThen provide an example sentence in both English and Chinese in a common everyday scenario. You can give a few more words based on the same root, along with their Chinese translations.\n\nThe focus is on helping the user quickly understand the word's origin, memorize the word and its root, and use this to learn new vocabulary, expanding their vocabulary. The tone and style should be fun and relaxed.\n\n",
    "ask": "You're a helpful assistant.",
    "eli5": "in a short and concise way (eli5), explain the following topic\n\ninclude zettelkasten style [[wikilinks]] to key concepts\n\nif they are general terms that would require disambiguation then add the topic into brackets in the link, while also setting the visual of the link to be just the key term\n\ni.e. 'Paragraph' as a key term in the subject 'COBOL' could be written as [[Notes (COBOL)|Notes]]\n\nformat plural keywods as [[singular|plural]]\n\nmake sure to only include keywords that would be useful to research further\n\nTopic:\n\n",
    "commit": "based on the given text, write git commit message in English for me, keep it as simple as possible.\n\n",
    "cot": "Begin by enclosing all thoughts within <thinking> tags, exploring multiple angles and approaches.\n\nBreak down the solution into clear steps within <step> tags. Start with a 20-step budget, requesting more for complex problems if needed.\n\nUse <count> tags after each step to show the remaining budget. Stop when reaching 0.\n\nContinuously adjust your reasoning based on intermediate results and reflections, adapting your strategy as you progress.\n\nRegularly evaluate progress using <reflection> tags. Be critical and honest about your reasoning process.\n\nAssign a quality score between 0.0 and 1.0 using <reward> tags after each reflection. Use this to guide your approach:\n\n0.8+: Continue current approach\n\n0.5-0.7: Consider minor adjustments\n\nBelow 0.5: Seriously consider backtracking and trying a different approach\n\nIf unsure or if reward score is low, backtrack and try a different approach, explaining your decision within <thinking> tags.\n\nFor mathematical problems, show all work explicitly using LaTeX for formal notation and provide detailed proofs.\n\nExplore multiple solutions individually if possible, comparing approaches in reflections.\n\nUse thoughts as a scratchpad, writing out all calculations and reasoning explicitly.\n\nSynthesize the final answer within <answer> tags, providing a clear, concise summary.\n\nConclude with a final reflection on the overall solution, discussing effectiveness, challenges, and solutions. Assign a final reward score."
  },
  "magics": {
    "translate": {
      "wand": "groq",
      "gesture": "meta-llama",
      "spell": "translate"
    },
    "improve": {
      "wand": "google",
      "gesture": "gemini-flash",
      "spell": "improve"
    },
    "teach": {
      "wand": "azure",
      "gesture": "azure-openai",
      "spell": "teach"
    },
    "ask": {
      "wand": "xai",
      "gesture": "grok",
      "spell": "ask"
    },
    "eli5": {
      "wand": "xai",
      "gesture": "grok",
      "spell": "eli5"
    },
    "commit": {
      "wand": "google",
      "gesture": "gemini-flash",
      "spell": "commit"
    }
  }
}
```

## Usage

### ChatGPT

Query ChatGPT via the `chatgpt` keyword, the [Universal Action](https://www.alfredapp.com/help/features/universal-actions/), or the [Fallback Search](https://www.alfredapp.com/help/features/default-results/fallback-searches/).

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
