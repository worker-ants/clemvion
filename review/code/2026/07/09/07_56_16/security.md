# 보안(Security) 코드 리뷰

## 발견사항

- **[WARNING]** `buildWorkspaceHref` 의 open-redirect 방어가 backslash·제어문자 변형까지는 막지 못함 (선행 W4 조치의 잔여 미해소분)
  - 위치: `codebase/frontend/src/lib/workspace/href.ts:17` (`const clean = \`/${String(path).replace(/^\/+/, "")}\`;`)
  - 상세: 이번 diff 는 직전 라운드에서 지적된 `//host` protocol-relative 취약점(선두 forward-slash 반복)을 정확히 닫았다 (`buildWorkspaceHref("team-a", "//evil.com/x")` → `/w/team-a/evil.com/x`, `buildWorkspaceHref(null, "//evil.com/x")` → `/evil.com/x`, 테스트로 검증됨: `codebase/frontend/src/lib/workspace/__tests__/href.test.ts`).
    다만 정규식이 선두 `/` 문자만 걷어내고, WHATWG URL 파서가 "특수 스킴"(http/https)에서 `/`와 동일하게 취급하는 **backslash(`\`)** 나, 파싱 전에 통째로 제거되는 **ASCII tab/CR/LF** 는 다루지 않는다. 직접 검증한 결과:
    ```
    new URL("/\\evil.com/x", "https://example.com/foo").host  === "evil.com"
    new URL("/\t/evil.com",  "https://example.com/foo").host  === "evil.com"
    ```
    즉 `path` 값이 (a) slug 가 falsy 여서 그대로 반환되는 분기이면서, (b) 선두가 `"/\..."` 또는 `"/\t/..."` 형태(예: URL 세그먼트가 `%5Cevil.com` 또는 raw tab 을 포함하는 catch-all 경로)로 공급되면, 정규식 통과 후에도 여전히 open-redirect 로 이어질 수 있는 클래스가 남는다. 이는 "`//` 로 시작하는지만 검사"하는 오픈리다이렉트 필터의 전형적인 우회 기법(OWASP 문서화된 패턴)과 동일하다.
    코드 주석과 커밋 메시지는 "protocol-relative(`//host`) open-redirect 방어" 를 완료된 것으로 표현하는데, 실제로는 부분적 방어이며 이 함수가 "보안 경계"로 문서화(JSDoc: FE 라우팅 SoT)되어 있어 향후 유지보수자가 안전하다고 오인할 위험이 있다.
  - 실제 도달 가능성(완화 요인, 확인함): 저장소 내 `buildWorkspaceHref` 호출부 전수 조사 결과, 거의 모든 호출이 `slug` 가 이미 truthy 인 `/w/[slug]/*` 페이지 내부에서 이루어지고(`layout.tsx` 가 `reconciled` 될 때까지 children 렌더를 게이트), `path` 인자도 리터럴 문자열이거나 신뢰된 리소스 UUID 다. `slug` 가 falsy 로 유지된 채 caller-influenced `path` 가 함수에 도달하는 유일한 후보인 `(main)/[...rest]/page.tsx` 는 `active`(=워크스페이스) 가 존재해야만 실행되는데 `active.slug` 는 항상 non-empty 이므로, 이 diff 시점 기준으로는 **직접적으로 트리거 가능한 라이브 경로는 없음**을 확인. 또한 `slug` 가 truthy 인 경우 backslash 는 `/w/<slug>/...` 문자열 중간에 위치하게 되어 host 변조로 이어지지 않음(직접 `new URL()` 로 검증: `/w/team-x/\evil.com/x` → host 는 여전히 origin 그대로).
  - 제안: 방어를 "선두 슬래시 정규화"에서 "선두 슬래시+백슬래시 정규화 및 제어문자 스트립"으로 확장. 예: `path.replace(/^[/\\]+/, "")` 로 선두의 `/`·`\` 혼합을 모두 제거한 뒤 단일 `/` 를 붙이고, 추가로 `String(path)` 전체에서 ASCII tab/CR/LF(`\t\r\n`)를 제거(WHATWG 파서가 어차피 제거하므로 사전에 걷어내는 편이 안전)한 뒤 그래도 결과가 `//` 로 시작하면 재귀적으로 collapse. 혹은 더 견고하게 `new URL(path, "http://internal.invalid/").pathname + search + hash` 형태로 "path 로만 강제 해석" 시키는 방식을 검토. 테스트에 backslash·tab 변형 케이스(`"/\\evil.com"`, `"/\t/evil.com"`)도 추가 권장.

- **[INFO]** 라우팅 위임 구조 자체는 안전한 설계 — 인가 경계와 UX 편의 리다이렉트가 명확히 분리됨
  - 위치: `codebase/frontend/src/app/(main)/w/[slug]/layout.tsx` JSDoc, `resolveFallbackWorkspace`
  - 상세: layout 의 slug→workspace reconcile/fallback 은 명시적으로 "UX 전용" 이며, 실제 인가 강제는 backend `RolesGuard` 403 뿐이라고 문서화되어 있고 이번 diff 로 추출된 `resolveFallbackWorkspace()` 도 이 정책을 그대로(순수 함수로) 재현할 뿐 인가 로직에는 관여하지 않는다. FE slug 오조작(`/w/<임의-slug>`)이 있어도 백엔드 데이터 접근권은 store 의 `currentWorkspaceId`→`X-Workspace-Id` 헤더→토큰 클레임 경로로만 결정되므로 클라이언트 라우팅 신뢰가 인가 우회로 이어지지 않는다. 문제 없음(정상 확인).

- **[INFO]** 하드코딩된 시크릿·인젝션·안전하지 않은 암호화 없음
  - 위치: 전체 diff(FE 라우팅/링크-빌더/테스트/리뷰 산출물)
  - 상세: 순수 프론트엔드 네비게이션 리팩터 + 테스트 추가 + 이전 리뷰 산출물(RESOLUTION.md/SUMMARY.md/*.json) 커밋. SQL/커맨드/LDAP 인젝션 표면 없음(서버 호출 없음), API 키/비밀번호/토큰 패턴 grep 결과 없음, 신규 의존성 없음. 에러 메시지에 민감정보 노출되는 신규 코드 없음(이번 diff 범위 내에서는 cafe24 `lastErrorMessage` i18n 이슈 등은 pre-existing 이고 이번 변경 범위 밖).

## 요약
직전 라운드 security WARNING(오픈 리다이렉트)에 대한 조치(`buildWorkspaceHref` 선두 슬래시 정규화)는 원래 지적된 `//host` 벡터를 정확히 닫았고 테스트로 회귀도 방지했으나, WHATWG URL 파서가 특수 스킴에서 `\`(backslash)와 tab/CR/LF 를 `/`와 동일하게 취급한다는 잘 알려진 우회 클래스는 남아 있어 방어가 "완결"이 아니라 "부분적"이다. 다만 저장소 전체 호출부를 조사한 결과 이 잔여 벡터가 현재 라이브 경로로 트리거되지는 않아(모든 실질 호출이 truthy slug + 리터럴/신뢰 path 조합), 즉시 위험은 낮다. 그 외 이번 diff 는 순수 프론트엔드 리팩터(폴백 로직 추출, 테스트 보강)로 시크릿 노출·인젝션·인가 우회·안전하지 않은 암호화 등의 문제는 발견되지 않았고, FE slug 라우팅과 backend 인가 경계 분리도 견고하게 유지되고 있다.

## 위험도
LOW
