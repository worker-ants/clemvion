# 테스트(Testing) 리뷰

## 검증 방법 (실측)

- `npx jest src/modules/websocket/websocket-events.types.spec.ts src/modules/websocket/websocket.service.spec.ts` — **75/75 통과** (backend, 현재 트리 기준).
- `git status --short` — 리뷰 시작 시점부터 clean (`review/code/2026/08/29/23_30_12/` 신규 세션 디렉터리만 untracked, 코드 변경 없음).
- 독립 뮤테이션 재검증(3번째 재검증 — resolution-applier·main 검증에 이은 것): scratch(`/private/tmp/.../scratchpad/backup_types_spec.ts`)에 원본 백업 후, `websocket-events.types.spec.ts` 의 `hasDefaultExport` 3번째 분기 술어 `el.name.text === 'default'` → `el.name.text === '__mutant_never__'` 로 직접 뮤테이션.
  - 예측: `it.each` 테이블의 별칭 2케이스(`export { X as default };` / `… from './m';`)가 RED.
  - 실측: **정확히 그 2건만 RED**(`Expected: true, Received: false`), 나머지 10건 GREEN — 예측과 일치.
  - `cp` 로 원복 후 재실행 12/12 GREEN, `git status --short` clean 재확인.

## 발견사항

- **[INFO]** `InAppNotificationEventType` 의 하위호환 re-export facade(`websocket.service.ts`) 경로가 어떤 테스트에서도 실제로 import·소비되지 않는다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` (import 블록·`export { … InAppNotificationEventType }` 재수출 블록), 소비 부재 확인은 `codebase/backend/src/modules/websocket/websocket.service.spec.ts`.
  - 상세: `websocket-events.types.spec.ts` 의 `REEXPORT_FACADE_TEST` 상수 옆 주석은 "`websocket.service` 에서 enum **값**을 가져와도 되는 유일한 예외 … 이 한 줄은 면제가 아니라 **의도된 커버리지**다" 라고 명시한다 — 즉 `websocket.service.spec.ts` 가 facade 를 통해 재수출되는 값들을 실제로 소비함으로써 facade 단절을 잡아준다는 것이 이 파일의 설계 전제다. 실측하면 그 spec 은 `ExecutionEventType` · `NodeEventType` · `BackgroundRunEventType` 세 값은 facade(`./websocket.service`)에서 직접 import 해 assertion 에 쓰지만(`grep -n "^  ExecutionEventType\|NodeEventType\|BackgroundRunEventType" websocket.service.spec.ts` 1~9행), 이번 diff 가 개명한 `InAppNotificationEventType` 은 그 파일 어디에도 등장하지 않는다 — `grep -n InAppNotificationEventType websocket.service.spec.ts` 0건. 즉 facade 의 이 재수출 줄이 통째로 사라지거나 오탈자로 깨져도(외부 소비자가 없으므로 tsc 도 안 걸림 — RESOLUTION.md 가 "facade 를 통해 이 심볼을 가져가는 외부 소비자 0곳" 이라고 스스로 확인함), 커밋된 스위트 어디도 RED 를 내지 않는다.
    이는 이번 개명이 만든 새 결함이 아니라 **개명 전 `NotificationEventType` 시절부터 있던 사전 갭**이다(개명 전 이름으로도 facade 소비 0건이었음, 별도 확인). 실제 위험은 낮다 — `websocket-events.types.ts` 자체가 이 파일의 헤더 주석이 지키는 "의존성-프리" 불변식 덕에 어떤 순환 위치에서도 즉시 평가되므로, `websocket.service.ts` 의 재수출이 `undefined` 로 깨지는 #1174 류 위험은 구조적으로 없다. 다만 이 파일의 나머지 테스트들이 정확히 이런 부류의 "주석/의도만 있고 실행 경로가 없는 방어" 를 4라운드 연속 잡아 온 이력(JSDoc 의 "세 번째가 종전에 빠져 있었다" 서술, `hasDefaultExport` WARNING 등)을 감안하면, facade 커버리지 주장과 실측 사이의 이 특정 간극도 같은 부류로 기록해 둘 가치가 있다.
  - 제안: `websocket.service.spec.ts` 에 `InAppNotificationEventType` 을 facade(`./websocket.service`)에서 import 해 `InAppNotificationEventType.NOTIFICATION_NEW === 'notification.new'` 정도를 단언하는 한 줄을 추가하면, 다른 세 값과 동일한 수준으로 facade 커버리지 주장이 실제로 성립한다. 비용은 낮으나 이번 PR 범위(개명 자체)를 벗어나는 사전 갭이라 차단 사유는 아니다.

## 회귀·격리·가독성 관점 확인 (발견사항 아님 — 검증 근거)

- 이전 라운드(`23_01_15`) WARNING1 — `hasDefaultExport()` 3번째 분기(별칭 `as default`)가 스위트에서 양성 경로로 한 번도 실행되지 않던 갭 — 이번 diff 에서 `ts.createSourceFile` 합성 소스 `it.each` 테이블로 영구 고정됐다. 저장소 실제 파일 상태와 무관하게 항상 도는 구조(파일시스템 의존 없음)이고, 양성 3형태 + 음성 2형태를 모두 포함해 "전부 `true` 로 뭉개는" 종류의 뮤턴트도 동시에 방어한다. 위 독립 재검증으로 실증(정확히 별칭 2케이스만 RED).
- `NotificationEventType` → `InAppNotificationEventType` 개명은 enum 멤버 값 불변(`'notification.new'`)이라 순수 컴파일타임 변경이다. 런타임 회귀는 `websocket.service.spec.ts:1267-1281` 의 `expect(event).toBe('notification.new')` 단언이 개명 전후 동일하게 커버한다 — 별도 신규 테스트 불요, 확인함.
- `notification-config.dto.ts` 의 변경은 JSDoc 한 단락 추가뿐(로직 변경 없음) — 테스트 불요가 맞다.
- 코드베이스 전수 grep(`grep -rn '\bNotificationEventType\b' codebase/backend/src`)으로 옛 이름의 잔존 참조가 자매 타입(`triggers/dto`) 외에 없음을 확인 — 개명 누락 없음.
- 신설 `it.each` 테이블 테스트는 각 케이스가 소스 문자열·라벨·기대값을 명시적으로 나열해 가독성이 좋고, 테스트 간 상태 공유가 없어 격리도 양호하다.

## 요약

핵심 변경(개명 `NotificationEventType` → `InAppNotificationEventType`, `hasDefaultExport()` JSDoc/가드 개선)은 이전 라운드가 지적한 유일한 WARNING(별칭 분기 커버리지 갭)을 합성 소스 테이블 테스트로 영구 고정했고, 이는 fixer 자체 재검증·main 독립 재검증에 이어 이번 3차 독립 재검증까지 예측=실측이 일치했다(별칭 2케이스만 RED, 음성 뭉갬 시 음성 2케이스+기존 캐너리 RED). enum 개명은 값 불변의 순수 컴파일타임 변경이라 기존 wire-value 단언이 그대로 회귀 방어를 제공하며, 코드베이스 전수 grep 으로 잔존 옛 이름도 없다. 유일하게 남는 관찰은 INFO 수준 — `InAppNotificationEventType` 의 facade 재수출이 `websocket.service.spec.ts` 에서 실제로 소비되지 않아, 그 spec 의 "의도된 커버리지" 주장이 이 심볼에는 실제로 적용되지 않는다는 것이다. 이는 개명 전부터 있던 사전 갭이고 구조적으로 위험이 낮아 차단 사유는 아니다.

## 위험도
LOW
