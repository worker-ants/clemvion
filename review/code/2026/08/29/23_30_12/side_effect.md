STATUS=success side_effect review complete — 0 CRITICAL, 0 WARNING, 3 INFO
===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 리뷰

## 검증 방법 메모

이번 diff 는 저장소에 아무것도 쓰지 않고 (`Read`/`Bash grep` 만 사용) 검증했다 — 뮤테이션이
필요한 가설이 없었다(순수 rename + JSDoc + pure 함수 추출이라 코드를 실제로 고쳐 재현할
필요가 없었음). 뮤테이션 규약 §1~4 관련 잔여물 없음: `git status --short` 확인 결과
`review/code/2026/08/29/23_30_12/`(이 리뷰 세션 자신의 출력 디렉터리) 외 미커밋 변경 없음.

## 발견사항

- **[INFO]** `NotificationEventType` → `InAppNotificationEventType` enum 개명은 공개 심볼
  시그니처 변경(관점 4·5)이지만, 외부 소비자가 실제로 0곳임을 직접 재확인했다.
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:226` (선언),
    `codebase/backend/src/modules/websocket/websocket.service.ts:27,44,588` (import·re-export·사용)
  - 상세: `grep -rn '\bNotificationEventType\b' codebase/` 재실행 결과, 옛 이름이 남은 곳은
    `triggers/dto/notification-config.dto.ts` 의 **동명이지만 무관한** 별개 타입(outbound
    webhook 화이트리스트)뿐이었고, `codebase/frontend/`·`codebase/packages/` 어디에도
    `NotificationEventType`/`InAppNotificationEventType` 참조가 없다. `websocket.service.ts`
    의 re-export(`export { … InAppNotificationEventType }`)를 통해 옛 이름으로 가져가던
    facade 소비자도 없어 하위호환 파손 없음. enum 값(`NOTIFICATION_NEW = 'notification.new'`)
    은 불변이라 `emitNotificationEvent()` 가 `gateway.broadcastToChannel()` 로 내보내는 WS
    wire 이벤트명·payload shape 도 그대로다(관점 8 이벤트/콜백 — 런타임 방출 값 불변, 리스닝
    중인 프런트 클라이언트에 영향 없음). 컴파일 타임 rename 으로 완결됨.
  - 제안: 조치 불요 — 이미 grep 재검증까지 마친 안전한 rename.

- **[INFO]** `hasDefaultExport()` 신규 헬퍼 및 `describe('hasDefaultExport — 합성 소스 테이블')`
  블록은 순수 함수/순수 in-memory AST 파싱(`ts.createSourceFile`)만 사용한다.
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` 의
    `hasDefaultExport` 함수 정의부, 그리고 파일 하단 신규 `it.each` 테이블 블록
  - 상세: 전역 상태·파일시스템·네트워크·환경 변수를 건드리지 않는다. 기존 `parse()` 헬퍼(파일을
    읽어 AST 로 만드는 부분)는 이번 diff 로 변경되지 않았다 — 신규 테이블 테스트는 그 헬퍼를
    쓰지 않고 문자열을 직접 파싱해 기존 fs 읽기 표면을 늘리지 않는다.
  - 제안: 없음. 참고용 기록.

- **[INFO]** `review/code/2026/08/29/23_01_15/**` · `review/consistency/2026/08/29/23_23_48/**`
  9개 신규 파일과 `plan/in-progress/ws-event-types-extract.md` 갱신은 애플리케이션 코드의
  부작용이 아니라 이 저장소의 정규 워크플로 산출물이다(코드 리뷰/일관성 검토 산출물 저장
  위치 컨벤션, `plan/` 진행 기록). 파일시스템 쓰기이긴 하나 "예상치 못한" 것이 아니라 프로젝트
  컨벤션이 요구하는 정확한 위치·형식에 맞다.
  - 위치: 해당 없음(파일 신설/추가일 뿐 로직 부작용 아님)
  - 제안: 없음.

## 요약

핵심 코드 변경 4개 파일(`notification-config.dto.ts` JSDoc 추가, `websocket-events.types.spec.ts`
헬퍼 추출+테이블 테스트 추가, `websocket-events.types.ts`/`websocket.service.ts` 의
`NotificationEventType`→`InAppNotificationEventType` enum rename) 모두 순수 컴파일 타임
변경이거나 순수 함수 추가로, 전역 상태·환경 변수·네트워크·파일시스템에 대한 의도치 않은
부작용이 없다. 유일하게 "시그니처 변경" 성격을 갖는 enum rename 은 직접 grep 으로 monorepo
전체(backend/frontend/packages)에서 외부 소비자 부재를 재확인했고, 방출되는 WS 이벤트의 wire
값(`'notification.new'`)은 그대로라 런타임 이벤트/콜백 계약도 불변이다. 신규 커밋된
`review/**`·`plan/**` 파일들은 애플리케이션 부작용이 아니라 프로젝트가 규정한 워크플로 산출물
위치에 정확히 부합한다.

## 위험도

NONE
