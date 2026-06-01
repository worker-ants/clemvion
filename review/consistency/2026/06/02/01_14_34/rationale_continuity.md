# Rationale 연속성 검토 결과

검토 대상: `spec/7-channel-web-chat/2-sdk.md` (target draft)
참조 Rationale 출처: `spec/7-channel-web-chat/2-sdk.md §Rationale`, `spec/7-channel-web-chat/0-architecture.md §Rationale`

---

## 발견사항

### [CRITICAL] npm scope 미결정 사항을 확정으로 처리

- **target 위치**: target 문서 상단 배너 `> **npm scope 확정**: 패키지명은 @workflow/web-chat — eia-sdk-publish.md §결정 #3 에서 @workflow/sdk 와 일관되게 @workflow/* 로 통일(2026-06-02).` 및 `## Rationale §R2` 마지막 문장 `npm scope 는 @workflow/web-chat 로 확정(eia-sdk-publish.md §결정 #3, @workflow/sdk 와 일관).`
- **과거 결정 출처**: `spec/7-channel-web-chat/2-sdk.md §Rationale §R2` (기존 파일) — "npm scope 는 eia-sdk-publish.md 결정에 종속(잠정 표기 유지)." 및 기존 파일 §2 주석 `@clemvion/web-chat` 은 잠정이며 `eia-sdk-publish.md §결정 #3` 에 종속.
- **상세**: `plan/in-progress/eia-sdk-publish.md` 는 "사용자 결정 사항 5건이 충족되기 전까지 착수 불가"이며 §결정 #3(Package scope: `@workflow/sdk` vs `@clemvion/sdk`)이 여전히 open 상태다. target draft는 이 미결 항목이 `@workflow/*` 로 합의된 것처럼 "확정" 을 선언하고 R2 Rationale 에도 확정 문구를 반영했다. `eia-sdk-publish.md` 에는 이 결정이 기록되지 않았고 체크박스도 미완료 상태다.
- **제안**: (a) `eia-sdk-publish.md` 에 실제 결정 합의 기록(§결정 사항 표 작성) 후 target의 "확정" 표현을 유지하거나, (b) 결정이 아직 미합의라면 "잠정" 표기로 되돌리고 R2 Rationale 에서 "확정" 문구를 제거한다. 어느 쪽이든 plan이 먼저 업데이트되어야 spec이 "확정"을 선언할 수 있다.

---

### [WARNING] `show`/`hide` 메서드 + `wc:command` 확장 — R3 신설은 되어 있으나 show/hide 추가 근거 누락

- **target 위치**: §1 메서드 목록에 `show`/`hide` 추가, show/hide vs open/close 의미론 설명 추가; §3 `wc:command` 테이블에 `show`/`hide` 추가; §5 `ChatInstance` 타입에 `show()/hide()` 포함; §Rationale §R3 "SPA 안전 통합" 신설.
- **과거 결정 출처**: `spec/7-channel-web-chat/2-sdk.md §3` (기존 파일) — `wc:command` 테이블은 `open`/`close`/`sendMessage(text)`/`updateProfile`/`shutdown` 만 열거되어 있고 `show`/`hide` 없음. 기존 §1 메서드 목록에도 `show`/`hide` 없음.
- **상세**: `show`/`hide` 를 추가한 새 설계는 기존 wc:command 프로토콜을 확장하는 것으로, 이전 spec에서 명시적으로 기각된 사항은 아니다. 그러나 R3가 `on()/off()` 해제 패턴과 `data-global` 충돌 방지에 집중하고, `show`/`hide` 메서드 자체를 추가하는 설계 결정 근거는 R3 어디에도 설명되지 않는다.
- **제안**: R3에 show/hide 메서드 도입 근거(런처 visibility와 패널 open/close를 분리한 이유, `1-widget-app` 상태기계에서 collapsed/expanded 상태가 구분되므로 API도 두 축으로 분리)를 한 항목으로 추가한다.

---

### [WARNING] `off()` 메서드 신설 및 `on()` Unsubscribe 반환 — 기존 결정 번복이나 번복 맥락 불명확

- **target 위치**: §1 메서드 목록에 `off(event, cb?)` 추가, `on(event, cb)` 에 "구독 해제 함수 반환" 추가; §5 `ChatInstance` 타입의 `on()` 반환 타입 `Unsubscribe`, `off()` 서명 추가; §Rationale §R3 에서 근거 기술.
- **과거 결정 출처**: `spec/7-channel-web-chat/2-sdk.md §1` (기존 파일) — 메서드 목록은 `boot`/`shutdown`/`show`/`hide`/`open`/`close`/`sendMessage`/`updateProfile`/`on(event, cb)`. `off` 없음, `on()` 반환값 없음.
- **상세**: 기존 spec에서 `off()`를 명시적으로 기각한 기록은 없으므로 CRITICAL은 아니나, R3는 "표준 DX(EventEmitter/addEventListener 양식)와 일치" 근거를 제시했다. 그러나 기존 spec이 `off()` 없이 `on()` 만 두었던 이유(미결정인지 의도적 단순화인지)를 명확히 하지 않아 결정 연속성이 불투명하다.
- **제안**: R3에 "기존 v1 spec에서 `off()` 없이 `on()` 만 두었던 것은 미결정 상태였으며(또는 단순화 의도였으며), SPA 통합 피드백으로 cleanup 패턴이 명시 요구됨에 따라 이번 개정에 추가한다"는 맥락 한 줄을 추가한다.

---

### [WARNING] `data-global` 전역명 재지정 — 기존 "구현 단계 검토" 보류 항목을 명세화, 번복 맥락 미기록

- **target 위치**: §1 "전역명 충돌 방지" 단락 — `data-global` 속성으로 전역명 재지정 지원, loader가 점유 충돌 시 경고+중단; §Rationale §R3.
- **과거 결정 출처**: `spec/7-channel-web-chat/2-sdk.md §1` (기존 파일) — "(전역명 충돌 방지 패턴은 구현 단계 검토)."라는 명시적 보류 메모.
- **상세**: 기존 spec은 전역명 충돌 방지 패턴을 명시적으로 "구현 단계 검토"로 미뤄두었다. target은 이를 `data-global` opt-in 방식으로 확정하고 R3에 근거를 기술했다. R3가 "구현 단계 검토로 보류했던 이유"를 언급하지 않아 결정 스레드가 불연속적으로 보인다.
- **제안**: R3의 `data-global` 관련 서술에 "구현 단계 검토로 보류했던 전역명 충돌 방지 패턴을 `data-global` opt-in 재지정으로 확정한다"는 한 줄을 추가하면 기존 보류 → 결정의 연속성이 명확해진다.

---

### [INFO] §5 공개 인스턴스 타입 계약 신설 — 타입 SoT 우선순위 Rationale 없음

- **target 위치**: `## 5. 공개 인스턴스 타입 계약` 섹션 전체.
- **과거 결정 출처**: 기존 `spec/7-channel-web-chat/2-sdk.md` — 해당 섹션 없음.
- **상세**: §5는 새 섹션으로 기각된 대안이 없으므로 CRITICAL/WARNING에 해당하지 않는다. 다만 "산문 설명의 SoT 타입"이라는 표현은 §1의 산문 명세와 §5 타입 정의가 이중 SoT처럼 보일 수 있다. Rationale에 "타입 정의가 산문보다 우선하는 SoT"라는 취지를 명시하면 향후 불일치 발생 시 어느 쪽이 우선인지 명확해진다.
- **제안**: R3 또는 별도 R5로 "§5 타입 계약이 §1 산문보다 우선하는 타입 SoT"임을 한 줄 기술.

---

## 요약

target draft(`spec/7-channel-web-chat/2-sdk.md`)는 기존 spec이 명시적으로 기각한 대안을 재도입하거나 시스템 invariant를 직접 위반하는 사항은 없다. 그러나 가장 중요한 문제는 `plan/in-progress/eia-sdk-publish.md §결정 #3`(Package scope)가 plan에서 여전히 5건 미합의·착수 불가 상태임에도 불구하고, target이 `@workflow/web-chat`으로 "확정" 선언하고 R2 Rationale에도 이를 반영한 점이다. 이는 spec의 단일 진실 원칙(plan이 SoT인 결정을 spec이 앞질러 확정 처리)을 어기며 향후 plan 합의 결과와 충돌할 위험이 있다(CRITICAL). show/hide 추가, off() 신설, data-global 확정은 R3 신설로 근거가 부분적으로 제공되었으나, 각각 기존 보류/미결 상태로부터의 전환임을 R3가 명시적으로 연결하지 않아 Rationale 스레드가 불연속적이다(WARNING 3건). npm scope 확정을 제외한 나머지 변경은 기존 결정과 충돌하지 않으며 합리적 확장이다.

## 위험도

HIGH
