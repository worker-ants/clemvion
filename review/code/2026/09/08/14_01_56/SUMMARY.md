# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 강제 화이트리스트(forced: documentation, maintainability, requirement, scope, security, side_effect, testing) 7개를 포함해 14개 reviewer 전원의 결과를 확보했다(누락 없음, "forced 인데 결과 없음" 케이스 없음). Critical 발견사항은 없다. 최고 위험도는 testing(MEDIUM) — 이번 배치가 신설한 공용 AST 헬퍼 `enclosingScopeName`의 "함수형 변수" 우선순위 분기가 두 소비 가드(`user-entity-exposure-guard.ts`, `endpoint-path-conflict-wrap-guard.ts`) 어느 fixture 로도 관측되지 않는 죽은 코드임을 뮤테이션 테스트로 직접 실측했다(해당 분기를 죽여도 관련 스위트 24/24 GREEN). 그 외 이번 배치는 대체로 SoT 통합 방향의 견고화(`pg-error.ts`, `listMembers` DB 레벨 `select` 투영)로 긍정적이나, 그 과정에서 (1) SoT 원칙을 스스로 세우면서 동시에 위반한 사례 1건, (2) 배치 자신이 바꾼 사실을 반영하지 못해 거짓이 된 자기-서술(스크립트 docstring) 1건, (3) 완료된 후속 리뷰 라운드를 반영하지 못한 plan 체크리스트 1건이 WARNING으로 남는다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `source-scan.ts`의 `enclosingScopeName`에 신설된 "함수형 변수 우선" 분기가 현재 두 소비 가드의 어떤 fixture로도 관측되지 않는 죽은 코드다. `const isFn = ...` 계산을 `false`로 뮤테이션해도 관련 스위트 24/24 GREEN(리뷰 종료 전 원복 확인). 우선순위를 반대로 바꾸거나 조건을 깨도 아무도 모른다 | `codebase/backend/src/common/__test-utils__/source-scan.ts:118-123` | `endpoint-path-save.fixture.ts` 또는 `user-relation-load.fixture.ts`에 모듈 스코프 `const helper = () => repo.save(...)` 형태를 추가하고, 결과 키가 `#helper`로 잡히며 function-var 분기가 plain-var 분기보다 우선함을 단언하는 케이스를 보탤 것 |
| 2 | 아키텍처 | "안전한 User 투영"(`{id, email, name}`) 형태가 서로 다른 바운디드 컨텍스트에 이름 없는 리터럴로 또 중복됐다 — `workflow-versions.service.ts`에 이미 이름 있는 SoT(`CREATOR_PROJECTION`, DTO 대조 테스트 보유)가 존재하는데도 재사용하지 않고 인라인으로 다시 적었다. `notifications.service.ts`(`{id, email}`)까지 포함하면 이미 세 번째 변형 — 이 PR 자신이 다른 곳(`pg-error.ts` SoT 통합)에서 실천한 원칙과 반대 방향 | `codebase/backend/src/modules/workspaces/workspaces.service.ts:225-231` vs `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:92-96` | `CREATOR_PROJECTION`을 `workflow-versions` 모듈 밖(예: `common/db/user-projection.ts`)으로 승격해 `SAFE_USER_PROJECTION` 같은 공용 상수로 export하고 `workspaces.service.ts`(및 향후 콜사이트)가 import하도록 정리 |
| 3 | 요구사항 / 부작용 | 이번 배치(B-1)가 `_cmd_typecheck_ratchets()`를 `run-test.sh build` 단계 안으로 편입시켰는데(`PROJECT.md`는 정확히 갱신됨), 정작 그 대상 스크립트 두 개 자신의 "로컬에서 돌리는 법" docstring은 여전히 `.claude/tools/run-test.sh`의 4단계에는 **없다**(그 wrapper는 lint/unit/build/e2e 고정)"라고 적고 있어 이번 배치 자신이 만든 사실과 정면 모순되는 거짓 문장이 됐다 | `scripts/check-backend-typecheck-ratchet.py:35`, `scripts/check-frontend-typecheck-ratchet.py:38` (대상 파일 — 이번 diff는 이 두 파일을 건드리지 않음. 편입 지점은 `.claude/test-stages.sh:80-96`) | 두 스크립트의 해당 문장을 "2026-09-08부터 `run-test.sh build`(`_cmd_typecheck_ratchets`) 안에서 자동 실행된다. 개별 실행은 아래 명령을 직접 호출" 형태로 정정(`PROJECT.md`/`source-scan.ts`가 쓴 취소선+정정 관례 준용) |
| 4 | 문서화 | `plan/in-progress/spec-followups-batch-b.md` 체크리스트의 `/ai-review` 항목이 1라운드(`12_53_08`, Warning 1)만 인용하고, 코드가 stale이 되어 실행·해소된 2라운드(`review/code/2026/09/08/13_34_28`, Critical 0·Warning 2, `RESOLUTION.md` 동반 커밋)를 반영하지 않는다 | `plan/in-progress/spec-followups-batch-b.md` `## 체크리스트` 섹션 | 해당 줄에 `13_34_28` 라운드(Warning 2, RESOLUTION.md) 인용을 추가하거나 "2라운드 — fix→stale 루프로 재실행" 한 줄 보충 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 / 데이터베이스 / 성능 / API 계약 | `WorkspacesService.listMembers`를 JS 매핑 검출에서 DB `select` 투영 강제로 전환 — `User` 민감 컬럼이 애초에 로드되지 않게 됨. `relations`+`select` 조합 유지로 N+1 없음, 응답 wire 계약(6키) 불변, 인가 체크(`assertMembership`) 무변경 | `codebase/backend/src/modules/workspaces/workspaces.service.ts:213-232` | 조치 불요(긍정적 변경) |
| 2 | 유지보수성 | 위 `listMembers`의 `select` 필드 목록과 `.map()` 반환 필드 목록이 컴파일러 강제 없이 두 자리에 손으로 동기화돼야 한다 — 신규 테스트도 `select.user` 서브셀렉트만 단언하고 top-level 필드는 단언하지 않아 드리프트 방향 일부 미검증 | `codebase/backend/src/modules/workspaces/workspaces.service.ts:225-240` | 다음에 필드 추가 시 `select` 키를 `.map()`의 소스로 삼거나 테스트 단언 범위를 top-level까지 확장 |
| 3 | 보안 / 데이터베이스 / 부작용 | 전역 예외 필터의 unique-violation 판정을 SoT(`pg-error.ts`)로 통합해 raw 표면(`err.code`, `QueryFailedError`로 안 감싸인 형태) 23505도 전역적으로 409로 정확히 매핑 — `@Catch()` 전역 등록이라 이론상 모든 라우트에 영향을 주는 구조적 확장이지만 실측 blast radius 0, 응답 메시지는 고정 문자열이라 정보 노출 증가 없음, 양방향 회귀 테스트로 고정 | `codebase/backend/src/common/filters/http-exception.filter.ts:70` | 조치 불요(의도된 버그 수정, 개선) |
| 4 | 테스트 | 신규 AST 가드(`endpoint-path-conflict-wrap-guard.ts`)의 리시버 매칭이 `this.triggerRepository` 형태만 인식 — 로컬 destructuring 별칭(`const {triggerRepository} = this`) 경유 호출은 스캔에서 조용히 빠질 수 있다(현재 실제 소스엔 해당 패턴 없어 false negative 없음) | `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts:140` | fixture에 별칭 경유 형태를 "알려진 사각지대"로 명시 추가 |
| 5 | 아키텍처 / 유지보수성 | 신규 AST 가드가 형제 가드(`user-entity-exposure-guard.ts`)의 중복 스코프-이름 판정 로직을 `source-scan.ts`의 `enclosingScopeName` 공용 함수로 승격 — 판정 순서를 문서화하고 이전 두 구현의 불일치까지 주석에 남김(단, 위 WARNING#1이 그 신규 분기의 무검증을 지적) | `codebase/backend/src/common/__test-utils__/source-scan.ts:101-127` | 조치 불요(승격 자체는 긍정적) |
| 6 | 의존성 / 아키텍처 | `integration-oauth.service.ts`의 손-작성 constraint 추출(2곳 중복)을 `pgErrorConstraint()` 헬퍼로 교체 — 동작 동일, `typeorm` 직접 의존(`http-exception.filter.ts`의 `QueryFailedError` import)도 제거되어 결합도 감소 | `codebase/backend/src/modules/integrations/integration-oauth.service.ts:1268-1274,1822-1828` | 조치 불요 |
| 7 | 보안 / 부작용 | `tsconfig.build.json`에 `**/__test-utils__/**` exclude 추가 — 프로덕션 dist에 실리던 죽은 테스트 헬퍼 코드 차단. 전수 grep으로 프로덕션 코드의 역참조 부재 확인(안전 검증 완료) | `codebase/backend/tsconfig.build.json:20-28` | 조치 불요 |
| 8 | API 계약 / 요구사항 | 신규 e2e(`webhook-trigger.e2e-spec.ts` B4)가 실 Postgres UNIQUE 제약 경로에서 §1.10 `TRIGGER_ENDPOINT_PATH_CONFLICT` 계약(코드·`details` 객체·드라이버 원문 비노출)을 line-level로 정확히 검증 — mock-실물 갭을 메움. 다만 순차 요청이라 진짜 동시(`Promise.all`) 레이스 분기까지 확정 검증하지는 않음(목적 범위 밖) | `codebase/backend/test/webhook-trigger.e2e-spec.ts:181-213` | 조치 불요(현재 목적엔 충분); 향후 진짜 동시 레이스 케이스는 별도 추가 검토 가능 |
| 9 | 환경/워크트리 (코드 결함 아님) | 리뷰 도중 여러 reviewer(documentation, maintainability)가 독립적으로 `codebase/backend/src/common/__test-utils__/source-scan.ts`에 본인들이 만들지 않은 미커밋 수정(`const isFn = false; // MUTATION: disable functionVar branch`)을 관측했다 — 다른 병렬 reviewer의 뮤테이션 검증(WARNING#1 근거 확보 과정) 잔여물로 추정, 각 reviewer가 원복 없이 기록만 남김. 또한 user_guide_sync reviewer는 `plan/in-progress/spec-followups-batch-b.md`에 본인이 만들지 않은 미커밋 수정(체크박스 open 건수 정정)을 관측 | (해당 파일들, diff 범위 밖) | 오케스트레이터가 세션 종료 전 `git status --short`로 잔여 뮤테이션/미의도 수정이 없는지 최종 확인 권장 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | `pg-error.ts` SoT 통합·`listMembers` DB 투영 모두 정보 노출 없이 방어 심화. 시크릿/인젝션 없음 |
| performance | NONE | `listMembers` DB 투영은 성능 개선. `resolveBuildFileNames()` 반복 호출은 캐싱으로 해소됨(잔여 1건 무시 가능) |
| architecture | LOW | "안전한 User 투영" SoT 미재사용(WARNING#2). 그 외 리팩터는 응집도 개선 방향 |
| requirement | LOW | 핵심 8개 항목(B-1~B-8) 기능 요구사항 전부 spec과 line-level 일치. ratchet 스크립트 docstring 모순(WARNING#3) |
| scope | NONE | 82개 파일 전체가 plan(B-1~B-8) + 2회 리뷰 응답으로 설명됨. 스코프 이탈 없음 |
| side_effect | LOW | ratchet docstring 모순(WARNING#3, requirement와 동일 근거). 예외 필터 판정 확대는 blast radius 0 확인 |
| maintainability | LOW | `listMembers` select/map 비강제 동기화(INFO#2). JSDoc 누적 추세 관찰 |
| testing | MEDIUM | `enclosingScopeName` 신규 분기 무검증(dead code, WARNING#1). 그 외 테스트 설계는 견고 |
| documentation | LOW | plan 체크리스트가 2라운드 리뷰 미반영(WARNING#4). 그 외 문서-코드 일치도 높음 |
| dependency | NONE | 신규 외부 의존성 없음. 내부 결합도만 SoT 방향으로 개선 |
| database | NONE | 마이그레이션 변경 없음, N+1/인젝션 없음, `listMembers` 투영은 개선 |
| concurrency | NONE | 레이스 백스톱 패턴(사전체크+DB UNIQUE) 불변, 판정 표면만 확장. 데드락/블로킹 없음 |
| api_contract | LOW | wire 계약 불변(6키, 개명은 내부 타입). 예외 필터 상태코드 확장은 문서화된 의도된 변경 |
| user_guide_sync | NONE | doc-sync-matrix 21개 trigger 매칭 0건 — 유저 가이드 동반 갱신 대상 아님 |

## 발견 없는 에이전트

해당 없음 — 전 14개 에이전트가 최소 1건 이상의 WARNING/INFO를 보고했다(순수 "문제 없음"만 보고한 에이전트 없음, 다만 상당수는 위험도 NONE으로 결론).

## 권장 조치사항

1. (WARNING#1, MEDIUM) `enclosingScopeName`의 "함수형 변수 우선" 분기를 실제로 검증하는 fixture 케이스를 추가한다 — 현재 24/24 GREEN인 채로 죽은 코드다.
2. (WARNING#2) `CREATOR_PROJECTION`을 공용 모듈로 승격해 `workspaces.service.ts`의 인라인 User 투영 리터럴을 대체하고, `notifications.service.ts`의 세 번째 변형도 함께 정리를 검토한다.
3. (WARNING#3) `scripts/check-{backend,frontend}-typecheck-ratchet.py`의 "wrapper 4단계에는 없다" docstring을 이번 배치가 만든 사실에 맞게 정정한다.
4. (WARNING#4) `plan/in-progress/spec-followups-batch-b.md` 체크리스트에 2라운드 `/ai-review`(`13_34_28`) 결과를 반영한다.
5. (운영) 세션 종료 전 `git status --short`로 다른 병렬 reviewer가 남긴 뮤테이션/미의도 수정(`source-scan.ts`, plan 파일) 잔여 여부를 최종 확인하고 필요 시 정리한다.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 14명 reviewer 실행됨(forced 화이트리스트 documentation, maintainability, requirement, scope, security, side_effect, testing 7명 포함, 전원 결과 확보 확인. "forced인데 결과 없음" 케이스 없음).
