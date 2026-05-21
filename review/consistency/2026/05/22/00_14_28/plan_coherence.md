# Plan 정합성 검토 결과

target: `spec/0-overview.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-05-22

---

## 발견사항

### 1. [WARNING] spec-overview-followups-2026-05-18 §2 와 target 의 §6 동일 영역 수정

- **target 위치**: `spec/0-overview.md §6.1 / §6.2 / §6.3` — Cafe24 통합 분류, Parallel 노드 §6.2, Roadmap §6.3 등 §6 전체 구조
- **관련 plan**: `plan/in-progress/spec-overview-followups-2026-05-18.md §2` — "spec/0-overview.md §6.2 Cafe24 분류 정합화 (I-1)"
- **상세**: target 문서의 Rationale 섹션(§ `### Cafe24 통합을 §6.1 (완료) 분류로`) 에 명시된 "Cafe24 항목을 §6.1 로 이동, §6.3 로 분리 유지"는 `spec-overview-followups-2026-05-18.md §2` 가 아직 체크리스트 미완료(`[ ]`) 상태로 미결인 I-1 결정과 같은 결론이다. 해당 plan §2 는 안(A)/안(B) 중 택일을 미결로 남겨두고 있고, target 은 안(A)를 이미 반영 완료한 상태로 양쪽이 같은 spec 텍스트를 다루고 있다. worktree 가 중복으로 수정할 경우 충돌 발생 위험. 단, target 문서가 이미 변경을 반영했다면 `spec-overview-followups-2026-05-18.md §2` 체크박스가 갱신되지 않은 채 남아 있어 plan 상태와 실제 문서 상태가 불일치한다.
- **제안**: `plan/in-progress/spec-overview-followups-2026-05-18.md §2` 의 체크박스와 "결정" 항목을 target 반영으로 완료 표시(`[x]`)하고, 해당 plan 의 §2 가 유일 미해결 항목이 아니면 나머지 §1/§3/§4 상태에 따라 `plan/complete/` 이동 여부 검토.

---

### 2. [WARNING] spec-followup-cron-7d-statemachine 과의 §6.1 Cafe24 텍스트 경합

- **target 위치**: `spec/0-overview.md §6.1` Cafe24 행 — "6h cron 백그라운드 갱신 (refresh_token 14일 만료 전 자동 갱신, 2026-05-19 정책)"
- **관련 plan**: `plan/in-progress/spec-followup-cron-7d-statemachine.md §A-3` — "`spec/0-overview.md §6.2` cafe24 항목 (line 90) — '10일 임계 백그라운드 갱신' → '7일 임계 + 6h cron 백그라운드 갱신'"
- **상세**: `spec-followup-cron-7d-statemachine` 은 `spec/0-overview.md §6.2` 의 Cafe24 cron 텍스트를 수정 대상으로 명시하고 있다. target 의 해당 §6.1 에는 "6h cron 백그라운드 갱신 (refresh_token 14일 만료 전 자동 갱신, 2026-05-19 정책)"이 이미 기술되어 있다. 두 plan 이 같은 Cafe24 행에 손대고 있어 어느 worktree 가 먼저 머지되느냐에 따라 텍스트 경합이 발생한다. `spec-followup-cron-7d-statemachine` 자체가 이를 인지하고 "본 plan 이 먼저 머지되어야 그 후속 plan 이 갱신된 텍스트 위에서 분류 재배치만 수행 가능"이라고 후속 절에 명시하고 있다.
- **제안**: target (spec-overview-followups-bundle) worktree 가 이 행을 반영한 상태라면 `spec-followup-cron-7d-statemachine §A-3` 의 해당 체크박스를 완료로 표시하거나, 두 PR 의 머지 순서를 PR 본문에 명시해야 한다.

---

### 3. [WARNING] spec-overview-followups-2026-05-18 §3 Rationale 섹션 신설과 target 내 Rationale 섹션 실제 존재

- **target 위치**: `spec/0-overview.md ## Rationale` 섹션 전체 (S3 키 prefix / Flyway / Redis 큐 / Inline Alert 위치 / Cafe24 §6.1 분류)
- **관련 plan**: `plan/in-progress/spec-overview-followups-2026-05-18.md §3` — "spec/0-overview.md 말미에 `## Rationale` 섹션 신설 (W-3)" 체크리스트 미완료
- **상세**: `spec-overview-followups-2026-05-18.md §3` 는 Rationale 섹션 신설을 미완료(`[ ]`) 작업으로 추적 중이나, target 문서에는 이미 충실한 `## Rationale` 섹션이 존재한다. plan 의 체크박스 상태가 실제 문서 반영 결과와 불일치한다. 이는 "plan 은 미해결" 로 남아있는데 실제 spec 은 완료된 상태여서 추적 무결성이 깨져 있다.
- **제안**: `spec-overview-followups-2026-05-18.md §3` 전 체크박스를 `[x]` 로 갱신한다. §3 가 유일한 미완 항목이었다면 plan 자체를 `plan/complete/` 로 이동한다. §1/§4 등 다른 항목 완료 상태도 함께 확인할 것.

---

### 4. [WARNING] spec-overview-followups-2026-05-18 §4 CLAUDE.md 명명 컨벤션 항목 — target 과의 관계 불명확

- **target 위치**: `spec/0-overview.md §8 문서 맵` — 루트 레벨 `spec/0-overview.md / spec/1-data-model.md / spec/6-brand.md` 의 cross-cutting 패턴 설명 포함
- **관련 plan**: `plan/in-progress/spec-overview-followups-2026-05-18.md §4` — "CLAUDE.md §명명 컨벤션 — 루트 레벨 `spec/0-overview.md` 항목 명시" 미완료
- **상세**: §4 는 CLAUDE.md 변경이므로 spec 본문 변경 없다고 plan 에 명시되어 있으나, target `spec/0-overview.md §8` 의 문서 컨벤션 절이 이미 루트 레벨 파일의 특성을 서술하고 있다. CLAUDE.md 변경이 완료되면 §8 과의 내용 동기화를 재확인해야 한다. target 이 §8 을 확장하거나 수정했다면 CLAUDE.md §4 작업 결과와 충돌이 없는지 검토 필요.
- **제안**: `spec-overview-followups-2026-05-18.md §4` 진행 전 target 의 §8 변경 내용과 교차 확인. CLAUDE.md 수정 PR 본문에 target 의 §8 내용과 중복·충돌 없음을 명시.

---

### 5. [INFO] cafe24-bg-refresh-tuning 의 spec 후속 항목이 target 에서 반영됨 — plan 갱신 필요

- **target 위치**: `spec/0-overview.md §6.1` Cafe24 행 — "6h cron 백그라운드 갱신 (refresh_token 14일 만료 전 자동 갱신, 2026-05-19 정책)"
- **관련 plan**: `plan/in-progress/cafe24-bg-refresh-tuning.md §후속` — "spec/2-navigation/4-integration.md / spec/data-flow/integration.md 의 cafe24 background refresh 주기 / cutoff 마진 명시 갱신 (project-planner 위임)"
- **상세**: `cafe24-bg-refresh-tuning` 의 "후속" 절은 spec 갱신을 project-planner 에 위임한다고 기술했다. target 이 `spec/0-overview.md` 를 수정하며 이 일부를 반영했다면 `cafe24-bg-refresh-tuning` 의 후속 항목 중 0-overview.md 관련 부분이 해소된 것이나 plan 에 체크박스나 완료 표시가 없어 추적 누락.
- **제안**: `cafe24-bg-refresh-tuning.md` 의 후속 절에 "spec/0-overview.md 갱신 완료" 메모를 추가하거나, 해당 plan 의 후속 범위 텍스트를 현행화한다.

---

### 6. [INFO] 0-unimplemented-overview.md 의 plan 파일 목록과 target 작업 브랜치 불일치

- **target 위치**: (본 분석의 target 자체가 `spec/0-overview.md` 의 draft)
- **관련 plan**: `plan/in-progress/0-unimplemented-overview.md §plan 문서 목록` — `spec-overview-followups-2026-05-18.md` 열거 포함
- **상세**: `0-unimplemented-overview.md` 의 plan 문서 목록은 2026-05-18 기준 스냅샷이다. target 작업(spec-overview-followups-bundle worktree)이 진행되면서 `spec-overview-followups-2026-05-18.md` 의 §2/§3 가 부분 완료될 경우 해당 인덱스를 갱신해야 한다. 강제성이 높은 항목은 아니나 인덱스 문서의 신뢰성을 위해 추적 권장.
- **제안**: target PR 머지 후 `0-unimplemented-overview.md` 의 plan 목록 및 "최근 완료" 절을 현행화하는 chore commit 추가.

---

## 요약

`spec/0-overview.md` target 문서는 `plan/in-progress/spec-overview-followups-2026-05-18.md` 의 §2 (Cafe24 §6.2 분류 정합화), §3 (Rationale 섹션 신설) 두 항목을 이미 반영한 상태이나 해당 plan 의 체크박스는 미완료(`[ ]`)로 남아 있어 추적 불일치가 발생한다. 또한 `spec-followup-cron-7d-statemachine` plan 이 동일 파일의 §6 Cafe24 행 텍스트를 별도로 수정 대상으로 지목하고 있어 두 worktree 간 텍스트 경합 위험이 있으며, 해당 plan 스스로 머지 순서 의존을 후속 절에 명시하고 있다. 이러한 plan-문서 상태 불일치와 동일 영역 경합이 복수 존재하므로, target PR 머지 전에 관련 plan 들의 체크박스를 현행화하고 머지 순서를 PR 본문에 명시하는 것이 필요하다. CRITICAL 급 미해결 결정 우회나 완전한 worktree 파일 수준 충돌은 확인되지 않았다.

---

## 위험도

MEDIUM
