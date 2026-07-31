# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — 코드 변경 없는 순수 spec 텍스트 정정(`spec/1-data-model.md` §2.15 `WorkflowVersion.snapshot` 행)이며, 5개 checker 모두 코드(`buildSnapshot()`)·타 spec(`data-flow/11-workflow.md`, `3-workflow-editor/5-version-history.md`)을 직접 대조해 TO-BE 문구가 실측과 정확히 일치함을 검증했다. Critical 없음, WARNING 1건(plan 체크박스 동기화 절차 누락)은 비차단 위생 항목.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | target 완료 후 원본 plan(`workflow-duplicate-nodes-edges.md`)의 대응 체크박스를 갱신하는 단계가 target 체크리스트에 없음 — target 이 `plan/complete/` 로 이동해도 원본 plan §3 는 이미 끝난 항목을 계속 "미해결 follow-up" 으로 보유하게 되어 향후 grooming 시 중복 조사 비용 유발 가능 | `plan/in-progress/spec-workflow-version-snapshot-drift.md` `## 체크리스트` (L66-70) | `plan/in-progress/workflow-duplicate-nodes-edges.md` `## 3. 후속 항목` 세 번째 불릿 (L170-174, 미체크 `[ ]`) | target 체크리스트에 "`workflow-duplicate-nodes-edges.md` §3 의 `spec/1-data-model.md:572 §2.15` 항목을 `[x]` 로 갱신" 스텝 추가, 또는 `plan/complete/` 이동 커밋에 동반 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, rationale_continuity | "두 spec 문서 상충" 프레이밍이 3번째 동조 소스를 누락 — `spec/3-workflow-editor/5-version-history.md` §7.2/§8 의 `VersionSnapshot` TS interface(`name`/`description`/`nodes`/`edges`, settings 없음)도 이미 TO-BE 와 일치. 실제로는 코드·data-flow·version-history 3곳이 합의, data-model 1곳만 outlier(과소 집계일 뿐 결론은 오히려 더 강해짐) | Overview 비교표(§0), §2 "셋 중 둘(코드·data-flow)이 일치" 문구 | Overview 표에 `spec/3-workflow-editor/5-version-history.md §7.2/§8` 행 추가, "두 spec 문서 상충" → "data-flow·version-history(+코드) vs data-model" 로 문구 정정 (선택) |
| 2 | cross_spec, convention_compliance | TO-BE SoT 링크 `[data-flow §1.1 / Rationale "버전 스냅샷 = JSONB"](./data-flow/11-workflow.md)` 에 `#rationale` anchor 없음 — 같은 문서(`spec/1-data-model.md`) 안에서 이미 3회 이상 확립된 관례(§2.10 install_token, Webhook R-A, auth §1.4 인용 등)와 편차 | §1.1 TO-BE 셀 | `./data-flow/11-workflow.md#rationale` 로 앵커 추가 — 대상 문서에 실제 `## Rationale`(line 223) 헤딩 존재 확인됨 (선택, 블로킹 아님) |
| 3 | rationale_continuity | `spec/1-data-model.md` 자체 `## Rationale` 절에 이번 정정에 대응하는 스텁 부재 — 같은 문서의 install_token 항목은 "body 요약 + 로컬 Rationale 스텁 + 외부 SoT 링크" 3단 구조를 쓰는 선례 존재 | TO-BE (표 행만 정정 제안, `## Rationale` 절 갱신 없음) | `spec/1-data-model.md` `## Rationale` 에 "WorkflowVersion.snapshot 구성 정정 (2026-07-31)" 한 줄 스텁 + data-flow Rationale 참조 추가 고려 (선택) |
| 4 | convention_compliance | JSONB 구성 서술 표기가 문서 내 기존 두 관례(중괄호 표기 `{ code, message, stack? }` / "알려진 키:" 산문 표기)와 다른 제3의 형태(쉼표+backtick 나열) — SoT 문서(`data-flow/11-workflow.md:234`) 자체도 `+` 연결의 또 다른 표기 사용 | TO-BE 셀 필드 나열 (`` `name`, `description`, `nodes`, `edges` ``) | `` `{ name, description, nodes, edges }` `` 형태로 통일 고려 — 강제 사항 아님 (선택) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `spec/1-data-model.md:572`(AS-IS), `spec/data-flow/11-workflow.md:52,61,232-238`(TO-BE SoT), `workflows.service.ts:620-651` `buildSnapshot()` 3개 소스 직접 대조 — target 문구와 완전 일치. INFO 2건(동조 소스 과소 인용, 앵커 링크 편차) |
| rationale_continuity | NONE | `git log -S`/`git show` 로 이력 추적 — data-model §2.15 는 2026-03-26 최초 초안 이후 미갱신, data-flow 는 2026-06-10 spec↔code 전수 감사 커밋에서 코드 관찰 근거로 정정됐으나 그 커밋이 §2.15 만 누락. "결정 번복 아닌 후속 정정 완결" 판정. INFO 2건 |
| convention_compliance | LOW | 신규 명명·API 계약·출력 포맷·API 문서 데코레이터 도입 없음. plan frontmatter 3필드, Gate C `spec_impact` 리스트 형식, frontmatter-evidence 가드 제외 대상 여부 모두 부합 확인. INFO 2건(앵커, 표기 스타일) — 모두 성문화된 규약 위반 아닌 파일-로컬 관례 편차 |
| plan_coherence | LOW | 선행 plan(`workflow-duplicate-nodes-edges.md` §3)으로부터의 **의도된 인계** 확인, 미해소 전제·결정 충돌 없음. WARNING 1건(원본 plan 체크박스 동기화 절차 target 체크리스트에 누락) |
| naming_collision | NONE | 신규 식별자(요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·파일 경로) 0건. 사용 표기 전부 기존 코드·data-flow·version-history 3곳 합의사항과 일치 — 오히려 AS-IS 의 기존 용어 혼선("snapshot 안에 settings 존재")을 해소 |

## 권장 조치사항
1. (WARNING 해소 권장, 비차단) target `## 체크리스트`에 `plan/in-progress/workflow-duplicate-nodes-edges.md` §3 의 `spec/1-data-model.md:572 §2.15` 항목을 `[x]` 로 갱신하는 스텝을 추가하거나, `plan/complete/` 이동 커밋에 동반한다.
2. (선택) Overview 비교표에 `spec/3-workflow-editor/5-version-history.md §7.2/§8`(`VersionSnapshot` TS interface) 참조를 추가해 "data-flow·version-history(+코드) vs data-model" 3-소스 합의 구도를 명시한다.
3. (선택) TO-BE 의 SoT 링크에 `#rationale` 앵커를 부착해 같은 문서 내 기존 인용 관례와 맞춘다.
4. (선택) `spec/1-data-model.md` `## Rationale` 절에 이번 정정을 요약하는 한 줄 스텁을 추가해 재drift 조기 발견을 돕는다.
5. (선택) JSONB 필드 나열 표기를 문서 내 기존 중괄호 표기(`{ name, description, nodes, edges }`)로 통일한다.