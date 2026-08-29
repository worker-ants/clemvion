# 유지보수성(Maintainability) Review

## 발견사항

- **[INFO]** `hasDefaultExport` 의 반환 스타일이 파일 내 형제 헬퍼와 약간 다르다
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:180-194` (함수 `hasDefaultExport`)
  - 상세: 같은 파일의 `importLeavesValueEdge`/`exportLeavesValueEdge`(동사형: `…LeavesValueEdge`)나 `insideFunction`(무접두)과 달리, 이번에 추가된 `hasDefaultExport` 는 `has` 접두 불리언 네이밍을 쓴다. 또 함수 본문 안에서 앞 두 분기는 early-return(`if (...) return true;`) 스타일이고 세 번째 분기는 단일 `return (표현식)` 스타일이라 내부적으로 두 스타일이 섞여 있다. 기능·가독성에는 영향이 없는 순수 스타일 차이다.
  - 제안: 필수 조치는 아니지만, 이후 유사 헬퍼를 추가할 때는 파일 내 기존 네이밍 패턴(동사형 서술)과의 정렬 여부를 한 번 더 검토하면 좋다.

- **[INFO]** `plan/in-progress/ws-event-types-extract.md` 의 정보 밀도가 매우 높다
  - 위치: `plan/in-progress/ws-event-types-extract.md` (체크리스트 "그 밖" 섹션 및 "완료 이동 시점" 항목)
  - 상세: 인용 블록(`>`)이 다단으로 중첩되고, 라운드별 실측표·근거 서술이 누적되어 문서가 매우 길다. 이는 애플리케이션 코드가 아니라 작업 추적 문서이며, 이 저장소가 명시적으로 채택한 "근거는 문서에 남긴다" 컨벤션(CLAUDE.md, 이전 라운드 rationale 다수)을 그대로 따른 결과다. 코드 유지보수성 기준(함수 길이·중첩 등)을 직접 적용할 대상은 아니라고 판단했다.
  - 제안: 조치 불요 — 컨벤션 준수로 판단.

## 리뷰한 실제 코드 변경에 대한 평가

1. **`hasDefaultExport` 추출 (`websocket-events.types.spec.ts:180-194`, 사용부 `:357`)** — 종전에 세 번째 테스트 안에 인라인 화살표 함수로 박혀 있던 `export default` 판정 로직을, 이름 있는 top-level 함수로 추출하면서 **누락돼 있던 세 번째 형태**(`export { X as default }` 별칭)까지 추가했다. 이는 정확히 "중복 코드"·"가독성" 두 축을 동시에 개선한다 — 로직이 한 곳에만 존재하므로 다음에 형태가 하나 더 필요해져도 고칠 곳이 하나다. JSDoc 이 AST 형태 3종을 표로 소진해 설명하므로 판정 근거를 파악하기 쉽다.
2. **`ts.getModifiers(st as ts.HasModifiers)` → `ts.canHaveModifiers(st) && ts.getModifiers(st)`** — 타입 캐스트로 컴파일러를 속이던 자리를 타입가드로 대체했다. 코드가 실제 계약(모든 `Statement` 가 modifier 를 가질 수 있는 것은 아님)을 반영하게 되어 타입 안전성과 가독성이 함께 좋아졌다.
3. **`NotificationEventType` → `InAppNotificationEventType` 개명** (`websocket-events.types.ts:226`, `websocket.service.ts:27,44,588`, spec 의 `EXPECTED_EXPORTS:59`) — 이름 충돌(`triggers/dto/notification-config.dto.ts` 의 동명 타입)을 "주석으로 구분"에서 "이름 자체로 구분"으로 바꾼 것은 유지보수성 관점에서 명백한 개선이다. 주석 기반 구분은 자동완성이 두 심볼을 구분 없이 보여줄 때 실효성이 없다는 점을 JSDoc 이 명시하고 있고, 이는 실제 근거가 있는 판단이다. 개명은 3개 파일 전부에서 일관되게 반영되어 있고(선언·import·export·사용·JSDoc `{@link}`·테스트의 export 목록), 새 이름은 이 모듈의 자매 enum 들(`ExecutionEventType`/`NodeEventType`/`BackgroundRunEventType`/`KbEventType`)이 따르는 `<도메인>EventType` 네이밍 규칙과도 정합적이다.
4. **함수 길이·중첩·복잡도** — 변경분 자체(리네임 3파일 + 헬퍼 함수 1개 추가)는 전부 작고 단일 책임이다. `hasDefaultExport` 는 15줄, 중첩 깊이 2 이내, 분기 3개로 순환 복잡도가 낮다. 매직 넘버/매직 스트링도 새로 도입되지 않았다(`'default'` 리터럴은 TS 문법 자체의 예약어 값을 가리키므로 매직 넘버 범주가 아니다).
5. **일관성** — 새 헬퍼의 배치 위치(다른 `…LeavesValueEdge` 헬퍼 바로 다음), JSDoc 스타일(표+근거 서술), 테스트에서의 사용 방식이 파일 전체의 기존 패턴과 잘 맞는다. `websocket.service.ts` 의 import/export/사용 3곳 리네임도 세트로 누락 없이 반영됐다.

`websocket.service.ts` 의 `sanitizePayloadForWs`/`allowlistFanoutNodeOutput`/`emitExecutionEvent` 등 기존 코드는 이번 diff 에서 건드리지 않았으므로(enum 리네임 3줄 외 변경 없음) 리뷰 범위에서 제외했다.

## 요약

이번 변경은 (1) `NotificationEventType` → `InAppNotificationEventType` 리네임을 3개 파일에 걸쳐 누락 없이 일관되게 반영하고, (2) 정적 가드 테스트의 `export default` 판정 로직을 중복 인라인 코드에서 이름 있는 단일 헬퍼(`hasDefaultExport`)로 추출하며 종전에 빠져 있던 별칭 export 형태까지 함께 메꿨다. 두 변경 모두 유지보수성 관점에서 순수하게 개선 방향이며(중복 제거, 가독성 향상, 타입 안전성 개선, 네이밍 명확화), 함수 길이·중첩·매직 넘버·복잡도 어느 축에서도 새로운 문제를 도입하지 않았다. 발견된 사항은 전부 INFO 수준의 스타일 관찰이며 조치가 필요한 결함은 없다.

## 위험도

NONE
