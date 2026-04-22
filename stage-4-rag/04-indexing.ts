import * as fs from 'fs';
import * as path from 'path';
import { openai } from "shared-utils";
import { embedMany } from 'ai';

const model = openai();

// 分块函数（与 03-chunking.ts 相同）
function chunkText(text: string, maxSize: number = 800, overlap: number = 150): string[] {
  const paragraphs = text.split('\n\n');
  const chunks = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > maxSize && currentChunk) {
      chunks.push(currentChunk.trim());
      const overlapStart = Math.max(0, currentChunk.length - overlap);
      currentChunk = currentChunk.slice(overlapStart) + '\n\n' + paragraph + '\n\n';
    } else {
      currentChunk += paragraph + '\n\n';
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

interface DocumentChunk {
  id: string;
  content: string;
  embedding: number[];
  sourceFile: string;
  chunkIndex: number;
}

async function embedText(chunks: string[], allChunks: DocumentChunk[], file: string) {
  // 批量生成 Embedding
  const { embeddings } = await embedMany({
    model: model.embedding("text-embedding-v3"),
    values: chunks,
  });

  // 创建文档块对象
  chunks.forEach((chunk, index) => {
    allChunks.push({
      id: `${file}_${index}`,
      content: chunk,
      embedding: embeddings[index],
      sourceFile: file,
      chunkIndex: index
    });
  });
}

async function main() {
  const docsDir = path.join(__dirname, 'docs');
  const files = fs.readdirSync(docsDir).filter(file => file.endsWith('.md'));

  console.log('🔍 开始构建向量索引...');

  const allChunks: DocumentChunk[] = [];

  for (const file of files) {
    console.log(`\n📄 处理文件: ${file}`);

    const filePath = path.join(docsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const chunks = chunkText(content);

    console.log(`   生成 Embedding (${chunks.length} 个块)...`);

    // 批量生成 Embedding
    // const { embeddings } = await embedMany({
    //   model: openai.embedding("text-embedding-v3"),
    //   values: chunks,
    // });

    // // 创建文档块对象
    // chunks.forEach((chunk, index) => {
    //   allChunks.push({
    //     id: `${file}_${index}`,
    //     content: chunk,
    //     embedding: embeddings[index],
    //     sourceFile: file,
    //     chunkIndex: index
    //   });
    // });

    if (chunks.length > 10) {
      // 分批次处理
      for (let i = 0; i < chunks.length; i += 10) {
        const batch = chunks.slice(i, i + 10).filter(chunk => chunk);
        await embedText(batch, allChunks, file);
      }
    } else {
      await embedText(chunks, allChunks, file);
    }

    console.log(`   ✅ 完成: ${file}`);
  }

  // 保存到 JSON 文件
  const indexPath = path.join(__dirname, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify(allChunks, null, 2));

  console.log(`\n💾 索引已保存到: ${indexPath}`);
  console.log(`📊 总共处理: ${allChunks.length} 个文档块`);
  console.log('✅ 向量索引构建完成！');
}

main();
