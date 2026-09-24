# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 성공, Critical/Warning 0건. INFO만 존재.

## 전체 위험도
**LOW** — Rationale Continuity checker가 LOW로 보고(다음 편집자를 위한 Rationale 명문화 여지), 나머지 4개는 NONE. 종합적으로 이 PR을 막을 사유 없음.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec / Convention Compliance (중복 지적, 통합) | `PROJECT.md` 자동 가드 표 `spec-pending-plan-existence.test.ts` 행이 이번 강화("plan 인가" shape 검사 추가)를 반영 못하고, `plan/complete/` 허용도 기존부터 누락돼 있어 요약이 실제 계약보다 좁음 | `PROJECT.md` "자동 가드" 표 (diff 밖) — SoT는 `spec/conventions/spec-impl-evidence.md` §2.1/§4 | "`plan/in-progress/` 또는 `plan/complete/`의 **plan(.md)** 경로 실존 검증"으로 문구 갱신 (이번 PR 범위 아님, 후속 도큐 싱크) |
| 2 | Convention Compliance | `spec/conventions/spec-impl-evidence.md` §4 표의 동일 가드 행도 "실존" 한 단어로만 요약돼 있어 새로 추가된 "형태(shape) 검증" 단계가 드러나지 않음 | `spec-impl-evidence.md` §4 표 (diff 밖, spec 델타 0이라 이번 PR 의무 아님) | 필요 시 별도 planner 턴에서 "(및 그 path가 `.md` plan 위치인지 형태 검증)" 문구 추가 |
| 3 | Cross-Spec | `spec-status-lifecycle.test.ts` guard (c)는 새 `isPendingPlanPath`를 재사용하지 않고 여전히 `fs.existsSync`만으로 "complete로 이동했는가"를 판정 — 같은 `pending_plans` 필드를 보는 두 가드의 "plan 형태" 엄격도가 §4 표 안에서 갈림(오늘은 guard 4가 먼저 걸러줘 실제 파손 없음) | `spec-status-lifecycle.test.ts` guard (c) vs 이번 diff의 guard 4 | 급하지 않음. 두 가드가 독립 실행되는 경로가 생기면 guard (c)도 `isPendingPlanPath` 재사용 권장 |
| 4 | Rationale Continuity | `plan/research/`를 `isPendingPlanPath`가 명시적으로 거짓 처리하는 근거가 `spec-impl-evidence.md` 본문/Rationale에 명문화돼 있지 않음(§2.1 열거로부터의 암묵 해석에 의존) — 단, `--impl-prep` 단계(§E INFO 1)에서 이미 지적·자체 처분됨 | `isPendingPlanPath()` 주석 + `pending-plan-is-plan.md` §E INFO 1 | 선택적 후속: §2.1 행 또는 R-5 각주에 "`plan/research/`는 완료 종착점이 없어 제외" 한 줄 명시 |
| 5 | Plan Coherence | 트래커(`spec-draft-nullable-notation-followups.md`) 항목 체크 및 `pending-plan-is-plan.md`의 `complete/` 이동이 아직 미수행 — target plan 스스로 "`/ai-review` 수렴 후" 처리하도록 명시한 정상 잔여 작업 | `plan/in-progress/pending-plan-is-plan.md` 체크리스트 마지막 두 항목 | 조치 불요. `/ai-review` 수렴 후 트래커 체크 + plan 이동 확인만 |
| 6 | Naming Collision | 신규 상수 `PENDING_PLAN_DIRS`(`string[]`)가 같은 코드베이스의 동류 상수(`spec-links.ts`의 `GOVERNANCE_SKIP_DIRS`/`CODEBASE_SKIP_DIRS`, `Set<string>`)와 값 타입이 다름 — 이름 충돌 아닌 사소한 불일치 | `spec-frontmatter-parse.ts` 신설 `PENDING_PLAN_DIRS` | 등급 매길 수준 아님, 조치 불요 |
| 7 | Naming Collision | 신규 `isPendingPlanPath`가 기존 `plan-scan.ts`의 `isLifecyclePlan`과 "이것이 plan인가"를 묻는 목적이 인접(이름·검증 대상은 다름, 실충돌 아님) — 향후 세 번째 유사 술어 추가 시 혼동 위험만 잠재 | `spec-frontmatter-parse.ts` `isPendingPlanPath` vs `plan-scan.ts` `isLifecyclePlan` | 현재 조치 불요, 향후 유사 명명 추가 시 주의 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | spec `pending_plans:` 27개 엔트리 전수 대조 위반 0건. `spec-impl-evidence.md` §2.1/§4가 이미 선언한 계약을 구현이 뒤늦게 강제. PROJECT.md 요약 얕음 + guard (c) 엄격도 불일치는 INFO 2건 |
| Rationale Continuity | LOW | 계약 번복 아닌 강제 강화(bug fix)로 정합. `plan/research/` 배제 근거 Rationale 명문화 누락 1건(이미 자체 처분) |
| Convention Compliance | NONE | 명명·문서구조·spec_impact(Gate C)·CHANGELOG 관례 전부 준수. PROJECT.md/§4 표 요약 얕음 2건 INFO(선재 간극, 이 PR 책임 아님) |
| Plan Coherence | NONE | 트래커 처방(§2.1/§4 근거 shape 검사)을 정확히 좁혀 구현, 별건 미해결 결정("완료 plan 포인터 허용")은 §F에서 명시적으로 스코프 밖 분리(우회 아님) |
| Naming Collision | NONE | 신규 식별자 `isPendingPlanPath`/`PENDING_PLAN_DIRS` grep 0건, 기존 사용처와 충돌 없음. 유사 명명 인접 사례 1건 INFO |

## 권장 조치사항
1. (BLOCK 해소 불필요 — Critical/Warning 없음) 이 PR은 그대로 진행 가능.
2. 선택적 후속(이번 PR 필수 아님): `PROJECT.md` 자동 가드 표와 `spec-impl-evidence.md` §4 표의 `spec-pending-plan-existence.test.ts` 행 문구를 "plan(.md) 형태 검증 + `plan/in-progress/`·`plan/complete/` 실존"으로 갱신해 실제 계약과 요약 문구 간극을 닫는다(별도 planner 턴 권장, spec 델타이므로).
3. 선택적 후속: `spec-impl-evidence.md` §2.1 행 또는 R-5 각주에 `plan/research/` 제외 근거를 명문화.
4. `/ai-review` 수렴 후 `plan/in-progress/pending-plan-is-plan.md`의 트래커 항목 체크 + `complete/` 이동을 잊지 않는다.
