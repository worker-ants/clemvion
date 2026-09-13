# 보안(Security) 리뷰 — error-code-emission-axis (round 3, 22_06_10)

## 범위 요약

`origin/main` 대비 실질 변경은 8개 파일이다:

- 문서: `CHANGELOG.md`, `PROJECT.md`, `codebase/frontend/src/content/docs/02-nodes/logic.mdx`, `logic.en.mdx` — 유저 가이드 문장 정정(`CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 가 구조화된 `error.code` 가 아니라 메시지 접두일 뿐이라는 서술 정정)
- 테스트 전용 정적 스캐너: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`, `guide-identifier-existence.test.ts` — 유저 가이드가 인용하는 UPPER_SNAKE 식별자가 실제로 "방출"되는지 검사하는 dev-time 스캐너에 발행 축(정규식 3종 + 수집기 3함수 + 판정 함수 2개 + 허용목록 1개) 추가
- `plan/in-progress/error-code-emission-axis.md`(신규), `plan/in-progress/spec-draft-nullable-notation-followups.md`(추가분) — plan 추적 문서

나머지(`review/**` 다수 파일)는 이전 라운드(`19_23_22`, `19_51_33`, `20_13_13` 등)의 리뷰/consistency-check 산출물이 이번 커밋 범위에 동반 포함된 것으로, 새로 작성된 코드가 아니라 과거 리뷰 세션의 기록이다. 그 안에서 이미 각 축(security 포함)이 자체적으로 검토를 마쳤고(모두 위험도 NONE), 이번 라운드에서 추가로 지적할 신규 보안 결함은 그 파일들 안에서 발견되지 않았다.

런타임 프로덕션 경로(백엔드 API, 인증/인가, DB 쿼리, 외부 네트워크 호출, 시크릿 취급)에 대한 수정은 **없다**. 스캐너는 vitest 로만 실행되는 dev-time 전용 코드이고, 저장소 자신의 소스·문서 파일(고정 상대경로)만 읽어 정적 검증을 수행하며 사용자 입력이나 네트워크 경계를 다루지 않는다.

## 발견사항

- **[INFO]** 신규 정규식 3종(`QUOTED_LITERAL`, `MESSAGE_PREFIX`, `CATALOG_CODE`)의 ReDoS 가능성 — 문제 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (`QUOTED_LITERAL`/`MESSAGE_PREFIX`/`CATALOG_CODE` 정의부)
  - 상세: 세 정규식 모두 기존에 이미 검증된 `UPPER_SNAKE = "[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+"` 를 감싸는 형태다. 첫 그룹은 `_` 를 생성할 수 없고 둘째 그룹은 반드시 `_` 로 시작해 두 정량자의 매치 범위가 겹치지 않으므로 중첩 정량자로 인한 재앙적 백트래킹 조건이 성립하지 않는다. `QUOTED_LITERAL` 은 역참조(`\1`)를 추가로 쓰지만 역참조 자체는 정량자를 감싸지 않아 이차 폭발 요인이 아니다. 입력도 사용자/네트워크 입력이 아니라 리뷰 대상 저장소 자신의 정적 텍스트(가이드 mdx·backend/packages 소스·spec)다.
  - 제안: 조치 불필요.

- **[INFO]** 스캐너·테스트가 다루는 모든 파일 경로는 하드코딩된 상수이거나, 신규 `resolveSourceLines()` 의 경우도 입력이 `GUIDE_NON_EMITTED_VOCABULARY`(같은 소스 파일 안의 상수 리터럴)에서만 파생된다 — 경로 탐색(path traversal) 벡터 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` — `resolveSourceLines()`(신규 함수), 호출부(발행 축 `where` 검증 `it` 블록)
  - 상세: `resolveSourceLines(file)` 은 `path.basename(file)` 로 정규화한 뒤 `walkTree(repoRoot(), ["codebase/backend/src"], …)` 로 **정확히 그 이름과 일치하는 파일만** 찾고, 매치가 1건이 아니면(0건·2건 이상) `null` 을 반환해 실패를 명시적으로 표시한다. `file` 값은 사용자 입력이 아니라 `parseWhereRefs(entry.where)` 가 파싱한 `GUIDE_NON_EMITTED_VOCABULARY` 배열의 하드코딩된 `where` 문자열에서만 나온다 — 외부/네트워크/사용자 입력이 개입할 경로가 없다. `..`/절대경로 조작 여지도 `path.basename` 이 디렉터리 구분자를 제거하므로 없다.
  - 제안: 조치 불필요.

- **[INFO]** 하드코딩된 시크릿/자격증명 없음
  - 위치: 리뷰 대상 diff 전체 (`CHANGELOG.md`, `PROJECT.md`, `*.mdx`, `guide-identifier-*.ts`, `plan/in-progress/*.md`)
  - 상세: `grep -iE "password|secret|token|api[_-]?key|credential|Bearer |ssh-rsa"` 로 plan 문서를 포함해 확인했고, API 키·비밀번호·인증서·private key 패턴은 발견되지 않았다. 언급된 식별자(`CONTAINER_MISSING_EMIT`, `MAKESHOP_UNRESOLVED_PATH_PARAM` 등)는 전부 에러 코드/환경변수 **이름**이지 값이 아니다.
  - 제안: 조치 불필요.

- **[INFO]** `child_process`/`exec`/`spawn`/`eval` 등 커맨드 실행 경로 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`, `guide-identifier-existence.test.ts` 전체 (grep 확인)
  - 상세: 두 파일 모두 `fs.readFileSync`(고정 경로) 와 정규식 매칭만 수행한다. 셸 실행·동적 코드 평가 함수 호출이 전혀 없어 커맨드 인젝션 표면이 없다.
  - 제안: 조치 불필요.

이 변경은 문서 정확도(에러 코드가 실제로는 메시지 접두일 뿐 구조화된 `error.code` 로 발행되지 않는다는 점을 명확히 함)를 개선하는 것이며, 오히려 사용자가 잘못된 필드(`error.code`)를 신뢰해 오동작하는 것을 방지하는 방향의 수정이다. 인증/인가, 입력 검증, 암호화, 에러 메시지의 민감정보 노출, 의존성 보안 어느 관점에서도 이번 diff 가 만지는 코드 경로가 없다.

## 요약

이번 변경은 유저 가이드 문서 2건의 서술 정정과, 그 정확성을 지속적으로 검증하는 테스트 전용 정적 스캐너에 "발행 축" 하나(정규식 3종 + 수집기/판정 함수 5개 + 허용목록 1개)를 추가한 것으로, 프로덕션 런타임 코드·API·인증/인가·DB·네트워크 경로를 전혀 건드리지 않는다. 신규 정규식은 기존에 안전성이 검증된 `UPPER_SNAKE` 패턴을 재사용해 ReDoS 위험이 없고, 신규 파일 조회 함수(`resolveSourceLines`)의 입력도 소스 안의 하드코딩된 상수에서만 파생돼 경로 탐색 위험이 없다. 하드코딩된 시크릿, 커맨드 실행, 인젝션 벡터 모두 발견되지 않았다. 보안 관점에서 이 PR 은 영향이 사실상 없다.

## 위험도

NONE
