# 보안(Security) Review

## 리뷰 대상
- `codebase/frontend/e2e/profile/profile-edit.spec.ts` (`waitForURL` timeout 10s→15s)
- `codebase/frontend/playwright.config.ts` (retries/timeout/webServer 조정)

두 파일 모두 e2e 테스트 인프라 설정 변경(flakiness 안정화)이며, 프로덕션 런타임 코드·인증/인가 로직·DB 접근 로직에 대한 변경은 포함하지 않는다.

### 발견사항

- **[INFO]** 테스트 픽스처의 하드코딩된 자격증명류 문자열
  - 위치: `codebase/frontend/e2e/profile/profile-edit.spec.ts:81` (`const ACCESS = "mock-access-token";`), `:126-128` (`has_session` 쿠키 값 `"1"` 을 `page.context().addCookies()` 로 직접 주입), `:307-313` (`"old-password-123"`, `"new-password-456"`)
  - 상세: 이번 diff 로 새로 추가된 것이 아니라 기존 파일에 이미 존재하던 테스트 픽스처다. 값 자체가 `page.route` 로 가로채는 mock 응답에만 쓰이고 실제 백엔드로 전송되지 않으므로(모든 API 호출이 Playwright route mock 으로 가로채짐) 실제 인증 시스템에 대한 자격증명 노출이 아니다. 리포지토리에 실제 운영 시크릿이 하드코딩된 사례는 아니다.
  - 제안: 조치 불필요. (참고) 이 mock 패턴(`mock-access-token`, `has_session=1` 존재만으로 인증 판단)이 실제 프로덕션 인증 미들웨어의 판정 로직과 지나치게 단순 대응된다면 그것은 이번 e2e diff 가 아닌 프로덕션 코드 쪽에서 별도로 점검할 사항 — 이번 변경 범위 밖.

- **[INFO]** CI 전용 production 빌드 기동(`npm run build && npm run start`)
  - 위치: `codebase/frontend/playwright.config.ts` webServer.command (diff 라인 394-397, 최종 446-448)
  - 상세: `next start` 로 실행되는 production 서버가 CI 컨테이너 내부에서 `localhost:3012` 로만 바인딩되고 외부에 노출되지 않는 한 보안 영향 없음. `command` 는 사용자 입력이 아닌 `process.env.CI` 진위값으로 분기되는 정적 문자열이라 커맨드 인젝션 벡터가 아니다. 오히려 `next dev` 대신 실제 배포와 동일한 production 빌드로 e2e 를 실행하게 되어, production 고유 동작(에러 응답 포맷, 소스맵 비노출 등)까지 테스트 커버리지에 포함되는 긍정적 효과가 있다.
  - 제안: 조치 불필요.

- **[INFO]** retries/timeout 상향이 보안 신뢰도에 미치는 영향 없음
  - 위치: `codebase/frontend/playwright.config.ts:373` (`retries: process.env.CI ? 2 : 0`), `:377-378` (`timeout: 45_000`, `expect: { timeout: 10_000 }`), `:401` (`webServer.timeout: 240_000`)
  - 상세: CI 한정 조정이며 로컬 디버깅 흐름(retries 0)은 그대로 유지된다. 인증/인가·입력검증 관련 assertion 의 판정 로직 자체는 변경되지 않고 타이밍 여유만 늘었으므로, retry 가 보안 관련 negative 테스트(반드시 실패해야 하는 케이스)의 실패를 은폐할 가능성은 없다 — 각 retry attempt 는 처음부터 재실행되며 assertion 을 완화하지 않는다.
  - 제안: 조치 불필요. 일반 원칙으로, 향후 인증 우회 시도 등 반드시 실패해야 하는 negative 보안 e2e 케이스는 flake 허용(retry) 대상에서 별도 관리하는 것을 권장.

- **[INFO]** `waitForURL` 타임아웃 10s→15s 확장
  - 위치: `codebase/frontend/e2e/profile/profile-edit.spec.ts:325`
  - 상세: 단순 대기시간 상향이며 인증/입력검증/에러노출 등 보안 표면과 무관.
  - 제안: 조치 불필요.

인젝션(SQL/XSS/커맨드/경로탐색), 인증 우회, 입력 검증 미비, 안전하지 않은 암호화, 에러 메시지의 민감정보 노출, 취약 의존성 등 실질적 보안 결함은 이번 변경분에서 발견되지 않았다. 변경 범위가 테스트 설정/픽스처에 국한되어 있고 프로덕션 코드 경로(인증 미들웨어, API 핸들러, DB 쿼리 등)를 건드리지 않기 때문에 실질적인 공격 표면 자체가 존재하지 않는다.

### 요약
이번 변경은 Playwright e2e 스위트의 flakiness 를 줄이기 위한 재시도/타임아웃/CI 빌드 방식 조정으로, 프로덕션 코드나 인증/인가 로직에 대한 수정이 전혀 포함되지 않는다. 파일 내 존재하는 mock 토큰·테스트 비밀번호 문자열은 모두 Playwright route mock 으로 가로채지는 테스트 픽스처이며 실제 시스템에 전달되지 않아 시크릿 노출로 볼 수 없다. 커맨드 인젝션, 기타 인젝션 취약점, 인가 우회, 암호화 약점 등 실질적 보안 리스크는 확인되지 않았다.

### 위험도
NONE
