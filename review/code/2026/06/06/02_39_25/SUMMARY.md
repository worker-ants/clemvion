# Code Review 통합 보고서

검토 대상: RAG 평가 하베스 P0 Phase 0+1 (rag-eval-harness)
검토 일시: 2026-06-06

---

## 전체 위험도

**MEDIUM** — CLI 스크립트 레이어의 테스트 부재와 `generate-golden-set.ts` binary diff 로 인한 검토 불가 구간이 존재. 핵심 지표 레이어(retrieval-metrics.ts)는 충실히 테스트됨. Critical 발견사항 없음.

---

## Critical 발견사항

없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `eval-retrieval.ts` CLI 유틸 함수(`parseCliFlag`, `fmt`, `printAggregate`, CI 게이트 로직) 테스트 전혀 없음 | `codebase/backend/src/scripts/eval-retrieval.ts` | `parseCliFlag`·`fmt` 를 별도 util 모듈로 export 하거나, `eval-retrieval.spec.ts` 에서 mock `process.argv` 로 검증. CI 게이트 분기는 `jest.spyOn(process, 'exit')` 로 검증 |
| 2 | Testing | `generate-golden-set.ts` binary diff — 테스트 여부 확인 불가. id 해시·dedup 머지·`reviewed:true` 보존 로직 미검증 추정 | `codebase/backend/src/scripts/generate-golden-set.ts` | 해시 생성·dedup 머지 함수를 순수 함수로 분리해 단위테스트 작성. LLM 호출 경로는 `LlmService` mock 처리 |
| 3 | Testing | `lang-detect.ts` 엣지 케이스 미커버: 빈 문자열, 일본어 전용 텍스트(total=0 → `'en'` 반환 의도 불명), `KO_RATIO_THRESHOLD=0.2` 정확한 경계값 | `eval/lang-detect.ts:16` | `detectLanguage` describe 블록에 빈 문자열, 일본어 전용, 임계 경계값 0.2 케이스 추가 |
| 4 | Testing | `evaluateRetrieval` 에 포지티브 항목 0개(전부 `shouldRetrieve=false`) 케이스 미테스트 — `macroAverage([], ks)` 동작 의도 미명시 | `retrieval-metrics.ts` `macroAverage` | `entries` 전부 `shouldRetrieve=false` 인 골든셋 케이스를 `evaluateRetrieval 집계` describe 블록에 추가 |
| 5 | Security | CLI 인자(`--golden`, `--out`)로 전달된 파일 경로를 검증 없이 `readFileSync`/`writeFileSync` 에 사용 — CI 환경에서 경로 탐색 가능 | `codebase/backend/src/scripts/eval-retrieval.ts` `goldenPath`·`outPath` 구성부 | `outAbs.startsWith(resolve(process.cwd()))` 가드 추가 또는 허용 디렉터리 화이트리스트 제한 |
| 6 | Security | 골든셋 JSON 파일 파싱 시 런타임 스키마 검증 없이 신뢰 (`as GoldenSet` 타입 단언만) | `eval-retrieval.ts` JSON.parse 호출부 | 이미 포함된 `zod` 로 `GoldenSet` 스키마 `safeParse()` 검증 추가. `knowledgeBaseId` UUID 형식 검증 권장 |
| 7 | Security | `kbId` UUID 형식 검증 없이 raw SQL 파라미터로 전달 — DB 에러 메시지로 내부 정보 노출 가능 | `eval-retrieval.ts` `resolveWorkspace` 내 `dataSource.query(...)` | `kbId` UUID 정규식 사전 검증, 실패 시 해당 entry skip 처리 |
| 8 | Security | `catch` 블록에서 `err.message` 를 stdout 에 그대로 출력 — DB 호스트명·쿼리·API 키 접두어 노출 가능 | `eval-retrieval.ts` catch 블록 | 에러 유형만 분류 출력하거나 sanitize. 단기적으로 stack trace 는 제거 |
| 9 | Requirement | `macroAverage` 함수 자체에 NaN guard 없음 — `evaluateRetrieval` 호출 경로가 달라지면 NaN 오염으로 전체 집계 조용히 파손 | `retrieval-metrics.ts` `macroAverage` | `Number.isNaN(e.recall[k])` 항목 필터 추가 또는 NaN-safe 임을 검증하는 단위테스트 추가 |
| 10 | Requirement | CI 게이트에서 `--fail-metric mrr --fail-k N` 사용 시 `failK` 가 완전히 무시되고 `maxK` 기반 MRR 사용 — 비직관적이며 문서화 없음 | `eval-retrieval.ts` CI 게이트 분기 | `mrr` + `failK` 지정 시 경고 메시지 출력 또는 CLI 주석에 "mrr 은 k 인자 무시, maxK 기반" 명시 |
| 11 | Performance | `resolveWorkspace` DB 쿼리 배치화 미적용 — 신규 kbId N개면 N번 개별 SELECT 왕복 (`wsCache` 로 중복만 방지) | `eval-retrieval.ts` `resolveWorkspace` | 스크립트 시작 시 고유 kbId 목록 추출 후 `WHERE id = ANY($1)` 한 번 조회로 `wsCache` 사전 워밍 |
| 12 | Performance | `evaluateEntry` 내 k 마다 `ranked.slice(0, k)` 반복 — N=1000 entry 기준 최대 16,000개 배열 GC 대상 | `retrieval-metrics.ts` `evaluateEntry` | `ranked.slice(0, maxK)` 한 번만 실행하고 `countHits` 계열에 `limit` 파라미터 추가 또는 인라인화 |
| 13 | Performance | `ndcgAtK` 내 `Math.log2(i+2)` 매 호출마다 반복 계산 — N=1000, K=4, k=10 기준 ~40,000회 중복 | `retrieval-metrics.ts` `ndcgAtK` | `maxK+2` 크기 log2 정적 테이블을 `evaluateRetrieval` 진입 시 한 번 생성해 전달 |
| 14 | Performance | `lang-detect.ts` `/g` 플래그 정규식 `match()` 로 모든 매칭 배열 생성 후 `.length` 만 사용 — 수천 문자 배열 불필요 생성 | `lang-detect.ts` `detectLanguage` | 카운팅 루프(`while (re.exec(text) !== null) count++`)로 교체 또는 `/g` 플래그 제거 |
| 15 | Architecture | `EvalCliModule` 이 `ROOT_ENTITIES` 전체 등록 — 실제 필요 entity 는 소수이나 과도한 의존 범위 | `eval-cli.module.ts` `entities: [...ROOT_ENTITIES]` | 중장기에 `EVAL_CLI_ENTITIES` 별도 배열로 최소 entity 집합만 등록 |
| 16 | Architecture | `generate-golden-set.ts` raw SQL `ORDER BY ${orderBy}` 동적 인터폴레이션 — 현재는 2가지 상수 중 하나이나 패턴 자체가 미래 코드 변경 시 위험 | `generate-golden-set.ts` L194–203 | 쿼리를 조건별로 분기하거나 화이트리스트 const 매핑으로 패턴 의도를 코드로 보증 |
| 17 | Maintainability | `parseCliFlag` 함수가 두 스크립트에 완전 동일하게 복사 — DRY 위반, 세 번째 스크립트 추가 시 재복사 가능 | `eval-retrieval.ts` L4–L12, `generate-golden-set.ts` L40–L48 | `src/scripts/cli-utils.ts` 공통 유틸로 추출 후 두 스크립트에서 import |
| 18 | Maintainability | `eval-retrieval.ts` `main()` 함수 ~145줄에 6가지 책임 집중 — CLI 파싱·부트스트랩·KB 조회·검색 fan-out·리포트 출력·CI 게이트 | `eval-retrieval.ts` `main()` 전체 | `resolveArgs()`, `runSearchPhase()`, `printReport()`, `checkCiGate()` 단계별 함수로 분리 |
| 19 | Maintainability | `generate-golden-set.ts` LLM 호출 람다 중첩 4단계(`Promise.all` → `limit` → `try` → `for`) — 가독성 저하 | `generate-golden-set.ts` L220–L292 | `processChunk(chunk, ...): Promise<GoldenEntry[]>` 독립 async 함수로 추출해 중첩 2단계로 축소 |
| 20 | Concurrency | `wsCache` check-then-act 패턴 — 동일 kbId 첫 도착 다수 concurrent task 가 각자 DB 쿼리 발행 (중복 쿼리) | `eval-retrieval.ts` `resolveWorkspace` L1848–1858 | Promise 를 캐시 값으로 저장해 중복 쿼리 방지 |
| 21 | Documentation | `eval/README.md` 에 `.env` 전제조건 언급 없음 — 실행 시 혼란 유발 | `codebase/backend/eval/README.md` 실행 전제조건 섹션 | "`.env` 에 DB 접속 정보 및 LLM config 가 설정돼 있어야 한다" 1~2줄 추가 |
| 22 | Documentation | `eval/README.md` 에 `--threshold` 플래그 미문서화 — 검색 결과 score 하한으로 결과에 영향이 큼 | `eval/README.md` 지표 실행 섹션 | `--threshold 0.0` 기본값 및 용도 예시 명령에 주석으로 추가 |
| 23 | Documentation | `eval/README.md` 워크플로가 `npx ts-node` 직접 실행 안내만 있고 npm scripts 참조 없음 | `eval/README.md` 워크플로 1·3 단계 | `# 또는: npm run eval:golden:generate -- ...` 형식 대안 줄 추가 |
| 24 | Documentation | `root-entities.ts` JSDoc 마지막 문장 re-export 방향 애매 | `codebase/backend/src/database/root-entities.ts` JSDoc 마지막 문장 | "app.module 이 이 배열을 re-export 하여 기존 import 사이트 호환을 유지한다"로 명확화 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | `ROOT_ENTITIES` 전용 파일 분리 — SRP 적절 적용, re-export 로 기존 호환 유지 | `src/database/root-entities.ts`, `app.module.ts` | 없음 |
| 2 | Architecture | `EvalCliModule` 경량 DI 컨텍스트 분리 — 운영 워커·큐 미기동 설계 의도 명확 | `eval-cli.module.ts` | 없음 |
| 3 | Architecture | 순수 지표 함수(`retrieval-metrics.ts`)와 CLI I/O(`eval-retrieval.ts`) 명확히 분리 | `retrieval-metrics.ts`, `eval-retrieval.ts` | 없음 |
| 4 | Architecture | `GoldenSetMeta.version` 리터럴 `1` 고정 — 스키마 버전 진화 시 breaking change 위험 | `golden-set.types.ts` | 후속 Phase 에서 버전 분기 로직 추가 시 `version: number` 완화 또는 versioned union type 검토 |
| 5 | Architecture | `lang-detect.ts` — `knowledge-base/eval/` 하위에 위치하나 범용 유틸, 향후 재사용 시 이동 고려 | `eval/lang-detect.ts` | 미래 재사용 시 `common/utils/lang-detect.ts` 이동 고려 |
| 6 | Requirement | `--questions-per-chunk=0` 입력 시 `Math.max(1, 0)=1` 이 되어 "생성 안 함" 의도 무시 | `generate-golden-set.ts` L257 | `questionsPerChunk <= 0` 시 에러 후 `process.exit(1)` 처리 권고 |
| 7 | Requirement | ws-skip entry 가 진행 카운터(`searched`)에 미포함 — 로그 N/M 이 M 에 미달 가능 | `eval-retrieval.ts` workspace 조회 실패 분기 | ws-skip 시에도 `searched += 1` 실행해 총 entry 수 기준 일관 유지 |
| 8 | Requirement | spec fidelity 완전 일치 확인 — `GoldenEntry` 필드, 지표 공식, 실행 경로, 커밋 정책 모두 spec 일치 | 전체 eval 레이어 | 없음 |
| 9 | Testing | `retrieval-metrics.spec.ts` — 핵심 지표 20개 케이스로 충실히 커버됨 | `retrieval-metrics.spec.ts` | 없음 |
| 10 | Testing | `EvalCliModule` 자동 통합 테스트 없음 — `RagSearchService` DI 실패 회귀 자동 잡는 경로 없음 | `eval-cli.module.ts` | `eval-cli.module.spec.ts` 최소 스펙 추가(TypeOrmModule·LlmModule mock 처리) |
| 11 | Testing | `golden.example.json` 픽스처 GoldenSet 인터페이스 자동 검증 없음 | `eval/golden.example.json` | `retrieval-metrics.spec.ts` 또는 별도 스펙에 필수 필드 존재 assertion 추가 |
| 12 | Security | `eval/golden.json`, `eval/*.report.json` gitignore 정상 처리 | `codebase/backend/.gitignore` | 없음 |
| 13 | Security | `golden.example.json` 예시 데이터 nil UUID·더미 UUID 사용 — 실 고객 데이터 없음 확인 | `eval/golden.example.json` | 없음 |
| 14 | Security | `EvalCliModule` DB 자격증명 ConfigService+.env 주입, 하드코딩 없음, `synchronize: false` | `eval-cli.module.ts` | 없음 |
| 15 | Security | `generate-golden-set.ts` binary diff — 내용 검토 불가, CLI 인자 검증 별도 확인 필요 | `generate-golden-set.ts` | binary diff 사유 확인 후 별도 리뷰 수행 권고 |
| 16 | Performance | `EvalCliModule` ROOT_ENTITIES 전체(~40개) 등록 — eval 필요 entity 는 소수, 부트스트랩 비용 과도 | `eval-cli.module.ts` | WARNING #15 와 동일 조치 |
| 17 | Performance | `readFileSync` + `JSON.parse` 전체 goldenSet 동기 적재 — 수만 entry 시 메모리 과점 | `eval-retrieval.ts` 파일 읽기부 | 단기 허용. 규모 확장 시 NDJSON 또는 스트리밍 파서 전환 고려 |
| 18 | Dependency | 신규 외부 패키지 추가 없음 — `p-limit`, `ts-node`, `tsconfig-paths` 모두 기존 의존성 재활용 | `package.json` | 없음 |
| 19 | Side Effect | `generate-golden-set.ts` 제품 LLM API 직접 호출 — 실제 과금 발생, `--dry-run` 으로 억제 가능 | `generate-golden-set.ts` | CI 에서 무심코 실행 방지. `--dry-run` 활용 |
| 20 | Scope | plan Phase A/B 체크박스 전부 `[ ]` 로 미갱신 — 코드와 불일치 | `plan/in-progress/rag-eval-harness.md` | Phase A 완료 항목 `[x]` 로 갱신 |
| 21 | Scope | `generate-golden-set.ts` binary diff 로 표시 — 파일 인코딩(BOM 등) 문제 가능성 | `generate-golden-set.ts` | `file` 또는 `hexdump` 로 인코딩 검증, 필요 시 UTF-8 BOM 없이 재저장 후 재커밋 |
| 22 | Concurrency | `retrieved` 중복 id 시 마지막 write 가 이기는 묵시적 동작 — 기능 버그 아니나 진단 어려움 | `eval-retrieval.ts` `retrievedByEntryId` | 실행 전 골든셋 중복 id 사전 검증 추가 |
| 23 | Maintainability | `retrieval-metrics.ts` `evaluateRetrieval` 루프 내 4개 상태 동시 변경 — 주석 없어 의도 파악 어려움 | `retrieval-metrics.ts` L1700–L1712 | 루프 시작부에 `// positive entry 집계 / negative entry 집계 분기` 주석 추가 |
| 24 | Documentation | `golden-set.types.ts`, `retrieval-metrics.ts`, `lang-detect.ts`, `eval-cli.module.ts` JSDoc 충실 | 각 파일 | 없음 |
| 25 | Documentation | `eval/README.md` 신규 생성, 워크플로·골든셋 커밋 정책·결정성·spec SoT 링크 포함 | `codebase/backend/eval/README.md` | 없음 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | MEDIUM | CLI 스크립트 테스트 전무, lang-detect 엣지 케이스 미커버, positive-zero 케이스 미테스트 |
| security | LOW | CLI 인자 경로 탐색 가능성, 골든셋 JSON 런타임 검증 부재, 에러 메시지 내부 정보 노출 |
| performance | LOW | evaluateEntry 반복 slice, ndcgAtK Math.log2 중복 계산, resolveWorkspace 비배치 DB 쿼리 |
| architecture | LOW | ROOT_ENTITIES 전체 등록, parseCliFlag 중복, raw SQL 동적 인터폴레이션 패턴 |
| requirement | LOW | macroAverage NaN guard 부재, --fail-metric mrr 시 failK 무시 비직관적 동작 |
| maintainability | LOW | parseCliFlag 중복(DRY), main() 과부하(6가지 책임), generate-golden-set.ts 람다 중첩 4단계 |
| documentation | LOW | eval/README.md .env 전제조건 누락, --threshold 미문서, npm scripts 연결 누락 |
| concurrency | LOW | wsCache check-then-act 중복 쿼리 가능성, 카운터 단일 스레드 가정 묵시적 |
| scope | LOW | plan 체크박스 미갱신, generate-golden-set.ts binary diff 인코딩 문제 가능성 |
| side_effect | LOW | LLM API 과금 발생(의도됨), ROOT_ENTITIES 분리 re-export 부작용 없음 |
| dependency | LOW | 신규 외부 패키지 추가 없음, generate-golden-set.ts binary diff 의존성 확인 불가 |

---

## 발견 없는 에이전트

없음. 모든 에이전트가 최소 1건 이상 발견사항을 보고함.

---

## 권장 조치사항

1. **[필수] CLI 스크립트 테스트 작성** — `eval-retrieval.ts` 의 `parseCliFlag`, `fmt`, CI 게이트 분기를 export 가능 형태로 분리하고 spec 작성. `generate-golden-set.ts` 의 id 해시·dedup 머지 로직 단위테스트 추가.
2. **[필수] `macroAverage` NaN guard 추가** — `Number.isNaN` 필터를 함수 내부에 추가해 호출자 전제에 의존하지 않도록 개선.
3. **[필수] `generate-golden-set.ts` binary diff 원인 해소** — 파일 인코딩 확인 후 텍스트로 재커밋해 코드 리뷰·보안 감사 가능 상태로 복구.
4. **[권고] 골든셋 JSON 런타임 zod 검증 추가** — `GoldenSet` 스키마를 zod 로 정의하고 `safeParse()` 적용. `kbId` UUID 형식 사전 검증 추가.
5. **[권고] `parseCliFlag` 공통 유틸 추출** — `src/scripts/cli-utils.ts` 로 분리해 두 스크립트에서 import.
6. **[권고] `eval/README.md` 보완** — `.env` 전제조건, `--threshold` 플래그, npm scripts 참조 추가.
7. **[권고] `resolveWorkspace` wsCache Promise 캐싱으로 개선** — 동일 kbId 중복 DB 쿼리 방지.
8. **[권고] `--fail-metric mrr --fail-k N` 무시 경고 추가** — 사용자 혼란 방지.
9. **[선택] `evaluateEntry` slice 최적화 및 ndcgAtK log2 테이블 캐시** — 수천 entry 규모 실운용 전 적용 권장.
10. **[선택] plan 체크박스 `[x]` 갱신** — Phase A 완료 항목 추적 정합성 유지.

---

## 라우터 결정

라우터가 reviewer 를 선별함 (`routing_status=done`).

- **실행** (11명): `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `dependency`, `concurrency`
- **강제 포함(router_safety)** (8명): `dependency`, `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`
- **제외** (3명):

| 제외된 reviewer | 이유 |
|------------------|------|
| database | 라우터 선별 제외 (이유 미기재) |
| api_contract | 라우터 선별 제외 (이유 미기재) |
| user_guide_sync | 라우터 선별 제외 (이유 미기재) |