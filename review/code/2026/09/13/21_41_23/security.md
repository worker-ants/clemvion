# 보안(Security) 리뷰 — error-code-emission-axis (라운드 7)

## 검토 방법

`origin/main` 대비 143개 파일, 12,791줄 추가 diff 전체를 대상으로 했다. 프롬프트가 크기
제한으로 대부분 파일의 diff/전체 컨텍스트를 생략했으므로, 실질 코드 변경이 있는 두 파일
(`codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`,
`codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`)은 `Read` 로
저장소에서 직접 전문을 열어 확인했다. 나머지(`CHANGELOG.md`·`PROJECT.md`·
`logic{,.en}.mdx`·`plan/**`·`review/**`)는 문서·plan·이전 리뷰 세션 산출물이라 실행되는
코드가 없다. 저장소 파일은 읽기만 했고 아무것도 수정하지 않았다(`git status --short` 확인
불필요 — 뮤테이션 자체를 하지 않음).

이 배치는 6라운드(`19_23_22`→`21_19_46`)의 `/ai-review`+`--impl-done`을 이미 거쳤고, 매
라운드 security 리뷰어가 독립적으로 위험도 NONE을 냈다. 이번 라운드(7)의 증분은
`isMessagePrefixOnly`/`computeNonEmittedOffenders` 정본화·개명(`staleGuideEntries`)·
`FIELD_TABLE_NAME`/`BACKTICK_SPAN` 정규식의 fail-open 수정·주석 위치 정정이며, 이 전부가
정적 텍스트 스캐너 내부 로직 조정이다.

## 발견사항

- **[INFO]** 신규/조정된 정규식 전체(`FIELD_TABLE_NAME`, `CODE_FIELD`, `BACKTICK_SPAN`,
  `BACKTICK_INNER`, `QUOTED_LITERAL`, `MESSAGE_PREFIX`, `CATALOG_CODE`)에 ReDoS 가능성
  없음을 재확인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:137`(`UPPER_SNAKE`),
    `:156-159`, `:192`, `:226`, `:240`, `:260`, `:263`, `:266`
  - 상세: 모든 정규식이 `UPPER_SNAKE = "[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+"` 하나를 감싸는
    형태다. 첫 그룹(`[A-Z][A-Z0-9]*`)은 `_`를 만들 수 없고 둘째 그룹
    (`(?:_[A-Z0-9]+)+`)은 반드시 `_`로 시작해 두 정량자의 매치 범위가 겹치지 않으므로
    catastrophic backtracking 조건(모호한 부분 반복)이 성립하지 않는다. `FIELD_TABLE_NAME`의
    `\{[^}]*?\bname:...`, `BACKTICK_SPAN`의 `` `([^`\n]+)` ``도 부정 문자 클래스 기반이라
    선형이다. 입력은 리뷰 대상 저장소 자신의 소스·mdx·spec·`.env.example`/compose 파일이며
    외부/사용자 입력이 아니다(`guide-identifier-existence.test.ts`의 호출부 전수가
    `path.join(root, <하드코딩 상대경로>)`).
  - 제안: 조치 불필요 — 기록 목적의 INFO.

- **[INFO]** 파일 경로는 전부 하드코딩된 저장소 상대경로 — 경로 탐색(path traversal) 벡터 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:43-44`
    (`readIfPresent`), `:122`, `:143-144`(`collectCatalogCodes` 호출부,
    `path.join(root, "spec/5-system/3-error-handling.md")`)
  - 상세: `root`는 저장소 루트를 가리키는 상수이고 뒤에 붙는 문자열은 전부 리터럴이다.
    사용자 입력이나 외부 파라미터로 경로를 구성하지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** 하드코딩된 시크릿/자격증명 없음 — `git diff origin/main` 전수 grep
  (`password|secret|api[_-]?key|BEGIN (RSA|PRIVATE) KEY|AKIA...`) 결과 실제 값 매치 0건
  - 위치: 리뷰 대상 diff 전체
  - 상세: 유일한 매치는 이전 라운드 `security.md`(`19_23_22`) 안에 있는, grep 패턴 자체를
    설명하는 문장 하나뿐이며 실제 시크릿 값이 아니다. `MAKESHOP_UNRESOLVED_PATH_PARAM`·
    `CONTAINER_MISSING_EMIT`·`PARALLEL_ENGINE` 등 diff 전반에 등장하는 UPPER_SNAKE
    토큰은 전부 에러 코드/환경변수 **이름**이며 값이 아니다.
  - 제안: 조치 불필요.

- **[INFO]** `guide-identifier-scan.ts`/`guide-identifier-existence.test.ts`에
  `child_process`·`eval`·네트워크 호출·`process.env` 쓰기 없음을 직접 확인
  - 위치: 두 파일 전문 grep(`child_process|exec\(|eval\(`) — 매치 0건. `fs.readFileSync`만
    존재하고 쓰기(`writeFile`) 호출 없음.
  - 상세: 이 코드는 vitest 테스트 컬렉션 시점에만 실행되는 dev-time 정적 검증기이고,
    런타임 프로덕션 요청 경로(API·DB·인증)에 포함되지 않는다.
  - 제안: 조치 불필요.

이번 변경은 유저 가이드 문서 2건의 서술 정정("전용 에러 코드는 없으니 코드가 아니라
메시지를 봐야 해요")과, 그 정확성을 지속적으로 검증하는 테스트 전용 정적 스캐너의 판정
로직 정본화(`computeNonEmittedOffenders`)·정규식 fail-open 수정으로 구성된다. 오히려
사용자가 잘못된 필드(`error.code`)를 신뢰해 오동작하는 것을 방지하는 방향의 문서 수정이며,
보안 경계(인증/인가·입력검증·암호화·인젝션 표면)에 영향을 주는 런타임 코드 변경은 없다.

## 요약

이번 배치는 6라운드에 걸쳐 이미 보안 관점 NONE으로 반복 확인된 dev-time 문서 스캐너
코드에 판정 로직 정본화·정규식 정정·개명을 더한 것으로, 프로덕션 런타임 경로·API·DB·
인증/인가·시크릿 취급을 전혀 건드리지 않는다. 직접 읽은 두 실질 코드 파일(`guide-identifier
-scan.ts`, `guide-identifier-existence.test.ts`)은 전부 저장소 내부의 하드코딩된 경로만
읽는 순수 함수/테스트이며, 새 정규식도 기존에 안전성이 검증된 `UPPER_SNAKE` 패턴을
재사용해 ReDoS 위험이 없다. 하드코딩된 시크릿, 인젝션 벡터, 인증/인가 로직 변경은
발견되지 않았다.

## 위험도

NONE
