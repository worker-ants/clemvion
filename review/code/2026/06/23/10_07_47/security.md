# 보안(Security) 리뷰 결과

## 발견사항

### WARNING: XSS — `escapeForScript` 가 `</script>` 만 이스케이프하고 `<!--` 등 다른 종료 패턴을 처리하지 않는다
- 위치: `codebase/frontend/src/lib/web-chat/snippet.ts` — `escapeForScript` 함수 (L683-L685)
- 상세: 현재 구현은 `</script>` (대소문자 무관) 만 `<\/script>` 로 치환한다. HTML 파서가 `<script>` 블록을 종료시키는 다른 경로인 `<!--` (일부 구형 파서), `</SCRIPT\n>` 스페이스 변형 등은 처리하지 않는다. 그러나 현대 HTML5 파서에서는 `</script>` 변형(대소문자·공백 포함)이 실질적 위협이며 현재 `gi` 플래그로 대소문자는 커버된다. 실질적 잔여 위험은 낮으나 `<\/` 로 시작하는 모든 태그 이름 앞에 적용하거나 `JSON.stringify` 기반 추가 래핑(예: U+2028/U+2029 이스케이프)을 고려할 수 있다.
- 제안: 현재 구현은 주요 XSS 벡터를 차단한다. 추가 강화로 `U+2028` / `U+2029` (행 구분자 — 일부 환경에서 JS 줄바꿈으로 해석) 도 ` ` / ` ` 로 치환하는 것을 권장한다.

```typescript
// 현재
return json.replace(/<\/(script)/gi, "<\\/$1");

// 권장 (추가 강화)
return json
  .replace(/<\/(script)/gi, "<\\/$1")
  .replace(/ /g, "\\u2028")
  .replace(/ /g, "\\u2029");
```

---

### WARNING: localStorage 에 저장된 외형 데이터를 역직렬화할 때 타입 단언으로만 검증한다
- 위치: `codebase/frontend/src/components/web-chat/use-appearance-draft.ts` — `readDraft` 함수 L2009
- 상세: `JSON.parse(raw) as Partial<WebChatDraft>` 는 런타임 타입 검증이 없다. localStorage 는 XSS 공격자나 동일 origin 의 다른 스크립트가 오염시킬 수 있다. 오염된 값이 `primaryColor` 필드에 들어오면 CSS `type="color"` input 을 통해 렌더되고, `headerTitle`·`welcomeText`·`disclaimer` 등은 스니펫 JSON 에 포함된다. React 는 `{inst.name}` 등을 자동 이스케이프하므로 UI 상 XSS 는 차단되지만, 스니펫 문자열은 `buildWebChatSnippet` 경유로 `<pre><code>` 블록에 렌더된다. `<code>` 내 텍스트는 브라우저가 HTML 이 아닌 텍스트 노드로 해석하므로 직접 XSS 는 발생하지 않는다. 그러나 스니펫을 복사해 운영자의 타사 사이트에 붙여넣을 때 `</script>` 이스케이프 이외의 악성 페이로드가 탈출할 가능성은 `escapeForScript` 에 의존한다.
- 제안: localStorage 값을 읽을 때 허용된 필드 키·값 형식을 런타임에 검증하는 간단한 sanitizer를 추가한다. 최소한 `primaryColor` 는 `#[0-9a-fA-F]{6}` 패턴, `position` 은 허용값 화이트리스트로 검사한다.

---

### WARNING: `endpointPath` 클라이언트 생성 UUID — 서버 측 중복/포맷 검증 미확인
- 위치: `codebase/frontend/src/components/web-chat/use-web-chat.ts` — `useCreateWebChat` 함수 L2263
- 상세: `endpointPath: crypto.randomUUID()` 로 클라이언트가 공개 webhook URL 경로를 생성한다. `crypto.randomUUID()` 는 암호학적으로 안전한 난수를 사용하므로 예측 불가능성은 충분하다. 다만 서버가 이 값을 포맷(UUID v4 형식) 및 유일성(중복 공격) 관점에서 검증하는지 이 PR 범위에서 확인할 수 없다. 클라이언트가 임의 문자열(경로 탐색 문자 포함: `../`, URL 인코딩 등)을 전송할 경우를 서버가 차단하는지 확인이 필요하다.
- 제안: 서버의 `/triggers` POST 핸들러에서 `endpointPath` 가 UUID v4 포맷임을 검증하고, 경로 구분자(`/`, `..`)를 거부하는 검증이 있는지 확인한다. 이 PR 범위에서는 프론트엔드 코드만 변경되므로 기존 백엔드 검증에 의존함을 명시한다.

---

### INFO: `RoleGate` 는 UI 제어만 — 백엔드 RBAC 은 기존 `/api/triggers` POST 에 의존
- 위치: `codebase/frontend/src/app/(main)/web-chat/page.tsx` — `RoleGate` (L385-L392)
- 상세: `RoleGate minRole="editor"` 로 "New web chat" 버튼을 viewer 에게 숨기는 클라이언트 측 RBAC 이다. 이는 UI 편의 목적이며 실제 인가는 백엔드 `/api/triggers` POST 가 담당한다. 이 패턴은 기존 트리거 관리와 일관되어 프로젝트 규약 범위 내다. JavaScript 비활성화 또는 직접 API 호출 시 우회 가능하지만, 이는 클라이언트 측 gate 의 일반적 한계이며 백엔드 검증이 실질적 보호선임을 문서로 확인하는 것이 바람직하다.
- 제안: 특별히 수정 불필요. 기존 백엔드 인가 로직이 해당 역할 권한을 올바르게 시행하는지 확인한다.

---

### INFO: 외형 설정이 백엔드에 저장되지 않아 localStorage 의존 — 세션/기기 간 데이터 손실 위험
- 위치: `codebase/frontend/src/components/web-chat/use-appearance-draft.ts` — 전체 파일
- 상세: 이는 보안 취약점은 아니나, `spec 5-admin-console §4·R3` 에 명시된 설계 결정이다. localStorage 에만 저장되므로 설정이 브라우저별·기기별로 다를 수 있고, 브라우저 데이터 초기화 시 소실된다. 또한 `KEY_PREFIX = "clemvion:web-chat:appearance:"` 로 네임스페이스가 지정되어 키 충돌 위험은 낮다.
- 제안: 현 스펙의 의도적 결정이므로 보안상 조치 불필요. 다만 증분 2 에서 iframe 미리보기가 활성화될 때 localStorage 데이터가 iframe postMessage 로 전달될 경우 origin 검증을 철저히 해야 한다.

---

### INFO: 스니펫 `loaderSrc` URL 에도 `escapeForScript` 적용 — 올바른 방어
- 위치: `codebase/frontend/src/lib/web-chat/snippet.ts` — `buildWebChatSnippet` L2694-L2695
- 상세: `loaderSrc = escapeForScript(loaderUrl)` 로 loader URL 에도 이스케이프를 적용한다. `getWidgetBase()` 는 `window.location.origin` 또는 환경변수에서 도출되므로 직접 사용자 입력은 아니나, 방어적으로 처리하는 것이 적절하다. 그러나 `j.src="${loaderSrc}"` 에서 큰따옴표가 이스케이프되지 않으므로 `loaderUrl` 에 `"` 가 포함될 경우 속성 이스케이프 탈출이 가능하다. `window.location.origin` 은 브라우저가 보장하는 안전한 origin 형식이므로 실제 위험은 없으나, `NEXT_PUBLIC_WIDGET_CDN_BASE` 환경변수가 `"` 를 포함할 경우 이론적 문제가 된다.
- 제안: `loaderSrc` 를 `j.src` 에 삽입 전 `"` → `&quot;` 또는 `\"` 로 이스케이프하거나, 환경변수 값에 대한 URL 포맷 검증을 추가한다.

---

### INFO: 하드코딩된 시크릿 없음 — 정상
- 위치: 전체 파일
- 상세: API 키, 토큰, 비밀번호 등 하드코딩된 시크릿이 코드에 포함되지 않았다. 환경변수(`NEXT_PUBLIC_WIDGET_CDN_BASE`)는 공개 설정값으로 시크릿이 아니다.

---

## 요약

이번 변경은 프론트엔드 전용 웹채팅 운영 콘솔 신설이다. 가장 주목할 보안 처리는 `escapeForScript`를 통한 스니펫 내 `</script>` XSS 차단으로, 의도적이고 테스트로 검증된 방어다. 주요 경고 사항은 두 가지다: (1) `escapeForScript`가 `U+2028/U+2029` 행 구분자를 처리하지 않아 일부 환경에서 이스케이프 우회 여지가 있고, (2) localStorage 역직렬화 시 런타임 타입/포맷 검증이 없어 오염된 값이 스니펫에 포함될 수 있다(현재는 `</script>` 이스케이프로 최악의 경우를 방어하지만 심층 방어가 부족하다). `endpointPath` 클라이언트 UUID 생성은 `crypto.randomUUID()`로 안전하게 처리하나 서버 측 검증 확인이 필요하다. 하드코딩된 시크릿이나 인증 우회 패턴은 발견되지 않았으며, RBAC은 기존 프로젝트 패턴에 부합하게 UI 레이어와 백엔드 레이어를 분리하여 적용하고 있다.

## 위험도

LOW
