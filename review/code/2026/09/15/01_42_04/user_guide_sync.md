# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (rows 21개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (동일 21행, 사후 보정 PR 패턴 금지 절 포함) 을 SSOT 로 적재해 검토했다.

## 변경 셋 식별

이 리뷰의 대상 changeset 은 orchestrator 가 payload 에 포함한 20개 파일 목록과 일치하며, `git diff <merge-base>..HEAD -- codebase/ codebase/frontend/ codebase/packages/` 로 전수 대조한 결과 코드 변경분은 다음 16개 파일에 **전부 국한**된다 (frontend/packages 변경 0건):

- `codebase/backend/src/modules/hooks/{hooks.service.ts,hooks.service.spec.ts}`
- `codebase/backend/src/modules/schedules/{schedules.service.ts,schedules.service.spec.ts}`
- `codebase/backend/src/modules/triggers/{triggers.service.ts,triggers.service.spec.ts,triggers.web-chat.spec.ts,chat-channel-binder.service.ts,chat-channel-input-rules.ts,chat-channel-input-rules.spec.ts,trigger-config-lock.ts,trigger-config-lock.spec.ts,__test-utils__/trigger-transaction-mock.ts}`
- `codebase/backend/src/repo-guards/__tests__/{endpoint-path-conflict-wrap-guard.ts,endpoint-path-conflict-wrap.spec.ts,fixtures/endpoint-path-save.fixture.ts}`
- `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts`

그 외 `CHANGELOG.md`, `plan/in-progress/trigger-config-lost-update.md`, `review/code/2026/09/14/18_17_44/SUMMARY.md` 는 각각 변경 로그·plan 트래커·이전 리뷰 산출물이며 매트릭스 대상 산출물(docs MDX / dict / backend-labels / locale.ts)이 아니다.

## trigger 매칭 검토

변경 내용은 트리거의 `config` 컬럼에 대한 **동시 PATCH 시 lost-update(잃어버린 갱신) 경합**을 advisory lock + 컬럼 한정 `update()` 로 닫는 백엔드 내부 동시성/영속성 정합성 수정이다. 매트릭스 21행을 전수 대조한 결과 아래 이유로 **어느 trigger 에도 매칭되지 않는다**:

- **새 노드/노드 schema 변경** — `codebase/backend/src/nodes/**` 글롭에 해당하는 파일 없음 (변경은 `modules/hooks|schedules|triggers`, 노드 디렉터리 아님)
- **신규 UI 문자열 / 위젯 chrome 문자열** — `*.tsx` 변경 0건 (frontend/channel-web-chat 변경 자체가 없음)
- **통합/제공자 변경** — diff 내 `slack`/`telegram`/`cafe24` 등 provider 식별자는 전부 **기존** 테스트 fixture 값을 그대로 재사용한 것이며 (`grep` 전수 확인), 신규 provider 추가나 provider 설정 절차·필드 변경은 없음. 사용자가 provider 설정 시 밟는 절차는 이 변경으로 달라지지 않는다
- **신규 섹션 디렉토리 / 백엔드 API 변경** — `content/docs/**` 신규 디렉터리 없음, `*.controller.ts`/`dto/**` 변경 0건 (grep 확인)
- **신규 warningCode/errorCode 발행** — `WarningCode`/`ErrorCode`/`warningRules`/`WARNING_KO`/`ERROR_KO` 토큰이 diff 전체(3145줄)에서 **0건** (grep 확인). 새로 발행되는 코드 없음
- **인증·권한·세션 흐름 변경** — trigger glob 은 `codebase/backend/src/modules/auth/**` 이며 해당 경로 변경 없음. 의미적으로도 이번 변경은 **워크스페이스/팀 멤버 로그인·세션**이 아니라 채팅 채널(Slack/Telegram 등) **인입 웹훅 서명 검증**(`chatChannel.inboundSigningRef`) 의 유실 방지다 — 매트릭스 target 인 `07-workspace-and-team/` 문서·사용자 플로우와는 다른 층이라 매칭 대상이 아니라고 판단했다 (그레이존으로 고려했으나 기각)
- **AuthConfig type enum / 표현식 언어 / 실행·디버깅 흐름 / cross-cutting enum / handler output field / zod ui.label** — 해당 파일·패턴 변경 없음
- **spec 신규/대규모 변경** — `spec/**` 변경 0건 (plan 파일만 변경)

## 발견사항

없음 — 해당 변경 set 에 매칭되는 매트릭스 trigger 가 없어 유저 가이드/i18n dict/backend-labels 동반 갱신 대상 자체가 발생하지 않는다.

## 요약

매트릭스 21개 trigger 를 전수 대조했으나 이번 changeset(트리거 `config` lost-update 방지를 위한 advisory lock + 컬럼 한정 update 리팩터링, 관련 정적 가드·테스트 보강)은 backend `modules/hooks|schedules|triggers` + `repo-guards` 내부에만 국한된 동시성/영속성 정합성 수정으로, frontend docs MDX·i18n dict·backend-labels.ts·locale.ts 어느 것도 사용자 가시 표면을 바꾸지 않는다. 매칭 0건, 누락 0건 — 유저 가이드 동반 갱신 관점에서는 해당 없음.

## 위험도

NONE
