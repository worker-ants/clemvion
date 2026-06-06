/**
 * RAG 평가 골든셋 스키마.
 *
 * SoT: spec/conventions/rag-evaluation.md.
 *
 * 각 entry 는 (query → gold 관련 chunk → reference answer) 트리플이다. 자동 합성
 * (generate-golden-set.ts) 은 청크 c 에서 질문 q 를 역방향 생성하므로 c 가 q 의
 * gold 관련 chunk_id 가 된다(라벨이 공짜). 합성 entry 는 `source: 'synthetic'` +
 * `reviewed: false` (silver). SME 스팟검수 후 `reviewed: true` 로 승격(gold).
 */

export type GoldenLanguage = 'ko' | 'en';

/** 합성(자동) / 실로그 마이닝 / 수동 작성 */
export type GoldenSource = 'synthetic' | 'mined' | 'manual';

/**
 * single  — 단일 청크로 답 가능(현 자동 합성이 지원하는 유일 난이도).
 * multi   — 여러 청크 결합 필요(multi-hop). 현 generator 범위 밖, 수동/후속.
 * paraphrase — 동일 청크에 대한 표현 변형(현실적 사용자 어휘).
 */
export type GoldenDifficulty = 'single' | 'multi' | 'paraphrase';

export interface GoldenEntry {
  /** kb+chunk+query 해시 기반 안정 id (재생성 시 dedup 키) */
  id: string;
  query: string;
  language: GoldenLanguage;
  knowledgeBaseId: string;
  /**
   * 관련(정답) 청크 id 목록. `shouldRetrieve: true` 면 1개 이상.
   * 자동 합성은 항상 정확히 1개(생성 원천 청크).
   */
  goldChunkIds: string[];
  /** 청크에 근거한 간결 정답(생성 지표·디버깅용. 검색 지표엔 미사용). */
  referenceAnswer?: string;
  /**
   * false = 부정 케이스(KB 에 답이 없어야 하는 질문). 검색 지표 macro 평균에서
   * 제외되고 negatives 통계로만 집계된다(gold negative 라벨 부재 → 정오 판정 보류).
   */
  shouldRetrieve: boolean;
  source: GoldenSource;
  /** SME 스팟검수 통과 여부(silver=false → gold=true). */
  reviewed: boolean;
  difficulty: GoldenDifficulty;
  /** 자동 합성 추적 메타(수동/마이닝 entry 는 생략). */
  generatedFrom?: {
    chunkId: string;
    documentId?: string;
    model: string;
  };
}

export interface GoldenSetMeta {
  /** 스키마 버전 — 호환성 breaking 시 증가. */
  version: 1;
  /** ISO8601. 생성/머지 시각(스크립트가 stamp). */
  generatedAt?: string;
  description?: string;
}

export interface GoldenSet {
  meta: GoldenSetMeta;
  entries: GoldenEntry[];
}
