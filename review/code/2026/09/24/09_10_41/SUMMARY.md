# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. WARNING 2건 중 1건(CHANGELOG 사실관계 오기술)은 이번 diff 가 새로 만든 것으로 조치 권장, 나머지 1건(권한 검사 순서 오라클)은 이 diff 이전부터 있던 기존 결함으로 저장소가 이미 정확한 블라스트 반경으로 별도 트래커에 등재해 둔 상태다(9개 reviewer 전원 — forced 7명 포함 — 결과 확보, 누락 없음).

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| — | — | 없음 | — | — |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | `CHANGELOG.md` 신규 항목의 "남는 것" 서술이 사실관계를 잘못 기술한다 — "트래커에 블라스트 반경이 좁게 적혀 있었고 이 PR 이 정정했다"고 쓰여 있으나, 실제로는 트래커(`spec-draft-nullable-notation-followups.md`)는 처음부터 정확했고("요청자가 그 워크스페이스 멤버가 아니어도" · 13/17 라우트) 좁게 적혀 있던 것은 developer 자신이 이번 턴에 쓴 `plan/in-progress/member-owner-toctou.md` §F 였다. 같은 PR 이 만든 `RESOLUTION.md`·plan §F 자체가 정반대 사실을 명시하는데 CHANGELOG 만 반대로 적혀 다음 사람이 정확했던 트래커를 의심할 근거가 된다. | `CHANGELOG.md:32` | "트래커에 좁게 적혀 있던 것"을 "이 plan 문서(§F)에 좁게 적혀 있던 것(트래커는 처음부터 정확했다)"으로 정정 |
| 2 | Security / Requirement (중복 통합) | `removeMember` 핸들러가 `@Roles()`·`@WorkspaceId()` 를 쓰지 않아 `RolesGuard.canActivate` 의 조기 `return true` 조건과 일치해 멤버십 검사를 완전히 단락한다. 유효 JWT 만 있으면 그 워크스페이스 비멤버도 응답 코드(404/403 CANNOT_REMOVE_OWNER/403 ADMIN_REQUIRED) 차이만으로 대상 멤버 존재 여부·owner 여부를 오라클링할 수 있다(상태 변경은 `assertAdmin` 이 막아 데이터 정합성 침해는 아님, 정보 노출 성격). **이번 diff 가 만든 결함이 아니다** — 순서 자체는 diff 이전(#1373)부터 있었고, `CHANGELOG.md` 최상단 항목과 `plan/in-progress/member-owner-toctou.md` §F 가 정확한 블라스트 반경("임의 인증 사용자")으로 이미 별도 트래커 항목에 등재해 뒀음을 코드 추적으로 직접 확인함. | `workspaces.service.ts:826-827`(owner 조기가드 → `assertAdmin` 순서), `workspaces.controller.ts:355-374`(`@Roles`/`@WorkspaceId` 미사용), `roles.guard.ts:114-119`, `workspace.decorator.ts`(`handlerConsumesWorkspaceId`) | 이 PR 자체를 막을 사유는 아님(스코프 밖, 이미 등재됨) — 별도 트래커 항목에서 `assertAdmin` 을 존재/역할 판정보다 먼저 수행하도록 순서 재정렬 권장 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement / Documentation | `spec/data-flow/12-workspace.md` §1.6 이 `removeMember` 의 동시성 메커니즘(원자적 DELETE 술어 + 재조회 분기)을 명문화하지 않음. spec 문언 자체가 틀린 것은 아니라 SPEC-DRIFT 아님. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 후속 항목으로 등재됨 | `spec/data-flow/12-workspace.md` §1.6 | 조치 불요(등재 완료, 재지적 방지용 기록) |
| 2 | Requirement | `CANNOT_REMOVE_OWNER`/`OWNER_ROLE_PROTECTED`/`SOLE_OWNER_CANNOT_LEAVE` 가 중앙 에러 카탈로그(`spec/5-system/3-error-handling.md` §1.9)에 미등재(형제 코드 `CANNOT_ASSIGN_OWNER` 만 등재). 이번 PR 이 만든 갭 아니고 이미 planner 트래커에 등재됨 | `spec/5-system/3-error-handling.md` §1.9 | 조치 불요(등재 완료) |
| 3 | Scope / Side Effect / Concurrency / Maintainability | `VACUITY_GUARD_MS` 를 `test/helpers/concurrency.ts` 에서 export 로 승격해 `integration-rotate-concurrency.e2e-spec.ts` 까지 함께 수정됨(값 불변, 리터럴→상수 치환). 직전 라운드 W5 지적에 대한 정당한 대응이며 plan 에 근거 기록 있음. `assertGuardBelowKnownTimeouts` 검사 범위 안에 그대로 있어 안전 마진 누락 재발 없음 | `test/helpers/concurrency.ts:31`, `integration-rotate-concurrency.e2e-spec.ts:9,121` | 조치 불요 |
| 4 | Scope | `review/code/**`, `review/consistency/**` 하위 다수 파일이 diff 에 포함 — 반복 `/ai-review`·`/consistency-check` 라운드 산출물로 프로젝트 규약에 부합하는 정상 커밋 | `review/code/2026/09/24/08_09_57/*`, `.../08_46_47/*`, `review/consistency/2026/09/24/07_29_15/*` | 조치 불요 |
| 5 | Side Effect | DELETE 술어 변경으로 경합 상황의 응답이 200→403 으로 바뀜 — 의도된 수정(이 PR 목적 자체), CHANGELOG 기재 완료 | `workspaces.service.ts:857` | 조치 불요, 참고 기록 |
| 6 | Side Effect | `affected===0` 경로에 재조회(추가 DB 왕복) 도입 — 실패 경로에만 영향, 정상 삭제 경로엔 영향 없음 | `workspaces.service.ts:863` | 조치 불요 |
| 7 | Side Effect | `origin/main` 이 fork point 이후 별도로 next 16.3.5 를 머지해 브랜치 diff 에 `package.json`/`pnpm-lock.yaml` divergence 가 보이나 이 PR 의 커밋이 만든 변경이 아님(`git log` 로 확인) | N/A (`git diff origin/main --stat` 에서만 관측) | 조치 불요 — 병합/리베이스 시 자연 해소, 통합 조율자 오인 방지용 기록 |
| 8 | Maintainability | 재진입 락 오케스트레이션 보일러플레이트가 두 e2e 파일에 손으로 복제됨 — 이미 "세 번째 자리가 생기면 헬퍼로 추출" 임계값과 함께 planner 트래커에 등재됨 | `test/member-remove-concurrency.e2e-spec.ts:231-275` | 조치 불요, 세 번째 자리 발생 시 재확인 |
| 9 | Maintainability | `removeMember()` DELETE 문 앞 인라인 주석(24줄)이 메서드 JSDoc 요약과 상당 부분 겹침 — 완전 중복은 아니고(JSDoc="무엇을", 인라인="왜 원자적인가") 저장소의 확립된 컨벤션과 일치, 일관성 위반 아님 | `workspaces.service.ts:830-853` vs `:805-809` | 조치 불요 |
| 10 | Testing | 정상 삭제(`affected>0`) 경로에서 재조회 `findOne` 이 호출되지 않음을 직접 단언하는 테스트가 없음 — 현재 코드 구조상 실질 위험 낮음 | `workspaces.service.spec.ts:1501` | 우선순위 낮음 — `toHaveBeenCalledTimes(1)` 단언 추가 고려 가능 |
| 11 | Testing / Database | `FindOperator` 내부 필드(`criteria.role.type`/`.value`) 직접 검사가 TypeORM 구현 세부사항에 결합됨 — e2e 가 SQL 렌더링을 이중으로 고정해 리스크 낮음(전 라운드부터 동일 사안 재확인) | `workspaces.service.spec.ts:1509-1515` | 조치 불요 |
| 12 | Concurrency | `transferOwnership()` 독스트링("두 멤버를 단일 IN 쿼리로 동시에 락")이 실제 구현(순차 `findOne`+`pessimistic_write` 2회)과 다름 — 이번 diff 대상 아니고 전 두 라운드가 이미 확인·dispositioned(데드락 미발생 근거: 앞선 workspace 행 락이 완전 직렬화) | `workspaces.service.ts:716` vs `:745,:764` | 조치 불요, 재-flag 아님 |
| 13 | Maintainability / Testing | 커밋 `24f7a1ddf`(중복 단위 테스트 제거)가 새 결함을 만들지 않았고 커버리지 손실도 없음을 뮤턴트 재측정(예측=실측)으로 확인 | `workspaces.service.spec.ts` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 권한 검사 순서 오라클(WARNING, 기존 결함·이미 등재) 외 신규 보안 결함 없음 |
| requirement | NONE | 기능 완전성·엣지 케이스·spec 정합 모두 확인, Critical/Warning 급 없음(INFO 3건은 기존 등재) |
| scope | LOW | 단일 목적에 강하게 결속, `VACUITY_GUARD_MS` 관련 파일 수정도 근거 있음 |
| side_effect | NONE | 신규 부작용 없음, 관측 가능한 동작 변화는 모두 의도·문서화됨 |
| maintainability | LOW | 중복 테스트 제거는 개선, 남은 관찰은 기존 등재된 유예 항목 |
| testing | LOW | 세 분기(행 소실/승격/강등) 모두 단위+e2e 이중 검증, 신규 갭 없음 |
| documentation | LOW | CHANGELOG "남는 것" 서술이 트래커/plan 중 어느 쪽이 좁았는지 반대로 기술(WARNING) |
| database | LOW | 쿼리·트랜잭션·스키마·인덱스 영향 없음, 파라미터화 확인 |
| concurrency | LOW | 원자적 DELETE + EvalPlanQual 재평가 정확, 제3 상태 오분류 해소 확인 |

## 발견 없는 에이전트

- database (Critical/Warning 없음, INFO 도 기존 재확인 수준)

## 권장 조치사항

1. `CHANGELOG.md:32` 의 "남는 것" 서술을 정정한다 — 좁게 적혀 있던 것은 트래커가 아니라 developer 자신의 plan 문서(§F)였고, 트래커는 처음부터 정확했다는 사실을 반영한다.
2. (이 PR 스코프 밖, 별도 트래커 항목) 권한 검사 순서 오라클 해소 — `removeMember` 에서 `assertAdmin`(또는 최소한 워크스페이스 멤버십 확인)을 owner/존재 판정보다 먼저 수행하도록 순서를 재정렬하는 방안을 별도 PR 에서 검토.
3. (우선순위 낮음, 선택) 정상 삭제 경로에서 재조회 `findOne` 이 호출되지 않음을 명시적으로 단언하는 테스트 한 줄 추가 고려.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency (9명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced 7명 — 전원 결과 확보 확인됨, 누락 없음)
  - **제외**: 아래 표 (5명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 diff 와 관련성 낮음 |
  | architecture | router 판단 — 이번 diff 와 관련성 낮음 |
  | dependency | router 판단 — 신규/변경 의존성 없음 |
  | api_contract | router 판단 — API 시그니처/응답 계약 변경 없음(엔드포인트 응답 코드 분기 변화는 side_effect 가 별도로 다룸) |
  | user_guide_sync | router 판단 — 사용자 가이드 영향 없음 |