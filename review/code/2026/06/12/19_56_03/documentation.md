# 문서화(Documentation) 리뷰 결과

## 발견사항

### [CRITICAL] spec/5-system/15-chat-channel.md — CCH-CV-03 (b) 분기가 구현 완료됐으나 spec 본문이 여전히 "미구현 (Planned)" 로 기술
- 위치: `/Volumes/project/private/clemvion/spec/5-system/15-chat-channel.md` 67행, CCH-CV-03 테이블 행
- 상세: 이번 변경에서 `HooksService.isActiveExecution` → `getActiveExecutionStatus` 로 리네임·확장하고 CCH-CV-03 (b) `running`/`pending` 케이스에서 `sendExecutionStillRunningNotice` + `{ executionId: 'ignored' }` 를 반환하도록 구현이 완료되었다. 그러나 spec 의 CCH-CV-03 행에는 다음 세 가지 stale 정보가 그대로 남아 있다:
  1. `**(b) 분기 미구현 (Planned)**` 마커가 삭제되지 않음
  2. `HooksService.isActiveExecution` 이라는 이미 제거된 메서드명을 참조 (`hooks.service.ts:733`)
  3. `hooks.service.ts:451-476` 행 번호 참조 — 코드 이동으로 무효화됨
- 제안: CCH-CV-03 행의 `(b) 분기 미구현 (Planned)` 단락 전체를 구현 완료 사실로 교체. `isActiveExecution` → `getActiveExecutionStatus` 로 메서드명 갱신. 행 번호 참조 제거 또는 현행 행 번호로 갱신.

### [CRITICAL] spec/5-system/15-chat-channel.md §5.4 — rotate-bot-token 성공 응답 계약이 구현 완료됐으나 spec 이 여전히 "미구현 (Planned)" + 구 스키마를 기술
- 위치: `/Volumes/project/private/clemvion/spec/5-system/15-chat-channel.md` 324행, 333행
- 상세: 이번 변경에서 `TriggersService.rotateBotToken` 반환 타입이 `{ rotatedAt: string }` → `{ rotatedAt, triggerId, chatChannelHealth, botIdentity }` 4필드로 확장됐다. 그러나 spec §5.4 성공 응답 예시는 `rotatedAt` 1필드만 보여주고, "현재 구현은 `rotatedAt` 1필드만 반환한다 (`triggers.service.ts:921`)" 라는 설명과 함께 "`triggerId` / `chatChannelHealth` / `botIdentity` 3필드 동봉은 **미구현 (Planned)**" 마커가 유지되고 있다. 계약과 코드 구현 사이 불일치가 spec 에 고착된 상태다.
- 제안: §5.4 성공 응답 jsonc 예시를 4필드(`rotatedAt`, `triggerId`, `chatChannelHealth`, `botIdentity`)로 갱신. "현재 구현은 1필드만 반환" 및 "미구현 (Planned)" 문구 제거. `triggers.service.ts:921` 행 번호 참조를 현행 행 번호로 갱신하거나 행 번호 고정 참조 제거.

### [WARNING] hooks.service.ts — `handleChatChannelWebhook` JSDoc 댓글이 CCH-CV-03 (b) 분기를 반영하지 않음
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/hooks/hooks.service.ts` `handleChatChannelWebhook` 메서드 JSDoc (1028~1038행)
- 상세: 메서드 상단 JSDoc 4번 항목이 "활성 execution + waiting_for_input 이면 interact() in-process 호출 / 그 외에는 새 execution 시작" 으로 기술되어 있다. 이번 변경으로 `running`/`pending` 케이스에서 `sendExecutionStillRunningNotice` 후 무시(ignored)하는 경로가 추가됐으나 JSDoc 에는 반영되지 않았다.
- 제안: JSDoc 4번 항목을 "(a) waiting_for_input → interact() in-process, (b) running/pending → executionStillRunning 안내 + ignored, (c) terminal/없음 → 새 execution" 로 갱신.

### [WARNING] 설정 문서 — `languageHints.executionStillRunning` EN locale default 문구 미문서화
- 위치: `/Volumes/project/private/clemvion/spec/5-system/15-chat-channel.md` §4.1.1 (243행)
- 상세: 새로 활성화된 `executionStillRunning` 키는 `sendExecutionStillRunningNotice` 에서 KO default `'워크플로우가 처리 중입니다\\. 잠시만 기다려 주세요\\.'` 를 하드코딩 사용한다. spec §4.1.1 은 "기존 5 키(`groupChatRefusal` 등)의 EN default 화는 본 spec 범위 밖" 이라 명시하지만, `executionStillRunning` 에 대한 EN locale default 존재 여부·미존재 시 KO fallback 여부가 spec 에 불명확하다. 현재 구현은 `config.languageHints?.executionStillRunning ?? KO_STRING` 으로 단일 KO default 만 제공한다.
- 제안: §4.1.1 또는 §4.2 config 예시 테이블에 `executionStillRunning` 이 EN locale lookup 을 지원하는지(KO fallback only인지) 명시. 구현이 KO-only 라면 spec 에 이를 명기.

### [INFO] plan/in-progress/spec-sync-chat-channel-gaps.md — spec 본문 갱신 미완료 언급
- 위치: `/Volumes/project/private/clemvion/plan/in-progress/spec-sync-chat-channel-gaps.md`
- 상세: plan 의 CCH-CV-03 완료 항목에 "spec CCH-CV-03 본문 갱신" 을 명시하고, §5.4 완료 항목에도 "spec §5.4 예시 갱신"을 명시했다. 그러나 실제 spec 파일(`15-chat-channel.md`)에는 갱신이 반영되지 않았다(CRITICAL #1, #2 에서 확인). plan 에 완료로 체크했으나 spec 갱신이 누락된 상태.
- 제안: spec 갱신이 이번 PR 범위에 포함된다면 갱신 후 커밋. 아니라면 plan 체크박스가 spec 갱신 전에 완료 표기된 것임을 주의.

### [INFO] 테스트 주석 — "[Spec §5.4] 성공 응답 3필드 동봉" 표현 불일치 (실제 4필드)
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/chat-channel/chat-channel.controller.spec.ts` 35행
- 상세: `ROTATE_RESULT` 상수 위 주석이 "성공 응답 3필드 동봉"이라 기술하지만 실제 오브젝트는 `rotatedAt`, `triggerId`, `chatChannelHealth`, `botIdentity` 4개 필드다. `triggersService.spec.ts` 내 테스트 설명(1792행)도 "3필드 동봉"이라 서술하나 실제로는 `rotatedAt` 을 포함하면 4필드, spec §5.4 의 "추가 3필드"라는 관점에서 3이므로 의미는 통하나 혼동을 유발한다.
- 제안: 주석을 "성공 응답 — rotatedAt + 3필드 추가 (triggerId / chatChannelHealth / botIdentity)" 또는 "성공 응답 4필드"로 명확히 정정. 테스트 설명도 동일하게 통일.

### [INFO] 인라인 주석 정확성 — TypeScript narrowing 설명 중 `truthy` → `!= null` 조건과 혼용
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/hooks/hooks.service.ts` 1141~1145행
- 상세: 주석이 "truthy 시 TS 가 후속 분기에서 state 를 non-null 로 좁힘" 이라 하지만 실제 연산자는 `!= null` (느슨한 비교) 로 `null`과 `undefined` 를 함께 걸러낸다. "truthy" 라고 쓰면 `0`, `''`, `false` 도 걸러낸다는 의미로 읽혀 정확하지 않다.
- 제안: "truthy 시" → "`!= null` (null/undefined 제외) 시" 로 수정.

## 요약

이번 변경의 핵심 구현(CCH-CV-03 (b) `running`/`pending` 케이스 분기, §5.4 rotate-bot-token 성공 응답 4필드 확장)은 코드 레벨에서 충실히 수행되었고 plan 도 완료 체크되었다. 그러나 spec 단일 진실 문서인 `spec/5-system/15-chat-channel.md` 가 두 군데 모두 "미구현 (Planned)" 마커와 구 스키마를 그대로 유지하는 CRITICAL 불일치가 있어 spec 와 코드 사이 계약 문서가 어긋난 상태다. `handleChatChannelWebhook` JSDoc 의 분기 설명 미갱신과 `languageHints.executionStillRunning` EN locale 지원 여부 불명확도 후속 혼동을 유발할 수 있다. 인라인 주석 품질과 테스트 주석 수치 불일치는 경미한 수준이다.

## 위험도

HIGH
