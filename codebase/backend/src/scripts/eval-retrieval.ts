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
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import pLimit from 'p-limit';
import { EvalCliModule } from '../modules/knowledge-base/eval/eval-cli.module';
import { RagSearchService } from '../modules/knowledge-base/search/rag-search.service';
import {
  AggregateMetrics,
  EvalReport,
  evaluateRetrieval,
  RetrievedChunk,
} from '../modules/knowledge-base/eval/retrieval-metrics';
import { GoldenSet } from '../modules/knowledge-base/eval/golden-set.types';

const SEARCH_CONCURRENCY = 4;
const DEFAULT_GOLDEN = 'eval/golden.json';

function parseCliFlag(name: string): string | undefined {
  const eqIdx = process.argv.findIndex((a) => a.startsWith(`${name}=`));
  if (eqIdx >= 0) return process.argv[eqIdx].split('=', 2)[1];
  const flagIdx = process.argv.indexOf(name);
  if (flagIdx >= 0 && flagIdx < process.argv.length - 1) {
    return process.argv[flagIdx + 1];
  }
  return undefined;
}

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
  const goldenSet = JSON.parse(readFileSync(goldenPath, 'utf8')) as GoldenSet;
  if (!goldenSet.entries?.length) {
    console.error('골든셋에 entry 가 없습니다.');
    process.exit(1);
  }
  const ks = (parseCliFlag('--ks') ?? '1,3,5,10')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const maxK = ks.length ? Math.max(...ks) : 10;
  const topK = Number(parseCliFlag('--top-k') ?? maxK);
  const threshold = Number(parseCliFlag('--threshold') ?? 0);
  const outPath = parseCliFlag('--out');

  const app = await NestFactory.createApplicationContext(EvalCliModule, {
    logger: ['error', 'warn'],
  });
  try {
    const ragSearch = app.get(RagSearchService);
    const dataSource = app.get(DataSource);

    // KB → workspace 매핑(검색 호출에 workspaceId 필요).
    const wsCache = new Map<string, string | null>();
    const resolveWorkspace = async (kbId: string): Promise<string | null> => {
      if (wsCache.has(kbId)) return wsCache.get(kbId) ?? null;
      const rows: Array<{ workspace_id: string }> = await dataSource.query(
        `SELECT workspace_id FROM knowledge_base WHERE id = $1`,
        [kbId],
      );
      const ws = rows[0]?.workspace_id ?? null;
      wsCache.set(kbId, ws);
      return ws;
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
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(`entry ${entry.id} 검색 실패: ${msg}`);
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
      `골든셋: ${goldenPath} | topK=${topK} threshold=${threshold} | ⚠ silver 절대값 신뢰 금지, 상대비교 전용`,
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
      const failK = Number(parseCliFlag('--fail-k') ?? report.maxK);
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
          `\n❌ 게이트 실패: ${failMetric}@${failK}=${value.toFixed(3)} < ${threshNum}`,
        );
        process.exit(4);
      }
      console.log(
        `\n✅ 게이트 통과: ${failMetric}@${failK}=${value.toFixed(3)} ≥ ${threshNum}`,
      );
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
