# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. 신규 WARNING 1건(`AuditLogListItem` 이 `workspace` 관계 필드를 `user` 와
달리 좁히지 않아, 지금 당장 wire 유출은 없지만 이번 PR 이 고친 것과 동일한 클래스의 결함이
형제 경로로 재발할 수 있는 구조적 잔여 지점). 그 외에는 3라운드째 review-fix 루프를 거치며
이전 라운드의 Critical/WARNING 이 전부 실측 기반으로 해소된 것을 8개 reviewer 가 코드 레벨로
재확인했다. forced 화이트리스트(7명) 전원 결과 확보 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | api_contract | `AuditLogListItem` 이 `user` 관계는 `Omit`+`Pick` 으로 좁혔지만 형제 관계 필드 `workspace` 는 그대로 `Workspace` 전체 타입으로 남겨, 타입이 런타임보다 넓다(현재 `al.workspace` 는 join 안 돼 항상 `undefined`). 지금은 `AuditLogDto` 가 `workspace` 객체를 선언하지 않아 wire 유출은 없으나, 다음 사람이 이 타입을 믿고 `result.workspace.name` 코드를 짜거나 `leftJoinAndSelect('al.workspace','workspace')` 를 추가하면 이번에 고친 것과 동일한 클래스의 정보노출이 재발할 수 있다 | `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:19-21`(타입 정의), `:51-62`(쿼리 빌더, `workspace` join 없음) | `AuditLogListItem` 을 `Omit<AuditLog, 'user' \| 'workspace'>` 로 넓히거나, `AuditLogDto` 가 실제로 보장하는 필드만으로 반환 타입을 재구성 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | `User` 엔티티에 컬럼 수준 방어(`select: false`)가 없어 이번 call-site 수정이 유일한 차단선 — 다른 코드가 다시 `leftJoinAndSelect('*.user','user')` 하면 재발 가능. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 후속 PR 항목으로 등재됨(3라운드 연속 확인) | `codebase/backend/src/modules/users/entities/user.entity.ts`(전체) | 후속 PR 로 자격증명/토큰 7개 컬럼에 `select:false` 적용 (이미 트래커에 등재, 재조치 불요) |
| 2 | testing | `descend()` 의 방어 분기(`$ref`/`allOf` 로 참조된 스키마 이름이 생성 문서의 `components.schemas` 에 없을 때 조용히 스킵)가 어떤 테스트로도 물리지 않음 — 검증기 자신이 이 PR 이 잡으려는 것과 같은 성격의 "조용한 미검사 통과" 사각지대를 갖고 있음 | `codebase/backend/src/shared/testing/response-contract.ts:201-204` | 필수 아님. 여유 시 이 분기를 별도 위반(`'unresolved-ref'`)으로 승격하거나 뮤테이션 확인 후 캐너리 추가 검토 |
| 3 | testing | `workflow-execution.e2e-spec.ts` 의 `assertMatchesContract` 배선이 항상 정상 완료(`completed`) 경로만 대조 — `ExecutionDto` 의 실패 전용 필드(`error` 등 optional+nullable 10개 필드)는 값이 채워진 상태로 한 번도 실측되지 않음 | `codebase/backend/test/workflow-execution.e2e-spec.ts:116-156` | 필수 아님. 여유 시 실패 노드를 포함한 워크플로우를 별도 실행해 `failed` 상태 응답도 계약 대조에 추가 |
| 4 | maintainability | `find → toBeDefined → assertMatchesContract` 3문장 반복 패턴이 여전히 2곳에 존재 — 3라운드 연속 확인, §5.4 스윕 착수 시점에 헬퍼로 접기로 이미 plan 에 등재·유예됨 | `workflow-crud.e2e-spec.ts:161-165`, `workflow-execution.e2e-spec.ts:152-155` | 조치 불요 — §5.4 스윕(plan 등재) 시점에 헬퍼화 |
| 5 | documentation | `response-contract.ts` 가 §5.4 를 실제로 시행하는 유일한 코드인데 아직 `spec/5-system/2-api-convention.md` frontmatter `code:` glob 에 미등재 — 3라운드 연속 확인, developer 권한 밖이라 planner 트랙(`spec-draft-nullable-notation-followups.md`)에 이미 등재됨 | `spec/5-system/2-api-convention.md`(frontmatter), `codebase/backend/src/shared/testing/response-contract.ts` | 조치 불요 — 다음 planner 턴에서 집행 |
| 6 | api_contract | `AuditLogDto.user`/`ipAddress` 가 "optional+nullable" 조합으로 §5.4 판정 대상(3형태) 밖에 있는 것은 이번 diff 가 만든 게 아니라 기존 파일의 선행 drift. `AuditLogListItem.user` 는 오히려 더 엄격(방향 안전)하므로 결함 아님 | `audit-logs/dto/responses/audit-log-response.dto.ts:25-26,52-53`(diff 밖) | 조치 불요 — 기존 §5.4 drift 트래커에서 처리 |
| 7 | requirement | §5.4 spec 본문과 `response-contract.ts` JSDoc 판정 규칙 표가 현재 코드에서 line-level 로 일치함을 재확인(이전 라운드 지적 해소 지속) | `response-contract.ts:37-55` vs `spec/5-system/2-api-convention.md:188-191` | 조치 불요 — 검증 완료 기록 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 감사 로그 `leftJoinAndSelect` → `leftJoin`+`addSelect` 전환으로 26키 유출을 쿼리 레벨에서 원천 차단. SQL 파라미터 바인딩·인가 로직 변경 없음. 이전 라운드 Critical(자기참조 거짓통과, union 미검증) 코드 레벨 해소 재확인 |
| requirement | NONE | §5.4 spec-코드 line-level 일치, 수치 주장(26키/3필드) 정확, 이전 WARNING(dtoName 중복, missing kind 이중의미) 해소 확인 |
| scope | NONE | 델타 커밋(`db45d1b09`, `bf02fe328`) 모두 단일 파일(`response-contract.ts`/`.spec.ts`) 결함 수정에 국한. codebase 변경 8파일·945줄 추가로 범위 준수 |
| side_effect | NONE | 전역 상태·env·fs·네트워크 부작용 없음. 공개 시그니처 변경(`findAll` 반환 타입)은 폭발 반경 0. wire 변경은 CHANGELOG 에 이미 고지 |
| maintainability | NONE | 이전 3라운드 CRITICAL 1건·WARNING 3건·INFO 1건 전부 실제 해소·회귀테스트 확인. 잔여 INFO(3문장 반복 2곳)는 이미 유예된 항목 |
| testing | LOW | 이전 Critical 2건·WARNING 1건·INFO 2건 전부 실측 기반 해소 확인. 신규 발견은 좁은 커버리지 갭(INFO) 2건뿐 |
| documentation | NONE | 3라운드 연속 지적 항목(판정표 출처, DTO명 중복, union 캐너리 등) 전부 코드에 반영 확인. 수치(26/23키) 산술 정확 |
| api_contract | LOW | `user` 응답 축소는 CHANGELOG 로 적절히 문서화된 breaking change. 형제 필드 `workspace` 미narrowing 은 신규 WARNING(구조적 재발 위험, 현재 wire 유출은 없음) |

## 발견 없는 에이전트

없음 — 전 에이전트가 최소 1건 이상의 INFO/확인 기록을 남겼으나, 그중 WARNING 급 이상은
api_contract 1건뿐이고 나머지는 이미 추적 중이거나 "문제 없음" 확인 기록이다.

## 권장 조치사항

1. `AuditLogListItem` 의 `workspace` 필드를 `user` 와 동일하게 좁히거나(`Omit<AuditLog, 'user' | 'workspace'>`), `AuditLogDto` 선언 기준으로 반환 타입을 재구성해 이번 PR 의 재발 방지 의도를 완결한다 (WARNING #1).
2. (기존 트래커, 재확인만) `User` 엔티티에 `select: false` 컬럼 방어를 추가하는 후속 PR을 `plan/in-progress/spec-draft-nullable-notation-followups.md` 일정대로 진행한다.
3. (기존 트래커, 재확인만) `response-contract.ts` 를 `spec/5-system/2-api-convention.md` frontmatter `code:` glob 에 등재하는 것은 planner 턴에서 집행한다.
4. (선택) 여유가 있으면 `descend()` 의 unresolved-ref 방어 분기와 `workflow-execution` 실패 상태 필드에 대한 캐너리를 추가해 테스트 커버리지 갭 2건을 닫는다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract` (8명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명) — 전원 결과 확보됨, 미이행 없음
  - **제외**: 6명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 이번 diff 범위(감사 로그 select 축소, §5.4 검증 헬퍼)에 성능 영향 표면 없음으로 판단 |
  | architecture | 라우터 판단 — 신규 아키텍처 변경 없음(단일 파일 헬퍼 신설, 기존 서비스 쿼리 축소) |
  | dependency | 라우터 판단 — 신규 외부 의존성 추가 없음 |
  | database | 라우터 판단 — 스키마/마이그레이션 변경 없음(쿼리 select 절만 변경) |
  | concurrency | 라우터 판단 — 동시성 관련 코드 경로 변경 없음 |
  | user_guide_sync | 라우터 판단 — 사용자 가이드 문서 대상 변경 없음 |