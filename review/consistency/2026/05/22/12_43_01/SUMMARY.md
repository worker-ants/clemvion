# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견이 없어 호출자가 차단할 필요 없음

> 본 디렉토리는 1차 worktree(`cafe24-conditional-required-audit`) 가 cleanup 으로 사라지면서 per-checker `.md` 파일과 `_retry_state.json` 이 유실됐다. 2차 worktree(`cafe24-conditional-required-audit-28fb28`) 복구 시 SUMMARY.md 만 1차 세션 결과를 conversation memory 에서 재구성해 보존. 1차 세션의 5 checker 모두 STATUS=success 였고 (cross_spec ISSUES=4, rationale_continuity ISSUES=3, convention_compliance ISSUES=3, plan_coherence ISSUES=4 LOW, naming_collision ISSUES=5 LOW), BLOCK 결정에 영향 없음.

---

## 전체 위험도
**MEDIUM** — 내부 spec 불일치(WARNING 3건)가 있으나 외부 spec·codebase 와 직접 모순하는 Critical 건 없음

---

## Critical 위배 (BLOCK 사유)

해당 없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 | 처리 |
|---|---------|------|-------------|-----------|------|------|
| W-1 | rationale_continuity (cross_spec·convention_compliance 중복 → 상향) | `§7 operationToMcpTool` pseudo-code 가 2026-05-22 `constraints` 결정을 반영하지 않음 — description 조립 순서(`base → path → constraint suffixes → CAFE24_TIMEZONE_SUFFIX`) 및 `oneOf` → `anyOf` JSON Schema 변환 로직 누락 | `spec/conventions/cafe24-api-metadata.md §7` | 동 문서 §2 채택 결정(D) 및 `customer_list` MCP 출력 예시 | §7 pseudo-code 에 constraints suffix 조립 루프와 `oneOf` 감지 시 `allOf+anyOf` 래핑 로직을 추가하거나, "(constraints 없는 단순화 버전 — 전체 로직은 §2 참고)" 주석 삽입 | **처리 완료** — descParts 조립 + `buildJsonSchema(op)` 위임 + §2 SoT 명시 주석 추가 |
| W-2 | plan_coherence | `constraints` 기능의 backend 구현 4종에 대응하는 follow-up plan 이 어느 in-progress 문서에도 등록되어 있지 않음 | `spec/conventions/cafe24-api-metadata.md §2, §6 step 7/8, §7` | `plan/in-progress/` 전체 | spec merge 전후로 `plan/in-progress/cafe24-conditional-required-impl.md` 를 생성하여 4건을 체크박스로 추적 | **처리 완료** — 본 PR 안에서 plan 신규 생성 |
| W-3 | naming_collision | `oneOf` 문자열 리터럴이 두 DSL 에서 다른 의미로 사용됨 — `Cafe24FieldConstraint.kind='oneOf'`(필드 at-least-one presence) vs. frontend `UiHint.visibleWhen.oneOf`(값 whitelist 비교) | `spec/conventions/cafe24-api-metadata.md §2 Cafe24FieldConstraint` | `codebase/frontend/src/lib/node-definitions/types.ts` line 59; `spec/4-nodes/1-logic/2-switch.md` line 248 | target §2 또는 Rationale 에 "visibleWhen DSL 의 oneOf(field 값 whitelist 비교)와 의미가 다름" 한 줄 추가 | **처리 완료** — type 정의 직후 "이름 주의" 박스 추가 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 | 처리 |
|---|---------|------|------|------|------|
| I-1 | cross_spec | `4-cafe24.md §4 단계 5` 에 constraints 검증 단계 미반영; `§6 CAFE24_MISSING_FIELDS` 설명에 "constraints 위반" 미언급 | `spec/4-nodes/4-integration/4-cafe24.md §4 단계 5, §6` | 단계 5 설명을 "requiredFields 및 constraints 검증" 으로 확장 | **처리 완료** |
| I-2 | cross_spec | `11-mcp-client.md §2.3` 의 "Bridge 별 description suffix" 주석이 constraints suffix 추가를 반영하지 않음 | `spec/5-system/11-mcp-client.md §2.3` | constraints suffix · CAFE24_TIMEZONE_SUFFIX 순서 링크 보완 | **처리 완료** |
| I-3 | cross_spec | `cafe24-api-catalog/_overview.md §4` 검증 규칙 목록에 constraints invariant(`metadata.spec.ts`)가 catalog-sync 와 별개임 미명시 | `spec/conventions/cafe24-api-catalog/_overview.md §4` | 각주 한 줄 추가 | **처리 완료** |
| I-4 | rationale_continuity | §5.3 "description 끝에 한 줄 append" 표현이 constraints 있을 때의 suffix 순서 변화를 언급하지 않음 | `spec/conventions/cafe24-api-metadata.md §5.3` | "(constraints 가 있는 경우 constraint suffix lines 다음 — §2 참고)" 교차 참조 | **처리 완료** |
| I-5 | convention_compliance | Rationale 및 §9 CHANGELOG 의 consistency-check 세션 타임스탬프가 `<timestamp>` placeholder 로 남아 있음 | `spec/conventions/cafe24-api-metadata.md §Rationale, §9 CHANGELOG` | 본 세션 완료 후 `<timestamp>` 를 `12_43_01` 로 갱신 | **처리 완료** |
| I-6 | convention_compliance | `Cafe24FieldConstraint.implies.then` 이 타입 레벨에서 `string[]` 으로 선언되어 invariant("길이 1 이상")와 타입 표현 불일치 | `spec/conventions/cafe24-api-metadata.md §2` | 타입 정의 주석에 `// length >= 1` 추가(필수 아님) | **처리 완료** |
| I-7 | plan_coherence | `node-output-redesign/cafe24.md` 의 `CAFE24_MISSING_FIELDS` 항목이 constraints 위반 시 동일 코드 재사용 미반영 | `plan/in-progress/node-output-redesign/cafe24.md` | 한 줄 주석 추가 권장 | **처리 완료** |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 연관 spec 3곳에 constraints 신규 동작 미반영(INFO 4건) |
| rationale_continuity | MEDIUM | §7 pseudo-code 가 채택 결정(D) 미반영 |
| convention_compliance | LOW | §7 예시 코드 suffix 누락, 타임스탬프 placeholder, type invariant 불일치 |
| plan_coherence | LOW | constraints 구현 4종 follow-up plan 미생성 |
| naming_collision | LOW | `oneOf` 리터럴 이중 의미 사용 |

---

## 권장 조치사항

1. (BLOCK 해소 불필요 — BLOCK: NO) Critical 발견 없으므로 spec merge 를 차단할 이유는 없음.
2. **(W-1)** §7 pseudo-code 를 §2 채택 결정에 맞게 갱신 — 처리 완료.
3. **(W-2)** spec merge 전후로 `plan/in-progress/cafe24-conditional-required-impl.md` 를 생성 — 처리 완료.
4. **(W-3)** §2 또는 Rationale 에 `oneOf` 이중 의미 구분 주석 한 줄 추가 — 처리 완료.
5. **(I-1, I-2, I-3)** 외부 spec touch-ups — 처리 완료.
6. **(I-5)** `<timestamp>` placeholder 를 `12_43_01` 로 교체 — 처리 완료.
