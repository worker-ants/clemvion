# Cross-Spec 일관성 검토 결과

대상 draft: `plan/in-progress/spec-draft-chat-channel-error-notify.md`
검토 일시: 2026-05-25

---

## 발견사항

### [WARNING] `§3.5 비기능 요구사항` renumber 로 인한 내부 앵커 링크 파단

- **target 위치**: Change 1 — `spec/5-system/15-chat-channel.md` §1a 설명 ("기존 §3.5 → §3.6 으로 renumber")
- **충돌 대상**: `spec/5-system/15-chat-channel.md` Rationale 절 line 533
- **상세**: 현재 `15-chat-channel.md` 본문 Rationale R9 에는 `[CCH-NF-03](#35-비기능-요구사항)` 앵커 링크가 존재한다. draft 가 기존 §3.5(비기능 요구사항)를 §3.6 으로 renumber 하면 이 앵커 링크의 slug 는 `#35-비기능-요구사항` 에서 `#36-비기능-요구사항` 으로 변경되어야 한다. draft 는 이 링크 갱신을 영향 요약 표에 포함하지 않아 갱신 누락 위험이 있다.
- **제안**: `15-chat-channel.md` 의 Rationale R9 안의 `[CCH-NF-03](#35-비기능-요구사항)` 앵커를 `[CCH-NF-03](#36-비기능-요구사항)` 으로 함께 갱신. 또는 CCH-NF-01/02/03 ID 자체를 앵커 target 으로 쓰는 방식으로 변경하면 renumber 영향을 완전히 회피할 수 있다.

---

### [WARNING] Convention §3 매핑 표의 `execution.failed` 입력 필드 기술 변경 — EiaEvent 타입 선언과 비교 필요

- **target 위치**: Change 2a — `spec/conventions/chat-channel-adapter.md §3` 매핑 표 `execution.failed` 행 격상
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §1.2` 의 `EiaEvent` union 타입 선언
- **상세**: Convention §1.2 의 `execution.failed` union arm 은 `error: { code: string; message: string; nodeId: string | null; details?: unknown }` 로 선언되어 있다. draft 의 §2b 분류 helper 함수 `classifyExecutionFailure` 는 이 중 `event.error.code` 와 `event.error.details?.statusCode` 만 사용한다는 계약을 추가한다. 타입 자체의 변경은 없고 사용 제약(화이트리스트)만 추가하는 것이므로 엄밀한 타입 충돌은 아니다. 그러나 `details?: unknown` 으로 선언된 타입에서 `details?.statusCode` 를 `number` 로 접근하려면 구현 측에서 타입 단언 또는 타입 가드가 필요하다. Convention §1.2 의 `details` 타입이 `unknown` 으로 남아 있으면 분류 helper 의 TypeScript 구현 시 `details.statusCode` 접근이 컴파일 에러를 일으킨다.
- **제안**: Convention §1.2 의 `execution.failed` union arm 의 `details` 타입을 `details?: { statusCode?: number; [key: string]: unknown }` 수준으로 구체화하거나, 분류 helper 시그니처 안에 타입 단언 방식을 명시한다. spec 본문에서 구현 위험을 사전 명시하는 것이 바람직하다.

---

### [WARNING] EIA §6.4 `execution.failed` 페이로드의 `error.code` 예시값과 실제 ErrorCode enum 불일치 — 기존 문제, draft 범위 외이나 연관성 있음

- **target 위치**: Change 2b §3.1 분류 알고리즘 표 및 Change 6a — `spec/5-system/3-error-handling.md §1.4` cross-link
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §6.4` 의 `error.code` 예시 값
- **상세**: EIA §6.4 의 `execution.failed` 페이로드 예시는 `"NODE_FAILED" | "TIMEOUT" | "MAX_ITERATIONS" | "INTERNAL_ERROR" | ...` 로 기술되어 있다. 그러나 `3-error-handling.md §1.4` 의 실제 `ErrorCode` enum 은 `HTTP_4XX`, `HTTP_5XX`, `LLM_RATE_LIMIT`, `EXECUTION_TIMEOUT` 등 다른 이름을 사용한다. draft 는 실제 enum 코드 (`HTTP_4XX`, `HTTP_5XX` 등) 를 기준으로 분류 알고리즘을 작성하고 있어 실제 구현과는 정합하지만, EIA §6.4 의 예시 코드는 여전히 구 stub 값으로 남아 있다. draft 의 Change 6a (cross-link 추가) 는 이 문제를 간접적으로 드러내지만 EIA §6.4 의 예시값 갱신은 포함하지 않는다.
- **제안**: `spec/5-system/14-external-interaction-api.md §6.4` 의 `error.code` 예시 값을 실제 ErrorCode enum 대표 항목으로 갱신하는 작업을 본 draft 의 영향 범위 또는 별 후속 plan 으로 명시한다. draft 자체는 실제 enum 을 정확히 참조하고 있으므로 본 발견은 draft 를 차단하지 않으나, 소비자(어댑터 구현자)가 EIA §6.4 만 읽으면 잘못된 코드를 기대할 수 있다.

---

### [INFO] Convention §3 매핑 표 `execution.failed` 기존 기술 (`error.message` 입력) 과의 의미 전환 — 명시적 삭제 표기 필요

- **target 위치**: Change 2a — `spec/conventions/chat-channel-adapter.md §3` 매핑 표 기존 행 교체
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §3` 현재 행 (`| execution.failed | error.message | ...`)
- **상세**: 현재 spec 의 §3 매핑 표는 `execution.failed` 행의 입력 payload 를 `error.message` 로 기술한다. draft 는 이를 `error.code + error.details.statusCode` 로 교체한다고 기술하지만, "기존 → 신" 형태의 diff 로만 표현되어 있다. Changelog 에 명시되어 있기는 하나, 기존 `error.message` 입력 계약을 **삭제**한다는 것이 단순 확장이 아닌 파괴적 변경(breaking change)임을 본문에서 명시해야 한다. 기존 구현 코드가 `error.message` 를 사용하고 있다면 spec 변경 후 구현도 반드시 갱신해야 한다.
- **제안**: Convention §3 의 해당 행 갱신 설명에 "기존 `error.message` 입력 계약 폐기" 를 명시한다. developer 단계에서 기존 구현의 `renderNode execution.failed` 처리 코드를 반드시 갱신 대상으로 식별해야 한다.

---

### [INFO] Telegram §5 구조 확인 — §5.5 없음, §5.6 신설 위치 정합

- **target 위치**: Change 3a — `spec/4-nodes/7-trigger/providers/telegram.md §5.6 신설`
- **충돌 대상**: 현재 `telegram.md §5` 구조 (§5.1~§5.4 로 구성, §5.5 없음)
- **상세**: 현재 Telegram spec 의 §5 는 §5.1(AI Multi Turn) ~ §5.4(Carousel/Chart/Table) 로 구성되어 있고 §5.5 가 없다. draft 가 §5.6 으로 신설하면 §5.5 번호가 건너뛰어진다. Slack/Discord 는 이미 §5.5(Typing) 가 있어 §5.6 으로 연속되지만, Telegram 은 §5.4 다음 §5.6 으로 비연속 section 이 생긴다.
- **제안**: Telegram 의 경우 §5.5 로 명명하거나, 기존 §5.4 텍스트에 "구현 결과 §5.5 를 건너뜀" 과 같은 note 없이 §5.5 로 순차 번호를 부여하는 것이 더 자연스럽다. 또는 세 어댑터 spec 의 절 번호를 통일하려는 의도라면 Telegram 의 §5.5 위치(현재 없음)에 관련 내용 없는 placeholder 없이 그냥 §5.5 로 하는 것이 적절하다. 내부 cross-ref 파단 위험은 없으나 numbering 비일관이 독자 혼란을 유발할 수 있다.

---

### [INFO] `3-error-handling.md §1.4` cross-link 추가 — 기존 내용과의 정합 확인

- **target 위치**: Change 6a — `spec/5-system/3-error-handling.md §1.4` 하단 cross-link 한 줄
- **충돌 대상**: `spec/5-system/3-error-handling.md §1.4` 본문 마지막 note
- **상세**: 현재 §1.4 의 마지막 라인은 "구 에러 코드 `NODE_EXECUTION_FAILED` / `INTEGRATION_ERROR` / `LLM_ERROR` 는 노드 수준 envelope 에 더 이상 사용하지 않는다. 엔진 레벨(노드 실패가 Stop Workflow 로 격상된 경우)에서만 `NodeExecution.error.message` 컨텍스트로 남는다." 이다. draft 가 추가하는 한 줄 cross-link (`> Chat Channel 어댑터의 사용자 안내 메시지 분류는 본 enum 을 입력으로 사용한다...`) 는 기존 note 의 흐름과 이질적일 수 있다. 기술적 충돌은 없다.
- **제안**: 추가 note 를 기존 note 와 같은 blockquote 안에 붙이거나 별도 note 블록으로 분리하여 가독성을 유지한다. 내용 자체의 충돌은 없다.

---

### [INFO] `spec/conventions/chat-channel-adapter.md §7 변경 관리` 의무 — 본 draft 충족 여부

- **target 위치**: Change 2 전반 (Convention 갱신)
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §7 변경 관리`
- **상세**: Convention §7 은 "본 인터페이스 변경은 다음 두 spec 동시 갱신 의무: `spec/5-system/15-chat-channel.md` + `spec/4-nodes/7-trigger/providers/<name>.md`" 를 명시한다. draft 는 5개 spec 파일을 동시 갱신하므로 §7 의무를 충족한다. `_overview.md` 카탈로그 갱신 의무(`spec/4-nodes/7-trigger/providers/_overview.md` 인덱스)도 §7 에 명시되어 있다.
- **제안**: 영향 요약 표에 `spec/4-nodes/7-trigger/providers/_overview.md` 갱신이 필요한지 확인한다. §5.6 신설이 provider catalog 의 기능 표에 영향을 주는 경우 해당 파일도 동반 갱신 의무가 있다. draft 는 이 파일을 언급하지 않는다.

---

## 요약

본 draft (Chat Channel 실행 실패 안내 CCH-ERR-*) 는 전반적으로 기존 spec 과의 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 영역에서 직접적 충돌이 없다. CCH-ERR-* prefix 는 신규이고 기존 `CCH-{AD,CV,MP,SE,NF}-*` 와 충돌하지 않는다. Convention 의 6함수 인터페이스는 미변경이며 분류 helper 가 `renderNode` 내부에서 호출되는 구조도 pure function 계약을 유지한다. 다만 두 가지 주의 지점이 있다: 첫째, 기존 §3.5 를 §3.6 으로 renumber 할 때 같은 파일 내 Rationale R9 의 앵커 링크(`#35-비기능-요구사항`)가 파단될 위험이 있어 동반 갱신이 필요하다. 둘째, Convention §1.2 의 `details?: unknown` 타입이 분류 helper 의 `details?.statusCode` 접근을 TypeScript 레벨에서 수용하지 못하므로 구현 단계에서 타입 가드 또는 타입 상세화가 추가로 필요하다. 나머지는 INFO 수준의 명명 비일관 또는 동반 갱신 권장 항목이다.

---

## 위험도

LOW

---

STATUS: OK
