# 보안(Security) Review

## 검토 범위 요약

이번 변경은 `#1346`(트리거 자원 정리)이 남긴 **stale 주석·메서드 이름**을 정정하는 PR이다(`spec_impact: none`). 실제 동작 변경은 `ChatChannelBinderService.teardownChannelConfig` → `teardownRegisteredChannel` **리네임 하나**뿐이며, 나머지는 전부 JSDoc/테스트 주석 텍스트 수정이다. 새로 추가된 로직, 새 입력 처리 경로, 새 SQL/쿼리, 새 암호화 호출은 없다.

- `secret-resolver.service.ts` — `deleteByPrefix` JSDoc 문구만 교체(호출부 서술 갱신). 기존 `startsWith('secret://')` 접두 검사 + `/[%_\\]/` LIKE 메타문자 거부 로직은 **변경 없음**. `assertRefFormat`/`resolve`의 에러 메시지 새니타이징(SS-SE-05, ref/workspaceId만 로깅, plaintext 미노출)도 변경 없음.
- `trigger-config-lock.ts` — `TRIGGER_DELETE_LOCK_TIMEOUT_MS` JSDoc 문구만 교체. `setLocalLockTimeout`의 `SET LOCAL lock_timeout = '${toLockTimeoutMs(timeoutMs)}ms'` 문자열 보간은 이번 diff에 포함되지 않았고(문맥으로만 표시), 호출부는 여전히 모듈 상수(`TRIGGER_DELETE_LOCK_TIMEOUT_MS`)만 넘겨 사용자 입력 경로가 없다는 기존 서술과 일치.
- `chat-channel-binder.service.ts` / `trigger-resource-releaser.service(.spec).ts` — `teardownChannelConfig` → `teardownRegisteredChannel` 기계적 리네임(정의 1 + 호출부 2 + mock/이벤트 라벨). 시그니처·인가 로직·시크릿 처리 흐름은 동일.
- `triggers.service(.spec).ts`, `workspaces.service.spec.ts`, `trigger-workflow-ref.e2e-spec.ts` — 주석 문구 정정만(diff에 보이는 부분 기준). 이 세 파일은 프롬프트 크기 제한으로 전체 컨텍스트가 실리지 않아 diff 밖 영역은 직접 확인하지 못했으나, diff hunk 자체는 전부 comment-only.
- `plan/in-progress/trigger-release-stale-comments.md`, `review/consistency/2026/09/18/11_26_25/**` — plan 문서 및 consistency-check 산출물. 코드가 아니며 보안 표면 없음.

## 발견사항

- **[INFO]** `deleteByPrefix`의 안전성 근거가 "호출부가 하나뿐이고 메타문자가 못 들어간다"는 **닫힌 목록**에 계속 의존
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` (`deleteByPrefix` JSDoc, 게이트 173~179)
  - 상세: 이번 커밋 자체가 그 근거 문장을 이미 갱신한(2026-08-09 한 곳 → 2026-09-18 `deleteTriggerSecretsAfterCommit` 한 곳) 이력을 보여준다. 즉 "직접 호출부가 하나"라는 전제는 시간이 지나며 이미 한 번 바뀌었고, 코드 자체는 `startsWith('secret://')` + LIKE 메타문자 거부(`/[%_\\]/`)로 **입력 자체를 거부**하는 방어를 이미 갖추고 있어 실질 위험은 없다. 다만 JSDoc이 "지금은 안전하다"의 근거로 호출부 개수 서술을 계속 남기는 구조 자체가, 다음에 호출부가 하나 더 생겨도(주석만 업데이트를 잊으면) 코드 방어(거부 로직)가 여전히 작동하므로 실제 보안 리스크로 이어지지는 않는다. 코드 레벨 방어가 이미 SoT이므로 이 항목은 정보성.
  - 제안: 없음(코드 방어가 이미 존재 — 주석은 설명일 뿐). 향후 호출부 추가 시에도 이 거부 검증 로직만 유지되면 안전.

- **[INFO]** 리네임(`teardownChannelConfig` → `teardownRegisteredChannel`)이 인가/시크릿 처리 로직을 바꾸지 않음을 확인
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (게이트 374~382), `trigger-resource-releaser.service.ts` (게이트 122~127), `trigger-resource-releaser.service.spec.ts` (게이트 53~56, 314~317)
  - 상세: 메서드 시그니처(`triggerId: string, chatChannelCfg: ChatChannelConfig`)·본문·호출 순서 모두 동일하며 이름만 변경됐다. 시크릿 처리(`teardownChatChannel`이 provider에 등록된 채널을 해제하는 best-effort 경로)에 인가 검사나 입력 검증 변화 없음. 위험 없음, 확인 목적의 기록.

## 요약

이번 PR은 순수 문서/주석 정정과 메서드 이름 통일(`teardownRegisteredChannel`) 리팩터링으로, 인젝션·인증/인가·암호화·시크릿 저장/로깅·에러 노출 등 보안에 영향을 주는 실행 경로 변경이 없다. `secret-resolver.service.ts`의 `deleteByPrefix` LIKE 메타문자 거부, `resolve()`의 에러 메시지 새니타이징(SS-SE-05), `trigger-config-lock.ts`의 `lock_timeout` 값 검증(`toLockTimeoutMs`에 의한 유한수 강제 + clamp) 등 기존 방어 로직은 이번 diff로 손대지 않았고 그대로 유지된다. 발견된 두 항목은 모두 INFO 등급(코드 방어가 이미 있어 위험은 없고, 주석의 서술 방식에 대한 관찰)이며 차단 사유는 없다.

## 위험도

NONE
