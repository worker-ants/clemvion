# 보안(Security) 리뷰 — error-code-emission-axis

## 범위 요약

이 변경 세트는 전부 다음 범주에 속한다:

- 문서(`CHANGELOG.md`, `PROJECT.md`, `logic.mdx`/`logic.en.mdx`) — 유저 가이드 문장 정정
- 테스트/가드 코드 (`guide-identifier-existence.test.ts`, `guide-identifier-scan.ts`) — 가이드 문서가 인용하는
  UPPER_SNAKE 식별자(에러 코드·env 변수)가 실제로 "방출"되는지 검사하는 정적 스캐너에 축 하나(발행 축)를 추가
- `plan/**`, `review/consistency/**` — plan 문서·리뷰 산출물(마크다운/JSON), 코드 아님

런타임 프로덕션 경로(백엔드 API, 인증/인가, DB 쿼리, 외부 네트워크 호출, 시크릿 취급)에 대한 수정은
**없다**. 스캐너(`guide-identifier-scan.ts`)는 CI/로컬 테스트 시점에 저장소 자신의 소스·문서 파일을
읽어 정적 검증만 수행하는 dev-time 전용 코드이고, 사용자 입력이나 네트워크 경계를 다루지 않는다.

## 발견사항

- **[INFO]** 신규 정규식 3종(`QUOTED_LITERAL`, `MESSAGE_PREFIX`, `CATALOG_CODE`)의 ReDoS 가능성 확인 — 문제 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (`QUOTED_LITERAL`/`MESSAGE_PREFIX`/`CATALOG_CODE` 정의부, 기존 `UPPER_SNAKE` 상수 재사용)
  - 상세: 세 정규식 모두 기존에 이미 쓰이던 `UPPER_SNAKE = "[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+"` 를 감싸는 형태다. 첫 그룹(`[A-Z][A-Z0-9]*`)은 `_`를 생성할 수 없고 둘째 그룹(`(?:_[A-Z0-9]+)+`)은 반드시 `_`로 시작하므로 두 정량자의 매치 범위가 겹치지 않아 catastrophic backtracking 조건(모호한 부분 반복)이 성립하지 않는다. 입력도 리뷰 대상 자체 저장소의 정적 텍스트(가이드 mdx·소스·spec)이며 외부/사용자 입력이 아니다. `matchAll`을 사용해 내부적으로 정규식을 복제하므로 공유 `lastIndex` 오염 문제도 없다(주석에 설계 근거 명시).
  - 제안: 조치 불필요 — 기록 목적의 INFO.

- **[INFO]** 스캐너가 읽는 파일 경로는 전부 하드코딩된 저장소 상대경로
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` (`collectCatalogCodes` 호출부, `path.join(root, "spec/5-system/3-error-handling.md")`)
  - 상세: 사용자 입력이나 외부 파라미터로 파일 경로를 구성하지 않는다 — 경로 탐색(path traversal) 벡터 없음.
  - 제안: 조치 불필요.

- **[INFO]** 하드코딩된 시크릿/자격증명 없음
  - 위치: 리뷰 대상 전 파일 (`CHANGELOG.md`, `PROJECT.md`, `*.mdx`, `guide-identifier-*.ts`, `plan/**`, `review/consistency/**`)
  - 상세: 문서·plan·리뷰 산출물 전수에서 API 키, 토큰, 비밀번호, 인증서 패턴을 찾지 못했다. 언급된 식별자(`CONTAINER_MISSING_EMIT`, `MAKESHOP_UNRESOLVED_PATH_PARAM`, `PARALLEL_ENGINE` 등)는 전부 에러 코드/환경변수 **이름**이지 값이 아니다.
  - 제안: 조치 불필요.

이 변경은 문서 정확도(에러 코드가 실제로는 메시지 접두일 뿐 구조화된 `error.code`로 발행되지 않는다는 점을 명확히 함)를 개선하는 것이며, 오히려 사용자가 잘못된 필드(`error.code`)를 신뢰해 오동작하는 것을 방지하는 방향의 수정이다. 보안 경계(인증/인가/입력검증/암호화/인젝션 표면)에 영향을 주는 코드 변경은 없다.

## 요약

이번 변경은 유저 가이드 문서 2건의 서술 정정과, 그 정확성을 지속적으로 검증하는 테스트 전용 정적 스캐너에 "발행 축" 하나를 추가한 것으로, 프로덕션 런타임 코드·API·데이터 처리 경로를 전혀 건드리지 않는다. 새로 추가된 정규식은 기존에 안전성이 검증된 `UPPER_SNAKE` 패턴을 재사용하고 있어 ReDoS 등 인젝션류 위험이 없으며, 하드코딩된 시크릿이나 인증/인가 로직 변경도 발견되지 않았다. 보안 관점에서 이 PR 은 영향이 사실상 없다.

## 위험도

NONE
