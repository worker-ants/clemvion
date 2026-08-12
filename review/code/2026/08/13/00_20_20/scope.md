# 변경 범위(Scope) Review — `00_20_20`

## 대상 diff 개요

`origin/main...HEAD` 47개 파일, 실 커밋 8개(`22e68459d` fix부터 `86de12278`까지) 누적분.
실질 코드/문서/plan 변경은 4파일뿐이다:

- 프로덕션: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
- 테스트: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`
- 문서: `CHANGELOG.md`
- plan: `plan/in-progress/backend-lint-gate-broken-on-main.md`

나머지 43개는 이 세션 안에서 실행된 `/ai-review` 3라운드(`23_24_08`, `23_36_13`, `23_48_38`)와
`/consistency-check --impl-done` 2라운드(`23_36_14`, `23_48_39`)의 산출물이다.

`git diff origin/main...HEAD --stat` 로 파일 목록을 직접 대조했고 프롬프트에 실린 목록과
일치함을 확인했다. 프롬프트에서 diff 가 생략된 파일 2·3(프로덕션·테스트 소스)은 `git diff`
로 직접 읽어 검토했다.

## 발견사항

- **[INFO]** 바깥(엔트리) JSON 손상 경로에도 warn 로그가 추가됨 — 최초 plan 표제("**내부**
  `responseJson` 손상은 무방비")보다 한 칸 넓은 변경이지만, 이미 **처분·반영 완료**된 사안이다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` —
    `discardCorruptEntry('엔트리', err, processFresh)` 호출부(`intercept()` 내 `switchMap`
    콜백, `JSON.parse(cachedJson)` catch 분기)
  - 상세: 이 확장은 `23_24_08`/`23_36_13`/`23_48_38` scope 라운드에서 3회 연속 INFO 로
    지적됐고, 매번 "같은 결함 클래스(조용한 강등)이고 5줄 안" 이라는 근거로 조치 불요
    처분됐다. 그런데 `23_48_38` INFO#10 이 "수용한다고 써 놓고 plan 제목은 실제로 안 고쳤다"
    를 다시 잡았고, 최신 커밋(`86de12278`)에서 실제로 `plan/in-progress/backend-lint-gate-broken-on-main.md`
    의 체크박스 제목이 "**캐시 엔트리 내부 `responseJson` 손상은 무방비**" → "**캐시 엔트리
    손상 처리 전체가 불완전하다**" 로 넓혀졌다(원제는 병기, 게이트 L610-613 부근). 이번
    라운드에서 재확인한 결과 이 항목은 더 이상 미결이 아니다 — 표제-실변경 간극이 실제로
    닫혔다.
  - 제안: 없음 — 이미 닫힌 항목.

- **[INFO]** `isIdempotencyEntry()` 타입 가드(형태 검사) 신설은 원 결함("`responseJson` 안쪽
  파싱 미방어")보다 넓은 방어 표면(문법은 유효하나 객체가 아닌 엔트리 — `null`/`42`/`[]` 등)을
  새로 커버하지만, 사전 기능 확장(over-engineering)이 아니라 **직전 리뷰 라운드가 실측으로
  찾아낸 진짜 결함의 폐쇄**다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:370`
    (`isIdempotencyEntry`), `:381`(`describeShape`), 호출부 `:170-174`
  - 상세: `23_48_38` testing 라운드가 무수정 프로브로 "`redis.get` 이 문법상 유효한 `'null'`
    을 반환하면 `cached.bodyHash` 접근에서 `TypeError`가 발생해 이 PR 이 없애려는 바로 그
    500 마스킹이 좁은 틈으로 살아 있다"를 실측했고(WARNING), 그 근거를 커밋 메시지
    (`86de12278`)가 그대로 인용한다. "캐시 손상이 요청 실패가 되지 않게 한다"는 이 PR 의
    핵심 주장 범위 안에 있는 sub-case 를 닫는 것이라, 새 기능 추가가 아니라 같은 주장의
    구멍을 메우는 정정이다. 뮤테이션으로 가드의 각 절이 정확히 1건씩 하중을 받는지까지
    검증됐다(1차: `Array.isArray` 절 관측 불가로 제거, 2차: fixture 를 조건-단독-위반형으로
    교체) — 방어를 넓히는 김에 불필요한 절을 끼워 넣는 방향은 아니었다.
  - 제안: 없음 — 결함 폐쇄로 판단, 조치 불요.

- **[INFO]** CHANGELOG·클래스 docstring 의 "fail-open 경로 개수" 표현이 두 차례 자기모순을
  겪었으나(`23_48_38` documentation WARNING), 최종 상태(`86de12278` 이후)는 코드·CHANGELOG·
  docstring 세 곳이 "다섯 경로 중 넷이 warn, 생성자 null 은 설정 상태라 제외"로 일치한다.
  이 자기모순 자체는 문서화 관점 사안이라 scope 이탈은 아니며, 참고로만 기록한다.
  - 위치: `CHANGELOG.md`(신규 섹션), `idempotency.interceptor.ts:62-79`(클래스 docstring 표)

- **[INFO]** review 산출물 43개 파일(`review/code/2026/08/12/{23_24_08,23_36_13,23_48_38}/**`,
  `review/consistency/2026/08/12/{23_36_14,23_48_39}/**`)이 diff 에 포함됨 — CLAUDE.md 가
  명시한 저장 경로 규약(`review/code/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`,
  `review/consistency/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`)과 정확히 일치하고, "구현 완료 후
  `/ai-review` + WARNING fix 는 상시 승인된 강제 의무"라는 프로젝트 규약에 따른 표준
  워크플로 부산물이다. 각 세션 산출물이 다음 세션의 fix 대상과 실제로 대응(WARNING→커밋
  본문 인용→plan 갱신)해 은폐되거나 무관하게 얹힌 파일이 아님을 확인했다.
  - 위치: 해당 없음(파일 전체가 신규 추가)
  - 제안: 없음 — 정상 워크플로 산출물.

의도 이상의 변경·불필요한 리팩토링·기능 확장(over-engineering)·무관한 파일·의미 없는
포맷팅·불필요한 주석/임포트·의도치 않은 설정 변경 — 실질적으로 해당 사항 없음. 소스 diff를
직접 읽은 결과 `switchMap` 콜백 재구조화(`processFresh`/`discardCorruptEntry` 추출), 파싱
순서 재배치, 형태 가드 신설, 테스트 4건+`it.each` 8-fixture 추가, docstring/CHANGELOG/plan
갱신 전부가 "캐시 엔트리(바깥+안쪽) 손상 시 500 마스킹을 막는다"는 단일 결함 폐쇄에
수렴한다. import 추가·삭제 없음, 포맷팅만 바뀐 hunk 없음(모든 hunk 가 실질 로직/문서 변경
동반).

## 요약

47개 파일 diff 중 실질 변경은 인터셉터 프로덕션 코드·테스트·CHANGELOG·plan 체크리스트
4파일뿐이며, 8개 커밋 전부가 "캐시 엔트리 내부 `responseJson` 손상이 500 으로 마스킹되는
결함"이라는 단일 plan 항목(과 그 항목이 리뷰 과정에서 넓어진 자매 sub-case 들)에 직접
결속된다. 세 차례 선행 scope 라운드가 지적한 "바깥 엔트리 warn 확장이 표제보다 넓다"는
INFO 는 이번 최종 커밋에서 plan 제목이 실제로 넓혀지며 닫혔고, 최신 커밋이 추가한
`isIdempotencyEntry()` 형태 가드는 기능 확장이 아니라 직전 라운드가 실측으로 찾아낸 동일
결함 클래스의 미해결 sub-case 폐쇄다. 나머지 43개 review 산출물 파일은 프로젝트가 강제하는
리뷰 워크플로의 표준 저장 경로에 정확히 안착한 것으로 scope 이탈이 아니다. 무관한 파일
수정, 사용하지 않는 import, 의미 없는 포맷팅, 불필요한 리팩토링, 은폐된 설정 변경은
발견되지 않았다.

## 위험도

NONE
