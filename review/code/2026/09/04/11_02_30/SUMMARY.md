# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. WARNING 5건은 전부 재발방지 가드(신설)·헬퍼·문서 산출물의 부차적 결함이며 핵심 로직(9곳 nullable 계약 정정)은 실측·대조군 테스트로 충실히 검증됨. forced whitelist(7개) 전원 결과 확보 완료 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture | `swagger-dto-contract-guard.ts` 의 `effectiveRequired` 판정이 `@nestjs/swagger` 의 **비공개 내부 구현**(`ApiPropertyOptional` = `ApiProperty({required:false})` 별칭)에 하드 커플링되어 있는데, 이를 지키는 canary/버전 고정이 없다. `package.json` 의 `^11.4.5` caret 범위라 minor 업그레이드 시 조용히 틀린 판정을 낼 수 있다 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:135-136` | `@nestjs/swagger` 버전 고정 또는 `ApiPropertyOptional()` 을 실제 호출해 `required:false` 메타데이터를 확인하는 canary 테스트 추가 |
| 2 | maintainability | `findSwaggerContractMismatches` 의 상대경로 계산이 형제 가드 4곳(`engine-error-code-anchor-guard.ts` 등)의 크로스플랫폼 정규화 관례(`.split(path.sep).join('/')`)를 따르지 않음. 현재 CI(POSIX)에서는 안 드러나지만 `file` 필드를 스냅샷 비교 등에 쓰면 플랫폼별로 달라짐 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:125` | `path.relative(srcRoot, file).split(path.sep).join('/')` 로 통일 |
| 3 | side_effect | 공유 tmpdir 픽스처 헬퍼 `withFiles`/`withFixture` 가 `fn` 을 동기 함수로만 가정 — async 콜백을 넘기면 `finally` 의 `fs.rmSync` 가 콜백 완료를 기다리지 않고 즉시 실행돼 파일이 조기 삭제되는 레이스가 발생할 수 있음. 지역 함수에서 공유 유틸로 승격되며 blast radius 확대 | `codebase/backend/src/common/__test-utils__/temp-fixture.ts:28-32` | `fn` 이 Promise 를 반환하면 `await` 후 정리하도록 수정하거나, 최소한 JSDoc 에 "동기 콜백 전용" 명시 |
| 4 | testing | 가드가 보고하는 `ContractMismatch.line`/`.file` 필드의 정확성이 어떤 테스트에서도 단언되지 않음 — `axes()` 헬퍼가 `axis` 만 비교. 실패 위치가 틀려도 스위트는 계속 GREEN | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:43-54` | 최소 1개 픽스처에 대해 `line`(실제 줄 번호)·`file`(relative path) 을 함께 단언하는 케이스 추가 |
| 5 | documentation | `CHANGELOG.md` 에 이번 Swagger 계약 거짓 수정(9곳) 항목이 없음 — 같은 작업 계열의 직전 두 자매 커밋(`invitedBy`, `ipWhitelist`)은 동일 포맷("종전/지금" 표)으로 기록했는데 이번만 빠짐. 방향도 더 소비자 영향 큼(`required: false→true`, 좁히는 변경) | `CHANGELOG.md` (신규 항목 부재) | 두 자매 항목과 같은 포맷으로 `## Unreleased` 항목 추가 — DTO 8+1필드 + 재발방지 가드 신설 사실 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture | `SRC_ROOT` 상수 정의가 형제 가드(`nullable-type-lie-cast-guard.ts`)와 다시 중복됨 — 같은 PR 이 다른 자리(`temp-fixture.ts`)에서 중복을 없앤 직후 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:40` | 세 번째 가드가 이 계산을 필요로 하면 공유 모듈로 추출 (지금은 불요) |
| 2 | architecture | `@Transform` 예외가 이름 없는 단일 조건식으로 하드코딩 — 예외 사유가 늘어나면 `\|\|` 가 계속 붙는 형태로 커질 소지 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:152-155` | 예외 사유가 둘 이상이 되면 이름 있는 집합(`TYPE_TRANSFORMING_DECORATORS`)으로 승격 (지금은 YAGNI) |
| 3 | requirement / api_contract | `readBooleanOption` 이 `nullable`/`required` 값을 boolean 리터럴일 때만 인식 — 상수 참조·shorthand property 는 `undefined` 로 조용히 "미선언" 처리돼 향후 위음성 가능. 현재 저장소엔 non-literal 사례 0건 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:59-74` | 당장 불요. 향후 non-literal 패턴 등장 시 "판정 불가"로 별도 카운트/throw 고려 |
| 4 | requirement | `spec-draft-nullable-notation-followups.md` 의 저장소 실측 표(103/17/8/1)가 **이 커밋 자신의 DTO 수정 적용 전** 스냅샷 — 커밋 적용 후 실제 분포는 104/25/0/1 로 바뀜(재계산 확인). 문서에 이 점 미명시 | `plan/in-progress/spec-draft-nullable-notation-followups.md` (§③ 저장소 실측 표) | 코드 수정 불요. 다음에 "§5.4 drift 103곳" 착수 전 AST 가드로 재실측(104곳 예상)하도록 안내 문구 추가 |
| 5 | scope | 서로 무관한 두 커밋(Swagger DTO 계약 수정 vs execution-engine G2 재실측)이 한 브랜치에 섞여 있음 — 각 커밋 자체는 원자적이라 코드 레벨 오염은 없음 | `plan/in-progress/execution-engine-residual-gaps.md` (커밋 `8691a2f25`) | 분리 가능하면 별도 PR 권장, 상위 세션 과제(plan 항목 훑기) 하 통합이 의도라면 현행 유지 무방 |
| 6 | maintainability | docstring 의 하드코딩 실측 수치(1,096/18/1)에 재현 명령이 없음 — 같은 디렉터리의 형제 파일(`nullable-type-lie-cast-guard.ts`)은 이미 이 실수를 겪고 재현 명령을 남겨 두는 관례를 세웠는데 이번엔 빠짐 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:109-111` | 재현 명령(grep/스크립트) 병기 또는 정성적 표현으로 완화 |
| 7 | maintainability | presence 불일치 판정식(`effectiveRequired === tsOptional`)이 이름 없는 동치 비교로만 표현돼 부호가 뒤집힌 채 읽힘 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:141` | 이름 붙이거나 인라인 주석 추가 |
| 8 | maintainability | 변수명 `sf` 가 이 디렉터리 관례(`sourceFile`, 형제 파일 `production-build-devdep-guard.ts`)와 다름 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:46,62,119` 등 | 다음 가드 추가 시 `sourceFile` 로 통일 권장 |
| 9 | testing | `hasTopLevelNull` 이 `ParenthesizedTypeNode` 를 언랩하지 않아 `(T \| null)` 형태에서 위음성 가능 — 테스트 없음. 현재 저장소엔 실사례 0건 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:83-90` | `ts.isParenthesizedTypeNode` 언랩 처리 + 대조군 캐너리 추가 (급하지 않음) |
| 10 | testing | `temp-fixture.ts` 자체(`withFiles`/`withFixture`)를 겨눈 전용 단위 테스트 부재 — 예외 경로(콜백 throw 시 정리 여부) 미검증. 정상 경로는 두 소비처가 간접 검증 | `codebase/backend/src/common/__test-utils__/temp-fixture.ts:16-42` | 필요 시 예외 경로 캐너리 1개 추가 |
| 11 | testing | `llmConfigId` nullable 수정에 대한 e2e/컨트롤러 회귀 테스트 부재 — 정적 계약 가드가 재발은 막지만 실제 요청 경로(`null` 페이로드) 검증은 없음 | `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts:12-19` | 여유 시 `workflow-assistant.e2e-spec.ts` 에 `llmConfigId: null` 페이로드 케이스 추가 |
| 12 | documentation | 리팩터 후 남은 주석("모듈 스코프의 `withFiles`")이 바로 위 JSDoc(공유 헬퍼로 이동 설명)과 살짝 어긋난 톤 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:120` | "공유 헬퍼의 `withFiles`(import)" 로 문구 통일 |
| 13 | documentation | `llmConfigId` 설명 문구가 "생략 시" 만 언급하고 명시적 `null` 케이스 미언급 — 자매 DTO(`update-assistant-session.dto.ts`)는 이미 null 케이스 명시 | `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts:13` | "(생략 또는 null 전달 시 워크스페이스 기본값 사용)" 으로 통일 |
| 14 | api_contract / side_effect | `background-run-response.dto.ts` 7개 필드의 OpenAPI `required` 가 `false→true` 로 전환 — 계약을 좁히는 방향이라 코드제너레이터 소비자는 재생성 시 타입이 더 엄격해짐(런타임 breaking 아님, 정합화) | `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts:43-149` 각 게이트 | 외부 SDK/코드젠 소비자 있다면 배포 노트 기록 권장 |
| 15 | api_contract | DTO 스키마 교정에 대응하는 API 버전 관리 흔적 없음 — diff 범위상 저장소의 버전 정책 자체를 확인 불가 | `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts` 전체 | `spec/5-system/2-api-convention.md` 버전관리 절과 대조 확인 권장 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 런타임 검증/인증 로직 무변화 확인. DTO nullable 메타데이터 정정은 계약 정확도 개선 방향, 신규 위협 표면 없음 |
| architecture | LOW | 신규 가드가 `@nestjs/swagger` 비공개 구현에 canary 없이 결합(WARNING). 나머지는 상수 중복·확장성 여지 수준 INFO |
| requirement | LOW | 8+1곳 수정 전부 spec(§5.4)·런타임 조립 코드와 line-level 일치 실측 확인. `readBooleanOption` 스코프 한계, plan 문서 수치 신선도 INFO |
| scope | LOW | 핵심 변경은 단일 목적에 부합. 무관한 2번째 커밋(G2 재실측)이 같은 브랜치에 동승(INFO) |
| side_effect | LOW | `temp-fixture.ts` 공유화로 async 콜백 레이스 위험 확대(WARNING). DTO 변경은 런타임 무영향 확인 |
| maintainability | LOW | 경로 정규화 누락(WARNING). 하드코딩 수치 재현성·변수명 관례·중첩 등 INFO 다수 |
| testing | LOW | 가드의 `line`/`file` 필드 자체 미검증(WARNING). `hasTopLevelNull` 괄호-유니온 미언랩, `llmConfigId` e2e 부재 등 INFO |
| documentation | LOW | CHANGELOG 누락 — 직전 두 자매 커밋과 다른 처리(WARNING). SDD 순서(spec→code)는 모범적으로 지켜짐 |
| api_contract | LOW | `required` 필드 전환은 정합화 방향이라 breaking 아님. 신규 가드가 거버넌스 강화로 평가됨 |

## 발견 없는 에이전트

- security — 코드/DTO/가드/테스트 헬퍼 전 영역에서 보안 하방 요인 없음 확인(INFO 4건은 전부 "문제 없음" 확인 서술)

## 권장 조치사항

1. `CHANGELOG.md` 에 이번 Swagger 계약 정정(9곳) 항목 추가 — 직전 두 자매 커밋과 동일 포맷 (documentation WARNING)
2. `swagger-dto-contract.spec.ts` 에 `ContractMismatch.line`/`.file` 값을 직접 단언하는 케이스 최소 1개 추가 (testing WARNING)
3. `temp-fixture.ts` 의 `withFiles`/`withFixture` 를 async 콜백 안전하게 만들거나 최소 JSDoc 에 "동기 전용" 명시 (side_effect WARNING)
4. `swagger-dto-contract-guard.ts` 의 상대경로 계산에 `.split(path.sep).join('/')` 정규화 추가 (maintainability WARNING)
5. `@nestjs/swagger` 버전 고정 또는 `ApiPropertyOptional()` 실제 호출 canary 테스트 추가 — 라이브러리 업그레이드 시 판정 로직 조용한 붕괴 방지 (architecture WARNING)
6. (낮은 우선순위) `hasTopLevelNull` 의 괄호-유니온 언랩, `readBooleanOption` 의 non-literal 값 방어, `llmConfigId` e2e 케이스, plan 문서 수치 갱신 안내 등 INFO 항목은 여유 있을 때 처리

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract (9명)
  - **제외**: 표 (5명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보 완료, 누락 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 범위(스코프) 밖 |
  | dependency | router 판단상 이번 diff 범위(스코프) 밖 |
  | database | router 판단상 이번 diff 범위(스코프) 밖 |
  | concurrency | router 판단상 이번 diff 범위(스코프) 밖 |
  | user_guide_sync | router 판단상 이번 diff 범위(스코프) 밖 |