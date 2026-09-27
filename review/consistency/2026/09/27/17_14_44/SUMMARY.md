# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 성공, 어디에도 CRITICAL 없음.

## 전체 위험도
**MEDIUM** — Critical 은 없으나 plan_coherence 가 지적한 신규 공용 헬퍼(`optional-non-null.ts`)의 spec `code:` 미등재가 이미 열려 있는 planner 결정 항목(`omit-undefined.ts` 선례)을 13라우트 규모로 재현하며 plan 에 반영돼 있지 않다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | 신규 공용 데코레이터 `optional-non-null.ts` 가 `omit-undefined.ts` 와 동일한 "spec `code:` 미등재" 미해결 결정을 13라우트 규모로 확장하는데 plan 이 이를 인지·등재하지 않음 | `spec/2-navigation/2-trigger-list.md` frontmatter `code:` (트리거 `dto/**` 는 등재되나 `codebase/backend/src/common/utils/optional-non-null.ts` 없음), 동일 축의 `1-workflow-list.md`·`3-schedule.md` 등 | `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "공용 헬퍼 `omit-undefined.ts` 가 어느 spec `code:` 에도 없다" 미해결 항목(2026-09-27 보강, 모집단 확장 각주) | `spec-draft-nullable-notation-followups.md` 해당 항목에 `optional-non-null.ts` 를 새 모집단으로 추가 등재하거나, `patch-null-validation.md` 체크리스트 "트래커" 항목에 명시. 등재 위치(도메인별 vs `api-convention.md §5.4` 한 곳) 결정 자체는 이미 planner 대기열에 있으므로 이 PR 이 직접 정할 필요는 없음 — 다만 지금 남기지 않으면 다음 세션이 두 헬퍼를 따로 재발견함 |
| 2 | cross_spec | `spec/5-system/2-api-convention.md §5.4` 의 PATCH tri-state 서술("null=초기화")이 "선언된 nullable 필드에만" 적용인지 "모든 PATCH 필드" 적용인지 문면상 불명확 — 43필드 null 거부와 글자 그대로는 충돌 가능해 보임(실제 동작·하위 spec 과는 충돌 없음) | `plan/in-progress/patch-null-validation.md` §처방 3번째 불릿 | `spec/5-system/2-api-convention.md:278` §5.4 블록쿼트 | §5.4 블록쿼트에 "tri-state 의 `null`=초기화 분기는 `nullable: true` 로 선언된 필드에만 적용되고, 미선언 필드의 `null` 은 400 `VALIDATION_ERROR`" 임을 명시하는 문장 추가(이 PR 이 그 사례). 편집은 developer 권한 밖이므로 `spec-draft-nullable-notation-followups.md`(이미 §5.4 자기모순 항목 보유) 에 등재해 planner 턴에서 처리 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `interactionAllowedOrigins` PATCH 바디 표기에 `?` 누락 (실제 DTO 는 완전 optional) | `spec/2-navigation/9-user-profile.md` §6.1 | 후속 spec 정비 시 `?` 추가해 tri-state 표기 정확화. `spec_impact: none` 판단 자체는 유효 |
| 2 | rationale_continuity | `IsOptionalNonNull()` 를 `api-convention.md §5.4` 검증-층 표에 상호 참조로 추가하는 안 | `spec/5-system/2-api-convention.md §5.4` | 개선 제안, 결함 지적 아님 |
| 3 | convention_compliance | `spec/2-navigation/` 18개 파일 중 14개는 frontmatter/앵커만 대조, 본문 전체 미정독 | `spec/2-navigation/` (4-integration, 5-knowledge-base 등 14개) | 이 14개 파일에 대한 정식 규약 준수 결론이 필요하면 별도 라운드에서 전문 검토 필요 |
| 4 | plan_coherence | `details[].code` 세분화 미결정(별도 열린 항목)이 이번 43필드의 400 응답에도 동일 적용 — 사유가 동질적이라 충돌 아님 | `spec/2-navigation/2-trigger-list.md §3` PATCH 註 | 별도 조치 불필요, 기존 planner 결정 항목 등재만으로 충분 |
| 5 | plan_coherence | `keyset-cursor-uuid-validation.md §A` 필터-매핑 기각 선례와 정합 확인됨 | `plan/in-progress/patch-null-validation.md` "처방" | 조치 불필요, 확인 기록용 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 43필드 어디도 spec/2-navigation/ 과 충돌 없음(오히려 문서가 이미 그은 경계와 일치). `api-convention.md §5.4` tri-state 범위 문면 모호 WARNING 1건 |
| rationale_continuity | NONE | Critical/Warning 없음 — §5.4 원칙·null-유효 필드(authConfigId/parentId/timezone 등) 스코프 제외·필터-매핑 기각 선례 모두 준수. INFO 2건 |
| convention_compliance | LOW | 전문 검토 4파일(2-trigger-list/1-workflow-list/3-schedule/6-config) + 14파일 frontmatter 대조에서 위반 없음. 검토범위 제한 INFO 1건 |
| plan_coherence | MEDIUM | 신규 공용 헬퍼 `optional-non-null.ts` 의 spec `code:` 미등재가 기존 미해결 결정을 13라우트로 확장 (WARNING 1건). 나머지는 기존 선례와 정합 |
| naming_collision | NONE | 신규 식별자 `IsOptionalNonNull`/파일경로 충돌 없음. 신규 endpoint/이벤트/ENV/에러코드 없음 |

## 권장 조치사항
1. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "공용 헬퍼 spec `code:` 미등재" 항목에 `codebase/backend/src/common/utils/optional-non-null.ts` 를 추가 등재하거나, `patch-null-validation.md` 체크리스트의 "트래커" 항목에 명시 (WARNING #1 해소).
2. 동일 트래커 문서(또는 별도 항목)에 `spec/5-system/2-api-convention.md §5.4` tri-state 서술의 적용 범위(nullable 선언 필드 한정)를 명시하는 planner 턴 작업을 등재 (WARNING #2 해소).
3. (선택) 후속 라운드에서 `spec/2-navigation/9-user-profile.md §6.1` 의 `interactionAllowedOrigins` 표기에 `?` 추가.
4. (선택) `spec/2-navigation/` 미정독 14개 파일에 대한 전문 검토가 필요하면 별도 라운드 진행.