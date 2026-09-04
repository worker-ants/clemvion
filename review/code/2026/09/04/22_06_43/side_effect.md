# 부작용(Side Effect) 리뷰

## 검토 방법

`origin/main...HEAD` changeset 전체(90개 파일)를 대상으로 하되, 실질 코드/테스트 변경은
6개 파일 — `CHANGELOG.md`, `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts`,
`codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`,
`codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts`,
`codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts`,
`plan/in-progress/spec-draft-nullable-notation-followups.md` — 뿐이다. 나머지 84개는
이전 6개 코드 리뷰 라운드(`19_43_18`·`20_16_17`·`20_39_25`·`21_10_30`·`21_25_50`·`21_45_58`)와
consistency-check(`20_05_42`) 산출물이 이 저장소 관례(`review/**` 산출물 커밋)대로 신규
파일로 커밋된 것이다.

직전 라운드(`21_45_58`)의 `side_effect.md`(위험도 LOW, INFO 5건)를 전문 읽었고, 그 라운드
이후의 유일한 코드 변경은 `5076b7e81`(`readOption` string 인스턴스 캐너리 추가,
`swagger-dto-contract.spec.ts`)뿐이며 이는 순수 테스트 추가다. 실질 코드 3파일
(`swagger-dto-contract-guard.ts` 418줄·`swagger-dto-contract.spec.ts` 532줄·
`alerts-threshold-wire-type.e2e-spec.ts` 119줄)과 `alert-rule-response.dto.ts` 는 저장소에서
직접 전문을 열어 재대조했다. `git status --short` 로 이 세션 자신의 출력 디렉터리
(`review/code/2026/09/04/22_06_43/`) 외 잔여물이 없음을 확인했고, 저장소에는 `Read`/`Grep`/
`git`(`log`, `show`, `diff`, `status`) 만 사용해 어떤 파일도 쓰지 않았다.

## 발견사항

- **[INFO]** `AlertRuleDto.threshold` 공개 인터페이스(OpenAPI 응답 스키마) 타입 변경 —
  `number` → `string` (6라운드 누적 검증, 이번 라운드도 재확인)
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:28`
    (`@ApiProperty({ type: String, example: '10.0000' })`), `:29`(`threshold: string;`)
  - 상세: 점검 관점 #5(인터페이스 변경)에 해당하는 공개 계약 변경이지만 저장소 내부
    런타임 side effect 는 없다 — `alerts.controller.ts` 의 `list`/`create`/`update` 모두
    반환 타입 애노테이션 없이 엔티티를 그대로 반환하고(`grep` 재확인), `ClassSerializerInterceptor`
    는 저장소 전체 0건이라 `AlertRuleDto` 클래스는 Swagger 메타데이터 생성에만 관여한다.
    `CHANGELOG.md` 에 codegen 클라이언트 영향(`**영향**:`) 고지가 이미 있다.
  - 제안: 조치 불요 — 이미 수렴됨.

- **[INFO]** 신규 정적분석 가드(`findNumericAsNumber`/`scanNumericExposure`)는 읽기 전용,
  전역 가변 상태 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:261-262`
    (`const ENTITY_DIR = '/entities/'; const RESPONSE_DTO_DIR = '/dto/responses/';`, `readonly`
    문자열 리터럴), `:371-418`(`scanNumericExposure` 본문 — `fs.readFileSync` 로 자신이
    전달받은 파일 목록만 읽는다, 쓰기·삭제·네트워크·환경 변수 접근 없음)
  - 상세: `20_16_17`/`20_39_25` 라운드가 우려했던 module-scope `g`-플래그 정규식
    (`NUMERIC_COLUMN`)은 `c15489e61`(정규식→AST 전환)에서 완전히 제거됐음을 이번 라운드도
    `grep -rn "NUMERIC_COLUMN" codebase/backend/src/repo-guards/` 로 재확인 — 0건.
  - 제안: 조치 불요.

- **[INFO]** 시그니처 변경은 신규 함수/export 추가뿐 — 기존 호출자 영향 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`
    (신규 export: `readOption`, `readStringOption`, `readColumnType`, `collectNumericFields`,
    `collectDtoFieldTypes`, `findNumericAsNumber`, `scanNumericExposure`)
  - 상세: 기존 export `findSwaggerContractMismatches(files, srcRoot)` 의 시그니처·동작은
    무변경(`callDecorators`/`readBooleanOption`/`hasTopLevelNull` 등 기존 헬퍼도 무변경).
    신규 함수는 전부 이번 changeset 안의 새 소비처(`swagger-dto-contract.spec.ts`)에서만
    호출된다.
  - 제안: 조치 불요.

- **[INFO]** e2e 신규 스펙(`alerts-threshold-wire-type.e2e-spec.ts`)의 부작용은 기존 e2e
  인프라 표준 패턴에 국한
  - 위치: `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts:29`
    (`process.env.E2E_BASE_URL` 읽기), `:36-50`(`beforeAll` — 사용자·워크스페이스 생성),
    `:75-117`(`POST`/`GET`/`PATCH` 실 HTTP 호출로 alert rule 레코드 생성·수정)
  - 상세: 테스트 DB 에 레코드를 만들고 실 HTTP 호출을 하는 것 자체는 이 저장소 e2e 스위트의
    표준 관례(`registerAndLogin`/`createTeamWorkspace`/`createDbClient` — 전부 기존 helper,
    이번 diff 밖)이며, 격리된 e2e 환경(`backend-e2e:3011`)에 한정된다. `db.end()` 로
    `afterAll` 에서 연결을 정리한다(`:52-54`). 이번 diff 가 새로 만든 네트워크 호출·환경
    변수 접근 패턴은 없다.
  - 제안: 조치 불요.

- **[INFO]** 테스트 픽스처 헬퍼(`withFiles`/`withFixture`, diff 밖 — `common/__test-utils__/temp-fixture.ts`)의
  파일시스템 쓰기는 저장소 트리 밖에 한정
  - 위치: `codebase/backend/src/common/__test-utils__/temp-fixture.ts` (참조 확인, 이번 diff
    대상 아님 — `swagger-dto-contract.spec.ts` 가 신규 소비처로 `withFiles` import 를 추가)
  - 상세: 직접 열어 확인 — `fs.mkdtempSync(path.join(os.tmpdir(), prefix))` 로 저장소 밖
    tmpdir 에만 쓰고, `finally` 블록에서 `fs.rmSync(dir, { recursive: true, force: true })`
    로 항상 정리한다. 저장소 트리에 대한 파일시스템 부작용은 없다.
  - 제안: 조치 불요.

- **[INFO]** `review/**` 산출물 대량 커밋(84개 파일)은 이 저장소의 기존 관례와 일치
  - 위치: `review/code/2026/09/04/{19_43_18,20_16_17,20_39_25,21_10_30,21_25_50,21_45_58}/**`,
    `review/consistency/2026/09/04/20_05_42/**`
  - 상세: CLAUDE.md 의 "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`"
    관례와 정확히 일치한다. 새로운/일탈적 파일시스템 부작용이 아니다.
  - 제안: 조치 불요.

## 요약

이번 라운드(`22_06_43`)에서 직전 라운드(`21_45_58`) 이후 발생한 유일한 코드 변경은
`readOption` 의 string 인스턴스 캐너리 테스트 1건(`5076b7e81`)이며, 순수 테스트 추가로
프로덕션 코드·전역 상태·환경 변수·파일시스템·네트워크 호출·이벤트/콜백 어디에도 새로운
부작용을 만들지 않는다. 그 외 changeset 전체(6개 실질 파일)의 부작용 관점은 6라운드에
걸쳐 이미 충분히 검증됐다 — 유일한 공개 인터페이스 변경(`AlertRuleDto.threshold: number →
string`)은 저장소 내부 런타임에 영향이 없음이 반복 확인됐고 codegen 클라이언트 영향은
CHANGELOG 로 고지됐다. 신설 정적분석 가드는 저장소 자신의 소스만 읽는 순수 함수이고, 신규
e2e 스펙의 부작용(테스트 DB 레코드 생성·HTTP 호출)은 기존 e2e 인프라의 표준 패턴 안에
있다. 저장소 트리에 대한 뮤테이션은 이번 리뷰 과정에서 발생하지 않았다
(`git status --short` 확인, 세션 출력 디렉터리 외 잔여물 없음).

## 위험도

LOW
