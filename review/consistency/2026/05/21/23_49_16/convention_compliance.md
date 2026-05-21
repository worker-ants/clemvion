# 정식 규약 준수 검토 결과

검토 모드: 구현 착수 전 (--impl-prep)
검토 대상:
- `spec/5-system/15-chat-channel.md`
- `spec/conventions/chat-channel-adapter.md`
- `spec/4-nodes/7-trigger/providers/telegram.md`
기준일: 2026-05-21

---

## 발견사항

### [WARNING] `telegram.md` 의 §5.4 보안 섹션이 구조적으로 잘못된 위치에 배치됨
- **target 위치**: `spec/4-nodes/7-trigger/providers/telegram.md` — `## 5.4 보안` (라인 144)
- **위반 규약**: CLAUDE.md §"정보 저장 위치" + `spec/conventions/chat-channel-adapter.md` §5 Adapter Registry — 신규 provider 명세의 섹션 구조는 `_overview.md §2` 신규 provider 추가 절차에서 "Overview / Bot API 매핑 / 명령 매핑 / 인터랙션 노드 UI 매핑 / 보안 / 비기능 / Rationale" 7섹션 구조를 명시적으로 규정
- **상세**: 보안 섹션이 `## 5.4 보안` 으로 번호가 매겨져 있어 §5 (인터랙션 노드 UI 매핑 섹션) 의 하위 절처럼 보인다. `_overview.md` 의 섹션 구조 규정에 따르면 보안은 독립 최상위 섹션(`## 5. 보안` 또는 `## 5. 인터랙션 노드 UI 매핑` 이후 `## 6. 보안`)으로 분리되어야 한다. 실제로 telegram.md 에서 `## 6. 명령 처리` 와 `## 7. 비기능` 은 독립 최상위 섹션으로 있고 보안만 `## 5.4` 로 위치 — 문서 내부에서도 일관성이 깨짐.
- **제안**: `## 5.4 보안` 을 `## 5. 보안` 으로 승격하고, `## 6. 명령 처리` / `## 7. 비기능` 을 각각 `## 6.` / `## 7.` 로 유지 (번호 재정렬). 또는 `_overview.md` 의 섹션 순서 규정을 현행 telegram.md 의 실제 구조로 갱신.

---

### [WARNING] `spec/5-system/15-chat-channel.md` 의 본문 섹션 번호가 Overview 다음에 3 으로 재시작
- **target 위치**: `spec/5-system/15-chat-channel.md` — `## 3. 처리 흐름` (라인 75)
- **위반 규약**: CLAUDE.md §"정보 저장 위치" — 문서 구조는 Overview / 본문 / Rationale 3섹션 권장. `spec/5-system/` 내 기존 파일(예: `12-webhook.md`, `14-external-interaction-api.md`)과의 일관성
- **상세**: 문서 상단에 `## Overview (제품 정의)` 안에 §1 개요 / §2 사용 시나리오 / §3 요구사항 이 있고, 이어지는 본문 섹션이 `## 3. 처리 흐름` 으로 시작한다. 이는 Overview 내부의 §3 (요구사항) 과 최상위 `## 3.` 이 동일 번호로 충돌하는 것처럼 보여 내비게이션 혼란을 유발한다. 특히 앵커 링크 (`#3-처리-흐름` vs Overview 안의 §3.x) 가 모호해짐.
- **제안**: 본문 섹션 번호를 4부터 시작하도록 조정 (`## 4. 처리 흐름` 등), 또는 Overview 내부의 소섹션을 번호 없이 문자열 제목으로 통일. 단, 기존 외부 문서 참조 앵커가 있으면 그 앵커도 동시에 갱신 필요.

---

### [WARNING] API endpoint `POST /api/triggers/:id/chat-channel/rotate-bot-token` 가 `spec/5-system/2-api-convention.md` 의 중첩 depth 규칙을 초과
- **target 위치**: `spec/5-system/15-chat-channel.md` — CCH-SE-04 (`§3.4`, 라인 63) 및 §8 호환성 (라인 279)
- **위반 규약**: `spec/5-system/2-api-convention.md §2.2` — "중첩은 2단계까지 (`/api/{resource}/{id}/{sub-resource}`). 3단계 이상은 최상위로 분리"
- **상세**: `POST /api/triggers/:id/chat-channel/rotate-bot-token` 는 `/api/triggers/{id}/chat-channel/rotate-bot-token` 로 depth 4 (`triggers → :id → chat-channel → rotate-bot-token`). API 규약의 "중첩 2단계 제한" 을 2단계 초과한다. EIA 의 `/api/triggers/:id/notification/rotate-secret` 역시 같은 패턴이므로 관례적 예외가 정착했을 수 있지만 규약 문서 자체에는 이 예외가 명시되어 있지 않다.
- **제안**: (1) API 규약에 "RPC-style action endpoint 의 예외: `/api/{resource}/{id}/{channel}/{action}` 허용" 을 명시 추가, 또는 (2) `POST /api/triggers/:id/rotate-chat-channel-token` 으로 flatten. 만약 EIA 와 동일 패턴이 관례로 굳어졌다면 규약 갱신이 적절.

---

### [INFO] `spec/conventions/chat-channel-adapter.md` 에 CHANGELOG 섹션 부재
- **target 위치**: `spec/conventions/chat-channel-adapter.md` — 문서 전체
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md §7 CHANGELOG` 패턴 — 동일 conventions 디렉토리 내 문서들이 CHANGELOG 섹션을 유지함으로써 인터페이스 진화 이력을 추적
- **상세**: `node-output.md` / `conversation-thread.md` / `cafe24-api-metadata.md` 등 기존 conventions 파일들이 CHANGELOG 를 보유한 경우 아직 확인되지 않았으나, `cafe24-api-catalog/_overview.md` 가 §7 CHANGELOG 를 유지한다. `chat-channel-adapter.md` 는 6함수 인터페이스가 변경될 경우 이력 추적 수단이 없다. 규약 자체 변경을 §7 변경 관리로 선언하고 있으나 CHANGELOG 표는 없다.
- **제안**: `## Changelog` 섹션을 Rationale 뒤에 추가하고 `| 2026-05-21 | 최초 작성 — 6함수 인터페이스 도입 |` 를 초기 row 로 등재. 이후 인터페이스 변경 시 이 표를 갱신.

---

### [INFO] `telegram.md` 의 `## 3.` 섹션 제목이 `_overview.md` 의 명세 섹션 순서와 상이
- **target 위치**: `spec/4-nodes/7-trigger/providers/telegram.md` — `## 3. Bot API 호출 매핑` (라인 25)
- **위반 규약**: `spec/4-nodes/7-trigger/providers/_overview.md §2` — 신규 provider 추가 시 "Overview / Bot API 매핑 / 명령 매핑 / 인터랙션 노드 UI 매핑 / 보안 / 비기능 / Rationale" 순서를 채택할 것을 규정
- **상세**: `_overview.md` 가 명시한 섹션 순서는 "보안" 이 "인터랙션 노드 UI 매핑" 다음이다. `telegram.md` 는 `## 3. Bot API 호출 매핑 / ## 4. 명령 매핑 / ## 5. 인터랙션 노드 UI 매핑 / ## 5.4 보안 / ## 6. 명령 처리 / ## 7. 비기능` 으로 되어 있어 `## 6. 명령 처리` 가 `_overview.md` 의 "명령 매핑" 에 해당하는 섹션과 이름이 달라 순서 추적이 어렵다. 또한 `_overview.md` 는 "명령 매핑" 을 3번째로 규정했는데 실제 `telegram.md` 는 "명령 매핑 (`parseUpdate`)" 를 §4 로, "명령 처리" 를 별도 §6 으로 분리하여 카탈로그 예시 구조보다 섹션이 1개 더 많다.
- **제안**: 이 분리 자체는 합리적이므로 `_overview.md §2` 의 섹션 구조 예시를 실제 telegram.md 의 7섹션 구조(Bot API 매핑 / parseUpdate 매핑 / 인터랙션 노드 UI 매핑 / 보안 / 명령 처리 / 비기능 / Rationale)로 갱신하여 신규 provider 추가자가 올바른 구조를 참고하도록 할 것.

---

### [INFO] `EiaEvent` 타입 정의에서 `execution.cancelled` 의 주석 참조가 오기
- **target 위치**: `spec/conventions/chat-channel-adapter.md` §1.2 — `EiaEvent` union 마지막 member (라인 72)
- **위반 규약**: 규약 내 내부 일관성 — `execution.cancelled` 의 주석이 `/* EIA §6.5 */` 로 표시되어 있으나 바로 위의 `execution.ai_message` 도 `/* EIA §6.5 + WS §4.4 ai_message */` 로 §6.5 를 참조. 두 이벤트가 동일 섹션 번호를 공유하는 것은 EIA spec 에 `execution.cancelled` 의 정확한 섹션 번호가 다를 경우 오기.
- **제안**: EIA spec (`spec/5-system/14-external-interaction-api.md`) 의 실제 섹션 번호를 확인하여 `execution.cancelled` 의 `/* EIA §6.x */` 주석을 올바른 번호로 정정. 이는 drift 방지를 위한 SoT 참조의 정확성 문제.

---

## 요약

세 문서는 전반적으로 이 프로젝트의 spec 작성 패턴(Overview / 본문 / Rationale 3섹션, 상호 참조 링크, Rationale 의 대안 비교 서술)을 잘 따르고 있으며, `_product-overview.md` / `0-` prefix / `spec/conventions/` 위치 배치 등의 명명 컨벤션도 준수한다. 핵심 우려는 두 가지다. (1) `telegram.md` 의 `## 5.4 보안` 섹션이 독립 최상위 섹션이어야 함에도 하위절로 배치된 구조 오류는 카탈로그 섹션 순서 규칙과 직접 충돌하며, (2) `POST /api/triggers/:id/chat-channel/rotate-bot-token` endpoint 가 `spec/5-system/2-api-convention.md` 의 중첩 2단계 제한을 초과하므로 규약 예외 명시 또는 URL 변경 중 하나가 필요하다. 두 사항 모두 구현 착수 전에 정리하면 이후 코드 리뷰 단계에서의 마찰을 줄일 수 있다.

---

## 위험도

**LOW**

구조 오류(§5.4 섹션 배치)와 API 규약 깊이 초과는 구현 중 혼란을 줄 수 있으나 EIA 의 동일 패턴 전례가 있어 시스템 invariant 를 즉각 파괴하지는 않는다. 규약 갱신 또는 소규모 문서 수정으로 해소 가능.
