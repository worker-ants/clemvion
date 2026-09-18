# 부작용(Side Effect) 리뷰

## 검토 범위

`codebase/**` 변경 9개 파일 전량을 실제 저장소에서 직접 `git diff origin/main...HEAD`(전문, 프롬프트 절단분 포함)로 확인했다. 그 외 `plan/in-progress/trigger-release-stale-comments.md`, `review/consistency/2026/09/18/11_26_25/**` 는 코드가 아니라 이 작업의 plan·게이트 산출물이라 부작용 관점 검토 대상이 아니다(신규 파일 생성이지만 harness 관례에 따른 리뷰 산출물이며 런타임 동작과 무관).

`codebase/**` diff 는 다음 두 종류로 완전히 소진된다.

1. JSDoc/주석 텍스트 정정 (5개 파일: `secret-resolver.service.ts`, `trigger-config-lock.ts`, `chat-channel-binder.service.ts` 일부, `triggers.service.ts`, `trigger-workflow-ref.e2e-spec.ts`, `workspaces.service.spec.ts`, `triggers.service.spec.ts`) — 서술만 바뀌고 실행 코드는 한 글자도 바뀌지 않았다.
2. 메서드 rename `teardownChannelConfig` → `teardownRegisteredChannel` (정의부 1 + 내부 호출 2 + 외부 호출부 1 + 테스트 mock 키 1 + 테스트 기대값 문자열 1) — 시그니처(파라미터·반환 타입·동작)는 그대로다.

## 발견사항

- **[INFO]** 메서드 rename 전수 배선 확인 — 문제 없음
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:380`(정의), `:253`·`:370`(내부 호출), `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:123`(외부 호출), `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.spec.ts:53`·`:315`(mock/기대값)
  - 상세: `teardownChannelConfig` → `teardownRegisteredChannel` rename 이 정의부·모든 콜사이트·테스트 mock·테스트 기대 문자열까지 일관되게 반영됐다. 저장소 전역 `grep -rn "teardownChannelConfig|teardownRegisteredChannel"` 결과 잔존하는 옛 이름은 `chat-channel-binder.service.ts:377`의 JSDoc 안 "이전 이름 `teardownChannelConfig` 는 …" 한 곳뿐이며, 이는 rename 이력을 설명하는 의도된 서술이다. `TriggerResourceReleasePort`/DI 토큰 등 문자열 기반 참조도 없어 이 서비스는 `@Injectable()` 클래스 메서드로만 노출되고 외부에서 메서드명을 문자열로 참조하는 곳은 없다. 시그니처(파라미터 `triggerId: string, chatChannelCfg: ChatChannelConfig`, 반환 `Promise<void>`)는 변경 전과 동일 — 이름만 바뀐 순수 rename이며 호출자 영향 없음.
  - 제안: 없음(정보 제공용).

- **[INFO]** 나머지 전 변경은 주석/JSDoc 텍스트 정정뿐 — 상태·전역변수·파일시스템·환경변수·네트워크·이벤트 부작용 없음
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts`(`deleteByPrefix` JSDoc), `codebase/backend/src/modules/triggers/trigger-config-lock.ts`(`TRIGGER_DELETE_LOCK_TIMEOUT_MS` JSDoc), `codebase/backend/src/modules/triggers/triggers.service.ts:666-671` 부근 인라인 주석, `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3962-3967` 테스트 주석, `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:734` 테스트 주석(리뷰 인용 문자열에 `review/code/` 경로 접두만 추가), `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts:146-168` teardown JSDoc
  - 상세: 위 파일들의 diff hunk를 전부 `git diff` 로 대조한 결과, 코드 라인(실행문·조건문·쿼리·호출)은 단 한 줄도 바뀌지 않았고 오직 `/** ... */` JSDoc 본문과 `//` 인라인 주석 문구만 정정됐다. `deleteByPrefix`(실제 DELETE 쿼리를 실행하는 함수)나 `acquireTriggerConfigLock`/`setLocalLockTimeout`(SQL `SET LOCAL lock_timeout` 실행 함수) 자체의 로직·SQL 문자열·파라미터는 무변경이다.
  - 제안: 없음 — 부작용 관점에서 위험 없음.

## 요약

이번 diff 는 `#1346`(트리거 삭제 자원 정리) 구현이 남긴 stale 주석·이름을 정리하는 순수 문서화 PR 이다. 실행 코드 변경은 메서드 rename `teardownChannelConfig`→`teardownRegisteredChannel` 하나뿐이며, 정의부·내부 호출 2곳·외부 호출부(`trigger-resource-releaser.service.ts`)·테스트 mock·테스트 기대값까지 전수 배선을 저장소에서 직접 확인해 호출자 영향이 없음을 검증했다. 그 외 8개 파일의 diff 는 JSDoc/주석 텍스트뿐으로 전역 상태·파일시스템·환경변수·네트워크·이벤트/콜백 어느 축에서도 부작용이 발생하지 않는다.

## 위험도

NONE
