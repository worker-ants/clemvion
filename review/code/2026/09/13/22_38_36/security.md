# 보안(Security) 리뷰 — error-code-emission-axis (최종 라운드)

## 범위 확인

`git diff origin/main --stat -- codebase/` 로 재확인한 실제 코드 변경 범위는 4개 파일뿐이다:

- `codebase/frontend/src/content/docs/02-nodes/logic.mdx`, `logic.en.mdx` — 유저 가이드 문장 1줄 정정(`CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 이 `error.code` 로 발행되는 것처럼 읽히던 문장을 "메시지 접두일 뿐" 로 정정)
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` — 가이드가 인용하는 UPPER_SNAKE 식별자의 "존재" 축 스캐너에 "발행" 축(정규식 3종 + 판정 함수 4개 + `GUIDE_NON_EMITTED_VOCABULARY` 허용목록)을 추가
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` — 위 축을 소비하는 테스트·대조군

나머지(`CHANGELOG.md`, `PROJECT.md`, `plan/**`, `review/consistency/**`, `review/code/2026/09/13/{19_23_22,19_51_33,20_13_13}/**`)는 문서·plan·이전 라운드 리뷰 산출물이며 실행되는 코드가 아니다. 이 세션 자체가 3라운드 `/ai-review` + fix 사이클의 최종(4번째) 라운드이고, 앞선 세 라운드의 `security.md` 도 diff 에 포함되어 있는데 전부 위험도 NONE 으로 결론지었다 — 직접 코드를 다시 읽어 그 결론을 독립적으로 재확인했다.

`guide-identifier-scan.ts`/`guide-identifier-existence.test.ts` 는 둘 다 `__tests__/` 하위의 vitest 전용 코드로, CI/로컬 테스트 시점에 **저장소 자신의 소스·spec·mdx 파일**을 읽어 정적 검증만 수행한다. 사용자 입력, 네트워크 경계, 인증/인가, DB, 시크릿 처리 경로 어디에도 닿지 않는다.

## 발견사항

- **[INFO]** 신규 정규식 3종의 ReDoS 가능성 — 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` — `QUOTED_LITERAL`/`MESSAGE_PREFIX`/`CATALOG_CODE` 선언부(기존 `UPPER_SNAKE` 상수를 감싸는 형태), `parseWhereRefs` 내부의 `/([\w./-]+\.ts):(\d+(?:·\d+)*)/g` (`guide-identifier-existence.test.ts`)
  - 상세: `UPPER_SNAKE = "[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+"` 를 감싸는 세 정규식은 첫 그룹이 `_` 를 생성할 수 없고 둘째 그룹은 반드시 `_` 로 시작해 두 정량자의 매치 범위가 겹치지 않는다 — catastrophic backtracking 의 전형적 조건(모호한 부분 반복)이 없다. `parseWhereRefs` 의 패턴도 선형이며 중첩 정량자가 없다. 입력은 전부 저장소 자체의 정적 텍스트(소스·spec·mdx)이고 외부/사용자 입력이 아니어서 공격자가 입력을 통제할 경로 자체가 없다. `collectMatches`/수집기들이 `matchAll` 을 써서 내부적으로 정규식을 복제하므로 공유 `lastIndex` 상태 오염 문제도 없다.
  - 제안: 조치 불필요 — 기록 목적의 INFO.

- **[INFO]** 스캐너·테스트가 읽는 파일 경로는 전부 하드코딩된 저장소 상대경로
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` — `catalogCodes` 계산부(`path.join(root, "spec/5-system/3-error-handling.md")`), `resolveSourceLines`(`walkTree(root, SOURCE_ROOTS, ...)` + `path.basename` 매칭)
  - 상세: 사용자 입력·CLI 인자·환경변수로 파일 경로를 구성하지 않는다. `resolveSourceLines` 가 `where` 문자열에서 뽑은 `file` 값을 쓰지만, 그 값은 소스 파일을 직접 읽는 게 아니라 **저장소 트리 전체를 미리 훑어 만든 `basename → 파일` 매핑을 조회**하는 키로만 쓰인다(`found = walkTree(...).includeFile((n) => n === key)`) — 경로 조립에 `..`/절대경로가 섞여 들어가도 트리 밖으로 나갈 수 없다. 경로 탐색(path traversal) 벡터 없음. `where` 값 자체도 동일 파일 내 상수 배열(`GUIDE_NON_EMITTED_VOCABULARY`)에서만 오고 외부 입력이 아니다.
  - 제안: 조치 불필요.

- **[INFO]** 하드코딩된 시크릿/자격증명 없음
  - 위치: 리뷰 대상 전 파일(`CHANGELOG.md`, `PROJECT.md`, `logic{,.en}.mdx`, `guide-identifier-*.ts`, `plan/**`, `review/**`)
  - 상세: 전수에서 API 키·토큰·비밀번호·인증서 패턴을 찾지 못했다. 문서·코드가 언급하는 식별자(`CONTAINER_MISSING_EMIT`, `MAKESHOP_UNRESOLVED_PATH_PARAM`, `MAX_ITERATIONS_EXCEEDED` 등)는 전부 에러 코드/환경변수 **이름**이며 값이 아니다. `.env.example` 참조도 선언처 텍스트를 읽어 이름 존재만 확인할 뿐 값을 다루지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** 문서 정정 자체가 보안적으로 개선 방향
  - 위치: `codebase/frontend/src/content/docs/02-nodes/logic.mdx:114`, `logic.en.mdx:103` (게이트 숫자는 diff 상 new-file 기준)
  - 상세: 개발자/통합사가 `error.code === 'CONTAINER_MISSING_EMIT'` 처럼 존재하지 않는 구조화 필드를 신뢰해 오류 처리 분기를 짜는 것을 방지하는 방향의 정정이다. 잘못된 필드를 신뢰한 채 세워진 에러 핸들링(예: 특정 코드일 때만 재시도/알림)이 실제로는 발동하지 않아 실패가 조용히 삼켜지는 것을 예방한다는 점에서, 이 변경은 위험을 만들지 않고 오히려 향후 오동작 가능성을 줄인다.
  - 제안: 조치 불필요.

인증/인가, 입력 검증, 인젝션(SQL/XSS/커맨드/LDAP/경로탐색), 암호화, 에러 메시지 정보 노출, 의존성 보안 — 이번 diff 범위 안에서 해당 표면에 영향을 주는 변경은 없다. 런타임 프로덕션 코드(`execution-engine.service.ts` 등)는 이번 변경에 포함되지 않았고, 가이드 문장이 그 코드의 기존 동작(메시지 접두, 구조화 코드 미방출)을 서술만 정정했을 뿐이다.

## 요약

이 변경 세트는 유저 가이드 문서 2건의 서술 정정, 그 정확성을 검증하는 테스트 전용 정적 스캐너(및 테스트)의 "발행 축" 추가, 그리고 plan/review 산출물 신규 생성으로 구성되며, 프로덕션 런타임 코드·API·인증/인가·DB·네트워크 경계를 전혀 건드리지 않는다. 신규 정규식 3종은 기존에 안전성이 확인된 `UPPER_SNAKE` 패턴을 감싸는 선형 패턴이라 ReDoS 위험이 없고, 신규 파일 읽기는 전부 저장소 내부 하드코딩 경로 또는 사전에 계산된 basename 매핑 조회로 이뤄져 경로 탐색 벡터가 없다. 하드코딩된 시크릿, 인증/인가 로직 변경, 안전하지 않은 암호화/해시 사용도 발견되지 않았다. 이전 3라운드 리뷰(`19_23_22`·`19_51_33`·`20_13_13`)의 보안 판정(NONE)과 이번 독립 재확인이 일치한다.

## 위험도

NONE
