# 보안(Security) 코드 리뷰

리뷰 대상: Channel Web Chat 위젯 리팩터(B) + 테스트 보강(C) — 후속 커밋(isTextInputSurface 단위 테스트 추가 · TERMINAL_EVENTS 캐스트 주석 · fake-timer 주석)
검토 일시: 2026-06-27

---

## 발견사항

### [INFO] `isTextInputSurface` denylist 방식 — 미지 interaction type 을 텍스트 표면으로 허용
- 위치: `/codebase/channel-web-chat/src/lib/widget-state.ts` — `isTextInputSurface` 함수
- 상세: 구현이 `buttons`/`form` 이 **아닌** 모든 값(및 null)을 텍스트 표면으로 반환하는 denylist 구조다. 신규 단위 테스트(widget-state.test.ts 추가분)는 `ai_conversation`/`null`/`buttons`/`form` 네 케이스만 검증하며, 서버가 알 수 없는 interaction type(`voice`, `image_upload` 등)을 SSE로 전송할 경우 UI에서 텍스트 입력이 활성화된 채 submit 될 수 있다. 런타임 SSE 페이로드는 `as WaitingForInputEvent` 캐스팅으로 들어오기 때문에 TypeScript 의 타입 가드는 실질 방어가 되지 않는다. JSDoc 주석에서 "allowlist 의미"라 설명하지만 구현은 denylist이므로 주석·구현 불일치가 잠재적 혼선의 소지다.
- 제안: (1) allowlist 전환: `pending?.type === "ai_conversation" || pending == null` 로 구현하면 미지 type이 자동으로 false 처리된다. (2) 현행 denylist 유지 시 `parseWaitingForInput` 에서 알 수 없는 type 을 기본값(`ai_conversation` 또는 별도 `unknown` 타입)으로 정규화하는 방어 로직을 강제화한다. 상류 정규화가 이미 존재하는 경우 JSDoc 에 해당 사실을 명시하여 신뢰 체계를 문서화한다.

---

### [INFO] error 메시지 UI 원문 노출 — pre-existing, 이번 변경 범위 외
- 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx` — `{error && <div className="wc-error" role="alert">{error}</div>}`
- 상세: `state.error` 가 SSE 페이로드 문자열이나 내부 에러 메시지를 직접 렌더한다. 본 리팩터(후속 커밋)는 이 영역을 수정하지 않았으나 변경된 코드 경로(`teardownSession` → ENDED dispatch)에서 에러 문구가 흘러들 수 있는 구조는 동일하다. 서버 측 스택 트레이스·경로·토큰 일부가 사용자 화면에 노출될 가능성.
- 제안: `plan/in-progress/web-chat-quality-backlog.md §A` 의 "start() 에러 메시지 UI 일반화(W1)" backlog 항목으로 이미 추적 중. 우선순위 상향을 권장하며 현 리팩터 범위에서는 비차단.

---

### [INFO] `configFromQuery()` — URL 쿼리 파라미터 `apiBase` 무검증
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `configFromQuery()` (이번 diff 범위에는 없으나 변경된 `use-widget.ts` 파일 내 존재)
- 상세: `?apiBase=` 쿼리스트링 값을 origin 검증 없이 API 요청 기반 URL 로 사용한다. 공격자가 iframe src 를 조작하거나 직접 URL을 로드할 경우 악의적 서버로 요청이 전송될 수 있다(open-redirect/SSRF 유사 벡터). 정상 임베드 경로(PostMessage `wc:boot`)에서는 호스트가 값을 주입하지만 폴백 경로는 무방비 상태다.
- 제안: `apiBase` 에 대해 `https://` 스킴 강제 + `javascript:`·`data:` 거부, 가능하면 허용 origin 화이트리스트 검증을 추가한다. `plan/in-progress/web-chat-quality-backlog.md §C 메모`(보안 #6)로 이미 등록됨 — 비차단.

---

### [INFO] per_execution 토큰 `localStorage` 저장 — 탭 종료 후 잔류
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `saveSession`/`loadSession`/`clearSession` (session-store 경유)
- 상세: `teardownSession` 헬퍼가 세션 정리 시 `clearSession` 을 호출하나, 비정상 종료·브라우저 강제 종료 시에는 `localStorage` 토큰이 잔류한다. 공유 컴퓨터 환경 또는 XSS 발생 시 `iext_*` 토큰이 탈취 가능하다. per_execution 단명 토큰이므로 위험도는 낮으나 defense-in-depth 관점에서 개선 여지가 있다.
- 제안: `sessionStorage` 전환으로 탭 종료 시 자동 소거. `plan/in-progress/web-chat-quality-backlog.md §A` backlog 항목으로 추적 중 — 비차단.

---

## 요약

이번 변경(isTextInputSurface 단위 테스트 추가, TERMINAL_EVENTS 캐스트 주석, fake-timer 의도 주석, 체크박스 갱신)은 behavior-preserving 리팩터의 문서화·테스트 보강 후속 커밋이다. 새로 도입된 코드 경로에서 인젝션 취약점·하드코딩 시크릿·인증 우회·암호화 문제는 발견되지 않는다. 보안 관련 발견사항 네 건 모두 INFO 수준이며, 그중 세 건(에러 메시지 노출·localStorage 토큰·configFromQuery 무검증)은 pre-existing 사항으로 이미 backlog에 등록되어 있다. `isTextInputSurface` denylist 설계는 상류 `parseWaitingForInput` 정규화에 의존하는 구조로 현재는 저위험이나 새 interaction type 추가 시 실수 가능성이 있어 allowlist 전환 또는 신뢰 체계 문서화를 권장한다. Critical 및 Warning 발견사항 없음.

## 위험도

LOW
