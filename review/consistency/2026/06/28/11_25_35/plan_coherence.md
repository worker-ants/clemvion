## 발견사항

- **[WARNING]** §3.1 표의 "요청 본문 최대 크기 | 1MB" 항목 — 미해결 결정과의 내부 비정합
  - target 위치: `spec/5-system/12-webhook.md` §3.1 표, 182행 (`| 요청 본문 최대 크기 | 1MB |`)
  - 관련 plan: `plan/in-progress/spec-sync-webhook-gaps.md` — WH-NF-02 미구현 항목 + §"결정 옵션 (2026-06-13)" (옵션 A/B/C 중 권장 C = "공개 32KB / 인증 1MB 분리 임계")
  - 상세: WH-NF-02(106행)·§8 보안 고려사항(392행)은 현행이 "Planned" 상태임을 솔직하게 기술하고 있다. 그러나 §3.1 표(182행)는 아직도 "1MB" 단일 값을 사실 기술처럼 남겨 두어, 같은 문서 안에서 세 위치가 서로 다른 상태를 나타내고 있다. plan에는 "옵션 A·B·C 중 어느 것을 채택하는가"가 아직 사용자 결정 미완으로 열려 있다 (`[ ]` 체크박스 상태, 결정 기록 없음). 즉 target 은 미결 결정을 일방적으로 "1MB" 로 확정한 것처럼 보이는 §3.1 표를 그대로 유지 중이다.
  - 제안: plan §"결정 옵션"의 결정이 내려지면 §3.1 표를 옵션에 맞춰 갱신한다. 결정이 내려지기 전까지는 §3.1 표도 WH-NF-02·§8와 같이 "(Planned — plan/in-progress/spec-sync-webhook-gaps.md 참조)" 표기를 추가해 문서 내 일관성을 맞춰야 한다. target 쪽을 수정하거나 plan 에 "§3.1 표 정합화는 결정 후 처리" 메모를 추가하는 것이 옳다.

- **[INFO]** `ai-context-memory-followup-v2.md` 별건 spec PR 항목 — `node-output.md` `ai_agent` 단독 정정 및 `3-information-extractor.md` watermark 참조 정정이 미완료
  - target 위치: 해당 없음 (12-webhook.md 는 직접 영향 없음)
  - 관련 plan: `plan/in-progress/ai-context-memory-followup-v2.md` §"Batch 2 후속 — 별건 spec PR" — `[ ]` 체크박스 2건이 미완료. webhook spec과 직접 교차하지 않으나, spec 변경 PR이 열려 있는 동안 consistency-check 가 해당 spec 파일을 별도 검토 대상으로 감지할 수 있음.
  - 상세: 이 두 미완 항목은 12-webhook.md 와 무관하므로 plan 정합성 충돌이 아니다. 추적 메모로 기록.
  - 제안: 변경 없음. 해당 plan 자체 트래킹으로 충분.

---

## 요약

`spec/5-system/12-webhook.md` 는 전반적으로 `plan/in-progress/spec-sync-webhook-gaps.md` 와 잘 정합되어 있다. WH-EP-07(비활성 chatChannel 202 분기)는 "이미 구현 확인됨"으로 plan에 반영되고 spec도 동일 동작을 기술한다. WH-EP-05-2(400 details[] 노출)는 spec §5.2에서 "현행 vs 목표" 두 층위로 명확히 구분되어 있고 plan의 미완 `[ ]` 상태와 일치한다. 유일한 경고는 §3.1 표의 "요청 본문 최대 크기 | 1MB" 항목으로, plan에서 A·B·C 세 옵션 중 어느 것도 아직 결정되지 않았음에도 §3.1 표가 "1MB" 단일 값을 마치 확정된 것처럼 남아 있어 같은 문서 내 WH-NF-02·§8와 상태가 불일치한다. 미해결 결정을 우회하는 수준은 아니지만(옵션 A의 "1MB 단일" 이 spec §3.1 원래 의도이기도 하므로), plan의 결정 전 §3.1 표에 "Planned" 표기를 추가해 내부 일관성을 맞추는 것이 필요하다.

---

## 위험도

LOW
