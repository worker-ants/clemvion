# Plan 정합성 검토 결과

검토 모드: --impl-prep
대상 범위: 06-concurrency C-1 + M-7 함께 적용 (동일 publish 실패 표면)

---

## 발견사항

### 발견사항 1

- **[INFO]** C-1 의 spec 갱신 의무(§7.4 cancel publish 실패 surface 1줄)가 "sibling planner spec-sync 로 defer" 로 처리됨 — 연결된 spec-sync plan 미존재
  - target 위치: 검토 범위 설명 내 "spec §7.4 1줄 + 에러코드 카탈로그 등재는 sibling planner spec-sync 로 defer (impl-first)"
  - 관련 plan: `plan/in-progress/refactor/06-concurrency.md` C-1 항목 — "spec 갱신: §7.4 에 'cancel publish 실패도 caller 에 동기 surface (queued 계약 준용)' 1줄 (planner)"
  - 상세: `06-concurrency.md` C-1 은 spec 갱신이 "planner" 트랙임을 명시하고, 검토 범위 설명은 이를 "sibling planner spec-sync 로 defer" 한다고 선언한다. 그러나 `plan/in-progress/` 에 해당 spec-sync 를 처리할 전용 plan 이 존재하지 않는다. `spec-sync-5-system-*` 계열 plan 들도 이 항목을 포함하지 않는다. "impl-first" 후 spec 갱신 타이밍과 소유자가 추적되지 않으면 spec 드리프트가 잔존한다.
  - 제안: (a) 기존 spec-sync plan 중 execution-engine 범위를 포함하는 것이 있으면 C-1 spec 갱신 항목을 등재하거나, (b) 구현 완료 후 spec 갱신을 누락 없이 처리하도록 본 worktree plan 체크리스트에 "spec §7.4 1줄 planner 위임 + CONTINUATION_ENQUEUE_FAILED 에러코드 등재" 항목을 명시한다. 지금 당장 착수를 막는 수준은 아니어서 INFO 로 분류.

### 발견사항 2

- **[INFO]** CONTINUATION_ENQUEUE_FAILED 에러코드가 spec 및 에러코드 카탈로그 어디에도 미등재 상태에서 REST 503 surface 구현이 선행됨
  - target 위치: 검토 범위 설명 내 "REST stop() WAITING 분기에서 queued=false 시 503(CONTINUATION_ENQUEUE_FAILED) surface"
  - 관련 plan: `plan/in-progress/refactor/06-concurrency.md` C-1 — spec 갱신 항목에 §7.4 1줄만 언급, 에러코드 등재는 별도 "defer" 처리
  - 상세: `spec/5-system/6-websocket-protocol.md §4.2` 는 `queued: false` 의 의미(publish 단계 실패, 재시도 권장)를 기술하나 `CONTINUATION_ENQUEUE_FAILED` 라는 코드 문자열은 spec 어디에도 없다. `spec/conventions/error-codes.md` 및 `spec/5-system/3-error-handling.md` 에도 미등재. 구현에서 에러코드를 먼저 정의하고 spec/카탈로그 등재는 나중에 미룰 경우 에러코드 명명 규약(`spec/conventions/error-codes.md` — 의미 기반 명명 원칙)과의 사후 정합 검토가 필요해진다. "impl-first" 방향이 plan 에 명시돼 있으므로 blocking 이슈는 아니나, 에러코드 문자열이 코드에 고정된 후 카탈로그 등재 시 명명 검토가 이루어져야 한다는 추적 메모.
  - 제안: 구현 완료 후 plan 체크리스트에 "CONTINUATION_ENQUEUE_FAILED → error-codes.md 등재 + §7.4 surface 1줄 spec 추가" 를 명시적 후속 항목으로 기록. 현재 체크리스트에 이 후속이 보이지 않으면 INFO 수준의 누락.

### 발견사항 3

- **[INFO]** C-2 (결정 대기) 와의 경계가 구현 범위에서 명확히 구분되어 있어 충돌 없음 — 확인 기록
  - target 위치: 검토 범위 설명 전반
  - 관련 plan: `plan/in-progress/refactor/06-concurrency.md` C-2 — "결정 대기 (사용자) — 착수 금지 유지"
  - 상세: C-2 (`rehydrateContext` check-then-act 원자화)는 `plan/in-progress/refactor/README.md` 에서 "⏳ 결정대기 — 착수 금지 유지" 로 명시돼 있다. C-1 + M-7 의 구현 범위 설명은 `cancelWaitingExecution` / `nextSeq` / `publish` 표면에만 한정되고 `rehydrateContext` 경로를 건드리지 않는다. C-2 의 미해결 결정과 충돌하는 요소 없음. 검토 기록 용도로 INFO 등재.
  - 제안: 현 범위 그대로 진행 가능. C-2 의 결정 대기 상태를 변경하지 않는 한 충돌 위험 없음.

---

## 요약

C-1 + M-7 의 구현 착수(--impl-prep) 관점에서 계획 정합성 이슈는 없다. C-2(결정 대기)와의 경계는 명확히 분리돼 있고, 이번 범위가 C-2 의 미해결 결정을 우회하거나 일방적으로 이행하는 요소는 없다. 선행 조건으로 해소되지 않은 plan 항목도 없다. 유일한 경미한 사항은 "impl-first" 선언 후 spec 갱신(§7.4 1줄 + CONTINUATION_ENQUEUE_FAILED 에러코드 카탈로그)의 소유자·타이밍 추적이 plan 체크리스트에 명시되지 않은 점으로, 이는 INFO 수준이며 착수를 차단하지 않는다.

---

## 위험도

LOW

---

STATUS: SUCCESS
