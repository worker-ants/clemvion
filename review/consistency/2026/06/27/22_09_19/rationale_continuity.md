# Rationale 연속성 검토 결과

검토 범위: `spec/7-channel-web-chat/` (구현 완료 후 검토, diff-base=origin/main)

---

## 발견사항

### 발견사항 없음 (NONE)

이번 변경 diff 의 모든 수정 사항을 `spec/7-channel-web-chat/` 의 `## Rationale` 결정들과 대조한 결과, 기각된 대안의 재도입·합의된 원칙 위반·무근거 번복·암묵적 가정 충돌이 발견되지 않았다.

개별 변경 항목 대조 요약:

**1. `isTextInputSurface()` 헬퍼 추출 (`widget-state.ts`)**
- `buttons`/`form` 표면에서 자유 텍스트 입력을 비활성화하는 판정을 단일 함수로 추출.
- 근거: `1-widget-app.md §2 입력창 행` + `§R6` — "현재 표면이 `buttons`/`form` 이면 비활성" 을 그대로 구현한 것이며, 판정 3중 중복을 단일화한 리팩터링이다. 새 동작을 도입하지 않는다.
- Rationale 충돌 없음.

**2. `panel.tsx` Composer `disabled` 조건 리팩터링**
- `pending?.type === "buttons" || pending?.type === "form"` → `!isTextInputSurface(pending)` 로 교체.
- 동작은 동일하며 `isTextInputSurface` 가 `null` 도 텍스트 표면으로 보는 것은 "현행 동작 보존" 주석이 명시. `§R6` 큐 flush/입력창 게이팅 합의와 일치.
- Rationale 충돌 없음.

**3. `widget-state.test.ts` — 신규 테스트 2건**
- "ERROR(대기 중 pending) → ended + pending 해제" : `1-widget-app.md §3.1` 표의 에러 상태 전이(`ended`) + `pending` 해제를 검증. spec 에 명시된 동작을 테스트로 커버한 것이다.
- "ended 재open: OPEN → open=true, phase=ended 유지" : `§3 상태기계` 다이어그램의 "close 후 재open 시 복원" 항목 — ended 상태에서는 새 execution 을 시작하지 않고 종료 화면을 그대로 보여주는 것을 검증. spec 에 기각된 대안("새 execution 시작")은 `§3.1 새 대화(restart)` 에서 명시적으로 CTA 로만 노출된다고 규정하므로 이 테스트는 그 경계를 정확히 방어한다.
- Rationale 충돌 없음.

**4. `panel.test.tsx` — 신규 테스트 1건**
- "phase=ended → Composer 미렌더, '새 대화 시작' 버튼 노출" : `1-widget-app.md §3.1 대화 종료(end)` 의 "[ended] — transcript 읽기전용 + '새 대화 시작' CTA" 를 검증. `§R6 eager 전환` 의 "새 대화는 CTA 로만 시작" 원칙과 정합.
- Rationale 충돌 없음.

**5. `use-widget-eager-start.test.ts` — 신규 헬퍼 및 테스트 (diff 미완 수신이나 내용 특성 파악)**
- ControllableEventSource 기반 SSE 수동 주입 헬퍼는 `§R6 eager-start` + 큐 게이팅(flush/폐기) 테스트를 위한 테스트 인프라다. 기각된 "lazy 모델" 을 재도입하거나 `firstMessage` 메커니즘을 복원하는 흔적이 없으며, eager-start 경로를 더 정밀하게 검증한다.
- Rationale 충돌 없음.

---

## 요약

이번 diff 는 `spec/7-channel-web-chat/1-widget-app.md §R6`(eager-start · 큐 게이팅) 및 `§2 입력창 비활성 조건`이 이미 합의한 결정들을 구현 레벨에서 테스트·리팩터링으로 강화한 것이다. 기각된 "lazy 시작", "firstMessage 동봉", "buttons/form 표면에서 텍스트 입력 허용", "ended 상태에서 자동 재시작" 등 과거 Rationale 에서 폐기된 대안을 재도입한 흔적이 없다. 모든 변경 사항은 spec 합의 결정의 테스트 커버리지 확대와 중복 판정 로직의 단일화로, Rationale 연속성 관점에서 문제 없음으로 평가한다.

---

## 위험도

NONE
