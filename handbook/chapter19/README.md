# 第 19 章：多模态 — 图片理解

> 本章目标：理解 Vision API 的工作方式，掌握在前端应用中发送图片给 LLM 并获取分析结果的实现路径。
> 对应学习计划：Day 29
> 🚧 本章内容基于官方文档整理，部分代码骨架待实际项目验证。

---

## 概念速览

### 什么是 Vision（多模态图片理解）

Vision 指 LLM 接收**图片 + 文本**作为输入，理解图片内容后生成文本回答。

```
传统 LLM：  文本 → 文本
Vision LLM：文本 + 图片 → 文本
```

它不是 OCR（光学字符识别）。OCR 只能提取文字，Vision 能"看懂"图片的语义——比如分析 UI 设计是否合理、描述图表趋势、理解代码截图中的逻辑。

### 图片输入的两种方式

| 方式 | 格式 | 适用场景 |
|------|------|---------|
| URL | `https://example.com/image.png` | 图片已有公网地址 |
| Base64 | `data:image/png;base64,iVBOR...` | 本地上传、无公网地址 |

⚠️ URL 方式要求图片可被模型服务端直接访问（国内模型可能无法访问 GitHub 等外网图片）。

### 哪些模型支持 Vision

| 模型 | Vision 支持 | 备注 |
|------|------------|------|
| GPT-4o / GPT-4o-mini | ✅ | 图片理解能力最强之一 |
| Claude 3.5 Sonnet / Haiku | ✅ | 长文档理解特别好 |
| qwen-vl-max / qwen-vl-plus | ✅ | 阿里云通义的视觉模型 |
| deepseek-chat | ❌ | 截至目前不支持图片输入 |

---

## 技术选型

### AI SDK 的多模态消息格式

AI SDK 统一了多模态消息的格式，不需要为每个 Provider 写不同的代码：

```
核心区别：
  普通消息：content 是字符串
  多模态消息：content 是数组，包含 text 部分和 image 部分
```

### 前端图片上传方案

```
方案对比：

1. FileReader + Base64
   → 最简单，直接在浏览器端转成 Base64 发送
   → 缺点：大图片 Base64 字符串很长，增加请求体积
   → 适合：学习阶段、图片 < 5MB

2. 上传到 OSS/CDN → 传 URL
   → 生产级方案，图片存在云端
   → 缺点：需要额外的存储服务
   → 适合：生产环境

3. Next.js API Route 中转
   → 前端上传文件到自己的后端，后端转发给 LLM
   → 中间方案，不依赖外部存储
```

---

## 代码骨架

### 1. 使用 AI SDK 发送图片（脚本版）

思路：用 AI SDK 的多模态消息格式，content 传数组（包含 text 和 image 两部分）。

```typescript
import { generateText } from 'ai'
import { qwen } from 'shared-utils'
import { readFileSync } from 'fs'

// 思路：本地图片 → 读取为 Buffer → AI SDK 自动处理编码
const imageBuffer = readFileSync('./screenshot.png')

const result = await generateText({
  // 思路：必须用支持 Vision 的模型，普通模型会报错
  model: qwen('qwen-vl-max'),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: '这张截图有什么问题？请指出 UI 设计上的不足。' },
        // 思路：type: 'image' 可以传 URL 字符串、Buffer、或 base64 data URI
        { type: 'image', image: imageBuffer },
      ],
    },
  ],
})

console.log(result.text)
```

### 2. 前端图片上传（FileReader + Base64）

思路：在浏览器端用 FileReader 把文件转成 base64 Data URL，然后通过 fetch 发送给后端 API。

```tsx
// 思路：这是一个 React 组件片段，处理图片选择和预览

function ImageUploader({ onImageReady }: {
  onImageReady: (dataUrl: string) => void
}) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 思路：前端校验 — 类型和大小限制要在发送前做
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) {
      alert('图片不能超过 5MB')
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      // 思路：readAsDataURL 的结果格式为 "data:image/png;base64,iVBOR..."
      onImageReady(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  return <input type="file" accept="image/*" onChange={handleFileChange} />
}
```

### 3. 后端 API Route 处理图片消息

思路：前端把 base64 图片数据通过 JSON body 发到 route.ts，后端提取出来组装成 AI SDK 的多模态消息格式。

```typescript
// app/api/vision/route.ts
import { streamText } from 'ai'
import { qwen } from 'shared-utils'

export async function POST(req: Request) {
  const { prompt, imageDataUrl } = await req.json()

  const result = streamText({
    model: qwen('qwen-vl-max'),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          // 思路：AI SDK 接受 data URI 格式的 base64 图片
          ...(imageDataUrl
            ? [{ type: 'image' as const, image: imageDataUrl }]
            : []),
        ],
      },
    ],
  })

  return result.toDataStreamResponse()
}
```

---

## 实战建议（Day 29 任务指南）

### 任务 1：编写 `01-vision-api.ts` — Vision 基础

```
实现思路：
1. 准备 2-3 张测试图片（截图、图表、代码截图）
2. 分别用 URL 方式和 Buffer 方式发送给 Vision 模型
3. 测试不同类型的提问：
   - 描述性："这张图片里有什么？"
   - 分析性："这张 UI 截图有哪些可以改进的地方？"
   - 提取性："把这张图表中的数据整理成表格"
```

### 任务 2：在 Web 项目中实现图片上传

```
实现思路：
1. 在 stage-3-chat-app 或新建项目中添加图片上传组件
2. 支持拖拽上传（监听 dragover + drop 事件）
3. 上传后显示预览缩略图
4. 发送给后端时把 base64 数据放在消息体中
5. 关键决策：图片是放在单独的 /api/vision 路由，还是复用 /api/chat 路由？
   → 建议学习阶段先用独立路由，逻辑更清晰
```

### 任务 3：测试典型场景

```
三个实际场景：
1. 截图提问 → "这张截图有什么问题？"（准备一个有明显问题的 UI 截图）
2. 图表解读 → "这张柱状图显示了什么趋势？"（准备一个简单图表截图）
3. 代码截图分析 → "这段代码有什么 bug？"（准备一个有错误的代码截图）
```

---

## 踩坑记录

⚠️ **坑 1：国内 Vision 模型不一定支持外网图片 URL**
如果你传一个 GitHub 上的图片 URL 给 qwen-vl-max，可能会超时或返回"无法获取图片"。
→ **怎么绕**：学习阶段统一用 Base64 方式传图片，避免网络问题。

⚠️ **坑 2：Base64 图片很大，容易超过请求体限制**
一张 3MB 的 PNG 转成 Base64 会变成 ~4MB 字符串。如果 Next.js 默认的 body size limit 是 1MB，会直接 413 报错。
→ **怎么绕**：在 `next.config.ts` 中调大 `bodyParser.sizeLimit`：
```typescript
// next.config.ts
export default {
  api: { bodyParser: { sizeLimit: '10mb' } },
}
```

⚠️ **坑 3：不是所有模型的 Vision 能力都一样**
GPT-4o 对细节文字识别很强，但某些模型可能把小字看错。Claude 对长文档截图特别好，但简单图片描述可能不如 GPT-4o。
→ **建议**：根据实际场景选模型，先用几张测试图片对比质量。

⚠️ **坑 4：Vision 调用的 Token 消耗比纯文本高很多**
一张中等分辨率图片可能消耗 500-2000 Token（取决于模型和图片大小），比纯文本贵。
→ **建议**：发送前先压缩图片分辨率（前端 Canvas 缩放到 1024px 以内）。

---

## 练习

### 基础练习
1. 用 `generateText` + Vision 模型发送一张本地图片，打印 AI 的回答
2. 分别用 URL 和 Base64 两种方式发送同一张图片，对比结果

### 进阶挑战
1. 实现一个图片聊天组件：用户可以上传图片 + 输入文字，一起发送给 AI
2. 实现图片压缩：在发送前用 Canvas 将图片缩放到 1024x1024 以内

### 思考题
1. Vision 模型"看图"消耗的 Token 是怎么计算的？（提示：查阅 OpenAI 和 Anthropic 的 Vision 定价文档）
2. 如果要做一个"UI 截图自动审查"工具，你的 Prompt 应该怎么设计才能得到结构化的审查报告？

---

## 延伸阅读

| 资料 | 推荐理由 |
|------|---------|
| [OpenAI Vision Guide](https://platform.openai.com/docs/guides/vision) | 📖 GPT-4o Vision 的官方指南，含 Token 计算规则 |
| [Claude Vision](https://docs.anthropic.com/en/docs/build-with-claude/vision) | 📖 Claude 的图片处理能力和限制 |
| [AI SDK 多模态文档](https://sdk.vercel.ai/docs/foundations/prompts#multi-modal-messages) | 📖 AI SDK 的多模态消息格式说明 |
| [通义千问 VL 模型](https://help.aliyun.com/zh/model-studio/user-guide/vision) | 📖 qwen-vl 系列模型的使用说明 |

---

| [← 上一章：成本控制与 Token 优化](../chapter18/README.md) | [下一章：多模态 — 图片生成 →](../chapter20/README.md) |
