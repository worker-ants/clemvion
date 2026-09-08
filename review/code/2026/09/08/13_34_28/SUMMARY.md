# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. WARNING 2건(둘 다 순수 리팩터 과정에서 생긴 낮은 실질영향 결함: AST 가드 간 중복/규칙 불일치, orphaned 주석). 이번 배치(spec-followups-batch-b, B-1~B-8)는 대부분 이전 리뷰 라운드(`review/code/2026/09/08/12_53_08`)의 지적사항을 반영한 후속 diff이며, 전역 예외 필터 SoT 통합·`listMembers` DB 투영 강화 등 실질 변경은 방향성이 긍정적으로 검증됨. forced 화이트리스트(documentation, maintainability, requirement, scope, security, side_effect, testing) 7명 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture | 형제 repo-guard 두 곳이 "감싸는 메서드/함수 이름 찾기"라는 동일 책임의 AST 워커를 각자 손으로 재구현하며 fallback 규칙까지 서로 다르게 갈라져 있다. 신규 `enclosingMethodName` 은 변수 선언의 initializer 가 화살표/함수 표현식일 때만 이름으로 인정하지만(이번 diff 가 새로 고친 규칙), 형제 `enclosingName` 은 여전히 초기자 종류를 보지 않고 아무 변수 선언 이름으로나 fallback한다 — 이번에 고친 바로 그 결함 클래스가 형제 가드에 그대로 남아 있다. 저장소는 이미 `source-scan.ts` 로 공유 유틸을 승격하는 원칙을 세워 두었으나 이 두 번째 반복 로직에는 적용되지 않았다. | `endpoint-path-conflict-wrap-guard.ts:45`(`enclosingMethodName`) vs `user-entity-exposure-guard.ts:195`(`enclosingName`) | `enclosingMethodName`/`enclosingName` 을 `common/__test-utils__/source-scan.ts` 로 승격해 단일 구현으로 통합하고, 이번 PR 이 검증한 더 안전한 규칙(초기자가 함수/화살표일 때만 인정)을 채택한다. |
| 2 | maintainability / documentation | 주석 재배치로 "vacuous 방지" JSDoc 이 자신이 설명하던 테스트(`it('[캐너리] 빌드 대상 파일 목록이 비어 있지 않다', ...)`)에서 물리적으로 떨어져 나갔다(orphaned comment). `buildFiles` 캐싱을 위한 새 JSDoc+선언이 그 사이에 끼어들어, 두 JSDoc 블록이 나란히 붙고 원래 대상 `it(...)` 은 설명 없이 시작한다. 기능 영향은 없으나 "내 수정이 다음 결함이 된다"(orphaned JSDoc) 패턴과 동일한 형태. | `codebase/backend/src/repo-guards/__tests__/production-build-devdep.spec.ts:35-46` | 35~39행("먼저 vacuous 방지" 블록)을 46행 `it(...)` 바로 위로 되돌리고, 40~43행(캐싱 설명) 블록만 44행 `const buildFiles` 위에 남긴다. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security / requirement / dependency / database / concurrency / api_contract / performance | 전역 예외 필터(`GlobalExceptionFilter`)의 unique-violation 판정이 `err instanceof QueryFailedError` 요구를 없앤 `isPostgresUniqueViolation`(SoT `pg-error.ts`)로 통합돼, raw 표면(`err.code==='23505'`, wrap 안 됨) 오류도 이제 앱 전체에서 500→409 `RESOURCE_CONFLICT` 로 매핑된다. 클라이언트 응답 메시지는 여전히 고정 문구라 드라이버 원문(CWE-209)은 노출되지 않고, 양방향(23505→409, 23502→500 유지) 회귀 테스트로 고정됨. `CHANGELOG.md` 가 blast radius 실측(0 — 요청 경로에 raw query 없음)을 기록. | `codebase/backend/src/common/filters/http-exception.filter.ts:70`, `codebase/backend/src/common/db/pg-error.ts:18-47` | 조치 불요 — 확인 완료, 긍정적 버그 수정. |
| 2 | security / performance / requirement / side_effect / database / api_contract | `WorkspacesService.listMembers` 가 `relations`+JS `.map` 매핑(User 민감 7컬럼 전체 로드 후 6키로 축소)에서 DB 레벨 `select` 투영(민감 컬럼 자체를 로드하지 않음)으로 전환. `relations`+`select` 조합은 여전히 단일 JOIN 이라 N+1 로 퇴화하지 않음. 응답 wire 계약(6키) 불변. `user-entity-exposure-guard` 화이트리스트에서도 이 자리가 제거돼 검출→강제 승격이 래칫에 반영됨. 신규 단위 테스트가 `select` 옵션 자체를 별도 축으로 단언(뮤테이션 검증 완료). | `codebase/backend/src/modules/workspaces/workspaces.service.ts:213-232` | 조치 불요 — 긍정적 방어/성능 심화. |
| 3 | side_effect / requirement / dependency / api_contract | `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 백엔드 내부 타입 개명. grep 전수 확인 결과 백엔드 내 잔여 참조는 선언·`findOne` 반환 타입 두 곳뿐이고 컨트롤러는 타입을 명시 참조하지 않아 컴파일 타임 파급 없음. 프런트엔드 동명 손-미러 타입은 별개 선언(JSDoc 만 갱신)이라 wire 계약 영향 없음. BE/FE 공유 타입 부재라는 근본 갭은 그대로지만 이는 `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 이미 스코프 밖으로 결정한 사항. | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:70,153` | 조치 불요 — 순수 rename, 확인 완료. |
| 4 | testing | 신규 AST 가드(`endpoint-path-conflict-wrap-guard.ts`)의 커스텀 fixture 가 실제 이력에 있는 회귀 형태(`const saved = await repo.save(t).catch(...)` — 변수 선언을 경유하는 wrap)를 스스로 재현하지 않는다. 현재는 `triggers.service.ts` 의 실제 `create`/`update` 가 우연히 이 형태라서 `TRIGGERS_DIR` 실스캔을 통해 간접적으로만 커버되며, 프로덕션 코드가 그 형태를 벗어나면 안전망이 조용히 사라진다. | `codebase/backend/src/repo-guards/__tests__/fixtures/endpoint-path-save.fixture.ts` | fixture 에 `const saved = await this.triggerRepository.save(t).catch(...)` 형태의 양성 케이스를 추가해 프로덕션 파일의 우연한 모양에 의존하지 않게 고정. |
| 5 | architecture | 신규 가드의 리포지토리 식별이 정확한 프로퍼티 매칭이 아니라 `receiver.getText(sf).includes(TRIGGER_REPOSITORY)` 부분 문자열 포함이라, `someTriggerRepositoryWrapper.save(...)` 같은 변형에도 매치될 수 있다. `save` 판정에는 정확 이름 비교(`isPropertyAccessNamed`)를 쓰면서 비대칭. 배열 동등성(`toEqual`) 단언 덕에 오탐 시 테스트가 실패해 fail-safe 방향이라 즉각적 위험은 낮음. | `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts:162` | 급하지 않음 — `isPropertyAccessNamed(receiver, TRIGGER_REPOSITORY)` 로 좁히면 일관된 정확도. |
| 6 | maintainability | cafe24/makeshop 두 spec 파일에 `raceErrorSurfaces` 배열(주석 포함 26줄, flat/wrapped 두 표면)이 문자 그대로 중복. provider 미러 중복 정책(의도된 결정)과는 다른 축 — 이건 provider 와 무관한 순수 Postgres 에러 모양 테스트 픽스처. | `integration-oauth.service.cafe24.spec.ts:602-632`, `integration-oauth.service.makeshop.spec.ts:508-538` | 지금 조치 불요. 다음에 만질 때 공유 fixture(`pg-race-error-surfaces.fixture.ts` 류)로 추출 고려. |
| 7 | performance | `production-build-devdep.spec.ts` 가 `describe` 최상단에서 `buildFiles` 를 1회 캐싱하도록 고쳤으나(이전 라운드 지적 해소), `findDevDepLeaks(backendDir)` 내부에서 `resolveBuildFileNames` 를 독립적으로 재호출해(가드 함수 자체, 이번 diff 밖) 스위트당 총 2회 계산이 남아 있다. 테스트 실행 시간에만 영향, 경미함. | `production-build-devdep.spec.ts:44,56`, `production-build-devdep-guard.ts:112` | 급하지 않음 — 다음에 가드 시그니처를 만질 기회에 선계산 목록 주입 파라미터 추가 고려. |
| 8 | api_contract / architecture | 트리거 `endpointPath` 충돌 e2e(B4)가 §1.10 에러 봉투 계약(`RESOURCE_CONFLICT`+`details:{field,code}` 객체 전체+드라이버 원문 비노출)을 실 DB UNIQUE 제약 경로로 처음 고정. 신규 계약 도입이 아니라 기존 문서화된 계약의 커버리지 갭을 메움. | `codebase/backend/test/webhook-trigger.e2e-spec.ts:181-213` | 조치 불요 — 긍정적 강화. |
| 9 | dependency / concurrency | `http-exception.filter.ts` 가 `typeorm` `QueryFailedError` 직접 의존을 제거하고 외부 패키지 의존 0인 duck-typing 헬퍼(`pg-error.ts`)로 대체 — ORM 결합도 감소. 전역 필터+OAuth 통합 서비스 두 축이 같은 SoT 모듈에 fan-in. `integration-oauth.service.ts` 의 constraint 추출도 동일 헬퍼로 통합(동작 동일, 회귀 테스트로 방어). | `http-exception.filter.ts`, `integration-oauth.service.ts:1273,1827`, `pg-error.ts` | 조치 불요 — 확인 완료, 긍정적. |
| 10 | user_guide_sync | doc-sync-matrix 21개 trigger 전수 대조 결과 매칭 0건 — 이번 변경은 노드·i18n·docs MDX·auth 흐름·표현식 언어·신규 코드 발행 등 유저 가이드 동반 갱신 대상 표면을 건드리지 않는 순수 backend 내부 견고화 + 테스트/빌드 인프라 변경. | 해당 없음 | 조치 불요. |
| 11 | scope | 51개 변경 파일 중 26개는 이전 라운드 리뷰/컨시스턴시 산출물(프로젝트 관례상 커밋 대상)이고, 실제 코드/plan 변경 19개 전부가 `plan/in-progress/spec-followups-batch-b.md` B-1~B-8 항목과 1:1 대응. 계획 외 리팩토링·무관한 파일 수정 없음. | 전체 diff | 조치 불요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 정보 노출 방지(CWE-209) 강화 2건(예외 필터 SoT 통합, listMembers 투영), 하드코딩 시크릿/인젝션 표면 없음 |
| performance | NONE | listMembers 는 성능 개선(N+1 아님), production-build-devdep 잔여 반복 호출 1건(경미) |
| architecture | LOW | WARNING: AST 가드 간 "감싸는 이름 찾기" 로직 중복+규칙 불일치(source-scan.ts 미승격) |
| requirement | NONE | B-1~B-8 전 항목 spec 정합 확인, 이전 라운드 처분사항도 코드에 정확히 반영됨 확인 |
| scope | NONE | 3커밋 51파일 전수 대조, plan 선언 범위와 diff 완전 일치, 이탈 없음 |
| side_effect | LOW | 전역 필터 매칭 폭 확대(blast radius 실측 0), cmd_build 실패 표면 확대(문서화됨) — 신규 위험 없음 |
| maintainability | LOW | WARNING: orphaned JSDoc(주석-코드 대응 깨짐), cafe24/makeshop fixture 중복(경미) |
| testing | LOW | AST 가드 fixture 가 실제 회귀 형태(`const saved =`)를 직접 재현하지 않고 간접 커버에 의존 |
| documentation | LOW | orphaned JSDoc 동일 지적(문서 관점), 이전 라운드 CHANGELOG WARNING 해소 확인 |
| dependency | NONE | 신규 외부 의존성 없음, typeorm 직접 의존 제거로 결합도 감소 |
| database | NONE | listMembers 투영 개선, 예외 필터 매핑 정확도 개선, 마이그레이션/트랜잭션 변경 없음 |
| concurrency | NONE | TOCTOU/race-window 패턴(DB UNIQUE 제약 위임) 리팩터 전후 동작 동일, 경쟁 조건 없음 |
| api_contract | LOW | 예외 필터 상태코드 매핑 확대(500→409, 실측 blast radius 0), wire 계약 breaking change 없음 |
| user_guide_sync | NONE | doc-sync-matrix 21 trigger 매칭 0건, 동반 갱신 대상 없음 |

## 발견 없는 에이전트

없음 — 전 14개 에이전트가 최소 INFO 이상 발견사항을 보고함(대부분 확인/긍정 판정 성격).

## 권장 조치사항

1. **architecture WARNING**: `enclosingMethodName`(`endpoint-path-conflict-wrap-guard.ts`)과 `enclosingName`(`user-entity-exposure-guard.ts`)을 `common/__test-utils__/source-scan.ts` 로 승격해 단일 구현으로 통합하고, 더 안전한 규칙(초기자가 함수/화살표일 때만 변수명 인정)으로 통일한다.
2. **maintainability/documentation WARNING**: `production-build-devdep.spec.ts:35-46` 의 주석 순서를 복원해 "vacuous 방지" JSDoc 을 원래 대상 `it(...)` 바로 위로 되돌린다.
3. (급하지 않음) testing INFO#4: AST 가드 fixture 에 `const saved = await repo.save(t).catch(...)` 형태의 양성 케이스를 추가해 실제 회귀 형태를 fixture 자체로 재현하도록 보강.
4. (급하지 않음) architecture INFO#5: `endpoint-path-conflict-wrap-guard.ts` 의 리포지토리 식별을 `isPropertyAccessNamed` 정확 매칭으로 좁힌다.
5. 나머지 INFO 항목은 대부분 확인·긍정 판정이거나 이미 근거와 함께 처분(won't-do)된 사항으로 추가 조치 불요.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 사유: prompt 상 `routing: skipped` 로 명시. 전체 14개 reviewer 실행됨.
- **forced 화이트리스트 이행 확인**: `documentation, maintainability, requirement, scope, security, side_effect, testing` 7명 전원 결과(성공, 전문 확보) 확인됨 — 강제 화이트리스트 미이행 없음.
