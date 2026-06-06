# 신규 식별자 충돌 검토 — rag-eval-harness (Phase 0+1)

검토 대상: `plan/in-progress/rag-eval-harness.md`
검토 범위: 신규 도입 식별자 vs 기존 spec/codebase 사용처

---

## 발견사항

### 발견사항 없음 — 충돌 없음

모든 점검 관점에 대해 실제 충돌이 발견되지 않았다. 아래에 점검 결과를 항목별로 기술한다.

---

#### 1. 요구사항 ID 충돌

target 문서는 별도 요구사항 ID(`NAV-*`, `ED-*`, `ND-*` 등 형식의 ID)를 부여하지 않는다. 내부 결정 식별자로 `D-E1`~`D-E6` 를 사용하나, 이는 plan 내부 레이블이며 상위 plan `rag-quality-improvement.md` 의 `D1`~`D7` 과 prefix 가 `D-E`/`D` 로 명확히 구분된다. 기존 spec 어디에도 `D-E` prefix ID 는 없다.

- **[INFO]** `D-E1`~`D-E6` 레이블이 상위 plan `D1`~`D7` 과 유사하나, 상위 plan 자체도 plan-internal label 이어서 외부 충돌은 없다. 두 plan 이 같은 파일 안에 들어오거나 합쳐질 경우를 대비해 이름을 다르게 유지하는 것은 이미 충족돼 있다.

---

#### 2. 엔티티/타입명 충돌

신규 도입 타입: `GoldenEntry`, `GoldenSet`, `EvalReport`.

- `/Volumes/project/private/clemvion/.claude/worktrees/rag-eval-harness-b8cc46/codebase/backend/src` 전체 검색 결과: 해당 이름과 동일한 타입·인터페이스·클래스 존재하지 않음.
- `difficulty` 필드: codebase 내 다른 의미로 사용하는 사례 없음 (frontend `selectionMode: 'single'` 은 완전히 다른 도메인).
- `reviewed`, `source` 필드: JSON 데이터 파일 수준의 필드명이며 DB 컬럼·TypeORM 엔티티로는 사용 중이지 않음. 충돌 없음.

---

#### 3. API endpoint 충돌

target 은 새로운 HTTP endpoint 를 정의하지 않는다. 내부 NestJS 스크립트(`NestFactory.createApplicationContext`)로 실행되는 CLI 도구이며, REST/WebSocket route 를 추가하지 않는다.

---

#### 4. 이벤트/메시지명 충돌

target 은 새로운 BullMQ 큐 이름, SSE 이벤트, webhook 이벤트를 도입하지 않는다.

---

#### 5. 환경변수·설정키 충돌

target 이 신규로 요구하는 ENV var 은 명시되지 않았다. 스크립트 args(`--workspace-id`, `--kb-id`, `--sample`, `--lang`, `--questions-per-chunk`, `--out`, `--dry-run`, `--fail-under`)는 CLI 인자이며 환경변수가 아니다. 기존 `package.json` scripts 에 `eval:golden:generate`, `eval:retrieval` 스크립트 이름이 없음을 확인했다. 충돌 없음.

---

#### 6. 파일 경로 충돌

신규 경로:

| 신규 경로 | 충돌 여부 |
|---|---|
| `codebase/backend/src/modules/knowledge-base/eval/` | 해당 디렉토리 미존재. 충돌 없음 |
| `codebase/backend/src/scripts/generate-golden-set.ts` | 미존재. 충돌 없음 |
| `codebase/backend/src/scripts/eval-retrieval.ts` | 미존재. 충돌 없음 |
| `codebase/backend/eval/golden.json` | `eval/` 디렉토리 자체 미존재. 충돌 없음 |
| `codebase/backend/eval/golden.example.json` | 동상. 충돌 없음 |
| `codebase/backend/eval/README.md` | 동상. 충돌 없음 |
| `spec/conventions/rag-evaluation.md` | 미존재. 기존 convention 파일 목록(`spec/conventions/*.md`)과 명칭 겹침 없음 |

`spec/conventions/` 기존 파일: `cafe24-api-metadata.md`, `cafe24-restricted-scopes.md`, `chat-channel-adapter.md`, `conversation-thread.md`, `cross-node-warning-rules.md`, `data-hydration-surfaces.md`, `error-codes.md`, `execution-context.md`, `i18n-userguide.md`, `interaction-type-registry.md`, `makeshop-api-metadata.md`, `migrations.md`, `node-cancellation.md`, `node-output.md`, `secret-store.md`, `spec-impl-evidence.md`, `swagger.md`, `user-guide-evidence.md`. `rag-evaluation.md` 와 겹치는 이름 없음.

---

#### 7. 기타 확인 사항

- `searchWithMeta()` 메서드: `/Volumes/project/private/clemvion/.claude/worktrees/rag-eval-harness-b8cc46/codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts:91` 에 이미 존재한다. target plan 이 이 메서드를 eval 러너에서 **호출** 한다고 명시하고 있으며, 새로 정의하는 것이 아니다. 충돌 아닌 의존.
- `RagSearchService` 이름: 이미 존재하는 서비스 클래스를 재사용하므로 이름 충돌 아님.

---

## 요약

target `plan/in-progress/rag-eval-harness.md` 가 도입하는 신규 식별자(`GoldenEntry`, `GoldenSet`, `recallAtK/precisionAtK/mrrAtK/ndcgAtK/hitRateAtK`, `evaluateRetrieval`, `eval:golden:generate`/`eval:retrieval` npm scripts, `spec/conventions/rag-evaluation.md` 파일, `codebase/backend/eval/**` 경로, `src/modules/knowledge-base/eval/**` 경로, `src/scripts/generate-golden-set.ts`/`eval-retrieval.ts`)는 기존 spec, codebase, 다른 plan 의 어디에서도 동일하거나 혼동 가능한 의미로 사용되고 있지 않다. 새 convention 파일 이름은 기존 18개 convention 파일과 충돌하지 않는다. API endpoint, BullMQ 큐, SSE 이벤트, 환경변수 신규 도입은 없다.

---

## 위험도

NONE
