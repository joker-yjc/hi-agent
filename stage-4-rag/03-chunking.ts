import * as fs from 'fs';
import * as path from 'path';

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

async function main() {
  const docsDir = path.join(__dirname, 'docs');
  const files = fs.readdirSync(docsDir).filter(file => file.endsWith('.md'));

  console.log('🔍 开始构建向量索引...');

  for (const file of files) {
    console.log(`\n📄 处理文件: ${file}`);

    const filePath = path.join(docsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const chunks = chunkText(content);
    console.log(`   ✅ 完成文本分块: ${chunks}`);
  }
}

main();
