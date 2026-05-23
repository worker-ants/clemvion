# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/spec-telegram-chat-channel-ui-polish.md`
검토 일시: 2026-05-23
검토자: 신규 식별자 충돌 검토 sub-agent

---

## 발견사항

### [WARNING] `R-CC-10` / `R-CC-11` / `R-CC-12` 와 기존 `15-chat-channel.md` Rationale ID 명명 패턴 불일치

- **target 신규 식별자**: `R-CC-10`, `R-CC-11`, `R-CC-12` — `spec/5-system/15-chat-channel.md` Rationale 절에 추가 예정
- **기존 사용처**: `spec/5-system/15-chat-channel.md` Rationale 절의 `R1` ~ `R9`, `R-K` (prefix 없는 단순 정수 + 단문자 패턴). `spec/5-system/14-external-interaction-api.md` Rationale 절의 `R10`, `R11`, `R12` (prefix 없는 연속 정수 패턴, 외부 참조 표기 `EIA §R10` 으로 구분).
- **상세**: target plan 은 `15-chat-channel.md` 내부 신규 Rationale 에 `R-CC-` prefix 를 도입한다. 기존 동 파일의 로컬 Rationale 은 prefix 없이 `R1`~`R9` 형식을 사용하고, `R-K` 만 하이픈+문자 패턴의 예외다. 신규 도입 이유(plan §"Rationale ID 컨벤션")는 "EIA §R10 외부 참조와 혼동 방지"로 정당하나, 이는 이미 기존 파일에서 `[EIA §R10]` 과 같이 외부 namespace 를 명시한 하이퍼링크 형식으로 충분히 구분되고 있다. `R-CC-10` 도입 후 동 파일 안에 `R1`~`R9` (이전 형식), `R-K` (혼성), `R-CC-10`~`R-CC-12` (신규 형식) 세 가지 패턴이 공존해 오히려 Rationale ID 컨벤션 일관성이 저하된다. 실제 충돌(같은 ID 이 다른 의미로 사용)은 아니지만 동일 파일 내 3종 명명 패턴 혼재는 reader 혼동을 유발할 수 있다.
- **제안**: (a) 기존 패턴(`R10`, `R11`, `R12` — 동 파일 로컬 고유 맥락으로 EIA 참조와 실질적 충돌 없음)을 그대로 사용하거나, (b) `R-CC-` 도입과 함께 기존 `R1`~`R9` 도 `R-CC-1`~`R-CC-9` 로 일괄 rename 해 파일 전체를 한 패턴으로 정렬하거나, (c) plan 의 Rationale 절에 "이 파일 안에서는 신규 항목에 `R-CC-` prefix 를 사용하며 기존 `R1~R9` 는 prefix 없는 구 형식"임을 명시해 reader 에게 이중 컨벤션 공존을 투명하게 공시 — 세 옵션 중 선택. 단, 기존 항목 rename 시 외부 파일(`conventions/chat-channel-adapter.md`, `telegram.md`)의 `R4`, `R8` 등 cross-link 가 깨지지 않도록 주의.

---

### [WARNING] `visualNode` 값 `"text"` 와 `KeyboardHint` 의 `"text"` — 동일 파일 내 동일 문자열 리터럴, 다른 의미

- **target 신규 식별자**: `visualNode` enum 값 `"text"` (`text_only` rename) — `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig.uiMapping.visualNode`
- **기존 사용처**: `spec/conventions/chat-channel-adapter.md §2.2 KeyboardHint` — `"text"` 가 keyboard input type hint 값으로 이미 존재 (line 121)
- **상세**: 같은 파일(`chat-channel-adapter.md`) 안에서 `visualNode?: "photo" | "text"` (시각 렌더 모드 — 텍스트 fallback을 의미) 와 `KeyboardHint = "text" | "number" | …` (form field 의 텍스트 입력 hint 를 의미) 가 동시에 존재한다. 두 개념이 완전히 다른 type 컨텍스트에 위치(별개의 interface/type 선언)하므로 TypeScript 타입 레벨의 실제 충돌은 없다. 그러나 같은 파일을 읽는 사람이 "text" 를 맥락 없이 접할 때 두 의미 중 하나로 혼동할 수 있다. target plan 은 이 문제를 인지하고 type 선언 옆에 주석 추가(`// 'text' 는 시각 렌더 모드 — 동 파일 §2.2 KeyboardHint 의 'text' (입력 hint) 와 의미 다름`)를 명시하고 있다.
- **제안**: target 의 계획(주석 추가)이 충분한 경감책이다. 다만 해당 주석이 실제 spec 작성 시 `uiMapping.visualNode` type 선언 라인 **옆에** 인라인으로 위치하는지 확인 필요. 추가 강화 옵션으로 §2.2 `KeyboardHint` 정의 블록에도 역방향 주석(`// 이 'text' 는 입력 hint — §2.3 uiMapping.visualNode 의 'text' (시각 렌더 모드) 와 의미 다름`) 추가를 고려할 수 있다.

---

### [INFO] `R-8` — `spec/2-navigation/2-trigger-list.md` 내 다음 Rationale ID 슬롯 확인

- **target 신규 식별자**: `R-8` — `spec/2-navigation/2-trigger-list.md` Rationale 절에 "chatChannel 카드 분리" 정당화로 추가 예정
- **기존 사용처**: 동 파일 Rationale 절에 `R-1` ~ `R-7` 이 순서대로 존재 (가장 최근 `R-7` = "detail drawer 에서 Recent Calls 카드 제거"). `R-8` 슬롯은 현재 비어 있다.
- **상세**: 순차 번호 체계에서 다음 번호를 사용하는 것이므로 충돌 없음. 기존 `R-1`~`R-7` 의 Rationale 항목 중 `R-8` 과 동일 id 를 가진 항목이 없음을 확인.
- **제안**: 이슈 없음. 현황 확인 정보.

---

### [INFO] `hasBotToken` 파생 필드 — 기존 코드베이스/spec 에서 사전 사용 여부

- **target 신규 식별자**: `hasBotToken: boolean` — `spec/5-system/15-chat-channel.md §5.4` 에 신설 예정 (응답 DTO 전용 파생 필드, DB 컬럼 아님)
- **기존 사용처**: 전체 `spec/` 경로에서 `hasBotToken` 미사용 확인.
- **상세**: 동 파일(`15-chat-channel.md`) 이나 `1-data-model.md §2.8 Trigger` 테이블, `chat-channel-adapter.md`, `2-trigger-list.md` 어디에도 `hasBotToken` 이 존재하지 않는다. 신규 DTO 파생 필드로 도입 시 충돌 없음. `Integration` 엔티티의 `autoRefresh: boolean` 파생 필드 패턴(`1-data-model.md §2.10`)과 동일 구조(DB 컬럼 아님 + 응답 DTO 전용 + 계산 책임 명시)이며 일관성 있다.
- **제안**: 이슈 없음.

---

### [INFO] `§5.5 Inbound HTTP Contract` — `15-chat-channel.md` 신규 섹션

- **target 신규 식별자**: `spec/5-system/15-chat-channel.md §5.5` 신설
- **기존 사용처**: 동 파일에 `§5.4`(`Bot Token Rotation API 응답 계약`)까지 존재. `§5.5` 슬롯은 현재 비어 있다.
- **상세**: 충돌 없음. `§5.4` 다음 번호를 사용하는 순차 추가다.
- **제안**: 이슈 없음.

---

### [INFO] `R-CC-12` 와 EIA 내부 `R12` — 파일이 다르므로 실제 충돌 없음

- **target 신규 식별자**: `R-CC-12` — `spec/5-system/15-chat-channel.md` 에 신설 예정 (결정 4 Rationale)
- **기존 사용처**: `spec/5-system/14-external-interaction-api.md Rationale §R12` — "HMAC 알고리즘 표기 — inbound vs outbound 분리". 다른 파일에 다른 의미로 존재.
- **상세**: 서로 다른 파일에 위치하므로 직접 충돌은 없다. `15-chat-channel.md` 안에서 `[EIA §R12]` 형식의 외부 참조가 생겼을 때 `R-CC-12` 와의 혼동 가능성이 이론적으로 존재하나, 현재 `15-chat-channel.md` 에서 EIA R12 를 참조하는 문장이 없고, target plan 의 결정 4 Rationale 도 EIA R12 를 인용하지 않는다. 이 점에서 `R-CC-` prefix 도입의 예방적 효과가 실증된다.
- **제안**: 이슈 없음. WARNING [상단] 에서 제기한 "파일 내 3종 패턴 혼재" 의 맥락에서 함께 판단.

---

### [INFO] `BOT_TOKEN_INVALID` 에러 코드 — 기존 정의 재사용

- **target 신규 식별자**: `BOT_TOKEN_INVALID` — target plan 이 "이미 `15-chat-channel.md §5.4` 에 정의됨"으로 언급하며 재확인
- **기존 사용처**: `spec/5-system/15-chat-channel.md` line 264에서 이미 정의됨. 다른 spec 파일에서 동일 코드를 다른 의미로 사용하는 케이스 없음.
- **상세**: 충돌 없음. target 은 신규 도입이 아니라 기존 정의를 cross-link 한다.
- **제안**: 이슈 없음.

---

### [INFO] `VALIDATION_ERROR` + `details.field='botTokenRef'` — 기존 에러 코드 재사용

- **target 신규 식별자**: `400 VALIDATION_ERROR details.field='botTokenRef'` — PATCH 시 `botTokenRef` 직접 변경 차단 응답
- **기존 사용처**: `spec/5-system/3-error-handling.md` 및 `spec/2-navigation/2-trigger-list.md`에서 `VALIDATION_ERROR` 가 이미 범용 400 에러 코드로 정의·사용 중.
- **상세**: `VALIDATION_ERROR` 자체는 범용 코드이며, `details.field` 로 필드 수준 세분화가 기존 패턴과 동일하다(예: `details.field='type'` 는 Schedule 타입 PATCH 차단에 이미 사용). 충돌 없음.
- **제안**: 이슈 없음.

---

## 요약

target 의 신규 식별자 중 실제 의미 충돌(동일 식별자가 다른 의미로 이미 사용 중인 경우)은 발견되지 않았다. `hasBotToken`, `§5.5`, `R-8`, `BOT_TOKEN_INVALID`, `VALIDATION_ERROR` 등 모두 기존 코드베이스·spec 에서 미사용이거나 범용 패턴의 일관된 확장이다. 두 건의 WARNING 이 발견됐다: 첫째, `spec/5-system/15-chat-channel.md` 안에서 `R-CC-` prefix 신규 도입으로 기존 `R1`~`R9` (prefix 없음), `R-K` (혼성), `R-CC-*` (prefix 있음) 세 가지 Rationale ID 패턴이 공존하게 되어 일관성 저하가 우려된다 — 동 파일 전체를 단일 패턴으로 정렬하거나 공존 사실을 파일 내 명시적으로 선언하는 것이 권장된다. 둘째, `visualNode` 값 `"text"` 와 `KeyboardHint` 의 `"text"` 가 같은 파일에서 다른 의미로 존재하나, target 이 이미 인라인 주석으로 경감책을 포함하고 있어 위험도는 낮다.

---

## 위험도

LOW
