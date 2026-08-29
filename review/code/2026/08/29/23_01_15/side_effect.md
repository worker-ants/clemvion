STATUS=success reviewed 4 files (websocket-events.types.spec.ts, websocket-events.types.ts, websocket.service.ts, plan/in-progress/ws-event-types-extract.md); no repo mutation performed
===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 리뷰 — `ws-event-types-followups`

## 발견사항

- **[INFO]** export 되는 enum 심볼 개명(`NotificationEventType` → `InAppNotificationEventType`)은 형식적으로 공개 인터페이스 변경이다
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:226` (선언), `codebase/backend/src/modules/websocket/websocket.service.ts:27`(import), `:44`(re-export), `:588`(사용)
  - 상세: 이 enum 은 `websocket.service.ts` 를 통해 계속 re-export 되는 facade 심볼이라(§4번 시그니처 변경/§5번 인터페이스 변경 관점), 외부 소비자가 있었다면 컴파일 타임에 깨진다. 실제로 전수 grep 한 결과(`grep -rn "\bNotificationEventType\b" codebase/`) `websocket.service`/`websocket-events.types` 경로로 이 심볼을 가져가는 곳은 diff 에 포함된 3개 파일뿐이었고, `frontend/` 에도 참조가 없었다. enum **값**(`'notification.new'`)은 변경되지 않았으므로 소켓 wire 프로토콜(클라이언트가 수신하는 이벤트명)에는 영향이 없다 — 순수 컴파일 타임 심볼 개명이다.
  - 제안: 없음(이미 plan 문서의 "완료" 각주에 0개 외부 소비자 근거가 기록돼 있고, 본 리뷰의 grep 도 이를 재확인함). 향후 유사 개명 시에도 facade re-export 지점에서 전수 grep 확인을 유지할 것.

- **[INFO]** 신규 헬퍼 `hasDefaultExport()` 는 순수 함수 — 부작용 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` 함수 `hasDefaultExport` (게이트 180~194줄)
  - 상세: AST 노드(`ts.Statement`)를 인자로 받아 boolean 을 반환할 뿐, 파일시스템·전역 상태·네트워크에 접근하지 않는다. 호출부(`describe` 블록 내 게이트 357줄)도 `parse(file).statements.some(hasDefaultExport)` 로 순수 조회다. 테스트 파일 자체의 `allTsFiles`/`parse` 는 기존에 이미 존재하던 읽기 전용 fs 접근(`fs.readdirSync`/`fs.readFileSync`)이며 이번 diff 로 신규 도입된 것이 아니다.

- **[INFO]** `EXPECTED_EXPORTS` 배열의 개명 반영 — 캐너리와 실제 export 가 동기 유지됨
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:59`
  - 상세: `'NotificationEventType'` → `'InAppNotificationEventType'` 로 캐너리 목록을 갱신해, 개명 후에도 "선언이 실제로 export 되는지" 테스트(같은 파일 324번째 줄 부근 `it` 블록)가 공허해지지 않는다. 부작용 관점에서는 문제 없음(테스트 고정 값 갱신).

## 요약

이번 diff 는 (1) WS 인앱 알림 enum `NotificationEventType`→`InAppNotificationEventType` 개명, (2) default-export 판정 로직을 `hasDefaultExport()` 순수 헬퍼로 추출 + `ts.canHaveModifiers` 가드 적용, (3) 관련 plan 문서 갱신으로 구성된다. enum 개명은 형식적으로 exported 심볼(공개 인터페이스) 변경이지만, enum **값**(`'notification.new'`)은 불변이라 WS wire 프로토콜/클라이언트 행동에는 영향이 없고, 전수 grep 으로 재확인한 결과 개명된 심볼을 diff 밖에서 참조하는 곳도 없다(0 external consumers, plan 문서 주장과 일치). 신규 테스트 헬퍼는 순수 함수이고 fs 접근은 기존 코드 경로를 재사용할 뿐 새로운 파일시스템 부작용을 만들지 않는다. 전역 변수 신설, 환경 변수 접근, 네트워크 호출, 이벤트/콜백 배선 변경은 관찰되지 않았다. 리뷰 중 저장소 파일은 뮤테이션하지 않았다(읽기 전용 grep/Read 만 수행).

## 위험도

NONE
