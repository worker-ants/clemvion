# 보안(Security) 리뷰

## 발견사항

- **[INFO]** `length` 상한 없는 array-like 처리 — 잠재적 DoS
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-queue-replay-arguments/codebase/packages/web-chat-sdk/src/loader.ts` `installGlobal` replay 루프 (`typeof (item as ArrayLike<unknown>).length !== "number"` 가드 이후)
  - 상세: `length` 값의 상한 검증이 없어 악성 큐 항목 `{ length: 1e9, 0: "boot" }` 처럼 설정하면 `Array.prototype.slice.call` 이 거대 희소 배열 생성을 시도한다. 실제 익스플로잇 전제는 동일 페이지에서 스크립트 실행 권한이 필요하므로 실질 위협도는 낮다.
  - 제안: `const len = (item as ArrayLike<unknown>).length; if (!Number.isFinite(len) || len > 32)` 형태의 상한 가드 추가(메서드 인자 수는 실제 10개 미만임).

- **[INFO]** `globalName` 파라미터 프로토타입 오염 가능성 (이론적)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-queue-replay-arguments/codebase/packages/web-chat-sdk/src/loader.ts` `installGlobal` — `w[globalName] = api`
  - 상세: `globalName` 이 `"__proto__"` 또는 `"constructor"` 로 설정되면 `w["__proto__"] = api` 가 `Window` 객체의 프로토타입 체인을 덮어쓸 수 있다. `globalName` 은 HTML `data-global` 속성에서 유래하므로 HTML 제어권이 없는 외부 공격자는 설정이 불가능하다. 단, XSS 가 이미 성립한 상황에서 부차적 피해 확대 경로가 된다.
  - 제안: 함수 진입부에서 `if (["__proto__", "constructor", "prototype"].includes(globalName)) { console.warn(...); return createGlobalApi(bootFn); }` 방어 가드 추가.

- **[INFO]** 큐에서 유래한 `apiBase` 로 임의 외부 서버 연결 가능
  - 위치: `/Volumes/project/private/clemvion/.claire/worktrees/webchat-queue-replay-arguments/codebase/packages/web-chat-sdk/src/loader.ts` `dispatch` case `"boot"`
  - 상세: 동일 페이지의 악성 스크립트가 로더 실행 전 `window.ClemvionChat.q` 에 `{ 0: "boot", 1: { apiBase: "https://evil.example" }, length: 2 }` 를 주입하면 SDK 가 악성 서버로 `boot` 를 시도할 수 있다. 이 변경 이전에도 동일 위험이 존재하며, 이번 수정이 새로운 공격 표면을 추가하지는 않는다. 전제 조건이 스크립트 실행 권한이므로 same-origin 신뢰 모델 내부 문제다.
  - 제안: `boot` 함수 내부(SDK 레이어)에서 `apiBase` 도메인 화이트리스트 또는 same-origin 검증을 심층 방어로 추가하는 것이 바람직하나, 현재 변경 범위(replay 루프) 밖의 개선 사항이다.

- **[INFO]** `console.warn` 에 외부 입력(메서드 명) 포함
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-queue-replay-arguments/codebase/packages/web-chat-sdk/src/loader.ts` default case — `` `[web-chat] 알 수 없는 메서드: ${String(method)}` ``
  - 상세: 브라우저 콘솔은 HTML/JS 를 실행하지 않아 XSS 해당 없다. 단, 외부 로그 수집 솔루션(Sentry, Datadog 등) 연동 시 사용자 제어 문자열이 로그 스트림에 유입(로그 인젝션) 될 수 있다.
  - 제안: 현재 코드는 `String(method)` 로 강제 변환 후 로그 — 적절한 수준. 외부 로깅 연동 시 메서드 명 최대 길이 제한(예: 64자) 또는 알파벳/숫자/하이픈 외 문자 치환을 권장한다.

## 요약

이번 변경은 `Array.isArray` 필터를 length 기반 array-like 수용 로직으로 교체한 순수 버그 수정이다. 새로운 공격 표면이 추가되지 않았으며, 발견된 항목들은 모두 기존 설계에 이미 내재해 있거나 클라이언트 브라우저 SDK 의 same-origin 신뢰 모델 경계 내의 이론적 케이스다. 하드코딩된 시크릿, 인증 우회, 암호화 취약점, 의존성 보안 문제는 변경 범위 내에 없다. 테스트 파일의 더미 값(`apiBase: "a"`)은 테스트 전용으로 실 운영에 유출되지 않는다.

## 위험도

LOW
