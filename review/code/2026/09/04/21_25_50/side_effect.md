# 부작용(Side Effect) 리뷰

## 리뷰 범위

`git diff origin/main...HEAD` 기준 65개 파일(+5190/-15). 프롬프트에 명시된 52개 항목 외에
저장소 실측(`git diff --stat`)으로 `review/code/2026/09/04/21_10_30/**` 13개 파일(직전
`21_10_30` 라운드의 RESOLUTION/SUMMARY/각 리뷰어 산출물)도 diff 에 포함돼 있음을 확인했다 —
프롬프트가 잘랐을 뿐 실제 changeset 의 일부다. 실질 **코드** 변경은 다음 5개뿐이고 나머지는
전부 문서(`CHANGELOG.md`, `plan/in-progress/**`)와 `review/code/**`·`review/consistency/**`
산출물(저장 위치 관례에 부합)이다.

- `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts`
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts`
- `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts` (신규 e2e, 순수 추가)
- (참고) `codebase/backend/src/common/__test-utils__/temp-fixture.ts`·`source-scan.ts` 의
  `withFiles`/`toPosixPath` 는 이번 diff 의 일부가 아니다(`git diff origin/main...HEAD` 결과
  무변경) — 신규 테스트가 이미 존재하던 헬퍼를 소비할 뿐이다.

저장소는 읽기만 했다(`Read`/`Bash grep`/`git diff`/`git show`). 종료 시 `git status --short`
결과 `review/code/2026/09/04/21_25_50/`(이 리뷰의 출력 디렉터리) 외 변경 없음 — 이 리뷰가
저장소에 만든 뮤테이션은 없다.

## 발견사항

- **[INFO]** `AlertRuleDto.threshold` 의 공개 OpenAPI 원시 타입이 `number` → `string` 으로
  바뀐다 — 이 diff 의 유일한 실질 인터페이스 변경
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts`
    (`@ApiProperty({ type: String, example: '10.0000' })` / `threshold: string;`)
  - 상세: `AlertRuleDto` 는 `alerts.controller.ts` 의 `list`/`create`/`update` 에서 반환
    타입 애노테이션 없이 엔티티를 그대로 반환하는 통로에만 쓰이고(`@ApiOkWrappedArrayResponse`
    등 데코레이터 인자로만 등장), 저장소 전체에 `ClassSerializerInterceptor` 가 0건이라
    `AlertRuleDto` 는 어디서도 인스턴스화·직렬화 강제되지 않는다 — **저장소 내부 런타임
    동작은 이번 필드 타입 변경으로 바뀌지 않는다.** 유일한 내부 소비자
    `codebase/frontend/src/lib/api/alerts.ts` 는 이미 읽기 타입을 `threshold: string` 으로
    손수 분리해 둔 상태다(재확인). 외부 OpenAPI 코드젠 클라이언트에 대해서는 실제
    인터페이스 변경이며, `CHANGELOG.md` 의 `## Unreleased` 신규 항목에 "**영향**: OpenAPI 로
    타입을 생성하는 클라이언트에서 `threshold` 가 `number` → `string` 으로 바뀐다…" 문단이
    이미 포함돼 있어(자매 항목들과 동일한 형식) 고지 관례를 지킨다.
  - 제안: 없음 — 코드·문서 대조 결과 조치 불요.

- **[INFO]** 신규 export(`findNumericAsNumber`/`scanNumericExposure`/`readStringOption`/
  제네릭 `readOption`)는 순수 추가이며, 기존 export `findSwaggerContractMismatches`(시그니처
  `(files: string[], srcRoot: string) => ContractMismatch[]`)와 그 내부에서 쓰는
  `readBooleanOption` 의 동작은 동치로 보존된다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`
    (`readOption`/`readBooleanOption`/`readStringOption` 정의부, `findSwaggerContractMismatches`
    호출부는 무변경)
  - 상세: `readBooleanOption` 은 제네릭 `readOption` 을 얇게 감싸는 래퍼로 리팩터링됐고,
    "리터럴을 찾을 때까지 계속 훑는다" fallthrough 동작이 그대로 유지된다. 저장소 전체에서
    `readBooleanOption`/`readStringOption`/`readOption` 을 직접 호출하는 곳은 이 파일 안
    (`findSwaggerContractMismatches`, `readColumnType`)뿐임을 `grep` 으로 확인했다 — 외부
    호출자에 대한 회귀 표면이 없다.
  - 제안: 없음.

- **[INFO]** 신규 정적 가드(`scanNumericExposure`)의 유일한 부작용은 `fs.readFileSync` 를 통한
  소스 트리 **읽기**뿐 — 쓰기·삭제·`process.env` 접근·네트워크 호출 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` 함수
    `scanNumericExposure`
  - 상세: `ENTITY_DIR`/`RESPONSE_DTO_DIR` 는 모듈 스코프 `const`(readonly 문자열)로 이 파일
    밖에서 관측되지 않는 지역 상수다. `grep -n "process\.env\."` 로 대상 4개 파일을 재확인한
    결과 이 가드·spec·DTO 파일에는 `process.env` 참조가 전혀 없다.
  - 제안: 없음.

- **[INFO]** 신규 e2e 스펙의 네트워크·DB 부작용은 의도된 범위 내이며 기존 e2e 컨벤션과 동일한
  패턴 — 예상치 못한 외부 서비스 호출 없음
  - 위치: `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts` (`beforeAll`/`afterAll`,
    `POST`/`GET`/`PATCH /api/alerts`, `const BASE_URL = process.env.E2E_BASE_URL ?? …`)
  - 상세: `process.env.E2E_BASE_URL` **읽기**(쓰기 아님)와 `registerAndLogin`/
    `createTeamWorkspace`/실 HTTP 호출은 이 저장소 e2e 스위트 전역이 공유하는 기존 패턴이며,
    이 신규 파일이 새로 만든 이탈이 아니다. `afterAll` 이 `db.end()` 만 하고 생성한 alert
    rule·workspace 행을 정리하지 않는 것도 다른 `*.e2e-spec.ts` 형제들과 동일한 기존 관례다.
    대상은 이 e2e 스위트 자신이 띄우는 backend 컨테이너뿐 — 의도치 않은 외부 서비스 호출 없음.
  - 제안: 없음.

- **[INFO]** (기존에 이미 지적·조치 불요로 판정된 사항의 연속) `review/**/_retry_state.json` 에
  이 워크트리의 절대경로가 그대로 기록·커밋된다 — 신규 라운드(`21_10_30`)에도 동일 패턴 재확인
  - 위치: `review/code/2026/09/04/21_10_30/_retry_state.json` (그리고 `19_43_18`/`20_16_17`/
    `20_39_25`/`review/consistency/.../20_05_42` 의 동일 파일들, `session_dir`/`*_output_file`/
    `*_prompt_file` 필드)
  - 상세: 실행 시점 워크트리 절대경로가 데이터로 박제돼 커밋된다. 이 값을 런타임에 다시 읽어
    파일시스템에 접근하는 소비 코드는 없다(직전 `21_10_30` 라운드 RESOLUTION 이 "INFO#8 —
    `_retry_state.json` 절대경로 … 정상 워크플로로 판정" 이라고 이미 명시). 새 결함이 아니라
    기존 판정이 재확인되는 패턴이라 등급을 올리지 않는다.
  - 제안: 없음(기결).

- **[INFO]** `review/code/2026/09/04/21_10_30/RESOLUTION.md` 의 TEST 결과 표 두 행이
  placeholder 문구인 채로 커밋됐다
  - 위치: `review/code/2026/09/04/21_10_30/RESOLUTION.md:42`-`43`
    (`| build | (실행 중 — 완료 후 실측 기입) |`, `| e2e | (실행 중 — 완료 후 실측 기입) |`)
  - 상세: 이 파일이 최종 커밋된 형태에도 build·e2e 두 행이 "실행 중 — 완료 후 실측 기입"
    이라는 미완성 자리표시자로 남아 있다(lint·unit 두 행만 실측 수치가 채워짐). 코드 자체의
    부작용은 아니지만, 이 저장소가 "`review/**` 는 SoT 아님" 이라고 명시하면서도 RESOLUTION
    문서를 게이트/후속 판단의 근거로 인용하는 관행이 있으므로, 이 문서만 보고 "build/e2e 도
    PASS 확인됨" 이라고 오인할 여지가 남는다. 실제 build/e2e 결과가 이후 다른 문서·커밋에
    반영됐는지는 이번 diff 범위에서 확인되지 않았다.
  - 제안: 후속 커밋에서 해당 두 행을 실측치로 채우거나(가장 바람직), 최소한 "미실측"임을
    명시적으로 표기해 자리표시자가 결과로 오인되지 않게 한다. 이번 changeset 의 code 부작용
    등급에는 반영하지 않음(문서 완결성 사안).

## 요약

이번 changeset 의 실질 코드 변경은 (1) `AlertRuleDto.threshold` 의 OpenAPI 원시 타입을 실제
wire(`string`)에 맞춘 정정, (2) 그 사각지대를 재발 차단하는 신규 정적 가드 축(순수 추가·읽기
전용), (3) 런타임 응답을 실 HTTP 로 대조하는 신규 e2e 1건이다. 기존 export
(`findSwaggerContractMismatches`, `readBooleanOption`)의 시그니처·동작은 코드 대조로 동치임을
확인했고, 신규 export는 전부 additive다. 전역 상태·환경 변수 쓰기·의도치 않은 네트워크
호출·예상 밖 파일시스템 쓰기/삭제·이벤트-콜백 변경은 관측되지 않았다. 유일한 실질
"인터페이스 변경"인 `AlertRuleDto.threshold` 타입 정정은 `ClassSerializerInterceptor` 부재와
유일한 내부 소비자의 기존 타입 분리를 코드로 직접 확인한 결과 저장소 내부 런타임에는 영향이
없고, CHANGELOG 에 코드젠 클라이언트 영향 고지도 이미 포함돼 있다. 리뷰 산출물
(`_retry_state.json` 절대경로 등)에 대한 관찰은 직전 라운드에서 이미 "정상 워크플로" 로
판정된 패턴의 연속이며, `21_10_30/RESOLUTION.md` 의 build/e2e 미기입 placeholder 는 코드
부작용은 아니나 문서 신뢰도 관점에서 참고할 만하다.

## 위험도

LOW
