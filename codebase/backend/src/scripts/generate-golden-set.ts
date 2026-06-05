/**
 * RAG 평가 골든셋 자동 합성 스크립트 (P0 Phase 0, ① 자동 합성).
 *
 * SoT: spec/conventions/rag-evaluation.md.
 *
 * KB 의 `document_chunk` 를 샘플링해, 각 청크로 답 가능한 질문을 LLM 으로 역방향
 * 생성한다 → 생성 원천 청크가 그 질문의 gold 관련 chunk_id 가 된다(라벨 공짜).
 * 산출 entry 는 `source: 'synthetic'`, `reviewed: false` (silver). 사용자는
 * 스팟검수 후 `reviewed: true` 로 승격(gold)한다 — eval/README.md 참조.
 *
 * LLM 호출은 제품 자체 `LlmService.chat()` (graph-extraction 과 동일 패턴) 으로,
 * KnowledgeBaseModule 의 큐·프로세서를 제외한 EvalCliModule DI 로 부팅한다.
 *
 * 사용:
 *   npx ts-node src/scripts/generate-golden-set.ts \
 *     --workspace-id <uuid> --kb-id <uuid> [--sample 30] [--questions-per-chunk 1] \
 *     [--lang ko|en|auto] [--llm-config-id <uuid>] [--out eval/golden.json] \
 *     [--order random|id] [--min-chars 80] [--dry-run]
 */
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import pLimit from 'p-limit';
import { EvalCliModule } from '../modules/knowledge-base/eval/eval-cli.module';
import { LlmService } from '../modules/llm/llm.service';
import { detectLanguage } from '../modules/knowledge-base/eval/lang-detect';
import {
  GoldenEntry,
  GoldenLanguage,
  GoldenSet,
} from '../modules/knowledge-base/eval/golden-set.types';
import { parseCliFlag } from './cli-utils';

const CHUNK_LLM_CONCURRENCY = 4;
const GEN_TIMEOUT_MS = 60_000;
const MAX_CHUNK_CHARS = 4000;
const DEFAULT_OUT = 'eval/golden.json';

interface ChunkRow {
  id: string;
  document_id: string;
  content: string;
}

export interface GeneratedQuestion {
  question: string;
  answer: string;
}

const GEN_SYSTEM_PROMPT = `You build an evaluation test set for a RAG retrieval system.
Given ONE passage, produce natural questions that a real user would ask AND that THIS
passage alone directly and sufficiently answers.

Rules:
- Each question must be answerable from this passage only — no outside knowledge, no
  other documents. If the passage is too thin to answer anything specific, return an
  empty "questions" array.
- Keep questions concrete and self-contained (a retriever sees the question without the
  passage). Avoid "this document"/"위 내용" style references.
- Preserve exact identifiers (SKU, codes, policy numbers, proper nouns) verbatim.
- Provide a concise reference answer grounded ONLY in the passage.
- Write the questions and answers in {LANG}.

Output strict JSON: {"questions":[{"question":"...","answer":"..."}]}`;

const GEN_JSON_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          answer: { type: 'string' },
        },
        required: ['question', 'answer'],
      },
    },
  },
  required: ['questions'],
} as const;

// content-address identifier, not security hash
export function stableEntryId(
  kbId: string,
  chunkId: string,
  question: string,
): string {
  const normalized = question.trim().replace(/\s+/g, ' ').toLowerCase();
  return createHash('sha1')
    .update(JSON.stringify([kbId, chunkId, normalized]))
    .digest('hex')
    .slice(0, 16);
}

function langLabel(lang: GoldenLanguage): string {
  return lang === 'ko' ? 'Korean (한국어)' : 'English';
}

export function parseQuestions(raw: string | null): GeneratedQuestion[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray((parsed as { questions?: unknown }).questions)
  ) {
    return [];
  }
  const out: GeneratedQuestion[] = [];
  for (const q of (parsed as { questions: unknown[] }).questions) {
    if (
      q &&
      typeof q === 'object' &&
      typeof (q as GeneratedQuestion).question === 'string' &&
      (q as GeneratedQuestion).question.trim()
    ) {
      out.push({
        question: (q as GeneratedQuestion).question.trim(),
        answer:
          typeof (q as GeneratedQuestion).answer === 'string'
            ? (q as GeneratedQuestion).answer.trim()
            : '',
      });
    }
  }
  return out;
}

export function loadExisting(outPath: string): GoldenSet {
  if (!existsSync(outPath)) {
    return { meta: { version: 1 }, entries: [] };
  }
  try {
    const parsed = JSON.parse(readFileSync(outPath, 'utf8')) as GoldenSet;
    if (!parsed.entries || !Array.isArray(parsed.entries)) {
      return { meta: { version: 1 }, entries: [] };
    }
    return {
      meta: { ...(parsed.meta ?? {}), version: 1 },
      entries: parsed.entries,
    };
  } catch {
    return { meta: { version: 1 }, entries: [] };
  }
}

async function main(): Promise<void> {
  const workspaceId = parseCliFlag('--workspace-id');
  const kbId = parseCliFlag('--kb-id');
  if (!workspaceId || !kbId) {
    console.error(
      '필수 인자 누락: --workspace-id <uuid> --kb-id <uuid>\n' +
        '예) npx ts-node src/scripts/generate-golden-set.ts --workspace-id ... --kb-id ... --sample 30',
    );
    process.exit(1);
  }
  const sample = Number(parseCliFlag('--sample') ?? 30);
  const questionsPerChunk = Number(parseCliFlag('--questions-per-chunk') ?? 1);
  const langArg = (parseCliFlag('--lang') ?? 'auto') as 'ko' | 'en' | 'auto';
  const llmConfigId = parseCliFlag('--llm-config-id');
  const order = (parseCliFlag('--order') ?? 'random') as 'random' | 'id';
  const minChars = Number(parseCliFlag('--min-chars') ?? 80);
  const dryRun = process.argv.includes('--dry-run');
  const outPath = resolve(process.cwd(), parseCliFlag('--out') ?? DEFAULT_OUT);

  // W2: --out 경로 경계 가드 — CWD 하위로만 허용
  if (
    !outPath.startsWith(resolve(process.cwd()) + '/') &&
    outPath !== resolve(process.cwd())
  ) {
    console.error(`--out 경로가 현재 디렉터리 밖을 가리킵니다: ${outPath}`);
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(EvalCliModule, {
    logger: ['error', 'warn'],
  });
  try {
    const llmService = app.get(LlmService);
    const dataSource = app.get(DataSource);
    const llmConfig = await llmService.resolveConfig(
      llmConfigId ?? undefined,
      workspaceId,
    );

    // W7: ORDER BY 화이트리스트 const 맵 — 문자열 인터폴레이션 패턴 제거
    const ALLOWED_ORDERS = { random: 'random()', id: 'id' } as const;
    const orderBy = ALLOWED_ORDERS[order] ?? ALLOWED_ORDERS.random;
    const chunks: ChunkRow[] = await dataSource.query(
      `SELECT id, document_id, content
         FROM document_chunk
        WHERE knowledge_base_id = $1
          AND char_length(content) >= $2
        ORDER BY ${orderBy}
        LIMIT $3`,
      [kbId, minChars, sample],
    );

    if (chunks.length === 0) {
      console.error(
        `대상 청크 0건 (kb=${kbId}, min-chars=${minChars}). 임베딩 완료된 KB 인지 확인하세요.`,
      );
      process.exit(2);
    }
    console.log(
      `청크 ${chunks.length}건 샘플 (order=${orderBy}, q/chunk=${questionsPerChunk}, lang=${langArg}, model=${llmConfig.defaultModel})`,
    );

    const limit = pLimit(CHUNK_LLM_CONCURRENCY);
    const generated: GoldenEntry[] = [];
    let done = 0;
    let failed = 0;

    await Promise.all(
      chunks.map((chunk) =>
        limit(async () => {
          const lang: GoldenLanguage =
            langArg === 'auto' ? detectLanguage(chunk.content) : langArg;
          const content =
            chunk.content.length > MAX_CHUNK_CHARS
              ? chunk.content.slice(0, MAX_CHUNK_CHARS)
              : chunk.content;
          try {
            const result = await llmService.chat(
              llmConfig,
              {
                model: llmConfig.defaultModel,
                messages: [
                  {
                    role: 'system',
                    content: GEN_SYSTEM_PROMPT.replace(
                      '{LANG}',
                      langLabel(lang),
                    ),
                  },
                  {
                    role: 'user',
                    content: `Generate up to ${questionsPerChunk} question(s).\n\nPassage:\n${content}`,
                  },
                ],
                responseFormat: 'json',
                jsonSchema: GEN_JSON_SCHEMA as unknown as Record<
                  string,
                  unknown
                >,
                temperature: 0,
              },
              undefined,
              { timeoutMs: GEN_TIMEOUT_MS, disableInnerRetry: true },
            );
            const questions = parseQuestions(result.content).slice(
              0,
              Math.max(1, questionsPerChunk),
            );
            for (const q of questions) {
              generated.push({
                id: stableEntryId(kbId, chunk.id, q.question),
                query: q.question,
                language: lang,
                knowledgeBaseId: kbId,
                goldChunkIds: [chunk.id],
                referenceAnswer: q.answer || undefined,
                shouldRetrieve: true,
                source: 'synthetic',
                reviewed: false,
                difficulty: 'single',
                generatedFrom: {
                  chunkId: chunk.id,
                  documentId: chunk.document_id,
                  model: result.model || llmConfig.defaultModel,
                },
              });
            }
          } catch (err) {
            failed += 1;
            const kind =
              err instanceof Error ? err.constructor.name : 'UnknownError';
            console.warn(`청크 ${chunk.id} 생성 실패: [${kind}]`);
          } finally {
            done += 1;
            if (done % 10 === 0 || done === chunks.length) {
              console.log(`  진행 ${done}/${chunks.length}`);
            }
          }
        }),
      ),
    );

    console.log(
      `생성 ${generated.length} entry (실패 청크 ${failed}). 머지 대상: ${outPath}`,
    );

    if (dryRun) {
      console.log('--dry-run: 파일 미기록. 샘플 3건:');
      console.log(JSON.stringify(generated.slice(0, 3), null, 2));
      return;
    }

    const existing = loadExisting(outPath);
    const byId = new Map<string, GoldenEntry>();
    for (const e of existing.entries) byId.set(e.id, e);
    let added = 0;
    for (const e of generated) {
      if (!byId.has(e.id)) added += 1;
      // 기존 reviewed entry 는 덮어쓰지 않음(검수 결과 보존).
      const prev = byId.get(e.id);
      if (prev?.reviewed) continue;
      byId.set(e.id, e);
    }
    const merged: GoldenSet = {
      meta: {
        version: 1,
        generatedAt: new Date().toISOString(),
        description: existing.meta.description,
      },
      entries: Array.from(byId.values()).sort((a, b) =>
        a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
      ),
    };
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
    console.log(
      `기록 완료: 신규 ${added}, 전체 ${merged.entries.length} entry → ${outPath}`,
    );
    console.log(
      '다음: eval/README.md 의 스팟검수 절차로 reviewed:true 승격 후 eval-retrieval 실행.',
    );
  } finally {
    await app.close();
  }
}

// 직접 실행 시만 main() 호출 — import 시(단위 테스트 등) 실행 안 됨
if (require.main === module) {
  main().catch((err) => {
    const kind = err instanceof Error ? err.constructor.name : 'UnknownError';
    console.error(`치명 오류 [${kind}]: 실행 중단`);
    process.exit(1);
  });
}
