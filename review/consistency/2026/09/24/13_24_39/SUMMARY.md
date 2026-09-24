# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 전문 확보, 최고 등급은 WARNING)

## 전체 위험도
**MEDIUM** — Critical 은 없으나, target 이 "우발적 오염"으로 서술한 정정 대상이 실제로는 다른 in-progress plan(#12)이 의도적으로 등재하고 "완료"로 기록한 항목이라 그 완료 기록이 소리 없이 무효화될 위험, 그리고 같은 R-11 판정이 스코프 밖 4번째 문서(`node-cancellation.md`)에는 비대칭으로 적용되지 않는 문제가 겹쳐 있음.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | target 이 "우발적 오염"으로 진단한 `pending_plans: update-returning-tuple-shape.md` 항목은 실제로 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` #12(2026-08-14)가 5개 문서 전체에 명시적으로 등재하라 지시한 것이고, 그 plan 은 "✅ 완료 (2026-08-30) — 4곳 전부 반영"으로 기록돼 있다. target 을 그대로 집행하면 그 완료 기록의 3/4(`8-embedding-pipeline.md`·`10-graph-rag.md`·`4-execution-engine.md`)이 소리 없이 거짓이 된다. 추가로 `4-execution-engine.md` §1.1(line 64)은 본문에서 그 plan 을 "전수 목록의 정본"으로 계속 참조하며, `spec-pending-plan-existence.test.ts` 는 frontmatter 배열만 보고 본문 텍스트는 추적하지 않아 이 포인터의 실존 검증이 조용히 빠진다 | §C 적용 표 (3개 문서에서 `update-returning-tuple-shape.md` 제거) | `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` #12 "추가 위임" 완료 기록 | target §C/체크리스트에 `#12` 완료 기록을 함께 갱신하는 작업을 명시 추가 (예: "3/4 등재가 이후 R-5/R-11 정정으로 제거됨 — 사유 기록"). 같은 project-planner 소유라 한 턴에 처리 가능 |
| 2 | cross_spec (+ rationale_continuity, plan_coherence 중복 지적 통합) | target 자신이 §B 에서 "`update-returning-tuple-shape.md` 는 공유 트래커다(`spec_impact` 에 네 문서)"라 명시하고 R-11 전수 판정("미구현 surface 0")을 내렸음에도, 그 판정을 적용해 `pending_plans` 를 정리하는 것은 3개 문서뿐이고 4번째 대상인 `spec/conventions/node-cancellation.md` 는 스코프 밖에 방치된다. 병합 후 같은 트래커·같은 6개 잔여 항목에 대해 한쪽은 "소진됨", 다른 쪽(`node-cancellation.md`)은 "여전히 pending"으로 다르게 기술되는 비일관성이 spec 전역에 남는다 | §B 전문, §C 적용 표/체크리스트, spec_impact 목록 | `spec/conventions/node-cancellation.md` frontmatter (`status: partial`, `pending_plans:` 에 `update-returning-tuple-shape.md` 포함) | `node-cancellation.md` 의 `pending_plans:` 에서도 동일 트래커를 제거(같은 R-11 근거 재사용)하거나, 의도적으로 제외한다면 §D 에 "본문 §2.4 각주가 이 plan 을 여전히 움직이는 리스트의 정본으로 지목하므로 제외"와 같은 명시적 근거를 남긴다 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `10-graph-rag.md` Overview 배너가 `V037` 마이그레이션을 언급하지 않아 `code:` 리스트(target 이 복원)와 서술 사이에 잔여 편차가 남음 | `spec/5-system/10-graph-rag.md` Overview 배너 vs §KB-GR-EX-08/§KB-GR-DM-02 | target 이 이 문서를 어차피 편집하므로 배너에 `V037` 추가 권장 (선택 사항) |
| 2 | rationale_continuity | 동일 트래커·동일 위반 클래스(A-2 동형: `implemented`+`pending_plans` 공존)가 스코프 밖 `spec/conventions/raw-query-results.md` 에도 그대로 남아 있어, 다음 `--impl-prep spec/conventions` 라운드에서 새 Critical 로 재발견될 개연성이 높음 | `spec/conventions/raw-query-results.md` frontmatter | §D "하지 않는 것"에 이 파일을 후속 항목으로 명시 등재하거나 같은 커밋에서 함께 정리 |
| 3 | convention_compliance | `pending_plans:` 완성 시 처리 방식으로 규약(§5.3)은 "비움" 과 "제거" 둘 다 허용하는데 target 은 "제거"만 택함 — 규약 위반 아님 | §C 표 (`10-graph-rag.md`·`8-embedding-pipeline.md` 행) | 커밋 메시지나 draft 본문에 "두 옵션 중 제거를 택함" 한 줄 남기면 재확인 불요 |
| 4 | convention_compliance | R-11 원문은 "partial→implemented 승격 시점" 판정 규칙인데, 이미 `implemented` 인 두 문서에 확장 적용 — §3 표 위반만으로도 제거가 정당화되므로 R-11 판정은 최소 요건을 넘는 자발적 추가 실사이며 문제 없음 | §B 전체, §C 표 | draft 본문에 "§3 표 위반 vs R-11 승격-시점 판정" 구분을 한 문장으로 명시하면 향후 인용 시 명확 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | R-11 판정이 spec_impact 4문서 중 3개에만 적용, `node-cancellation.md` 비대칭 방치 (WARNING) + V037 배너 미동기화 (INFO) |
| rationale_continuity | LOW | 기존 Rationale/규약과 정면 배치 없음. 동일 위반 클래스가 스코프 밖 `raw-query-results.md`/`node-cancellation.md` 에 남는다는 후속 누락만 지적 (INFO) |
| convention_compliance | NONE | `spec-impl-evidence.md` §2/§3/R-11 과 정합, 실측 전부 대조 확인됨. 차단 요소 없음 (INFO 2건은 규약이 이미 허용한 선택지) |
| plan_coherence | MEDIUM | target 이 "우발적 오염"이라 서술한 항목이 실제로는 `#12` plan 이 의도적으로 등재하고 "완료"로 기록한 것 — 그 완료 기록 소급 무효화 위험 (WARNING) + node-cancellation.md 비대칭 (INFO) |
| naming_collision | NONE | 신규 식별자 도입 없음 — 검토 대상 자체가 사실상 N/A |

## 권장 조치사항
1. (BLOCK 해소 우선 항목 없음 — BLOCK:NO) target 커밋 전에 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` #12 의 "완료 (2026-08-30)" 기록을 갱신 — 3/4 등재가 이번 정정으로 제거됨을 명시하고 사유(R-5: `implemented` 는 `pending_plans` 불가 + R-11: 미구현 surface 0)를 남긴다.
2. `spec/conventions/node-cancellation.md` 의 `pending_plans` 에서도 동일 트래커를 함께 정리하거나, §D 에 제외 근거(§2.4 각주가 그 plan 을 여전히 움직이는 리스트의 정본으로 지목함)를 명시한다.
3. (선택) `spec/conventions/raw-query-results.md` 의 동형 위반(A-2: `implemented`+`pending_plans`)을 같은 세션에서 함께 정리하거나 §D 에 후속 항목으로 등재한다.
4. (선택) `10-graph-rag.md` Overview 배너에 `V037` 추가, `pending_plans` 제거 방식과 R-11 적용 범위 구분을 draft 본문에 한 문장씩 명시.
