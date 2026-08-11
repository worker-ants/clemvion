# Cross-Spec 일관성 검토 — `spec/7-channel-web-chat`(impl-done, diff-base=origin/main)

## 전제: 직전 라운드 INFO 2건 처분 재검토

### (a) `2-sdk.md` `BootConfig.apiBase` 에 `4-security.md` 상호참조 추가 — 정확함

`2-sdk.md §4`:
```
apiBase: string;  // API origin. 런타임 검증: http(s) 스킴만 허용 — 위반 시 그 필드만 무시(부팅은 계속).
                   // [4-security §1 `apiBase` 입력 검증 · §R7](./4-security.md)
```

대조 대상 `4-security.md §1` 표:
> `apiBase` 입력 검증 | **두 입력 경로 모두** `apiBase` 를 **http(s) 스킴만 허용**(`safeApiBase`)해 … (부적합 시 그 필드만
> 무시 + `console.warn` — 부팅 자체는 막지 않는다). 경로는 둘이다: host 없는 직접 로드/샘플의 `?apiBase=` 쿼리 폴백,
> 그리고 정상 임베드의 host postMessage(`wc:boot`).

및 `§R7`("SDK 는 같은 값을 양쪽으로 보낸다" / "거절 시 그 필드만 버린다 — 부팅을 막지 않는다").

`2-sdk.md` 의 새 서술("http(s) 스킴만 허용 — 위반 시 그 필드만 무시, 부팅은 계속")은 `4-security.md §1`·`§R7` 및
구현(`use-widget.ts safeApiBase`/`mergeBootConfig` — 거절된 `boot.apiBase` 는 `??` 로 쿼리 값에 폴백)과 **정합한다**.
CRITICAL 없음.

### (b) `1-widget-app.md` 상태기계의 "config 미적용 무통지 정체" 미서술 — 무조치 판단 유지 타당

`4-security.md §R7` 자체가 이미 명시:
> `applyConfig` 의 `if (!cfg.apiBase || !cfg.triggerEndpointPath) return;` 은 `warn` 도 `dispatch` 도 없이 조용히
> 빠진다 … **선재 갭이며 별도로 등재했다**(ai-review `15_16_20` side_effect).

실제로 `plan/in-progress/webchat-auth-session-status-reconcile.md:325` `## applyConfig 의 조용한 early return
(2026-08-11, 15_16_20 side_effect INFO)` 항목이 존재하고 체크리스트에 `- [ ] 도달 가능하면 console.warn 또는
dispatch({type:"ERROR"}) 로 관측 가능하게 —` 로 등재돼 있다(미해결·추적 중, 삭제/누락 아님). "이미 등재됐다"는
전제가 사실이므로 이번 라운드에서 `1-widget-app.md` 를 건드리지 않은 처분은 **여전히 타당**하다.

---

## 발견사항

### [WARNING] `apiBase` 두 입력 경로를 "상호배타적 시나리오"로 오서술 — 실제로는 모든 정상 M1 임베드에서 둘 다 순차 발동

- **target 위치**: `spec/7-channel-web-chat/4-security.md §1` 표 "`apiBase` 입력 검증" 행 — "경로는 둘이다:
  **host 없는 직접 로드/샘플**의 `?apiBase=` 쿼리 폴백, 그리고 **정상 임베드**의 host postMessage(`wc:boot`)."
- **충돌 대상**:
  1. 같은 문서 `4-security.md §R7`(2026-08-11 신설) — "SDK 는 **같은 `apiBase` 를 양쪽으로** 보낸다.
     `resolveIframeTarget`(`web-chat-sdk/src/bridge.ts`)이 `apiBase` 를 iframe src 쿼리에 싣고, `boot()`
     (`web-chat-sdk/src/index.ts`)이 같은 값을 `wc:boot` 으로도 보낸다."
  2. `spec/7-channel-web-chat/5-admin-console.md §6.1` — 콘솔 라이브 미리보기의 iframe 부팅 절차를 "iframe `src`
     = `…?apiBase=<api-base>&trigger=<endpointPath>&locale=<locale>` … **query param 으로 1차 전달**(위젯은
     `configFromQuery()` 로 부트스트랩) … 위젯은 `configFromQuery()` 와 `wc:boot` payload 를 **머지**해 적용한다"
     로 정확히 서술한다. §6.1 은 이 절차를 "위젯 dev 데모 host 와 동일 경로"라고 부르며 **콘솔 전용 메커니즘처럼
     프레이밍**한다.
  3. 실제 구현: `codebase/packages/web-chat-sdk/src/bridge.ts:191-204` `resolveIframeTarget` — **모든** `boot()`
     호출(=모든 M1 정상 임베드)이 iframe `src` 쿼리에 `apiBase`/`trigger`(+`locale`)를 싣는다. 콘솔·데모·고객
     임베드가 전부 이 함수를 거친다(콘솔만의 특수 경로가 아니다).
     `codebase/channel-web-chat/src/widget/use-widget.ts:1377-1381` — 마운트 시 무조건
     `const fallback = configFromQuery(); if (fallback.apiBase && fallback.triggerEndpointPath) runApplyConfig(fallback)`
     이 실행된다. `applyConfig`(1228행~)는 embed-allowed soft 검증·세션 복원·SSE 오픈까지 수행하는 **완전한
     부트스트랩**이라, 이 첫 attempt 는 단순 프리필이 아니다. 이후 `wc:boot` 가 도착하면
     `mergeBootConfig(configFromQuery(), c)` 로 두 번째(대개 더 풍부한) attempt 가 발급되고, 세대 판정
     (`beginBootAttempt`/`cannotApplyConfig`/`isAttemptStale`, `use-session-generations.ts`)이 나중 attempt 로
     대체한다.
- **상세**: `4-security.md §1` 은 "host 없는 직접 로드/샘플" vs "정상 임베드"를 **양자택일** 시나리오처럼 나열하지만,
  코드·`§R7`·`5-admin-console §6.1` 모두가 보여주는 실제 동작은 "**정상 임베드에서도 쿼리 경로가 먼저, 그리고 항상**
  발동하고 `wc:boot` 이 나중에 대체한다"이다. 즉 두 경로는 대안이 아니라 **정상 케이스의 1단계/2단계**다. 이 오서술은
  `apiBase` 스킴 검증(§R7 이 다루는 보안 표면)에는 영향이 없다 — 검증은 실제로 두 경로 모두에 걸려 있어 안전하다.
  문제는 **문서 프레이밍**이다: `2-sdk.md`(§3 host↔iframe 프로토콜·§4 BootConfig 스키마)와 `1-widget-app.md`(§3
  상태기계)는 이 "iframe src 쿼리 1차 전달 → `wc:boot` 세대 대체" 메커니즘을 전혀 서술하지 않는다. 유일하게 정확히
  서술한 `5-admin-console.md §6.1` 은 이를 콘솔 미리보기 고유 절차처럼 소개해, 이것이 SDK `boot()` 의 **일반 동작**
  (모든 M1 임베드에 적용)이라는 사실이 가려진다. 향후 작업자가 `4-security.md §1` 표만 보고 "쿼리 경로는 host 없는
  예외 케이스이니 정상 임베드 경로에서 안전하게 제거/변경 가능"이라고 오판하면(예: `use-widget.ts` 의 마운트-시
  쿼리 폴백을 "샘플 전용이니 제거"), 콘솔 미리보기·SDK `boot()` 모든 정상 임베드의 "쿼리 1차 부트스트랩 → wc:boot
  대체" 동작을 깨뜨릴 수 있다.
- **제안**: (1) `2-sdk.md §3`(host↔iframe 프로토콜)에 "iframe `src` 쿼리 파라미터(`apiBase`/`trigger`/`locale`)가
  `wc:boot` 이전 1차 부트스트랩 값을 전달하며, `wc:boot` 도착 시 세대 우선순위(`use-session-generations.ts`)로
  대체한다"는 절을 SoT 로 신설(정상 M1 임베드 일반 동작으로 명시). (2) `4-security.md §1` 의 "경로는 둘이다: host
  없는 직접 로드/샘플 vs 정상 임베드"를 "정상 임베드에서도 두 경로가 **순차적으로 모두** 발동한다(§R7)"로 정정해
  §R7 과의 자기모순을 제거. (3) `5-admin-console.md §6.1` 은 이 절차를 "SDK `boot()` 의 일반 메커니즘과 동일
  (`2-sdk §3` 이 SoT), 콘솔은 그 경로를 직접 재구현한 것"으로 상호참조를 추가해 중복 서술이 아닌 SoT 참조로 수렴.

Critical 없음.

---

## 요약

target 은 impl-done 재검토이며, 직전 라운드 INFO 2건의 처분은 둘 다 타당하다 — (a) `2-sdk.md` 의 신규
`4-security.md` 상호참조는 문구·근거가 정확히 일치하고, (b) `1-widget-app.md` 의 무통지 정체 미서술은 실제로
`4-security.md §R7` 이 "선재 갭·별도 등재"라고 명시하고 `plan/in-progress/webchat-auth-session-status-reconcile.md`
에 미해결 체크리스트 항목으로 실재하므로 무조치가 옳다. 이번 라운드에서 새로 드러난 사실은 `use-widget.ts` 의
"host 없이 직접 로드" 폴백이 실제로는 **모든 정상 M1 임베드**에서 (SDK `boot()`→`resolveIframeTarget` 이 iframe
src 쿼리에 `apiBase`/`trigger`/`locale` 을 항상 싣기 때문에) 상시 먼저 발동하고, 뒤이은 `wc:boot` 이 세대 판정으로
대체한다는 점이다. `4-security.md §1` 표는 이 두 경로를 "host 없는 예외" vs "정상 임베드"로 상호배타적으로
프레이밍해 같은 문서 §R7("SDK 는 같은 값을 양쪽으로 보낸다")과 어긋나며, `2-sdk.md`·`1-widget-app.md` 는 이
메커니즘 자체를 서술하지 않는다(유일하게 정확히 서술한 `5-admin-console.md §6.1` 은 콘솔 전용처럼 프레이밍). 보안
검증(스킴 체크) 자체는 두 경로 모두에 걸려 있어 CRITICAL 급 결함은 아니지만, 문서 프레이밍이 향후 오판(쿼리
경로를 "제거 가능한 샘플 전용"으로 오해)을 유발할 수 있는 WARNING 이다.

## 위험도

LOW

STATUS: OK