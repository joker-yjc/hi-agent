// 分块函数（与 03-chunking.ts 相同）
export function chunkText(text: string, maxSize: number = 800, overlap: number = 150): string[] {
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