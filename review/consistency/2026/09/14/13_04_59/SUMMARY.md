# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 0건. 전문 미확보 checker 없음(5/5 인라인 전문 확보).

## 전체 위험도
**LOW** — spec/conventions/ 델타 0(순수 test/harness 하드닝)이며, 유일한 실질 발견은 이 PR 이전부터 있던 spec 자기모순(`secret-store.md §R4` 메서드명 오기) carry-forward 1건뿐이고 이미 planner 소유 트래커에 등재돼 있다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 이번 라운드에 CRITICAL 이 없어 인계 대상 자체가 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec + convention_compliance (중복 통합, 강한 등급 채택) | `TriggersService.delete()` 라는 존재하지 않는 메서드명이 spec 에 남아 자기 문서 내에서도 서술이 갈림 (PR 이전부터 존재하는 carry-forward, 이번 PR 이 만든 결함 아님) | `spec/conventions/secret-store.md` §R4(~428행), `spec/1-data-model.md:791` | 같은 문서 §6(~390행)·`triggers.service.ts:842` 는 이미 `remove()`(+`deleteByPrefix`) 로 정확히 서술 — 실제 메서드명과 §R4 문구가 불일치 | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 소유 항목으로 등재됨. developer 는 `spec/` read-only 라 이번 세션에서 직접 수정 불가 — planner 턴에서 §R4 + `1-data-model.md:791` 두 곳을 `remove()`로 동시 정정. `migrations/V063__secret_store.sql:20` 의 동일 오기는 Flyway 체크섬 문제로 의도적 무조치 결정이 이미 트래커에 근거와 함께 기록됨 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `2-trigger-list.md` frontmatter `code:` 가 신규 `schedule-trigger.e2e-spec.ts` 양성 커버리지(`TriggerDto.workflow` §5.4 키 생략형)를 아직 반영 안 함 | `spec/2-navigation/2-trigger-list.md` frontmatter | 이미 `spec-draft-nullable-notation-followups.md` 백로그 등재됨 — `code:` 목록에 해당 파일 추가 |
| 2 | cross_spec | 신규 repo-guard(`trigger-secret-columns-{guard,spec}.ts`) 가 어느 spec `code:` 에도 미등재, repo-guard 등재 자체가 관례로 미확립(14개 중 5개만 등재) | `spec/conventions/secret-store.md` | planner 턴에서 (a) `code:` 등재 여부 (b) repo-guard 등재 규약 신설 여부 함께 결정 |
| 3 | convention_compliance | `secret-store.md` 가 스스로 예고한 "정본-사본 드리프트" 위험을 신규 가드가 정확히 시행함 — 각주로 가드 경로를 남기면 좋음(선택, 필수 아님) | `spec/conventions/secret-store.md` 70~77행 | 필수 아님. 각주에 `trigger-secret-columns-guard.ts` 경로 추가 권장 |
| 4 | plan_coherence | harness corpus 굶주림(`--impl-prep`/`--spec` 번들이 `spec/` 코퍼스를 통째로 절단)의 두 번째 확증 사례가 지정 소유 트래커(`harness-review-gate-followups.md`)에는 아직 역방향 교차참조가 없음(단방향 인용) | `plan/in-progress/harness-review-gate-followups.md` | 그 문서 "미해결" 절 말미에 `spec-draft-nullable-notation-followups.md` 신규 항목(2026-09-14)으로의 포인터 한 줄 추가 |
| 5 | plan_coherence | repo-guard 개수 서술이 인접 두 plan 간 불일치(2026-09-04 실측 7·8 vs 2026-09-14 전수 실측 14·5·9) — 둘 다 시점 기준 정확하지만 "한 턴에 함께 볼 것" 으로 스스로 지목된 자리라 갱신 누락 시 혼동 소지 | `plan/in-progress/spec-conventions-engine-error-code-surface.md` | (b) 결정 턴에 구값(7/8)을 신값(14/5/9)으로 교체하도록 포인터 남길 것 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | spec/conventions 델타 0, 실제 코드는 test/harness 전용. `TriggersService.delete()` carry-forward 오기 1건 + `code:` 트레이서빌리티 갭 2건, 전부 기존 백로그 등재됨 |
| rationale_continuity | NONE | 라운드 4(`026fbb610`)까지 포함해 재대조. Rationale 위반·무근거 번복·기각 대안 재도입 없음. teardown 근거 보강은 "결정에 근거 추가" 모범 사례 |
| convention_compliance | LOW | 리뷰 인용·Swagger·§5.4·명명 규약 전부 준수. `secret-store.md §R4` 메서드명 자기모순 1건(PR 이전부터 존재, 이번 PR 의 주석은 오히려 정확한 이름 인용) |
| plan_coherence | LOW | 신설 plan 의 실측 주장 전수 대조 완료·일치. 두 신규 실측(harness corpus 굶주림 2건째, repo-guard 14개 카운트)이 각 소유 트래커에 아직 역방향 반영 안 됨(INFO, 이미 "다음 턴에 함께 볼 것" 으로 예고됨) |
| naming_collision | NONE | spec 신규 식별자 없음(scope 델타 0). 코드 신규 export 6개 전수 grep 결과 충돌 없음. 파일 경로도 기존 `-guard.ts`/`.spec.ts` 쌍 컨벤션 준수 |

## 권장 조치사항
1. (이 PR 을 막는 항목 없음 — BLOCK: NO) planner 턴에서 `spec/conventions/secret-store.md` §R4 및 `spec/1-data-model.md:791` 의 `TriggersService.delete()` → `remove()`(+`deleteByPrefix`) 정정 (기존 백로그 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 실행).
2. 같은 planner 턴에 `2-trigger-list.md` `code:` 목록에 `schedule-trigger.e2e-spec.ts` 추가 + repo-guard `code:` 등재/규약화 여부(14/5/9 전수 실측 기준) 함께 결정.
3. harness 세션 재개 시 `harness-review-gate-followups.md` 에 corpus 굶주림 2번째 사례 포인터 추가, `spec-conventions-engine-error-code-surface.md` 의 7/8 수치를 14/5/9 로 교체.