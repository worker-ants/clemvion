# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 단, 5개 checker 중 4개가 **동일한 "해소된 drift 의 stale tracker 미동기화" 패턴**을 각기 다른 각도(cross-spec/plan-coherence/naming-collision)로 독립 수렴 발견해 재발 위험이 실질적임(이 저장소는 동일 클래스 문제로 이미 4~5회 연속 WARNING 을 낸 전력 보유).

## 전체 위험도
**MEDIUM** — 핵심 disposition 로직(항목 1~4, 코드 SoT 대조·앵커 카운트·frontmatter lifecycle)은 전수 검증에서 정확했으나, 이 draft 가 해소하는 3개 durable plan(`spec-drift-ai-agent-outport-countmax.md`, `ie-endmultiturn-errorpayload-contract.md`, `node-output-redesign/*`)의 역참조 동기화가 Edit 목록에서 체계적으로 누락됨.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, plan_coherence, naming_collision (WARNING) / rationale_continuity (INFO) | 항목 1(ND-AG-24 disposition)이 `spec-drift-ai-agent-outport-countmax.md` Critical 1 을 사실상 해소하지만 그 plan 의 체크박스(`[ ]` 미해결)와 `1-ai-agent.md` frontmatter `pending_plans` 항목이 갱신 목록에 없음 | 항목 1, Edit 1a/1b/1c (frontmatter 미포함) | `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` Critical 1 (체크박스), `spec/4-nodes/3-ai/1-ai-agent.md:22` frontmatter `pending_plans` | 같은 세션에서 Critical 1 을 `[x]` 로 체크(+해소 근거로 Edit 1a/1b/1c 인용), Critical 2 도 이미 완료이므로 plan 전체를 `plan/complete/` 이동 검토, `1-ai-agent.md` frontmatter `pending_plans` 에서 해당 항목 제거 |
| 2 | cross_spec, plan_coherence, naming_collision (WARNING) | 항목 4 앵커 rename(`#...-principle-11`→`#...규약`) 갱신 목록(Edit 4d~4m, 4개 spec 파일 10링크)이 실제 참조 전수(6개 파일 12링크)보다 2건 적음 — CI 로 검출 안 됨(spec-link-integrity 는 plan→spec 역방향 미검사) | Edit 4a(헤더 rename) + Edit 4d~4m(갱신 목록) | `plan/in-progress/node-output-redesign/ai-agent.md:198`, `plan/in-progress/node-output-redesign/information-extractor.md:190` (동일 앵커 참조, 목록 누락) | 두 plan 파일의 앵커 링크도 목록에 추가하거나, 최소한 Rationale 의 검증 커맨드(`grep -c '...principle-11'` == 0)에 `spec/` 스코프 명시 + "plan 교차링크 2건은 별도 정리" 각주 |
| 3 | plan_coherence (WARNING) | `ie-endmultiturn-errorpayload-contract.md` 가 "project-planner 후속(선재 WARNING) 4건 미처분"을 in-progress 유지 사유로 명시했고 그 4건이 본 draft 의 항목 1~4 와 1:1 대응 — 전량 처분되는데도 그 plan 문서 자체는 갱신 대상에서 누락 | draft 전체 (해당 plan 으로의 역참조 없음) | `plan/in-progress/ie-endmultiturn-errorpayload-contract.md` "완료 상태"/"project-planner 후속" 절 | draft 적용 후 그 절에 "project-planner 후속 4건은 본 draft(2026-07-18)로 처분 완료" 각주 추가 + 잔여 재작업 없음 확인 시 `plan/complete/` 재평가 |
| 4 | rationale_continuity (WARNING) | 항목 3 이 "cross-node 대칭"을 근거로 IE 를 `status: partial`+caveat 로 낮추지만, 두 근거 plan(`node-output-redesign/{ai-agent,information-extractor}.md`) 모두 동일 gap(structured `resumed` 미emit)이 **ai-agent §7.5 에도 동일**하고 "동시 처리 권고"까지 명시함에도 `1-ai-agent.md` §7.5 는 이번 범위에서 무편집 — 대칭 논거를 caveat 수준까지 이행하지 않음 | 항목 3, Edit 3a/3b (`3-information-extractor.md` §5.5 caveat만 삽입) | `plan/in-progress/node-output-redesign/ai-agent.md:217`, `.../information-extractor.md:177` ("ai-agent 와 동시 처리 권고") | `1-ai-agent.md` §7.5 뒤에도 동형 "(Planned)" caveat 추가해 완전 대칭을 이루거나, IE 만 우선 처리할 의도라면 항목 3/§12.17 Rationale 에 "ai-agent §7.5 caveat 는 별도 후속으로 분리" scope 제한 근거 명시 |
| 5 | rationale_continuity (WARNING) / cross_spec, convention_compliance (INFO) | 항목 4 Edit 4b 가 `0-common.md` §5 도입부에서 interaction wrapper 를 **Principle 4.4** 로 귀속하지만, 같은 절 표(L89, 무편집 유지)는 동일 개념을 **Principle 4.5** 로 귀속 — Principle 오귀속 "정정"이 목적인 항목이 §5 내부에 새로운 4.4/4.5 불일치를 남김. 부수: "result 네이밍"을 §1.1 에 귀속한 것도 §8.2(1차 네이밍 SoT)와의 경계가 흐릿함 | Edit 4b (`0-common.md:83`) | `0-common.md:89`(표, target 이 스스로 "이미 올바른 귀속"이라 무변경 판정한 라인), `spec/conventions/node-output.md` Principle 4.4 vs 4.5, 1.1 vs 8.2 정의 | Edit 4b 문구를 "Principle 1.1(config/output 직교)·3.2(error)·4.4~4.5(interaction 존재+payload shape)·8.2(result/category 1차 네이밍)" 로 세분·병기해 L83 과 L89(표)가 같은 근거를 가리키게 정합 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | draft 자체(`spec-draft-*.md`)는 `## Overview` 3섹션 구조 규약 대상이 아니며 `## Rationale` 종결 의무는 충족 — 위반 아님(정합 확인) | draft 전체 구조 | 조치 불필요 |
| 2 | cross_spec, convention_compliance, plan_coherence, naming_collision (교차 확인) | 코드 SoT(`resolve-dynamic-ports.ts`, `ai-turn-executor.ts`, `AiAgentEndReason` union), 앵커 grep 카운트(spec 내 4파일 10링크), frontmatter lifecycle(`spec-impl-evidence.md §3`), 인용 원문 라인 전부가 target 서술과 100% 일치 확인 | draft 전체 | 조치 불필요 — 핵심 disposition 근거는 견고 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | 앵커 rename 누락 2건(plan 교차링크), durable plan(`spec-drift-ai-agent-outport-countmax.md`) 미동기화, Principle 4.4/4.5 인용 정밀도(INFO) |
| rationale_continuity | MEDIUM | 항목 3 cross-node 대칭 불완전 이행(IE 만 caveat, ai-agent 미적용), Edit 4b Principle 4.4/4.5 자기모순 신규 생성, durable tracker 미동기화(INFO) |
| convention_compliance | LOW | 규약 위반 없음(전수 검증 통과) — Principle 1.1/8.2 귀속 정밀도만 INFO |
| plan_coherence | MEDIUM | durable plan 3건(`spec-drift-ai-agent-outport-countmax`, `ie-endmultiturn-errorpayload-contract`, `node-output-redesign/*`) 역참조 동기화 누락 |
| naming_collision | MEDIUM | 신규 식별자 발급 없음(N/A) — 단 항목 1 disposition 이 기존 durable tracker 미종결, 앵커 rename 목록 2건 부족 |

## 권장 조치사항
1. (최우선) 항목 1 적용과 같은 커밋에서 `spec-drift-ai-agent-outport-countmax.md` Critical 1 을 `[x]` 로 체크하고(Critical 2 는 이미 완료), 두 Critical 모두 닫히면 plan 을 `plan/complete/` 로 이동 + `1-ai-agent.md` frontmatter `pending_plans` 에서 해당 항목 제거.
2. 항목 4 앵커 rename Edit 목록에 `plan/in-progress/node-output-redesign/{ai-agent.md:198, information-extractor.md:190}` 의 동일 앵커 참조를 추가(또는 검증 grep 스코프를 `spec/` 로 명시 + 잔여 2건은 별도 후속으로 각주).
3. `ie-endmultiturn-errorpayload-contract.md` "완료 상태" 절에 "project-planner 후속 4건은 본 draft 로 처분 완료" 각주 추가 및 `plan/complete/` 재평가.
4. 항목 3 의 cross-node 대칭 논거를 완결하려면 `1-ai-agent.md` §7.5 에도 동형 "(Planned)" caveat 를 병행 추가하거나, 범위를 IE 로 한정하는 명시적 근거를 §12.17 Rationale 에 남길 것.
5. Edit 4b 의 Principle 인용을 "1.1/3.2/4.4~4.5/8.2" 로 세분해 `0-common.md` §5 도입부(L83)와 표(L89)의 귀속을 정합시킬 것.

BLOCK 사유 없음(Critical 0건) — 위 5건은 모두 target 의 Edit 목록에 추가 반영 가능한 WARNING 수준이며, 병행 반영을 권고.
