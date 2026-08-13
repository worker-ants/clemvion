# 변경 범위(Scope) Review

## 발견사항

없음.

검토한 3개 파일 모두 명시된 작업 목표(`readKey`/`hashBody` 경계값 테스트 부재,
`plan/in-progress/backend-lint-gate-broken-on-main.md`의 "함께 닫을 것" 항목으로 이미
예고된 `isIdempotencyEntry()` statusCode 범위 검사)와 정확히 일치한다. 무관한 파일·불필요한
리팩터링·포맷팅 잡음·임포트 정리·설정 변경은 발견되지 않았다.

### 파일별 확인 내역

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`
  - 신규 `describe('IdempotencyInterceptor — readKey / hashBody 경계값', …)` 블록 추가 —
    plan 체크리스트가 명시한 "키 길이 상한 · 공백뿐인 키 · non-string 헤더" 항목과 정확히 대응.
  - `makeContext()` 헬퍼의 `body` 정규화를 `opts.body ?? {}` → `'body' in opts ? opts.body : {}`
    로 변경(라인 131). 새로 추가한 `body: undefined`/`body: null` 동등성 테스트가 요구하는
    변경이며, 기존 테스트 중 `body` 키를 아예 생략한 케이스는 여전히 `{}`를 받으므로 회귀
    영향이 없음을 확인(`grep 'body: undefined\|body: null'` 결과 신규 테스트 2건 외 사용처 없음).
    변경 사유가 인접 주석(라인 127-130)에 명시돼 있어 "숨은 리팩터링"이 아니라 새 테스트가
    요구하는 최소 변경.
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
  - `!rawKey` → `rawKey === null`(라인 110) — truthiness 판정을 명시 비교로 좁혀 `readKey`의
    빈 문자열 처리 책임을 호출부와 분리. 새 경계 테스트가 요구.
  - `isHttpStatusCode()` 신규 함수 + `isIdempotencyEntry()`의 `typeof e.statusCode === 'number'`
    를 `isHttpStatusCode(e.statusCode)`로 교체(라인 380). `plan/in-progress/backend-lint-gate-broken-on-main.md`
    677-680행에 이미 "함께 닫을 것"으로 예고된 항목이라 이번 작업의 사전 승인된 범위.
  - 그 외 로직·주석·임포트 변경 없음.
- `plan/in-progress/backend-lint-gate-broken-on-main.md`
  - 체크박스 `[ ]` → `[x]` 전환 + 완료 노트(뮤턴트 10개 사살 근거) 추가. `CLAUDE.md`가 규정한
    "체크박스 = 실제 상태" 원칙에 부합하는 plan 갱신이며 developer 쓰기 권한 범위(`plan/**`) 내.

### 커밋 diffstat 대조

실제 커밋(`c29290c71`)의 `git show --stat` 결과가 review 대상 3개 파일과 정확히 일치
(`+266/-4`, 파일 수 3) — 리뷰 페이로드에 없는 파일이 몰래 섞여 들어간 정황 없음.

## 요약

이번 변경은 사전에 plan에 예고된 두 항목(경계값 테스트 부재 + `isIdempotencyEntry()` statusCode
범위 검사)만 정확히 구현했다. 테스트 헬퍼(`makeContext`)의 동작 변경도 새로 추가한 테스트가
직접 요구하는 최소 수정이고 기존 호출부에 영향이 없음을 확인했다. 프로덕션 코드 변경
(`rawKey === null`, `isHttpStatusCode()`)도 모두 새 테스트가 요구하는 범위 내이며 무관한
리팩터링·포맷팅·주석·임포트·설정 변경은 없다. plan 파일 갱신도 체크리스트 동기화 관례를 따른다.

## 위험도

NONE
