# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL/WARNING 급 발견 0건. 9개 reviewer(그중 7명은 router_safety 강제 포함) 전원이
결과를 확보했고, 감사 로그 `User` 컬럼 유출 수정 + §5.4 응답 계약 검증 헬퍼 신설이 이전 두
라운드(`13_49_54`, `14_39_31`)의 지적을 모두 실측 해소한 상태임을 재확인했다. `testing`/
`api_contract` 가 LOW 로 보고했지만 실제 내용은 전부 INFO 성격(미검증 경로·근거 주석 부재)이다.
forced 화이트리스트 7명(documentation, maintainability, requirement, scope, security,
side_effect, testing) 전원 결과 확보 — 강제 이행 공백 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `visitUnion`의 `allowUndeclared` 면제 경로가 union 케이스에서 어떤 테스트에도 걸리지 않는다 — 이 줄을 지워도 현재 스펙 전부 통과(판별력 없는 코드) | `codebase/backend/src/shared/testing/response-contract.ts`(`visitUnion` 내 `allowUndeclared.has(path)` 분기), `response-contract.spec.ts` | `UnionDto` 기반 테스트에 `allowUndeclared` 케이스 1개 추가해 union 경로도 non-union 경로와 동일하게 캐너리 확보 |
| 2 | maintainability | `visitUnion`의 5번째 파라미터(`_onPath`)가 본문에서 전혀 쓰이지 않음 | `response-contract.ts`(`visitUnion` 시그니처) | 파라미터 제거 또는 "시그니처 통일 목적, 미사용" 주석 1줄 추가 |
| 3 | requirement / testing / api_contract | `AuditLogDto.user`/`ipAddress`가 optional+nullable(tri-state)로 선언돼 있어 §5.4(응답 DTO는 tri-state 금지, 요청 DTO 전용) 위반이다. 동시에 실제 FK(`user_id` NOT NULL, `onDelete` 미지정→RESTRICT)상 `user`가 null이 되는 경로가 사실상 도달 불가능해 보이는데, 근거 주석이 없고 e2e 단언(`toBeTruthy()`)도 이를 "항상 참"으로만 확인한다 | `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts:25-26,52-53`, `entities/audit-log.entity.ts:24-29`, `test/audit-logs.e2e-spec.ts:89-91` | 이번 PR 범위 밖. `plan/in-progress/spec-draft-nullable-notation-followups.md` §5.4 스윕 착수 시 이 DTO도 포함해 `nullable`/`?` 선언을 실제 도달 가능성에 맞춰 정리 |
| 4 | security | `User` 엔티티 자체에 컬럼 수준 방어(`select:false`/`@Exclude()`/전역 `ClassSerializerInterceptor`)가 없음 — `passwordHash`·`twoFactorSecret`·복구 코드·토큰류 | `codebase/backend/src/modules/users/entities/user.entity.ts` | 조치 불요(이번 PR 범위 밖) — 이미 `spec-draft-nullable-notation-followups.md`에 후속 항목으로 등재, 인증 경로 fail-silent 위험 때문에 별도 PR로 유예 |
| 5 | testing | `AuditLogsService.getSortColumn` 폴백 및 `action`/`resourceType`/`startDate`/`endDate` 필터 경로 유닛 테스트 부재 — 2라운드 연속 미조치 | `codebase/backend/src/modules/audit-logs/audit-logs.service.ts`, `audit-logs.spec.ts` | 다음에 이 서비스를 만질 때 필터별 `qb.andWhere`/`orderBy` 인자 단언 추가 |
| 6 | maintainability | `find → toBeDefined → assertMatchesContract` 3문장 패턴이 2곳(`workflow-crud`, `workflow-execution` e2e)에서 반복 | 해당 e2e 파일 | 조치 불요 — §5.4 스윕 착수 시 헬퍼로 통합(이미 plan 등재) |
| 7 | documentation | `response-contract.ts`가 아직 어떤 spec 의 frontmatter `code:` glob에도 등재되지 않아 `--impl-done` SPEC-CONSISTENCY 게이트가 이 파일 변경에 반응하지 않음 | `codebase/backend/src/shared/testing/response-contract.ts` | 조치 불요 — 다음 planner 턴에서 `2-api-convention.md` frontmatter 등재 |
| 8 | database | `action`/`resource_type`/`user_id` 단독 필터에 전용 인덱스 없음(기존 상태, 이번 diff 무관) | `audit-log.entity.ts`, `migrations/V002__indexes.sql:33` | (선택) 트래픽 프로파일 확인 후 복합 인덱스 추가 검토 |
| 9 | scope | 하나의 리뷰 배치가 4가지 성격(보안 fix·§5.4 스윕 확장·게이트 선행 plan 정리·리뷰 산출물)을 함께 나름 — 각각 근거는 있으나 판단하려면 커밋 이력 재구성 필요 | 전체 브랜치(9개 커밋) | PR 설명에 "A(보안 수정)·B(§5.4 스윕)·C(게이트 선행 정리)" 한 줄 인덱스 추가 |
| 10 | api_contract | `GET /api/audit-logs`의 `user` 응답 축소(26키→3키)는 기술적으로 breaking narrowing이나 원 노출 자체가 계약 위반이었고 CHANGELOG가 이미 명시 기록 | `CHANGELOG.md`, `audit-logs.service.ts:60-61` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 결함 없음. User 엔티티 컬럼 방어 부재는 기존 유예 항목 재확인만 |
| requirement | NONE | 이전 2라운드 지적 전건 해소 확인. AuditLogDto tri-state 선언 drift 는 범위 밖 |
| scope | NONE | 핵심 변경(8파일/928줄)은 단일 축, 무관 리팩토링 없음. 4갈래 혼재는 각각 근거 있음 |
| side_effect | NONE | 이전 WARNING(반환 타입이 런타임보다 넓음) 해소 확인, 신규 부작용 없음 |
| maintainability | NONE | 이전 CRITICAL/WARNING 4건 전부 해소 확인. `visitUnion` 미사용 인자만 신규 INFO |
| testing | LOW | 이전 Critical/WARNING 전부 회귀 테스트로 고정 확인. `allowUndeclared` union 미검증 등 INFO만 |
| documentation | NONE | 이전 지적 전건 반영 확인, 수치·인용 전수 대조 일치 |
| database | NONE | join 축소는 순수 개선. 인덱스 부재는 기존 상태 |
| api_contract | LOW | 응답 축소는 문서화된 의도적 narrowing. 신규 계약 위반 없음 |

## 발견 없는 에이전트

없음 (전원 최소 1건 이상의 INFO 기록, CRITICAL/WARNING은 전원 0건).

## 권장 조치사항

1. (선택, 낮은 우선순위) `UnionDto` 기반 테스트에 `allowUndeclared` union 경로 케이스 1개 추가.
2. (선택) `AuditLogDto.user`/`ipAddress` tri-state 선언 정리는 §5.4 전수 스윕(plan 트래커 기등재) 시점에 일괄 처리.
3. (선택) `visitUnion` 미사용 파라미터 정리 또는 주석 추가.
4. (선택) 다음 PR 설명에 변경 갈래 인덱스 한 줄 추가.
5. 그 외 신규 조치 불요 — 이전 두 라운드가 지적한 모든 CRITICAL/WARNING이 실측 해소됨.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, database, api_contract (9명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨, 이행 공백 없음
  - **제외**: 아래 표 (5명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff와 무관(성능 영향 표면 없음) |
  | architecture | router 판단상 이번 diff와 무관(구조적 변경 아님) |
  | dependency | router 판단상 이번 diff와 무관(신규 의존성 없음) |
  | concurrency | router 판단상 이번 diff와 무관(동시성 로직 변경 없음) |
  | user_guide_sync | router 판단상 이번 diff와 무관(사용자 가이드 대상 아님) |