# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

- SSOT: `.claude/config/doc-sync-matrix.json` (`rows[]`, 20개 trigger) Read 완료.
- 보조: `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (155~239행) Read 완료 — trigger 목록·"자주 누락" 패턴·같은 turn 원칙 확인.

## 변경 파일 컨텍스트

이번 changeset(`codebase/**` 대상)은 실제로 다음 2개 파일뿐이다 (나머지 "파일 3~26" 은 `plan/**`·`review/**` 산출물로 매트릭스 trigger 대상이 아님):

1. `codebase/backend/README.md` — §"워크스페이스 reflection 캐너리" 문단 수정. `@WorkspaceId()` 뿐 아니라 `@WorkspaceParam(...)` 소비도 캐너리가 합산해서 센다는 사실을 반영하도록 서술을 정정(판별별 불릿 분리, 부팅 로그 문구 정정).
2. `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — `transferOwnership` 트랜잭션 안 재검사 분기(무락 선행 owner 통과 → 락 재검사에서 강등/멤버십 소멸)를 `it.each` 로 고정하는 unit 테스트 추가.

`git diff --name-only HEAD` / `git status --short` 로 확인한 실제 워킹트리 상태는 이미 커밋 완료(`47dfdb3c3` 등)이며 미커밋 변경은 없다(`review/code/2026/09/25/20_47_04/` untracked 뿐).

동반 plan 파일(`plan/in-progress/canary-readme-recheck-test.md`)이 명시적으로 밝힌 범위: **"동작 변경 없음 — 운영자 문서 정정과 테스트 보강"**, `spec_impact: none`. `#1399` 에서 이미 배포된 `@WorkspaceParam` 인식 로직을 뒤늦게 README 서술에 반영하고, 이미 존재하던 `transferOwnership` 재검사 분기(동시 강등 경합)에 테스트 커버리지만 추가한 것 — 신규 기능·신규 API·신규 UI 문자열·신규 필드 없음.

## trigger 매칭 검토

- **new-node / node-schema-change** — `codebase/backend/src/nodes/**` 변경 없음 → 불일치
- **new-ui-string / new-widget-chrome-string** — `*.tsx` 변경 없음 → 불일치
- **integration-provider-change** — provider 변경 없음 → 불일치
- **new-userguide-section-dir** — `content/docs/*/` 신규 디렉토리 없음 → 불일치
- **backend-api-change** — `*.controller.ts`/`dto/**` 변경 없음 → 불일치
- **new-bullmq-queue / new-warning-code / new-error-code / new-cross-cutting-enum / new-backend-ui-zod-value / new-handler-output-field** — 해당 소스 변경 없음 → 불일치
- **auth-session-flow-change** (trigger glob `codebase/backend/src/modules/auth/**`, match semantic) — 변경된 `workspaces.service.spec.ts` 는 `modules/auth/**` 가 아니라 `modules/workspaces/**` 이고, 실제 서비스 로직(`workspaces.service.ts`) 자체는 이번 변경 set 에 없음(테스트 파일만 수정). plan 문서가 "동작 변경 없음" 을 명시적으로 확인했고, 대상 재검사 분기(`OWNER_REQUIRED`)는 `#1399` 이전부터 이미 구현·배포된 기존 동작이다. 따라서 이 행이 요구하는 "흐름 **변경**" 이 성립하지 않는다 — 기존 동작을 **재확인하는 테스트**를 추가한 것으로, `07-workspace-and-team/` 갱신 대상 아님
- **auth-config-type-enum-change / expression-language-change / run-debug-flow-change** — 해당 없음
- **env-runtime-change** (target: `README.md`) — 이번 changeset 자체가 이 행이 요구하는 갱신 행위다: 기동 시 캐너리 판별 로직(런타임 동작 서술)이 README 서술과 어긋나 있던 것을 바로잡았다. 다만 이 캐너리 로직 자체의 변경은 `#1399`(과거 커밋)에서 이미 있었고 이번 PR 은 그 서술을 사후 정정하는 것 — plan 이 이를 `spec-draft-nullable-notation-followups.md` 트래커에서 파생된 후속 작업으로 명시. 갭 아님(오히려 갭을 메우는 작업)
- **spec-major-change / userguide-gui-flow-section / spec-defect-found** — `spec/**`, `docs/02-nodes/**`, `docs/06-integrations-and-config/**` 변경 없음 → 불일치

## 발견사항

없음. 매칭되는 trigger 중 동반 갱신이 누락된 사례를 찾지 못했다.

## 요약

매트릭스 20개 trigger 를 전수 대조한 결과, 이번 changeset(`codebase/backend/README.md` 서술 정정 + `workspaces.service.spec.ts` unit 테스트 추가, 둘 다 plan 상 "동작 변경 없음"·`spec_impact: none` 으로 명시)에 해당하는 trigger 는 사실상 없다. `auth-session-flow-change` 는 경로(`modules/auth/**` 아닌 `modules/workspaces/**`)와 내용(신규 흐름이 아닌 기존 동작의 테스트 보강) 양쪽에서 불일치하며, `env-runtime-change` 는 오히려 이번 changeset 자체가 README 를 실제 런타임과 맞추는 정정 행위라 갭이 아니다. 나머지 노드/i18n/docs 관련 trigger 는 대응하는 소스 변경이 전혀 없다. 유저 가이드 동반 갱신 관점에서 "해당 없음".

## 위험도

NONE
