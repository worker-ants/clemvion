## 발견사항

### [WARNING] `interaction_data.interactionType` enum 값 변경 — `"form_submit"` → `"form_submitted"` (파일 40)

- **위치**: `spec/1-data-model.md` §2.14 `interaction_data` 필드
- **상세**: DB에 이미 저장된 `NodeExecution.interaction_data.interactionType = "form_submit"` 레코드가 존재할 경우, 이 변경은 breaking change다. 실행 이력 조회 API나 WebSocket payload에서 이 값을 직접 소비하는 클라이언트(프론트엔드 타임라인, 웹훅 수신 측)는 두 enum 값을 모두 처리해야 한다. 마이그레이션 전략(one-off SQL UPDATE, 이중 허용 기간 등)이 스펙 어디에도 명시되지 않았다.
- **제안**: 구현 착수 전 `backend/` 코드에서 `"form_submit"` 리터럴을 grep하여 실제 저장 값 확인. 기존 row가 `"form_submit"`으로 저장되어 있다면 one-off migration script가 필요하며, 과도기 동안 API 응답에서 두 값을 모두 허용하는 defensive 파싱이 필요하다.

---

### [WARNING] `execution.waiting_for_input` WebSocket payload 구조 변경 (파일 45)

- **위치**: `spec/5-system/6-websocket-protocol.md` §4.4 / §4.4.5
- **상세**: payload 타입 시그니처가 `conversationThread?` 필드 추가로 확장됐다. 필드가 optional이므로 기존 클라이언트는 영향받지 않는다. 그러나 `conversationThread.turns[i]` 내부 구조(`seq`, `nodeId`, `nodeType`, `source`, `text`, `timestamp` 등)는 버저닝 없이 신규 정의되었고, 추후 v2에서 구조가 바뀔 경우 API 버전 없이 payload 스키마가 변경될 위험이 있다. v1/v2 경계가 스펙 텍스트에만 기재되고 payload 자체에 `apiVersion` 같은 메타 필드가 없다.
- **제안**: `conversationThread` 객체에 `version: "v1"` 같은 식별자를 포함하거나, 기존 WebSocket 이벤트 버저닝 정책이 있다면 해당 정책을 이 필드에도 명시적으로 적용한다.

---

### [INFO] `ExecutionContext` 인터페이스 breaking change — 테스트 fixture 전수 갱신 필요 (파일 1-8)

- **위치**: 8개 `.spec.ts` 파일 전체
- **상세**: `ExecutionContext`에 `conversationThread` 필드가 추가되어 기존 테스트 fixture가 모두 컴파일 오류를 일으켰다. 이를 수정하는 변경이므로 올바른 방향이다. 다만 이 패턴은 `ExecutionContext`가 내부 핸들러 API 계약임을 의미하며, 이 인터페이스를 구현하는 모든 node handler가 이 필드를 받을 준비가 되어 있어야 한다. 테스트는 `createEmptyConversationThread()`로 기본값을 넣고 있어 backward-safe하다.
- **제안**: `ExecutionContext` 인터페이스에서 `conversationThread`를 `conversationThread?: ConversationThread`(optional)로 선언하거나, 기본값 보장이 명확히 문서화되어야 한다. 현재 스펙(`§6.1 컨텍스트 구성 표`)에 "실행 시작 시 빈 thread로 초기화"가 명시되어 있어 런타임에는 항상 존재하나, 인터페이스 타입 레벨에서도 일관성이 필요하다.

---

### [INFO] `$thread` 표현식 변수 — 기존 워크플로우 표현식과의 충돌 가능성 미검증 (파일 44)

- **위치**: `spec/5-system/5-expression-language.md` §4.4
- **상세**: 신규 예약 변수 `$thread`가 추가됐다. 사용자가 기존 워크플로우에서 `$thread`라는 이름의 커스텀 변수나 node 이름을 이미 사용 중일 경우 충돌 가능성이 있다. 단, `$node["X"]` 참조 방식과는 별개이므로 일반적 충돌 위험은 낮다.
- **제안**: expression 엔진에서 `$thread`가 built-in reserved variable로 처리되고 사용자 정의 변수가 이를 override하지 못하도록 보장하는 코드 레벨 guard 확인.

---

## 요약

이번 변경의 핵심 API 계약 영향은 두 가지다. 첫째, WebSocket `execution.waiting_for_input` payload에 선택적 `conversationThread?` 필드가 추가됐다 — 이는 additive 변경으로 기존 클라이언트 하위 호환성을 유지한다. 둘째, `interaction_data.interactionType` enum 값 `"form_submit"` → `"form_submitted"` 정정이 DB 저장 데이터와 API 소비자 모두에 영향을 줄 수 있는 잠재적 breaking change다. 마이그레이션 전략이 현재 스펙에 미정으로 남아있어, 구현 착수 전 기존 저장 데이터 실태 확인이 필요하다. 내부 `ExecutionContext` 인터페이스 변경은 test fixture 전수 갱신으로 올바르게 처리됐다.

## 위험도

**LOW** — 외부 공개 API(REST 엔드포인트) 변경은 없다. WebSocket 변경은 additive하며 backward-compatible하다. `form_submit` → `form_submitted` enum 정정이 존재하지만, consistency check 리뷰(파일 21)에서 `node-output.md` CONVENTIONS가 이미 `form_submitted`를 사용하고 있었음이 확인됐으므로 코드 레벨에서 실제 저장값이 이미 `form_submitted`일 가능성이 높다.