# 변경 범위(Scope) 리뷰

## 검토 방법

`git diff --stat origin/main...HEAD` 로 실제 changeset 이 프롬프트에 제시된 38개 파일과
정확히 일치함을 확인했다(워킹트리는 이 리뷰가 만든 세션 디렉터리 외 clean). 실제 코드/문서
소스는 5개, 나머지 33개는 이전 두 라운드(코드 리뷰 `19_43_18`·`20_16_17`, consistency
`20_05_42`)의 산출물이 신규 파일로 커밋된 것이다. 저장소 쓰기는 하지 않았고 `git show`/
`git diff`/`git log -S`/`Read` 만 사용했다.

핵심 5개 파일 각각의 전체 diff 를 직접 열어(프롬프트의 truncation 표시 부분 포함) 대조했다:

1. `CHANGELOG.md` — 파일 최상단에 신규 섹션만 삽입(`@@ -1,5 +1,43 @@`), 기존 항목은 무변경.
2. `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` —
   `threshold` 필드의 타입·데코레이터·JSDoc 만 치환(`@@ -17,9 +17,16 @@`), 인접 필드 무변경.
3. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — 기존 함수
   (`findSwaggerContractMismatches`, `readBooleanOption` 등)는 **전혀 손대지 않고**, 새 함수
   (`readStringOption`, `collectNumericFields`, `collectDtoFieldTypes`, `findNumericAsNumber`)
   와 상수(`ENTITY_DIR`, `RESPONSE_DTO_DIR`)만 파일 끝에 추가. 기존 import 문 한 줄에 `toPosixPath`
   추가(신규 함수가 실제로 사용).
4. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` — 기존 테스트는
   무변경, 파일 끝에 새 `describe` 블록만 추가. `withFiles` import 는 신규가 아니라
   `codebase/backend/src/common/__test-utils__/temp-fixture.ts` 에 origin/main 시점부터
   이미 존재하던 헬퍼(`git show origin/main:...` 로 확인)를 가져다 쓴 것.
5. `plan/in-progress/spec-draft-nullable-notation-followups.md` — diff 범위가 `267~313` 줄,
   즉 "검증자 (a)/(b)" 체크리스트 항목 하나에 국한된다. 반증된 (a) 안은 취소선으로 **보존**하고
   그 자리에 실측 결과를 이어 붙이는 방식(자기-반증형 소정정 관례)으로, 문서의 다른 절은
   무변경.

나머지 33개 파일(`review/code/2026/09/04/19_43_18/**`, `review/code/2026/09/04/20_16_17/**`,
`review/consistency/2026/09/04/20_05_42/**`)은 전부 `new file mode`(신규 파일) — 기존 코드를
건드리지 않는다. `_retry_state.json`(절대경로 포함 harness 상태) 커밋도 이 저장소에서
반복적으로 나타나는 기존 패턴임을 `git log --all -- '**/_retry_state.json'` 로 확인했다
(예: `d8b7cb93e` 가 동일 형태의 `_retry_state.json` 2개를 이미 커밋한 전례가 있다). `review/`
산출물 커밋은 CLAUDE.md 의 "정보 저장 위치" 표(코드 리뷰 산출물 → `review/code/...`, 일관성
검토 산출물 → `review/consistency/...`)와 일치하는 이 저장소의 표준 워크플로다.

## 발견사항

발견된 범위 이탈 없음.

- **[INFO]** 이번 diff 는 3커밋(`a65a4f85e` fix → `5a7de8ab1` test → `dc83c0312` docs, 그리고
  `c15489e61` 후속 fix)이 누적된 상태이며, 그 사이 두 차례의 `/ai-review` 라운드 산출물
  (33개 신규 파일)이 함께 커밋되어 있다. 이는 "범위 이탈"이 아니라 이 저장소의 review-fix
  루프가 만든 감사 기록이지만, changeset 크기(2,512줄 삽입 중 2,462줄이 review 산출물)만
  보면 코드 리뷰 대상 범위를 오판하기 쉽다는 점은 참고로 남긴다.
  - 위치: 전체 diff (`git diff --stat origin/main...HEAD`)

## 항목별 확인

1. **의도 이상의 변경**: 없음. 실질 코드/문서 변경 5파일은 "`AlertRuleDto.threshold` wire 타입
   정정 + 회귀 가드 신설 + CHANGELOG/plan 기록"이라는 단일 서사에 정확히 대응한다.
2. **불필요한 리팩토링**: 없음. 가드 파일에서 정규식→AST 전환(`readStringOption` 등)과
   `toPosixPath` 정규화는 **이번 PR 이 새로 추가한 `findNumericAsNumber` 자체의 결함**을
   같은 PR 안에서 리뷰가 잡아 고친 것이지, 기존 코드(`findSwaggerContractMismatches` 등)를
   건드린 것이 아니다.
3. **기능 확장**: 없음. wire 는 불변이며(`ClassSerializerInterceptor` 부재로 런타임 직렬화에
   DTO 가 관여하지 않음), 신설 가드도 "정밀도 손실로 이어지는 한 축"만 좁게 겨눈다고 문서화돼
   있다(전수 대조 대신).
4. **무관한 수정**: 없음. `plan/` 문서 diff 도 해당 체크리스트 항목에 국한.
5. **포맷팅 변경**: 없음. 각 hunk 가 대상 블록만 좁게 치환.
6. **주석 변경**: JSDoc/docstring 이 길지만(예: `threshold` 필드 JSDoc, `findNumericAsNumber`
   상단 docstring) 이 저장소가 반복적으로 쓰는 "왜 이 축이 필요한가 + 리뷰 라운드 ID 인용" 하우스
   스타일과 일치한다(`d8b7cb93e` 등 자매 커밋과 동일 패턴).
7. **임포트 변경**: 두 건 모두 신규 코드가 실제로 쓰는 심볼(`toPosixPath`, `withFiles`,
   `findNumericAsNumber`) 추가뿐, 불필요한 정리·삭제 없음.
8. **설정 변경**: 없음. 5개 실질 파일 중 설정 파일은 없다(`nest-cli.json` 은 DTO JSDoc 안에서
   *언급*만 되고 실제로 수정되지 않음 — `git diff --stat` 에 해당 파일 없음을 확인).

## 요약

`git diff origin/main...HEAD` 실측 결과 실질 코드/문서 변경은 정확히 5개 파일이며, 전부
"`AlertRuleDto.threshold` OpenAPI 선언이 실제 wire(`numeric` 컬럼 → 문자열)와 어긋난 것을
정정 + 그 사각지대를 구조적으로 막는 회귀 가드 신설 + CHANGELOG/plan 기록"이라는 단일 서사에
결속돼 있다. 각 파일의 diff 를 직접 열어 확인한 결과 기존 코드(기존 가드 함수, 기존 테스트,
plan 문서의 다른 절)를 건드린 흔적이 없고, 리팩토링·기능 확장·무관한 파일·포맷팅 뒤섞임·
불필요한 임포트/설정 변경 어느 항목도 관측되지 않았다. 나머지 33개 파일은 이전 두 리뷰
라운드와 consistency 체크의 산출물이 신규 파일로 커밋된 것으로, `review/code/**`·
`review/consistency/**` 경로 관례와 `_retry_state.json` 커밋 전례(`git log`로 확인) 모두
이 저장소의 기존 워크플로와 일치해 범위 이탈로 볼 근거가 없다.

## 위험도

NONE
