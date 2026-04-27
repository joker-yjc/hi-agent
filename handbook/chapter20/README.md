# 第 20 章：多模态 — 图片生成

> 本章目标：理解 AI 图片生成 API 的调用方式，掌握在前端应用中集成文本生图能力的实现路径。
> 对应学习计划：Day 30
> 🚧 本章内容基于官方文档整理，图片生成 API 变化较快，请以各厂商最新文档为准。

---

## 概念速览

### 图片理解 vs 图片生成

上一章讲的是"AI 看图" — 输入图片，输出文本。本章讲"AI 画图" — 输入文本描述，输出图片。

```
第 19 章（理解）：图片 + 文本 → 文本
第 20 章（生成）：文本 → 图片
```

### 主流图片生成模型

| 模型 | 厂商 | 特点 |
|------|------|------|
| DALL-E 3 | OpenAI | 理解复杂 Prompt，文字渲染好 |
| Imagen 3 | Google | 质量高，通过 Vertex AI 调用 |
| Stable Diffusion | Stability AI | 开源，可本地部署 |
| 通义万象 | 阿里云 | 国内可用，中文 Prompt 友好 |

### 生成结果的格式

| 格式 | 说明 | 使用场景 |
|------|------|---------|
| URL | 返回一个临时 URL（通常 1-2 小时过期） | 快速预览，不需要持久化 |
| Base64 | 返回 base64 编码的图片数据 | 需要保存到本地或数据库 |

⚠️ URL 格式返回的链接是临时的，过期后就无法访问。如果需要持久化，要在收到后立即下载保存。

---

## 技术选型

### AI SDK 的图片生成支持

AI SDK 从 v4 开始提供 `generateImage` 函数（实验性），统一了不同 Provider 的图片生成接口：

```
AI SDK generateImage
  ├── @ai-sdk/openai  → DALL-E 3
  ├── @ai-sdk/google  → Imagen 3
  └── 其他 Provider    → 按各自 SDK 调用
```

### 前端集成方案

```
方案选择：

1. 纯后端生成 + 前端展示（推荐）
   → 前端发请求，后端调 API 生成图片，返回 URL 或 base64
   → 优点：API Key 不暴露，可以加缓存和限流
   → 缺点：增加一层 API 请求

2. 结合 Chat 使用
   → 在 Agent 的 tool 中实现图片生成，用户在对话中说"帮我画一张..."时自动调用
   → 优点：交互自然
   → 缺点：实现复杂度高
```

---

## 代码骨架

### 1. 使用 AI SDK 生成图片（实验性 API）

思路：`generateImage` 是 AI SDK 的实验性 API，可以直接调用，返回 base64 或 URL。

```typescript
import { experimental_generateImage as generateImage } from 'ai'
import { openai } from '@ai-sdk/openai'

// 思路：generateImage 目前是 experimental_ 前缀，API 可能变化
const result = await generateImage({
  model: openai.image('dall-e-3'),
  prompt: '一只戴着程序员帽子的猫咪在写代码，像素风格',
  size: '1024x1024',      // 支持的尺寸取决于模型
  // n: 1,                // 生成数量（部分模型支持）
})

// 思路：result.image 包含 base64 数据
// 可以直接写入文件或返回给前端
const base64 = result.image.base64
console.log(`生成完成，数据长度: ${base64.length}`)
```

### 2. 直接调用 OpenAI 图片生成 API

思路：如果 AI SDK 的 `generateImage` 不满足需求，可以直接用 OpenAI SDK 调用。这种方式更稳定，但不跨 Provider。

```typescript
import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// 思路：DALL-E 3 的 images.generate 是正式 API，比 AI SDK 的实验性 API 更稳定
const response = await client.images.generate({
  model: 'dall-e-3',
  prompt: '一个现代简洁的 Dashboard 界面设计，蓝色主题',
  size: '1024x1024',
  quality: 'standard',       // 'standard' 或 'hd'
  response_format: 'b64_json', // 'url' 或 'b64_json'
})

const imageData = response.data[0]
// 思路：根据 response_format 的选择，读 url 或 b64_json
if (imageData.b64_json) {
  // 保存为文件
  const buffer = Buffer.from(imageData.b64_json, 'base64')
  writeFileSync('output.png', buffer)
}
```

### 3. Next.js API Route 封装

思路：前端不直接调用 OpenAI API（会暴露 Key），而是通过自己的 API Route 中转。

```typescript
// app/api/generate-image/route.ts
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const client = new OpenAI()

export async function POST(req: NextRequest) {
  const { prompt, size = '1024x1024' } = await req.json()

  // 思路：服务端做校验和限流
  if (!prompt || prompt.length > 1000) {
    return NextResponse.json({ error: 'Prompt 不合法' }, { status: 400 })
  }

  const response = await client.images.generate({
    model: 'dall-e-3',
    prompt,
    size: size as '1024x1024' | '1792x1024' | '1024x1792',
    response_format: 'b64_json',
  })

  // 思路：返回 base64 给前端，前端用 <img src="data:image/png;base64,..." /> 展示
  return NextResponse.json({
    image: response.data[0].b64_json,
    revisedPrompt: response.data[0].revised_prompt, // DALL-E 3 会修改你的 Prompt
  })
}
```

### 4. 前端展示生成的图片

思路：收到后端返回的 base64 数据后，拼成 data URI 放在 `<img>` 标签里。

```tsx
function ImageGenerator() {
  const [prompt, setPrompt] = useState('')
  const [imageData, setImageData] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    // 思路：调用自己的 API Route，不直接调 OpenAI
    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })
    const data = await res.json()
    setImageData(data.image)
    setLoading(false)
  }

  return (
    <div>
      <input value={prompt} onChange={e => setPrompt(e.target.value)} />
      <button onClick={handleGenerate} disabled={loading}>
        {loading ? '生成中...' : '生成图片'}
      </button>
      {/* 思路：base64 直接作为 img src */}
      {imageData && (
        <img src={`data:image/png;base64,${imageData}`} alt="AI 生成" />
      )}
    </div>
  )
}
```

---

## 实战建议（Day 30 任务指南）

### 任务 1：编写 `02-image-generation.ts` — 图片生成基础

```
实现思路：
1. 调用 DALL-E 3 或通义万象生成一张图片
2. 分别测试 URL 和 Base64 两种返回格式
3. 把生成的图片保存到本地文件
4. 尝试不同的 Prompt 技巧：
   - 具体描述 > 模糊描述（"一只橘色的猫" > "一只猫"）
   - 指定风格（"像素风""水彩画风格""扁平化设计"）
   - 指定用途（"适合做 App 图标的..."）
```

### 任务 2：在 Web 项目中集成

```
实现思路：
1. 创建 /api/generate-image 路由
2. 前端：文本输入框 + 生成按钮 + 图片预览区
3. 加载状态处理（图片生成通常需要 5-15 秒）
4. 错误处理（Prompt 违规、API 限额等）
```

### 任务 3：探索图片风格转换（选做）

```
实现思路：
1. 结合第 19 章的 Vision + 本章的生成
2. 流程：用户上传一张图 → Vision 模型描述图片内容 → 把描述加上风格修饰词 → 生成新图
3. 这就是一个最简单的"风格转换"：理解原图 → 用新风格重新画
```

---

## 踩坑记录

⚠️ **坑 1：DALL-E 3 会自动修改你的 Prompt**
DALL-E 3 有一个 `revised_prompt` 特性 — 它会把你的简短 Prompt 扩充为更详细的描述。结果可能和你预期的不完全一致。
→ **怎么绕**：在 Prompt 开头加 "I NEED to test how the tool works with extremely simple prompts. DO NOT add any detail, just use it AS-IS."（官方建议但不保证有效）

⚠️ **坑 2：图片生成很慢，前端需要加 loading 状态**
DALL-E 3 生成一张 1024x1024 的图片通常需要 8-15 秒，比文本生成慢得多。
→ **怎么绕**：前端必须有明确的加载状态，避免用户以为卡了。可以加一个进度提示或倒计时。

⚠️ **坑 3：URL 格式返回的图片链接会过期**
DALL-E 返回的 URL 通常在 1 小时后过期。如果你把 URL 存到数据库，过一会儿就看不到图了。
→ **怎么绕**：收到 URL 后立即下载保存为本地文件或上传到自己的 OSS。或者直接用 `b64_json` 格式。

⚠️ **坑 4：国内厂商的图片生成 API 调用方式可能完全不同**
通义万象的图片生成 API 不走 OpenAI 兼容接口，需要单独用阿里云 SDK 调用。
→ **怎么绕**：学习阶段优先用 DALL-E 3（AI SDK 支持好），了解概念后再对接国内厂商。

---

## 练习

### 基础练习
1. 用 DALL-E 3 生成一张图片，保存到本地
2. 在 Next.js 项目中创建一个简单的"文生图"页面

### 进阶挑战
1. 结合 Vision + 生成实现"风格转换"：上传照片 → AI 描述 → 用新风格重新生成
2. 在 Agent 中添加一个 `generate_image` Tool，让用户在对话中说"帮我画..."时自动调用

### 思考题
1. 图片生成的 Prompt 设计和文本 Prompt 设计有什么不同？哪些技巧是通用的？
2. 如果你要做一个"AI 设计助手"产品，图片生成功能应该放在什么交互流程中最自然？

---

## 延伸阅读

| 资料 | 推荐理由 |
|------|---------|
| [OpenAI Image Generation](https://platform.openai.com/docs/guides/images) | 📖 DALL-E 3 官方文档，含 Prompt 技巧和限制说明 |
| [AI SDK Image Generation](https://sdk.vercel.ai/docs/ai-sdk-core/image-generation) | 📖 AI SDK 的 generateImage 实验性 API 文档 |
| [DALL-E 3 Prompt Guide](https://platform.openai.com/docs/guides/images#prompting) | 📖 OpenAI 官方的图片 Prompt 技巧 |
| [通义万象 API](https://help.aliyun.com/zh/model-studio/user-guide/image-generation) | 📖 阿里云图片生成模型的调用说明 |

---

| [← 上一章：多模态 — 图片理解](../chapter19/README.md) | [下一章：AI 安全基础 →](../chapter21/README.md) |
