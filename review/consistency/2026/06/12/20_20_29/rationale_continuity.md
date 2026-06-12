# Rationale 연속성 Check — 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=origin/main)

변경 대상 파일: `spec/5-system/15-chat-channel.md` (단일 파일 변경)

---

## 발견사항

### 발견사항 없음 — 두 변경 모두 Rationale 연속성 기준 충족

변경은 두 곳이며, 각각 "Planned(미구현)" 표기를 "구현됨" 으로 갱신한 것이다.

---

**변경 1 — CCH-CV-03 (b) 분기 구현 완료 표기**

- target 위치: `spec/5-system/15-chat-channel.md` §3.2 CCH-CV-03 셀 (line 67)
- 변경 전: `**(b) 분기 미구현 (Planned)**: … `waiting_for_input` 미도달 (b) 분기·`executionStillRunning` 안내 발송은 아직 미구현 (R9 가 우려한 input-sequence 충돌이 현재 코드에 존재). (a)/(c) 는 구현됨.`
- 변경 후: `구현: HooksService.getActiveExecutionStatus 가 비-terminal status 를 반환하고, 인터랙션 forwarding 분기는 status === waiting_for_input 일 때만 (a) forwarding 을 수행한다. running/pending 이면 sendExecutionStillRunningNotice 로 (b) 안내 발송 후 { executionId: 'ignored' } 로 단락 (대기 큐 미적재 — R9). (a)/(b)/(c) 모두 구현됨.`

Rationale 연속성 분석:

- **R9 (CCH-CV-03 `running` 케이스의 큐잉 vs 즉시 안내)** 는 "즉시 안내 + update 무시 (큐 미적재)" 를 채택했다. 변경된 구현 설명은 `sendExecutionStillRunningNotice` + `{ executionId: 'ignored' }` 단락으로, R9 가 채택한 원칙과 정확히 일치한다.
- R9 에서 기각된 "큐 적재 후 `waiting_for_input` 도달 시 재발사" 방식은 새 구현에서 채택되지 않았다 (재도입 없음).
- R9 에서 기각된 "HTTP 연결 보류" 방식도 채택되지 않았다.
- 구현 완료 이전에 문서가 "R9 가 우려한 input-sequence 충돌이 현재 코드에 존재" 라고 명시적으로 기록한 것이 해소되어 구현이 R9 설계 원칙에 합치됐음을 명시한 것이다.
- 새 Rationale 을 작성할 필요 없는 변경 (설계 결정 자체 불변, 구현 상태만 갱신).

판정: **이상 없음**.

---

**변경 2 — §5.4 rotate-bot-token 응답 3필드 구현 완료 표기**

- target 위치: `spec/5-system/15-chat-channel.md` §5.4 Bot Token Rotation API 응답 계약 (line 324~334)
- 변경 전: 성공 응답에 `rotatedAt` 1필드만 명시 + "`triggerId` / `chatChannelHealth` / `botIdentity` 3필드 동봉은 **미구현 (Planned)** — 현재 응답에 미포함."
- 변경 후: `rotateBotToken` 이 4필드 (`rotatedAt`, `triggerId`, `chatChannelHealth`, `botIdentity`) 를 동봉한다는 설명으로 대체, Planned 주석 제거.

Rationale 연속성 분석:

- **R-CC-10 (Bot Token 변경 single-path)** 은 `rotate-bot-token` endpoint 의 설계 방향 (single-path 채택, PATCH 차단) 을 정의하며 응답 필드의 개수나 구성에 대해 별도 기각 결정을 두지 않는다.
- `§5.4.1 Bot Token 변경 single-path 정책` 도 응답 shape 구성 자체에 대한 Rationale 결정이 없다.
- `§5.4.2 응답 DTO derived 필드 — hasBotToken` 은 GET 응답의 derived 필드 정책이고 rotate-bot-token 응답 shape 와 직교하는 별개 사안이다.
- 변경은 API 응답 shape 의 구현 완료 갱신에 해당하며, 이전에 Planned 로 표기된 항목이 구현 완료로 전환된 것이다. 이전에 기각된 대안이 재도입된 것이 아니다.
- 새 필드 (`triggerId`, `chatChannelHealth`, `botIdentity`) 의 포함은 "setupChannel 재호출 결과 확인" 이라는 UX 필요(클라이언트가 rotate 결과를 확인하기 위한 round-trip 절감)에서 비롯되며, 어느 Rationale 에서도 이 방향이 명시적으로 기각된 바 없다.
- API Convention §5.1 의 `{ data }` 래퍼 원칙 준수 유지.

판정: **이상 없음**.

---

## 요약

이번 검토 범위(`spec/5-system/15-chat-channel.md`)의 변경은 두 곳 모두 기존 설계 결정의 번복이 아니라 **이미 합의된 Rationale 에 따라 설계된 기능의 구현 완료를 spec 에 반영**한 갱신이다. CCH-CV-03 (b) 분기는 R9 가 채택한 "즉시 안내 + 큐 미적재" 원칙을 정확히 따르는 구현이며, rotate-bot-token 응답 3필드 추가는 Planned 로 예약된 사항이 구현됐음을 기록한 것이다. 두 변경 모두 과거 Rationale 에서 기각된 대안을 재도입하지 않았고, 합의된 시스템 invariant 를 위반하지 않으며, 결정 번복 시 요구되는 신규 Rationale 작성이 필요한 상황도 아니다. Rationale 연속성 관점의 위험 요소가 발견되지 않았다.

## 위험도

NONE

---

STATUS: SUCCESS
