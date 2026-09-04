# 변경 범위(Scope) 리뷰

## 검토 방법

`git log --oneline origin/main..HEAD`(13개 커밋) + `git diff --stat origin/main...HEAD`(90개
파일, +8042/-15) + 개별 커밋 `git show --stat`으로 실제 변경을 전수 확인했다. 저장소 트리에는
아무것도 쓰지 않았다(`git status --short` 확인 — 이번 세션의 미커밋 산출물
`review/code/2026/09/04/22_06_43/` 외 잔여물 없음).

90개 파일 중 **실질 코드/문서 변경은 6개**, 나머지 **84개는 이전 4개 코드 리뷰 라운드
(`19_43_18`·`20_16_17`·`20_39_25`·`21_10_30`·`21_25_50`·`21_45_58` — 6라운드)와 1개
consistency-check 라운드(`20_05_42`)의 산출물이 `review/code/**`·`review/consistency/**`에
신규 커밋되는 것**이다. 이는 `CLAUDE.md`가 명시하는 "코드 리뷰 산출물은 `review/code/<YYYY>/…`"
저장 규약과, `developer` 가 `review/**`에 대해 쓰기 권한을 갖는다는 규약, 그리고 직전 세 라운드
(`20_16_17/scope.md`, `20_39_25/scope.md` 등)가 이미 반복 확인한 "리뷰 라운드 산출물을 그
라운드가 지적한 수정과 함께 커밋"하는 이 저장소의 표준 워크플로와 정확히 일치한다.

## 항목별 확인

1. **의도 이상의 변경**: 없음. 13개 커밋 전부 `AlertRuleDto.threshold`가 `number`로 잘못
   문서화됐지만 wire 는 `string`이라는 단일 결함, 그 정정, 그 결함을 되잡는
   `swagger-dto-contract` 가드 신설/보강(원시 타입 축), 그 보강 과정에서 나온 리뷰
   라운드들의 fix 로만 구성된다. 커밋 로그(`a65a4f85e`→`5a7de8ab1`→`dc83c0312`→
   `c15489e61`→`b5d5210cf`→`40005a6e0`→`4e7a52bc9`→`5076b7e81`, 사이사이 `docs(review)`
   5건)가 하나의 연속된 서사를 이룬다.
2. **불필요한 리팩토링**: `readBooleanOption`을 제네릭 `readOption<T>`로 통합하고
   `readStringOption`을 신설한 변경(`swagger-dto-contract-guard.ts:58-113` 부근)이 유일한
   비-append 리팩토링인데, 이는 `20_39_25/RESOLUTION.md` W2(코드 중복 12줄)의 직접 조치이자
   신규 `readStringOption`이 `@Column('numeric', {...})`의 `type:` 문자열 옵션을 읽기 위해
   실제로 필요해서 만들어진 것이다(드라이브바이 아님). 신규 `toPosixPath` import 도
   `:378`에서 실사용을 확인했다(미사용 아님).
3. **기능 확장**: `findNumericAsNumber` 축 신설은 "DTO 필드 하나 정정"보다 넓어 보이지만,
   같은 결함 클래스(원시 타입 불일치)의 재발 방지책이며 저장소가 이미 반복해 온 패턴
   (결함 발견 → 필드 수정 + 그 클래스를 잡는 전역 가드 신설, 예: `e55b3a74a`)과 일치한다.
   과잉설계로 보기 어렵다.
4. **무관한 수정**: 없음. `plan/in-progress/spec-draft-nullable-notation-followups.md`의
   누적 diff(`git diff origin/main...HEAD` 확인)는 267~345줄 구간(검증자 (a)/(b) 항목과
   그 직후 planner 후속 3건)에 국한되고, 문서의 다른 섹션(①②③, Rationale 등)은 건드리지
   않았다.
5. **포맷팅 변경**: 실질 코드 파일(`alert-rule-response.dto.ts`,
   `swagger-dto-contract-guard.ts`, `swagger-dto-contract.spec.ts`,
   `alerts-threshold-wire-type.e2e-spec.ts`)의 hunk 는 모두 대상 로직에 국한되고 무관한
   재포맷은 관측되지 않았다.
6. **주석 변경**: DTO JSDoc이 길지만 같은 계열 자매 커밋(`d8b7cb93e`)과 동일 하우스 스타일이며,
   이번 changeset 내 `dc83c0312`가 그 서사를 `//`(내부용)와 JSDoc(공개 description)으로
   분리해 이전 라운드 WARNING(내부 서사가 공개 OpenAPI description으로 유출)을 스스로 조치했다.
7. **임포트 변경**: `toPosixPath` 신규 import 는 사용처 확인(`:378`). 그 외 임포트 변경 없음.
8. **설정 변경**: 없음. 90개 파일 중 설정 파일(`.json` 설정류)은 review 산출물의
   `meta.json`/`_retry_state.json`뿐이며 이는 리뷰 세션 상태 기록이지 애플리케이션 설정이
   아니다.

## 발견사항

발견된 범위 이탈 없음.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md`에 이번 changeset
  중 두 개의 서로 다른 planner 후속 항목(`swagger.md` numeric 불변식 성문화,
  `spec/1-data-model.md:873` `Float`→실제 타입 라벨 정정, `swagger.md` 내부서사/공개설명
  분리 가이드)이 "같은 편집 세션에 묶는다"는 지시와 함께 등재됐다. 이는 spec 변경 자체가
  아니라 향후 planner 턴을 위한 등재이므로 developer 권한 밖 spec 을 직접 건드리지 않았다는
  점에서 범위 이탈이 아니다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (검증자 (a)/(b) 항목
    직후 신설된 세 개 체크박스)

## 요약

13개 커밋·90개 파일의 누적 diff를 `git log`/`git show --stat`/`git diff --stat`으로 전수
대조한 결과, 실질 코드·문서·plan 변경(6파일)은 전부 "`AlertRuleDto.threshold`가 `number`라고
문서화됐지만 wire 는 `string`이다"라는 단일 결함과 그 재발 방지(가드 원시 타입 축 신설·보강),
그리고 그 결함을 다룬 리뷰 라운드들 자신의 검증 과정(뮤테이션 예측/실측, e2e 정밀도 대조군
보강 등)에만 결속되어 있다. 유일한 비-append 리팩토링(`readOption<T>` 통합)은 직전 라운드
리뷰가 지적한 중복을 조치한 것이자 신규 축에 실제로 필요해서 만들어졌다. 나머지 84개 파일은
6개 코드 리뷰 라운드 + 1개 consistency-check 라운드의 산출물이 `review/**`에 신규 커밋되는
것으로, 이 저장소가 이미 여러 차례(`20_16_17/scope.md`, `20_39_25/scope.md` 등) 확인한 표준
워크플로를 그대로 따른다. 불필요한 리팩토링·기능 확장(over-engineering)·무관한 파일 수정·
의미 없는 포맷팅·불필요한 주석/임포트·의도치 않은 설정 변경 — 어느 것도 발견되지 않았다.

## 위험도

NONE
