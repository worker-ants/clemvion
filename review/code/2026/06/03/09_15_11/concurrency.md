# 동시성(Concurrency) 리뷰

검토 대상: channel-web-chat 로컬 데모 호스트 + dev 포트 분리
검토일: 2026-06-03

---

## 발견사항

### [INFO] `logSeqRef.current++` 비원자적 증가 — 단일 스레드 환경에서 실질 위험 없음

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/feat-web-chat-demo/codebase/channel-web-chat/src/app/demo/demo-host.tsx` — `appendLog` 콜백 내 `logSeqRef.current++`
- **상세**: `logSeqRef.current++` 는 read-modify-write 복합 연산이다. 브라우저 JS 는 단일 스레드 이벤트 루프이므로 실제 경쟁 조건은 발생하지 않는다. 다만 React 18+ Concurrent Mode(Strict Mode 이중 실행 포함)에서 `appendLog` 가 동일 렌더 사이클 내에서 두 번 호출되어도 `ref` 는 렌더 간 공유 mutable 객체이므로 증가값 자체는 올바르게 유지된다. 실질 위험은 없다.
- **제안**: 현행 유지. 단순 순서 ID용이므로 문제없다.

---

### [INFO] `pendingBootRef` 비동기 읽기/쓰기 패턴 — 설계 의도에 맞게 안전하게 처리됨

- **위치**: `demo-host.tsx` — `handleBoot`(쓰기)와 `onMessage` 핸들러(읽기·null 재설정)
- **상세**: `handleBoot` 가 `pendingBootRef.current = buildBootConfig(form)` 을 쓰고, `setIframeKey` 로 iframe 을 재마운트한다. iframe 이 새로 로드된 뒤 `wc:ready` 메시지가 도달하면 `onMessage` 가 `pendingBootRef.current` 를 읽고 `null` 로 초기화한다. 두 접근 경로는 모두 브라우저 메인 스레드의 이벤트 루프 내에서 직렬 실행되며, React 상태 업데이트(`setIframeKey`)가 flush 되기 전에 `pendingBootRef` 쓰기가 완료된다. 따라서 경쟁 조건 없이 안전하다.
- **제안**: 현행 유지.

---

### [INFO] `window.addEventListener("message", onMessage)` 정리 패턴 — 올바르게 처리됨

- **위치**: `demo-host.tsx` — `useEffect` 내 이벤트 리스너 등록·해제
- **상세**: `useEffect` 의 cleanup 함수에서 `window.removeEventListener("message", onMessage)` 를 정확히 호출하고 있어 컴포넌트 언마운트 시 리스너가 누적되지 않는다. `[appendLog, postToWidget]` 의존성 배열도 올바르다(두 함수 모두 `useCallback` 으로 안정화). React Strict Mode 에서 effect 가 두 번 실행·해제되더라도 동일 핸들러 참조로 정확히 제거되므로 누적 없다.
- **제안**: 현행 유지.

---

### [INFO] `iframeRef` 접근 — `contentWindow` null 체크 올바름

- **위치**: `demo-host.tsx` — `postToWidget` 및 `onMessage`
- **상세**: `iframeRef.current?.contentWindow` 로 optional chaining 을 적용했고, `win` 이 null 이면 즉시 반환한다. `onMessage` 에서 `e.source !== iframeRef.current?.contentWindow` 검사 시 iframe 이 아직 로드되지 않은 경우(ref가 null) 도 early return 이 동작한다.
- **제안**: 현행 유지.

---

## 요약

변경 파일 중 실질적인 동시성 코드는 `demo-host.tsx` 의 postMessage 기반 host↔iframe 통신 패턴이다. 브라우저 단일 스레드 이벤트 루프 환경이므로 공유 mutable 상태(`pendingBootRef`, `logSeqRef`)에 대한 동시 접근은 발생하지 않는다. `useEffect` 이벤트 리스너 등록·해제 패턴은 올바르고, `iframeRef` null 체크도 적절하다. 나머지 파일(설정, 순수함수, 문서)은 동시성 관련 코드 없음. 전체 변경에서 경쟁 조건·데드락·스레드 안전성 위험은 발견되지 않는다.

---

## 위험도

NONE
