# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 중 Critical 위배는 없음. 단, `rationale_continuity` 는 status=`success` 로 보고됐으나 `output_file` 이 실제로 생성되지 않아(기존 known FS-write flakiness) **내용 미확보** — 재시도 후 최종 확정 필요.

## 전체 위험도
**MEDIUM** — Critical 없음. WARNING 6건(수치 화석 잔존 2곳 미정정, plan 처분(2)(3) 이행 축소/재배치, plan durable 기록 미갱신, Overview/Rationale 배치 규약 위반, 출처 표기 비일관)이 반영 전 저비용으로 해소 가능. `rationale_continuity` 미확보로 완전성은 아직 미검증.

## Critical 위배 (BLOCK 사유)

없음 — 5개 checker(확보된 4개 + naming_collision) 모두 Critical 0건 보고.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance | D1 이 "~180" 화석 정정 시 2곳을 누락 — draft 적용 직후 spec 안에 485 와 ~180 두 값 공존 | D1 (`spec/4-nodes/4-integration/4-cafe24.md` L29·L446, 2곳만 정정) | `spec/2-navigation/4-integration.md:1110` ("Resource × Operation = ~180"), `spec/4-nodes/3-ai/0-common.md:63` (`enabledTools` 필드 설명, "~180") | D-list 에 D5 추가해 위 2곳도 485(또는 "카테고리당 평균 ~27")로 정정하거나, "비포함" 절에 의도적 누락임을 명시 |
| 2 | plan_coherence | D4 가 plan 처분(3) "제약 각주" 요구를 "규모 병기"로 축소 이행 — §6.1 만 읽으면 여전히 대형 카탈로그 allowlist 필수를 알 수 없음(MakeShop 행도 동일) | D4 (`spec/0-overview.md` §6.1) | `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` Critical 2 처분(3) | D4 에 §4.2 경고(D2)로의 각주/링크 추가, 또는 plan 처분(3) 문구를 "규모 병기로 충분(각주 불요)"로 재확정해 plan 에 결정 근거 기록 |
| 3 | plan_coherence | D2 위치가 plan 처분(2) 지정 §1/§2 가 아닌 §4.2(내부 메커니즘 절)로 재배치 — 설정 시점(§1/§2) 에 경고 discoverability 없음 | D2 (`spec/4-nodes/3-ai/1-ai-agent.md` §4.2 신설 note) | `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` Critical 2 처분(2) ("§1/§2 에 명문화") | §1 `mcpServers` 행 또는 §2 설정 UI 절에 §4.2 로의 교차링크 1줄 추가, 또는 재배치 사유를 draft 근거란에 명시 |
| 4 | cross_spec, plan_coherence | plan 파일이 draft 의 처분 결과·핵심 재발견(383 은 계정별 granted-scope 값, 카탈로그 총량은 485)·2026-07-17 사용자 결정을 기록하지 않음 — durable 추적 앵커라는 plan 자신의 존재 목적이 무력화될 위험. 번호 라벨도 draft(처분(2)(3)(4))와 plan 원문(Critical 2 내부 (1)(2)(3)만 존재, Critical 1 은 무번호) 이 어긋나 완료 판정 시 혼선 | `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` Critical 2 처분(1)(2)(3) 체크박스 및 draft 상단 "처분(2)(3)(4)" 참조 | draft D1~D4 전체 | 같은 PR 에서 plan 처분(1)(2)(3) 체크박스 `[x]` 갱신 + "383 은 계정별 실측치, 카탈로그 총량 485(2026-07-17 재측정)" 정정 note + 사용자 결정 기록. draft 내부 번호도 plan 실제 라벨 기준으로 재서술. Critical 1(out-port SoT) 은 open 유지이므로 plan 자체는 in-progress 유지 |
| 5 | convention_compliance | 실측 근거(3중 교차검증 방법론·날짜)가 Overview(D1 변경 1-1)에, 결과값 치환이 Rationale(변경 1-2)에 위치 — 근거/결과 배치가 뒤바뀜 | D1 변경 1-1 (`4-cafe24.md` §Overview L29) | CLAUDE.md "정보 저장 위치" 표(근거→`## Rationale`), `project-planner` SKILL 문서구조, 기존 관례(`3-workflow-editor/2-edge.md` R-1~R-3, `7-channel-web-chat/1-widget-app.md` R8) | Overview 불릿은 결론값(485)만 남기고, 방법론·날짜는 §9 Rationale 신설 서브섹션으로 이동해 변경 1-2 와 합칠 것 |
| 6 | convention_compliance | D1 에만 날짜·출처("2026-07-17 실측") 표기, D2~D4 는 동일 수치(485/161)를 무각주 리터럴 재인용 — 이번 drift(~180 화석)를 만든 것과 같은 패턴이 새 위치 3곳에 재생성될 위험 | D2(`1-ai-agent.md §4.2`), D3(`11-mcp-client.md §5.8`), D4(`0-overview.md §6.1`) | D1 의 날짜·출처 표기 관례와 내적 불일치 | D2~D4 에 "(2026-07-17 실측, [Cafe24 카탈로그 §5](../../conventions/cafe24-api-catalog/_overview.md#5-coverage-matrix) 기준)" 류 SoT 링크 병기, 또는 리터럴 대신 D1/§지원 범위 링크 참조로 낮출 것 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `cafe24-api-catalog/_overview.md` §5 Coverage Matrix 는 이미 485 합계 보유 — 충돌 아님, "~500"(L122) 은 별개(거친 근사) 지표 | `spec/conventions/cafe24-api-catalog/_overview.md` §5 | D1 근거란에 이 Coverage Matrix 를 4번째 교차검증 소스로 인용하면 근거 보강 |
| 2 | cross_spec | D3 의 "현행" 인용문이 실제 원문의 paraphrase(2문장 구조 요약) — 문자열 완전 치환 시 실패 가능 | D3 (`spec/5-system/11-mcp-client.md` §5.8) | 원문 2문장 구조 유지하며 수치만 삽입하는 의미 편집으로 반영 |
| 3 | convention_compliance | D2 의 §5.6 cross-link 이 heading anchor 누락 — 동일 대상을 가리키는 기존 cross-link 는 모두 anchor 포함 | D2 (`1-ai-agent.md §4.2` 신설 note) | `#56-도구-allowlist` 앵커 추가해 `[11-mcp-client §5.6](../../5-system/11-mcp-client.md#56-도구-allowlist)` 로 통일 |
| 4 | convention_compliance | draft 파일이 현재 scratchpad 경로에 있어 `plan/in-progress/` 정식 반영 여부 미확인 | 대상 문서 경로 자체 | 최종 반영 시 `plan/in-progress/spec-draft-cafe24-countmax.md` 실존만 확인 (순수 오케스트레이션 스테이징이면 문제 없음) |
| 5 | plan_coherence | draft 의 "처분(2)(3)(4)" 넘버링은 plan 원문과 문자 그대로는 다르나, Critical 1 무번호 처분을 (1)로 이어 붙이는 재넘버링으로 해석하면 정합적으로 매핑됨 | draft "검토 요청 관점 4" | plan 체크박스 갱신 시(WARNING #4) 이 매핑을 명시해 향후 혼동 방지 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 핵심 수치(485/161/128)는 독립 재검증으로 정확. "~180" 화석 2곳 미정정 + plan 처분 번호 라벨 불일치 |
| rationale_continuity | **재시도 필요** | status=`success` 로 보고됐으나 `output_file`(`rationale_continuity.md`) 이 디스크에 생성되지 않음(known FS-write flakiness, `_retry_state.json` 상 `agents_success` 도 공란) — 내용 미확보. Critical 유무 미검증 |
| convention_compliance | MEDIUM | 근거(Overview)/결과(Rationale) 배치가 CLAUDE.md 원칙과 뒤바뀜, D2~D4 출처 표기 비일관, "~180" 잔여 1곳 지적, anchor 누락 |
| plan_coherence | MEDIUM | plan 처분(2)(3) 의 이행이 축소/재배치돼 원래 문제의식이 실질적으로 미해소, plan 파일 자체가 draft 의 재발견·결정을 기록하지 않아 durable 추적 목적 무력화 위험 |
| naming_collision | NONE | 신규 식별자 0건 확인, 기존 식별자(`AI_AGENT_TOOL_COUNT_MAX` 등) 값·의미 전부 SoT 와 일치 |

## 권장 조치사항

1. `rationale_continuity` checker 재실행 — output_file 미생성(FS-write flakiness) 으로 내용이 아직 확보되지 않았으므로, 최종 BLOCK 판정 전 반드시 재확보해 Critical 유무 확정.
2. D1 정정 범위에 `spec/2-navigation/4-integration.md:1110`·`spec/4-nodes/3-ai/0-common.md:63` 의 잔여 "~180" 2곳을 D5 로 추가 정정(또는 의도적 비포함 명시) — 485 와 ~180 공존 방지.
3. `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` Critical 2 처분(1)(2)(3) 체크박스를 이번 draft 반영과 같은 PR 에서 `[x]` 갱신하고, "383(계정별 granted-scope) vs 485(카탈로그 총량)" 정정 note 와 2026-07-17 사용자 결정("경고 명문화만, 기본값 무변경")을 plan 본문에 기록.
4. D4(`0-overview.md §6.1`)에 §4.2 경고로의 각주/링크를 추가해 plan 처분(3) "제약 각주" 취지를 회복하거나, plan 문구 자체를 "규모 병기로 충분"으로 재확정해 결정 근거를 남길 것.
5. D2 배치를 §1(`mcpServers` 행)/§2(설정 UI) 에도 교차링크로 보강해 plan 처분(2) 이 의도한 설정 시점 discoverability 확보.
6. D1 변경 1-1 의 3중 교차검증 방법론·날짜를 §9 Rationale 로 이동(Overview 는 결론값만 유지)하고, D2~D4 의 485/161 인용에 날짜·SoT 링크를 병기해 출처 추적성 확보.
7. (저비용 INFO) D2 §5.6 cross-link 에 heading anchor 추가, draft 최종 반영 시 `plan/in-progress/` 실존 확인.