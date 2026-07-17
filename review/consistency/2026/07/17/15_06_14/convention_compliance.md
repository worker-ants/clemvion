# 정식 규약 준수 검토 — `plan/in-progress/is-conversation-output-restructure.md`

검토 대상: `@workflow/node-output-contract` 신설 draft (Phase 2, E-1~E-5).
검토 방법: `spec/conventions/**` + 실제 저장소 파일(4개 기존 shared 패키지, `pnpm-workspace.yaml`,
`codebase/{backend,frontend}/package.json`, 3개 Dockerfile, `docker-compose.e2e.yml`,
`.github/workflows/*.yml`, `PROJECT.md`, `.claude/config/doc-sync-matrix.json`)을 직접 대조.

## 발견사항

### [WARNING] `packages-checks.yml` CI 매트릭스가 4개 패키지를 하드코딩 — 신규 패키지 lint/test/build 가 CI 에서 실행되지 않음

- **target 위치**: Phase 2 E-2 "`@workflow/node-output-contract` 패키지 신설" §배선, E-5 "빌드 검증"
- **위반 규약**: 명문화된 `spec/conventions/*` 조항은 없으나, `.github/workflows/packages-checks.yml` 이 기존 4개 shared 패키지(`expression-engine`/`graph-warning-rules`/`node-summary`/`chat-channel-validation`)에 대해 사실상 정식 규약 수준으로 유지되는 CI 게이트(lint→jest→tsc build)이며, 프롬프트 점검 관점 (b) "패키지 신설이 건드려야 하는 배선 전수"의 핵심 대상.
- **상세**: 실측 결과 `packages-checks.yml` 은 `on.pull_request.paths` / `on.push.paths` (각각)와 `jobs.packages.strategy.matrix.pkg` 에 4개 패키지명·경로를 **개별 문자열**로 나열한다 (`codebase/packages/*/**` 같은 wildcard 가 아님). `@workflow/node-output-contract` 를 추가하면:
  - `pnpm-lock.yaml` 이 `paths` 목록에 포함돼 있어 workflow 자체는 트리거된다.
  - 그러나 `matrix.pkg` 에 새 패키지명이 없으므로 **그 패키지의 독립 lint/jest test/tsc build job 이 CI 에서 전혀 실행되지 않는다** — 실패가 아니라 조용한 미실행(silent skip)이다.
  - 완화 요인: 각 패키지의 `package.json` 은 `"prepare": "[ -d dist ] || tsc"` 이고 `dist/` 는 `.gitignore` 대상이므로, backend/frontend 가 `pnpm install` 할 때 항상 `tsc` 가 재실행된다. 즉 draft 가 설계한 컴파일타임 drift 트랩(`satisfies`/`Exclude` 이중 잠금)은 packages-checks.yml 등록 여부와 무관하게 CI 어디선가(backend/frontend build) 발동한다 — **핵심 invariant 자체는 깨지지 않는다**. 다만 패키지 자체의 jest 단위테스트(`CONVERSATION_END_REASONS` 값 검증 등)와 독립 `eslint` 는 CI 커버리지가 사라진다.
- **제안**: E-2 또는 E-5 에 `.github/workflows/packages-checks.yml` 의 `paths`(pull_request/push 2곳) + `matrix.pkg`(1곳)에 `@workflow/node-output-contract` / `codebase/packages/node-output-contract/**` 추가를 명시적 task 항목으로 포함.

### [WARNING] E-5 가 Docker 배선 3파일 + compose 1파일의 필요 편집을 "확인"으로만 서술

- **target 위치**: Phase 2 E-5 4번째 항목 "기존 4개 패키지가 Docker 에 어떻게 들어가는지 먼저 확인 (Dockerfile 의 packages 복사 단계)"
- **위반 규약**: 명문화된 conventions 조항은 없음(구현 완결성 이슈) — 프롬프트 점검 관점 (b) 대상.
- **상세**: 실측 결과 신규 패키지가 배선상 건드려야 하는 곳은 최소 **4개 파일**이다.
  1. `codebase/backend/Dockerfile` — manifest COPY 1줄(`COPY codebase/packages/node-output-contract/package.json ...`) + source COPY 1줄. 파일 자체 주석: *"신규 backend 의존 내부 패키지 추가 시 여기에 COPY 를 보충 — 누락 시 build 스테이지 docker 검증이 포착"* — 즉 Docker `--frozen-lockfile` 설치 실패로 **뒤늦게** 드러난다(자기 진단적이나 draft 에 명시 task 로는 없음).
  2. `codebase/frontend/Dockerfile` — manifest COPY 1줄만 필요(소스는 `COPY codebase/packages ./codebase/packages` 로 일괄 복사되므로 자동 포함).
  3. `codebase/frontend/Dockerfile.playwright-e2e` — manifest+source COPY 각 1줄.
  4. `docker-compose.e2e.yml` — `playwright-runner` 서비스의 `volumes` 아래 `- /app/codebase/packages/node-output-contract/node_modules` 마스킹 1줄.
  - 3·4 는 `scripts/check-e2e-playwright-config.py`(CI job `config-guard`, `.github/workflows/e2e.yml`)가 frontend `@workflow/*` 클로저 ↔ Dockerfile COPY ↔ compose 마스킹 3자 집합 일치를 **build-time 에 강제**하므로 누락 시 fail-fast (self-enforcing). 1·2 는 Docker 빌드 실패로만 드러난다(E-5 step3 "Docker 빌드가 authoritative" 로 원리적으로는 커버되나, "확인"이라는 표현이 수동적이라 실제 4개 파일 개별 편집이 누락될 위험이 있다).
- **제안**: E-5 를 "Docker 에 어떻게 들어가는지 확인" 대신 "3개 Dockerfile + `docker-compose.e2e.yml` 마스킹 목록에 `node-output-contract` COPY/mask 라인 추가(4곳)" 로 구체적 편집 task 로 명문화. `check-e2e-playwright-config.py` 존재도 각주로 언급하면 회귀 검증 근거가 명확해진다.

### [WARNING] PROJECT.md "신규 cross-cutting enum 값 추가" 갱신 매트릭스와의 관계 미정리

- **target 위치**: 전체 draft — "설계 — 목록을 없애지 말고, 어긋나면 깨지게 한다" ~ "화이트리스트를 패키지가 소유한다" 섹션, Phase 1
- **위반 규약**: `PROJECT.md §변경 유형 → 갱신 위치 매핑`(row: **신규 cross-cutting enum 값 추가** `WaitingInteractionType` / `ConversationTurnSource` / `PresentationType` **등**) + 컴패니언 `.claude/config/doc-sync-matrix.json`(`id: "new-cross-cutting-enum"`, `match: "semantic"`) + `spec/conventions/interaction-type-registry.md`
- **상세**: PROJECT.md 매트릭스는 "신규 cross-cutting enum 값 추가" 트리거의 필수 갱신 위치로 (a) `interaction-type-registry.md` 매트릭스 행 추가 (b) 코드 분기 동시 갱신(`assertNever` 패턴) (c) AST 가드(`interaction-type-exhaustiveness.test.ts`) 통과를 지정한다. `endReason`(`AiAgentEndReason`/`InformationExtractorEndReason`/`ConversationEndReason`) 은 실질적으로 동일한 "cross-cutting enum" 범주이며, draft 의 E-1 은 바로 그 AST 가드 파일(`interaction-type-exhaustiveness.test.ts`)을 수정 대상으로 삼는다. 그런데 draft 는 endReason 도메인을 **다른 메커니즘**(matrix+AST-grep 대신 공유 패키지 `satisfies`/`Exclude` compile-time 이중 잠금)으로 처리하기로 결정했음에도, `PROJECT.md` 표나 `interaction-type-registry.md` 어디에도 이 신규 메커니즘을 등록하거나 "endReason 계열은 본 컨벤션 범위 밖 — `@workflow/node-output-contract` 가 대신 강제한다" 는 명시적 cross-reference 를 남기지 않는다. `doc-sync-matrix.json` 의 해당 row 는 `match: "semantic"`(glob 없음)이라 `user-guide-sync-reviewer` 가 의미 기반으로 매칭하는데, 이 상태로는 (i) 향후 리뷰어가 "매트릭스 미갱신"으로 오탐하거나 (ii) 반대로 담당자가 endReason 에 어떤 메커니즘이 SoT 인지 혼동할 여지가 있다.
- **제안**: Phase 1(spec) 에 `interaction-type-registry.md` 에 "endReason 계열(`ConversationEndReason` 등)은 본 문서의 matrix+AST-grep 대신 `@workflow/node-output-contract` 패키지가 compile-time 으로 강제한다 — 본 컨벤션 매트릭스 등록 대상 아님" 같은 명시적 각주를 추가하거나, `PROJECT.md` 매트릭스에 별도 row("신규 endReason 값 추가")를 신설.

### [WARNING] endReason 도메인의 영구 spec 귀속처 부재 — 설계 결정이 plan 파일에만 존재

- **target 위치**: 전체 draft, 특히 "유니온 분기 — 통합할 필요가 없다" · "화이트리스트를 패키지가 소유한다" · "결정 기록" 섹션
- **위반 규약**: CLAUDE.md "정보 저장 위치" 표 — *"기술 명세 → `spec/<영역>/*.md` 본문"*, *"결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"*
- **상세**: 기존 4개 shared 패키지는 모두 `spec/` 안에 영구 서술처를 갖는다 — `graph-warning-rules` ↔ `spec/conventions/cross-node-warning-rules.md`(패키지 존재 이유·설계 rationale·기각 대안까지 전개), `chat-channel-validation` ↔ `spec/4-nodes/7-trigger/providers/{slack,discord}.md §6`, `expression-engine` ↔ `spec/5-system/5-expression-language.md`. 반면 본 draft 의 Phase 1 은 `conversation-thread.md §9.10`(회귀 시나리오 표, 신규 CT-S21) 갱신만 명시하며, 이는 `isConversationOutput` UI 동작의 회귀 테스트 시나리오이지 **패키지 자체의 계약**(어떤 타입을 담는지, `AiAgentEndReason`/`InformationExtractorEndReason`/`ConversationEndReason`/`SingleTurnEndReason` 관계, "파생 유니온 — 합칠 필요 없음" 설계 결정, "⊇ 방향 강제 무해성" rationale)을 서술할 spec 문서가 아니다. 현재 이 내용은 `plan/in-progress/is-conversation-output-restructure.md` 에만 존재하며, plan 은 완료 후 `plan/complete/`(라이프사이클상 이력 보관 성격)로 이동한다 — CLAUDE.md 원칙상 plan 은 "결정의 배경·근거"의 영구 SoT 위치가 아니다.
- **제안**: Phase 1 에 `spec/conventions/node-output.md`(이미 endReason 과 인접한 `port` 예약어·Principle 6 를 다룸) 확장, 또는 신규 `spec/conventions/node-output-contract.md` 작성을 정식 phase 항목으로 추가. 패키지 README·JSDoc 에서도 그 spec 문서를 SoT 로 cross-link.

### [INFO] 패키지명과 기존 `spec/conventions/node-output.md` 의 주제 근접성

- **target 위치**: E-2 "`@workflow/node-output-contract` 패키지 신설"
- **위반 규약**: 없음. §점검(c) 명명 규약 자체는 **정합** — `@workflow/<domain>-<noun>` kebab-case 패턴(`graph-warning-rules`/`node-summary`/`expression-engine`/`chat-channel-validation`)과 일치하며, 타입명 `AiAgentEndReason`(`AiAgentHandler` 기존 casing과 일치) 등도 PascalCase 관례에 부합.
- **상세**: `node-output-contract` 는 기존 `spec/conventions/node-output.md`("Output 변수 일관성 규칙" — `NodeHandlerOutput` 5필드, `port` 예약어 등 이미 규정)와 이름이 겹쳐, 두 "SoT" 성격 문서/패키지의 경계가 불명확해질 소지가 있다.
- **제안**: 위 F4 의 spec 귀속처 결정 시 `node-output.md`(원칙) ↔ `node-output-contract` 패키지(endReason 값의 구현 SoT)의 경계를 한 문장으로 명문화.

## 정합성 확인 (위반 아님 — 참고용 positive 확인)

- **패키지 템플릿 정합**: `graph-warning-rules`/`node-summary`/`expression-engine`/`chat-channel-validation` 4개 모두 `package.json`(jest·`main`/`types`→`dist/`·`build`/`prepare`/`test`/`lint` 스크립트·`engines.node>=24`)·`tsconfig.json`(ES2020/commonjs/strict)·`eslint.config.mjs`(flat config, 헤더 주석만 다름)·`README.md` 구성이 사실상 동일 템플릿이다. draft 가 `graph-warning-rules` 를 템플릿으로 명시한 것은 정합.
- **테스트 러너**: `PROJECT.md` "테스트 프레임워크 이원화" 정책(`backend·내부 packages = jest`)과 일치 — draft 가 jest 를 그대로 채택.
- **워크스페이스 등록**: `pnpm-workspace.yaml` 이 이미 `codebase/packages/*` wildcard 를 포함한다는 draft 의 claim 은 실측과 일치(추가 편집 불필요).
- **backend/frontend 의존 선언**: 기존 4개 패키지가 모두 `codebase/{backend,frontend}/package.json` 에 `"@workflow/<pkg>": "workspace:*"` 로 선언돼 있음을 확인 — draft 의 "기존 4개와 동일 형태" claim 정합.

## 요약

draft 는 명명(kebab-case 패키지명·PascalCase 타입명)과 패키지 내부 템플릿(jest/tsconfig/eslint/README) 구성에서 기존 4개 shared 패키지의 관례를 정확히 따르고 있으며, `pnpm-workspace.yaml`·`workspace:*` 의존 선언 등 1차 배선 claim 도 실측과 일치한다. 다만 "패키지 신설이 건드려야 하는 배선 전수" 관점에서 두 가지 구체적 누락이 확인된다 — (1) `.github/workflows/packages-checks.yml` 의 하드코딩된 4-패키지 matrix/paths 갱신이 계획에 없어 신규 패키지의 CI lint/jest 커버리지가 조용히 빠질 수 있고(핵심 compile-time drift 트랩 자체는 `prepare` 스크립트로 별도 보호됨), (2) 3개 Dockerfile + `docker-compose.e2e.yml` 마스킹 편집이 "확인"이라는 수동적 서술에 머물러 실제 필요한 개별 파일 편집으로 구체화돼 있지 않다(2곳은 `check-e2e-playwright-config.py` 가드로 self-enforcing, 2곳은 아님). 아울러 거버넌스 관점에서 (3) `PROJECT.md`·`interaction-type-registry.md` 가 이미 규정한 "cross-cutting enum 값 추가" 갱신 매트릭스와 이번 endReason 컨솔리데이션(다른 메커니즘 채택)의 관계가 문서화되지 않았고, (4) 기존 4개 패키지 전부가 갖는 "spec/ 안의 영구 계약 서술처"가 이번 패키지에는 지정돼 있지 않아 설계 rationale 이 plan 파일에만 고립될 위험이 있다. 네 건 모두 CRITICAL 급 규약 직접 위반은 아니며(핵심 drift-방지 invariant 는 여러 겹의 self-enforcing 가드로 보호됨), 구현 착수 전 Phase 1/Phase 2 task 목록 보강으로 해소 가능한 WARNING 수준이다.

## 위험도

MEDIUM
