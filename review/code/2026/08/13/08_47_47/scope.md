# 변경 범위(Scope) Review

## 검증 방법

프롬프트에 첨부된 diff 는 17개 이상 파일로 조립돼 있어 프롬프트 크기 제한으로 일부가
생략(`... 생략 — 원본 파일 참조 ...`)돼 있었다. `git diff origin/main...HEAD` 로 실제 저장소에서
전체 diff 를 직접 재확인했다(`--stat` 로 전체 파일 목록, 이어서 프로덕션 코드 4개 파일은 전문을
재조회).

```
$ git diff origin/main...HEAD --stat
 CHANGELOG.md                                        |  17 ++
 .../idempotency.interceptor.spec.ts                 | 267 +++++++++++++++++++-
 .../idempotency.interceptor.ts                      |  40 ++-
 .../backend-lint-gate-broken-on-main.md             |  41 +++-
 review/code/**                                      | (다수, 이전 리뷰 라운드 산출물)
 review/consistency/**                                | (다수, 컨시스턴시 체크 산출물)
 64 files changed, 4285 insertions(+), 17 deletions(-)
```

## 발견사항

없음.

**프로덕션/문서 코드 변경 4개 파일**(`CHANGELOG.md`,
`codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`,
동일 디렉터리의 `.spec.ts`, `plan/in-progress/backend-lint-gate-broken-on-main.md`)은 전부
plan 체크리스트가 이미 예고해 둔 두 항목("`readKey`/`hashBody` 경계값 테스트 부재" ·
`isIdempotencyEntry()` 의 `statusCode` 형태 검사를 범위 검사로 강화)과 정확히 대응한다.

- `idempotency.interceptor.ts`: `isHttpStatusCode()` 신설(+ `MIN_HTTP_STATUS_CODE`/
  `MAX_HTTP_STATUS_CODE` 상수), `isIdempotencyEntry()` 의 `typeof e.statusCode === 'number'` 를
  `isHttpStatusCode(e.statusCode)` 로 교체, `intercept()` 의 `!rawKey` truthiness 판정을
  `rawKey === null` 명시 비교로 좁힘, `readKey()` 에 JSDoc 추가. 이 외 로직·import·설정 변경
  없음(전문 재조회로 확인).
- `idempotency.interceptor.spec.ts`: 신규 5번째 `describe('IdempotencyInterceptor — readKey /
  hashBody 경계값', …)` 블록(키 길이 상한 양쪽 경계 · 공백/탭 키 · trim 동등성 · 배열 헤더 ·
  조인 문자열 헤더 · 키 순서 의존 · body undefined/null 동등성 · statusCode 무효/유효 경계
  `it.each`) + 모듈 docstring 에 다섯 번째 블록 색인 추가 + `makeContext()` 의 `body` 정규화를
  `opts.body ?? {}` → `'body' in opts ? opts.body : {}` 로 변경(새 nullish 동등성 테스트가 직접
  요구하는 최소 변경이며, 근거 주석이 인접해 남아 있다). 다른 기존 `describe` 블록·헬퍼 로직은
  건드리지 않았다.
- `CHANGELOG.md`: 같은 클래스의 기존 500-방지 항목들과 같은 형식(문제 → 원인 → 클라이언트 영향)
  으로 이번 `isHttpStatusCode()` 방어에 대응하는 Unreleased 항목 1건만 추가.
- `plan/in-progress/backend-lint-gate-broken-on-main.md`: 해당 체크박스 `[ ]` → `[x]` 전환 +
  완료 근거(테스트 개수 실측, 뮤테이션 결과, 생존 뮤턴트 2건의 원인과 조치) 서술, 그리고 별도
  항목에 후속 spec 갱신 착수 가능 여부를 알리는 노트 한 단락 추가. 둘 다 `plan/**` 범위 내
  문서 갱신이며 코드 실행에 영향 없다.

**나머지 60개 파일**은 전부 `review/code/2026/08/13/{00_54_18,01_10_52,01_31_17,01_40_25}/**`
와 `review/consistency/2026/08/13/{01_10_53,01_49_10}/**` 아래의 이전 리뷰·컨시스턴시 라운드
산출물이다. `CLAUDE.md` 의 "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`"
규약과 memory 항목("`review/` 는 gitignored 아님", "plan 체크박스 = 실제 상태")에 따라 이 저장소는
매 리뷰 라운드 산출물을 커밋하는 것이 표준 워크플로다. 이번 브랜치가 같은 PR 안에서 여러 라운드
(00_54_18 → 01_10_52 → 01_31_17 → 01_40_25, 컨시스턴시 01_10_53 → 01_49_10)를 거치며 수렴했고
그 산출물이 순차 커밋된 것으로, "무관한 파일 수정"이 아니라 이 프로젝트가 강제하는 리뷰 워크플로의
정상적 부산물이다. 내용도 실제 코드 diff(위 4개 파일)에 대한 리뷰·수정 이력과 일관되게 대응한다.

참고: 같은 세션 디렉터리에 있는 `review/code/2026/08/13/08_36_21/scope.md` 는 이 브랜치가
rebase 되기 전(#1158 squash 머지로 충돌 발생 이전) 시점의 다른 diff(OTel `clemvion.redis.fail_open`
카운터 배선)를 대상으로 한 리뷰였다. `REBASE-NOTE.md` 의 실측(rebase 전후 5개 파일 바이트 동일
확인)에 따르면 그 diff 는 이미 `origin/main` 에 별도 PR(#1158)로 병합돼 현재 diff 범위 밖이다 —
`git diff origin/main...HEAD --stat` 에도 `business-metrics.service.ts` 등 해당 파일이 없음을
확인했다. 즉 08_36_21 의 지적(신규 `describe` 삽입 위치)은 이번 diff 의 대상이 아니다.

## 요약

`git diff origin/main...HEAD` 를 직접 조회해 재확인한 결과, 실질 프로덕션/문서 변경은 plan 이
사전에 예고한 두 항목(경계값 테스트, `statusCode` 범위 검사)에 정확히 대응하는 4개 파일뿐이며
무관한 리팩터링·기능 확장·포맷팅 잡음·불필요한 import·설정 변경은 없다. diffstat 상 파일 수가
64개로 커 보이지만 그중 60개는 이 저장소가 의무화한 리뷰 워크플로(각 라운드의 `review/code/**`,
`review/consistency/**` 산출물 커밋)의 정상적 부산물이며, 실제 코드 변경 이력과 내용이 일관된다.
이전 4회의 scope 리뷰(00_54_18/01_10_52/01_31_17/01_40_25)도 매 라운드 "발견사항 없음" 또는
경미한 문서 위치 지적뿐이었고 이번 재확인에서도 새로운 범위 이탈은 발견되지 않았다.

## 위험도

NONE
