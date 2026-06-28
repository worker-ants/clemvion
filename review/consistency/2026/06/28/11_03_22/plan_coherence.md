# Plan 정합성 검토 결과

검토 대상: `spec/5-system/12-webhook.md`
관련 Plan: `plan/in-progress/spec-sync-webhook-gaps.md`

---

## 발견사항

### [WARNING] §3.1 표 "요청 본문 최대 크기 | 1MB" — 미해결 결정과 충돌

- **target 위치**: `spec/5-system/12-webhook.md` §3.1 API 명세 표 ("요청 본문 최대 크기 | 1MB")
- **관련 plan**: `plan/in-progress/spec-sync-webhook-gaps.md` — WH-NF-02 항목 (체크박스 미완료), §결정 옵션 (A/B/C 세 가지 모두 미결)
- **상세**:
  - plan의 WH-NF-02 항목은 "1MB 통일 임계를 도입할지 vs spec을 현행에 맞춰 재정의할지"를 결정 필요(옵션 A/B/C)로 열어 두고 있다.
  - target의 §3.1 표는 "요청 본문 최대 크기 | 1MB"를 단일 값으로 명시한다. 이는 plan이 명확히 "stale" 로 지적한 부분이다(`plan §맥락`: "§3.1 표만 순수 '1MB' 약속으로 남아 stale").
  - 즉 target은 plan에서 "아직 해결되지 않은 결정(A/B/C 중 어느 것도 선택되지 않음)" 임에도 불구하고 옵션 A 방향(1MB 단일 임계)처럼 보이는 표현을 그대로 유지하고 있다.
  - 단, target의 WH-NF-02(§4)와 §8 보안 고려사항은 이미 "현행 구현: 공개 webhook만 32KB… 1MB 통일 임계는 미구현 (Planned)" 라고 정직하게 기술하여 §3.1 표와 내부 불일치 상태다. 이 내부 불일치 자체가 plan의 미해결 결정이 spec에 반영되지 않았음을 보여준다.
- **제안**: plan의 WH-NF-02 결정(옵션 A/B/C 중 하나)이 확정되기 전까지는 §3.1 표의 "요청 본문 최대 크기 | 1MB" 셀을 "공개 32KB / 인증 미구현(Planned) — WH-NF-02 참조" 등으로 수정하거나, plan을 먼저 결정하여 spec을 한 번에 정합화해야 한다. target을 수정하거나 plan의 결정을 먼저 내리는 방향 모두 가능하나, 현재 상태는 §3.1 표 ↔ WH-NF-02/§8 간 내부 불일치가 노출되어 있다.

---

### [INFO] WH-EP-07 / §7 step 5 — plan 체크박스 완료, target 본문과 정합

- **target 위치**: `spec/5-system/12-webhook.md` WH-EP-07, §7 step 5
- **관련 plan**: `plan/in-progress/spec-sync-webhook-gaps.md` — 첫 번째 항목 (`[x]` 완료)
- **상세**: plan은 "비활성 chatChannel 트리거의 202+{ignored} 분기"를 이미 구현 확인됨(`[x]`)으로 표시했고, target의 WH-EP-07·§7 처리 흐름 step 5도 동일 내용("chatChannel 분기가 isActive 검사보다 선행")을 정확히 기술한다. 불일치 없음.
- **제안**: 추적 메모 수준. 별도 조치 불필요.

---

## 요약

`spec/5-system/12-webhook.md`의 plan 정합성 관점에서 주요 문제는 `plan/in-progress/spec-sync-webhook-gaps.md`의 WH-NF-02 미결 결정(본문 크기 임계 옵션 A/B/C)이 target에 반영되지 않은 채 §3.1 표가 "1MB" 단일 값을 유지하고 있다는 점이다. 이는 plan이 "stale"로 명시한 표현을 target이 수정하지 않은 상태로, spec 내부(§3.1 표 vs WH-NF-02·§8)에 불일치가 드러나 있다. 결정을 일방적으로 내린 것은 아니나(WH-NF-02·§8에 "Planned"가 명시됨), plan의 미결 결정이 §3.1 표에 반영되지 않아 혼선을 유발할 수 있다. 다른 in-progress plan들(ai-agent-tool-connection-rewrite, ai-context-memory-followup-v2, cafe24-backlog-residual, chat-channel-* 등)은 target과 직접 관련 없어 충돌 없음.

---

## 위험도

LOW
