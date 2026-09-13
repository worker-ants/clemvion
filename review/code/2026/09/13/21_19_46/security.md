# 보안(Security) 리뷰 — error-code-emission-axis (재검토, 21_19_46)

## 범위 요약

이번 변경 세트(16개 이상 파일)는 다음 범주로만 구성된다:

- 유저 가이드 문서 정정: `codebase/frontend/src/content/docs/02-nodes/logic.mdx`,
  `logic.en.mdx` — `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 가 구조화된
  `error.code` 가 아니라 실패 메시지 접두일 뿐이라는 문장 정정 (KO/EN)
- 정적 테스트/가드 코드: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`,
  `guide-identifier-existence.test.ts` — 저장소 자신의 소스·spec·mdx 텍스트를 대상으로
  하는 dev-time 전용 문자열 스캐너에 "발행 축" 판정 3함수(`collectQuotedLiterals`,
  `collectMessagePrefixes`, `collectCatalogCodes`) + 정본 판정 함수
  (`isMessagePrefixOnly`, `computeNonEmittedOffenders`) + 신규 허용목록
  (`GUIDE_NON_EMITTED_VOCABULARY`) 추가
- `CHANGELOG.md`, `PROJECT.md`: 문서 갱신
- `plan/in-progress/**`, `review/consistency/**`, `review/code/2026/09/13/19_23_22|19_51_33/**`:
  plan 추적 문서와 이전 리뷰 라운드(consistency/ai-review)의 산출물(마크다운/JSON) — 코드 아님

런타임 프로덕션 경로(백엔드 API 핸들러, 인증/인가, DB 쿼리, 외부 네트워크 호출, 시크릿
취급)에 대한 수정은 **없다**. `guide-identifier-scan.ts`/`guide-identifier-existence.test.ts`
는 CI/로컬 테스트 시점에만 실행되며, 읽는 파일 경로는 전부 하드코딩된 저장소 상대경로
(`spec/5-system/3-error-handling.md`, `codebase/backend/src` 등)이고 사용자 입력·외부
파라미터로 구성되지 않는다 — 경로 탐색(path traversal) 벡터 없음.

## 발견사항

- **[INFO]** 신규 정규식 3종(`QUOTED_LITERAL`, `MESSAGE_PREFIX`, `CATALOG_CODE`)의 ReDoS
  가능성 — 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (`QUOTED_LITERAL`/
    `MESSAGE_PREFIX`/`CATALOG_CODE` 선언부, 기존 `UPPER_SNAKE` 상수를 감싸는 형태)
  - 상세: 세 정규식 모두 `UPPER_SNAKE = "[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+"` 를 리터럴 구분자
    (따옴표/백틱/`:`)로 감싼 선형 패턴이다. 모호한 부분-반복 구조(중첩 정량자)가 없어
    catastrophic backtracking 조건이 성립하지 않는다. `QUOTED_LITERAL` 의 역참조(`\1`)도
    캡처된 단일 문자를 재확인하는 것뿐이라 지수적 백트래킹을 유발하지 않는다. 게다가 입력은
    사용자/네트워크 입력이 아니라 저장소 자신의 정적 텍스트(가이드 mdx, 소스, spec)이고
    실행 시점도 dev-time 테스트뿐이라, 설령 병리적 패턴이었더라도 공격 표면이 되지 않는다.
    수집 함수(`collectMatches`)가 `String.prototype.matchAll` 을 쓰므로 기존 4곳의 수동
    `rx.lastIndex` 관리 패턴(재사용 시 리셋 누락이면 두 번째 호출부터 결과가 조용히
    준다는, 이 파일에 이미 등재된 결함 클래스)도 재도입하지 않는다.
  - 제안: 조치 불필요 — 기록 목적의 INFO.

- **[INFO]** `parseWhereRefs` 정규식도 동일하게 안전
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`
    (`parseWhereRefs` 함수, `/([\w./-]+\.ts):(\d+(?:·\d+)*)/g`)
  - 상세: `GUIDE_NON_EMITTED_VOCABULARY` 항목의 `where` 필드(개발자가 직접 작성한 짧은
    문자열, 최대 5건 상한)에만 적용된다. 그룹 경계가 리터럴 `.ts:` 로 분리돼 있어
    모호한 반복 겹침이 없고, 입력 길이도 사실상 상수(짧은 사유 문자열)이므로 ReDoS
    표면이 아니다.
  - 제안: 조치 불필요.

- **[INFO]** 신규 파일 읽기(`spec/5-system/3-error-handling.md`)에 경로 탐색 벡터 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`
    (`catalogCodes` 초기화부, `path.join(root, "spec/5-system/3-error-handling.md")`)
  - 상세: 경로가 완전히 하드코딩돼 있고 사용자·환경변수·외부 인자로 구성되지 않는다.
    `parseWhereRefs` 로 얻은 `file` 값도 `walkTree` 의 `includeFile: (n) => n ===
    path.basename(file)` 검색 필터로만 쓰이며, 그 값 자체가 파일시스템 경로로 직접
    사용되지 않는다(디렉터리 트리를 순회하며 basename 일치만 확인) — 이 필터에 `../`
    등을 넣어도 파일시스템 밖으로 나가지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** 하드코딩된 시크릿/자격증명 없음
  - 위치: 리뷰 대상 전 파일(`CHANGELOG.md`, `PROJECT.md`, `logic{,.en}.mdx`,
    `guide-identifier-*.ts`, `plan/**`, `review/consistency/**`, `review/code/2026/09/13/{19_23_22,19_51_33}/**`)
  - 상세: `git diff origin/main` 전수에서 API 키, 비밀번호, 토큰, 인증서, `Authorization`
    헤더 값 등의 패턴을 찾지 못했다. 언급되는 UPPER_SNAKE 식별자(`CONTAINER_MISSING_EMIT`,
    `MAKESHOP_UNRESOLVED_PATH_PARAM`, `EXECUTION_MAX_ACTIVE_RUNNING_MS` 등)는 전부 에러
    코드/환경변수 **이름**이지 값이 아니다.
  - 제안: 조치 불필요.

- **[INFO]** 인증/인가·인젝션·암호화·에러 처리 노출 표면에 대한 실질 변경 없음
  - 상세: `logic.mdx`/`logic.en.mdx` 문장 정정은 사용자가 이미 화면에서 보는 실패
    메시지에 대한 **서술**을 정정한 것으로, 오히려 사용자가 `error.code` 필드를 (실제로는
    존재하지 않는데) 신뢰해 잘못된 자동화·알림 매칭을 구축하는 것을 방지하는 방향이다.
    스캐너 코드(`guide-identifier-scan.ts`)는 순수 함수(인자로 받은 문자열 배열만 읽어
    `Set` 반환)이며 전역 상태·네트워크·DB 접근이 없다. 백엔드 런타임 코드
    (`execution-engine.service.ts` 등)는 이번 diff 에 포함되지 않았다 — 엔진의 실제
    발행 동작은 변경되지 않고 문서 서술만 실측에 맞춰 정정됐다.

## 요약

이 PR 은 유저 가이드 문서 2건의 서술 정정과, 그 정확성을 지속 검증하는 테스트 전용
정적 스캐너(dev-time only)에 "발행 축" 판정 로직을 추가한 것, 그리고 plan/review
추적 문서 갱신으로 구성되며 프로덕션 런타임 코드·API·DB·인증 경로를 전혀 건드리지
않는다. 신규 정규식 3종은 기존에 안전성이 확인된 `UPPER_SNAKE` 패턴을 리터럴 구분자로
감싼 선형 패턴이라 ReDoS 위험이 없고, 파일 읽기 경로는 전부 하드코딩된 상대경로라
경로 탐색 벡터가 없다. 하드코딩된 시크릿이나 인증/인가 로직 변경도 발견되지 않았다.
보안 관점에서 이 PR 의 영향은 사실상 없다.

## 위험도

NONE
