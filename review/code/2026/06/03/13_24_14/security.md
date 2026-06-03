# 보안(Security) 리뷰

리뷰 대상: feat-web-chat-demo (5개 파일)
리뷰 일시: 2026-06-03

---

## 발견사항

### **[INFO]** SSE 토큰을 URL 쿼리 파라미터로 전달
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/feat-web-chat-demo/codebase/channel-web-chat/src/lib/eia-client.ts` — `openStream()`, 라인 104
- 상세: `EventSource`는 커스텀 HTTP 헤더를 지원하지 않아 `?token=<bearer>` 형식으로 쿼리에 토큰을 포함한다. 이 방식은 서버 액세스 로그·브라우저 히스토리·Referer 헤더에 토큰이 노출될 수 있다. 다만 이 변경 세트 자체의 신규 도입은 아니고 기존 설계이며, spec 에서도 명시적으로 허용한 패턴(`EIA §8.3`)으로 문서화되어 있다.
- 제안: 중장기적으로 POST 기반 SSE(fetch + ReadableStream) 또는 토큰 교환용 단명 cookie로 전환을 검토한다. 현 단계에서는 토큰 유효 기간(만료 30분 전 갱신)을 짧게 유지하고 HTTPS 강제를 통해 위험을 완화한다.

### **[INFO]** `normalizeApiBase`의 case-insensitive `/api` 제거
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/feat-web-chat-demo/codebase/channel-web-chat/src/app/demo/demo-config.ts` — `normalizeApiBase()`, 라인 357
- 상세: `/api$/i` 정규식이 대소문자 구분 없이 후행 `/api` 를 제거한다. `/API` 또는 `/Api` 로 끝나는 경로에도 동작하며, 의도치 않은 URL 변형 가능성이 있다. 그러나 이 함수는 데모 전용 dev 하니스에서만 사용되고, 실제 `apiBase`는 사용자가 폼에 직접 입력하므로 공격 표면이 없다.
- 제안: 정규식을 `/\/api$/` (대소문자 구분)로 제한하는 것이 더 명확하다.

### **[INFO]** `configFromQuery()` — URL 쿼리에서 `apiBase` 직접 수용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/feat-web-chat-demo/codebase/channel-web-chat/src/widget/use-widget.ts` — `configFromQuery()`, 라인 1046-1053
- 상세: `?apiBase=` 쿼리 파라미터를 그대로 `EiaClient` 의 API 호출 베이스로 사용한다. 이는 이미 기존 코드에 있던 패턴이며 이번 변경에서 수정되지 않았다. 악의적인 `apiBase` 주입 시 위젯이 공격자 서버로 토큰·메시지를 전송하는 SSRF 유사 위협이 존재한다. 다만 CSR(브라우저)에서 동작하므로 서버 측 SSRF는 아니고, XSS 전제가 없으면 쿼리 파라미터 조작은 로컬 사용자에만 영향을 미친다. 또한 `isEmbedAllowed` 가 `enforce=true` 일 때 호스트 origin 을 검증한다.
- 제안: `apiBase` 의 스키마를 `https?:` 로 제한하는 가벼운 검증을 `configFromQuery` 또는 `applyConfig` 진입부에 추가하면 `javascript:` 등의 이상 스키마를 차단할 수 있다.

### **[INFO]** postMessage `targetOrigin` 핀 이전에 `wc:ready` 를 `*` 로 전송
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/feat-web-chat-demo/codebase/channel-web-chat/src/widget/host-bridge.ts` — 라인 64
- 상세: 핸드셰이크 초기 신호(`wc:ready`)는 비밀 데이터를 포함하지 않으므로 `targetOrigin: '*'` 는 spec 설계 의도와 일치한다. 이번 변경 세트에서 수정된 파일이 아니며, 코드 주석에도 명시(`비밀이 없으므로 targetOrigin '*' 안전`)되어 있다. `wc:boot` 수신 이후에는 hostOrigin 이 핀되어 이후 메시지는 검증된 origin으로만 전송·수신한다.
- 제안: 현재 구현이 올바르다. 추가 조치 불필요.

### **[INFO]** 데모 UI에 환경 설정 정보(CORS 설정법) 노출
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/feat-web-chat-demo/codebase/channel-web-chat/src/app/demo/demo-host.tsx` — 라인 509-515
- 상세: `WEB_CHAT_WIDGET_ORIGINS=http://localhost:3013` 와 같은 backend `.env` 키 이름이 UI에 직접 노출된다. 이 데모 페이지는 `isDemoEnabled` 가 production 환경에서 차단하므로 공개 서비스에는 노출되지 않는다(`NEXT_PUBLIC_ENABLE_DEMO=1` opt-in 없이 production static export 제외). 개발자 대상 힌트 텍스트로 허용 가능한 수준이다.
- 제안: 현 설계(dev-only 게이팅)가 적절하다. `NEXT_PUBLIC_ENABLE_DEMO=1` 로 production 노출 시 이 힌트 텍스트가 표시됨에 주의한다.

### **[INFO]** `console.warn` 에 SSE 에러 이벤트 객체 전체 출력
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/feat-web-chat-demo/codebase/channel-web-chat/src/widget/use-widget.ts` — 라인 1128-1132
- 상세: `onError` 핸들러가 `EventSource` 의 `e` 객체를 `console.warn` 에 그대로 전달한다. `EventSource` error 이벤트는 URL·응답 헤더 등 민감 정보를 포함하지 않는 것이 브라우저 표준 동작이다(CORS 차단 시 의도적으로 정보가 제거됨). 현재 위험도는 낮다.
- 제안: 향후 `e` 객체에서 필요한 필드만 추출하여 출력하는 것을 고려하되, 현재는 허용 가능하다.

### **[INFO]** localStorage에 Bearer 토큰 저장
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/feat-web-chat-demo/codebase/channel-web-chat/src/lib/session-store.ts` — `saveSession()`, 라인 29-41
- 상세: `token`(per_execution Bearer 토큰)이 `localStorage`에 JSON으로 저장된다. 동일 origin의 XSS가 있을 경우 토큰이 탈취될 수 있다. 이 파일은 이번 변경 세트에서 수정되지 않은 기존 코드이다. 토큰 유효 기간이 제한적이고 새로고침 복원이라는 명확한 UX 목적이 있다.
- 제안: 토큰 유효 기간을 최소화하는 현재 방식을 유지하고, 위젯이 삽입되는 호스트 페이지의 XSS 방어에 의존하는 것이 불가피한 설계 트레이드오프이다. `sessionStorage`로 전환하면 탭 종료 시 자동 소거되어 노출 창을 줄일 수 있다(기능 트레이드오프 수반).

---

## 요약

이번 변경 세트(README 문서 개선, `normalizeApiBase` 추가, demo-host UI 힌트 추가, `openStream` onError 핸들러 추가)는 보안 측면에서 실질적인 취약점을 도입하지 않는다. 주요 보안 요소인 postMessage origin 핀, DOMPurify 기반 HTML sanitize, embed origin 검증(`isEmbedAllowed`), 토큰 만료 처리는 모두 기존 코드에 올바르게 구현되어 있으며 이번 변경이 이를 약화시키지 않는다. 발견된 항목은 모두 기존 설계 트레이드오프(SSE 쿼리 토큰, localStorage 저장)이거나 dev-only 컨텍스트에 한정된 정보 노출로, 현재 아키텍처에서 허용 가능한 수준이다.

---

## 위험도

LOW
