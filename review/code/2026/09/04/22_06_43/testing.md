# 테스트(Testing) 코드 리뷰

## 리뷰 범위 및 방법

`git diff --stat origin/main...HEAD` 기준 테스트 관점의 실질 대상은 다음 3개 파일이다
(CHANGELOG·plan 문서·`review/**` 산출물은 서술 문서라 이 관점의 발견사항 대상이 아님):

1. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`
2. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts`
3. `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts`

이 changeset 은 이미 6라운드(`19_43_18`→`20_16_17`→`20_39_25`→`21_10_30`→`21_25_50`→
`21_45_58`)의 코드 리뷰와 매 라운드의 예측/실측 뮤테이션 검증을 거쳤다. 직전 라운드
(`21_45_58`)가 유일하게 낸 WARNING("`readOption` 제네릭화 이후 '리터럴을 만날 때까지
훑는다' 분기가 `readBooleanOption` 인스턴스로만 캐너리 고정되고 `readStringOption`
인스턴스에는 대조군이 없다")은 커밋 `5076b7e81` 로 조치되었고, 이번 라운드 시점의 HEAD
(`a9e65ac64`)는 그 조치 이후 상태다.

독립 재검증(저장소 뮤테이션 없음, 실행/열람만):

- `npx jest src/repo-guards/__tests__/swagger-dto-contract.spec.ts` 직접 재실행 —
  **34/34 PASS** 재현(직전 라운드가 보고한 34 GREEN 과 일치).
- `npx tsc --noEmit` 전체 실행 — 이 3개 파일에서 나는 신규 에러 **없음**.
- `test/jest-e2e.json` 의 `testRegex: ".e2e-spec.ts$"` 가 신규 파일명 패턴과 일치함을
  확인 — 이전 라운드가 지적했던 "패턴 불일치로 조용히 스킵" 류 결함(메모리에 기록된
  `feedback_type_guard_test_actually_runs`)이 이 changeset 에는 없다.
- `test/helpers/auth.ts`/`test/helpers/db.ts` 에서 `registerAndLogin`/
  `createTeamWorkspace`/`uniqueEmail`/`uniqueName`/`createDbClient` 시그니처를 직접 열어
  e2e 스펙의 호출부(인자 개수·반환 타입 사용)와 대조 — 일치함.

## 발견사항

새로 발견된 결함 없음. 아래는 참고용 확인 사항이다.

- **[INFO]** `readColumnType`/`readOption` 의 string 인스턴스 캐너리가 실제로 추가되어 있음을
  코드에서 직접 확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` —
    `describe('옵션 리더는 리터럴을 만날 때까지 훑는다', ...)` 내 `'string 리더 —
    readColumnType 경로에서도 뒤의 리터럴을 집는다'` 테스트
  - 상세: `@Column({ type: dynamicType, type: 'numeric' })` 픽스처로 boolean 리더
    (`DUPLICATE_KEY`, `required` 축)와 별도로 string 리더(`readColumnType`, `type` 축) 양쪽
    인스턴스를 각각 고정했다. 직전 라운드 WARNING 이 정확히 이 자리를 지적했고, 조치가
    지적 범위에 정밀하게 대응한다(과대·과소 수정 없음).
  - 제안: 없음.

- **[INFO]** e2e 값 선택(`CREATED_THRESHOLD = 12.3456`, `PATCHED_THRESHOLD = 7.0625`)이
  `numeric(12,4)` 의 scale 을 정확히 채우는 값으로 유지되고 있음
  - 위치: `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts:70`-`71`
  - 상세: 정수를 썼다면 `Math.round`/`parseInt` 개입에도 단언이 통과하는 공허한 테스트가
    됐을 것이라는 근거가 주석에 남아 있고(`21_25_50` INFO#2 근거), 실제 값도 그 근거와
    일치한다. POST/PATCH 직후 in-memory 응답과 이어지는 GET 재조회(DB 왕복) 양쪽을 모두
    단언해, 저장 경로에서 정밀도가 깎이는 경우까지 커버한다.
  - 제안: 없음.

- **[INFO]** `[전제]` 테스트(스캔이 실제로 뭔가를 집었는지)와 위반-목록 테스트가 분리되어
  있어 "위반 0건" 의 공허성(스캔 자체가 안 됨 vs 진짜로 위반이 없음)을 가른다
  - 위치: `swagger-dto-contract.spec.ts:369`-`377` (`[전제] 스캔이 실재하는 numeric 컬럼과
    응답 DTO 를 집는다`)
  - 상세: 이전 라운드가 `ENTITY_DIR`/`RESPONSE_DTO_DIR` 뮤턴트로 이 구멍을 실측
    (`20_39_25` W3)했고, 그 대응이 지금도 유효하게 남아 있다. 실제 스키마 이름
    (`AlertRule.threshold` 등)에 결속돼 향후 컬럼명이 바뀌면 가드 로직과 무관하게 이
    테스트가 깨질 수 있다는 점은 이미 `21_45_58` 라운드가 INFO 로 기록·수용한 트레이드오프
    이며 이번 라운드에 새로 드러난 사실은 없다.
  - 제안: 없음(기존 판정 유지).

## 회귀 확인

- 기존 presence/null 축 대조군(`[대조군] presence 축`·`[대조군] null 축`·`[대조군]
  @Transform 예외`)은 이번 changeset 에서 로직 변경 없이 그대로 유지되고, 재실행 결과에
  포함되어 통과한다 — `readBooleanOption`→`readOption` 위임으로의 리팩터가 기존 축의 동작을
  깨지 않았음을 실행으로 확인했다.
- e2e 스위트 신규 파일 1개 추가는 기존 e2e 구조(다른 `*.e2e-spec.ts` 와 동일하게 `beforeAll`
  에서 워크스페이스를 새로 만들고 `afterAll` 에서 DB 커넥션만 정리)와 격리 방식이 같아,
  다른 e2e 스펙과 상태를 공유하지 않는다.

## 강점

- 정규식→AST 전환 회귀를 막는 `it.each` 캐너리 4종 + 포지셔널 `@Column` 캐너리 2종 +
  boolean/string 양쪽 인스턴스의 "리터럴까지 훑기" 캐너리 — 이 저장소가 실제로 놓쳤던
  위음성 형태를 전부 개별 픽스처로 못박아, 같은 결함이 조용히 재발할 경로를 계측 가능한
  실패로 바꿔 두었다.
- `withFiles` 중첩 경로 픽스처를 써서 `/entities/`·`/dto/responses/` 역할 판별 로직이 실제로
  분기되는 입력을 제공한다 — 평평한 tmpdir 이었다면 판별 자체가 성립하지 않아 단언이
  공허해졌을 것이라는 점을 이 파일 스스로 문서화하고 있고, 실제 구현도 그 형태다.
- e2e 는 in-memory 응답과 DB 재조회 응답을 모두 단언해 저장 경로 왕복 정밀도까지 검증한다.

## 요약

이번 changeset(`AlertRuleDto.threshold` wire 타입 정정 + 정적 가드 신설 + e2e)은 6라운드에
걸쳐 정규식 위음성 4형태, 포지셔널 `@Column` 인자, 경로 정규화, 스캔-전제 공허성, 옵션 리더
공유 헬퍼의 인스턴스별 캐너리 부재까지 순차적으로 실측·조치되어 현재 코드에 전부 반영돼
있다. 독립적으로 재실행한 결과(`34/34` unit PASS, `tsc` 무오류, e2e 헬퍼 시그니처 일치)도
직전 라운드의 보고와 일치했고, 이번 라운드에서 테스트 관점의 새로운 결함이나 커버리지 갭은
발견하지 못했다. 저장소 트리에는 뮤테이션을 가하지 않았다(`git status --short` 로 확인,
세션 산출 디렉터리 외 변경 없음).

## 위험도

NONE
