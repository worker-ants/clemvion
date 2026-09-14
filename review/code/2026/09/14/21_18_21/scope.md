# 변경 범위(Scope) 리뷰 — trigger-config-lost-update

## 검토 방법

`git diff --stat origin/main...HEAD` 로 전체 changeset(110개 파일, `+10927/-82`)을 실측하고,
`plan/`·`review/` 를 제외한 순수 코드 파일 16개를 전수 열거해 각각의 diff 를 직접
(`git diff origin/main...HEAD -- <path>`) 읽었다:

- `CHANGELOG.md`
- `codebase/backend/src/modules/hooks/hooks.service.ts`, `hooks.service.spec.ts`
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts`, `.spec.ts`
- `codebase/backend/src/modules/triggers/trigger-config-lock.ts`, `.spec.ts` (신규)
- `codebase/backend/src/modules/triggers/triggers.service.ts`, `.spec.ts`, `triggers.web-chat.spec.ts`
- `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` (신규)
- `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`, `.spec.ts`, `fixtures/endpoint-path-save.fixture.ts`
- `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts` (신규)

나머지 94개 파일은 `plan/in-progress/trigger-config-lost-update.md` 1개와
`review/code/2026/09/14/{18_17_44,19_07_43,19_44_08,20_17_16,20_49_15}/**` +
`review/consistency/2026/09/14/17_10_16/**` 산출물이다. `package.json`/lockfile,
`codebase/frontend/**`, `codebase/channel-web-chat/**`, `spec/**` 변경은 **0건**임을
`git diff --name-only origin/main...HEAD` 전수 목록으로 확인했다.

## 발견사항

- **[INFO]** 코드 변경 16개 파일 전부가 하나의 근본 원인(동시 쓰기가 `trigger.config` 를 in-memory 스냅샷으로 통째 재구성해 `chatChannel.inboundSigningRef` 를 되돌리는 lost-update)으로 귀결된다 — 범위 이탈 없음
  - 위치(대표): `codebase/backend/src/modules/triggers/trigger-config-lock.ts` 전체(신규 유틸), `triggers.service.ts:356`(`assertTriggerFound`)·`:489`(`findByIdForUpdate`)·`:544`(`extractInboundSigningRef` 호출)·`:625`·`:1243`, `chat-channel-binder.service.ts:195`~`306`(락 배선), `hooks.service.ts:227`,`686`,`978`(`touchLastTriggeredAt`)
  - 상세: `HooksService` 의 웹훅 hot path 수정(`touchLastTriggeredAt` 추출)은 얼핏 다른 모듈로 보이지만, `save(trigger)` 가 요청 시작 시점 `config` 를 함께 실어 같은 클래스의 fail-open 을 인입 메시지마다 재현하던 자리라 CHANGELOG(`## Unreleased`)·plan 문서가 "웹훅 인입 경로도 함께 고쳤다" 로 명시적으로 스코프에 편입한 대상이다. `endpoint-path-conflict-wrap-guard.ts`/`fixture.ts`/`.spec.ts` 확장도 무관한 손질이 아니라, 이 PR 이 `update()` 의 `save(trigger)` 를 `manager.transaction(async (m) => m.save(Trigger, target))` 형태로 옮기면서 기존 정적 가드가 그 형태를 놓쳐 "래핑이 남몰래 사라졌다" 는 오탐(fail-safe false positive)을 냈기 때문에 불가피하게 뒤따른 수정이다(주석에 근거 실측 명시). `trigger-transaction-mock.ts` 신규 파일도 이 PR 이 `manager.transaction` 을 도입하면서 기존 mock 이 깨진 6개 spec 파일 중 실제로 그 경로를 타는 2개를 고치기 위한 필연적 테스트 인프라다.
  - 제안: 없음 — 정보 제공 목적.

- **[INFO]** `assertTriggerFound`/`findByIdForUpdate` 추출은 소규모 DRY 리팩토링이지만 이 PR 의 새 호출 지점(삭제 경합 404, `rotateBotToken` 삭제 경합 404, `update()` 락 안 재조회 null 가드)이 직접 요구한 것이라 범위 내
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:356`(`assertTriggerFound`), `:489`(`findByIdForUpdate`)
  - 상세: 이 PR 이전엔 `RESOURCE_NOT_FOUND` throw 가 `findById` 한 곳뿐이었는데, 이번 수정이 락 재읽기 이후 null 가드(`:625`, `:1243`)와 삭제 경합 404 를 새로 추가하면서 같은 리터럴이 네 곳으로 늘어날 뻔한 것을 미리 한 헬퍼로 묶었다(주석에 근거 명시: `/ai-review 20_49_15 maintainability WARNING#5`). 이번 작업과 무관한 기존 코드를 정리한 것이 아니라, 이번 작업이 만든 신규 중복을 그 자리에서 막은 것이다.
  - 제안: 없음.

- **[INFO]** `plan/`·`review/code/**`(5라운드)·`review/consistency/**` 산출물이 코드 변경과 같은 changeset 에 포함
  - 위치: `plan/in-progress/trigger-config-lost-update.md`, `review/code/2026/09/14/{18_17_44,19_07_43,19_44_08,20_17_16,20_49_15}/**`, `review/consistency/2026/09/14/17_10_16/**`
  - 상세: 이 저장소의 `developer` 워크플로 규약(`CLAUDE.md`)은 구현 착수 직전 `consistency-check --impl-prep`, 구현 완료 직후 `/ai-review` + Critical/Warning fix 를 상시 승인된 강제 절차로 규정한다. 다섯 라운드가 존재하는 것은 매 라운드가 이전 라운드의 실제 CRITICAL/WARNING 을 고치는 반복(이번 라운드 diff 의 JSDoc 주석 다수가 `(review/code/.../19_07_43 concurrency WARNING#1)` 류로 그 계보를 직접 인용)이며, 무관한 산출물을 끌어들인 것이 아니다. 이전 라운드 자체 scope.md(`18_17_44/scope.md`, `19_07_43/scope.md` 등)도 동일하게 NONE 판정을 내렸다.
  - 제안: 조치 불요(기록 목적).

이 외에 요청 범위를 벗어난 리팩토링, 임포트 정리, 포맷팅 전용 변경, 무관한 파일·설정
수정, 불필요한 주석·기능 확장은 발견되지 않았다.

## 요약

`git diff --stat origin/main...HEAD` 로 전체 110개 파일을 확인하고 `plan/`·`review/` 를 제외한
순수 코드 파일 16개 전부의 diff 를 직접 읽은 결과, 모든 변경이 하나의 동시성 결함(동시
쓰기가 `trigger.config` 를 스냅샷으로 통째 덮어써 `chatChannel.inboundSigningRef` 를 잃고
인입 웹훅 서명 검증이 fail-open 되는 lost-update)과 그 직접 파생 효과(웹훅 hot path 의 같은
클래스 재발, 코드 형태 변경이 깨뜨린 정적 가드의 보정, 트랜잭션 mock 인프라, 삭제 경합
404 를 위한 소규모 헬퍼 추출)로 정확히 귀결된다. `package.json`/lockfile, frontend,
channel-web-chat, spec 변경은 0건이다. `plan/`·`review/**` 동반 산출물은 이 저장소가
강제하는 워크플로 절차의 산물이며 무관한 확장이 아니다. 요청 범위를 벗어난 리팩토링·기능
확장·무관한 파일 수정·포맷팅 전용 변경·불필요한 주석/임포트 정리는 발견되지 않았다.

## 위험도

NONE
