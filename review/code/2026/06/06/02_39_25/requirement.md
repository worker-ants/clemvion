# 요구사항(Requirement) Review — RAG 평가 하베스 P0 Phase 0+1

검토 대상: codebase/backend eval harness (13개 파일 신규/변경)
검토 일시: 2026-06-06
참조 spec: `spec/conventions/rag-evaluation.md`

---

## 발견사항

### [INFO] generate-golden-set.ts 에서 plan 이 명시한 부트스트랩 방식이 변경됨 — 의도적 개선
- 위치: `plan/in-progress/rag-eval-harness.md §2 Phase A`
  > "`NestFactory.createApplicationContext(AppModule)` 부트스트랩"
- 상세: plan 은 `AppModule` 부트스트랩을 명시했지만, 실제 구현은 `EvalCliModule`(경량 전용 모듈)로 부팅한다. `spec/conventions/rag-evaluation.md §3`("부트스트랩 격리" 섹션)은 이 변경을 정식 명세로 반영하고 있으므로 spec 이 권위이며 코드가 정확하다. plan 의 초안 문구가 오래된 것일 뿐.
- 제안: 코드 유지. 특이 조치 불필요.

### [WARNING] `macroAverage` — NaN entry 가 포함된 positives 가 들어오면 평균이 NaN 으로 오염될 수 있음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-eval-harness-b8cc46/codebase/backend/src/modules/knowledge-base/eval/retrieval-metrics.ts` `macroAverage` 함수
- 상세: `spec/conventions/rag-evaluation.md §2 결정성 규칙`은 "gold 가 빈 entry 의 지표는 NaN(평가 제외 신호) → macro 평균에서 빠진다"고 명시한다. 현재 `evaluateRetrieval` 은 `shouldRetrieve && goldChunkIds.length > 0` 체크로 positives 분기를 방어하므로 실제 경로상 NaN 이 `macroAverage` 에 들어오지 않는다. 그러나 `macroAverage` 함수 자체에는 NaN guard 가 없어, 호출 경로가 달라지거나 다른 코드에서 재사용하면 `NaN + number = NaN` 으로 전체 집계가 조용히 오염된다. spec 의 "macro 에서 제외" 약속이 함수 계약으로 명시되지 않은 채 호출자 전제에만 의존하는 구조다.
- 제안: `macroAverage` 내에서 `Number.isNaN(e.recall[k])` 항목을 건너뛰는 필터를 추가하거나, 현재 경로가 NaN-safe 임을 검증하는 단위테스트 추가. 현재 동작 경로상 버그 없음이나 회귀 안전성 낮음.

### [WARNING] CI 게이트에서 `--fail-metric mrr` 사용 시 `--fail-k` 가 무시됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-eval-harness-b8cc46/codebase/backend/src/scripts/eval-retrieval.ts` line 1925~1933 (diff 기준)
- 상세: `AggregateMetrics.mrr` 은 `maxK` 고정 단일 `number` 다. `--fail-metric mrr --fail-k 5` 로 호출하면 `failK=5` 가 완전히 무시되고 `maxK` 기반 MRR 값이 사용된다. 에러는 발생하지 않고 사용자가 원하는 k 와 다른 값이 평가된다. `spec/conventions/rag-evaluation.md §3` 은 이 동작을 명시하지 않아 spec 침묵 영역이지만, 사용 안내(`README`, 코드 주석)에도 이 제약이 없어 오해를 유발한다.
- 제안: `mrr` 을 `--fail-metric` 으로 쓸 때 `failK` 가 무시된다는 경고 메시지를 출력하거나, CLI 사용법 주석에 "mrr 은 k 인자 무시, maxK 기반" 명시. 또는 `EvalReport` 에 `mrr` 을 `Record<number, number>` 로 확장해 k 별 MRR 을 지원.

### [INFO] `generate-golden-set.ts` — `--questions-per-chunk=0` 입력 시 최소 1개를 강제 생성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-eval-harness-b8cc46/codebase/backend/src/scripts/generate-golden-set.ts` line 257
  `parseQuestions(result.content).slice(0, Math.max(1, questionsPerChunk))`
- 상세: `questionsPerChunk=0` 이면 `Math.max(1, 0) = 1` 이 되어 사용자가 의도한 "생성 안 함"이 무시된다. spec D-E1 은 기본값 1, `difficulty:'single'` 지원이므로 실용적 영향은 없으나 입력 검증 부재.
- 제안: `questionsPerChunk <= 0` 일 때 에러 후 `process.exit(1)` 처리 권고.

### [INFO] `eval-retrieval.ts` — ws-skip entry 는 진행 카운터(`searched`)에 미포함
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-eval-harness-b8cc46/codebase/backend/src/scripts/eval-retrieval.ts` workspace 조회 실패 분기
- 상세: `workspaceId` 조회 실패 시 바로 `return` 하므로 `finally` 블록의 `searched += 1` 이 실행되지 않는다. 진행 로그 `검색 N/M` 의 N 이 총 entry 수 M 에 도달하지 않을 수 있다. 최종 summary 의 `ws-skip ${skipped}` 는 별도로 정확히 표시되므로 결과 정확성에는 영향 없음.
- 제안: ws-skip 경우에도 `searched += 1` 을 실행하여 진행 카운터를 총 entry 수 기준으로 일관 유지.

### [INFO] spec fidelity — `spec/conventions/rag-evaluation.md` 와 구현 라인-레벨 일치 여부
- `§1` 골든셋 필드: `golden-set.types.ts` `GoldenEntry` 가 spec 표의 모든 필드(`id`, `query`, `language`, `knowledgeBaseId`, `goldChunkIds`, `referenceAnswer?`, `shouldRetrieve`, `source`, `reviewed`, `difficulty`, `generatedFrom?`)와 완전 일치.
- `§2` 지표 정의: `retrieval-metrics.ts` 의 Recall@k(`|gold∩top-k|/|gold|`), Precision@k(`|gold∩top-k|/k`, 분모 k 고정), hit-rate(binary), MRR(역수), nDCG(DCG/IDCG) — spec 표와 공식 완전 일치.
- `§2` 결정성: score 내림차순 + `chunkId` 사전순 tie-break(`orderRetrieved`), gold 빈 → `NaN` 모두 구현.
- `§3` 실행 경로: `EvalCliModule` 격리, npm scripts `eval:golden:generate`/`eval:retrieval` 일치.
- `§4` 커밋 정책: `.gitignore`에 `eval/golden.json`, `eval/*.report.json` 추가 — spec "기본 git 미커밋" 정확히 반영.
- 판정: spec fidelity 이상 없음.

---

## 요약

RAG 평가 하베스(P0 Phase 0+1)의 핵심 기능 — 자동 합성 골든셋 generator, 순수-TS 검색 지표(Recall/Precision/MRR/nDCG/hit-rate@k), eval 러너, EvalCliModule 격리 부트스트랩, ROOT_ENTITIES 분리 — 이 모두 구현되어 있으며 `spec/conventions/rag-evaluation.md` 본문과 라인-레벨로 일치한다. CRITICAL 버그는 없다. WARNING 2건: (1) `macroAverage` 내에 NaN guard 가 없어 호출 경로 계약에만 의존하는 취약한 구조(현재 경로상 버그 없음, 회귀 위험), (2) CI 게이트에서 `--fail-metric mrr --fail-k N` 사용 시 `failK` 가 무시되는 비직관적 동작. INFO 사항은 모두 기능 정확성에 영향 없다.

---

## 위험도

LOW
