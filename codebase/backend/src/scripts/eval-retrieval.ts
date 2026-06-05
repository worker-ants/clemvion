/**
 * RAG 검색 지표 러너 (P0 Phase 1).
 *
 * SoT: spec/conventions/rag-evaluation.md.
 *
 * 골든셋(golden.json)을 `RagSearchService.searchWithMeta()` 로 돌려 Recall@k /
 * Precision@k / MRR / nDCG@k / hit-rate@k 를 산출한다. 결정적 지표 계산은
 * retrieval-metrics.ts(순수 TS) 가 담당. `--fail-under` 로 CI 게이트화 가능.
 *
 * 해석: 자동 합성 silver 골든셋의 절대값은 신뢰하지 말고 변경 전후 **상대 회귀**
 * (off vs cross_encoder, PR 전후) 비교로만 사용한다.
 *
 * 사용:
 *   npx ts-node src/scripts/eval-retrieval.ts [--golden eval/golden.json] \
 *     [--ks 1,3,5,10] [--top-k 10] [--threshold 0] [--out report.json] \
 *     [--fail-metric hitRate|recall|ndcg|precision|mrr] [--fail-k 5] [--fail-under 0.6]
 *
 * 참고: --fail-metric mrr 시 --fail-k 는 무시되고 maxK(--ks 최댓값) 기반 MRR 이
 * 사용된다. mrr 은 단일 스칼라이며 k 파라미터를 갖지 않기 때문이다.
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import pLimit from 'p-limit';
import { z } from 'zod';
import { EvalCliModule } from '../modules/knowledge-base/eval/eval-cli.module';
import { RagSearchService } from '../modules/knowledge-base/search/rag-search.service';
import {
  AggregateMetrics,
  EvalReport,
  evaluateRetrieval,
  RetrievedChunk,
} from '../modules/knowledge-base/eval/retrieval-metrics';
import { parseCliFlag } from './cli-utils';

const SEARCH_CONCURRENCY = 4;
const DEFAULT_GOLDEN = 'eval/golden.json';

/** UUID v4 형식 정규식 — kbId 사전 검증에 사용. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 골든셋 JSON 런타임 스키마(zod). 필수 구조만 검증하며, 알 수 없는 필드는 통과. */
const GoldenEntrySchema = z.object({
  id: z.string().min(1),
  query: z.string().min(1),
  language: z.enum(['ko', 'en']),
  knowledgeBaseId: z.string().regex(UUID_RE, 'knowledgeBaseId must be a UUID'),
  goldChunkIds: z.array(z.string()),
  shouldRetrieve: z.boolean(),
  source: z.enum(['synthetic', 'mined', 'manual']),
  reviewed: z.boolean(),
  difficulty: z.enum(['single', 'multi', 'paraphrase']),
});

const GoldenSetSchema = z.object({
  meta: z.object({ version: z.literal(1) }),
  entries: z.array(GoldenEntrySchema),
});

function fmt(v: number): string {
  return Number.isNaN(v) ? '  n/a' : v.toFixed(3);
}

function printAggregate(
  title: string,
  agg: AggregateMetrics,
  ks: number[],
): void {
  console.log(`\n## ${title} (n=${agg.count})`);
  console.log(`  MRR@max: ${fmt(agg.mrr)}`);
  const header = ks.map((k) => `@${k}`.padStart(7)).join('');
  console.log(`  metric ${header}`);
  const row = (name: string, m: Record<number, number>) =>
    console.log(
      `  ${name.padEnd(6)} ${ks.map((k) => fmt(m[k]).padStart(7)).join('')}`,
    );
  row('recall', agg.recall);
  row('prec', agg.precision);
  row('hit', agg.hitRate);
  row('ndcg', agg.ndcg);
}

async function main(): Promise<void> {
  const goldenPath = resolve(
    process.cwd(),
    parseCliFlag('--golden') ?? DEFAULT_GOLDEN,
  );
  if (!existsSync(goldenPath)) {
    console.error(`골든셋 파일 없음: ${goldenPath}`);
    process.exit(1);
  }

  // W6: zod safeParse 로 런타임 스키마 검증
  let rawParsed: unknown;
  try {
    rawParsed = JSON.parse(readFileSync(goldenPath, 'utf8'));
  } catch {
    console.error(`골든셋 파일 파싱 실패: ${goldenPath}`);
    process.exit(1);
  }
  const schemaResult = GoldenSetSchema.safeParse(rawParsed);
  if (!schemaResult.success) {
    console.error(
      `골든셋 스키마 검증 실패:\n${schemaResult.error.issues
        .slice(0, 5)
        .map((i) => `  ${i.path.join('.')}: ${i.message}`)
        .join('\n')}`,
    );
    process.exit(1);
  }
  const goldenSet = schemaResult.data;

  if (!goldenSet.entries?.length) {
    console.error('골든셋에 entry 가 없습니다.');
    process.exit(1);
  }
  const ksParsed = (parseCliFlag('--ks') ?? '1,3,5,10')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  // I11: 유효 양정수 없으면 기본값으로 대체 — 빈 테이블 출력 방지
  const ks = ksParsed.length > 0 ? ksParsed : [1, 3, 5, 10];
  if (ksParsed.length === 0 && parseCliFlag('--ks') !== undefined) {
    console.warn(
      '경고: --ks 에 유효한 양정수가 없어 기본값 [1,3,5,10] 을 사용합니다.',
    );
  }
  const maxK = Math.max(...ks);
  const topK = Number(parseCliFlag('--top-k') ?? maxK);
  const threshold = Number(parseCliFlag('--threshold') ?? 0);
  const outPath = parseCliFlag('--out');

  // W5: --out 경로 탐색 방지 — CWD 하위로만 허용
  if (outPath) {
    const outAbs = resolve(process.cwd(), outPath);
    if (!outAbs.startsWith(resolve(process.cwd()))) {
      console.error(`--out 경로가 현재 디렉터리 밖을 가리킵니다: ${outAbs}`);
      process.exit(1);
    }
  }

  const app = await NestFactory.createApplicationContext(EvalCliModule, {
    logger: ['error', 'warn'],
  });
  try {
    const ragSearch = app.get(RagSearchService);
    const dataSource = app.get(DataSource);

    // KB → workspace 매핑(검색 호출에 workspaceId 필요).
    // W11: 동일 kbId 중복 쿼리 방지 — Promise 를 캐시 값으로 저장.
    const wsCache = new Map<string, Promise<string | null>>();
    const resolveWorkspace = (kbId: string): Promise<string | null> => {
      // W7: kbId UUID 형식 사전 검증
      if (!UUID_RE.test(kbId)) {
        return Promise.resolve(null);
      }
      const cached = wsCache.get(kbId);
      if (cached) return cached;
      const promise = dataSource
        .query<Array<{ workspace_id: string }>>(
          `SELECT workspace_id FROM knowledge_base WHERE id = $1`,
          [kbId],
        )
        .then((rows) => rows[0]?.workspace_id ?? null)
        .catch(() => null);
      wsCache.set(kbId, promise);
      return promise;
    };

    const limit = pLimit(SEARCH_CONCURRENCY);
    const retrievedByEntryId: Record<string, RetrievedChunk[]> = {};
    let searched = 0;
    let skipped = 0;

    await Promise.all(
      goldenSet.entries.map((entry) =>
        limit(async () => {
          const workspaceId = await resolveWorkspace(entry.knowledgeBaseId);
          if (!workspaceId) {
            skipped += 1;
            retrievedByEntryId[entry.id] = [];
            return;
          }
          try {
            const { results } = await ragSearch.searchWithMeta(
              entry.query,
              [entry.knowledgeBaseId],
              workspaceId,
              { topK, threshold },
            );
            retrievedByEntryId[entry.id] = results.map((r) => ({
              chunkId: r.chunkId,
              score: r.score,
            }));
          } catch (err) {
            // W8: 에러 유형만 분류 출력 — DB 호스트명·쿼리·API 키 접두어 노출 방지.
            const isKnown = err instanceof Error;
            const kind = isKnown ? err.constructor.name : 'UnknownError';
            console.warn(`entry ${entry.id} 검색 실패: [${kind}]`);
            retrievedByEntryId[entry.id] = [];
          } finally {
            searched += 1;
            if (searched % 20 === 0 || searched === goldenSet.entries.length) {
              console.log(`  검색 ${searched}/${goldenSet.entries.length}`);
            }
          }
        }),
      ),
    );

    const report: EvalReport = evaluateRetrieval(
      goldenSet,
      retrievedByEntryId,
      ks,
    );

    console.log(
      `\n# RAG 검색 지표 — entry ${report.totalEntries} (positive ${report.overall.count}, negative ${report.negatives.count}, ws-skip ${skipped})`,
    );
    console.log(
      `골든셋: ${goldenPath} | topK=${topK} threshold=${threshold} | [주의] silver 절대값 신뢰 금지, 상대비교 전용`,
    );
    printAggregate('Overall', report.overall, report.ks);
    for (const lang of Object.keys(report.byLanguage) as Array<'ko' | 'en'>) {
      const agg = report.byLanguage[lang];
      if (agg) printAggregate(`Language=${lang}`, agg, report.ks);
    }
    if (report.negatives.count > 0) {
      console.log(
        `\n## Negatives (n=${report.negatives.count}) retrievedAnyRate=${fmt(report.negatives.retrievedAnyRate)} (정보지표)`,
      );
    }

    if (outPath) {
      const outAbs = resolve(process.cwd(), outPath);
      writeFileSync(outAbs, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
      console.log(`\n리포트 기록: ${outAbs}`);
    }

    // CI 게이트
    const failMetric = parseCliFlag('--fail-metric');
    const failUnder = parseCliFlag('--fail-under');
    if (failMetric && failUnder !== undefined) {
      const failKRaw = parseCliFlag('--fail-k');
      const failK = Number(failKRaw ?? report.maxK);
      // W10: mrr 은 단일 스칼라(maxK 기반) — --fail-k 지정 시 경고.
      if (failMetric === 'mrr' && failKRaw !== undefined) {
        console.warn(
          `경고: --fail-metric mrr 시 --fail-k(${failKRaw})는 무시됩니다. ` +
            `MRR 은 maxK(${report.maxK}) 기반 단일 스칼라입니다.`,
        );
      }
      const threshNum = Number(failUnder);
      const metricMap: Record<string, Record<number, number> | number> = {
        recall: report.overall.recall,
        precision: report.overall.precision,
        hitRate: report.overall.hitRate,
        ndcg: report.overall.ndcg,
        mrr: report.overall.mrr,
      };
      const picked = metricMap[failMetric];
      const value = typeof picked === 'number' ? picked : picked?.[failK];
      if (value === undefined || Number.isNaN(value)) {
        console.error(
          `\n게이트 평가 불가: metric=${failMetric} k=${failK} 값 없음`,
        );
        process.exit(3);
      }
      if (value < threshNum) {
        console.error(
          `\n[FAIL] 게이트 실패: ${failMetric}@${failK}=${value.toFixed(3)} < ${threshNum}`,
        );
        process.exit(4);
      }
      console.log(
        `\n[PASS] 게이트 통과: ${failMetric}@${failK}=${value.toFixed(3)} ≥ ${threshNum}`,
      );
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  const kind = err instanceof Error ? err.constructor.name : 'UnknownError';
  console.error(`치명 오류 [${kind}]: 실행 중단`);
  process.exit(1);
});
