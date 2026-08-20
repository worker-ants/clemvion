# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 3건 발견 (spec 자기모순 2건 + 식별자 방향 미확정 1건)

## 전체 위험도
**HIGH** — `Execution.inputData` "egress 마스킹 대상 아님" 결론이 R17 이외 최소 2개 spec 문서에 SoT 로 미러돼 있는데 이번 plan 의 `spec_impact` 는 R17 한 곳만 지목한다. 착수 전 정정하지 않으면 spec 자기모순이 확정적으로 발생한다. 추가로 backend 앵커 상수의 방향(폐기/반전) 미확정이 실제 코드 리스크를 남긴다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `Execution.input_data` 필드 정의가 "egress 마스킹 대상이 아니다"를 R17 을 근거로 단언 — R17 반전과 정면 충돌 | `plan/in-progress/eia-inputdata-marker-guard.md` `spec_impact`(R17 만 등재, 범위 밖) | `spec/1-data-model.md:471` §2.13 | `spec_impact`에 `spec/1-data-model.md` §2.13 추가, 마스킹 전환 반영해 재작성(NodeExecution.input_data 대비 서술도 동반 재조정) |
| 2 | cross_spec + rationale_continuity(중복 통합, 강한 등급 채택) | Re-run 모달 caveat "**이 모달이 그 이유다**"가 R17 반전 시 직접 반증되는 서술로 남음 | `plan/in-progress/eia-inputdata-marker-guard.md` `spec_impact`(범위 밖) | `spec/5-system/13-replay-rerun.md:350-363` §10.2 | `spec_impact`에 추가, §R17 갱신과 같은 커밋에서 §10.2 재작성(카브아웃 닫힘 + 마커 가드 동작 요약) |
| 3 | naming_collision | `MASKED_INPUT_DATA_REASON` 앵커 "폐기 또는 반전" 미확정 상태로 impl-prep 통과 시도 — 반전 시 동일 식별자가 6개 파일에서 정반대 의미로 잔존 | plan 범위 체크리스트 "backend — ... (`MASKED_INPUT_DATA_REASON` 앵커 폐기 또는 반전)" | `codebase/backend/src/modules/executions/executions.service.ts` 외 5개 파일(`.spec.ts`, `execution-response.dto.ts`, `background-runs.service.ts:304`, `background-runs.service.spec.ts`, `background-run-response.dto.ts`) | 착수 전 방향 단일 확정(반전 시 새 식별자명 채택 권장, 기존 이름 재사용 금지) + 선택 시 6개 참조처 전수 갱신을 리뷰 체크리스트에 명시. `background-runs.service.ts:304`의 "Execution 레벨만 예외" 대비 문장 필수 포함 |

## planner 인계 (권한 밖 Critical)

> 아래 항목은 CRITICAL·`BLOCK: YES` 유지. developer 는 `spec/` write 권한이 없어(CLAUDE.md: "developer 는 `spec/` read-only") 직접 해소 불가능한 항목만 여기 싣는다. Critical #3(naming_collision)은 plan 체크리스트/구현 결정 문제로 developer 권한 내이므로 이 표에는 없다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | `spec/1-data-model.md` §2.13 수정은 `spec/` 쓰기 — CLAUDE.md 상 project-planner 전속 | project-planner | `spec/1-data-model.md` §2.13 `Execution.input_data` 행(471행)을 마스킹 전환 반영으로 재작성 + `NodeExecution.input_data` 대비 서술 재조정 | `plan/in-progress/eia-inputdata-marker-guard.md` `spec_impact` |
| 2 | `spec/5-system/13-replay-rerun.md` §10.2 수정도 `spec/` 쓰기 — 동일 사유 | project-planner | §10.2 caveat 블록 재작성("카브아웃은 닫혔다 — 프런트 마커 가드가 프리필/제출을 막는다" + 가드 동작 요약), `spec_impact`에 파일 추가 | `plan/in-progress/eia-inputdata-marker-guard.md` `spec_impact`; `plan/in-progress/spec-sync-external-interaction-api-gaps.md`("타 문서가 EIA 의 현재 형태를 못 따라간 서술" 절 — 같은 유형 세 번째 반복 방지) |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | 에디터 히스토리 로드의 신규 차단 동작이 spec 에 미반영 — `13-replay-rerun.md §10.2` 는 이미 "§2.2 도 동일 적용"이라고 상호참조 중 | plan 범위 체크리스트 "에디터 히스토리 로드 마커 가드" | `spec/3-workflow-editor/3-execution.md:91` §2.2 "히스토리 로드" 행 | `spec_impact`에 추가, §2.2 행에 마커 가드 캐비엇 추가(위 planner 인계 #1/#2 턴에 함께 처리 권장) |
| 2 | rationale_continuity | 에디터 히스토리(JSON 텍스트 전체) 마커 감지를 raw substring 매칭으로 구현하면 `isMaskedMarker` 가 명시적으로 기각한 "부분 포함" 경계 위반이 재발(예: 마크다운 `***bold***` 오탐) | plan 설계 섹션 "두 소비처의 가드가 왜 서로 다른가" | `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx`(`isMaskedMarker` JSDoc), `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` | 파싱된 `inputData` 객체의 leaf 값을 순회하며 `isMaskedMarker` 재사용(재구현 금지) + JSON 파싱 실패 시 fallback 정책(직전 유효 결과 유지 vs 보수적 차단) 명문화 |
| 3 | plan_coherence | target `code:` frontmatter 가 이번에 실제로 편집될 두 소비처 파일을 미등재 | `spec/5-system/14-external-interaction-api.md` frontmatter `code:` | `codebase/frontend/src/components/executions/rerun-modal.tsx`, `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` | plan 체크리스트에 `code:` 갱신 항목 추가(§R17 갱신 스텝에 묶어 planner 턴에서 처리) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | `X-Refresh-Token-Url` 헤더가 문서 내 `X-Clemvion-*` 접두 패턴을 벗어남 | `spec/5-system/14-external-interaction-api.md` §5.1/§5.5 | `X-Clemvion-Refresh-Token-Url` 통일 검토, breaking 비용 크면 캐비엇만 추가 |
| 2 | convention_compliance | §10.1 Swagger Bearer scheme 서술에 "(구현됨)" 라벨 누락 | `spec/5-system/14-external-interaction-api.md` §10.1 | 다른 §3.x/§5.x/§6.x 와 라벨 정합 |
| 3 | rationale_continuity | R17 카탈로그 확장 시 아라비아 숫자 표기 규약 준수 상기 — 트래커의 원형숫자 캐너리 표기와 혼용 금지 | `spec/5-system/14-external-interaction-api.md` §R17 | 카탈로그 갱신 시 아라비아 숫자만 사용 + "표면 여섯" 요약 수치 동반 갱신 |
| 4 | plan_coherence | owner=developer plan 안에 "spec §R17 갱신" 체크박스가 있어 spec-write 위임 관행과 어긋나 보임 — 자매 plan `eia-terminal-payload.md` 는 이미 이 규칙을 지켜 `--impl-prep` BLOCK→별도 planner 턴 패턴을 밟았음 | `plan/in-progress/eia-inputdata-marker-guard.md` 범위 체크리스트 | "planner 위임: spec §R17 갱신"으로 명시 — 위 §planner 인계 조치로 실질 해소됨 |
| 5 | plan_coherence | 자매 plan `eia-terminal-payload.md` 가 같은 target 문서(§6.4)를 동시에 다루지만 섹션 분리로 충돌 없음 | `spec/5-system/14-external-interaction-api.md` §R17 vs §6.4 | 조치 불요, 참고용 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | HIGH | `Execution.inputData` "마스킹 안 함" 결론이 3개 spec 문서(data-model §2.13, replay-rerun §10.2, execution §2.2)에 미러돼 있으나 `spec_impact` 는 R17 한 곳만 지목 |
| rationale_continuity | MEDIUM | `13-replay-rerun.md §10.2` 동일 이슈(WARNING, cross_spec CRITICAL 과 통합) + 에디터 히스토리 마커 감지 경계 미정 위험 |
| convention_compliance | NONE | 규약 위반 없음, INFO 2건만(국소 표기 일관성) |
| plan_coherence | LOW | `code:` frontmatter 미등재(WARNING) + spec-write 위임 관행 명시 누락(INFO) |
| naming_collision | HIGH | `MASKED_INPUT_DATA_REASON` 앵커 방향(폐기/반전) 미확정 — 반전 시 6개 파일에 정반대 의미 잔존 위험 |

## 권장 조치사항
1. (BLOCK 해소 — planner 턴) `spec/1-data-model.md` §2.13 과 `spec/5-system/13-replay-rerun.md` §10.2 를 §R17 갱신과 같은 세션/커밋에서 재작성하고 `spec_impact` 를 세 파일로 확장한다.
2. (BLOCK 해소 — developer 턴, 착수 전) `MASKED_INPUT_DATA_REASON` 앵커 처리 방향을 "폐기" 또는 "신규 식별자로 반전" 중 하나로 확정하고, 영향받는 6개 파일을 plan 체크리스트에 전수 나열한다.
3. (WARNING) `spec/3-workflow-editor/3-execution.md` §2.2 캐비엇과 target `code:` frontmatter 갱신을 위 planner 턴에 함께 처리한다.
4. (WARNING) 에디터 히스토리 마커 감지는 raw substring 이 아니라 파싱된 leaf 값 순회 + `isMaskedMarker` 재사용으로 구현하고, JSON 파싱 실패 시 fallback 정책을 명문화한다.
5. (INFO) 헤더 명명·Swagger 라벨·R17 카탈로그 숫자 표기는 여유 있을 때 정리한다.
