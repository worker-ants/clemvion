# 보안(Security) Review

대상 파일:
- `/Volumes/project/private/clemvion/.claude/worktrees/webchat-queue-replay-arguments/codebase/packages/web-chat-sdk/src/loader.ts`
- `/Volumes/project/private/clemvion/.claude/worktrees/webchat-queue-replay-arguments/codebase/packages/web-chat-sdk/src/loader.spec.ts`

추가 맥락 파일 (직접 변경 대상 외 참조):
- `codebase/packages/web-chat-sdk/src/index.ts`
- `codebase/packages/web-chat-sdk/src/bridge.ts`
- `codebase/packages/web-chat-sdk/src/types.ts`

---

### 발견사항

- **[WARNING] updateProfile 에 payload 크기 제한 없음**
  - 위치: `loader.ts` L74, `index.ts` L105
  - 상세: `boot` 의 `profile` 필드는 `validateBootConfig` 에서 16,384 chars 로 제한되어 있으나, `updateProfile(profile)` 명령은 크기 제한 없이 `wc:command` postMessage 로 전달된다. 악의적 사용자가 매우 큰 객체를 `updateProfile` 로 반복 전송하면 메모리 소비·네트워크 과부하·서버 저장소 비대화가 발생할 수 있다.
  - 제안: `index.ts` 의 `updateProfile` 구현 내에서 `JSON.stringify(profile).length > MAX_PROFILE_BYTES` 검사를 적용하거나 별도 `MAX_UPDATE_PROFILE_BYTES` 상수를 도입한다.

- **[WARNING] sendMessage 에 길이 제한 없음**
  - 위치: `loader.ts` L72, `index.ts` L104
  - 상세: `sendMessage(String(args[0] ?? ""))` 은 임의 길이 문자열을 허용한다. 수 MB 단위의 메시지를 반복 전송해 iframe postMessage 버퍼·서버 수신 처리에 부하를 줄 수 있다.
  - 제안: `index.ts` 의 `sendMessage` 구현에서 `text.length > MAX_MESSAGE_LENGTH` 가드를 추가하고 초과 시 warn + 절단 또는 무시 처리한다.

- **[WARNING] iframe sandbox "allow-scripts + allow-same-origin" 조합**
  - 위치: `bridge.ts` L62
  - 상세: `sandbox="allow-scripts allow-forms allow-same-origin"` 조합은 iframe 이 호스트 페이지와 동일 origin 일 경우 sandbox 를 완전 무력화한다(OWASP A05 보안 설정 오류). 프로덕션 CDN 배포에서는 widget iframe 이 다른 origin 이므로 실질 위험이 없으나, 로컬 개발 환경(`localhost`)에서 같은 origin 으로 설정하거나 CDN 도메인이 호스트 페이지 도메인과 동일해지는 배포 실수가 발생하면 iframe 이 부모 DOM 에 자유롭게 접근 가능해진다. 현재 코드 주석("Same-Origin 아님")이 이 가정을 문서화하고 있으나 코드 단에서의 강제가 없다.
  - 제안: `resolveIframeTarget` 에서 `widgetOrigin !== window.location.origin` 를 검증하는 런타임 어서션을 추가하거나, `allow-popups` 등 실제로 필요한 최소 권한만 명시하고 `allow-same-origin` 제거 가능 여부를 위젯 SPA 의 localStorage 사용 여부와 함께 재검토한다.

- **[INFO] globalName 에 'constructor' 등 prototype-chain 프로퍼티 사용 시 가드 미통과**
  - 위치: `loader.ts` L113-129
  - 상세: 점유 가드는 `typeof existing !== "function"` 체크로 비함수 전역을 보호하지만, `window.constructor`(`Window` 생성자, 타입 "function") 처럼 함수인 내장 프로퍼티에 대해서는 가드가 동작하지 않아 `w["constructor"] = api` 가 실행된다. `globalName` 은 `data-global` 속성(개발자 통제)에서 비롯되므로 일반 사용자 공격 경로는 아니나, SDK 내부 방어 측면에서 허용 전역명을 화이트리스트 정규식(`/^[A-Za-z_$][A-Za-z0-9_$]*$/`)으로 제한하는 것이 권장된다.

- **[INFO] apiBase / triggerEndpointPath URL 형식 미검증**
  - 위치: `index.ts` L55-59 (`validateBootConfig`)
  - 상세: 필드의 존재 여부(falsy 체크)만 확인하고 프로토콜·형식·도메인 화이트리스트 검증이 없다. `apiBase: "javascript:alert(1)"` 같은 값도 통과한다. 다만 `resolveIframeTarget` 에서 `URLSearchParams` 인코딩을 거치므로 현재 코드 경로에서 직접적인 XSS 트리거는 되지 않는다. 그러나 `widgetBase` 변조(CDN URL 주입)와 조합되면 `widgetOrigin` 이 공격자 도메인이 되어 postMessage origin 검증이 무효화된다.
  - 제안: `validateBootConfig` 에서 `new URL(config.apiBase)` 파싱 성공 여부와 `protocol === "https:"` (또는 개발 환경 `http:localhost`) 검증을 추가한다.

- **[INFO] wc:event 페이로드가 콜백에 무검증 전달**
  - 위치: `bridge.ts` L150-153
  - 상세: `ev.data` 가 `emit(ev.name, ev.data)` 를 통해 사용자 콜백으로 그대로 전달된다. origin + source 검증이 이미 적용되어 있어 외부 임의 스크립트의 직접 주입은 차단되나, 위젯 SPA 가 손상됐을 때 콜백 인자로 악의적 객체가 유입될 수 있다. 이 경우의 2차 피해(콜백 내 `innerHTML` 사용 등)는 호스트 개발자 책임 영역이다.
  - 제안: SDK 문서/타입에 "콜백 수신 데이터는 신뢰 수준을 검증 후 사용" 주석을 명시한다.

- **[INFO] 큐 전체 항목 수 무제한**
  - 위치: `loader.ts` L132-150 (replay loop)
  - 상세: 개별 call 의 args 수는 32 로 제한하지만 `existing.q` 배열 전체 길이는 무제한이다. 스니펫이 boot 전 대량 호출을 받는 환경(SPA 라우팅 중 ClemvionChat 이 느리게 로드)에서 수천 개 항목이 replay 루프에 쌓일 수 있다.
  - 제안: `queued.slice(0, MAX_QUEUE_LENGTH)` 등의 상한을 두고 초과 항목을 warn 후 드롭한다.

---

### 요약

리뷰 대상 코드(loader.ts, loader.spec.ts)는 보안 의식이 높은 설계를 보인다. origin 검증(bridge.ts), profile 크기 제한(index.ts), 큐 args 길이 가드, 점유 가드, 중복 설치 방지 등 주요 방어 레이어가 구현되어 있으며 하드코딩된 시크릿이나 SQL/커맨드 인젝션 벡터는 없다. 주된 보완 과제는 DoS 방어 완결(updateProfile/sendMessage 크기 미제한)과 sandbox 구성의 명시적 런타임 강제, apiBase URL 프로토콜 검증이다. iframe sandbox "allow-scripts + allow-same-origin" 조합은 프로덕션 CDN 분리 원칙이 지켜지는 한 실질 위험이 없으나, 개발 환경 동일 origin 충돌 시 심각해질 수 있어 구조적 방어가 권장된다.

### 위험도

LOW
