# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 3건은 모두 완결성/테스트 커버리지 관점의 잔여 갭(런타임 동작·보안 영향 없음)이며, 핵심 변경(Swagger DTO nullable/presence 계약 9곳 정합화 + 신규 AST 가드)은 spec(§5.4)·서비스 코드와 일치함을 9개 reviewer 전원이 각자 재확인했다. forced 화이트리스트(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | "경로 정규화 8곳 전부 통일" 완결 주장이 실제와 다르다 — `engine-error-code-anchor-guard.ts` 는 `toPosixRelative` 미적용 상태로 여전히 남아 있다(9번째 미정규화 자리). 직전 라운드가 바로 이 파일을 "이미 정규화된 형제"로 잘못 인용해 W3 대상에서 제외했던 것이 원인. 영향은 낮음(POSIX-only CI, 값 미단언) | `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts:170,196` | `toPosixRelative(repoRoot, abs)` 로 통일하거나, `source-scan.ts`/`RESOLUTION.md` 의 "8곳 전부" 문구를 "grep 패턴 기준 8곳"으로 좁혀 완결로 오독되지 않게 정정 |
| 2 | scope | 브랜치 주제(Swagger DTO 계약 정정)와 무관하고, frontmatter 가 `spec-frontmatter-status-migration-027c17` 를 소유 worktree 로 명시한 plan 문서가 **다른 worktree**(`plan-in-progress-items-b0c80b`)에서 편집된 채 diff 에 남아 있다. 2회 리뷰 라운드(1R·2R)에서 INFO 로 지목됐음에도 분리되지 않았다 | `plan/in-progress/execution-engine-residual-gaps.md:2,55-69` (커밋 `8691a2f25`) | 해당 블록을 별도 커밋으로 분리해 소유 worktree 로 옮기거나 frontmatter `worktree:` 필드를 현재 worktree 로 갱신. 최소한 PR 설명에 "무관한 별도 정정" 명시 |
| 3 | testing | `temp-fixture.spec.ts` 의 "async 콜백이 실패해도 tmpdir 은 그대로 지워진다" 테스트가 실제로는 reject 를 한 번도 일으키지 않는다 — `async` 콜백은 성공 반환도 항상 Promise 로 감싸이므로 바로 위 테스트와 동일한 "성공적으로 resolve" 경로를 이름만 바꿔 재검증할 뿐. 실제 reject 시 `withFiles` 가 "동기 콜백만 지원" 이라는 엉뚱한 에러로 throw 하면서 동시에 원인 에러가 아무도 구독하지 않는 unhandled promise rejection 으로 새는 경로가 무방비 상태(node 재현으로 직접 확인) | `codebase/backend/src/common/__test-utils__/temp-fixture.spec.ts:63-72`, 구현: `temp-fixture.ts:56-68` | 실제로 reject 하는 async 콜백(`async () => { throw ... }`) 케이스를 별도로 추가해 unhandled rejection 여부를 명시적으로 검증. 필요시 `result.then(undefined, () => {})` 로 discard 전에 rejection 핸들러 부착 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | DTO `nullable`/`required` 데코레이터 정정 8곳은 `class-validator` 런타임 검증과 무관한 순수 OpenAPI 문서 변경 — 인증/인가·입력 검증 경로 불변 | `background-run-response.dto.ts:43,46,49-56,58-65,67-74,84-88,142-143,145-149` | 없음 |
| 2 | security / side_effect / api_contract | `llmConfigId?: string` → `string \| null` 타입 확장은 기존 `@IsOptional()`/서비스 코드(`workflow-assistant-session.service.ts:91,107`) 가 이미 처리하던 런타임 동작을 뒤늦게 타입에 반영한 것 — 신규 인가 우회·호출자 영향 없음 | `create-assistant-session.dto.ts:19` | 없음 |
| 3 | security | 신규 repo-guard(`swagger-dto-contract-guard.ts`)는 저장소 자기 소스만 읽는 CI/테스트 전용 정적 분석기 — 인젝션·경로 탐색 벡터 없음. 하드코딩 시크릿 전수 grep 0건 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` 외 | 없음 |
| 4 | side_effect | 공유 tmpdir 헬퍼 `withFiles` 가 discard 하는 thenable 에 rejection 핸들러를 붙이지 않아, 향후 실제 async 소비처가 생기면 무관한 다음 테스트로 전이되는 unhandled rejection 여지가 남음(현재 소비처 전부 동기, 실사례 0건) | `codebase/backend/src/common/__test-utils__/temp-fixture.ts:57-64` | `result.then(undefined, () => {})` 로 discard 전 핸들러 부착. 급하지 않음 |
| 5 | side_effect | `withFiles` 가 픽스처 파일명을 검증 없이 `path.join` 에 사용 — 이론상 `..`/절대경로 키로 tmpdir 밖에 쓰기 가능(현재 전 호출부 하드코딩 리터럴이라 실사례 0건) | `temp-fixture.ts:49-55` | 필요 시 `name.includes('..') \|\| path.isAbsolute(name)` 가드 추가. 급하지 않음 |
| 6 | side_effect | 공유 승격 과정에서 tmpdir prefix 기본값이 `nullable-guard-` → `repo-guard-` 로 조용히 바뀜(비정상 종료 시 잔존 디렉터리 이름 변경). 이 prefix 를 참조하는 별도 정리 스크립트 없음 확인 | `temp-fixture.ts:47`, `nullable-type-lie-cast.spec.ts:41-51` | 조치 불요 |
| 7 | side_effect / api_contract | `background-run-response.dto.ts` 8필드의 OpenAPI `required` 가 `false→true` 로 전환 — 런타임 부작용 없으나 엄격한 코드제너레이터 소비자에게는 관측 가능한 계약 변경. CHANGELOG 에 방향·영향 명시 완료 | `background-run-response.dto.ts` 8필드 | 조치 불요(이미 문서화). 외부 SDK 소비자 실재 시 배포 노트 병기 권장 |
| 8 | maintainability | 동일 주석("크로스플랫폼 정규화 — 리뷰 W3, 세 자리 동시 수정.")이 한 파일 안에서 3회 반복 | `nullable-type-lie-cast-guard.ts:49-50,123,256` | 첫 등장에만 전체 근거, 나머지는 참조로 축약 |
| 9 | maintainability | 신규 파일이 이미 export 된 `SRC_ROOT` 상수를 재계산해 두 번째 사본 생성 — 이 PR 이 바로 옆에서 같은 클래스 중복(`toPosixRelative` 8곳)을 없앤 직후라는 점에서 대조적 | `swagger-dto-contract.spec.ts:43` vs `nullable-type-lie-cast-guard.ts:22`(export) | `nullable-type-lie-cast-guard.ts` 의 `SRC_ROOT` import 로 교체 |
| 10 | maintainability | `findSwaggerContractMismatches` 가 AST 순회+presence 축+null 축 판정을 함께 맡아 중첩 4단계 — 향후 3번째 축 추가 시 계속 길어지는 형태 | `swagger-dto-contract-guard.ts:113-176` | 축별 순수 판정 함수로 분리(3번째 축이 실제로 생길 때) |
| 11 | testing / api_contract | `readBooleanOption` 이 non-literal boolean(상수 참조)을 인식 못해 조용히 미판정 — 저장소 실사례 0건, 기지 갭 재확인 | `swagger-dto-contract-guard.ts:58-74` | 기존 처분(급하지 않음) 유지 |
| 12 | testing | `hasTopLevelNull` 이 `ParenthesizedTypeNode` 를 언랩하지 않아 `(string \| null)` 형태에서 위음성 — 기지 갭 재확인 | `swagger-dto-contract-guard.ts:83-90` | 기존 처분 유지 |
| 13 | documentation | `llmConfigId` 설명 문구가 명시적 `null` 케이스를 언급하지 않음 — 2라운드 연속 defer, 자매 DTO(`update-assistant-session.dto.ts`)는 이미 명시 | `create-assistant-session.dto.ts:13` | 자매 DTO 문구로 통일(급하지 않음) |
| 14 | documentation | `nullable-type-lie-cast.spec.ts` 인라인 주석이 "모듈 스코프의 `withFiles`"라는 옛 표현 유지 — 바로 위 JSDoc 은 공유 헬퍼 위임을 정확히 설명하는데 어휘가 어긋남 | `nullable-type-lie-cast.spec.ts:124` | "공유 헬퍼의 `withFiles`(import)"로 한 단어 수정 |
| 15 | api_contract | DTO 스키마 교정 9곳에 API 버전 분기·헤더 마킹 없음 — 계약을 좁히는 게 아니라 정합화이므로 필수는 아님 | DTO 2파일 | 조치 불요 |
| 16 | api_contract | §5.4(응답 형식 절) 규칙을 요청 DTO 인 `llmConfigId` 에 문면 그대로 적용하는 것은 스코프 밖 — CHANGELOG/plan 이 이미 인지하고 별도 근거로 정당화, 후속 작업 등재됨 | `spec/5-system/2-api-convention.md:115,175-195` | 이미 추적 중 |
| 17 | user_guide_sync | `backend-api-change` 매트릭스 행이 DTO 2파일에 glob 매칭되나, 대상 user-guide MDX(`02-nodes/logic.mdx`, `ai.mdx`)가 required/nullable 세부를 서술하지 않아 실질 staleness 없음 | `02-nodes/logic.mdx`, `ai.mdx` | 조치 불요. 향후 응답 shape 변경(필드 추가/제거) 시 재대조 |
| 18 | side_effect / documentation | 리뷰 세션 도중 이 리뷰들이 만들지 않은 워킹트리 뮤테이션을 관측 — `review/consistency/2026/09/04/11_33_21/SUMMARY.md` 가 diff 상 버전과 다른 내용으로 미커밋 상태, 최소 2~3 라운드에 걸쳐 지속. 코드 결함 아닌 병렬 세션 간섭으로 추정 | `review/consistency/2026/09/04/11_33_21/SUMMARY.md` | 오케스트레이터가 이 파일의 최종 의도된 내용을 확인·정리 권장 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 시크릿 없음, DTO 변경은 순수 문서 변경, 신규 가드는 CI 전용이라 공격 표면 없음 |
| requirement | LOW | 핵심 9곳 정정이 spec §5.4·서비스 코드와 line-level 일치 확인(재현 GREEN); WARNING: 경로 정규화 "8곳 전부" 완결 주장에 9번째 미정규화 자리 누락 |
| scope | LOW | 핵심 변경은 요청 범위와 정확히 일치; WARNING: 무관 plan 문서(타 worktree 소유)가 2회 지적에도 미분리 |
| side_effect | LOW | tmpdir 쓰기 격리·정리 확인, 전역상태/네트워크 도입 없음; INFO 6건(thenable rejection 미처리 등) + 워킹트리 이상 관측 |
| maintainability | LOW | 경로 정규화·tmpdir 픽스처 추출 품질 높음; INFO 3건(반복 주석, 상수 중복, 함수 중첩) |
| testing | LOW | 12 suites/218 tests + 별도 4 suites/94 tests 전부 PASS 재현; WARNING: async reject 시나리오 미검증 테스트 1건 |
| documentation | LOW | 1R/2R WARNING 전량 조치 확인(경로 정규화, canary, line/file 검증); INFO 2건(defer 지속) + 워킹트리 이상 관측 |
| api_contract | LOW | DTO 계약 정정이 §5.4·wire 동작과 일치, 이전 WARNING(정규화 누락) 해소 확인; INFO 5건 |
| user_guide_sync | NONE | 매트릭스 21행 중 1건만 glob 매칭, 실사 결과 실질 staleness 없음 |

## 발견 없는 에이전트

없음 — 전 에이전트가 최소 1건 이상의 INFO/WARNING 을 보고했다(순수 "문제 없음" 판정은 security·user_guide_sync 이나 이들도 확인 근거를 INFO 로 기록).

## 권장 조치사항

1. `execution-engine-residual-gaps.md` plan 문서 수정(커밋 `8691a2f25`)을 이 브랜치에서 분리하거나 frontmatter `worktree:` 필드를 현재 worktree 로 갱신 — 2회 지적에도 미조치된 소유권 위반 (scope WARNING)
2. `engine-error-code-anchor-guard.ts:170,196` 에 `toPosixRelative` 적용 또는 "경로 정규화 8곳 전부" 완결 문구를 "grep 패턴 기준"으로 정정 — 완전성 주장과 실제 사이 괴리 해소 (requirement WARNING)
3. `temp-fixture.spec.ts` 의 "async 콜백이 실패해도" 테스트를 실제 reject 시나리오로 교체해 unhandled rejection 경로를 명시적으로 검증 (testing WARNING)
4. (급하지 않음) `withFiles` discard thenable 에 rejection 핸들러 부착, `SRC_ROOT` 중복 제거, `llmConfigId`/모듈 스코프 주석 문구 통일 등 INFO 항목은 다음 관련 파일 편집 시 함께 반영
5. `review/consistency/2026/09/04/11_33_21/SUMMARY.md` 의 미커밋 워킹트리 상태(diff 버전과 상이)를 오케스트레이터가 확인·정리

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (9명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(DTO 데코레이터·AST 가드·tmpdir 픽스처) 와 무관 |
  | architecture | router 판단상 비대상(단, 1R/2R 에서 이미 아키텍처 관점 커버됨) |
  | dependency | 신규 외부 의존성 추가 없음 |
  | database | DB 스키마·쿼리 변경 없음 |
  | concurrency | 신규 동시성 로직 없음(기존 tmpdir 격리 패턴 유지) |