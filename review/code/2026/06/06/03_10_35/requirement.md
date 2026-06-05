# 요구사항(Requirement) 리뷰

## 발견사항

### [INFO] 기능 완전성 — plan 체크리스트 전 항목 구현 확인
- 위치: `plan/in-progress/rag-eval-harness.md` Phase A 전 항목
- 상세: Plan Phase A 의 모든 체크박스(`golden-set.types.ts`, `retrieval-metrics.ts`, `retrieval-metrics.spec.ts`, `lang-detect.ts`, `generate-golden-set.ts`, `eval-retrieval.ts`, `golden.example.json`, `README.md`, `package.json npm scripts`)가 커밋 완료 상태다. Phase B spec (`spec/conventions/rag-evaluation.md`) 도 완료.
- 제안: 추가 조치 불필요.

---

### [INFO] spec fidelity — 골든셋 스키마 필드 명세 일치
- 위치: `spec/conventions/rag-evaluation.md §1` vs `golden-set.types.ts`
- 상세: spec 표의 모든 필드(`id`, `query`, `language`, `knowledgeBaseId`, `goldChunkIds`, `referenceAnswer`, `shouldRetrieve`, `source`, `reviewed`, `difficulty`, `generatedFrom`)가 `GoldenEntry` 인터페이스에 빠짐없이 정의되어 있다. `referenceAnswer` 는 spec 에서 생성 지표·디버깅용이고 검색 지표엔 미사용으로 표기 — 코드에서도 optional(`?`)로 선언되어 일치. `generatedFrom.documentId` 도 optional 로 선언되어 있어 합성/수동 entry 간 차이를 올바르게 반영한다. `GoldenSetMeta.version: 1` 리터럴 타입은 spec 에서 breaking 시 증가라 명시하므로 현재 v1 고정이 일치한다.
- 제안: 없음.

---

### [INFO] spec fidelity — 검색 지표 수식 구현 일치
- 위치: `spec/conventions/rag-evaluation.md §2` vs `retrieval-metrics.ts`
- 상세: spec 의 5개 지표 정의가 모두 구현에 일치한다. Recall@k `|gold ∩ top-k| / |gold|` → `countHits(ranked.slice(0,k), gold) / gold.size`. Precision@k `|gold ∩ top-k| / k`(분모 k 고정) → `countHits / k`. hit-rate@k gold 1개라도 있으면 1 → `countHits > 0 ? 1 : 0`. MRR@k 첫 관련 청크 1-based rank 역수, 없으면 0 → `firstRelevantRank` 반환값 역수. nDCG@k binary relevance, DCG/IDCG 구현 일치. gold 빈 entry → NaN(평가 제외 신호): 5개 함수 모두 `if (gold.size === 0) return NaN` 일치. 결정성 규칙 "score 내림차순, 동점은 chunkId 사전순": `orderRetrieved` 구현 일치.
- 제안: 없음.

---

### [INFO] spec fidelity — evaluateRetrieval 집계 명세 일치
- 위치: `spec/conventions/rag-evaluation.md §2 "집계"` vs `retrieval-metrics.ts evaluateRetrieval`
- 상세: spec 에서 "positive(`shouldRetrieve:true`) entry 의 overall macro + 언어별(KO/EN) macro + negatives 통계(`retrievedAnyRate`)"를 반환하도록 명시 — `EvalReport.overall`, `byLanguage`, `negatives.retrievedAnyRate` 가 모두 구현되어 있다. spec 은 `negatives`를 "정보 지표"라 표기 — 코드 주석 "임계 튜닝 참고용 정보 지표"와 일치.
- 제안: 없음.

---

### [WARNING] spec fidelity — `evaluateRetrieval` positive 분류 기준이 spec 보다 엄격
- 위치: `spec/conventions/rag-evaluation.md §2` vs `retrieval-metrics.ts` line 262
- 상세: spec 은 "positive(`shouldRetrieve:true`) entry 의 overall macro"라고만 기술한다. 코드는 `shouldRetrieve && entry.goldChunkIds.length > 0` 조건으로 positives 를 분류한다 — `goldChunkIds` 가 빈 배열이면서 `shouldRetrieve:true` 인 entry(비정상이지만 입력 가능)는 negatives 로 분류된다. spec 에는 이 케이스가 명시되지 않았다. 이 동작은 `macroAverage` NaN guard 와 함께 봤을 때 논리적으로 합리적이나("gold-empty positive"는 지표 계산이 의미 없으므로 제외), spec 본문에는 해당 예외 조건이 기재되지 않은 상태다. 판단이 모호하므로 SPEC-DRIFT 가 아닌 일반 WARNING 으로 분류.
- 제안: spec `spec/conventions/rag-evaluation.md §2 집계`의 positive 정의에 "(`shouldRetrieve:true` 이면서 `goldChunkIds`가 1개 이상인 entry)"라는 조건을 명시할지 `project-planner`에 확인 권장.

---

### [WARNING] `generate-golden-set.ts` catch 블록에서 `err.message` 직접 노출 — eval-retrieval.ts W8 fix 미적용
- 위치: `codebase/backend/src/scripts/generate-golden-set.ts` line 272-274 및 line 329-332
- 상세: `eval-retrieval.ts` 의 catch 블록(W8 fix 적용)은 `err.constructor.name` 만 출력하는 에러 sanitize 패턴을 사용한다. 반면 `generate-golden-set.ts` 의 청크 LLM 실패 catch 는 `err instanceof Error ? err.message : String(err)` 를 그대로 `console.warn` 에 출력한다. LLM 서비스 에러에는 DB 호스트명, API 키 일부 등이 `err.message` 에 포함될 수 있다. `main().catch` 블록(line 329-332)도 `console.error(err)` 로 전체 Error 객체를 출력해 스택트레이스·메시지 전체가 노출된다. 코드 fix 대상이다(spec 이 아닌 eval-retrieval.ts 와의 일관성 유지).
- 제안: `generate-golden-set.ts` 의 chunk catch 블록을 `const kind = err instanceof Error ? err.constructor.name : 'UnknownError'; console.warn(...)` 패턴으로 교체. `main().catch` 도 `eval-retrieval.ts` 와 동일한 `[kind]: 실행 중단` 패턴으로 통일.

---

### [INFO] 엣지 케이스 — 빈 골든셋 처리
- 위치: `eval-retrieval.ts` line 115
- 상세: `goldenSet.entries?.length` 가 0이면 `process.exit(1)`로 조기 종료한다. spec 은 이 케이스를 명시하지 않으나, 빈 입력에 대해 분모 0 NaN 리포트를 출력하는 것보다 명확하게 실패하는 것이 올바른 동작이다.
- 제안: 없음.

---

### [INFO] 엣지 케이스 — --ks 파싱 후 유효값 없는 경우 침묵 실패 가능
- 위치: `eval-retrieval.ts` line 119-123
- 상세: `--ks 0,-1,abc` 처럼 유효 양정수가 없으면 `ks` 는 빈 배열이 되고, `maxK=10` 폴백이 적용되어 `evaluateRetrieval` 에 빈 배열이 전달된다. 리포트 출력은 되지만 지표 행이 없는 빈 테이블만 출력된다. 사용자가 잘못된 `--ks` 를 입력했을 때 경고 없이 처리된다.
- 제안: `ks.length === 0` 일 때 기본값 `[1,3,5,10]`으로 대체하거나 오류 메시지 출력 권장. INFO 수준으로 즉각 차단 불필요.

---

### [INFO] spec fidelity — CLI 인터페이스 명세 일치 (--threshold 미등재)
- 위치: `spec/conventions/rag-evaluation.md §3` 표 vs `eval-retrieval.ts`
- 상세: spec 표의 CLI 명령은 `--fail-metric`, `--fail-k`, `--fail-under` 까지 명시하나 `--threshold` 플래그는 포함되지 않는다. 코드에서 `--threshold` 는 검색 score 하한 필터로 구현되어 있으며 `eval/README.md` 에는 설명되어 있다. spec 과 README 간 정보 분산.

- **[SPEC-DRIFT]** `--threshold` 는 코드에서 합리적·의도적으로 구현된 기능이며 README 에 문서화되어 있다. 코드를 되돌리는 것이 오답이고 spec 갱신이 맞다.
- 제안: 코드 유지 + `spec/conventions/rag-evaluation.md §3` 표의 지표 실행 행에 `[--threshold 0]` 옵션을 추가하도록 `project-planner` 위임.

---

### [INFO] 비즈니스 로직 — silver/gold dedup 및 reviewed 보존
- 위치: `generate-golden-set.ts` line 295-304
- 상세: spec D-E6 "합성 entry = silver, 재실행 시 기존 reviewed:true entry 는 보존" 요구사항이 코드에서 `prev?.reviewed ? continue` 로 정확히 구현되어 있다. silver(`reviewed:false`) entry 는 재생성 시 최신 LLM 산출로 갱신된다.
- 제안: 없음.

---

### [INFO] TODO/FIXME 없음
- 위치: 전체 변경 파일
- 상세: `generate-golden-set.ts`, `eval-retrieval.ts`, `retrieval-metrics.ts`, `lang-detect.ts`, `eval-cli.module.ts`, `golden-set.types.ts`, `cli-utils.ts` 전체에 TODO/FIXME/HACK/XXX 주석 없음.
- 제안: 없음.

---

### [INFO] 반환값 — 모든 코드 경로 적절
- 위치: `retrieval-metrics.ts`, `eval-retrieval.ts`, `generate-golden-set.ts`
- 상세: `retrieval-metrics.ts` 의 모든 export 함수는 gold 빈 경우 NaN, 정상 케이스는 number 를 반환하며 누락된 경로 없다. `evaluateRetrieval` 은 항상 `EvalReport` 를 반환한다. `eval-retrieval.ts` 는 오류 상황마다 `process.exit` 을 명시적으로 호출한다. `generate-golden-set.ts` 의 `main()` 함수는 `--dry-run` 시 early return, 정상 시 파일 기록 후 종료한다.
- 제안: 없음.

---

### [INFO] 데이터 유효성 — zod 런타임 스키마 검증 확인
- 위치: `eval-retrieval.ts` line 44-60, 103-112
- 상세: `GoldenSetSchema` (zod) safeParse 가 적용되어 있다. `id`, `query`, `language`, `knowledgeBaseId`(UUID regex), `goldChunkIds`, `shouldRetrieve`, `source`, `reviewed`, `difficulty` 모두 검증된다. 검증 실패 시 최대 5개 오류를 출력하고 `process.exit(1)`.
- 제안: 없음.

---

## 요약

이번 변경은 `spec/conventions/rag-evaluation.md`(신규)에 정의된 RAG 평가 하베스 P0 Phase 0+1 요구사항을 전항목 구현했다. 골든셋 스키마 필드, 5개 검색 지표 수식, 결정성 규칙(score 내림차순 + chunkId tie-break, NaN guard), silver/gold dedup 로직, EvalCliModule 부트스트랩 격리, CLI 인터페이스(npm scripts, `--fail-under` 게이트) 모두 spec 과 line-level 로 일치한다. 런타임 스키마 검증(zod), 경로 탈출 방지, UUID 사전 검증 등 이전 리뷰 fix(92ebe8f2)도 반영되어 있다. 요구사항 미충족 항목은 없으나 두 가지 WARNING 이 있다: (1) `generate-golden-set.ts` 의 catch 블록에서 `err.message` 를 직접 출력해 `eval-retrieval.ts` 의 W8 에러 sanitize fix 와 불일치하며 코드 수정이 필요하다. (2) `evaluateRetrieval` 의 positive 분류 기준(`shouldRetrieve && goldChunkIds.length > 0`)이 spec 에 명시되지 않아 spec 갱신 또는 의도 확인이 권장된다. `--threshold` 플래그는 코드에 구현되어 있으나 spec 표에 미등재된 SPEC-DRIFT(INFO).

## 위험도

LOW
