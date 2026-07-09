# 보안(Security) 코드 리뷰

대상: 슬러그 라우팅 하드닝 B (`buildExecutionHref` 헬퍼, `safe-path.ts` 공용 open-redirect 정규화,
타입 순환 제거) — commit f2fd9c61d1b798e024e436f3e622b034f274d356

## 발견사항

- **[INFO]** `buildExecutionHref` 의 `workflowId`/`executionId` 는 인코딩/검증 없이 경로 세그먼트로 직접 삽입
  - 위치: `codebase/frontend/src/lib/workspace/href.ts` (`buildExecutionHref`)
  - 상세: `` `/workflows/${workflowId}/executions` ``, `` `${base}/${executionId}` `` 는 두 인자를
    그대로 문자열에 삽입한다. 값은 실행 목록 API 응답(`execution.workflowId`, `execution.id`)에서
    오는 백엔드 발급 ID(UUID 형태)라 실질 공격 표면은 낮지만, 만약 이 값에 `/`, `?`, `#` 같은
    경로/쿼리 구분자가 섞이면 (예: 손상된 백엔드 응답, 다른 통합 경로에서 잘못된 ID 주입)
    최종 href 에 의도치 않은 세그먼트/쿼리가 끼어들 수 있다. 다만 결과 문자열은 여전히
    `buildWorkspaceHref` → `toSafeInternalPath` 를 거치므로 최초 위치의 `//`, `\\` 기반
    open-redirect 는 차단된 상태이고, 중간에 삽입된 `?redirect=` 류 쿼리 조작 정도가 남는 잔여
    표면이다.
  - 제안: 현재 신뢰 경계(백엔드가 UUID 를 보장) 내에서는 실용적 리스크가 낮아 차단 필요는
    없음. 향후 방어적 강화를 원하면 `workflowId`/`executionId` 에 대해 `encodeURIComponent`
    또는 UUID 형식 검증을 추가하는 정도로 충분.

- **[INFO]** `no-raw-execution-href.test.ts` 가드는 특정 템플릿 리터럴 패턴만 탐지
  - 위치: `codebase/frontend/src/lib/workspace/__tests__/no-raw-execution-href.test.ts`
  - 상세: 정규식 `` /`\/workflows\/\$\{[^`]*?\}\/executions/ `` 은 백틱 템플릿 리터럴 형태의
    raw 문자열만 잡는다. 문자열 연결(`"/workflows/" + id + "/executions"`)이나 배열
    `.join("/")` 등 다른 조립 방식으로 동일한 slug-누락 broken-link 패턴이 재도입되면 이
    가드를 우회한다. 이는 익스플로잇 가능한 취약점이 아니라 회귀 방지 커버리지의 한계이며,
    주석에 이미 "ESLint AST 매칭 취약성 회피" 트레이드오프로 명시돼 있다(의도된 선택).
  - 제안: 낮은 우선순위. 필요 시 문자열 연결 패턴까지 포괄하는 보조 정규식을 추가 고려.

- **[INFO]** 로그인 리다이렉트(`?redirect=`) 소비 측 검증은 본 diff 범위 밖
  - 위치: `codebase/frontend/src/components/ui/error-page.tsx` (`loginHref` 생성부)
  - 상세: `error-page.tsx` 는 `isSafeRedirectPath(pathname)` 로 검증된 값만
    `encodeURIComponent` 하여 `/login?redirect=` 에 담아 **생성**하는 쪽은 안전하다.
    다만 이 `redirect` 쿼리 파라미터를 **소비**하는 로그인 페이지 측 코드는 이번 diff 에
    포함되지 않아 확인 범위 밖이다. 로그인 성공 후 그 값을 그대로 `router.push`/`window.location`
    에 넘긴다면 별도로 동일한 `isSafeInternalPath` 재검증이 필요하다(생성부만 안전해도 소비부가
    검증 없이 신뢰하면 오픈리다이렉트 재발 가능).
  - 제안: 로그인 페이지의 redirect 파라미터 소비 로직이 `isSafeInternalPath`/`isSafeRedirectPath`
    를 거치는지 별도 확인 권장 (이번 리뷰 대상 파일에는 없음).

## 긍정적 관찰 (하드닝 효과)

- `isSafeRedirectPath` (`error-page.tsx`) 가 기존에는 `pathname.startsWith("/") && !pathname.startsWith("//")` 만
  검사해 `\\evil.com`, `/\evil.com`, tab/CR/LF 삽입 기반 protocol-relative 우회를 막지 못하던 비대칭 갭이
  있었는데, 이번 변경으로 `buildWorkspaceHref` 와 동일한 `toSafeInternalPath`/`isSafeInternalPath`
  (`lib/workspace/safe-path.ts`) 를 공유하도록 통합되어 그 갭이 닫혔다. 정규화 규칙(선두 `/`·`\` 연속 시퀀스
  collapse, tab/CR/LF 제거)은 WHATWG URL 파서가 특수 스킴에서 이 문자들을 `/` 와 동등 취급하는 사양과
  일치하며, 테스트(`safe-path.test.ts`, `href.test.ts`)가 알려진 우회 클래스(`//`, `\\`, `/\`, embedded
  tab/CR/LF)를 모두 커버한다.
- `buildExecutionHref`/`buildWorkspaceHref` 산출물은 항상 하드코딩된 `/workflows/…` 또는 `/w/<slug>` 접두로
  시작하도록 강제되어, `workflowId`/`executionId`/`slug` 값에 `javascript:` 등 스킴 문자열이 들어가도 href
  맨 앞에 위치할 수 없다 — 스킴 기반 XSS 벡터는 구조적으로 차단된다. 또한 값은 JSX `href={...}` 속성으로만
  쓰여 React 가 자동 이스케이프하므로 반사형 XSS 경로도 없다.
- 워크스페이스 slug 는 URL 라우팅 전용 SoT 이고 백엔드 인가는 별도(header-first `X-Workspace-Id`) 라는
  기존 아키텍처 결정과 일치 — 이번 변경이 그 경계를 흐리지 않는다(순수 FE 링크 조립 리팩터, 인가 로직 무변경).
- 하드코딩된 시크릿, SQL/커맨드/LDAP 인젝션, 안전하지 않은 암호화, 민감정보 노출 에러 처리, 알려진 취약
  의존성 도입 등은 발견되지 않음 — 이번 diff 는 프런트엔드 클라이언트 사이드 라우팅/타입 리팩터로 범위가
  한정되어 해당 카테고리의 공격 표면이 없음.

## 요약

이번 변경은 새로운 취약점을 도입하지 않고 오히려 기존 `isSafeRedirectPath` 의 open-redirect 방어 비대칭
갭(백슬래시·제어문자 우회 미차단)을 `safe-path.ts` 공용 정규화로 해소하는 방어적 하드닝이다. 실행 경로
헬퍼(`buildExecutionHref`)는 항상 안전한 하드코딩 접두로 시작해 스킴 주입/오픈리다이렉트 표면을 구조적으로
차단하며, 관련 유닛 테스트가 WHATWG URL 사양에 부합하는 우회 케이스를 폭넓게 커버한다. 남은 항목은 모두
INFO 수준(백엔드 신뢰 ID 의 미인코딩 삽입, 가드 테스트의 우회 가능한 커버리지 한계, 로그인 redirect 소비부의
범위 밖 확인 필요)으로 즉시 조치가 필요한 수준은 아니다.

## 위험도

LOW
