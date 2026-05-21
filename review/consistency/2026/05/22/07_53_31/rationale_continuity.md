# Rationale 연속성 검토

검토 일시: 2026-05-22  
대상 브랜치: claude/chat-channel-spec-fix-5fc137 (working tree 변경분)  
검토자 역할: Rationale 연속성 검토자

---

## 발견사항

### [INFO] R8 은 R4 를 뒤집지 않는다 — 단순함 우선 결정의 forward-compatible 확장

- target 위치: `spec/5-system/15-chat-channel.md` § Rationale R8 "NotificationDispatcher 분리 — provider 증가 시점에 재검토"
- 과거 결정 출처: 동 파일 Rationale R4 "NotificationDispatcher EventEmitter subscription 메커니즘 (2026-05-21)", 채택 근거 "같은 process 안에서는 외부 인프라 없이 가장 단순"
- 상세:
  R4 는 세 대안(in-process EventEmitter / Redis pub/sub / 별 after-commit hook) 중 "단일 클래스 단순함 우선"을 채택했다.
  R8 는 이 결정을 **번복하지 않는다**. R8 의 본문 자체가 "이 단일 클래스 구조는 v1 의 단순함을 우선한 의도된 결정 (R4 NotificationDispatcher subscription 메커니즘)"이라고 명시적으로 R4 를 인용하고, 분리 리팩토링을 "provider 증가 시점" 조건부 권장으로 한정하며 현재 v1 설계는 R4 의 결정 그대로 유지한다.
  R8 이 추가하는 것은 (a) 미래 분기 조건 명시, (b) 리스너 dedup/라이프사이클 의무 규칙 (멱등성), (c) 후속 plan 추적 경로다. 이는 R4 의 대안 (b)(c) 를 재도입하는 것이 아니라 v1 설계 범위 안에서 R4 결정의 후속 보완에 해당한다.
- 제안: 정합 상태. 추가 조치 불필요.

---

### [INFO] EIA §3.3.1 Implementation Note 의 타입 분리 권고는 현행 "단일 InteractionRequestContext" invariant 와 충돌하지 않는다

- target 위치: `spec/5-system/14-external-interaction-api.md` § 3.3.1 "타입 분리 권고 (v2 이후)" — `ExternalInteractionRequestContext` / `InternalInteractionRequestContext` union 코드 블록
- 과거 결정 출처: 동 파일 내 EIA-AU-08 요구사항 행 (신설) — "구현은 `InteractionRequestContext.scope: 'in_process_trusted'` 플래그로 분기"
- 상세:
  검토 관점 2에서 제기된 우려, 즉 "단일 `InteractionRequestContext + scope optional 필드` 결정과의 호환성"을 점검한다.
  
  기존 EIA Rationale 에는 `InteractionRequestContext` 자료구조의 단일/분리 결정을 정형화한 항목이 없다. EIA-AU-08 자체가 이번 변경으로 신설된 요구사항이고, §3.3.1 타입 분리 권고는 **같은 변경 묶음** 에서 함께 도입된 v2 방향 권고다. 따라서 "기존 결정을 번복"하는 구조가 아니라 **신규 결정의 도입 + 미래 방향 병기** 구조다.
  
  §3.3.1 의 union 타입 분리는 "권고(v2 이후)" 로 명시되어 있고, v1 구현은 `scope?: 'in_process_trusted'` optional 단일 필드로 출발한다고 §3.3.1 앞 문단이 밝힌다. 두 표현 간 충돌은 없다.
  
  단, §3.3.1 은 v2 타입 분리를 "권고"로 기술하고 있고 이를 추적하는 plan 이름(`spec-fix-eia-au-08-type-split`)도 명시하고 있으나, **해당 plan 이 실제로 plan/in-progress/ 또는 plan/complete/ 에 존재하는지는 본 검토 범위 밖**이다. plan 파일 생성 여부를 별도 확인할 것을 권장한다.
- 제안: Rationale 연속성 관점에서 정합. plan 파일 생성 여부만 추가 확인.

---

### [INFO] §5.4 Bot Token Rotation API 응답 계약은 R7 의 "동사 정당화" 와 정합하고, 새 Rationale 부재는 적절하다

- target 위치: `spec/5-system/15-chat-channel.md` § 5.4 "Bot Token Rotation API 응답 계약"
- 과거 결정 출처: 동 파일 Rationale R7 "rotate-bot-token 동사 (2026-05-21)"
- 상세:
  R7 은 "EIA 의 `notification/rotate-secret` (HMAC signing secret rotation) 와 다른 자원이므로 `rotate-secret` 동사 재사용은 의미 혼동을 유발한다"고 URL 설계를 정당화한다.
  §5.4 응답 계약은 이 URL(`POST /api/triggers/:id/chat-channel/rotate-bot-token`) 위에 요청/성공/실패 페이로드를 상세화한다. 응답 스키마의 `chatChannelHealth`, `botIdentity` 필드는 bot token 의 외부 provider 자원 의미(R7 의 근거)와 자연스럽게 정합한다 — HMAC secret rotation 응답(예: notification_health 갱신)과 구별된다.
  응답 계약에 별도 Rationale 이 없는 것은 R7 에서 이미 URL 설계 근거가 확립되었고, 페이로드 형식 선택은 `spec/5-system/2-api-convention.md` 표준을 따른다고 §5.4 가 명시하기 때문이다. 새 결정이 없으면 새 Rationale 을 요구하지 않는다.
- 제안: 정합 상태. 추가 조치 불필요.

---

### [WARNING] CCH-CV-03 `running` 케이스의 "대기 큐 미적재 + update 무시" 정책에 대한 Rationale 가 신설되지 않았다

- target 위치: `spec/5-system/15-chat-channel.md` § 3.2 요구사항 표 CCH-CV-03 행 — "(b) `running` (waiting_for_input 미도달) → 채널에 `languageHints.executionStillRunning` 안내 메시지 발송 + update 무시 (대기 큐 미적재, 202 ack)"
- 과거 결정 출처: 동 파일 Rationale R3 "v1 single-user DM 만 지원 (2026-05-21)"
- 상세:
  R3 는 group chat 거부의 근거로 "multi-user 매핑이 복잡"을 제시하며, v1 의 범위를 1:1 DM 으로 한정한다. R3 자체는 DM 단일 사용자 맥락에서의 메시지 큐잉 정책을 다루지 않는다.
  
  CCH-CV-03 `running` 케이스는 이번 변경에서 신설된 정책이다 (초기 spec 에는 이 세 분기 중 `running` 케이스가 없었다). "대기 큐 미적재"는 **비자명한 설계 선택**이다. 대안으로 "running 상태에서 도착한 update 를 short queue 에 적재하고 execution 종료 후 처리" 하는 방식도 존재한다. 후자는 특히 단일 사용자 DM 환경에서 사용자 경험을 더 좋게 할 수 있다(사용자가 메시지를 보냈는데 무시된 것처럼 느낄 수 있음).
  
  이 결정이 합리적일 수 있다 — 예를 들어 (a) v1 단순성, (b) `running` 시간이 짧을 것이라는 가정, (c) 큐 구현의 복잡도 회피. 그러나 CCH-CV-03 행에 그 근거가 없고, 기존 Rationale R3 는 이 정책을 커버하지 않는다. 결정을 뒷받침하는 Rationale 항목(R9 또는 CCH-CV-03 행 주석)이 부재한 상태에서 "무시" 정책이 v1 의 합의된 원칙임을 확인하기 어렵다.
  
  또한 CCH-NF-03 (채널당 분당 60건 inbound 초과분은 "가장 오래된 update 부터 폐기하지 않고 `chat_channel_health=degraded` 표시")와의 정책 일관성도 검토 대상이다. `running` 케이스는 큐 미적재인데 rate-limit 초과 케이스는 큐 적재 + health degraded 로 서로 다른 방식을 취하므로, 두 정책의 관계가 명확하지 않다.
- 제안:
  CCH-CV-03 `running` 케이스의 "대기 큐 미적재" 근거를 Rationale 에 명시하거나, CCH-CV-03 행 괄호 주석으로 "v1 단순성 — execution running 구간이 짧으므로 큐잉 오버헤드 불필요"와 같이 인라인 정당화를 추가할 것. CCH-NF-03 (rate-limit 큐 정책)과의 관계도 한 줄 명시하면 충분하다. R3 에 "(running 케이스 update 무시는 v1 단순성 — 큐잉 불필요)" 보완도 가능하다.

---

### [INFO] `parseUpdate` null 의미 단일화 — Convention R3 (EiaEvent SoT 위임) 과 정합한다

- target 위치: `spec/conventions/chat-channel-adapter.md` § 1.1 표 `parseUpdate` 행 — "`null` 의 의미는 '어댑터 해석 불가/무시' 단일 의미. 호출자(`HooksService`) 가 raw body 에서 provider-specific 메타를 확인해 안내 메시지 발송 여부를 결정"
- 과거 결정 출처: 동 파일 Rationale R3 "EiaEvent 를 별 타입으로 정의하지 않고 EIA spec 위임 (2026-05-21)" — SoT 위임 원칙
- 상세:
  R3 의 핵심은 "EIA spec §6 의 payload 가 SoT, 두 spec 간 type drift 회피"다. 이번 `parseUpdate null` 의미 단일화 변경은 R3 와 다른 차원의 결정(null 반환의 의미론)을 다루며, R3 의 SoT 위임 원칙을 위반하지 않는다 — `parseUpdate` 는 inbound 경로의 어댑터 자체 계약이고, EiaEvent 는 outbound(renderNode) 경로의 EIA SoT 위임 대상이다. 두 경로는 직교적이다.
  
  null 의미를 "단일 의미"로 명확화한 것은 안내 메시지 발송 책임을 어댑터에서 호출자(HooksService)로 이동시키는 책임 재배치도 포함한다. 이 책임 이동 자체에 대한 Rationale 이 없으나, Convention Changelog(2026-05-22)에 "parseUpdate 의 null 반환 의미를 §1.1 표에 단일 의미로 명확화 + 안내 메시지 발송 책임이 호출자임을 명시"라고 기록되어 있어 변경 추적은 가능하다. R1(6함수 책임 분리 — pure 함수 vs side-effect 함수)의 원칙("parseUpdate: none — pure")과도 정합한다.
  
  telegram.md § 4 명령 매핑 표도 같은 방향으로 갱신되어(group chat → null + HooksService 분기) 동기화 상태다.
- 제안: 정합 상태. Changelog 기록으로 변경 추적 충분.

---

### [INFO] telegram.md § 5.3 `phone` 행의 "Form spec 미변경 (W-4)" 주석은 Form spec 의 기존 결정과의 관계를 plan 으로 추적한다

- target 위치: `spec/4-nodes/7-trigger/providers/telegram.md` § 5.3 Form 표 — `(특수) phone` 행의 "Form spec 의 `type` Enum 자체는 미변경 (W-4)" + "별 plan `spec-fix-form-phone-validation` 으로 추적"
- 과거 결정 출처: Form spec (`spec/4-nodes/6-presentation/4-form.md`) 의 field type Enum — 본 검토에서 직접 읽지 않았으나, telegram.md 가 "Form spec `type` Enum 에 `phone` 미존재"를 인정하며 어댑터 측 임시 가정으로 처리
- 상세:
  telegram.md 는 `phone` type 을 Form spec 에 없는 것으로 명시하고, 어댑터 측에서 `text` + custom ValidationRule 로 stub 처리한다. Form spec 을 변경하지 않으므로 Form spec 의 기존 결정(phone type 미존재)과 충돌하지 않는다. 결정의 번복 없이 "미결 사항"으로 plan 으로 추적한다는 점에서 Rationale 연속성 관점의 위반은 없다.
  
  다만 "Form spec 에 `phone` 관련 결정이 명시적으로 없다"는 것 자체가 암묵적 invariant("type Enum 은 명시된 것만 허용")를 우회하는 어댑터 측 가정을 만들어낸다. 이 가정이 plan `spec-fix-form-phone-validation` 으로 추적되는 것은 적절하다.
- 제안: plan 파일 `spec-fix-form-phone-validation` 이 실제로 생성되었는지 확인 권장. 생성되지 않았다면 plan/in-progress/ 에 신설 필요.

---

## 요약

이번 변경 묶음(CCH-CV-03 행 확장, CCH-SE-03 행, §4.1 주석, §5.4 응답 계약, Rationale R8 신설, EIA-AU-08 행, §3.3.1 Implementation Note, adapter convention §1.1/§2.3/§4, telegram.md §5.3)은 Rationale 연속성 관점에서 전반적으로 정합하다. R8 은 R4 를 번복하지 않고 그 위에 미래 방향만 덧붙이며, EIA §3.3.1 union 타입 권고는 v1 단일 optional 필드 결정과 병렬적 v2 방향 제시로 구성되어 기존 결정과 충돌하지 않는다. §5.4 응답 계약과 R7 의 정합성도 확인된다. parseUpdate null 단일화는 R1(pure 함수 원칙)과 정합하고 R3(EiaEvent SoT 위임)와 직교적이다. 유일한 경고 수준 발견은 CCH-CV-03 의 `running` 케이스 "대기 큐 미적재" 정책에 대한 Rationale 부재로, 이 결정은 비자명하고 CCH-NF-03 과의 정책 비일관성(큐 미적재 vs 큐 적재) 도 명확히 해명되지 않았다. CCH-NF-03 과의 관계를 포함한 짧은 Rationale 보완으로 해소 가능하다.

---

## 위험도

LOW

STATUS: WARNING
