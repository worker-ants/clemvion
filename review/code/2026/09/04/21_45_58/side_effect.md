# 부작용(Side Effect) 리뷰

## 검토 방법

`origin/main...HEAD` 전체 changeset(78개 파일)을 대상으로 하되, 실질 코드/테스트 변경은 6개
파일(`CHANGELOG.md`, `alert-rule-response.dto.ts`, `swagger-dto-contract-guard.ts`,
`swagger-dto-contract.spec.ts`, `alerts-threshold-wire-type.e2e-spec.ts`,
`spec-draft-nullable-notation-followups.md`)이고 나머지 72개는 이전 5개 리뷰/consistency
라운드(`19_43_18`·`20_16_17`·`20_39_25`·`21_10_30`·`21_25_50`·`20_05_42`)의 산출물이 이 저장소
관례(`review/**` 산출물 커밋)대로 신규 파일로 커밋된 것이다. 각 라운드의 `side_effect.md` 를
전부 읽어 이미 다룬 관점을 재확인했고, 실질 코드 3파일(`swagger-dto-contract-guard.ts`,
`swagger-dto-contract.spec.ts`, `alerts-threshold-wire-type.e2e-spec.ts`)과
`alert-rule-response.dto.ts` 는 저장소에서 직접 전문을 열어 대조했다. 저장소는 `Read`/`Grep`/
`git`(`log`, `show`, `diff`, `status`) 만 사용했고 어떤 파일도 쓰지 않았다 — `git status --short`
는 이 리뷰 세션 자신의 출력 디렉터리(`review/code/2026/09/04/21_45_58/`) 외 잔여물이 없음을
확인했다.

직전 라운드(`21_25_50`)와의 델타는 정확히 커밋 하나 —
`4e7a52bc9`(`test(e2e): 정수만 보내면 정밀도 손실을 못 가른다 — scale 을 꽉 채운 값으로`),
`codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts` 34줄(+28/-6) 뿐이다.
`21_25_50` 라운드의 `testing` INFO#2(정수 값만 보내 정밀도 손실 분기를 못 가른다는 지적)에
대한 fix 다. 이 델타를 중심으로 재검증했다.

## 발견사항

- **[INFO]** `AlertRuleDto.threshold` 공개 인터페이스(OpenAPI 응답 스키마) 타입 변경 —
  `number` → `string` (기존 확인 재검증, 신규 아님)
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:28`
    (`@ApiProperty({ type: String, example: '10.0000' })`), `:29`(`threshold: string;`)
  - 상세: 점검 관점 #5(인터페이스 변경)에 해당하는 공개 계약 변경이지만, 5라운드에 걸쳐
    이미 충분히 검증됐다. 직접 재확인한 근거 —
    (a) `alerts.controller.ts` 의 `list`/`create`/`update` 세 핸들러 모두 반환 타입
    애노테이션이 없고 엔티티를 그대로 반환한다 (`grep` 확인), `ClassSerializerInterceptor` 는
    저장소 전체 0건이라 이 DTO 클래스는 Swagger 메타데이터 생성에만 쓰이고 런타임
    직렬화·검증에는 관여하지 않는다 — wire 바이트는 이번 변경으로 바뀌지 않는다.
    (b) 유일한 내부 소비자 `codebase/frontend/src/lib/api/alerts.ts` 는 이미 읽기
    `threshold: string`/쓰기 `number` 로 손수 분리돼 있다.
    (c) `CHANGELOG.md:25` 에 다른 항목과 동일한 형식의 `**영향**:` 코드젠 고지 문단이 이미
    존재한다(`19_43_18` WARNING → `20_16_17` 라운드에서 조치됨).
    즉 저장소 내부 side effect 는 없고, 외부 codegen 클라이언트 영향은 이미 문서로 캐비엇됐다.
  - 제안: 조치 불요 — 5라운드 누적 검증으로 수렴됨.

- **[INFO]** 신규 e2e 델타(`4e7a52bc9`)는 순수 테스트 값 교체이며 프로덕션 코드·전역
  상태·환경 변수·네트워크 호출 패턴에 변경이 없다
  - 위치: `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts:70-71`
    (`const CREATED_THRESHOLD = 12.3456; const PATCHED_THRESHOLD = 7.0625;`),
    `:100`(`expect(mine?.threshold).toBe('12.3456');`), `:111-117`(PATCH 후 재조회 신규 단언)
  - 상세: 이 파일이 만드는 side effect(테스트 DB 에 사용자·워크스페이스·알림 규칙 레코드
    생성, 실 HTTP 호출 `BASE_URL`) 자체는 이번 델타 이전부터 있던 e2e 테스트 인프라의
    표준 패턴(`registerAndLogin`/`createTeamWorkspace`/`createDbClient` — 전부 기존
    helper, 이번 diff 밖)이고, 이번 커밋은 그 안에서 **보내는 값**만 정수(`10`/`15`)에서
    소수부 4자리(`12.3456`/`7.0625`)로 바꾸고 PATCH 이후 재조회 단언을 추가했을 뿐이다.
    `process.env.E2E_BASE_URL` 읽기(`:29`)도 이번 델타 밖의 기존 코드다. 전역 변수 신설,
    함수 시그니처 변경, 파일시스템 쓰기, 신규 이벤트/콜백 — 전부 해당 없음.
  - 제안: 조치 불요.

- **[INFO]** 신규 정적분석 가드(`findNumericAsNumber`/`scanNumericExposure`)는 순수
  읽기 전용이며 전역 가변 상태가 없다 (기존 확인 재검증)
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:260-262`
    (`const ENTITY_DIR = '/entities/'; const RESPONSE_DTO_DIR = '/dto/responses/';`),
    `:353-418`(`findNumericAsNumber`/`scanNumericExposure` 본문)
  - 상세: 직접 전문을 읽어 확인 — 두 모듈 상수는 `readonly` 문자열 리터럴이고 함수 내부에서
    `.includes()` 판별에만 쓰인다. `fs.readFileSync` 로 저장소 자신의 `.ts` 파일만 읽고, 쓰기·
    삭제·네트워크 호출·환경 변수 접근은 없다. `20_16_17`/`20_39_25` 라운드 `side_effect.md`
    가 지적했던 module-scope `g`-플래그 정규식(`NUMERIC_COLUMN`)은 이번 changeset 의
    `c15489e61`(정규식→AST 전환)에서 **완전히 제거**됐음을 `grep -rn "NUMERIC_COLUMN"`
    으로 확인 — 저장소 전체 0건. 즉 그 시점의 잠재 부작용 우려 자체가 소스에서 사라졌다.
  - 제안: 조치 불요.

- **[INFO]** 시그니처 변경은 신규 함수 추가뿐 — 기존 export 호출자 영향 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`
    (신규 export: `readOption`, `readStringOption`, `readColumnType`, `collectNumericFields`,
    `collectDtoFieldTypes`, `findNumericAsNumber`, `scanNumericExposure`)
  - 상세: 기존 export `findSwaggerContractMismatches(files, srcRoot)` 시그니처·동작은
    무변경(소스 대조 확인, `readBooleanOption`/`hasTopLevelNull`/`callDecorators` 등 헬퍼도
    무변경). 신규 함수는 전부 이번 changeset 안의 새 소비처(`swagger-dto-contract.spec.ts`)
    에서만 호출되므로 기존 호출자에게 파급되는 breaking 시그니처 변경이 없다.
  - 제안: 조치 불요.

- **[INFO]** `review/**` 산출물 대량 커밋(72개 파일)은 이 저장소의 기존 관례와 일치 —
  이례적 파일시스템 부작용 아님 (기존 확인 재검증)
  - 위치: `review/code/2026/09/04/{19_43_18,20_16_17,20_39_25,21_10_30,21_25_50}/**`,
    `review/consistency/2026/09/04/20_05_42/**`
  - 상세: CLAUDE.md 의 "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`"
    관례와 정확히 일치하고, `_retry_state.json`/`meta.json` 등 orchestrator 내부 파일까지
    커밋되는 패턴도 `git log --all -- '**/_retry_state.json'` 로 선례(`d8b7cb93e` 등)가
    확인된다(이전 라운드 `scope.md` 서술 재검증). 새로운/일탈적 파일시스템 부작용이 아니다.
  - 제안: 조치 불요.

## 요약

이번 라운드의 실질 변경은 직전 라운드가 지적한 e2e 테스트값 취약점(정수 입력이라 정밀도
손실 분기를 못 가름)을 고치는 커밋(`4e7a52bc9`) 하나이며, 순수 테스트 데이터 교체와 재조회
단언 추가로 프로덕션 코드·전역 상태·환경 변수·네트워크 호출 패턴·함수 시그니처 어디에도
새로운 부작용을 만들지 않는다. 그 외 이번 changeset 전체(6개 실질 파일)의 부작용 관점은
5라운드에 걸쳐 이미 충분히 검증됐다 — 유일한 공개 인터페이스 변경(`AlertRuleDto.threshold:
number → string`)은 저장소 내부 런타임에 영향이 없음이 반복 확인됐고 codegen 클라이언트
영향은 CHANGELOG 로 고지됐다. 신설 정적분석 가드는 저장소 자신의 소스만 읽는 순수 함수이며,
이전 라운드가 우려했던 `g`-플래그 정규식 전역 상수는 AST 전환으로 소스에서 완전히 제거됐다.
저장소 트리에 대한 뮤테이션은 이번 리뷰 과정에서 발생하지 않았다.

## 위험도

LOW
