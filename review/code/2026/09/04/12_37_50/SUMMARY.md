# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 0건. WARNING 1건(`testing`): 이번 배치가 새로 배선한 `toPosixRelative` 호출 3개 지점이 인자 순서 뮤테이션에도 전부 GREEN(18/18·12/12·31/31, 실측 완료)이라 "vacuous positive-only 테스트" 결함 클래스가 재발했다. 그 외 전 항목은 INFO 이하이며, forced whitelist(7명) 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스팅 | 신규 배선된 `toPosixRelative` 호출 3개 지점 — 인자 순서가 뒤바뀌어도 어떤 테스트도 실패하지 않는다. 결과가 `expect(...).toEqual([])`(위반 0건, happy-path)로만 단언돼 `.file` 값 자체가 관측되는 자리가 없다. 뮤테이션 실측(백업 후 편집→테스트→원복): `audit-action-binding.spec.ts` 18/18 GREEN, `websocket-events.types.spec.ts` 12/12 GREEN, `nullable-type-lie-cast-guard.ts` 3곳 동시 31/31 GREEN | `codebase/backend/src/repo-guards/__tests__/audit-action-binding.spec.ts:64`, `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:312`, `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:52,125,258` | 각 가드에 인위적 위반 1건을 발생시켜 `.file` 값을 `toContain`/`toMatchObject`로 직접 단언하는 캐너리를 최소 1개씩 추가(`swagger-dto-contract.spec.ts`의 `[대조군]` 패턴, 이미 이 배치 자신이 세운 인프라를 재사용) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API 계약 / 보안 / 부작용 | `@ApiPropertyOptional`→`@ApiProperty({nullable:true})` 전환(8필드) 및 `required: false→true` 는 OpenAPI 문서 메타데이터만 변경 — `class-validator`/`class-transformer` 런타임 검증·직렬화 로직 무변화, 문서가 실제 wire 동작(항상 존재+null 가능)을 뒤늦게 따라잡는 방향이라 breaking 아님. `CHANGELOG.md`로 공지 완료 | `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts` (finishedAt/durationMs/inputData/outputData/error/nextCursor/completedAt) | 없음(개선 확인) |
| 2 | API 계약 / 보안 | `llmConfigId` 타입 확장(`string?`→`string\|null`)은 `@IsOptional()`이 이미 null/undefined 모두 검증 스킵하므로 런타임 동작 무변화. 서비스 레이어(`dto.llmConfigId ?? null`)가 이미 이 타입을 전제로 짜여 있었음을 확인 | `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts:19` | 없음 |
| 3 | 유지보수성 / API 계약 / 테스팅 | `readBooleanOption`이 boolean 리터럴(`TrueKeyword`/`FalseKeyword`)만 인식 — 상수 참조(`nullable: SOME_CONST`)로 쓰이면 조용히 미판정. 저장소 실측(1,096개 필드) 전부 리터럴이라 현재 실사례 0건. 이전 라운드부터 이어지는 미조치 잔여 갭 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:58-74` | 급하지 않음 — 리터럴 아닌 인자를 만나면 별도 카테고리로 표시하는 방어 고려 |
| 4 | 유지보수성 / 테스팅 / API 계약 | `hasTopLevelNull`이 `ParenthesizedTypeNode`를 언랩하지 않아 `(T \| null)`처럼 괄호로 감싼 최상위 유니온에서 null 항을 놓칠 수 있음(위음성). 실사례 0건, 이전 라운드부터 이어지는 미조치 잔여 갭 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:83-90` | 여유 있을 때 `ts.isParenthesizedTypeNode` 언랩 + 캐너리 테스트 추가 |
| 5 | 유지보수성 | `SRC_ROOT` 계산식이 `nullable-type-lie-cast-guard.ts`가 이미 `export`한 상수를 두고 세 번째 사본으로 재계산됨 — 이 PR이 "사본 5개 없앤 직후" 원칙을 `temp-fixture.ts` 추출엔 적용했지만 `SRC_ROOT`엔 적용 안 함 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:43` | `nullable-type-lie-cast-guard.ts`의 export된 `SRC_ROOT`를 import하거나, 세 번째 사본이 또 생기면 `source-scan.ts`로 단일 출처화 |
| 6 | 유지보수성 | `findSwaggerContractMismatches` 안 변수명 `sf`가 형제 가드 관례(`sourceFile`)와 다름 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:46,62,119,131,135-137,140,173` | 급하지 않음, 새 가드 추가 시 통일 고려 |
| 7 | 유지보수성 | 검증 불가능한 하드코딩 수치(1,096/18/1)가 재현 명령 없이 docstring에 박힘 — 같은 디렉터리의 `nullable-type-lie-cast-guard.ts`는 이미 "재현 명령을 남긴다"는 관례를 세워 두었는데 이번엔 미적용 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:109-111` | 숫자 옆에 재현 명령(grep 등) 병기 또는 정성적 표현으로 낮추기 |
| 8 | 유지보수성 | presence 불일치 판정식(`effectiveRequired === tsOptional`)이 이름 없는 동치 비교로만 표현돼 부호가 뒤집힌 채 읽힘(같으면 불일치) | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:144` | 이름 붙이거나 인라인 주석 추가 |
| 9 | 유지보수성 | 판정 로직이 4단 중첩 클로저 안에 있고 presence/null 두 판정 블록의 `push({file,line,field,...})` 구조가 거의 동일 반복 — 현재 길이(~55줄)는 문제 없으나 3번째 axis가 추가되면 길어질 여지 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:118-168` | 급하지 않음, 축 추가 시 순수 판정 함수로 분리 고려 |
| 10 | 유지보수성 | `withFiles<T>` 타입 시그니처가 `T=Promise<X>` 추론을 허용해 async 콜백이 지원되는 것처럼 보이지만, 실제로 그 경로를 타면 값을 반환하지 않고 throw — 타입 계약이 런타임 계약보다 넓음. JSDoc이 함정을 설명하고 캐너리 테스트로 고정돼 있어 실질 위험은 낮음 | `codebase/backend/src/common/__test-utils__/temp-fixture.ts:44-69` | 급하지 않음, 제약 타입 또는 시그니처 옆 주석 명시 |
| 11 | 동시성 | `withFiles`는 콜백 **반환값**이 thenable인 경우만 async 오용을 감지 — 반환하지 않는 detached 비동기 부작용(예: 콜백 완료 후 발화하는 타이머)은 탐지 밖. 헬퍼가 스스로 선언한 "동기 콜백 전용" 계약의 원리적 경계이며 현재 소비처 2곳 모두 순수 동기 콜백이라 실제 발현 경로 없음 | `codebase/backend/src/common/__test-utils__/temp-fixture.ts:56-69` | 조치 불필요 — 향후 소비처가 detached 비동기 작업을 예약하지 않는지 코드 리뷰로 확인 |
| 12 | 문서화 | `llmConfigId` 설명 문구가 여전히 명시적 `null` 케이스를 언급하지 않음 — 자매 DTO `update-assistant-session.dto.ts`는 "null 전달 시 workspace default로 폴백"이라 명시해 대조됨. 4라운드 연속 같은 위치에서 defer(수렴 신호) | `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts:13` | 급하지 않음, 다음 편집 기회에 자매 DTO 문구로 통일 |
| 13 | 문서화 | "모듈 스코프의 `withFiles`" 인라인 주석이 옛 표현 유지 — 바로 위 JSDoc은 `sharedWithFixture`(공유 헬퍼 위임)로 정확히 설명하는데 이 줄만 로컬 함수라는 인상을 줌. 4라운드 연속 defer | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:124` | 사소함, "공유 헬퍼의 `withFiles`(import)"로 한 단어만 수정 |
| 14 | 부작용 | 테스트가 전역 `process` 객체에 `unhandledRejection` 리스너를 붙였다 뗌 — `try`/`finally` 페어링은 안전하게 확인됨. 이론상 같은 워커에서 `test.concurrent`가 도입되면 교차 관측 여지가 있으나 현재 저장소 어디에도 `test.concurrent` 미사용 | `codebase/backend/src/common/__test-utils__/temp-fixture.spec.ts` | 조치 불필요, `test.concurrent` 도입 시 재검토 |
| 15 | 유지보수성 / Scope | 경로 정규화(`toPosixRelative`) 적용 범위가 라운드를 거치며 1곳→4곳→8곳으로 확장됐고, 매 확장이 자기신고+검증(RESOLUTION.md)됐으며 최종 저장소 전수 재검색(`grep -rn "path\.relative("`) 결과 미정규화 잔여 0건으로 수렴 확인 | `codebase/backend/src/repo-guards/__tests__/*` 8개 파일 | 없음(이미 해소 확인) |
| 16 | 유저가이드 동반갱신 | `backend-api-change` 트리거(DTO glob)가 매칭됨 — target(a) swagger jsdoc은 diff 자체로 충족, target(b) user-guide 페이지 동반 갱신은 필드 단위 required/nullable을 서술하는 자리가 없어 비해당으로 판단(직전 2라운드와 동일 결론) | `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts`, `create-assistant-session.dto.ts` | 없음(갭 없음) |
| 17 | 부작용 / 요구사항 / 보안 / 문서화 / 동시성 (5개 reviewer 공통 관측) | 이 diff와 무관한 uncommitted 워킹트리 변경이 관측됨 — 최소 3라운드에 걸쳐 지속 | `review/consistency/2026/09/04/11_33_21/SUMMARY.md`(`git status --short` 상 `M`, +42/-25) | 이 리뷰 세션들이 만든 변경이 아님(누구도 이 파일을 Write하지 않았고 `git restore` 금지 원칙 적용). orchestrator/다음 세션이 committed 버전과 워킹트리 버전 중 최종 의도를 확인해 커밋하거나 정리할 것 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션·인증우회·시크릿·민감정보노출 등 실질 취약점 없음. DTO 데코레이터 변경은 문서 메타데이터만 |
| requirement | LOW | spec §5.4와 line-level 일치 재확인, 3R WARNING(경로 정규화 잔여 4곳)이 저장소 전수 재현으로 0건 해소 확인 |
| scope | NONE | 3라운드 연속 지적된 무관한 plan 편집이 최신 커밋에서 원복 확인. 핵심 주제 흔들림 없음 |
| side_effect | LOW | async reject 누출·경로 정규화·CHANGELOG 공지 등 이전 WARNING 전부 해소 확인. 신규 위험 없음 |
| maintainability | LOW | 경로 정규화 WARNING 완전 해소. 잔여는 전부 INFO(SRC_ROOT 중복, 변수명, 미검증 수치 등) |
| testing | **MEDIUM** | `toPosixRelative` 신규 배선 3곳이 vacuous 테스트(인자 순서 뮤테이션에도 전원 GREEN) — 뮤테이션 실측 완료 |
| documentation | LOW | 3R WARNING 3건 모두 커밋 메시지·RESOLUTION.md·코드 3곳에서 일관 해소 확인. 잔여 INFO 2건은 4라운드 수렴 신호 |
| concurrency | LOW | async reject 레이스·dangling promise 모두 닫힘. 잔여는 헬퍼의 의도된 설계 경계(detached 비동기 미탐지) |
| api_contract | LOW | 8필드 required 전환은 breaking 아님(문서 정합화). 잔여 갭(non-literal boolean, 괄호 유니온)은 실사례 0건 |
| user_guide_sync | NONE | 21개 trigger 중 `backend-api-change` 1건만 매칭, target(b) 비해당 — 갭 없음 |

## 발견 없는 에이전트

없음 — 전 에이전트(10명)가 최소 1건 이상의 INFO 수준 발견사항 또는 명시적 확인 사항을 기록했다.

## 권장 조치사항

1. **[WARNING 해소]** `toPosixRelative` 신규 호출 3개 지점(`audit-action-binding.spec.ts`, `websocket-events.types.spec.ts`, `nullable-type-lie-cast-guard.ts`)에 인위적 위반 1건을 발생시켜 `.file` 값을 직접 단언하는 캐너리 테스트를 추가한다 — `swagger-dto-contract.spec.ts`가 이미 세운 `[대조군]` 패턴과 각 가드의 기존 fixture 상수를 재사용하면 최소 비용으로 가능하다.
2. **[확인 필요]** `review/consistency/2026/09/04/11_33_21/SUMMARY.md`의 uncommitted 변경(5개 reviewer가 독립적으로 관측, 3라운드 이상 지속)의 출처와 최종 의도를 확인한다 — committed 버전(구 포맷)과 워킹트리 버전(신 포맷) 중 어느 쪽이 맞는지 정리 후 커밋하거나 원복할 것.
3. **[낮은 우선순위]** `readBooleanOption`의 non-literal boolean 미탐지, `hasTopLevelNull`의 괄호 유니온 미언랩 — 실사례 0건이나 이 가드가 계약 정합의 유일한 CI 관문이므로 여유 있을 때 방어 강화.
4. **[사소함, 급하지 않음]** `SRC_ROOT` 세 번째 사본 제거, `sf`→`sourceFile` 변수명 통일, docstring 하드코딩 수치에 재현 명령 병기, presence 판정식에 이름 부여, `llmConfigId`/`nullable-type-lie-cast.spec.ts` 주석 문구 정정(4라운드 연속 defer, 다음 편집 기회에 일괄 처리 권장).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, api_contract, user_guide_sync` (10명)
  - **제외**: 표 참조 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — **forced 전원 결과 확보됨. 화이트리스트 미이행 없음.**

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(사유 상세 미제공 — 이번 변경 set이 성능 표면(핫패스·쿼리·루프 복잡도)을 갖지 않는다고 판단된 것으로 추정) |
  | architecture | 라우터 판단(사유 상세 미제공 — 아키텍처 경계/레이어링 변경 없음으로 판단된 것으로 추정) |
  | dependency | 라우터 판단(사유 상세 미제공 — `package.json` 변경 없음) |
  | database | 라우터 판단(사유 상세 미제공 — 마이그레이션/스키마/쿼리 변경 없음) |