# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

- SSOT: `.claude/config/doc-sync-matrix.json` (`rows[]` 20개 행, glob 8 / semantic 12) Read 완료.
- 보조: `PROJECT.md` §변경 유형 → 갱신 위치 매핑 표 + §자주 누락되는 항목 Read 완료.
- 변경 file 목록: prompt 내 17개 리뷰 대상 파일 + `git diff origin/main...HEAD --name-only` 로 보강한 전체 changeset(backend `modules/{triggers,schedules,hooks}`, `repo-guards/__tests__/**`, `CHANGELOG.md`, `plan/in-progress/trigger-config-lost-update.md`, `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts`, 다수 `review/**` 산출물).

## 변경 성격 판단

`plan/in-progress/trigger-config-lost-update.md` frontmatter: `spec_impact: none`. 본문 확인 결과 이 PR 은 트리거 `config` 동시 PATCH lost-update(인입 웹훅 서명 ref 유실 → fail-open) 를 닫는 **순수 concurrency 버그 수정**이다 — advisory lock 도입(`trigger-config-lock.ts`), `save(entity)` → 컬럼 한정 `update()`/락 안 재작성 전환(`triggers.service.ts`, `schedules.service.ts`, `hooks.service.ts`, `chat-channel-binder.service.ts`), 정적 AST 가드 갱신(`repo-guards/__tests__/**`), 회귀 unit/e2e 추가. 사용자에게 노출되는 신규 필드·라벨·에러코드·provider·섹션·표현식 문법은 없다.

## 매트릭스 trigger 매칭 점검 (20행 전수 확인)

| trigger id | 매칭 여부 | 근거 |
|---|---|---|
| new-node / node-schema-change | 불일치 | `codebase/backend/src/nodes/**` 변경 없음 |
| new-ui-string / new-widget-chrome-string | 불일치 | frontend `.tsx` / `channel-web-chat/**` 변경 없음 (변경 set 전체가 backend + repo-guards + docs) |
| integration-provider-change | 불일치(gray-zone 검토됨) | `chat-channel-binder.service.ts`/`chat-channel-input-rules.ts` 가 Slack/Discord chat-channel 코드를 건드리지만, provider 신설·config 스키마·setup UX 변경이 아니라 **내부 lost-update 수정**뿐. `grep -rl "inboundSigningRef\|chatChannel\|lastTriggeredAt" codebase/frontend/src/content/docs` 결과 어떤 유저 가이드 MDX 도 이 내부 필드 갱신 시맨틱을 서술하지 않음 → 갱신 대상 문장 자체가 없다 |
| new-userguide-section-dir | 불일치 | `content/docs/*/` 신규 디렉토리 없음 |
| backend-api-change | 불일치 | `*.controller.ts` / `dto/**` 변경 없음 |
| new-bullmq-queue | 불일치 | `system-status.constants.ts` 변경 없음, 신규 큐 없음 |
| new-warning-code / new-error-code | 불일치 | `error-codes.ts` 미변경. `triggers.service.ts`/`chat-channel-input-rules.ts` 는 기존 `ErrorCode.INVALID_FIELD` 를 재사용할 뿐 enum 추가 없음 (grep 확인) |
| new-cross-cutting-enum / new-backend-ui-zod-value / new-handler-output-field | 불일치 | 해당 표면 변경 없음 |
| auth-session-flow-change | 불일치 | `codebase/backend/src/modules/auth/**` 미변경. 이 PR 의 "서명 검증 fail-open" 은 웹훅 인입 서명(HMAC ref) 문제로 workspace/team 세션·권한 모델과 무관 |
| auth-config-type-enum-change / expression-language-change / run-debug-flow-change / env-runtime-change | 불일치 | 각각 대상 경로/의미 변경 없음 |
| spec-major-change | 불일치 | `spec/**` 변경 없음 (spec_impact: none) |
| userguide-gui-flow-section | 불일치 | `02-nodes/**.mdx` / `06-integrations-and-config/**.mdx` 변경 없음 |
| spec-defect-found | 불일치 | 해당 판단 없음 |

## 발견사항

없음 — 매칭되는 trigger 가 없어 동반 갱신 누락도 없음.

## 요약

매트릭스 20행 전수 대조 결과 이번 changeset(트리거 `config` 동시 PATCH lost-update 수정 — advisory lock 도입, `save`→컬럼 한정 `update` 전환, AST 가드·unit/e2e 보강)은 어떤 trigger 에도 매칭되지 않는다. 신규 노드·UI 문자열·provider·문서 섹션·warning/error 코드·auth 흐름·표현식 문법 변경이 전혀 없는 순수 backend 동시성 버그 수정(`spec_impact: none`)이며, `CHANGELOG.md` 는 이미 같은 커밋들 안에서 갱신됐다. 유저 가이드 MDX 는 이 내부 필드(`inboundSigningRef`/`lastTriggeredAt`)의 재작성 시맨틱을 서술하지 않으므로 갱신할 대상 문장 자체가 없음을 확인했다.

## 위험도

NONE
