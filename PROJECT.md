# PROJECT.md — Clemvion 프로젝트별 매핑·명령

본 저장소의 프로젝트-특이 매핑·명령. `.claude/` 하네스는 generic 화되어 있으므로,
이 저장소에서의 코드베이스 구조, 빌드·테스트 명령, 문서 컨벤션은 본 문서에서 한 곳에 모은다.

다른 저장소에서 본 하네스를 채택할 때는 본 파일만 자기 프로젝트에 맞게 작성하면 된다. 하네스의 generic skeleton (`developer/SKILL.md`, `ai-review.md`, `code-review-agents/SKILL.md`) 은 본 파일을 참조해 동작한다.

## 코드베이스 구조

| 영역 | 위치 | 스택 |
|------|------|------|
| 클라이언트 | `codebase/frontend/` | Next.js 16, React 19, TypeScript, Tailwind CSS, Radix UI, Zustand, TanStack Query, @xyflow/react |
| 서버 | `codebase/backend/` | NestJS 11, TypeScript, TypeORM, Socket.io |
| 공유 패키지 | `codebase/packages/expression-engine/`, `codebase/packages/node-summary/` | TypeScript. `codebase/{frontend,backend}` 가 `file:../packages/*` 로 참조 |
| 인프라 매니페스트 | `k8s/` | Kubernetes deployment, service, ingress |
| 빌드 helper | `scripts/` | Python 검증 스크립트, setup-githooks.sh |

패키지 매니저: 모두 **npm** (yarn / pnpm 사용 금지).
인프라: PostgreSQL 16 · Redis 7 (BullMQ) · MinIO · Flyway · Docker Compose.

## 빌드·린트·테스트 명령

| 단계 | wrapper 한 줄 호출 | 내부에서 실행되는 명령 (backend + frontend **양쪽 의무**) |
|------|------|------|
| lint | `.claude/tools/run-test.sh lint` | `cd codebase/backend && npm run lint` **그리고** `cd codebase/frontend && npm run lint` |
| unit test (jest/vitest, in-process) | `.claude/tools/run-test.sh unit` | `cd codebase/backend && npm test` **그리고** `cd codebase/frontend && npm test` |
| build | `.claude/tools/run-test.sh build` | `cd codebase/backend && npm run build` **그리고** `cd codebase/frontend && npm run build` |
| e2e (backend supertest, ~30–60s) | `.claude/tools/run-test.sh e2e` | `make e2e-test` |
| e2e (backend + playwright) | — | `make e2e-test-full` |
| e2e 인프라 정리 (중간 종료 시) | — | `make e2e-down` |
| e2e stale project 일괄 정리 (worktree 삭제 후) | — | `make e2e-prune` |
| git hook 등록 (clone 후 1회) | — | `make setup-githooks` |

**순서 근거**: e2e 는 `docker-compose.e2e.yml` 에서 backend 이미지를 빌드해 실행하므로, 로컬 `npm run build` 가 통과해야 e2e 도 의미가 있다. build 실패를 먼저 잡으면 docker 빌드 시간(분 단위) 낭비를 피한다.

**Cross-stack 의무 — 한쪽 누락 금지**: lint / unit / build 단계의 wrapper 호출은 `.claude/test-stages.sh` 안에서 backend + frontend 를 **순차 AND** 로 실행한다 (한쪽 실패 시 즉시 단계 실패). **반드시 wrapper 를 통해 호출** — `cd codebase/backend && npm run build` 같은 단일 stack 직호출로 단계를 "통과" 처리하면 다른 한쪽 회귀 (대표 사례: PR-E3 의 trigger drawer `t.x.y` 객체 접근 → `t("x.y")` 함수 호출 타입 오류, frontend build 누락으로 main 머지 후 `0f05d3e5` 핫픽스 필요) 가 검출되지 않는다. wrapper 가 한 단계 = 양쪽 stack 묶음이라는 invariant 의 유일한 enforcer.

**Worktree 별 e2e 자동 격리**: `make e2e-*` 는 현재 worktree dir basename 으로 compose project name 을 도출 (main worktree = `clemvion-e2e`, `.claude/worktrees/<task>-<slug>/` = `clemvion-e2e-<task>-<slug>`). 컨테이너·볼륨·network 가 worktree 별로 분리되므로 여러 worktree 에서 e2e 를 **동시에** 돌려도 충돌 없음. image 자체는 worktree 간 공유되어 (각 빌드 서비스에 `image:` 명시) 두 번째 worktree 의 첫 e2e 가 image rebuild 비용을 다시 치르지 않는다. `COMPOSE_PROJECT=foo make e2e-test` 로 사용자 override 가능. 자세한 내용은 `docker-compose.e2e.yml` 헤더 주석과 `Makefile` 상단, 운영 정책은 [`CLAUDE.md` §Worktree 기반 작업 정책](CLAUDE.md#worktree-기반-작업-정책) 참고.

## e2e 실행 원칙

코드가 한 줄이라도 바뀌었으면 **e2e 수행이 default**. 면제는 §e2e 면제 화이트리스트 의 부분집합 조건만 인정한다. 자가 판단·후속 단계 떠넘기기·"변경이 작아서" 는 모두 면제 사유가 아니다.

본 절은 자주 발생한 회피 패턴과 실행 사전 점검을 명시한다. 면제 대상 식별 규칙은 §e2e 면제 화이트리스트, 실제 명령은 §빌드·린트·테스트 명령, 작성 패턴은 §e2e 테스트 작성 가이드 참고.

### 회피 안티패턴

다음 사유는 자동(`resolution-applier`) · 수동 흐름 모두에서 회피로 분류된다. RESOLUTION.md 의 `e2e` 줄에 적어도 그 자체가 차단 신호가 된다:

- **"단위·integration 으로 충분"** — e2e 는 docker compose 의 실 Postgres·Redis·MinIO·Flyway·BullMQ 회귀 안전망이다. unit 으로 절대 검출 못 함
- **"변경이 frontend 만 / backend 만"** — cross-stack 회귀 검출 자체가 e2e 의 본 목적
- **"사용자 가시 동작에 영향 없어 보임"** — 자가 영향 추정은 면제 사유 아님. 영향 추정은 변경자가 아닌 실 인프라가 결정
- **"lint·unit·build 통과했으니 후속 단계(`/ai-review` 등) 가 처리할 것"** — 후속 단계도 동일 wrapper 를 호출한다. 떠넘긴다고 사라지지 않으며, 자동 흐름에서 차단되면 손실만 누적
- **"review 반영 직후 fix 가 1~2 줄"** — 코드 변경이면 변경량 무관 재수행. 마지막 코드 commit 다음에 e2e 통과 줄이 없으면 회피로 본다
- **"docker 가 느려서 다음 turn 에"** — 가용성을 실제 확인하지 않은 보류 금지. 미루기 전에 `docker info` 로 daemon 가용성 먼저 확인

> `[skip-e2e]` 자체 발급 절대 금지. 자동 흐름은 `resolution-applier` sub-agent 가 wrapper 호출을 강제하며, 수동 흐름이라도 `.claude/skills/developer/SKILL.md §RESOLUTION.md schema` 의 e2e 줄 4형식 (통과 / 면제 (화이트리스트 인용) / 보류 (사용자 응답 인용) / 자동 흐름 환경 차단) 외 어떤 표현도 차단된다.

### 실행 사전 체크리스트

매 turn TEST WORKFLOW 진입 시 순서대로 자가 점검:

1. `git status --short` 로 **변경 set 확인** — `.md` · `spec/` · `plan/` 만으로 보였어도 `codebase/` 가 한 줄이라도 끼었는지 재확인
2. 변경 set 이 §e2e 면제 화이트리스트 의 **부분집합** 인가? 화이트리스트 밖이 한 줄이라도 있으면 실행
3. `docker info` 로 daemon 가용성 확인 — 없으면 자동 흐름은 "자동 흐름 환경 차단", 수동 흐름은 사용자 보고 후 응답 인용
4. 이전 turn 의 stale 컨테이너가 있다면 `make e2e-down` (worktree 격리되어 있으나 충돌 시 명시 정리)
5. `.claude/tools/run-test.sh e2e` 호출 — raw `make e2e-test` 직호출 금지 (main ctx 폭주)
6. 실패 시 wrapper stdout 의 마지막 30 줄로 원인 분석 → fix → TEST WORKFLOW **1단계부터** 재실행

> "이미 통과했으니 다시 안 돌려도 된다" 는 검증 시점과 commit 시점의 불일치를 만들 뿐. **마지막 코드 commit 다음에 e2e 통과 줄이 있어야 한다.**

### 자주 누락되는 turn 패턴

- 한 줄짜리 핫픽스 ("typo", "변수명 한 글자") — 짧은 변경이 곧 짧은 e2e 가 아님. 실 인프라 회귀 가능성은 변경량 무관
- "spec·plan 만 손댔다" 인데 실은 `codebase/` 한 줄이 같이 간 경우 — 1번 체크 누락
- review 이슈 fix 완료 직후 — review 가 코드 수정을 동반했으면 다시 e2e
- 이미 e2e 가 통과한 직후의 추가 작은 fix — fix 도 코드면 다시 e2e
- merge·rebase 후 본인 변경이 아닌 줄이 섞여 들어왔을 때 — 변경 set 의 *전체* 가 화이트리스트 부분집합인지 재판정

## e2e 면제 화이트리스트

코드 변경 (`.ts` / `.tsx` / `.sql` / 런타임 `.json` / `Dockerfile` / `Makefile` / 빌드 설정 등) 이 한 줄이라도 포함되면 **e2e 는 default 로 수행**. 변경 set 이 다음 목록의 **부분집합** 일 때에 한해 e2e 면제:

- `*.md` · `*.mdx` 본문 (frontmatter 포함)
- `spec/**` · `plan/**` · `review/**` · `CLAUDE.md` · `AGENTS.md` · `README.md` · `PROJECT.md`
- `.claude/**` (skills, hooks, agents 정의)
- `codebase/frontend/src/content/docs/**` (유저 가이드 본문)
- `codebase/frontend/src/lib/i18n/dict/**` (사전 키만; 호출 코드 변경 없음)
- 주석 전용 변경 (코드 라인 0줄, 주석/공백/포맷만)
- `.github/**` (CI 정의는 e2e 가 검증 대상 아님)
- 이미지·로고·폰트 등 정적 자산

위 목록 밖이 한 항목이라도 포함되면 면제 불가. 회색 지대(예: `*.test.ts` 만 변경, configuration JSON, helper 한 줄) 도 화이트리스트가 아니므로 e2e 수행. 화이트리스트 추가가 필요하면 본 문서를 PR 로 갱신 후 적용 — 임의 확대 금지.

### 화이트리스트 밖인데 보류가 정당한 경우 — 사용자 명시 승인 필수

다음과 같이 보류가 합리적인 상황이 있다:

- 사전 결함이 e2e 를 막고 있고 본 변경과 무관함이 명확 (commit hash 로 입증 가능)
- outbound third-party API stub 인프라 부재 등 구조적 한계
- 환경상 docker 실행 불가 (디스크/메모리/daemon)

이 경우에도 **`[skip-e2e]` 자체 발급 금지**. 멈추고 사용자 보고 → 명시 응답 받은 뒤에만 보류. RESOLUTION.md `## TEST 결과` 에 사유 + 응답 시점 인용 기록.

## 변경 유형 → 갱신 위치 매핑

코드 변경 후 함께 갱신해야 할 문서·번역 자산의 white list. 누락 시 `fix(i18n):` · `docs(user-guide):` 사후 보정 PR 패턴을 차단.

> **machine-readable companion**: 본 표의 구조적 spine(`change_type → trigger → targets → verify → guard_test → convention_ref`)은 [`.claude/config/doc-sync-matrix.json`](.claude/config/doc-sync-matrix.json) 에 SSOT 로 정리돼 있다 — `user-guide-sync-reviewer` 가 안정적 색인으로 읽고, [`.claude/tests/test_doc_sync_matrix.py`](.claude/tests/test_doc_sync_matrix.py) 가 본 표와의 행 수 1:1 · 참조 실존을 검증한다(divergence 시 빌드 fail). 본 표는 사람용 뷰 — 한 행 추가/삭제 시 JSON 도 같이 고친다. 의미 기반 trigger(glob 없는 행)는 JSON 에서 `match:"semantic"` 로 표기되며 reviewer 가 판단으로 매칭한다.

| 변경 유형 | 필수 갱신 위치 | 검증 명령 |
| --- | --- | --- |
| 새 노드 추가 (`codebase/backend/src/nodes/<cat>/<name>/`) | (a) `codebase/frontend/src/content/docs/02-nodes/<cat>.mdx` + `.en.mdx` 의 노드 항목<br>(b) `codebase/frontend/src/lib/i18n/dict/{ko,en}/<section>.ts` 의 노드명·필드명·placeholder·도움말<br>(c) `codebase/frontend/src/lib/i18n/backend-labels.ts` — 에러 코드·label 번역 | `cd codebase/frontend && npm test -- i18n docs` |
| 노드 schema 변경 (필드 추가·라벨 변경) | (a) `codebase/frontend/src/content/docs/02-nodes/<cat>.mdx` 의 FieldTable<br>(b) `codebase/frontend/src/lib/i18n/dict/{ko,en}/<section>.ts` 의 해당 키<br>(c) `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 label/errorCode | 동일 |
| 신규 UI 문자열 (TSX) | `codebase/frontend/src/lib/i18n/dict/{ko,en}/<section>.ts` **양쪽** — 한쪽만 추가 금지 (parity 가드 fail) | `cd codebase/frontend && npm test -- i18n` |
| 통합 신규/제공자 변경 | `codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx}` + dict 키 | `cd codebase/frontend && npm test -- i18n docs` |
| 유저 가이드 신규 섹션 디렉토리 (`codebase/frontend/src/content/docs/<NN>-<name>/`) | `codebase/frontend/src/lib/docs/locale.ts` 의 `SECTION_LABELS_BY_LOCALE` **양쪽 로케일 등록** (KO/EN 모두) | `cd codebase/frontend && npm test -- locale` |
| 백엔드 API 추가·변경 | (a) controller·DTO 의 swagger jsdoc<br>(b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지 | swagger 단위 테스트 / 빌드 |
| 신규 warningCode 발행 (backend warningRules) | `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 `WARNING_KO` 에 한국어 매핑 등록. 영문 SoT 원칙 — 백엔드는 영문 코드/메시지, frontend 가 매핑 | `cd codebase/frontend && npm test -- backend-labels` |
| 신규 errorCode 발행 (`codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum 추가) | 현재 `backend-labels.ts` 에 `ERROR_KO` 매핑 테이블이 없어 영문 message 가 그대로 노출됨. 후속 plan 에서 `ERROR_KO` 신설 검토 — 그 전까지는 errorCode 추가 시 사용자 가시 ko 노출을 PR 본문에 명시 | — (후속 가드 미도입) |
| **신규 cross-cutting enum 값 추가** (`WaitingInteractionType` / `ConversationTurnSource` / `PresentationType` 등) | (a) `spec/conventions/interaction-type-registry.md` 의 매트릭스에 행 추가<br>(b) 매트릭스가 가리키는 모든 코드 분기 위치를 동시 갱신 (TS `assertNever` 패턴 사용)<br>(c) AST 가드 (`interaction-type-exhaustiveness.test.ts`) 통과 | `cd codebase/frontend && npm test -- interaction-type-exhaustiveness` |
| **신규 backend zod `ui.label` / `hint` / `group` / `itemLabel` 값** | `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 `LABEL_KO` / `HINT_KO` / `GROUP_KO` / `ITEM_LABEL_KO` / `OPTION_LABEL_KO` 중 적절한 매핑에 동일 PR 안에서 한국어 등록. SoT: `spec/conventions/i18n-userguide.md §Principle 3-B` | `cd codebase/frontend && npm test -- ui-label-parity` |
| **신규 handler output field** (`output.result.*` 의 신규 키) | (a) `spec/conventions/data-hydration-surfaces.md` §1 매트릭스에 행 추가<br>(b) 표가 가리키는 모든 frontend hydration 함수 (parseHistoryMessages / threadTurnsToConversationItems / applyExecutionSnapshot 등) 에 처리 추가<br>(c) backend handler 의 모든 종결 분기 (single-turn out / multi-turn user_ended / max_turns / condition / error) 에 동일 field 동시 echo | `cd codebase/frontend && npm test -- hydration-coverage` |
| 인증·권한·세션 흐름 변경 | `codebase/frontend/src/content/docs/07-workspace-and-team/` 의 관련 페이지 + e2e | `make e2e-test` |
| **AuthConfig type enum 변경** (`api_key` / `bearer_token` / `basic_auth` / `hmac`) | (a) `spec/1-data-model.md §2.17` + §2.17.1<br>(b) `spec/2-navigation/6-config.md` Part A AUTH_TYPES<br>(c) `codebase/frontend/src/lib/i18n/dict/{ko,en}/authentication.ts` 의 type 라벨 + 폼 helper text<br>(d) `codebase/frontend/src/content/docs/06-integrations-and-config/` 의 인증 설정 안내 페이지<br>(e) DB migration (CHECK 제약) | `cd codebase/frontend && npm test -- i18n docs` |
| 표현식 언어 변경 | `codebase/frontend/src/content/docs/04-expression-language/{basics,variables-and-context,cheatsheet}.mdx` + `.en.mdx` | 수동 (registry 테스트로 frontmatter 검증) |
| 실행·디버깅 흐름 변경 | `codebase/frontend/src/content/docs/05-run-and-debug/` | 동일 |
| 환경 변수·기동 방법·런타임 변경 (제품 최종 상태) | `README.md` | 수동 |
| **spec 신규/대규모 변경** (`spec/{2,3,4,5}-**.md`, `spec/conventions/**.md`) | (a) frontmatter `code:` / `status:` / `pending_plans:` 정합 갱신<br>(b) `status: partial` 이면 `pending_plans:` 의 plan 신설<br>(c) `status: implemented` 이면 `code:` 글로브 ≥1 매치 보장. SoT: `spec/conventions/spec-impl-evidence.md` | `cd codebase/frontend && npm test -- spec-frontmatter spec-code-paths spec-pending-plan-existence` |
| **user-guide GUI 흐름 절 신규/변경** (`02-nodes/**.mdx`, `06-integrations-and-config/**.mdx` 의 GUI 안내 절) | `<ImplAnchor kind="ui-entry">` 동반 작성 — `file`/`symbol` 실존 의무. SoT: `spec/conventions/user-guide-evidence.md` | `cd codebase/frontend && npm test -- impl-anchor-existence integrations-coverage triggers-coverage` |
| spec 자체에 누락·오류가 있다고 판단됨 | `plan/in-progress/spec-update-<name>.md` 에 제안 노트 작성 후 `project-planner` 위임 | — |

### 사후 보정 PR 패턴 금지 — 같은 turn 원칙

문서·번역 갱신은 코드 변경과 **같은 PR · 같은 turn · 같은 단계 commit** 안에서 끝낸다. 별 commit/PR 로 분리되는 `fix(i18n):` · `fix(docs):` · `docs(user-guide):` 패턴은 다음 이유로 금지:

- 코드 머지와 가이드 머지 사이에 *사용자 가시 동작은 바뀌었는데 가이드는 안 바뀐 기간* 이 생긴다
- 코드 PR 의 reviewer 가 사용자 가시 영향까지 보지 못한 채 머지된다
- 사후 보정 commit 이 plan·spec 추적에서 단절된다
- git history 상 사용자 가시 변경의 정확한 commit 이 흩어진다

> developer workflow 의 **§4 DOCUMENTATION** 단계는 §5–7 (테스트 선작성·구현) **직전** 에 끝낸다. 단계 종료 후의 `fix(i18n):` · `fix(docs):` 별 commit 은 *그 시점 발견 누락의 신호* 이지 정상 워크플로가 아니다.

#### 자주 누락되는 항목 (git history 기반)

위 표 외에도 다음 항목은 사후 보정 commit 으로 반복해 잡힌 누락 패턴이다. 코드 변경 시 표 매핑과 함께 한 번 더 자가 검토:

- **i18n key parity** — dict 신규 키 `ko` / `en` 한쪽 누락. build-time 가드가 잡지만 *추가하는 같은 commit 안* 양쪽 동시 추가가 default. parity fail 로 빌드 깨고 별 commit 으로 메우는 패턴 금지
- **backend warning/error code → ko 매핑** — 백엔드가 새 warning/error 코드를 발행하면 `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 `WARNING_KO` 매핑을 같은 commit 에. 누락 시 사용자에게 영문 그대로 노출
- **노드 schema 변경 vs 가이드 본문** — dict 키만 갱신하고 `02-nodes/<cat>.mdx` 의 FieldTable 미갱신. 가이드 본문이 spec 과 어긋남
- **cross-cutting enum 값 추가 vs N개 분기 위치** (PR #269 → #270 → #271 회귀 시리즈의 공통 원인) — 새 enum 값을 한 곳에 추가하고 N개 처리 분기 (`use-execution-events` / `apply-execution-snapshot` / drawer / page.tsx / SchemaForm 의 isXxx flag) 중 일부를 빠뜨림. `assertNever` exhaustive switch + `interaction-type-exhaustiveness.test.ts` AST 가드가 동시 동작해야 차단됨. SoT: `spec/conventions/interaction-type-registry.md`
- **새 backend ui.label/hint/group 영문 노출** — backend 의 `ui.*` 값을 추가하고 frontend `backend-labels.ts` 매핑을 빠뜨림. ui-label-parity.test.ts 가드가 차단. SoT: `spec/conventions/i18n-userguide.md §Principle 3-B`
- **handler output 신규 field 가 실행 내역 surface 에서 안 보임** — backend 가 thread snapshot 에만 push 하고 `output.result.*` echo 를 빠뜨려 NodeExecution.outputData 만 읽는 실행 내역 페이지에서 누락. hydration-coverage.test.ts 가드. SoT: `spec/conventions/data-hydration-surfaces.md`
- **새 노드 추가** — `.mdx` (KO) 만 갱신 + `.en.mdx` 누락. EN 로케일이 KO 폴백으로 노출되어 사용자 신뢰 저하
- **새 섹션 디렉토리** — `<NN>-<name>/` 만 만들고 `codebase/frontend/src/lib/docs/locale.ts` 의 `SECTION_LABELS_BY_LOCALE` 양쪽 로케일 등록 누락
- **TSX 안 한국어 직접 작성** — ratchet 가드가 baseline 초과 차단하지만, *작성하는 그 순간에* dict 키 추출이 default. ratchet 가 잡은 뒤 별 commit 으로 빼는 패턴 금지
- **인증·권한·세션 흐름 변경 vs 워크스페이스 가이드 (`07-workspace-and-team/`) 미갱신** — 흐름 변경 + 가이드 갱신 + e2e 가 한 묶음
- **API 추가 vs swagger jsdoc 누락** — controller·DTO 의 swagger jsdoc 동반 필수. 빌드 단위 테스트가 일부만 잡음
- **spec frontmatter `code:` 글로브 stale** — backend 경로만 명시하고 frontend 경로 누락. 텔레그램 chat-channel UI 영구 누락 사례(2026-05-23 발견) 의 재현 패턴. `spec-code-paths.test.ts` 가드가 `partial`/`implemented` 시점에 차단. SoT: `spec/conventions/spec-impl-evidence.md`
- **`status: partial` 의 `pending_plans:` 미작성** — 미구현 surface 가 어떤 plan 에도 책임지지 않은 채 영구 누락. spec-pending-plan-existence.test.ts 가 plan 실존 강제. 본 PR 머지 전 후속 plan 신설 의무 (developer/SKILL.md §4 partial-implementation 분리)

#### DOCUMENTATION 단계 종료 사전 체크리스트

developer workflow §4 종료 직전, 5단계로 진행하기 전 자가 점검:

- [ ] 변경 set 의 각 파일에 대해 위 표의 "변경 유형" 매칭이 모두 식별됐는가? 회색 지대는 보수적으로 "갱신 필요" 로 분류
- [ ] 표가 가리키는 모든 위치를 **동일 turn 안에** 갱신했는가? 한 위치라도 별 turn 으로 미루지 않았는가
- [ ] 표의 "검증 명령" 을 실제로 실행했는가? (i18n parity / locale / backend-labels / docs registry)
- [ ] 사용자 가시면 (UI 라벨·에러 메시지·노드 카드·가이드 본문) 이 코드 변경의 의미를 정확히 반영하는가? 단순 동기화가 아닌 *의미 갱신*
- [ ] 본 turn 안에서 spec 자체에 변경이 필요한 것을 발견했으면 `plan/in-progress/spec-update-<name>.md` 작성 후 `project-planner` 위임 (developer 가 spec 직접 수정 금지)
- [ ] **partial-implementation 분리** — 본 PR 이 구현하는 spec 섹션의 *나머지 surface* 가 있다면 (Phase 분리, 후속 UI, 미구현 enum 값) `plan/in-progress/<spec-name>-followup-<surface>.md` 가 신설/갱신됐는가? 본 spec 의 frontmatter `pending_plans:` 가 해당 plan 을 가리키는가? spec `status:` 가 `partial` 로 정확히 설정됐는가? (SoT: `spec/conventions/spec-impl-evidence.md`)

> 한 항목이라도 미충족이면 §5 (테스트 선작성) 로 진행하지 말고 §4 안에서 마무리. `fix(i18n):` · `fix(docs):` commit 빈도가 워크플로 건강 지표 — 본 PR/turn 안에서 0건이 default.

### 유저 가이드 파일 컨벤션

#### SoT 문서 인덱스 (user-guide-writer 가 매 호출 적재)

`codebase/frontend/src/content/docs/**/*.{mdx,en.mdx}` 의 신규 작성·기존 갱신은 [`user-guide-writer`](.claude/agents/user-guide-writer.md) sub-agent 가 담당한다. 본 sub-agent 의 **첫 행동** 은 아래 5문서를 Read 하여 컨벤션을 컨텍스트에 적재하는 것이다. 컨벤션을 agent 정의에 inline 하지 않는 이유: 살아있는 문서로 자주 갱신되므로 agent 정의에 박으면 stale 된다.

| 문서 | 역할 |
|---|---|
| `PROJECT.md` (본 절) | SoT 문서 인덱스 + 자주 누락 패턴 + 동반 갱신 매트릭스 (§변경 유형 → 갱신 위치 매핑) |
| [`spec/2-navigation/13-user-guide.md`](spec/2-navigation/13-user-guide.md) | IA · 라우트 · 프론트매터 스키마 · 섹션 순서 · 딥링크 규약 · 공용 MDX 컴포넌트 · 품질 체크 |
| [`spec/conventions/i18n-userguide.md`](spec/conventions/i18n-userguide.md) | i18n 7 Principle (TSX 하드코딩 금지·ko/en parity·backend-labels 매핑·노드 MDX 의무·sibling 규약·글로서리·page stale) |
| [`codebase/frontend/src/content/docs/_i18n-conventions.md`](codebase/frontend/src/content/docs/_i18n-conventions.md) | 파일 구조 · 프론트매터 필드 · 내부 docs 링크 규약 · 섹션 레이블 번역 |
| [`codebase/frontend/src/content/docs/_glossary.md`](codebase/frontend/src/content/docs/_glossary.md) | 해요체 · 용어 표기 · 문장 스타일 · 금지어·지양어 |
| [`spec/conventions/spec-impl-evidence.md`](spec/conventions/spec-impl-evidence.md) | spec frontmatter (`status` 5값·`code:` 글로브·`pending_plans:`) 와 4개 build-time 가드 SoT |
| [`spec/conventions/user-guide-evidence.md`](spec/conventions/user-guide-evidence.md) | `<ImplAnchor>` MDX 컴포넌트 + 3개 reverse-coverage 가드 (`impl-anchor-existence` / `integrations-coverage` / `triggers-coverage`) SoT. `user-guide-writer` 가 GUI 흐름 절 작성 시 동반 의무 |

#### 파일 구조 요약

- 한국어 canonical: `<slug>.mdx` — frontmatter 는 여기에만
- 영어 번역: `<slug>.en.mdx` — frontmatter 없이 본문만. 없으면 EN 로케일은 KO + 안내 배너로 폴백 (의도된 동작)

#### 자주 누락되는 작성 패턴 (사후 보정 PR 회수 이력 기반)

`fix(docs):` · `docs(user-guide):` 패턴으로 사후 보정됐던 사례를 작성 시점에 차단:

- **in-app 라우트 코드스팬 미링크화** — `/profile/security`·`/integrations`·`/llm-configs`·`/knowledge-bases`·`/login` 같은 클릭 가능한 인앱 라우트가 백틱 코드스팬으로만 노출. `[서술형 텍스트](/<route>)` 로 작성. (PR #262 회수 패턴)
- **의도된 코드스팬과 라우트 링크 구분 누락** — 다음은 코드스팬으로 유지: 봇 명령(`/start`·`/cancel`·`/help`·`/newbot`), 외부 API endpoint(`/v1/chat/completions`·`/oauth/authorize`), HTTP 노드 상대경로 예시(`/users/123`), placeholder 포함 경로(`/integrations/new?service=...`)
- **외부 URL 의 bare 노출** — `https://...` 가 백틱·markdown link·autolink 어느 형태도 없이 plain text 로 노출. 반드시 `[서비스명](https://...)` 으로 wrap. 예시 URL(`https://example.com`·`https://api.example.com/...`) 은 코드스팬으로
- **Callout off-spec type** — `<Callout type="...">` 의 `type` 은 `note|tip|warn` 세 값만. `info` 같은 spec 밖 값은 런타임 fallback 발동 (commit `5d981a23` 회수 패턴). spec: `spec/2-navigation/13-user-guide.md §8`
- **KO/EN sibling 한쪽만 갱신** — `.mdx` 갱신 시 `.en.mdx` 동시 갱신 default. 한쪽 누락은 사후 보정 패턴. (단 `.en.mdx` 신규 생성 누락은 위반 아님 — `spec/conventions/i18n-userguide.md §Rationale`)
- **frontmatter `spec:` / `code:` 경로 stale** — `registry.test.ts` 가 hard fail 가드. 작성 시점에 Glob 으로 실존 검증
- **내부 `/docs/<section>/<slug>` 링크 slug 미실존** — 다른 `.mdx` 의 path 와 매치 필요. 로케일 프리픽스 없이 작성 (`mdx-components.tsx` 의 DocsLink 가 주입)
- **내부 SoT(`spec/`·`plan/`·내부 식별자·매핑 테이블) 본문 노출** — 사용자가 열람할 수 없는 `spec/<area>/...`·`/spec/...` 경로, `plan/in-progress/`·`plan/complete/` 경로, "별 plan `<name>`"·"separate plan" 표현, `CCH-XX-NN`·`R-XX-N` 같은 내부 anchor id, `ERROR_KO`·`WARNING_KO`·`LABEL_KO`·`HINT_KO`·`GROUP_KO`·`ITEM_LABEL_KO`·`OPTION_LABEL_KO` 같은 i18n 매핑 테이블 이름, `backend-labels.ts` 같은 내부 파일명을 본문에 적지 않는다. frontmatter 의 `spec:`/`code:` 필드는 빌드 검증용 metadata 라 렌더링되지 않으므로 별개 — 본문에는 같은 사실을 사용자 가시 표현으로 다시 적는다. (PR #332 회수 패턴, 가드: `no-internal-refs.test.ts`)
- **향후 진행 예정 사항 언급** — "v2 (후속)"·"v2 (planned)"·"향후 ~ 예정"·"별 plan 진입 후" 같은 로드맵성 문구를 사용자 가이드에 적지 않는다. 사용자 가이드는 **현재 동작하는 상태** 만 서술한다. 변경이 합쳐지면 그 시점에 같은 PR 에서 가이드 본문을 갱신한다. (PR #332 회수 패턴, 자동 검출 어려움 — `user-guide-writer` agent 가 작성 시점에 차단)

#### user-guide-writer 자가 검증 체크리스트 (배포 전)

`spec/2-navigation/13-user-guide.md §12` 의 6항목 + 본 절의 자주 누락 패턴을 합한 8항목 자가 점검:

- [ ] 프론트매터의 `spec:` / `code:` 경로가 실제로 존재하는가 (Glob)
- [ ] `_glossary.md §5` 금지어가 본문에 등장하지 않는가
- [ ] 내부 `/docs/<section>/<slug>` 링크의 slug 가 실존하는가
- [ ] in-app 라우트가 코드스팬 대신 링크로 작성됐는가 (의도된 코드스팬 예외 처리됨)
- [ ] 3층 구조(도입 → 상세 → 팁/참고) 가 갖춰졌는가
- [ ] 해요체로 통일됐는가 (`~합니다` / `~한다` 어미가 본문에 없는가)
- [ ] KO/EN 변경 set 의 파일 쌍 대응이 맞는가
- [ ] Callout `type` ∈ `{note, tip, warn}` 인가
- [ ] **GUI 흐름 절 (예: "1. 좌측 메뉴 → Triggers 클릭")** 에 `<ImplAnchor kind="ui-entry">` 가 동반 작성됐는가? `file`/`symbol` 이 코드에 실존하는가? (SoT: [`spec/conventions/user-guide-evidence.md`](../../spec/conventions/user-guide-evidence.md). 가드: `impl-anchor-existence.test.ts` / `integrations-coverage.test.ts` / `triggers-coverage.test.ts`)
- [ ] 본문에 내부 SoT (`spec/`·`plan/in-progress|complete/` 경로, `CCH-XX-NN`·`R-XX-N` 같은 내부 식별자, `ERROR_KO`·`backend-labels.ts` 같은 매핑 테이블·파일 이름) 가 노출되지 않는가? (가드: `no-internal-refs.test.ts`)
- [ ] "v2 (후속)"·"향후 ~ 예정"·"별 plan ..." 같은 향후 진행 예정 표현이 본문에 없는가? 현재 동작 상태 서술로 통일됐는가?

### i18n dict 파일 컨벤션

- 22 개 top-level 섹션은 각각 `dict/ko/<section>.ts` · `dict/en/<section>.ts` 한 쌍 (예: `dict/ko/editor.ts`, `dict/en/editor.ts`). 단일 거대 파일이 아닌 섹션 단위 split 으로 병렬 PR 충돌을 최소화한다
- 신규 키 추가 시 ko/en 양쪽의 같은 섹션 파일만 손댄다. 다른 섹션 파일과는 무관
- `dict/ko/index.ts` 와 `dict/en/index.ts` 는 22 섹션 composite export — 신규 섹션 추가가 아닌 한 일반적으로 손대지 않음
- 외부 import 경로는 `from ".../dict/ko"`, `from ".../dict/en"` 그대로 (Node module 해석이 index.ts 로 자동 매핑)

### 자동 가드 (build-time 차단)

위 표의 검증 명령은 가능한 한 결정적 단위 테스트로 받아둔다:

- `codebase/frontend/src/lib/i18n/__tests__/i18n.test.ts` — `ko` ↔ `en` 사전 leaf key parity 강제. 한쪽 누락 fail
- `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` — backend 발행 warning/error code 가 `WARNING_KO` / `ERROR_KO` 에 매핑됐는지 검증 (영문 SoT 가드)
- `codebase/frontend/src/lib/i18n/__tests__/hardcoded-korean-ratchet.test.ts` — TSX 안 하드코딩 한국어 카운트가 baseline 이상으로 증가하지 않도록 ratchet
- `codebase/frontend/src/lib/docs/__tests__/locale.test.ts` — 모든 (숨김 아닌) 섹션이 `SECTION_LABELS_BY_LOCALE` 양쪽 로케일 등록 검증
- `codebase/frontend/src/lib/docs/__tests__/nodes-coverage.test.ts` — backend 의 모든 노드가 `02-nodes/<cat>.mdx` 본문 안에 카드/항목으로 등장하는지 검증
- `codebase/frontend/src/lib/docs/__tests__/registry.test.ts` — MDX frontmatter 의 `spec:`/`code:` 경로 실존 검증
- `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter.test.ts` — `spec/{2,3,4,5}-**.md` + `spec/conventions/**.md` 의 frontmatter 의무 (id/status) 존재 검증. SoT: `spec/conventions/spec-impl-evidence.md §4`
- `codebase/frontend/src/lib/docs/__tests__/spec-code-paths.test.ts` — `status ∈ {partial, implemented}` spec 의 `code:` 글로브 ≥1 매치 강제
- `codebase/frontend/src/lib/docs/__tests__/spec-status-lifecycle.test.ts` — `spec-only` 90일 TTL / `partial` 의 `pending_plans:` 미작성 / pending_plans 모두 complete 인데 status 미승격 / `backlog` 의 `spec/0-overview.md §6.3` 매칭 누락 차단
- `codebase/frontend/src/lib/docs/__tests__/spec-pending-plan-existence.test.ts` — spec frontmatter `pending_plans:` path 가 `plan/in-progress/` 실존 검증 (spec → plan 역방향 링크 가드)
- `codebase/frontend/src/lib/docs/__tests__/impl-anchor-existence.test.ts` — 모든 `<ImplAnchor>` 의 `file` 실존 + `symbol` grep ≥1 매치. SoT: `spec/conventions/user-guide-evidence.md §2`
- `codebase/frontend/src/lib/docs/__tests__/integrations-coverage.test.ts` — `06-integrations-and-config/<provider>.mdx` 의 GUI 흐름 절에 `<ImplAnchor kind="ui-entry">` ≥1 의무
- `codebase/frontend/src/lib/docs/__tests__/triggers-coverage.test.ts` — `02-nodes/triggers.mdx` 의 provider 별 절에 `<ImplAnchor kind="ui-entry">` ≥1 의무
- `codebase/frontend/src/lib/docs/__tests__/no-internal-refs.test.ts` — 사용자 가이드 MDX 본문(frontmatter / HTML·MDX 주석 / `<ImplAnchor>` 제거 후)에 내부 SoT (`spec/`·`plan/in-progress|complete/`·`별 plan`/`separate plan`·`CCH-XX-NN`·`R-XX-N`·`ERROR_KO` 등 i18n 매핑 테이블·`backend-labels.ts`) 가 노출되지 않는지 검증. SoT invariant: 본 절 §자주 누락되는 작성 패턴 + [`spec/conventions/i18n-userguide.md`](spec/conventions/i18n-userguide.md) Principle 6
- `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` — `spec/**.md` 본문 in-repo 링크/heading 앵커 실존 검증 (slug = `rehype-slug`=`mdast`+`github-slugger`). SoT: `spec/conventions/spec-impl-evidence.md §4.2`
- `codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts` — 영역 폴더(≥2 sibling)의 index 가 모든 sibling spec 을 링크하는지 검증 (`spec/conventions/` flat reference 면제). SoT: `spec/conventions/spec-impl-evidence.md §4.2`
- `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` — top-level `plan/in-progress/*.md` 의 `worktree`(sentinel `(unstarted)` 허용)/`started`/`owner` frontmatter 강제. SoT: `.claude/docs/plan-lifecycle.md §4`
- `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` — `started ≥ 2026-06-04` 완료 plan 의 `spec_impact` 선언 강제 (Gate C, date-cutoff grandfather). SoT: `spec/conventions/spec-impl-evidence.md §4.2`

이들은 코드 리뷰가 검출하지 못한 누락도 빌드 단계에서 차단한다 (마이그레이션 V번호 가드와 동일 패턴). 위반의 invariant 자체는 [`spec/conventions/i18n-userguide.md`](spec/conventions/i18n-userguide.md) · [`spec/conventions/spec-impl-evidence.md`](spec/conventions/spec-impl-evidence.md) · [`spec/conventions/user-guide-evidence.md`](spec/conventions/user-guide-evidence.md) 에 정식 등록되어 있어 `convention-compliance-checker` 가 sub-agent 단에서도 점검한다.

> **매트릭스 참조 무결성 가드**: 위 표·목록이 이름으로 참조하는 `*.test.ts` 가드와 `spec/...md` 문서가 rename·삭제로 stale 되지 않았는지 [`.claude/tests/test_doc_sync_matrix.py`](.claude/tests/test_doc_sync_matrix.py) 가 검증한다 (harness-checks CI, PROJECT.md 변경 시 실행). dangling 참조 시 빌드 fail.

## e2e 테스트 작성 가이드

e2e 는 **인프라 의존성과 multi-actor 흐름** 을 보장하는 회귀 안전망이다. unit · integration 으로 이미 보호되는 단일 핸들러 로직은 침범하지 않는다.

### 언제 e2e 를 작성하는가

- 멀티 액터 · 동시성 · 트랜잭션 일관성 (race condition, 트랜잭션 격리)
- 권한 경계 (RBAC, workspace 격리, 토큰 만료)
- 실 인프라 의존 (Postgres, Redis, MinIO, Flyway 마이그레이션, BullMQ)
- 다단계 흐름 (가입 → 인증 → 로그인 → … 등 cross-endpoint 시나리오)
- 외부 인입 (webhook 수신, OAuth callback)

### 파일 위치·명명

- backend: `codebase/backend/test/<scope>.e2e-spec.ts` — `codebase/backend/test/jest-e2e.json` 의 `.e2e-spec.ts$` regex 가 자동 discovery
- frontend: `codebase/frontend/e2e/<area>/<name>.spec.ts` — `codebase/frontend/playwright.config.ts` 의 testMatch `**/*.spec.ts` 가 자동 discovery
- 신규 헬퍼: `codebase/backend/test/helpers/<name>.ts`

### Backend e2e 패턴 (supertest)

- DB 직접 접근: `helpers/db.ts` 의 `createDbClient()` / `uniqueEmail(prefix)` / `uniqueName(prefix)` 사용. 매 spec 의 `beforeAll` 에서 connect, `afterAll` 에서 `db.end()`
- 인증 setup: `helpers/auth.ts` 의 `registerAndLogin` · `createTeamWorkspace` · `inviteAndAccept` · `extractRefreshCookie` 사용으로 boilerplate 4–5 줄로 축소
- 워크스페이스 컨텍스트: 자기 워크스페이스 외 자원을 만질 땐 항상 `X-Workspace-Id` 헤더로 명시
- **응답 shape 규칙** (`TransformInterceptor` 동작):
  - 일반 객체 반환 → `body.data.<field>` (예: `body.data.executionId`)
  - `PaginatedResponseDto` (이미 `data` 키 보유) → passthrough, `body.data` 가 곧 배열
  - 에러 → `body.error.code`
- Cookie 추출: `extractRefreshCookie(res.headers['set-cookie'])`. 쿠키 이름은 `refreshToken` (snake_case 아님)

### Frontend e2e 패턴 (playwright, mock-based)

- backend 와 분리 — `page.route('**/api/...', ...)` 로 mock. 실 backend 호출은 backend e2e 가 책임
- `(main)` 레이아웃 진입 페이지는 AuthProvider 가 `/api/auth/refresh` + `/api/users/me` 를 호출하므로 함께 mock 해야 인증 통과
- 한국어/영어 i18n 둘 다 매칭: `getByText(/한글|English/i)`
- 날짜 표기: `codebase/frontend/AGENTS.md` 의 `formatDate` / `timeAgo` 컨벤션 위반 금지

### 알려진 우회 (백엔드 quirk)

- **초대 가입 사용자의 JWT 가 모든 요청에서 401**: `JwtStrategy.validate()` 가 personal workspace 존재를 강제. 초대 가입 흐름은 personal workspace 미생성 → `helpers/auth.ts` 의 `inviteAndAccept` 가 DB INSERT 로 personal workspace 를 fast-track 생성해 우회
- **invite 엔드포인트 throttle (60s 당 10건)**: 누적 invite 가 한도를 넘으면 429. 헬퍼가 3·8·20s backoff 로 3회 재시도. 그래도 부족한 케이스(suite 마지막 차례)는 DB INSERT 로 멤버십 직접 추가 (`workflow-assistant.e2e-spec.ts E` 참고)

### 금지·주의

- LLM 호출 흐름 (workflow-assistant SSE, KB embedding pipeline) — e2e 대상 아님. unit 위임
- `app.e2e-spec.ts` 무한 누적 금지 — 신규 시나리오는 영역별 파일로 분할
- `jest-e2e.json` 의 `maxWorkers: 1` 유지 — 병렬 suite 가 throttler · DB 격리에 지장
- e2e 에서 DB row 를 강제로 만들 때는 항상 unique 식별자 사용. 정리(truncation)는 ephemeral schema 가 자동 처리

## 보조 스크립트 (검증·운영)

### 문서 링크 검증

`spec/` 의 markdown 내부 링크와 `codebase/frontend/src/content/docs/**.mdx` frontmatter `spec:` 항목 정합성을 확인한다.

```bash
python3 scripts/check-doc-links.py
```

- 종료 코드: 깨진 항목이 있으면 `1`, 모두 정상이면 `0`
- 의존성 없음 (Python 3 표준 라이브러리만 사용)
- 검사 항목: 파일 경로 존재 여부, anchor (`#section`) 가 대상 파일 헤딩 슬러그에 매칭되는지, MDX `spec:` 배열의 모든 경로 존재 여부
- PR 머지 전 또는 spec 헤딩을 변경한 후 한 번씩 돌려서 cross-reference 깨짐을 잡는 용도

### 운영 스크립트 (`codebase/backend/scripts`)

NestJS 앱을 부팅하지 않고 단발성 도구만 실행하는 스크립트들. 모두 `ts-node` (devDependencies) 로 실행한다.

#### BullMQ 손상 job 정리

`document-embedding` · `graph-extraction` 큐에 누적된 손상 job (payload 에 `documentId` 가 비어있는 레거시·외부 inject) 을 1회 청소한다. 정상 producer 는 항상 DB UUID 를 채워 enqueue 하므로 false-positive 가 없다.

```bash
# 운영 환경 (컴파일된 dist 산출물, 컨테이너 안에서 실행)
docker compose exec backend npm run cleanup:queue-jobs           # dry-run — 후보만 출력
docker compose exec backend npm run cleanup:queue-jobs:apply     # --apply --pause-during-sweep

# 개발 환경 (ts-node, devDependencies 필요)
npx ts-node codebase/backend/src/scripts/cleanup-invalid-queue-jobs.ts                              # dry-run
npx ts-node codebase/backend/src/scripts/cleanup-invalid-queue-jobs.ts --apply --pause-during-sweep # apply
```

운영 절차: ① dry-run 결과 검토 (jobId / name / timestamp / payloadKeys) → ② `:apply` 실행. `--pause-during-sweep` 가 sweep 직전 `queue.pause()`, 종료 시 `queue.resume()` 을 자동 수행해 워커가 같은 페이지를 동시에 집어가는 TOCTOU 를 차단하므로 워커 인스턴스를 별도로 정지할 필요는 없다. BullMQ Queue 만 `REDIS_HOST` / `REDIS_PORT` 환경변수로 직접 인스턴스화하므로 `@Processor` 워커가 활성화되지 않고 DB 자격증명도 로드되지 않는다.

## 도메인 어휘

- **노드 카테고리**: logic / flow / ai / integration / data / presentation / trigger (총 7 카테고리, 28 종)
- **표현식 언어**: `{{ ... }}` 템플릿. tokenizer / parser / AST evaluator 는 `codebase/packages/expression-engine` SSOT. 평가 의미는 백엔드·프론트엔드 공유
- **노드 출력 컨벤션**: `spec/conventions/node-output.md` 의 11 Principle (5필드 invariant: `{config, output, meta?, port?, status?}`, config↔output 직교, meta=메트릭, 에러 컨트랙트 `port:'error'` + `output.error.{code,message,details?}` 등)
- **인프라 의존**: PostgreSQL (DB) · Redis/BullMQ (캐시·큐) · MinIO (오브젝트 스토리지) · Flyway (DB 마이그레이션) · Socket.io (실시간)
- **`spec/conventions/`**: 정식 규약 모음 — `node-output.md`, `swagger.md`, `migrations.md`, `conversation-thread.md`, `cafe24-api-metadata.md` 등
