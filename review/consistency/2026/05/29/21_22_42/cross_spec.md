# Cross-Spec 일관성 검토 결과

**대상**: `spec/5-system/4-execution-engine.md` frontmatter `status: spec-only → partial` + 본문 2개 narrative 정정, 신규 plan 2개 (`execution-engine-residual-gaps.md`, `spec-frontmatter-status-migration.md`)
**검토 기준**: diff `origin/main` → `spec-frontmatter-status-migration-027c17`
**검토 일시**: 2026-05-29

---

## 발견사항

### 1. 내부 self-inconsistency — `_multiTurnState` 삭제 선언과 strip 코드 공존

- **등급**: INFO
- **target 위치**: `spec/5-system/4-execution-engine.md §1.3` 재개 state 직렬화 필드 블록, 97~99행
- **충돌 대상**: 동일 파일 내 97행 vs 99행
- **상세**: 97행에서 "옛 `_multiTurnState` 키는 Stage 2 rename + Stage 5 제거가 완료되어 현재 코드·페이로드에 존재하지 않는다"고 선언하면서, 99행에서 "`stripControlFields()`가 `_resumeState` / `_multiTurnState` 양쪽 모두를 제거한다"고 기술한다. 이는 cross-spec 충돌이 아닌 동일 파일 내 문구 사이의 표면적 긴장이다. 방어적 코딩(defensive strip) 의도로 해석되며, `spec/conventions/node-output.md §4.2` 폐기 필드 목록도 `_multiTurnState → _resumeState 통일` 이력만 기록할 뿐 현재 strip 동작에는 무언급이라 외부 spec과 충돌은 없다. 다만 99행의 `_multiTurnState` 언급이 "이미 없는 키를 strip 하는 dead-code guard인가, 아니면 구버전 페이로드 호환을 위한 의도적 guard인가"가 불명확해 독자 혼란 소지가 있다.
- **제안**: 99행에 "(구버전 페이로드 호환 defensive guard — 신규 페이로드에는 등장하지 않음)" 주석 추가 권고. 이번 변경의 차단 조건은 아님.

---

### 2. §11 Graceful Shutdown 본문의 "Phase 1/2 예정" 문구 잔류 — plan 으로 추적 중

- **등급**: INFO
- **target 위치**: `spec/5-system/4-execution-engine.md §11` 1009행, 1017행
- **충돌 대상**: `plan/in-progress/execution-engine-residual-gaps.md` G1, G2
- **상세**: 본 diff 는 `_multiTurnState` fallback 문구와 presentation status 문구 2곳만 정정하며, §11 의 "Phase 2...WS handler 신설 예정"(1009행), "Phase 2...`continue` 분기 추가 예정"(1017행) 문구는 그대로 남긴다. 신규 plan `execution-engine-residual-gaps.md` 가 G1(WS start gate) / G2(errorPolicy continue 분기) 로 이 미구현 surface 를 명시적으로 인수받고 있으므로, spec 본문의 잔류 "예정" 문구와 plan 의 미구현 추적이 정합된다. cross-spec 충돌이 아닌 정상 상태이다.
- **제안**: 변경 불필요. G1/G2 plan 완료 시 §11 의 "Phase 1 구현 범위" 주석 제거로 마무리한다.

---

### 3. spec-impl-evidence 규약 준수 검증 — 통과

- **등급**: INFO
- **target 위치**: `spec/5-system/4-execution-engine.md` frontmatter
- **충돌 대상**: `spec/conventions/spec-impl-evidence.md §3` 및 build-guard 4종
- **상세**: 변경 후 frontmatter는 `status: partial` + `code: [codebase/backend/src/modules/execution-engine/**]` (glob 매치 의무 충족) + `pending_plans: [plan/in-progress/execution-engine-residual-gaps.md]` (plan 실존 의무 충족). spec-impl-evidence §3 의 `partial` 조건인 "`code:` ≥1 glob 매치 의무" 와 "`pending_plans:` ≥1 in-progress 실존 의무"를 모두 만족한다. `spec-pending-plan-existence.test.ts`, `spec-code-paths.test.ts`, `spec-status-lifecycle.test.ts`, `spec-frontmatter.test.ts` 4개 build-guard 전부 통과 예상.
- **제안**: 변경 불필요.

---

### 4. `spec-frontmatter-status-migration.md` 의 B0 체크리스트 vs 실제 diff 정합

- **등급**: INFO
- **target 위치**: `plan/in-progress/spec-frontmatter-status-migration.md §B0`
- **충돌 대상**: `spec/5-system/4-execution-engine.md` diff (실제 변경 내용)
- **상세**: plan B0 체크리스트의 세 항목 — (a) `_multiTurnState` legacy fallback "제거 예정" → 이미 제거됨 정정, (b) presentation status `resumed` 통일 예정 → 이미 통일됨 정정, (c) frontmatter `partial` + `code:` + `pending_plans:` 설정 — 이 실제 diff 내용과 1:1 일치한다. plan과 변경 내용 간 불일치 없음.
- **제안**: 변경 불필요.

---

### 5. `execution-engine-residual-gaps.md` G3 — spec §9.2 TTL 미설정 문구와 data-flow spec 동기화 필요

- **등급**: INFO
- **target 위치**: `plan/in-progress/execution-engine-residual-gaps.md §G3`, `spec/5-system/4-execution-engine.md §9.2` 916행
- **충돌 대상**: `spec/data-flow/3-execution.md` 158행 (`exec:cont:seq` TTL 미설정 동일 기술)
- **상세**: spec §9.2 916행에서 `exec:cont:seq:<executionId>` 키의 TTL 미설정을 "Phase 3 후속 정리 예정"으로 기술하고 있으며, `spec/data-flow/3-execution.md` 158행도 동일 내용을 동일하게 기술한다. 현재 두 파일이 동일한 "미설정 + 후속 정리"로 일치하여 충돌은 없다. 그러나 G3 구현 완료 시 두 파일을 함께 갱신해야 한다는 의존성이 있다.
- **제안**: `execution-engine-residual-gaps.md §G3` 의 완료 조건에 `spec/data-flow/3-execution.md 158행` 병행 갱신을 추가할 것을 권고.

---

### 6. 기존 presentation 노드 스펙과의 정합 — 충돌 없음

- **등급**: INFO
- **target 위치**: `spec/5-system/4-execution-engine.md §1.3` 120행
- **충돌 대상**: `spec/4-nodes/6-presentation/` 전체 (0-common, 1-carousel, 2-table, 3-chart, 4-form, 5-template)
- **상세**: target 변경은 "presentation 노드의 재개 상태가 `status: 'resumed'` 로 통일돼 있다. 옛 `'submitted'` / `'button_click'` / `'button_continue'` 는 더 이상 status 값으로 쓰이지 않으며, 해당 의미는 `interaction.type` enum 으로만 표현된다"고 기술한다. 이는 개별 presentation node 스펙 전체(carousel §5.5, table §5.5, chart §5.5, form §5.5, template §5.5, 0-common §4.2) 가 `status: "resumed"` 를 사용하고 `button_click` / `button_continue` / `form_submitted` 는 `interaction.type` 값으로만 쓰는 현행 SoT 와 완전히 일치한다.
- **제안**: 변경 불필요.

---

### 7. `_resumeState` / `_retryState` 기술 — node-output convention 및 AI Agent spec 과의 정합

- **등급**: INFO
- **target 위치**: `spec/5-system/4-execution-engine.md §1.3` 94~107행 (변경되지 않은 기존 문구)
- **충돌 대상**: `spec/conventions/node-output.md §4.2.1`, `spec/4-nodes/3-ai/1-ai-agent.md §7.4·§7.9`
- **상세**: target 변경은 `_resumeState`·`_retryState` 설명을 건드리지 않는다. 기존 기술이 node-output convention(`_resumeState` 무조건 strip, `_retryState` 보존 예외)과 ai-agent spec(§7.4 `_resumeState` shape, §7.9 `_retryState` 운반)과 정합된다. 이번 변경이 이 영역에 회귀를 유발하지 않음을 확인한다.
- **제안**: 변경 불필요.

---

## 요약

이번 변경은 `spec/5-system/4-execution-engine.md` frontmatter를 `spec-only`에서 `partial`로 전이하고, 이미 완료된 구현 사실이 반영되지 않은 두 개의 stale 문구("_multiTurnState legacy fallback"과 "presentation status resumed 통일 예정")를 현재 시제로 정정한다. 검토 결과 다른 spec 영역과의 직접적인 데이터 모델·API 계약·상태 전이·RBAC·계층 책임 충돌은 발견되지 않았다. spec-impl-evidence 규약 준수도 확인됐다. 전체 발견 항목이 INFO 등급이며, 가장 주의할 사항은 `stripControlFields()` 내 `_multiTurnState` 언급의 의도를 명확히 하는 것과 G3 완료 시 `spec/data-flow/3-execution.md` 병행 갱신이 필요하다는 점이다. 본 변경을 그대로 채택해도 어떤 spec 영역도 작동 불가 상태에 빠지지 않는다.

## 위험도

NONE
