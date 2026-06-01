# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [INFO] refreshToken 경쟁 조건 — 동시 boot 시 이중 스케줄 가능성
- **위치**: `codebase/channel-web-chat/src/widget/use-widget.ts` — `scheduleRefresh()` 함수 및 `applyConfig()` 내 `scheduleRefresh()` 호출 (라인 273–301, 321)
- **상세**: `scheduleRefresh()` 진입 시 기존 타이머를 `clearTimeout` 후 재예약하는 구조라 대부분의 재진입에서 안전하다. 그러나 `applyConfig` 가 비동기(`await isEmbedAllowed`)이므로, query-param 폴백 경로와 `bridge.onBoot` 경로가 거의 동시에 실행될 경우 두 `applyConfig` 흐름이 각각 `scheduleRefresh()`를 호출할 수 있다. JavaScript 싱글-스레드 이벤트 루프 특성상 실제 동시 실행은 없지만, microtask/macrotask 경계에서 두 번의 `setTimeout` 등록 → 두 번째가 첫 번째를 덮는 타이밍에 따라 첫 번째 타이머가 정리되지 않고 남을 가능성이 이론적으로 존재한다. `scheduleRefresh` 첫 줄의 `clearTimeout` 이 두 흐름이 교차하는 구간을 커버하지 못하는 경우다.
- **제안**: 실제 발생 확률은 매우 낮고(query-param 폴백과 onBoot 가 동시 발화되는 경우만), 현 코드에서 `scheduleRefreshRef.current = scheduleRefresh` 로 동일 함수 레퍼런스를 쓰고 있어 심각한 누수가 발생하지는 않는다. 방어적 보완을 원한다면 `applyConfig` 진입 시 `cancelled` 체크 외에 세션 설정 직전 기존 타이머 정리를 명시적으로 추가하는 것이 명확하다.

### [INFO] refreshToken Promise — .catch() 빈 블록으로 갱신 실패 추적 불가
- **위치**: `codebase/channel-web-chat/src/widget/use-widget.ts` — `setTimeout` 콜백 내 `client.refreshToken(...).then(...).catch(...)` (라인 287–298)
- **상세**: `cancelled` 플래그를 `.then()` 핸들러 첫 줄에서 체크하고 `.catch()` 내부에서 `scheduleRefresh()` 재귀 호출 전에도 `cancelled` 체크가 이루어지므로 언마운트 후 상태 업데이트는 방지된다. 그러나 `.catch()` 가 완전히 빈 블록이라 운영 환경에서 토큰 갱신 실패 시 아무런 추적 수단이 없다. SSE hard expiry 시점에 사용자가 401 오류를 마주할 때까지 실패 원인을 알 수 없다.
- **제안**: `.catch((err) => { /* 최소 console.warn 또는 logger 수준 로깅 추가 */ })` 형태로 갱신 실패 사유를 기록해 운영 디버깅을 지원한다.

### [INFO] _ensure_web_chat_deps 쉘 함수 — 미래 병렬 실행 시 TOCTOU 가능성
- **위치**: `.claude/test-stages.sh` — `_ensure_web_chat_deps()` (라인 41–44)
- **상세**: `[ -d node_modules ] || npm ci` 패턴은 현재 순차 `&&` 체인에서 안전하다. 향후 `cmd_lint`, `cmd_unit`, `cmd_build` 를 병렬(예: `&` 백그라운드) 호출하는 래퍼가 추가될 경우, 동일 디렉토리에 복수 `npm ci` 가 동시 실행될 수 있는 TOCTOU 가능성이 존재한다.
- **제안**: 현재 사용 방식(순차)에서는 문제 없음. 병렬화 시 `flock(1)` 등의 잠금 추가를 검토한다.

### [INFO] GitHub Actions concurrency 설정 — 적절
- **위치**: `.github/workflows/web-chat-checks.yml` — `concurrency.cancel-in-progress: true` (라인 113)
- **상세**: CI 전용 lint/test/build 워크플로우에 `cancel-in-progress: true` 를 적용한 것은 표준 패턴이며, 배포 워크플로우가 아니므로 취소로 인한 부작용이 없다. `group: web-chat-checks-${{ github.ref }}` 로 ref 단위 직렬화되어 동일 브랜치 중복 실행을 방지한다.
- **제안**: 추가 조치 불필요.

## 요약

이번 변경의 동시성 관련 주요 코드는 `use-widget.ts`의 `per_execution` 토큰 자동 갱신 스케줄러(`scheduleRefresh`)다. JavaScript 싱글-스레드 이벤트 루프 위에서 동작하므로 실제 동시 접근 경쟁 조건은 발생하지 않으며, `cancelled` 플래그로 언마운트 후 상태 업데이트를 방지하는 패턴도 올바르게 적용되어 있다. 백엔드 `EmbedConfigService.resolve()` 는 stateless async 서비스로 공유 가변 상태 없이 안전하다. 식별된 이슈는 모두 INFO 수준으로, query-param 폴백과 `onBoot` 이중 실행 엣지케이스에서의 타이머 교차 가능성(이론적), 갱신 실패 로깅 부재, 쉘 스크립트의 미래 병렬화 시 TOCTOU 가능성이다. 현재 설계 범위에서 실질적 위험은 없다.

## 위험도

NONE

---

STATUS=success ISSUES=0
