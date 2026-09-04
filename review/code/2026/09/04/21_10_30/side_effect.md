# 부작용(Side Effect) 리뷰

## 리뷰 범위

`git diff origin/main...HEAD` (branch `claude/passthrough-dto-verifier`, 52 파일, +3853/-15) 를
기준으로 확인했다. 실질 코드 변경은 3파일뿐이고 나머지는 문서(CHANGELOG·plan)와
`review/code/**`·`review/consistency/**` 산출물(전부 이 저장소의 명시된 저장 위치 관례에
부합)이다.

- `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` —
  `AlertRuleDto.threshold: number → string` + `@ApiProperty` 데코레이터 변경.
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — 신규 축
  (`findNumericAsNumber`/`scanNumericExposure`) 추가 + `readBooleanOption` 을 제네릭
  `readOption` 으로 리팩터링.
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` — 위 신규 축의
  대조군/전제 테스트.
- `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts` — 신규 e2e 스펙(순수 추가).

저장소를 직접 열어(읽기 전용, 뮤테이션 없음) 아래를 대조했다. 종료 시 `git status --short`
확인 결과 이 리뷰가 만든 변경은 없다(작업 디렉터리는 이 리뷰용 출력 파일 생성 외 clean).

## 발견사항

- **[INFO]** `AlertRuleDto.threshold` 의 공개 OpenAPI 계약(원시 타입)이 `number` → `string`
  으로 바뀐다 — 이 diff 의 유일한 실질 인터페이스 변경
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` (`@ApiProperty({ type: String, example: '10.0000' })` / `threshold: string;`, `AlertRuleDto` 클래스 내 해당 필드)
  - 상세: `AlertRuleDto` 는 `alerts.controller.ts` 에서 `@ApiOkWrappedArrayResponse`/`@ApiCreatedWrappedResponse`/`@ApiOkWrappedResponse` 데코레이터 인자로만 쓰이고, `list`/`create`/`update` 핸들러는 반환 타입 애노테이션 없이 서비스가 준 엔티티를 그대로 반환한다(직접 확인: `alerts.controller.ts` `list()`). 저장소 전체에 `ClassSerializerInterceptor` 0건(`grep` 재확인)이라 `AlertRuleDto` 는 어디서도 인스턴스화·직렬화 강제되지 않는다 — 즉 이번 필드 타입 변경은 **저장소 내부 런타임 동작을 전혀 바꾸지 않는다.** 다만 OpenAPI 스키마에서 코드를 생성하는 **외부** 클라이언트에게는 생성 타입이 달라지는 실제 인터페이스 변경이다. wire 바이트가 원래도 문자열이었으므로(엔티티 `threshold: string`, migration `NUMERIC(12,4)`) 이 변경을 신뢰해 산술을 하던 코드가 있었다면 그 코드는 이미 런타임에서 깨져 있었을 것 — 새로운 breaking 은 아니고 기존 breakage 를 문서에 드러내는 방향이다.
  - 제안: 없음(조치 불요) — 이미 CHANGELOG 에 정정 사실이 기록돼 있고, 유일한 내부 소비자(`codebase/frontend/src/lib/api/alerts.ts`)는 이미 `threshold: string` 을 기대하도록 손수 분리돼 있음을 확인했다. 코드젠 클라이언트 영향 고지 형식은 documentation 리뷰어의 관할.

- **[INFO]** 내부 서사 주석이 `//` 라인 주석으로 배치돼 `nest-cli.json` 의 Swagger 플러그인
  `introspectComments` 로 유출되지 않음을 확인 — 긍정적 확인 사항
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` (`threshold` 필드 위 `// 이 필드가 왜 문자열인지의 경위...` 줄과 바로 아래 `/** 임계값. **문자열로 내려간다**... */` JSDoc 블록), `codebase/backend/nest-cli.json` (`"introspectComments": true`)
  - 상세: `@nestjs/swagger` 플러그인의 `introspectComments` 는 프로퍼티 바로 위 **JSDoc(`/** */`) 블록**만 `description` 으로 승격하고 일반 `//` 라인 주석은 보지 않는다. 이번 diff 는 "왜 문자열인가"(공개용, JSDoc)와 "왜 예전에 틀렸었는가·경위"(내부용, `//`)를 정확히 그 경계로 나눠 배치했다 — 공개 API 문서(`/api-json`)로 내부 조사 서사가 새어나가는 부작용을 의도적으로 피한 것이 코드로 확인된다. 별도 결함 아님.

- **[INFO]** `readBooleanOption` 을 제네릭 `readOption` 으로 리팩터링 — 기존 `findSwaggerContractMismatches` (presence·null 축) 호출부에 행동 변화 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` 함수 `readOption`/`readBooleanOption`/`readStringOption`
  - 상세: 종전 `readBooleanOption` 은 인자 객체들을 순회하며 `true`/`false` 리터럴이 아니면 계속 다음 프로퍼티/인자를 훑고 끝까지 못 찾으면 `undefined` 를 반환했다. 새 제네릭 `readOption` 도 `pick(initializer)` 가 `undefined` 를 주면 동일하게 계속 훑는 fallthrough 를 그대로 보존한다 — `readBooleanOption` 은 이 제네릭을 그대로 얇게 감싼 래퍼라 동작이 동치다. `findSwaggerContractMismatches`(기존 export, 시그니처 불변: `(files: string[], srcRoot: string) => ContractMismatch[]`)의 호출자(`swagger-dto-contract.spec.ts`)나 판정 결과에 회귀가 없음을 코드 대조로 확인했다.

- **[INFO]** 신규 export(`findNumericAsNumber`/`scanNumericExposure`/`NumericAsNumberOffender`/`NumericExposureScan`)는 순수 추가 — 기존 시그니처·공개 인터페이스에 대한 파괴적 변경 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`
  - 상세: 기존 export `ContractMismatch`/`findSwaggerContractMismatches` 는 문자 그대로 보존됐고, 새 함수들은 별도 이름으로 추가됐다. 이 파일이 하는 유일한 부작용은 `fs.readFileSync` 로 소스 트리를 **읽는 것**뿐이고(`scanNumericExposure`/`findSwaggerContractMismatches` 둘 다), 파일 쓰기·삭제·전역 변수 변경은 없다. `API_DECORATORS`/`ENTITY_DIR`/`RESPONSE_DTO_DIR` 는 모듈 스코프 `const` 로 이 파일 밖에서 관측되지 않는다.

- **[INFO]** 신규 e2e 스펙의 네트워크·DB 부작용은 의도된 범위 내이며 형제 스펙과 동일한 패턴
  - 위치: `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts` (`beforeAll`/`afterAll`, `POST`/`GET`/`PATCH /api/alerts`)
  - 상세: `process.env.E2E_BASE_URL` 읽기와 `registerAndLogin`/`createTeamWorkspace`/실 HTTP 호출은 이 저장소 e2e 스위트의 표준 패턴(`grep` 대조: 다른 다수 `*.e2e-spec.ts` 도 동일 env var·헬퍼 사용)이다. `afterAll` 이 `db.end()` 만 하고 생성된 alert rule·workspace 행을 지우지 않는 것도 형제 스펙(예: `audit-logs.e2e-spec.ts`)과 동일한 기존 관례이지, 이번 diff 가 새로 도입한 이탈이 아니다. 예상치 못한 외부 서비스 호출 없음 — 대상은 이 e2e 스위트 자신이 띄우는 backend 컨테이너뿐이다.

- **[INFO]** `review/**/_retry_state.json` 에 이 워크트리의 절대경로가 그대로 기록돼 커밋된다
  - 위치: `review/code/2026/09/04/19_43_18/_retry_state.json`, `review/code/2026/09/04/20_16_17/_retry_state.json`, `review/code/2026/09/04/20_39_25/_retry_state.json`, `review/consistency/2026/09/04/20_05_42/_retry_state.json` (`session_dir`/`*_output_file`/`*_prompt_file` 필드가 전부 `/Volumes/project/private/clemvion/.claude/worktrees/plan-in-progress-items-b0c80b/...` 절대경로)
  - 상세: 실행 시점 워크트리 경로가 데이터로 박제돼 커밋된다. 이 값을 런타임에 다시 읽어 파일시스템에 접근하는 소비 코드는 없음을 확인했다(orchestrator 상태 파일은 그 세션 종료 후 재참조되지 않는 기록용). 즉 side effect(잘못된 경로에 쓰기 시도 등)로 이어지지는 않으나, 다른 머신/워크트리에서 이 파일을 열면 그 경로는 원천적으로 무효하다 — CLAUDE.md 가 지정한 `review/code/**` 보존 관례 자체는 지키고 있으므로 결함이 아니라 참고 사항으로만 남긴다.

## 요약

이번 changeset 의 실질 코드 변경은 (1) `AlertRuleDto.threshold` 의 OpenAPI 원시 타입을
실제 wire(`string`)에 맞춘 정정, (2) 그 사각지대를 재발 차단하는 신규 정적 가드 축(순수
추가, 파일 읽기 전용), (3) 런타임 응답을 실 HTTP 로 대조하는 신규 e2e 1건이다. 함수
시그니처는 기존 export 기준으로 불변이고 새 export 는 전부 additive, 전역 상태·환경
변수 쓰기·의도치 않은 네트워크 호출·파일시스템 쓰기·이벤트/콜백 변경 어느 것도
관측되지 않았다. 유일한 실질 "인터페이스 변경"은 `AlertRuleDto.threshold` 의 공개
스키마 타입이며, `ClassSerializerInterceptor` 부재·유일한 내부 소비자의 기존 타입
분리를 코드로 직접 확인한 결과 저장소 내부 런타임에는 영향이 없고 외부 코드젠
클라이언트에 대해서만 (이미 wire 와 어긋나 있던 문서를 사실에 맞추는 방향으로) 영향을
준다. `review/**/_retry_state.json` 에 워크트리 절대경로가 기록·커밋되는 점은 소비되지
않는 기록이라 side effect 로 이어지지 않지만 참고로 남긴다.

## 위험도

LOW
