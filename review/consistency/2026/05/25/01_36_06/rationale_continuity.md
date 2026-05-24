# Rationale 연속성 검토 결과

검토 모드: `--impl-prep`
대상 문서: `spec/5-system/15-chat-channel.md`, `spec/5-system/11-mcp-client.md`, `spec/5-system/6-websocket-protocol.md`
검토 기준: 과거 spec Rationale 에서 기각·폐기된 결정의 재도입, 합의 원칙 위반, 결정의 무근거 번복, 암묵적 가정 충돌

---

## 발견사항

### 1. INFO — `chat-channel.md` R8 의 fan-out 구조 기술이 EIA R10 본문과 미세 표현 차이

- **target 위치**: `spec/5-system/15-chat-channel.md §3.2` 및 Rationale R8 (R8. Fan-out facade 의 분리, 2026-05-22 갱신 2026-05-24)
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md` Rationale R10 ("WebsocketService 단일 sink 정책의 확장")
- **상세**: EIA R10 본문은 `NotificationDispatcher` 의 fan-out 책임을 "(a) Redis pub/sub + (b) in-process EventEmitter + (c) 외부 HTTP POST" 세 갈래로 규정하며, Chat Channel 어댑터는 "(b) in-process EventEmitter 의 listener" 로 명시한다. 15-chat-channel.md 의 R8 (2026-05-24 갱신) 은 실제 코드 구조를 반영해 fan-out source 가 `WebsocketService.executionEvents$` RxJS Subject 이고, `ChatChannelDispatcher` 가 별 모듈에 분리되어 있다고 기술한다. 두 spec 이 서로 다른 추상 수준(EIA R10 = `NotificationDispatcher` 중심, R8 = 실제 코드 구조)으로 fan-out 경로를 기술해, 구현자가 "EventEmitter listener 인가, RxJS Subject 구독인가"를 두 doc 을 교차 독해해야 한다. 기각·번복은 없으나 표현 수준 불일치로 혼동 여지가 남음.
- **제안**: `15-chat-channel.md §3.2` 또는 R8 에 "fan-out source 의 추상 계층 표기는 EIA R10 기준(EventEmitter 인터페이스)이고, 구현 상세(RxJS Subject)는 R8 에 한정한다"는 범위 명시 1행을 추가해 독자 혼동 해소. 또는 EIA R10 하단 각주에 "Chat Channel R8 이 코드 구조를 상세 기술" 역참조 추가.

---

### 2. INFO — `chat-channel.md` CCH-CV-03 `running` 케이스 대기 큐 기각 결정이 CCH-NF-03 rate-limit 큐와 병존 시 개념 구분 명시 미흡

- **target 위치**: `spec/5-system/15-chat-channel.md §3.2 CCH-CV-03` 및 Rationale R9
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md` Rationale R9 ("CCH-CV-03 running 케이스의 큐잉 vs 즉시 안내", 2026-05-22)
- **상세**: R9 는 `running` 케이스에서 "Redis 큐에 임시 적재 → `waiting_for_input` 도달 시 자동 재발사" 를 명시적으로 기각했다. 그러나 §3.5 CCH-NF-03 은 "채널당 분당 60건 초과 시 어댑터의 chat 단위 큐에 적재"를 정의한다. 두 "큐" 개념이 같은 spec 내에 존재해, 구현자가 CCH-NF-03 의 rate-limit 큐를 CCH-CV-03 의 기각된 running 큐와 혼동할 위험이 있다. R9 자체에는 "두 큐 정책이 다른 트리거 조건" 임을 명시하고 있으나, CCH-NF-03 본문에는 그 구분이 없다.
- **제안**: CCH-NF-03 비고에 "이 큐는 외부 사용자 폭주 방어용 rate-limit 큐이며, `running` 케이스의 incoming update 적재 정책(R9)과 별개" 한 줄 명시.

---

### 3. INFO — `mcp-client.md` stdio 미지원 기각 결정이 §2.2 본문에만 있고 Rationale 절에 별도 항목 없음

- **target 위치**: `spec/5-system/11-mcp-client.md §2.2` ("stdio 미지원 사유")
- **과거 결정 출처**: (동일 문서 내 §2.2 인라인 기술)
- **상세**: 11-mcp-client.md 는 stdio transport 를 "멀티테넌트 SaaS 에서 프로세스·보안 격리 부담 + 임의 명령 실행 권한 노출 위험" 을 이유로 미지원 결정을 §2.2 본문 안에 inline 기술한다. 그러나 본 spec 에는 `## Rationale` 절이 없다. CLAUDE.md 규약 ("결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`")에 따르면 이 결정 근거는 `## Rationale` 절로 이동해야 한다. 기각 이유가 본문에 inline 되어 있는 것은 규약 불일치이나 내용 자체의 Rationale 연속성 문제는 아님.
- **제안**: `spec/5-system/11-mcp-client.md` 말미에 `## Rationale` 절 신설 후, stdio 미지원 / websocket 미지원 / Internal Bridge 채택 이유 등 §2 의 인라인 근거를 이관. 본문은 "what" 만, Rationale 은 "why" 만 남기는 원칙 적용.

---

### 4. INFO — `mcp-client.md` §4.3 "세션 풀 미도입" 결정의 Rationale 분리 미완

- **target 위치**: `spec/5-system/11-mcp-client.md §4.3` ("동시성 / 풀링")
- **과거 결정 출처**: (동일 문서 §4.3 인라인 — "사용자 격리·세션 라이프사이클의 단순함을 위해 의도적으로 풀을 키우지 않는다")
- **상세**: 세션 풀 미도입이 명시적 대안 기각이지만 Rationale 절 부재로 기각 이유가 본문에 inline 된 상태. spec 문서 3섹션 원칙(Overview / 본문 / Rationale) 기준으로 본문에 설계 이유가 묻혀 있다.
- **제안**: §2.2 stdio 미지원과 함께 `## Rationale` 절로 통합 이관.

---

### 5. INFO — `6-websocket-protocol.md` Rationale 절에서 기각된 "어시스턴트 메시지 `turnIndex` 직접 동봉" 이 `mcp-client.md` 진단 필드 설계에서 암묵적 재도입 여부 확인

- **target 위치**: `spec/5-system/11-mcp-client.md §6.2` `mcpDiagnostics` 구조 — `errors[].phase` 필드
- **과거 결정 출처**: `spec/5-system/6-websocket-protocol.md` Rationale "메시지 origin 마커 도입" 기각안 3번 ("어시스턴트 메시지에 `turnIndex` 를 직접 동봉 — 의미 중복, user 메시지 turn 매핑은 여전히 필요해 근본 해소 불가")
- **상세**: WebSocket spec Rationale 은 `turnIndex` 직접 동봉을 기각했고, `source: 'live' | 'injected'` 마커를 채택했다. `mcp-client.md §6.2` 의 `mcpDiagnostics.errors[].phase` 필드("phase": "tools/list" 등)는 phase 식별 목적의 별도 개념으로, 기각된 `turnIndex` 재도입과 영역이 다르다. 충돌 없음.
- **제안**: 해당 없음 (관계 없는 영역). 단순 확인 기록.

---

## 요약

Rationale 연속성 관점에서 세 대상 문서(`spec/5-system/15-chat-channel.md`, `spec/5-system/11-mcp-client.md`, `spec/5-system/6-websocket-protocol.md`)에는 **명시적으로 기각된 대안의 재도입이나 합의 원칙의 직접 위반은 발견되지 않았다.** `chat-channel.md` 의 R4·R8·R9·R-CC-10 등 핵심 결정들은 EIA `spec/5-system/14-external-interaction-api.md` 의 R10(단일 sink + 외부 facade 원칙), R5(외부 WebSocket 보류), CCH-SE-04 single-path 원칙 등과 일관되게 정합한다. `mcp-client.md` 와 `6-websocket-protocol.md` 도 기존 결정 체계를 준수한다. 발견된 4건은 모두 INFO 등급으로, (a) fan-out 추상 수준 표현 차이로 인한 독자 혼동 여지, (b) 같은 spec 내 두 "큐" 개념 구분 명시 미흡, (c)(d) `mcp-client.md` 의 `## Rationale` 절 부재로 인라인 근거 이관 필요라는 규약 정합 보완 제안에 해당한다. 구현 착수에 차단 요인이 되는 Rationale 비연속성은 없다.

---

## 위험도

LOW
