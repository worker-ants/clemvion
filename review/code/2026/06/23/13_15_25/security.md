# 보안(Security) 코드 리뷰

## 발견사항

### **[WARNING]** postMessage targetOrigin 이 빈 문자열일 때 `"*"` 로 폴백
- 위치: `codebase/frontend/src/components/web-chat/live-preview.tsx` — `postBoot()` 함수
- 상세: `widgetOrigin || "*"` 패턴은 `widgetOrigin` 이 빈 문자열(`""`)이거나 해석 실패 시 `"*"` 를 targetOrigin 으로 사용한다. `postMessage(payload, "*")` 는 수신 대상 origin 을 제한하지 않으므로, 브라우저 환경에서 중간자(악의적 iframe)가 메시지를 수신할 수 있다. boot config payload 에는 `apiBase`, `triggerEndpointPath`, 외형 설정 등 민감도는 낮으나 내부 구성 정보가 포함된다. 동봉 same-origin 맥락에서는 `widgetOrigin` 이 항상 채워져야 하나, SSR 또는 `getWidgetBase()` 실패 시 빈 문자열이 반환되어 `"*"` 로 전송된다.
- 제안: `widgetOrigin` 이 빈 문자열이면 `postMessage` 자체를 호출하지 않도록 조기 반환하거나, `getWidgetOrigin()` 의 실패 경우를 별도 상태(`status === "unavailable"`)로 처리해 `"*"` 폴백을 제거한다. 구체적으로:
  ```ts
  function postBoot() {
    const target = widgetOrigin;
    if (!target) return; // widgetOrigin 미확보 시 전송 안 함
    iframeRef.current?.contentWindow?.postMessage(
      { type: "wc:boot", payload: bootConfigRef.current },
      target,
    );
  }
  ```

---

### **[WARNING]** iframe `sandbox` 에 `allow-same-origin` 포함 — sandbox 무력화 위험
- 위치: `codebase/frontend/src/components/web-chat/live-preview.tsx` — iframe 엘리먼트 `sandbox` 속성
- 상세: `sandbox="allow-scripts allow-same-origin allow-forms"` 조합에서 `allow-scripts` + `allow-same-origin` 을 **동시에** 허용하면 iframe 내 스크립트가 부모 문서에 접근하는 sandox 우회가 이론적으로 가능하다(WHATWG 표준 주의사항). 단, 이 iframe 의 `src` 는 same-origin 동봉 위젯(`/_widget/web-chat/v1/app/`)이므로 해당 정적 빌드 자산이 신뢰된다고 가정하면 실질 위험은 낮다. 그러나 공격자가 위젯 번들에 악성 코드를 삽입하거나 빌드 공급망이 침해된 경우, sandbox 가 무효화된다.
- 제안: 위젯이 postMessage 통신만 필요하다면 `allow-same-origin` 을 제거하고 `allow-scripts allow-forms` 만 유지하는 것이 더 안전하다. 단, `allow-same-origin` 제거 시 위젯이 `localStorage`/cookie/fetch 를 쓰는 경우 기능이 깨질 수 있어 위젯 구현과 사전 조율 필요. 최소한 이 선택의 보안 트레이드오프를 코드 주석에 명시할 것.

---

### **[WARNING]** postMessage `e.source` 검증 후 `e.origin` 검증 순서 — 조건 완화 가능성
- 위치: `codebase/frontend/src/components/web-chat/live-preview.tsx` — `onMessage` 핸들러
- 상세: `if (e.source !== iframeRef.current?.contentWindow) return;` 이후 `if (widgetOrigin && e.origin !== widgetOrigin) return;` 에서 `widgetOrigin` 이 빈 문자열이면 origin 검증이 **완전히 건너뛰어진다**. `e.source` 검증만으로는 iframe 이 다른 origin 에서 navigate 되거나 교체된 경우를 방어하기 어렵다. `widgetOrigin` 이 빈 문자열일 때 origin 검증을 생략하는 것은 의도된 fail-open 이지만, same-origin 동봉 이외의 배포(CDN override)에서 외부 `wc:ready` 위조 메시지를 수신할 수 있다.
- 제안: `widgetOrigin` 이 확보된 경우에만 메시지 처리를 허용하는 방어적 로직 추가:
  ```ts
  if (widgetOrigin && e.origin !== widgetOrigin) return;
  if (!widgetOrigin && e.origin !== window.location.origin) return; // 폴백: self-origin 만 허용
  ```

---

### **[INFO]** `copy-widget.mjs` — `pnpm` 명령 실행 시 커맨드 인젝션 표면 없음(정적 인자)
- 위치: `codebase/frontend/scripts/copy-widget.mjs`
- 상세: `execSync("pnpm --filter channel-web-chat build", ...)` 와 `execSync("pnpm --filter @workflow/web-chat build:loader")` 는 **완전 정적 리터럴 문자열**이므로 커맨드 인젝션 표면이 없다. 경로 계산(`path.resolve`, `path.join`)도 고정된 상대 경로(`../..`)를 기반으로 하고 외부 입력을 삽입하지 않는다.
- 제안: 현 설계에서 인젝션 위험 없음. `rmSync(dest, { recursive: true, force: true })` 의 `dest` 도 계산된 내부 경로이므로 경로 탈출 위험 없음.

---

### **[INFO]** `NEXT_PUBLIC_WIDGET_CDN_BASE` — 환경변수 트러스트 경계 명확
- 위치: `codebase/frontend/src/lib/web-chat/widget-base.ts`
- 상세: `process.env.NEXT_PUBLIC_WIDGET_CDN_BASE?.trim()` 값이 그대로 `URL` 생성자로 전달된다. `new URL(base, ref).origin` 호출은 `try/catch` 로 감싸져 있어 잘못된 URL 이 예외를 던져도 안전하게 빈 문자열로 처리된다.
- 제안: 보안상 별도 조치 불필요. 설정 오류는 런타임 `""` 반환으로 graceful 처리됨.

---

### **[INFO]** `localStorage` 외형 데이터 — 민감 정보 미포함 확인
- 위치: `codebase/frontend/src/components/web-chat/use-appearance-draft.ts` (간접 — plan/spec 기술 내용)
- 상세: spec §4, plan에 따르면 `localStorage` 에 보존되는 값은 외형/콘텐츠 필드(`primaryColor`, `position`, `headerTitle` 등)로 인증 토큰, API 키, 개인정보를 포함하지 않는다.
- 제안: 현 설계에서 `localStorage` 저장 데이터는 민감 정보에 해당하지 않음. XSS 로 탈취되어도 공개 설정값에 해당하므로 위험도 낮음.

---

### **[INFO]** 하드코딩된 시크릿 없음
- 위치: 전체 변경 파일
- 상세: 변경된 모든 파일에서 API 키, 비밀번호, 토큰, 인증서 등 하드코딩된 시크릿은 발견되지 않았다.

---

### **[INFO]** 에러 메시지 — 민감 정보 미노출 확인
- 위치: `codebase/frontend/scripts/copy-widget.mjs`
- 상세: `throw new Error("[copy-widget] widget build 산출물 없음: ${widgetOut}")` 에서 빌드 스크립트 내부 경로가 오류 메시지에 포함된다. 이 스크립트는 CI/빌드 시스템에서만 실행되므로 사용자에게 노출되지 않는다.
- 제안: 빌드 도구 오류는 허용 범위. 별도 조치 불필요.

---

## 요약

이번 변경의 핵심 보안 표면은 **iframe postMessage 통신**이다. 전반적으로 `e.source` 검증과 origin 검증이 구현되어 있고 테스트도 작성되어 있어 기본 방어가 갖춰져 있다. 그러나 두 가지 WARNING 이 주목할 만하다. (1) `postBoot()` 에서 `widgetOrigin` 이 빈 문자열일 때 `"*"` 를 targetOrigin 으로 사용하는 패턴은 boot config 를 제한 없이 전송하는 약점이 있으며, (2) `sandbox="allow-scripts allow-same-origin"` 조합은 위젯 번들 자체가 안전한 한 실질 위험이 낮지만 sandbox 보호를 이론적으로 무효화할 수 있다는 점에서 설계 의도를 명시하고 최소화를 검토해야 한다. `e.origin` 검증이 `widgetOrigin` 부재 시 건너뛰어지는 점도 CDN override 배포에서의 허점으로 보완이 필요하다. 빌드 스크립트(`copy-widget.mjs`)는 정적 명령만 사용해 커맨드 인젝션 위험이 없고, 하드코딩된 시크릿도 전혀 없다.

## 위험도

MEDIUM
