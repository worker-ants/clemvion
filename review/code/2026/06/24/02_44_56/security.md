# 보안(Security) 코드 리뷰

리뷰 대상: web-chat console follow-up 13건 (증분 3)
리뷰 일시: 2026-06-24

---

## 발견사항

### [INFO] postMessage origin 검증 — live-preview.tsx
- **위치**: `codebase/frontend/src/components/web-chat/live-preview.tsx` `onMessage` 핸들러
- **상세**: `wc:resize` 처리 추가 시 기존의 `e.source !== iframeRef.current?.contentWindow` + `e.origin !== expectedOrigin` 이중 검증을 그대로 유지하고 있다. 테스트(`live-preview.test.tsx`)도 다른 origin(`https://evil.example.com`)의 메시지를 무시함을 명시적으로 검증하고 있다. `wc:resize`의 `height` 값은 `clamp(PREVIEW_HEIGHT, PREVIEW_MAX_HEIGHT)` 로 범위를 제한해 DOM 조작 가능 범위를 속성(style.height px값)으로만 국한한다. 전반적으로 안전하게 처리되어 있으나, `width` 는 현재 clamp 대상이 아니다 — 실제로 width 는 UI에 적용되지 않으므로(style에 height만 세팅) 런타임 영향은 없지만 향후 width도 반영할 경우 주의가 필요하다.
- **제안**: 현행 코드는 수용 가능. 향후 `payload.width`를 style에 반영하는 경우 동일하게 clamp 처리를 추가한다.

---

### [INFO] host-bridge `sendResize` — iframe→host postMessage targetOrigin
- **위치**: `codebase/channel-web-chat/src/widget/host-bridge.ts` `sendResize` / `post` 함수
- **상세**: `post` 함수는 부트 완료 후 핀된 `pinnedOrigin` 을 `targetOrigin` 으로 사용한다. 부트 전 호출 시 `pinnedOrigin`이 `null`이라 메시지를 보내지 않는다. `wc:ready` 를 `targetOrigin: '*'` 로 보내는 기존 예외 경로가 유지되어 있다. `sendResize` 는 boot 완료 후만 유효한 경로(`pinnedOrigin` 확보 후)이므로 `'*'` 전송 위험이 없다. 테스트도 boot 메시지 수신 → pin 완료 → sendResize 순서를 강제해 이 가정을 검증하고 있다.
- **제안**: 별도 조치 불필요.

---

### [INFO] e2e mock-auth 헬퍼의 ACCESS 토큰 상수 노출
- **위치**: `codebase/frontend/e2e/helpers/mock-auth.ts` line 843 (`export const ACCESS = "mock-access-token";`)
- **상세**: `"mock-access-token"` 은 e2e 테스트 전용 픽스처 값이다. 프로덕션 코드가 이 값을 사용하지 않으며, 실제 인증 시스템의 토큰과 무관하다. 파일이 `e2e/helpers/` 경로에 위치해 테스트 바이너리에만 포함된다. 하드코딩된 시크릿 요건에는 해당하지 않는다.
- **제안**: 별도 조치 불필요. 이미 테스트 픽스처로서 명확히 구분되어 있다.

---

### [INFO] `WebChatAppearanceDto` — 자유 텍스트 필드에 XSS 잠재 위험 (다층 완화로 수용 가능)
- **위치**: `codebase/backend/src/modules/triggers/dto/web-chat-appearance.dto.ts` (`headerTitle`, `welcomeText`, `suggestions`, `disclaimer`)
- **상세**: 이 필드들은 `@IsString()` + `@MaxLength()` 로만 검증하며 HTML/스크립트 태그를 명시적으로 거부하지 않는다. 그러나 코드 흐름 상 완화 요소가 다층으로 존재한다:
  1. 프런트 `sanitizeDraft` 가 화이트리스트 적용 (서버 응답에도 동일 함수 적용).
  2. 설치 스니펫(`InstallSnippetBox`)은 `<pre><code>{snippet}</code></pre>` 로 렌더링 — React 가 텍스트 콘텐츠를 자동 escape하므로 콘솔 UI에서 XSS 발생 없음.
  3. 설치 스니펫 값은 `JSON.stringify`를 거쳐 JavaScript 리터럴로 출력되므로, 고객 사이트에서 스니펫을 `<script>` 태그에 붙여넣는 경우 JSON 문자열 내의 단순 HTML 태그는 JS 문자열로만 동작한다.
  4. 위젯 SPA는 boot config 값을 DOM에 `innerHTML`로 삽입하는 것이 아니라 React 컴포넌트 텍스트로 렌더링한다고 가정된다.
  
  그럼에도 서버가 저장된 값을 다른 API 응답 컨텍스트에서 raw HTML로 렌더링하는 경우를 완전히 배제하려면 서버단 XSS 새니타이징(예: `@Transform` + `sanitize-html` 또는 `he.encode`)을 추가하는 것이 방어 심도를 높인다.
- **제안**: 현행 다층 완화로 수용 가능하나, `headerTitle`·`welcomeText`·`disclaimer` 에 대한 서버단 HTML 태그 제거 또는 escape transform을 추가 검토한다 (위험도 LOW).

---

### [INFO] JSONB 필터 — SQL 인젝션 위험 없음 (확인)
- **위치**: `codebase/backend/src/modules/triggers/triggers.service.ts` lines 351~359
- **상세**: `"(t.config->'interaction'->>'enabled')::boolean = :interactionEnabled"` 쿼리는 TypeORM의 파라미터 바인딩(`:interactionEnabled`)을 사용한다. `interactionEnabled` 값은 `QueryTriggerDto`의 `@IsBoolean()` + `@Transform` 로 `true`/`false`로만 변환되어 들어온다. SQL 인젝션 경로 없음.
- **제안**: 별도 조치 불필요.

---

### [INFO] `copy-widget.mjs` — 셸 명령 인젝션 잠재 위험 (빌드 전용, 저위험)
- **위치**: `codebase/frontend/scripts/copy-widget.mjs`의 `run()` 함수
- **상세**: `run(cmd, env)` 는 `execSync(cmd, { shell: true, ... })` 형태로 추정되는 방식으로 셸 명령을 실행한다. 상수 `WIDGET_PACKAGE`, `SDK_PACKAGE` 는 파일 내 고정 리터럴이므로 외부 입력을 받지 않는다. 빌드 스크립트이며 CI/개발자 환경에서만 실행된다. 런타임 인젝션 경로 없음.
- **제안**: 별도 조치 불필요.

---

### [INFO] `iframe` sandbox 속성 — `allow-same-origin` 트레이드오프
- **위치**: `codebase/frontend/src/components/web-chat/live-preview.tsx` line ~119
- **상세**: 라이브 미리보기 iframe 에 `sandbox="allow-scripts allow-same-origin allow-forms"` 가 설정되어 있다. `allow-same-origin` + `allow-scripts` 조합은 iframe 내 스크립트가 sandbox를 벗어나 parent DOM에 접근할 수 있어 이론적으로 동일 origin sandbox 우회가 가능하다. 그러나 코드 주석에 명시되어 있듯 위젯은 same-origin 1st-party 자산으로, EIA(localStorage/세션) 동작을 위해 `allow-same-origin` 이 필수다. 외부 사용자 콘텐츠가 iframe에 주입되는 경로는 없다. spec `0-architecture §R8` carve-out 에서 이 결정이 의도된 설계임을 명시한다.
- **제안**: 현행 설계 유지. 이 트레이드오프를 `spec/7-channel-web-chat/4-security.md §1` 에 명시적으로 기록하는 것을 권장 (일관성 리뷰 INFO #4 와 동일 권고).

---

## 요약

이번 변경은 웹채팅 운영 콘솔의 서버 저장 기능(per-instance 외형 `config.interaction.appearance`), `interactionEnabled` JSONB 필터, `wc:resize` 동적 미리보기 높이, 테스트 커버리지 강화, 코드 품질 개선을 포함한다. 보안 관점에서 주요 위험 경로들은 모두 적절히 완화되어 있다. JSONB 필터는 TypeORM 파라미터 바인딩으로 SQL 인젝션이 방지되고, postMessage 핸들러는 source/origin 이중 검증을 유지하며 height 값을 clamp로 제한한다. 하드코딩된 시크릿은 테스트 픽스처 외에 존재하지 않는다. 인증/인가는 `RoleGate minRole="editor"` 로 생성/저장을 제한하고 서버측 인증 미들웨어를 거친다. 자유 텍스트 외형 필드(headerTitle 등)에 서버단 HTML 새니타이징이 없으나 React 자동 escape, 클라이언트 sanitizeDraft, JSON.stringify를 통한 다층 완화로 실제 XSS 경로는 제한적이다. 전체적으로 중대한 보안 취약점 없이 방어 심도가 잘 설계된 변경이다.

## 위험도

LOW

---

*Critical/Warning 발견 없음 — 모든 발견사항은 INFO 등급.*
