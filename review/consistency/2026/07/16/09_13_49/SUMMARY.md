# Consistency Check 통합 보고서 (--impl-done)

**BLOCK: NO (확정)** — 5/5 checker CRITICAL=0. 1차 workflow 에서 FS-write flakiness 로 유실됐던 3개(convention_compliance·plan_coherence·naming_collision)를 main 이 직접 재호출해 전수 확보 완료(모두 CRITICAL=0).

## 재실행 결과 (3개 checker 확정)

- **convention_compliance** (CRITICAL=0): WARNING 1건 — 신규 `tool-payload-save-warning.ts` 가 `cross-node-warning-rules.md` `code:` 엔 추가됐으나 `ai-agent.md` `code:` frontmatter 에 누락(spec-impl-evidence §2.1 완전성). → **조치: `ai-agent.md` frontmatter `code:` 에 추가(수정 완료)**. INFO 2건은 diff 밖 pre-existing.
- **plan_coherence** (CRITICAL=0): INFO 1건 — 동일 code: 누락(위 조치로 해소). followups plan 항목 A 체크리스트와 diff 정확 일치, 항목 B(codebase-only)·별도 plan 과 충돌 없음 확인. node-output-redesign 의 미해결 CRITICAL(single-turn chat try/catch)이 본 diff 로 해소된 것처럼 오인 소지 없음 재확인(신규 try/catch 는 buildTools pre-flight 만 좁게 감쌈).
- **naming_collision** (NONE): 신규 식별자(`AI_AGENT_TOOL_BUDGET_STRICT_SAVE`·`tool-payload-save-warning.ts`·rule id·i18n key·함수/타입명·`getGraphWarnings` 시그니처) 전수 대조 — 충돌 없음.

**최종 판정: BLOCK: NO** (5/5 CRITICAL=0). WARNING(code: 완전성) 조치 완료. INFO 는 pre-existing/절차 문구 수준.

---

## (1차 workflow 잠정 보고 — 참고용, 아래는 2/5 checker 만 반영한 초기 판정)

**BLOCK: NO** — 확보된 2개 checker(cross_spec, rationale_continuity) 결과에는 Critical 위배 없음. 단, 아래 §커버리지 경고 참고.

## 커버리지 경고 (중요)

`convention_compliance`, `plan_coherence`, `naming_collision` 3개 checker 는 workflow manifest 상 `status=success` 로 보고됐으나, 지정된 `output_file` 이 디스크에 실제로 존재하지 않았다 (`Read` 시도 시 "File does not exist", `ls` 로도 미확인). 이는 알려진 "Consistency/ai-review Workflow FS-write flakiness" 패턴(성공 보고 + 파일 미생성, 비결정적)과 일치한다. 이 3개 checker 는 **재시도 필요**로 표기하며, 아래 BLOCK/위험도 판정은 나머지 2개 checker 결과만 반영한 잠정치다. 재실행 후 Critical 이 나오면 재평가 필요.

## 전체 위험도
**LOW** (확보된 2개 checker 기준) — cross_spec·rationale_continuity 모두 LOW, Critical/WARNING 없음. 단 5개 중 3개 checker 결과 미확보로 전수 커버리지 아님.

## Critical 위배 (BLOCK 사유)

없음 (확보된 결과 기준).

## 경고 (WARNING)

없음 (확보된 결과 기준).

## 참고 (INFO)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `spec/data-flow/11-workflow.md §1.2` 의 Tool Area 배치 서술이 "제거됨(재작성 예정)" 상태를 반영하지 않음 (pre-existing, 이번 diff 무관 — 2026-06-23 검토에서 이미 known gap 으로 보고된 패턴의 연장) | `spec/4-nodes/3-ai/1-ai-agent.md §1/§4` ("⚠ 재작성 예정 (현재 제거됨)") | `spec/data-flow/11-workflow.md §1.2` Tool Area 배치 표, `tool_owner_id` 서술 | `§1.2` Tool Area 행에 canvas §12·ai-agent §1 과 동일한 "현재 비활성 — 재작성 예정" 각주 추가 (DB 컬럼·CHECK 제약은 유효하므로 UI 입력 경로만 비활성임을 명확화). 이번 작업 범위 밖, Tool Area 재설계 plan 착수 시 함께 정리 권장 |
| 2 | rationale_continuity | `status: implemented` 승격이 "pending_plans 가 `plan/complete/` 로 이동한 커밋에서 승격" 절차 문구와 자구적으로 어긋남 (plan 자체는 `plan/in-progress/` 잔류, 참조만 제거 후 즉시 승격) | `spec/conventions/cross-node-warning-rules.md` frontmatter (`status: partial→implemented`), `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter (`pending_plans` 삭제) | `spec/conventions/spec-impl-evidence.md §3.1` 절차 문구 + `## Rationale` R-5 | 실질적 피해 없음(followups plan 체크리스트에 이 정리가 이미 계획돼 있었고, 남은 "항목 B"는 두 spec 문서 어디에도 대응 약속을 남기지 않음). `§3.1` 에 "부분 완료 plan 의 특정 항목만 fulfil 된 경우" 예외 케이스를 짧게 명문화하면 향후 동일 패턴 혼선 방지 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | API 계약(`GET /workflows/:id/graph-warnings`)·데이터 모델(Integration `service_type`/`connected`)·RBAC/테넌트 격리·i18n 컨벤션·env 문서 전반 정합 확인. 유일한 발견은 pre-existing INFO(Tool Area 문서 drift, 이번 diff 무관) |
| rationale_continuity | LOW | `tool-payload-save-warning.ts` 실제 로직과 §10 신규 문구 정확히 일치, §12.15 기존 Rationale 이 신규 스코프 결정 사전 포섭 — 기각 대안 재도입/무근거 번복 없음. 유일한 발견은 승격 절차 문구 자구적 불일치(INFO, 실질 피해 없음) |
| convention_compliance | **재시도 필요** | status=success 보고되었으나 output_file(`convention_compliance.md`) 디스크에 미존재 |
| plan_coherence | **재시도 필요** | status=success 보고되었으나 output_file(`plan_coherence.md`) 디스크에 미존재 |
| naming_collision | **재시도 필요** | status=success 보고되었으나 output_file(`naming_collision.md`) 디스크에 미존재 |

## 권장 조치사항

1. (BLOCK 해소 우선) 현재 Critical 없음 — BLOCK 해소 불필요.
2. **[우선]** `convention_compliance`, `plan_coherence`, `naming_collision` 3개 checker 를 재실행하여 output_file 을 실제로 확보한 뒤, 이번 SUMMARY 를 갱신하고 Critical 유무를 재확정할 것. 현재 BLOCK=NO 는 2/5 checker 만 반영한 잠정 판정.
3. (선택, 범위 밖) `spec/data-flow/11-workflow.md §1.2` 에 Tool Area "현재 비활성 — 재작성 예정" 각주 추가 — Tool Area 재설계 plan 착수 시 함께 정리.
4. (선택) `spec/conventions/spec-impl-evidence.md §3.1` 에 "부분 완료 plan 의 특정 항목만 fulfil 된 경우" 승격 절차 예외 케이스 명문화 검토.