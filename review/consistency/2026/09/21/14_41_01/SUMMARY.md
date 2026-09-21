# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전문 모두 확보. Critical 발견 없음.

## 전체 위험도
**LOW** — `AuthConfigsService.remove()` 동시 삭제 이중 감사 결함을 형제 4건(#1370~#1373)과 동일 처방으로 고치는 코드 전용 작업(`spec_impact: none`)이며, 교차 spec·규약·명명 어디에도 모순은 없다. 다만 이 PR 완료로 기존 후속 트래커 두 곳이 조용히 stale 해지는 경로와, 신규 헬퍼명의 근접 명명 리스크가 WARNING 으로 남는다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| (없음) | — | — | — | — | — |

## planner 인계 (권한 밖 Critical)

(없음) — Critical 발견이 없어 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision | 신규 헬퍼 `throwAuthConfigNotFound(): never`(404 `RESOURCE_NOT_FOUND`)가 기존 `AUTH_CONFIG_NOT_FOUND`(400, `triggers.service.ts:965-978`)와 도메인·이름이 근접 — spec 이 "이 저장소의 유일한 `_NOT_FOUND`≠404 예외" 로 명시 경고한 자리와 부딪힘 | `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` 신설 예정 헬퍼 | `spec/5-system/3-error-handling.md:249-256` §1.11, `triggers.service.ts:965-978` | 런타임 충돌은 없음(타입·값 다름). 이름은 형제 패턴 유지하되 "이 404 는 §1.11 의 400 `AUTH_CONFIG_NOT_FOUND` 와 다른 자리" disambiguation 주석 추가 |
| 2 | plan_coherence | `plan/in-progress/spec-sync-auth-gaps.md:215` 의 2026-08-01 발 "동시 삭제 중복 감사 (auth-configs 패턴)" 항목이 이 PR 이 고치는 것과 같은 버그를 가리키는데도 교차참조·해소 없이 방치 | `spec/2-navigation/6-config.md` §A (`AuthConfigsService.remove()` 계약) | `plan/in-progress/spec-sync-auth-gaps.md:215` | `authconfig-dup-delete.md` 완료(트래커 항목 해소) 단계에서 `spec-sync-auth-gaps.md:215` 도 함께 취소선/체크 처리 — "이미 고쳐진 버그"를 다음 사람이 다시 미해결로 집는 낭비 방지 |
| 3 | plan_coherence | `spec-draft-nullable-notation-followups.md:4961-4968` 의 "동시성 e2e `code:` 미등재" INFO-4 가 6축을 **고정 열거**하는데, 이 PR 이 `auth-configs` 축(7번째)을 추가하면 이미 한 번 재발한 것과 같은 형태로 다시 불완전해짐 | `spec/2-navigation/6-config.md` `code:` frontmatter (신규 concurrency e2e 등재처) | `plan/in-progress/spec-draft-nullable-notation-followups.md:4961-4968` | 이번 plan 의 "트래커 항목 해소" 단계에서 INFO-4 도 재열거형으로 일반화하거나 최소 `6-config.md` 를 목록에 선반영 |
| 4 | rationale_continuity | `spec/5-system/2-api-convention.md §3` "DELETE=멱등 O" 표와 `auth-configs` DELETE(패자 → 404) 의 기존 SPEC-DRIFT 가 7번째 인스턴스로 확장 | `spec/5-system/2-api-convention.md §3` HTTP 메서드 표 | `spec/2-navigation/6-config.md` §3 `DELETE /api/auth-configs/:id` | 이미 5라운드 연속 처분 확정(BLOCK:NO, planner 소유, 각주 집행 시 일괄 커버) — 이번 PR 조치 불요, 새 등재도 불필요 |
| 5 | convention_compliance | `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans:` 에 이미 surface 가 0 이 된 `plan/complete/workflow-duplicate-nodes-edges.md` 가 남아 있음(전량-complete 가드가 못 잡는 항목별 stale) | `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans:` | `plan/complete/workflow-duplicate-nodes-edges.md`, `spec/conventions/spec-impl-evidence.md` §3.1 R-11 | 이번 PR 과 무관한 선재 drift. 다음에 `1-workflow-list.md` 를 만질 때 해당 항목 제거(승격 근거를 커밋에 기록) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, rationale_continuity, convention_compliance | "동시 삭제 → 두 번째 404" 서술이 형제 자원 중 트리거 spec 에만 있고 `6-config.md` 등 나머지엔 없음 — 모순 아닌 문서 밀도 비대칭. 단 오늘 커밋 `c1bf3f1c0` 이 이 갭을 `spec-draft-nullable-notation-followups.md` 에 이미 정확한 스냅샷(재열거형)으로 등재해 둠(rationale_continuity 확인) | `spec/2-navigation/6-config.md` §3, cf. `spec/2-navigation/2-trigger-list.md:318`/§4.4 | 이번 PR 조치 불요(코드 전용, `spec_impact: none` 타당). 후속으로 "동시 DELETE 는 진 쪽이 404" 규칙을 `5-system/2-api-convention.md` 또는 convention 문서에 한 번 정착시키면 각 화면 spec 재작성 반복을 줄일 수 있음(이미 followups plan 항목으로 커버됨) |
| 2 | rationale_continuity | advisory lock(기각된 대안, `4-integration.md` §9)의 재도입이 아님을 plan 자체가 사전 검증 — 기각 사유(Cafe24 HTTP 호출 중 lock 보유)와 이번 삭제 경로(외부 호출 없음)는 별개 범위 | `plan/in-progress/authconfig-dup-delete.md` §B | 조치 불요 |
| 3 | naming_collision | `throwAuthConfigNotFound()` 는 형제 패턴(`throwTriggerNotFound`/`throwScheduleNotFound`/`throwIntegrationNotFound`) 과 동일 형태·동일 `RESOURCE_NOT_FOUND` 코드로 정합. e2e 파일명 `auth-config-delete-concurrency.e2e-spec.ts` 도 형제 명명과 일치, grep 0건(충돌 없음) | `codebase/backend/src/modules/auth-configs/`, `codebase/backend/test/` | 조치 불요 |
| 4 | plan_coherence | 컨텍스트 예산 초과로 주 번들에서 `6-config.md` 본문이 절단되어 자동 조립이 그 계약을 못 봄 — 수동 확인 결과 충돌 없음 확인됨 | 이번 `--impl-prep` 번들, `spec/2-navigation/6-config.md` | plan 체크리스트 1번의 "손으로 읽는다" 대상에 `6-config.md` 자체도 추가해 다음 실행에서 같은 절단을 다시 놓치지 않게 할 것 |
| 5 | convention_compliance | `spec/2-navigation` 대상 문서(에러코드·DTO 명명·마스킹·감사 액션·frontmatter `code:` 글롭)는 검토 범위 안에서 규약 위반 없음 확인 — 단 15개 파일과 `spec/conventions/**` 대다수는 예산 초과로 전수 대조 못함(캐비어트) | `spec/2-navigation/**` | 조치 불요, 판정 시 캐비어트 감안 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | FK cascade·감사 액션명·에러코드·RBAC 매트릭스 전부 무모순. 유일한 관찰은 문서 밀도 비대칭(INFO, 비차단) |
| rationale_continuity | LOW | 원자적 DELETE+`affected===0` 처방이 advisory lock 기각 사유 범위 밖에서 안전하게 재사용됨(6차 선례 계승). DELETE 멱등 표 충돌은 기존 추적 중인 WARNING 재확인(신규 아님) |
| convention_compliance | LOW | 감사 액션(`auth_config.delete`)·에러코드(`RESOURCE_NOT_FOUND`) 재사용은 규약 준수. `1-workflow-list.md` pending_plans stale 발견(이 PR 무관 선재 drift) |
| plan_coherence | LOW | 형제 4건과 동일 패턴, 선행조건 우회 없음. 이 PR 완료가 `spec-sync-auth-gaps.md` 옛 트래커 항목과 `spec-draft-nullable-notation-followups.md` 6축 열거 두 곳을 조용히 stale 화시킬 예정(WARNING 2건) |
| naming_collision | LOW | 신규 식별자는 private 헬퍼 1개뿐. 형제 명명 패턴 준수하나 기존 `AUTH_CONFIG_NOT_FOUND`(400, 유일한 예외 케이스로 spec 이 명시 경고)와 이름 근접 — disambiguation 주석 권고 |

## 권장 조치사항

1. `authconfig-dup-delete.md` 구현 시 `throwAuthConfigNotFound()` 헬퍼에 "이 404 `RESOURCE_NOT_FOUND` 는 `triggers.service.ts` 의 400 `AUTH_CONFIG_NOT_FOUND`(§1.11, 유일한 `_NOT_FOUND`≠404 예외)와 다른 자리" disambiguation 주석 추가 (naming_collision WARNING #1)
2. plan 완료("트래커 항목 해소") 단계에서 `plan/in-progress/spec-sync-auth-gaps.md:215` 항목을 함께 취소선/체크 처리 — 같은 버그 이중 추적 방지 (plan_coherence WARNING #2)
3. 같은 단계에서 `plan/in-progress/spec-draft-nullable-notation-followups.md:4961-4968` 의 6축 고정 열거를 재열거형으로 일반화하거나 `6-config.md` 를 선반영 (plan_coherence WARNING #3)
4. (이 PR 과 무관, 후속 별도 처리) `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans:` 의 stale `workflow-duplicate-nodes-edges.md` 항목 제거 (convention_compliance WARNING #5)
5. `2-api-convention.md §3` DELETE 멱등성 표 각주 집행(기존 disposition, BLOCK:NO, planner 소유)은 이번 PR 조치 불요 — 집행 시 이번 7번째 인스턴스도 자동 커버됨 (rationale_continuity WARNING #4)
