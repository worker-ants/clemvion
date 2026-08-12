# 변경 범위(Scope) Review

## 검토 대상

`git diff origin/main...HEAD --stat`(코드/문서 실질 변경, review 아티팩트 제외) 기준:

- `CHANGELOG.md` (+40)
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` (+552/-)
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (+216/-)
- `plan/in-progress/backend-lint-gate-broken-on-main.md` (+99)

나머지 100여 개 파일은 전부 `review/code/**`, `review/consistency/**` 아래 신규/삭제 파일로,
이전 리뷰·consistency-check 세션들의 표준 산출물이다.

작업 의도(plan 체크리스트, `plan/in-progress/backend-lint-gate-broken-on-main.md`): "`readKey`/
`hashBody` 경계값 테스트 부재" + 묶여 있던 서브 항목("`isIdempotencyEntry()` 의 `statusCode`
범위 검사") 완료, 그 위에 4라운드에 걸친 리뷰 라운드(`00_54_18`, `01_10_52`)의 WARNING fix 적용.

## 발견사항

없음.

### 실질 코드 변경 확인

- `idempotency.interceptor.ts`: `MIN_HTTP_STATUS_CODE`/`MAX_HTTP_STATUS_CODE` 상수 + 신설
  `isHttpStatusCode()` 로 `isIdempotencyEntry()` 의 `statusCode` 검사를 `typeof === 'number'` →
  정수+범위 검증으로 강화. `intercept()` 의 `!rawKey` → `rawKey === null` 명시 비교. 전부 plan
  이 "함께 닫을 것"으로 사전에 명시해 둔 항목(`plan/in-progress/backend-lint-gate-broken-on-main.md`
  의 `readKey`/`hashBody` 경계값 항목 하위)과 정확히 대응한다. 자발적 리팩터·무관 정리 없음
  (`git diff` 전체 대조 — 로직·주석 추가 외 순수 스타일 변경 없음).
- `idempotency.interceptor.spec.ts`: 신규 `describe('… readKey / hashBody 경계값 …')` 블록 +
  `makeContext()` 의 `body` mock 정규화(`opts.body ?? {}` → `'body' in opts ? opts.body : {}`,
  신규 nullish 동등성 테스트가 요구하는 최소 변경) + 직전 라운드 WARNING 대응(`99` 인접 경계
  케이스, 중복 헤더 조인 문자열 케이스, `toHaveBeenCalledTimes(1)` 선단언 4줄). 전부 plan/RESOLUTION
  이 명시한 항목에 결속돼 있고, 무관한 기존 테스트 블록의 재정렬·스타일 변경은 없다.
- `CHANGELOG.md`: 이번 diff 가 만든 클라이언트 가시적 동작 변화(손상 `statusCode` → 500 방지)를
  문서화한 신규 Unreleased 항목 1개. 기존 항목 형식(문제→원인→클라이언트 영향)을 그대로 따르고
  다른 항목은 건드리지 않았다.
- `plan/in-progress/backend-lint-gate-broken-on-main.md`: 체크박스 `[ ]`→`[x]` 전환 + 완료
  근거(뮤테이션 재실측, 생존 2건의 원인, docstring 서브항목 생략 사유, "13건"→"15건" 정정,
  선행 조건 충족 한 줄) 추가. `CLAUDE.md` "plan 체크박스 = 실제 상태" 원칙에 부합하며 developer
  쓰기 권한 범위(`plan/**`) 내. 이번 diff 로 새로 만든 다른 체크박스나 무관 섹션 수정은 없음.

### 직전 두 라운드(00_54_18, 01_10_52) 대비 증분 확인

`git log`(`f2785d8a0`, `e42b301db`) 로 이번 세션 직전 두 커밋을 개별 확인:

- `f2785d8a0`: plan 노트 "13건"→"15건" 정정 + `spec.ts` 4줄(`toHaveBeenCalledTimes(1)` 선단언) —
  둘 다 `01_10_52` RESOLUTION 이 약속한 WARNING #1·INFO #11 조치와 정확히 1:1 대응.
- `e42b301db`: 빠졌던 `review/code/2026/08/12/23_48_38/SUMMARY.md` 복원 + prepare-only 로 남은
  중복 consistency 세션 2건(`23_36_14`, `00_54_19`) 삭제 + plan 에 "선행 조건 충족" 한 줄 추가.
  전부 리뷰/plan 위생 문제의 직접 수정이며 무관 코드 변경 없음.

### 리뷰 산출물 다수 신규 파일에 대해

`review/code/2026/08/{12,13}/**`, `review/consistency/2026/08/{12,13}/**` 아래 신규(및 삭제)
파일들은 이번 PR 사이클에서 실행된 다수의 `/ai-review`·`/consistency-check` 세션의 표준 산출물
(`SUMMARY.md`/`RESOLUTION.md`/개별 reviewer md/`meta.json`/`_retry_state.json`)이다. `CLAUDE.md`
가 지정한 정규 저장 위치(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`,
`review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)에 정확히 부합하고, 앞선 세 라운드의
scope 리뷰(`23_48_38`은 architecture 축 포함 8명 중 scope NONE, `00_54_18`·`01_10_52` 모두
scope NONE)가 동일 결론에 이미 도달해 있다. 무관 파일 혼입이 아니라 이 프로젝트가 강제하는
"구현 완료 후 자동 review/fix" workflow 의 부산물이다.

### 스코프 밖 확인

`git diff origin/main...HEAD --name-only`를 `codebase/|CHANGELOG.md|plan/|review/` 패턴으로
걸러낸 결과 그 외 경로(설정 파일, CI 워크플로, 다른 모듈 소스, `spec/**` 등)는 0건 — spec 변경도
없다(개발자 권한상 `spec/` 은 read-only이며 실제로 diff 에 없음).

### 포맷팅·주석·임포트

diff 전체가 새 상수·새 함수·새 테스트·해당 로직에 밀접한 근거 주석(뮤테이션 실측 기반) 추가로
구성되며, 기존 로직의 순수 스타일 변경(공백·개행·import 재정렬)은 관찰되지 않는다. import 구문
자체에는 변경이 없다(`git diff` 상단 import 블록 불변 확인).

## 요약

이번 diff 는 plan 이 사전에 명시한 단일 체크리스트 항목("`readKey`/`hashBody` 경계값 테스트 +
`isIdempotencyEntry()` statusCode 범위 검사")과, 그 구현에 대해 이미 세 차례(직전 세션 기준)
진행된 리뷰 라운드가 요구한 WARNING fix 로 정확히 구성되어 있다. 프로덕션 코드 변경
(`isHttpStatusCode()` 신설, `rawKey === null` 전환)은 전부 신규 경계 테스트가 요구하는 최소
동반 변경이고, 테스트 헬퍼(`makeContext`) 변경도 신규 테스트가 직접 요구하는 범위 내다.
직전 라운드 이후 추가된 두 커밋(`f2785d8a0`, `e42b301db`)도 각각 RESOLUTION 이 약속한
조치·리뷰 위생 복구에 정확히 대응하며 새로운 무관 변경을 만들지 않았다. `spec/**`·CI·설정
파일 변경은 없고, 다수의 신규 `review/**` 파일은 프로젝트가 지정한 정규 저장 위치에 놓인 리뷰
workflow 의 정상 산출물이다. 범위 이탈·불필요 리팩터·기능 확장(over-engineering)·무관 파일
수정·포맷팅 오염·불필요 주석/임포트/설정 변경 어느 것도 발견되지 않았다.

## 위험도

NONE
