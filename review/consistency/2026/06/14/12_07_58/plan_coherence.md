# Plan 정합성 검토 결과

검토 모드: `--impl-prep`
Target: `spec/5-system/_product-overview.md`
검토일: 2026-06-14

---

## 발견사항

- **[WARNING]** 비즈니스 커스텀 메트릭 — 메트릭 이름/라벨 셋 합의 미결, spec 항목 부재
  - target 위치: `spec/5-system/_product-overview.md` §5 NF-OB-02 상태 열 주석 ("비즈니스 커스텀 메트릭(실행 수·큐 깊이·LLM 사용량)은 본 파이프라인 위 후속")
  - 관련 plan: `plan/in-progress/spec-sync-5-system-metrics-gap.md` §후속 첫 번째 항목 ("비즈니스 커스텀 메트릭: … 메트릭 이름/라벨 셋 합의 필요")
  - 상세: 현재 worktree `metrics-business-1f9ab7` 가 구현하려는 대상이 바로 이 비즈니스 커스텀 메트릭이다. 그런데 target spec 에는 이에 대응하는 독립 NF 항목(ID·요구사항·수용 기준)이 없다 — NF-OB-02 의 상태 열 주석으로만 후속 필요성이 언급되어 있을 뿐이다. plan 도 "메트릭 이름/라벨 셋 합의 필요" 라는 미결 조건을 명시하고 있다. 구현에 앞서 어떤 도메인 메트릭을 어떤 이름·라벨로 노출할지 spec 에 먼저 정의되어야 한다. 현재 상태로는 구현자가 스스로 메트릭 이름과 라벨 셋을 결정해야 하는 상황이다.
  - 제안: `spec/5-system/_product-overview.md` §5 에 신규 NF-OB-07(또는 적절한 ID)을 추가해 비즈니스 커스텀 메트릭의 대상 도메인(실행 수·큐 깊이·LLM 토큰), 메트릭 이름 규칙(OTel 명명 컨벤션), 라벨 셋을 명시한 후 구현에 착수한다. plan `spec-sync-5-system-metrics-gap.md` 의 해당 `후속` 항목에도 spec 정의 완료 체크박스를 선행 조건으로 표기한다.

- **[INFO]** `continuation-dlq-monitor.service.ts` 주석 현행화 미완
  - target 위치: `spec/5-system/_product-overview.md` (직접 명시 없음 — 코드 주석 갱신 항목)
  - 관련 plan: `plan/in-progress/spec-sync-5-system-metrics-gap.md` §후속 두 번째 항목 (`continuation-dlq-monitor.service.ts` 의 "OTel traces-only" 주석 현행화)
  - 상세: 이 항목은 spec 문서 변경이 아닌 코드 내 주석 갱신이라 `--impl-prep` 의 spec 정합 검토 범위는 아니다. 그러나 본 worktree 가 비즈니스 메트릭을 추가하면 해당 주석이 더욱 stale 해지므로, 구현 PR 범위에서 함께 처리할지 여부를 사전 결정해두면 좋다.
  - 제안: 구현 PR 에서 해당 주석도 함께 갱신하거나, plan 에 별도 체크박스로 명시해 후속 PR 로 명확히 이관한다.

- **[INFO]** `ai-agent-tool-connection-rewrite.md` — 미결 결정 5건 존재, 본 target 과 직접 충돌 없음
  - target 위치: 해당 없음 (target 은 `5-system/_product-overview.md`)
  - 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §결정 기록 (도구 등록 모델·시그니처 위치·실행 컨텍스트·결과 라우팅·ND-AG-21 우선순위 모두 TBD)
  - 상세: 이 plan 의 미결 결정들은 `spec/4-nodes/` 와 `spec/3-workflow-editor/` 영역에 영향을 미치며, `spec/5-system/_product-overview.md` 와는 교차하지 않는다. 충돌 없음.
  - 제안: 기록 목적 INFO — 별도 조치 불요.

---

## 요약

`spec/5-system/_product-overview.md` 자체는 NF-OB-02 이미 구현 완료(✅) 상태로 안정적이다. 그러나 현재 worktree(`metrics-business-1f9ab7`)의 구현 목적인 **비즈니스 커스텀 메트릭**에 대응하는 독립 spec 항목이 없고, `spec-sync-5-system-metrics-gap.md` plan 에서도 "메트릭 이름/라벨 셋 합의 필요"가 미결로 남아 있다. 구현 착수 전 spec 에 도메인 메트릭 정의(ID·이름·라벨)를 먼저 추가해야 구현이 spec 에서 이탈하지 않는다. 이 외의 진행 중 plan 들(ai-agent-tool-connection-rewrite, ai-context-memory-followup-v2 등)은 본 target 과 영역이 분리되어 있어 충돌이 없다.

---

## 위험도

MEDIUM
