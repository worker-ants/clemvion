# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/기능 결함 없음. `workspace-id-fixtures.ts` 에 값 유일성 런타임 가드(`assertAllUnique` + `ALL_WS`)를 신설하고 전용 spec 으로 충분히 검증했으며, nil-UUID 캐너리 근거 문단을 `uuid.ts` docstring 한 곳(SoT)으로 통합해 3중 중복을 해소한 개선 PR. 모든 지적은 INFO 수준이며, 실행/타입체크 실측(jest 2 suites/14 tests PASS, `tsc --noEmit` 0 errors)까지 확인됨. forced whitelist(5명) 전원 결과 확보 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing/maintainability | 소스 텍스트 정규식 매칭으로 "로드 시점 실제 호출"을 검증하는 방식 — 호출부가 여러 줄로 개행되는 등 포맷이 바뀌면 허위 RED 가 날 수 있음(fail-loud 라 위험은 낮음). 이미 주석으로 트레이드오프 명시, 뮤테이션 테스트로 로드베어링임 실증됨 | `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.spec.ts:36-51` (정규식 `:47`) | 현재로선 문제 없음. 향후 허위 RED 발생 시 정규식을 개행 허용으로 넓히거나 TS AST 파서 전환 고려 |
| 2 | testing | `assertAllUnique` 다중 중복 그룹(3개 이상 값 겹침) 시나리오 미검증 — 로직이 단순(`Set` 기반)해 실질 위험 낮음 | `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.spec.ts:23-29` | 필수 아님. 여유 있을 때 전원 중복(`['a','a','a']`) 경계값 1케이스 추가 고려 |
| 3 | testing | `uuid.spec.ts` 변경은 주석(docstring)만 재작성한 순수 문서 정리 — 실제 `expect` 단언 코드는 불변, 회귀 위험 없음 | `codebase/backend/src/common/utils/uuid.spec.ts:49-58` | 없음 (확인용 기재) |
| 4 | requirement | plan 문서 서술("메시지가 개수를 말하므로 어느 쌍이 겹쳤는지 바로 좁혀진다")이 실제 에러 메시지 내용(고유/전체 개수만 담고 어느 쌍인지는 미포함)을 살짝 과장 | `plan/in-progress/auth-guard-reflection-hardening.md:307` (참조: `workspace-id-fixtures.ts:82-84`) | 코드 동작 영향 없음. 다음에 이 문단을 만질 기회에 "개수까지만 좁혀준다"로 완화 권고 |
| 5 | scope/side_effect | plan frontmatter `worktree:` 필드가 `auth-guard-reflection-hardening-9c31f2` → `harness-changeset-exclusion` (현재 세션 실제 작업 디렉터리와는 일치)로 변경 — 작업 주제와 무관해 보여 plan 소유권 추적 도구 혼동 소지 | `plan/in-progress/auth-guard-reflection-hardening.md:3` | 원 worktree 회수 후 후속 항목만 별도 worktree 에서 처리하는 패턴이 컨벤션상 허용되는지 확인 권장. 코드 diff 자체엔 영향 없음 |
| 6 | side_effect | 모듈 최상위(top-level)에서 `assertAllUnique(ALL_WS)` 즉시 호출 — "부작용 없는 상수 모듈"에서 "import 시점 throw 가능 모듈"로 계약 변경. 값 충돌 시 소비 스위트 3개(`workspace.decorator.spec.ts`·`roles.guard.spec.ts`·`workspace-context.util.spec.ts`) 동시 실패. 의도된 설계이며 문서화·뮤테이션 테스트로 검증됨 | `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts:88` (함수 정의 `:73-86`, `ALL_WS` `:54-71`) | 추가 조치 불필요. `__test-utils__` 가 프로덕션 코드에서 잘못 import 되지 않는다는 불변식만 계속 추적(이미 plan 에 tsconfig.build.json exclude 검토 항목 등재됨) |
| 7 | side_effect | `ALL_WS` 는 `as const` 로 타입 레벨 readonly 일 뿐 런타임 `Object.freeze` 없음 — 소비 코드가 이론상 배열 변조 가능. 현재 사용 패턴(읽기 전용)에서 실질 위험 낮음 | `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts:63-71` | 필요시 `Object.freeze(ALL_WS)` 고려 가능하나 현재 범위에서 필수 아님 |
| 8 | maintainability | 픽스처 파일명이 spec 코드에 문자열 리터럴로 하드코딩(`join(__dirname, 'workspace-id-fixtures.ts')`) — 리네임 시 IDE 자동 추적 안 됨(단, 리네임되면 `ENOENT` 로 즉시 fail-loud) | `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.spec.ts:40-41` | 현재 규모(파일 1개)에서는 문제 삼을 수준 아님. 참고용 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | LOW | 정규식 매칭 방식의 fail-loud 취약성(INFO), 다중 중복 그룹 미검증(INFO). 신규 spec 전반의 커버리지·격리는 우수 |
| requirement | NONE | plan 문서 정밀도 INFO 1건 외 기능/스펙 불일치 없음. jest·tsc 실측 통과 확인 |
| scope | NONE | 변경 파일 4개가 plan 이 명시한 두 후속 항목과 정확히 대응, 범위 밖 변경 없음. plan `worktree:` 필드 이질감(INFO) |
| side_effect | LOW | import-time throw 신설(의도된 설계, 검증됨), plan `worktree:` 필드 변경(INFO), `ALL_WS` non-frozen(INFO) |
| maintainability | LOW | 정규식 매칭 테스트의 포맷 취약성(INFO), 파일명 하드코딩(INFO). 전반적으로 중복 제거·SoT 통합 방향으로 유지보수성 개선 |

## 발견 없는 에이전트

없음 — 5개 reviewer 모두 최소 1건 이상의 INFO 를 보고했으나 Critical/WARNING 은 전원 0건.

## 권장 조치사항
1. (선택) `assertAllUnique` 중복 그룹 3개 이상 경계값 테스트 1케이스 추가 — 필수 아님.
2. (선택) plan 문서 `:307` 문구를 "개수까지만 좁혀준다"로 완화 — 코드 동작 영향 없음.
3. (확인) plan frontmatter `worktree:` 필드가 `auth-guard-reflection-hardening-9c31f2` → `harness-changeset-exclusion` 으로 바뀐 것이 팀 컨벤션상 허용되는 cross-worktree 후속 작업 패턴인지 확인 — plan 소유권 추적 도구 혼동 방지 차원.
4. (선택) `ALL_WS` 에 `Object.freeze` 적용 고려 — 현재 위험 낮아 필수는 아님.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 reviewer(testing, requirement, scope, side_effect, maintainability) 5명 강제 실행(router_safety forced). 제외된 reviewer 없음. forced 5명 전원 결과 확보됨 — 화이트리스트 미이행 없음.