# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] `presentation.ts` 공개 변환 함수(toCarousel/toTable/toChart/toTemplate)에 JSDoc 없음
- 위치: `codebase/channel-web-chat/src/lib/presentation.ts` — `toCarousel`, `toTable`, `toChart`, `toTemplate` 함수
- 상세: `classifyPresentation` 에는 `/** shape 으로 presentation 종류 판별. 모르면 null(렌더 skip). */` JSDoc 이 있으나, 4개의 공개 변환 함수(export)에는 파라미터·반환값·사이드이펙트 설명이 없다. 특히 `toCarousel` 의 dynamic(output.items 우선) vs static(config.items 폴백) 분기, `toChart` 의 기본 chartType 클램프(bar) 등 비자명 동작은 주석 없이 코드만으로 파악해야 한다.
- 제안: 각 함수에 `/** ... */` JSDoc 을 추가하고 주요 동작 분기(dynamic/static 폴백, 기본값 클램프 등)를 1-2줄로 기술한다.

### [INFO] `use-widget.ts` 의 `refreshDelayMs` 함수 — 공개 export 이나 JSDoc 없음
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `refreshDelayMs` 함수, `TOKEN_REFRESH_LEAD_MS`, `TOKEN_REFRESH_MIN_DELAY_MS` 상수
- 상세: 테스트 파일(`use-widget.test.ts`)에서 직접 import 되는 공개 API 로 노출되어 있고, 토큰 갱신 타이밍 계산이라는 비자명 로직이지만 JSDoc 이 없다. `null` 반환 케이스(파싱 불가)도 시그니처만으로는 알기 어렵다.
- 제안: `/** 토큰 자동 갱신 지연(ms) 계산. expiresAt 파싱 불가 시 null 반환. */` 수준의 JSDoc 추가.

### [INFO] `EmbedConfigService.resolve` — `endpointPath` 파라미터 의미가 JSDoc 에 불명확
- 위치: `codebase/backend/src/modules/hooks/embed-config.service.ts` — `resolve` 메서드
- 상세: 클래스 수준 JSDoc(`webhook endpointPath → 워크스페이스 interactionAllowedOrigins`)에는 언급되나, 메서드 레벨 `@param` 이 없다. `endpointPath` 가 URL path segment 인지 full path 인지, 형식 제약이 있는지 JSDoc 만으로 확인 불가.
- 제안: `@param endpointPath` 태그로 "트리거 등록 시 발급된 고유 엔드포인트 경로 segment" 를 기술.

### [INFO] `byo-ui-headless.ts` 의 `HeadlessChat` 인터페이스 — `end`/`close` 차이 미문서화
- 위치: `codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts` — `HeadlessChat` 인터페이스
- 상세: `end` (서버 측 `end_conversation` 명령)와 `close` (SSE 구독 해제만) 의 의미가 다름에도 인터페이스에 JSDoc 이 없다. 사용자가 두 메서드를 혼용할 경우 리소스 누수 또는 예기치 않은 서버 신호 발생 가능.
- 제안: `HeadlessChat` 인터페이스 각 멤버에 `/** 서버에 end_conversation 명령 전송 후 종료 */`, `/** SSE 구독 해제만(서버 신호 없음) */` 수준의 주석 추가.

### [INFO] `styles.ts` — 신규 추가된 presentation CSS 클래스에 섹션 구분 주석 없음
- 위치: `codebase/channel-web-chat/src/widget/styles.ts` — `.wc-presentations` 이하 22줄 신규 추가
- 상세: `.wc-carousel-*`/`.wc-table-*`/`.wc-chart-*`/`.wc-template-*` 계열 클래스들이 `presentations.tsx` 어느 컴포넌트에 대응하는지 구분하는 섹션 주석 없이 일렬 나열. 클래스 수가 늘수록 유지보수 어려움.
- 제안: `/* --- presentation 컴포넌트 styles (carousel / table / chart / template) --- */` 형태의 섹션 구분 주석 추가.

### [INFO] `web-chat-checks.yml` — `actions/checkout@v5`, `actions/setup-node@v6` 버전 의도 불명확
- 위치: `.github/workflows/web-chat-checks.yml` — `uses: actions/checkout@v5`, `uses: actions/setup-node@v6`
- 상세: 2026년 6월 기준 공식 GitHub Actions 최신 안정 버전은 `actions/checkout@v4`, `actions/setup-node@v4` 계열이다. v5/v6 는 존재하지 않거나 pre-release 일 수 있어, 의도적 선택인지 오기인지 알 수 없다. 워크플로우 실행 실패로 이어질 수 있어 기능 문제이기도 하나, 문서화 관점에서 의도 주석이 없다는 점을 지적한다.
- 제안: 버전 의도가 있다면 인라인 주석 추가, 그렇지 않으면 안정 버전(`@v4`)으로 수정.

### [INFO] `widget-state.ts` — `BLOCKED` action 의 `reason` 허용 값 범위 문서화 없음
- 위치: `codebase/channel-web-chat/src/lib/widget-state.ts` — `{ type: "BLOCKED"; reason?: string }` 액션 타입
- 상세: `reason` 에 `"origin_not_allowed"` 이 실제 사용되는 것은 테스트에서 확인되나, 허용 값 목록이 타입 수준(리터럴 유니온) 또는 JSDoc 으로 정의되지 않아 향후 BLOCKED 를 dispatch 하는 호출자가 임의 문자열을 전달할 수 있다.
- 제안: `reason?: "origin_not_allowed" | string` 으로 좁히거나 JSDoc 에 "현재 값: `origin_not_allowed`" 를 기술.

### [INFO] `hooks.controller.ts` 의 `getEmbedConfig` — `@Res({ passthrough: true })` 사용 의도 주석 부족
- 위치: `codebase/backend/src/modules/hooks/hooks.controller.ts` — `getEmbedConfig` 메서드
- 상세: `passthrough: true` 가 왜 필요한지(TransformInterceptor 와 함께 동작하기 위해 직접 응답을 마치지 않고 Cache-Control 헤더만 세팅) 에 대한 인라인 설명이 없다. 동료 개발자가 `passthrough` 를 제거하거나 `res.send()`를 추가하면 동작이 깨진다.
- 제안: `// passthrough: TransformInterceptor 가 응답 래핑. res 는 헤더 세팅만 사용.` 수준의 한 줄 주석 추가.

### [INFO] `README.md`(web-chat-sdk) — M2 BYO-UI 섹션의 토큰 자동 갱신 예시 코드 없음
- 위치: `codebase/packages/web-chat-sdk/README.md` — `## M2 BYO-UI (headless)` 마지막 항목
- 상세: "토큰 만료 30분 이내 자동 갱신은 `client.refreshToken(...)` 으로 직접 스케줄링" 이라고 언급하지만 실제 `refreshToken` 사용 패턴 예시가 없다. 독자가 구현 방법을 찾으려면 `@workflow/sdk` 소스를 직접 탐색해야 한다.
- 제안: `byo-ui-headless.ts` 에 `setTimeout(() => client.refreshToken(executionId, token), delay)` 최소 패턴을 주석 예시로 추가하거나 README 스니펫에 포함.

---

## 요약

전반적으로 문서화 수준은 변경 규모를 감안하면 양호하다. 핵심 신규 클래스(`EmbedConfigService`, `EmbedConfigDto`)에는 클래스 수준 JSDoc 과 스펙 참조가 갖춰져 있고, `byo-ui-headless.ts` 예제는 의사코드에서 실제 동작 코드로 충실히 개선되었으며, README 의 M2 BYO-UI 섹션도 신설되었다. `widget-app.tsx`, `widget-state.ts`, `panel.tsx` 등 핵심 변경 지점에도 인라인 주석으로 spec 참조와 의도가 명시되어 있다. 다만 신규 공개 함수(`toCarousel`/`toTable`/`toChart`/`toTemplate`, `refreshDelayMs`)의 JSDoc 누락, `BLOCKED` action의 `reason` 값 범위 미정의, `passthrough: true` 의도 주석 부재, CI 워크플로우 액션 버전 의도 불명확 등 INFO 수준 항목들이 9건 발견된다. CRITICAL 또는 WARNING 수준의 문서화 결함은 없으며, 모든 발견사항은 점진적으로 개선 가능한 범위다.

## 위험도

LOW

---

STATUS=success ISSUES=9
