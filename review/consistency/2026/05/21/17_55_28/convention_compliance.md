# 정식 규약 준수 검토 — convention_compliance

**검토 대상**: `plan/in-progress/spec-draft-chat-channel.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일자**: 2026-05-21

---

## 발견사항

### [WARNING] 신설 spec 파일 `spec/conventions/chat-channel-adapter.md` 의 위치 선택에 Rationale 불일치

- target 위치: §2.2 "신설 — `spec/conventions/chat-channel-adapter.md`"
- 위반 규약: CLAUDE.md 정보 저장 위치 표 — "정식 규약: `spec/conventions/<name>.md`"
- 상세: `spec/conventions/` 는 **형식 규약(formal conventions)**만 보관하는 경로다. target draft 자체도 §R-G 에서 "`conventions/chat-channel-providers/<name>.md` 는 기각 — convention 은 형식 규약이라 텔레그램 어댑터 구체 명세가 아님"이라고 올바르게 분석했다. 그런데 adapter 인터페이스 규약(`chat-channel-adapter.md`)은 **공통 인터페이스·데이터 타입 계약**이므로, 형식 규약(`spec/conventions/`)에 둘 수 있는지를 더 명확히 논증해야 한다. 기존 `spec/conventions/` 목록에는 `node-output.md`, `conversation-thread.md`, `swagger.md`, `migrations.md`, `i18n-userguide.md` 등 **범 시스템 적용 규칙**이 있다. Chat Channel adapter interface 는 채널 어댑터 구현자(개발자)가 지켜야 하는 구현 계약에 가까우므로, `spec/conventions/` 적합성이 성립한다고 볼 여지가 있으나, `spec/5-system/15-chat-channel.md` 본문 하위 인터페이스 절로 통합하거나 반대로 `spec/conventions/` 에 두는 근거를 Rationale 에서 **명시적으로** 기술하지 않으면 일관성 판단이 불분명하다.
- 제안: §8 Rationale 섹션에 "chat-channel-adapter.md를 spec/conventions/ 에 두는 이유 — 어댑터 구현자가 준수해야 할 범-채널 공통 인터페이스 계약이므로 node-output.md / conversation-thread.md 와 동일 계층에 위치시킴"을 명시한다. 이로써 R-G 의 "공급사별 구체 spec 은 conventions 제외" 논리와의 차별점을 명확히 한다.

---

### [WARNING] `spec/conventions/chat-channel-adapter.md` 에서 인터페이스 함수 수가 표제 명칭과 불일치

- target 위치: §2.2, §4.3 (4.3 표 제목 "5함수 규약")
- 위반 규약: 해당 컨벤션 자체 내 일관성 — 명명이 내용과 일치해야 한다는 기본 일관성 원칙
- 상세: §2.2 는 "**5함수 규약** (`parseUpdate` / `setupChannel` / `teardownChannel` / `renderNode` / `sendMessage` / `ackInteraction`)"이라고 명시한다. 괄호 안의 함수는 **6개**다. §4.3 표도 "5함수 규약"이라는 제목을 달고 있으나 실제로 6행(setupChannel, teardownChannel, parseUpdate, renderNode, sendMessage, ackInteraction)을 열거한다. 이 수치 불일치가 향후 spec 본문에 그대로 옮겨지면, 구현자가 "누락된 함수가 무엇인가"를 검색하는 혼란이 생긴다.
- 제안: "5함수 규약" → "6함수 규약"으로 수정하거나, `ackInteraction` 을 설계 의도상 별도로 분리한다면 그 이유를 본문에 기술하고 "5함수 + 1 optional ack" 형태로 명시한다.

---

### [INFO] `spec/4-nodes/7-trigger/providers/telegram.md` — providers 서브디렉토리 신설의 CLAUDE.md 명명 패턴 검토

- target 위치: §2.3, §R-G
- 위반 규약: CLAUDE.md 의 폴더 구조 및 정보 저장 위치 표
- 상세: 기존 `spec/4-nodes/7-trigger/` 는 `0-common.md` / `1-manual-trigger.md` 만 존재한다. `providers/` 서브디렉토리를 신설하는 결정은 §R-G 에서 Rationale 로 잘 논증되어 있다. CLAUDE.md 에는 서브디렉토리 신설을 금지하는 조항이 없으며, `spec/conventions/cafe24-api-catalog/` 가 같은 패턴을 사용한다. 그러나 `cafe24-api-catalog/` 의 경우 인덱스 역할의 `_overview.md` 를 두는 것이 해당 폴더 규약(`cafe24-api-catalog/_overview.md`)에서 확인된다. 신규 `providers/` 디렉토리에도 `_overview.md` 또는 `0-common.md` 수준의 인덱스 파일이 필요한지 여부가 draft 에 언급되지 않았다.
- 제안: `spec/4-nodes/7-trigger/providers/` 를 신설할 때 `providers/0-overview.md` (또는 `_overview.md`) 의 필요성을 draft 에 명시한다. 단일 파일(`telegram.md`)만으로 시작하는 경우 인덱스 없이도 무방하나, Slack/카카오 등이 추가될 때를 대비해 디렉토리 SoT 역할의 인덱스 파일 계획을 Rationale 에 한 줄 추가한다.

---

### [INFO] `spec/5-system/15-chat-channel.md` — spec 문서 3섹션 구조(Overview / 본문 / Rationale) 배치 확인

- target 위치: §3 전체 ("15-chat-channel.md 본문 핵심")
- 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale): 각 SKILL.md 참고"
- 상세: draft §3.1 은 Overview, §3.2~3.6 은 본문, §8의 R-A~R-G 가 Rationale 로 분산 배치될 예정임을 명시하고 있다. 구조 자체는 CLAUDE.md 권장 3섹션을 따른다. 한 가지 확인할 점은, §3.2 요구사항 표의 ID prefix `CCH-*` 가 기존 spec 의 prefix 패턴과 일치하는가이다. 기존 spec 을 보면 `WH-EP-*`, `WH-SC-*`, `EIA-NX-*`, `EIA-IN-*` 처럼 `<도메인>-<범주>-<번호>` 구조를 사용한다. draft 의 `CCH-AD-*`, `CCH-CV-*`, `CCH-MP-*`, `CCH-SE-*`, `CCH-NF-*` 도 같은 패턴을 따르므로 문제없다. 요구사항 수가 많고 범주가 5개(AD/CV/MP/SE/NF)이므로, spec 본문 작성 시 각 범주에 소절(§3.2.1, §3.2.2 등)을 두는 것이 가독성을 높인다 (강제 규약은 아님).

---

### [INFO] EIA API endpoint `POST /api/triggers/:id/chat-channel/rotate-token` 명명 스타일

- target 위치: §3.2 CCH-SE-04
- 위반 규약: `spec/conventions/swagger.md` §2-4 (상태 코드 규칙) 및 `spec/5-system/2-api-convention.md` (기존 API 컨벤션)
- 상세: `POST /api/triggers/:id/chat-channel/rotate-token` 는 kebab-case path + 동사(`rotate-token`) 를 경로로 사용한다. 기존 API 컨벤션(`spec/5-system/2-api-convention.md`)의 REST 명명 패턴을 확인하지 못했으나, 관행적으로 REST에서 동사 suffix endpoint 는 RPC 스타일이다. 프로젝트가 이미 `/api/hooks/:endpointPath`, `/api/external/executions/:id/interact` 형식을 사용하고 있어, `rotate-token` 동사 suffix 패턴이 기존 API와 이질적일 수 있다. 권장 대안: `POST /api/triggers/:id/chat-channel/token` (새 token 발급 의미).
- 제안: spec 본문 작성 전에 `spec/5-system/2-api-convention.md`의 endpoint 명명 규칙을 확인하고, 동사 suffix 패턴이 허용되는지 명시적으로 검증한다. 허용 또는 기각 근거를 Rationale 에 한 줄 추가.

---

### [INFO] `ChannelConversation` Redis key 패턴의 conventions 적용 여부

- target 위치: §3.4.3 (ChannelConversation key)
- 위반 규약: 직접적인 Redis key 명명 규약 문서(`spec/conventions/`)가 존재하지 않음 — INFO 수준
- 상세: `chat-channel:{triggerId}:{conversationKey}` 형태는 기존 Redis 사용 패턴(명시적 conventions 없음)과 일관성을 확인할 수 없다. spec/conventions/ 에 Redis key 명명 규약이 없으므로 위반은 아니다. 단, 향후 Redis key 규약이 생길 때를 대비해 패턴 선택 근거(colon separator, 계층형)를 Rationale 에 한 줄 남기는 것을 권장한다.

---

## 요약

target draft(`plan/in-progress/spec-draft-chat-channel.md`)는 전반적으로 CLAUDE.md 의 정식 규약 준수 기준을 잘 따르고 있다. 요구사항 ID prefix(`CCH-*`), spec 3섹션 구조(Overview/본문/Rationale), 단일 진실 원칙(SoT 분리·cross-link), 금지 항목(새 트리거 유형 신설 금지·in-process facade로 EIA 소비)이 모두 올바르게 적용되어 있다. 주목할 발견사항은 두 가지다. 첫째, `spec/conventions/chat-channel-adapter.md` 의 배치 적합성을 뒷받침하는 Rationale이 현재 draft 에서 충분히 기술되지 않아 CLAUDE.md 의 단일 진실 원칙 위치 표에 대한 해석 여지가 있다(WARNING). 둘째, "5함수 규약"이라는 표제와 실제 6개 함수 목록의 불일치가 draft 전반에 반복된다(WARNING). 나머지 발견사항은 가독성·선제적 명명 검토 수준의 INFO 이다. CRITICAL 위반은 없다.

## 위험도

LOW

---

STATUS: SUCCESS
