# RESOLUTION — ai-review 08_29_33 (worldGen 단일화 커밋 `3b54c8727`)

대상 범위: `7a9b4ce88..HEAD` (채널 웹챗 staleness 가드 통합). RISK CRITICAL / Critical 2 / Warning 7.

**요약**: Critical 1건은 **내가 만든 회귀로 확인**돼 수정했다. Critical 2건은 85회 재현 시도에도 재현되지 않아 **귀속을 반박**하되, 지적된 관용구 취약성 자체는 실재하므로 선제 제거했다. Warning 7건 중 W2·W5 는 리뷰어가 "잠재적"으로 분류했으나 **실측 결과 이미 활성 버그**여서 승격 처리했다.

## Critical

### C1 (side_effect) — 부팅 중 명령 → 위젯 영구 정지. **확인·수정**

리뷰어 지적대로 실재하는 회귀이며, **이번 커밋이 도입한 것**이다.

- **재현**: `embed-config` 왕복이 in-flight 인 동안 host `resetSession` 주입 → `applyConfig` 가 세대 검사에 걸려 조기 return → `config = null (영구 정지)`. 런처만 뜨고 패널은 영원히 열리지 않으며 콘솔 경고도 없다. `newChat` 의 후행 `start()` 도 `if (!cfg || !client) return` 으로 no-op 이라 자가 회복 경로가 없다.
- **귀속 A/B**: 부모 커밋(`7a9b4ce88`) 코드로 동일 시나리오 → **통과**. 즉 내 변경이 원인이다. 종전 `cancelled` 지역 플래그는 언마운트에서만 set 이라 이 경로가 **우연히** 안전했고, 세대 단일화가 그 우연을 깨뜨렸다.
- **수정**: `teardownSession()` 최상단에 `if (!configRef.current) return;` — 세계가 시작도 안 했으면 무효화할 것이 없다(리뷰어 제안과 동일). `configRef.current` 는 확립 후 null 로 되돌아가지 않으므로(할당 2곳·해제 0곳 전수 확인) 정상 경로는 무영향. 아래 `if (configRef.current) clearSession(...)` 은 이 가드로 죽은 코드가 돼 제거.
- **회귀 테스트**: `use-widget-eager-start.test.ts` "C1: embed-config in-flight 중 host resetSession → config 확립". 기존 `R9-A` 의 "booting" 은 config 확립 **후** webhook POST in-flight 라 이 창을 덮지 못했다.
- **mutation 검증**: 가드 제거 시 39건 중 **C1 1건만** 실패.

### C2 (testing) — 전체 스위트 동시 실행 시 ≈13% 비결정 실패. **재현 실패 → 귀속 반박, 지적된 취약성은 선제 제거**

리뷰어는 `npx vitest run`(파일 인자 없음) 46회 중 6회(≈13%) 실패 + 부모 커밋 25회 0회 A/B 로 "이번 리팩터가 새 비결정성 도입"이라 판단했다. **동일 명령으로 총 85회 실행했으나 실패 0회**다.

| 상태 | 실행 | 실패 |
| --- | --- | --- |
| 리뷰 대상 커밋 `3b54c8727` 그대로 | 20회 | 0 |
| C1 픽스 적용 트리 | 37회 | 0 |
| CPU 부하 하(busy loop 8 / 10코어) | 8회 | 0 |
| 최종(전 수정 반영) | 20회 | 0 |

리뷰어가 제시한 13% 가 참이라면 85회 연속 무실패 확률은 ~10⁻⁵ 다. 리뷰어 자신도 격리 실행·CPU 부하 8회는 100% 안정이라 보고했고 내 부하 테스트가 그 음성 결과를 재현했다. **따라서 "리팩터가 비결정성을 도입했다"는 귀속은 지지되지 않는다** — 리뷰 fan-out(리뷰어 ~10개 동시 실행) 중 측정된 환경 부하 아티팩트로 추정하나, 그쪽도 단정하지 않는다.

다만 리뷰어가 지목한 **근본 후보 중 하나는 코드에 실재**했다: 수동 resolve 직후의 `await Promise.resolve()` **고정 횟수 flush**(12개 지점). 이는 프로미스 체인 길이에 대한 추측이라, 체인이 3틱 이상이면 단언이 먼저 실행돼 산발 실패한다 — 재현 여부와 무관한 취약성이므로 macrotask 1틱 flush(`flushAsync()`)로 교체했다. 파일 내 fake timer 는 전부 `shouldAdvanceTime: true` 라 `setTimeout` 이 정상 발화함을 확인.

**미해결로 남기는 부분**: 내 환경에서 재현되지 않아 리뷰어가 관측한 실패의 진짜 원인을 특정하지 못했다. CI 에서 재발하면 이 항목을 재개할 것.

## Warning

### W2 (동시성/부작용) — `applyConfig` 세대 재검증 비대칭. **활성 버그로 승격·수정**

리뷰어는 "현재는 활성 버그가 아니나 잠재 지뢰"로 분류했으나, **이미 활성이었다**. `seedWaitingFromStatus` 의 **catch(soft-fail) 분기가 세대 검사 없이 `"continue"` 를 반환**하기 때문이다:

1. 복원 seed 의 `getStatus` 가 네트워크 오류로 reject
2. 그 사이 새 대화 시작 → 세대 증가
3. catch → `"continue"` 반환 (세대 무시)
4. `outcome` 만 보는 `applyConfig` 통과 → 옛 세션으로 `openStream` + `scheduleRefresh` → **스트림 탈취 + 지운 storage 부활**

`start()` 는 뒤에 명시적 세대 재검사가 있어 우연히 무사했다 — **리뷰어가 지적한 그 비대칭이 곧 버그였다**. 네트워크 오류는 정상 조건이라 실제로 닿는 경로다.

- **수정**: (a) choke point 인 catch 분기에 `if (worldGenRef.current !== gen) return "stale";` (b) `applyConfig` 에도 `start()` 와 동형의 명시적 세대 재검증 추가.
- **회귀 테스트**: "W2: 복원 seed 가 network 오류로 soft-fail 해도 새 대화 스트림을 옛 세션이 탈취하지 않는다".
- **mutation 검증** (앵커 일치를 명시 assert 하고 치환 — 초회 시도는 조용히 매치 실패했다):

  | gen 검사 | 상태 | W2 |
  | --- | --- | --- |
  | 7개 | 픽스 없음 | **실패** — 버그 실재 |
  | 8개 | (a)만 | 통과 — 이것만으로 충분 |
  | 9개 | (a)+(b) | 통과 — (b)는 진짜 defense-in-depth |

### W5 (유지보수성) — `useTokenRefresh` 의 4번째 독립 가드. **활성 버그로 승격·통합**

리뷰어 지적대로 `cancelledRef` 는 언마운트에서만 set 되고 `teardownSession()` 은 잡지 못했다. `refreshToken` in-flight 중 새 대화가 시작되면 `clearRefreshTimer()` 는 **이미 떠 있는 요청을 막지 못하고**, 지연 resolve 가 `sessionRef.current` 를 옛 세션으로 덮고 `saveSession()` 으로 방금 지운 storage 를 되살린다.

- **수정**: `TokenRefreshDeps` 에 `worldGenRef` 주입 → 요청 직전 세대 캡처 → `.then()` 에서 재검증. `cancelledRef` 는 제거(세대가 언마운트를 포함한 모든 무효화를 덮으므로 중복). 언마운트 effect 는 타이머 정리만 담당.
- **cross-hook 계약 위험**: 이 훅은 이제 "소유자가 언마운트 시 세대를 올린다"에 의존한다. 그 계약이 바로 **W3 가 미검증이라 지적한 지점**이라, W3 테스트를 먼저 추가해 보호했다.
- **회귀 테스트**: "W5: refresh in-flight 중 세대 변경(새 대화) → 지연 응답이 세션·storage 를 되살리지 않는다". mutation: 세대 검사 제거 시 11건 중 **W5 1건만** 실패.

### W3 (테스트) — 언마운트 세대 증가 미검증. **수정**

리뷰어 실증대로 해당 줄을 제거해도 364건 중 0건도 실패하지 않았다.

- **회귀 테스트**: "W3: webhook POST in-flight 중 언마운트 → 지연 응답이 storage·SSE 를 되살리지 않는다". 세대 증가가 없으면 지연 응답이 `persist()` 로 storage 를 쓰고 `openStream`/`scheduleRefresh` 로 스트림·타이머를 되살린다.
- **mutation 검증**: 언마운트 bump 제거 시 39건 중 **W3 1건만** 실패 (0건 → 1건).

### W4 (동시성/테스트) — 리듀서 defense-in-depth 부재. **수정**

plan 스스로 "직접 원인"이라 지목한 `widget-state.ts` `case "WAITING"` 의 무조건 전이에 가드 추가: `if (state.phase === "ended") return state;`. `ended` 를 벗어나는 유일한 액션은 `START`(→`booting`) 이므로(전수 확인) `ended → WAITING` 이 정당한 경우는 없다.

- **회귀 테스트** 2건: "W4: ENDED 이후 WAITING → 무시"(유령 메시지가 스레드에 섞이지 않는 것까지 단언), "START 는 ended 를 벗어나는 유일한 경로 — 이후 WAITING 은 정상 동작"(가드가 정상 재시작을 막지 않음).
- **mutation 검증**: 가드 제거 시 39건 중 **W4 1건만** 실패.
- **미조치**: 리뷰어가 함께 지적한 `handleEiaEvent` 의 직접 SSE `waiting_for_input` 분기는 await 경계가 없어 세대 가드 대상이 아니다. 이제 위 리듀서 가드가 그 경로도 함께 덮는다.

### W1 (동시성/문서화) — JSDoc "무효화 지점 두 곳뿐" 부정확. **수정**

4개 리뷰어가 독립 지적. 실제 지점은 셋(`teardownSession()` / `start()` / 언마운트 cleanup)이라 JSDoc 을 셋으로 정정하고 각 지점의 역할·`teardownSession` 의 부팅 전 no-op 조건을 명시.

### W6 (문서화) — CHANGELOG 누락. **수정**

"Unreleased — 웹채팅 위젯" 에 항목 5(종료된 위젯 부활 버그 수정 + 세대 통합 + W2·W5 동형 결함 + 리듀서 방어선) 추가. 아울러 리뷰어 지적대로 **기존 항목 4 를 정정**했다 — "유령 표면을 그리지 않는다" 는 이 fix 이전엔 재현된 반례가 있어 성립하지 않던 문구였다. 이제 항목 4 는 세션 **교체**(오종료 방지)만 주장하고, **종료** 경로는 항목 5 가 담당한다.

### W7 (유지보수성) — 테스트 JSDoc 의 죽은 참조. **수정**

`use-widget-eager-start.test.ts:231` 의 `startGenRef`(현존하지 않는 식별자) → "세대 가드". `use-widget.ts:147` 의 동일 문자열은 "종전에는 …" 이라는 **의도적 과거 서술**이라 유지.

## 검증

- **TEST WORKFLOW**: lint PASS(57s) · unit PASS(72s, `tests=14 passed`) · build PASS(120s).
- **build 가 vitest 가 놓친 타입 오류 검출**: W4 테스트 픽스처의 `DisplayMessage.source` 누락 — vitest 는 타입체크를 하지 않으므로 `tsc` 가 authoritative 임을 재확인.
- **channel-web-chat**: 22 파일 **370건 전부 통과**. 신규 **6건** — `use-widget-eager-start` 36→39(C1·W2·W3), `use-token-refresh` 10→11(W5), `widget-state` 31→33(W4 2건).
- **신규 테스트 6건 전부 mutation 검증** — 각각 대응 가드를 제거했을 때 **그 테스트만** 실패함을 확인.
- e2e: 본 변경은 channel-web-chat 클라이언트 단위 로직이며 백엔드 계약·마이그레이션 무변경.

## 이월

- **C2 원인 미특정** — 재현 실패로 종결. CI 재발 시 재개.
- `_test_logs/` 기준 `fetchMock` 미사용 lint warning(`use-widget-eager-start.test.ts:650`)은 **기존 것**(리뷰 대상 커밋에도 존재)이라 스코프 밖으로 뒀다.
