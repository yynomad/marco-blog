---
title: claude code接入deepseek等模型
date: 2026-05-23
tags:
categories:
---

<!-- more -->

我在魔搭社区申请了一个key，但是配置到了环境变量之后，但是vscode的plugin不行，然后找到了这个文章，先记录下后边有时间再看

https://blog.nwn.moe/posts/14/#2-%E4%BF%AE%E6%94%B9-ccr-%E6%96%87%E4%BB%B6 

```python
{
  "APIKEY": "cc-key",
  "PROXY_URL": "http://127.0.0.1:7890",
  "LOG": true,
  "API_TIMEOUT_MS": 600000,
  "NON_INTERACTIVE_MODE": false,
  "Providers": [
    {
      "name": "deepseek",
      "api_base_url": "https://api.deepseek.com/chat/completions",
      "api_key": "",
      "models": ["deepseek-chat"],
      "transformer": {
        "use": ["deepseek"],
      }
    },
    {
      "name": "glm",
      "api_base_url": "https://open.bigmodel.cn/api/anthropic",
      "api_key": "",
      "models": ["glm-4.5-flash"],
      "transformer": {
        "use": ["claude"]
      }
    },
    {
      "name": "gemini",
      "api_base_url": "https://generativelanguage.googleapis.com/v1beta/models/",
      "api_key": "",
      "models": ["gemini-2.5-flash", "gemini-2.5-pro"],
      "transformer": {
        "use": ["gemini"]
      }
    },
    {
      "name": "modelscope",
      "api_base_url": "https://api-inference.modelscope.cn/v1/chat/completions",
      "api_key": "",
      "models": [
        "Qwen/Qwen3-Coder-480B-A35B-Instruct",
      ],
    }
  ],
  "Router": {
     "default": "modelscope,Qwen/Qwen3-Coder-480B-A35B-Instruct",
     "longContext":"gemini,gemini-2.5-flash,gemini-2.5-pro",
     "background":"glm,glm-4.5-flash",
     "thinking":"deepseek,deepseek-chat"
  }
}
```


