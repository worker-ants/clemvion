# 문서화(Documentation) 리뷰

## 사전 확인 사항

이 diff(`origin/main`(`d8b7cb93e`)..`HEAD`(`4d7888625`))는 이미 **8차례의 리뷰-수정 라운드**
(`01_49_18`=1R ~ `04_18_01`=8R)를 거친 결과물이다. 프롬프트에 첨부된 이전 라운드 산출물
(`01_48_39`·`01_49_18`·`02_12_38` 등, 파일 10 번대 이후)이 지적한 문서화 Warning
(W4 JSDoc orphan·W1 "왜 오탐이 없나" 과잉 보장 등)은 각각 후속 커밋에서 조치됐는지 이번
라운드에서 **소스를 직접 열어 재확인**했다(diff 만으로는 8라운드 누적 상태를 알 수 없어서다).

- `source-scan.ts`: `stripLiterals`(57~82)·`countCalls`(90~93)가 각자 자기 JSDoc 을 갖고
  있다. 1R W4(JSDoc orphan)는 해소된 채로 유지.
- `nullable-type-lie-cast-guard.ts`: `widenedEntityFields` docstring 의
  "## 이름 충돌을 빼는 이유"(129~166)가 2R W1(엔티티-비무관 이름 매칭 오탐)을 정확히
  반영하고, `isNullableType`(171~184) docstring 은 8R에서 발견된 "자매 함수 중 하나만
  하드닝" 비대칭이 소비처 두 곳(`widenedEntityFields`·`findUntypedNullableColumns`) 모두를
  가리키도록 갱신돼 있다(180~183). `findUntypedNullableColumns`(104~121)도 실제로
  `isNullableType`(113)을 호출한다 — docstring 이 약속한 대로 코드가 되어 있다.
- `nullable-type-lie-cast.spec.ts`: 174~178의 캐너리 설명이 "3R 에서 `widenedEntityFields`
  만 하드닝, 8R 에서 `findUntypedNullableColumns` 도 하드닝"이라는 실제 커밋 이력
  (`df552e4c8`→`4d7888625`)과 일치한다.
- `masked-reject-callers.spec.ts`의 신규 `describe('스캔 대상에 .spec.ts 가 포함된다', …)`
  가 실제로 `listSourceFiles`(`masked-reject-callers-guard.ts:47-52`)의 `includeSpec: true`
  배선을 직접 단언하고 있다(1R W4 계열의 "옵션 배선 층위 회귀" 방어).
- `plan/in-progress/entity-nullable-column-type-mismatch.md`의 두 "후속" 체크박스
  (§할 일, walker 추출 / 낡은 spec 캐스트 가드)는 `[x]` 로 표시돼 있고 서술이 현재 코드
  상태와 어긋나지 않는다. `status: in-progress` 는 여전히 남은 `[ ]` planner-턴 항목
  2건과 일치한다(허위 완료 아님).

## 발견사항

새로 보고할 CRITICAL/WARNING 은 없다. 아래는 이미 여러 차례 검토·판단된 항목이라 재조치를
요구하지 않는 참고 기록이다.

- **[INFO]** 4개 소비 가드의 walker 위임 함수 docstring 이 `.d.ts` 제외를 언급하지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:46`
    (`"대상 디렉터리의 .ts 소스를 모은다 (.spec.ts·.d.ts 제외)."` — 이 파일은 정확히
    언급함), `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts:47`
    (`"src/ 하위 .ts 전수 (node_modules·dist 제외)."` — `.d.ts` 제외 미언급),
    `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog-guard.ts:92`
    (`"src/ 하위 .ts 전수 (spec·dist 제외)."` — 동일)
  - 상세: `collectTsFiles`(`source-scan.ts:249-271`)는 이제 항상 `.d.ts` 를 제외하지만,
    이 사실이 세 함수 중 두 곳(`masked-reject-callers-guard`·`redis-fail-open-catalog-guard`)
    의 한 줄 docstring에는 빠져 있다. 다만 `source-scan.ts` 자체가 "`.d.ts` 제외 축은
    현재 `src` 하위 0개라 무해, 그래도 항상 켜 둔다"(228~245)고 근거를 남겨 뒀고, 이전
    라운드(`01_49_18` scope/maintainability)에서 이미 같은 지점을 INFO 로 기록하고
    조치 불필요로 판단한 이력이 있다. 완전성 차원의 사소한 결함이라 이번에도 조치를
    요구하지 않는다.
  - 제안: 조치 불필요(참고 기록). 다음에 이 파일들을 만질 때 한 줄만 맞추면 됨.

## 요약

이 diff 는 이미 8라운드의 리뷰-수정을 거쳐 문서화 관점에서 수렴한 상태다. `collectTsFiles`·
`stripLiterals`·`widenedEntityFields`·`findStaleSpecCasts`·`isNullableType` 등 신규/이관
공개 함수 전부가 "왜 필요한가/한계/오탐 방지 근거"를 갖춘 JSDoc 을 유지하고, 이전 라운드가
지적한 문서 결함(JSDoc orphan, 과잉 보장하던 "왜 오탐이 없나" 절, 옵션 배선 미검증)이 실제
소스에서 해소돼 있음을 직접 열어 확인했다. `plan/in-progress/entity-nullable-column-type-mismatch.md`
는 완료 체크박스마다 실측·뮤테이션 검증 결과를 인용하고, 남은 planner-턴 항목을 `[ ]`
그대로 유지해 `status: in-progress` 와 정합적이다. README/CHANGELOG 는 이 diff 범위(내부
test-utils/repo-guards 리팩터 + plan 문서)에서 갱신 대상이 아니며, 실제로 CHANGELOG.md 에
해당 항목이 없는 것도 이 판단과 일치한다(동작·API 영향이 있는 배치 1 의 `AuthConfigDto`
케이스만 CHANGELOG 항목화됨). 유일하게 남은 흠은 세 형제 walker 함수 중 두 곳의 한 줄
docstring이 `.d.ts` 제외를 언급하지 않는 완전성 수준의 INFO 로, 이전 라운드에서 이미
검토·기록된 사항이라 재조치를 요구하지 않는다.

## 위험도

NONE
