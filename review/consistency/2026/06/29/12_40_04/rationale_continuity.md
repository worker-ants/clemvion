# Rationale 연속성 검토 결과

검토 대상: `spec/4-nodes/7-trigger/providers/slack.md`

---

### 발견사항

- **[INFO]** `photo` v1 fallback 의 `chat_channel_health` 변경 없음 — R-CC-11 (d) 와 정합 확인
  - target 위치: §5.4 "v1 단계에서 `photo` 선택 시 fallback to text + warning 로그 (`chat_channel_health` 변경 없음)"
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md ## Rationale` R-CC-11 (d) "photo v1 fallback 의 health 변경 없음 이유"
  - 상세: R-CC-11 (d) 는 "`chatChannelHealth=degraded` 는 외부 API 실패 신호. v1 인프라 미도입은 사용자 error 가 아니라 정상 fallback" 이라고 명시. slack.md §5.4 가 이를 올바르게 반영. 충돌 없음 — 정합 보완 확인.
  - 제안: 없음 (완전 정합).

- **[INFO]** `text_only` → `text` read-time normalize — R-CC-11 (a) 와 정합 확인
  - target 위치: §5.4 "legacy `text_only` 처리: 어댑터가 입력 단계에서 `visualNode === "text_only"` 를 `"text"` 로 read-time normalize"
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md ## Rationale` R-CC-11 (a)
  - 상세: R-CC-11 (a) 의 "운영 영향은 어댑터의 read-time normalize (`text_only` → `text`) 로 흡수" 정책과 일치. 충돌 없음.
  - 제안: 없음 (완전 정합).

- **[INFO]** Convention R4 의 "native UI 분기는 v2 옵션" 에서 R-CCA-8 예외 절로의 전환 — 명시적 경로 확인
  - target 위치: §5.3 / R-S-6
  - 과거 결정 출처: `spec/conventions/chat-channel-adapter.md ## Rationale` R4 / R-CCA-8
  - 상세: R4 는 "일반적 native UI 분기는 v2 옵션이나, '지원 provider + 5 fields 이하 + 전 필드 modal 수용 타입' 의 제한 케이스만 v1 에서 예외적으로 native modal 허용" 을 명시했고, R-CCA-8 이 이를 실현. slack.md 의 R-S-6 은 이 경로를 올바르게 인용하고 있다. R4 기각 대안의 재도입이 아닌 R4 본문이 예고한 미래 경로의 활성화이므로 Rationale 연속성 충돌 없음.
  - 제안: 없음 (완전 정합).

- **[INFO]** `202 Accepted` 정책의 Slack 특이 예외 — R-CC-12 와 정합 확인
  - target 위치: §6 "Slack 특이 예외" / R-S-8
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md ## Rationale` R-CC-12
  - 상세: R-CC-12 는 `202 Accepted` 고정을 SoT 로 정의하고 "auth 실패 401 / endpointPath 미존재 404" 만 예외로 허용. slack.md 의 R-S-8 은 URL Verification (`200 + challenge`) 과 Interactivity 3초 ack (`200`) 를 provider-specific 예외로 추가하면서, 이를 `§5.5.1 Provider-specific 응답 예외 정책` 에 반영 완료되었다고 명시한다. R-CC-12 가 열어두지 않은 새 예외 경로이나, slack.md R-S-8 과 §6 에 "두 예외 모두 §5.5 case 표 (line 418–419) + §5.5.1 에 반영 완료" 라고 기재하여 상위 spec 에 역방향 갱신이 이루어졌음을 주장한다. 실제로 해당 반영이 완료되었다면 연속성 문제가 없다.
  - 제안: 상위 spec `spec/5-system/15-chat-channel.md §5.5.1` 의 실제 내용이 slack.md 의 두 예외 케이스를 명시적으로 포함하고 있는지 점검 권고. 포함되어 있지 않다면 §5.5.1 갱신 또는 본 slack.md R-S-8 의 "반영 완료" 주장을 "반영 필요" 로 수정.

- **[INFO]** `parseUpdate` pure 계약 — Convention §1.1 (R1) 과 정합 확인
  - target 위치: §4.1 "file_shared" 행 / R-S-7
  - 과거 결정 출처: `spec/conventions/chat-channel-adapter.md ## Rationale` R1 "parseUpdate / renderNode 는 pure 함수"
  - 상세: R-S-7 은 `parseUpdate` 를 pure (동기 반환) 로 유지하고 `files.info` 후속 조회를 HooksService 로 위임함으로써 R1 의 pure 함수 계약을 준수. 충돌 없음.
  - 제안: 없음 (완전 정합).

- **[INFO]** Socket Mode 기각 — R-S-3 의 v2 유예 명시
  - target 위치: §1 개요 / R-S-3
  - 과거 결정 출처: 동일 문서 R-S-3 (v1 단순성 근거로 Socket Mode 기각)
  - 상세: Socket Mode 는 R-S-3 에서 v2 옵션으로 명시 기각됨. target 본문은 이를 올바르게 인용하며 Socket Mode 관련 기능을 재도입하지 않음. 충돌 없음.
  - 제안: 없음 (완전 정합).

---

### 요약

`spec/4-nodes/7-trigger/providers/slack.md` 는 참조하는 모든 Rationale — Convention `chat-channel-adapter.md` (R1, R4, R-CCA-8), `spec/5-system/15-chat-channel.md` (R-CC-11, R-CC-12), 그리고 자체 R-S-1 ~ R-S-9 — 에 대해 기각된 대안을 이유 없이 재도입하거나 합의된 invariant 를 직접 위반하는 사례가 발견되지 않는다. 유일한 주의 사항은 R-S-8 에서 "§5.5.1 에 반영 완료" 라고 주장하는 `200 OK` 예외 두 케이스가 실제로 상위 spec 에 명문화되어 있는지의 사실 확인으로, 이는 Rationale 연속성 위반이 아닌 cross-spec 동기화 완료 여부 확인 사항이다. 전반적으로 Rationale 연속성은 양호하다.

### 위험도

LOW
