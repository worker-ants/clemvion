# 보안(Security) 리뷰 — error-code-emission-axis

## 범위 요약

이번 배치(16개 실질 diff hunk + 다수 이전 라운드 `review/**` 산출물 재포함)의 **실제 코드 변경**은 두 파일에 국한된다:

- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` — 정규식 3종(`QUOTED_LITERAL`/`MESSAGE_PREFIX`/`CATALOG_CODE`), 공용 수집 헬퍼 `collectMatches`, 수집 함수 3종(`collectQuotedLiterals`/`collectMessagePrefixes`/`collectCatalogCodes`), 판정 함수 `isMessagePrefixOnly`, 데이터 목록 `GUIDE_NON_EMITTED_VOCABULARY` 신규 추가.
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` — 위 신규 export 를 소비하는 테스트 블록("발행 축") + 헬퍼 `parseWhereRefs`/`staleGuideEntries` 추가.

나머지(`CHANGELOG.md`, `PROJECT.md`, `logic.mdx`/`logic.en.mdx`, `plan/**`, `review/code/**`, `review/consistency/**`)는 유저 가이드 문장 정정과 plan/리뷰 산출물이며 코드가 아니다. 두 소스 파일의 diff 는 프롬프트에 생략되어 있어 `git diff origin/main` 으로 직접 조회했다(각각 200줄·367줄 순증가, 삭제는 각각 3줄·기존 인라인 로직 1곳을 헬퍼 호출로 교체한 것뿐).

이 두 파일 모두 **Jest 테스트 스위트/정적 스캐너**이며 dev-time 전용이다. 런타임 프로덕션 경로(백엔드 API, 인증/인가, DB 쿼리, 외부 네트워크 호출, 시크릿 취급)에 대한 수정은 없다.

## 발견사항

- **[INFO]** 신규 정규식 3종의 ReDoS 가능성 — 안전 확인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:260`(`QUOTED_LITERAL`), `:263`(`MESSAGE_PREFIX`), `:266`(`CATALOG_CODE`)
  - 상세: 셋 모두 기존 상수 `UPPER_SNAKE = "[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+"` 를 그대로 감싼다. 첫 그룹(`[A-Z][A-Z0-9]*`)은 `_` 를 생성할 수 없고 둘째 그룹(`(?:_[A-Z0-9]+)+`)은 항상 `_` 로 시작해 두 정량자의 매치 범위가 겹치지 않는다 — catastrophic backtracking 의 전형 조건(모호한 부분 반복)이 성립하지 않는다. 호출부(`guide-identifier-existence.test.ts:74-81`)도 정적 리터럴이 아니라 저장소 자신의 소스·spec 파일을 읽어 넘기지만, 그 파일들은 사용자 입력이 아니라 빌드/CI 시점에 고정된 저장소 콘텐츠다. `matchAll` 기반이라 공유 `lastIndex` 오염도 없다.
  - 제안: 조치 불필요 — 기록용 INFO.

- **[INFO]** 신규 코드가 다루는 모든 파일 경로가 하드코딩된 저장소 상대경로
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:119-123`(`catalogCodes` — `path.join(root, "spec/5-system/3-error-handling.md")`), `:54-60`(`parseWhereRefs`)
  - 상세: `parseWhereRefs` 는 `GUIDE_NON_EMITTED_VOCABULARY`(같은 커밋의 저자가 작성한 정적 배열, `guide-identifier-scan.ts:333`)의 `where` 필드에서 `파일.ts:줄` 패턴을 정규식으로 추출하지만, 그 값으로 직접 `fs.readFileSync` 를 호출하지 않는다 — 뒤이어 `walkTree(root, ["codebase/backend/src"], { includeFile: (n) => n === path.basename(file), ... })` 로 **파일명만** 비교해 저장소 하위 트리를 탐색하고, 실제 open 은 `walkTree` 가 반환한 `hits[0].absPath` 로 한다. `path.basename` 이 `../`·절대경로 등 경로 조작 성분을 제거하므로 `where` 문자열이 임의 문자열이어도 트리 밖을 읽을 수 없다. 어차피 이 필드는 사용자 입력이 아니라 리포지토리 커미터가 작성하는 테스트 코드 리터럴이다.
  - 제안: 조치 불필요 — 경로 탐색 벡터 없음.

- **[INFO]** 하드코딩된 시크릿/자격증명 없음
  - 위치: 변경된 전 파일(`CHANGELOG.md`, `PROJECT.md`, `logic.mdx`/`logic.en.mdx`, `guide-identifier-scan.ts`, `guide-identifier-existence.test.ts`, `plan/**`, `review/**`)
  - 상세: 신규로 언급되는 식별자(`CONTAINER_MISSING_EMIT`, `CONTAINER_MULTIPLE_EMIT`, `MAKESHOP_UNRESOLVED_PATH_PARAM`, `MAX_ITERATIONS_EXCEEDED`)는 전부 에러 코드/로그 문자열 **이름**이며 API 키·비밀번호·토큰·인증서 값이 아니다. `GUIDE_NON_EMITTED_VOCABULARY`(`guide-identifier-scan.ts:333-356`)의 `where`/`why` 필드도 소스 파일명·줄 번호·설계 근거 산문일 뿐이다.
  - 제안: 조치 불필요.

- **[INFO]** `where` 문자열을 파싱하는 `parseWhereRefs` 가 신뢰 경계 밖 입력을 받지 않음을 재확인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:54-60`
  - 상세: 정규식 `/([\w./-]+\.ts):(\d+(?:·\d+)*)/g` 는 `GUIDE_NON_EMITTED_VOCABULARY.where`(코드에 하드코딩된 배열, 현재 3개 항목)에만 적용된다. 이 값이 런타임에 사용자·네트워크·CLI 인자로부터 오는 경로는 없다 — 인젝션·DoS 표면이 될 신뢰 경계 교차가 없다.
  - 제안: 조치 불필요.

이 변경은 오히려 문서 정확도를 높이는 방향이다 — "여러 개 또는 0개를 연결하면 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` **로 실행 실패해요**"(`logic.mdx` 구버전)라는 문장이 구조화된 `error.code` 로 오인될 여지를 없애고, 실제로는 실패 메시지 접두일 뿐임을 명시했다(`logic.mdx:114`, `logic.en.mdx:103`). 사용자가 `error.code` 필드를 그 값과 문자열 비교해 조건 분기를 짜는 등, 존재하지 않는 계약을 신뢰해 오동작하는 것을 예방하는 방향의 문서 정정이며 보안에 부정적 영향은 없다.

의존성 매니페스트(`package.json`, `pnpm-lock.yaml` 등) 변경은 없으며, 새로 도입된 외부 라이브러리도 없다(모두 Node 내장 `fs`/`path`, 표준 정규식).

## 요약

이번 변경은 유저 가이드 문서 2건의 서술 정정과, 그 정확성을 지속 검증하는 테스트 전용 정적 스캐너에 "발행 축"(에러 코드가 메시지 접두로만 쓰이는지 판별)을 추가한 것이다. 프로덕션 런타임 코드·API·인증/인가·DB·네트워크 경로는 전혀 건드리지 않는다. 신규 정규식은 기존에 안전성이 검증된 `UPPER_SNAKE` 패턴을 재사용해 ReDoS 위험이 없고, 신규 파일 조회 로직(`parseWhereRefs` + `walkTree`)은 파일명만 비교해 실제 파일을 여는 구조라 경로 탐색 벡터가 없다. 하드코딩된 시크릿, 인젝션 가능 지점, 인증/인가 로직 변경, 안전하지 않은 암호화·평문 전송, 민감정보 노출 에러 처리, 의존성 취약점 어느 것도 발견되지 않았다. 보안 관점에서 이 변경 세트의 위험은 사실상 없다.

## 위험도

NONE
