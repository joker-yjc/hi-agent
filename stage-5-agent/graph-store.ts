/**
 * Graph Memory Store — 知识图谱记忆公共存储模块
 *
 * 提供 JSON 文件持久化的知识图谱存储能力，供 10-entity-memory.ts 使用：
 * - Entity（实体）：图中的节点，包含名称、类型、观察列表
 * - Relation（关系）：图中的边，连接两个实体
 * - loadGraph / saveGraph：JSON 文件读写
 * - mergeIntoGraph：增量合并实体和关系（去重）
 * - searchGraph：关键词匹配实体 → 图遍历找关系 → 返回相关上下文
 * - listGraph / listEntities：查看图状态
 */

import * as fs from "fs"
import * as path from "path"

// ==================== 类型定义 ====================

/** 实体：图中的节点 */
export interface Entity {
  /** 实体名（同时也是主键，如 "张三"、"AI项目"） */
  name: string
  /** 实体类型（person / project / company / ...） */
  type: string
  /** 观察列表：挂在实体上的事实记录 */
  observations: string[]
}

/** 关系：图中的边 */
export interface Relation {
  /** 主体实体名 */
  from: string
  /** 客体实体名 */
  to: string
  /** 关系类型（manager_of / works_on / friend_of / ...） */
  type: string
}

/** 图存储文件的数据结构 */
export interface GraphStore {
  /** 所有实体 */
  entities: Entity[]
  /** 所有关系 */
  relations: Relation[]
  /** 最后更新时间 */
  updatedAt: number
}

/** 图检索结果：一段格式化的上下文文本 */
export interface GraphSearchResult {
  /** 匹配到的实体列表 */
  matchedEntities: Entity[]
  /** 与匹配实体相关的关系列表 */
  matchedRelations: Relation[]
  /** 关系中引用的关联实体（1 跳扩展） */
  relatedEntities: Entity[]
  /** 格式化的上下文文本，可直接注入 System Prompt */
  contextText: string
}

// ==================== 文件持久化 ====================

/**
 * 从 JSON 文件加载图存储
 * 如果文件不存在，返回空存储
 *
 * @param filePath - 图存储文件路径
 * @returns 图存储对象
 */
export function loadGraph(filePath: string): GraphStore {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8")
      const store = JSON.parse(data) as GraphStore
      console.log(
        `📂 已从文件加载图存储：${store.entities.length} 个实体，${store.relations.length} 条关系`
      )
      return store
    }
    console.log("📂 图存储文件不存在，从空存储开始")
  } catch (error) {
    console.error("❌ 加载图存储文件失败，使用空存储:", error)
  }
  return { entities: [], relations: [], updatedAt: Date.now() }
}

/**
 * 将图存储保存到 JSON 文件
 *
 * @param store - 图存储对象
 * @param filePath - 图存储文件路径
 */
export function saveGraph(store: GraphStore, filePath: string): void {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  store.updatedAt = Date.now()
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), "utf-8")
}

// ==================== 增量合并 ====================

/**
 * 增量合并 LLM 提取的实体和关系到图存储
 *
 * 合并规则：
 * - 实体按 name 去重：已存在 → 追加 observations（去重）；不存在 → 新增
 * - 关系按 (from, to, type) 去重：已存在 → 跳过；不存在 → 新增
 *
 * @param newEntities - LLM 新提取的实体列表
 * @param newRelations - LLM 新提取的关系列表
 * @param store - 图存储对象
 * @param filePath - 图存储文件路径（合并后自动持久化）
 */
export function mergeIntoGraph(
  newEntities: Entity[],
  newRelations: Relation[],
  store: GraphStore,
  filePath: string
): void {
  let entitiesAdded = 0
  let observationsAdded = 0
  let relationsAdded = 0

  // 合并实体
  for (const newEntity of newEntities) {
    const existing = store.entities.find((e) => e.name === newEntity.name)

    if (existing) {
      // 已存在：追加去重的 observations
      for (const obs of newEntity.observations) {
        if (!existing.observations.includes(obs)) {
          existing.observations.push(obs)
          observationsAdded++
        }
      }
    } else {
      // 不存在：新增实体
      store.entities.push({
        name: newEntity.name,
        type: newEntity.type,
        observations: [...newEntity.observations],
      })
      entitiesAdded++
    }
  }

  // 合并关系
  for (const newRel of newRelations) {
    const exists = store.relations.some(
      (r) =>
        r.from === newRel.from &&
        r.to === newRel.to &&
        r.type === newRel.type
    )

    if (!exists) {
      store.relations.push({
        from: newRel.from,
        to: newRel.to,
        type: newRel.type,
      })
      relationsAdded++
    }
  }

  // 持久化
  saveGraph(store, filePath)

  console.log(
    `✅ 图存储已更新：+${entitiesAdded} 实体，+${observationsAdded} 观察，+${relationsAdded} 关系`
  )
}

// ==================== 图检索 ====================

/**
 * 从用户输入中提取关键词，在实体名中做模糊匹配
 *
 * 策略：对用户输入做简单分词（按标点和空格切分，过滤短词），
 * 然后检查每个实体名是否出现在用户输入中，或用户输入的词是否包含实体名
 *
 * @param userInput - 用户输入文本
 * @param store - 图存储对象
 * @returns 匹配到的实体列表
 */
function matchEntities(userInput: string, store: GraphStore): Entity[] {
  const input = userInput.toLowerCase()

  return store.entities.filter((entity) => {
    const name = entity.name.toLowerCase()
    // 实体名出现在用户输入中，或用户输入包含实体名
    return input.includes(name) || name.includes(input)
  })
}

/**
 * 图检索：根据用户输入搜索相关实体、关系和关联实体
 *
 * 检索流程：
 * 1. 关键词匹配 → 找到相关实体
 * 2. 获取匹配实体的 observations
 * 3. 找与匹配实体相连的所有关系
 * 4. 1 跳扩展：获取关系中引用的其他实体的 observations
 * 5. 拼装上下文文本
 *
 * @param userInput - 用户输入文本
 * @param store - 图存储对象
 * @returns 图检索结果（包含格式化上下文文本）
 */
export function searchGraph(
  userInput: string,
  store: GraphStore
): GraphSearchResult {
  // Step 1：关键词匹配实体
  const matchedEntities = matchEntities(userInput, store)

  if (matchedEntities.length === 0) {
    return {
      matchedEntities: [],
      matchedRelations: [],
      relatedEntities: [],
      contextText: "",
    }
  }

  // 收集匹配实体的名称集合
  const matchedNames = new Set(matchedEntities.map((e) => e.name))

  // Step 2：找与匹配实体相关的所有关系（from 或 to 在匹配集合中）
  const matchedRelations = store.relations.filter(
    (r) => matchedNames.has(r.from) || matchedNames.has(r.to)
  )

  // Step 3：1 跳扩展 — 收集关系中引用的其他实体
  const relatedNames = new Set<string>()
  for (const rel of matchedRelations) {
    if (!matchedNames.has(rel.from)) relatedNames.add(rel.from)
    if (!matchedNames.has(rel.to)) relatedNames.add(rel.to)
  }

  const relatedEntities = store.entities.filter((e) =>
    relatedNames.has(e.name)
  )

  // Step 4：拼装上下文文本
  const contextText = formatGraphContext(
    matchedEntities,
    matchedRelations,
    relatedEntities
  )

  return { matchedEntities, matchedRelations, relatedEntities, contextText }
}

/**
 * 将图检索结果格式化为可注入 System Prompt 的上下文文本
 *
 * @param matchedEntities - 匹配到的实体
 * @param matchedRelations - 相关的关系
 * @param relatedEntities - 1 跳扩展的关联实体
 * @returns 格式化的上下文文本
 */
function formatGraphContext(
  matchedEntities: Entity[],
  matchedRelations: Relation[],
  relatedEntities: Entity[]
): string {
  const lines: string[] = []

  // 输出匹配实体的信息
  const allEntities = [
    ...matchedEntities,
    ...relatedEntities.filter(
      (re) => !matchedEntities.some((me) => me.name === re.name)
    ),
  ]

  for (const entity of allEntities) {
    const obs =
      entity.observations.length > 0
        ? `：${entity.observations.join("；")}`
        : ""
    lines.push(`- ${entity.name}（${entity.type}）${obs}`)
  }

  // 输出关系
  if (matchedRelations.length > 0) {
    lines.push("")
    for (const rel of matchedRelations) {
      lines.push(`- ${rel.from} → ${rel.type} → ${rel.to}`)
    }
  }

  return lines.join("\n")
}

// ==================== 图状态查看 ====================

/**
 * 列出图存储概要（实体数 + 关系数）
 *
 * @param store - 图存储对象
 */
export function listGraph(store: GraphStore): void {
  console.log(
    `\n📊 图存储：${store.entities.length} 个实体，${store.relations.length} 条关系`
  )
  console.log("─".repeat(50))

  if (store.entities.length === 0) {
    console.log("📭 图存储为空")
    return
  }

  for (const entity of store.entities) {
    const obs =
      entity.observations.length > 0
        ? ` [${entity.observations.length} 条观察]`
        : ""
    console.log(`  🔵 ${entity.name}（${entity.type}）${obs}`)
  }

  if (store.relations.length > 0) {
    console.log("")
    for (const rel of store.relations) {
      console.log(`  🔗 ${rel.from} → ${rel.type} → ${rel.to}`)
    }
  }

  console.log("─".repeat(50))
}

/**
 * 列出所有实体的详细信息（包含每条观察）
 *
 * @param store - 图存储对象
 */
export function listEntities(store: GraphStore): void {
  if (store.entities.length === 0) {
    console.log("📭 图存储为空")
    return
  }

  console.log(`\n📋 实体详情（共 ${store.entities.length} 个）：`)
  console.log("─".repeat(60))

  for (const entity of store.entities) {
    console.log(`\n  🔵 ${entity.name}（${entity.type}）`)
    if (entity.observations.length > 0) {
      for (const obs of entity.observations) {
        console.log(`     • ${obs}`)
      }
    } else {
      console.log("     （暂无观察）")
    }
  }

  console.log("\n─".repeat(60))
}
