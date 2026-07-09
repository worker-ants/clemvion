# 보안(Security) Review — e2e sub-global timeout 상속 + prod빌드 주석 정합 (session 16_38_12 후속)

대상 커밋: `d4a188eb00cc171b5bc9c3e024a8ff6d5fee6698`
대상 파일: `codebase/frontend/e2e/{auth/login,auth/password-reset,auth/register,team/register-invitation,workflows/background-run-section,workspaces/members}.spec.ts`, `codebase/frontend/playwright.config.ts`, `docker-compose.e2e.yml`, `plan/in-progress/e2e-retry-visibility-followup.md`(신규), `review/code/2026/07/09/16_38_12/*`(이전 리뷰 세션 산출물 커밋)

## 발견사항

없음 — Critical/Warning/Info 레벨 보안 발견사항 없음.

### 검토 근거 (관점별)

1. **인젝션 취약점**: 변경분은 `.toBeVisible({ timeout: N })` → `.toBeVisible()` (하드코딩 timeout 제거)과 주석 텍스트 수정뿐. 신규 사용자 입력 처리, DOM/HTML 조립, 쉘 명령, 파일 경로 조작 로직이 전혀 추가되지 않았다. `docker-compose.e2e.yml`/`playwright.config.ts` 변경도 커맨드 문자열 변경 없이 주석만 갱신. 인젝션 표면 변화 없음.

2. **하드코딩된 시크릿**: `login.spec.ts`의 `"test-access-token"`, `members.spec.ts`의 `ACCESS = "mock-access-token"`/`has_session` 쿠키 값 `"1"`, `register-invitation.spec.ts`의 `VALID_TOKEN = "a".repeat(64)`, `challengeToken: "challenge-token-abc"` 등은 모두 `page.route()`로 가로챈 **mock HTTP 응답 안에서만 소비되는 테스트 픽스처**다. 실제 backend/외부 서비스로 전송되지 않고, 실서비스 자격증명·API 키·인증서가 아니다. 이번 diff 는 이 값들을 새로 도입한 것도 아니고(기존 스펙 파일에 이미 존재), timeout 리터럴 제거만 수행했다. 조치 불요.

3. **인증/인가**: 테스트가 검증하는 로직(401 처리, 2FA challenge 분기, 초대 토큰 만료/미발견, 멤버 초대 등)에 실질 변경 없음 — assertion 의 대기시간만 전역 기본(10s)으로 상속시켰을 뿐, 분기 조건이나 mock 응답 구조는 그대로다. `members.spec.ts` 의 `mockAuth()` 헬퍼(`has_session` 쿠키 + `/api/auth/refresh`/`/api/users/me` mock)도 무변경. 인증 우회·권한 검증 로직 변경 없음.

4. **입력 검증**: 테스트 코드이며 사용자 입력 검증 로직 자체는 변경 대상 아님(폼 자체는 이번 diff 밖). 영향 없음.

5. **OWASP Top 10**: 해당 없음. 오히려 `password-reset.spec.ts` 주석("spec §2.5 — 정보 누출 방지를 위해 이메일 존재 여부와 무관하게 동일한 안내를 표시")이 가리키는 사용자 열거(user enumeration) 방지 요구사항은 이번 diff 로 훼손되지 않았다(assertion 대상 텍스트·mock 응답 불변).

6. **암호화**: 해당 변경 없음. `set-cookie: refresh_token=fake; HttpOnly; Path=/` mock 헤더도 기존 그대로이며 HttpOnly 속성이 유지되어 XSS 시 탈취 방지 관례를 그대로 반영.

7. **에러 처리**: 401/409/410/404 mock 에러 메시지 assertion 대상 텍스트는 변경되지 않았다(정규식 매칭 대상 동일). 에러 메시지에 스택트레이스·내부 경로·DB 세부사항이 노출되는 패턴 없음(모두 사용자 대상 일반 문구).

8. **의존성 보안**: 신규 패키지/버전 변경 없음. `docker-compose.e2e.yml`은 주석만 수정.

### 부가 확인

- `review/code/2026/07/09/16_38_12/*` (RESOLUTION.md, SUMMARY.md, `_retry_state.json`, 개별 reviewer .md, meta.json 등)는 이전 ai-review 세션의 산출물이 이번 커밋에 함께 커밋된 것으로, 순수 리뷰 리포트/오케스트레이션 상태 파일이며 실행되는 코드가 아니다. 비밀값·자격증명·민감 경로 노출 없음(내부 리뷰 코멘트 텍스트만 포함).
- `plan/in-progress/e2e-retry-visibility-followup.md` 신규 plan 문서도 CI retry 가시성 개선 후속 과제를 기술하는 순수 문서로 보안 영향 없음.

## 요약

이번 변경은 Playwright e2e 스펙 6개 파일에서 개별 하드코딩된 `toBeVisible({ timeout: N })` 오버라이드를 제거해 전역 `expect.timeout`(10s)을 상속시키고, `playwright.config.ts`/`docker-compose.e2e.yml`의 인접 주석을 실제 동작(CI 프로덕션 빌드 기동, retry-flaky 집계)에 맞게 정정한 순수 테스트 인프라/문서 변경이다. 실행 로직·인증 분기·mock 응답 구조·시크릿 취급 방식에 실질 변경이 없어 인젝션·인증우회·정보노출·암호화·의존성 등 어떤 보안 관점에서도 새로운 리스크가 발견되지 않았다. 코드에 등장하는 토큰·쿠키 값은 모두 `page.route()` mock 전용 테스트 픽스처로 실제 시크릿이 아니다.

## 위험도

NONE
