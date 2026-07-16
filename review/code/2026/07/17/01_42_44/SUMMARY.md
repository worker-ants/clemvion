# Code Review 통합 보고서

> ## ⚠️ 최종 정정 (2026-07-17, main Claude — 9개 전수 확보 후): 아래 본문은 **불완전한 판정**이다
>
> 본문은 9개 중 **4개(security/performance/maintainability/testing)** 산출물만 확보한 채 작성돼 `RISK LOW · WARNING 2` 로 보고했다. 나머지 5개(requirement/scope/side_effect/documentation/user_guide_sync)를 **workflow journal 에서 복구**한 결과, **`requirement` 가 본 구현의 실질 버그를 잡아냈다** — 본문 어디에도 없는 항목이다:
>
> **[WARNING·requirement] `execution.replay_unavailable` 폴백이 terminal 상태를 처리하지 않음** — 5분 버퍼 gap 안에 execution 이 종료됐다면 그 terminal SSE 이벤트도 버퍼와 함께 유실돼 다시 오지 않는데(EIA `R-replay-unavailable`: 신호 후 연결만 유지·재전송 없음), `seedWaitingFromStatus` 가 `waiting_for_input` 만 처리하고 나머지는 silent no-op → 위젯이 `streaming` 스피너에 **무기한 정지**(사용자 액션 없는 구간이라 410 사후 복구도 닿지 않음). → **fix 완료**(terminal 분기 + 회귀 테스트, mutation 검증).
>
> **최종 실질 판정: Critical 0 · WARNING 3(requirement 1 + maintainability 1 + testing 1) + INFO 2 → 전부 fix.** 상세·근거는 같은 디렉토리 [`RESOLUTION.md`](./RESOLUTION.md).
>
> **교훈**: FS-write flakiness 는 단순 산출물 유실이 아니라 **판정 자체를 왜곡**한다. 본문의 `RISK LOW · WARNING 2` 를 그대로 믿었다면 이 버그가 머지됐다. 본문은 시점 기록으로 보존한다.

## 전체 위험도
**LOW** — Critical 없음. WARNING 2건(둘 다 "구조적 버그 아님, 컨벤션/커버리지 갭" 성격)만 존재. 단, **9개 "success" 보고 reviewer 중 5개(requirement/scope/side_effect/documentation/user_guide_sync)의 output_file 이 디스크에 실제 생성되지 않아** 이 요약에서 완전히 제외됨 — 아래 "권장 조치사항" §1 참고.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability | 신규 `seedWaitingFromStatusRef.current = seedWaitingFromStatus;` 대입이 같은 파일이 명시적으로 문서화한 "ref 갱신은 render 중이 아니라 effect 에서" 컨벤션(`apiRef` 패턴, ~1701-1706행)과 표면적으로 어긋남. 현재 `seedWaitingFromStatus` 의 `useCallback` deps 가 `[]` 라 실질 버그는 아니나, deps 가 나중에 늘어나면 조용히 stale 해질 위험 | `codebase/channel-web-chat/src/widget/use-widget.ts:1444-1447` | `apiRef` 와 동일하게 `useEffect(() => { seedWaitingFromStatusRef.current = seedWaitingFromStatus; });` 로 통일하거나, render-time 대입이 안전한 근거("deps `[]`")를 `apiRef` 컨벤션 주석 옆에 명시적으로 교차 언급 |
| 2 | Testing | `webauthn-response.dto.ts` JSDoc 이 `GET /auth/2fa/webauthn/credentials` 응답을 `SessionListDto` 와 동일한 `{ data: { items: [] } }` shape 의 "load-bearing 계약"으로 새로 명문화했지만, 이를 고정(pin)하는 테스트가 어느 계층에도 없음(`webauthn.controller.spec.ts` 에 `webauthnList` 관련 `it` 없음, e2e 에도 `GET credentials` 호출 없음). 동일 패턴의 `SessionsController.listSessions` 는 `sessions.controller.spec.ts` 에서 shape 를 고정 중이라 비대칭 | `codebase/backend/src/modules/auth/webauthn/dto/responses/webauthn-response.dto.ts:36-41`, 반환부 `webauthn.controller.ts:281-288` | `webauthn.controller.spec.ts` 에 `describe('webauthnList', ...)` 추가해 `{ data: { items: [...] } }` 매핑을 `sessions.controller.spec.ts` 와 동일 방식으로 pin(빈 배열 케이스 포함). 여력 시 e2e 로 wire shape 1건 추가 고정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance | `execution.replay_unavailable` 수신 시마다 in-flight 여부 확인 없이 무조건 `getStatus` REST 재조회 발생. 단발 이벤트 핸들러라 N+1 은 아니고 "5분 버퍼 만료"라는 드문 조건에 묶여 정상 범위에서는 문제 없음. 서버가 반복 재연결 실패로 신호를 폭주시키는 예외 상황에서만 이론적 영향 | `codebase/channel-web-chat/src/widget/use-widget.ts:1354-1360` | 즉시 조치 불필요. 재연결 폭주가 실제 문제화되면 in-flight 플래그로 중복 호출만 스킵하는 가드 고려 |
| 2 | Testing / Maintainability | 신규 테스트의 GET 판정 조건식(`init?.method === undefined`)이 동일 파일 기존 관용구(`(init?.method ?? "GET") === "GET"`)와 다름. 현재 프로덕션 코드가 method 를 명시하지 않아 지금은 문제 없으나, 향후 `getStatus` 가 `method: "GET"` 을 명시하면 이 mock 브랜치가 조용히 매치 실패 | `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:1160` (신규) vs `:1046` (기존) | 기존 관용구 `(init?.method ?? "GET") === "GET"` 로 통일 |
| 3 | Testing | `execution.replay_unavailable` 소비 배선의 방어 분기(`if (client && session)` null-guard, `seedWaitingFromStatus` 폴백 실패 경로)가 happy path 1건만 테스트됨. `client`/`session` 부재 race, `getStatus` 자체 실패(410/네트워크 오류) 시 사용자 표면 상태, `waiting_for_input` 이외 상태 반환 분기 모두 미커버 | `use-widget.ts:173-179`(분기), `use-widget-eager-start.test.ts:1123-1200`(신규 테스트) | 우선 `getStatus` 실패 시 크래시 없이 정상 유지되는지 1건 추가 권장. race 케이스는 여력 시 추가 |
| 4 | Maintainability | TDZ 우회 근거 주석("`seedWaitingFromStatus` 를 `handleEiaEvent` 가 참조하려는데 선언 순서상 TDZ")이 ref 선언부와 대입부 두 곳에 유사 문장으로 중복 | `use-widget.ts:1142`, `:1444-1446` | 필수 아님. 한쪽은 짧게 상호 참조만, 상세 근거는 한 곳에만 남기는 것도 고려 가능 |
| 5 | Maintainability | `useWidget` 훅이 이미 대형(500행 이상)인데 이번 변경으로 ref·분기가 추가로 늘어남. `useTokenRefresh`/`usePendingMessageQueue` 처럼 관심사 분리가 진행 중인 흐름과 비교하면 SSE 이벤트 처리 축도 분리 후보 | `use-widget.ts` (`useWidget` 함수 전체) | 즉시 조치 불필요. 이 영역에 SSE 관련 로직이 추가되는 다음 변경이 있다면 `useEiaStream`(가칭) 분리 검토 |

**확인 완료(조치 불필요) 항목**: Security 리뷰는 신규 `execution.replay_unavailable` 분기가 SSE 이벤트 payload 를 신뢰 경계로 쓰지 않고 기존 인증 세션·토큰으로만 재조회함(스푸핑 무해), 에러 노출이 기존 "console 진단/UI 일반화 문구" 관례를 그대로 따름(`use-widget-eager-start.test.ts` 회귀 테스트로 고정), 테스트 fixture 토큰이 실제 시크릿이 아님, DTO/plan/spec 문서 변경이 서술 정정뿐임을 각각 확인했고 모두 조치 불필요로 결론. Maintainability 는 `installControllableEventSource` 로 EventSource stub 4중 중복을 헬퍼 1곳으로 통합한 리팩터와 DTO 주석 정정을 유지보수성 개선(긍정적 발견)으로 확인. Testing 은 `use-widget-eager-start.test.ts` 27/27, `webauthn.controller.spec.ts` 8/8 실측 통과 및 mutation 검증(구현 무력화 시 신규 테스트만 실패)까지 확인.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 SSE 소비 분기가 이벤트 payload 를 신뢰 경계로 쓰지 않음, 기존 인증 세션으로만 재조회 — 공격면 확장 없음 |
| performance | NONE | 단발 이벤트 기반 REST 재조회, N+1/블로킹 아님. in-flight 가드는 향후 고려사항 |
| requirement | 재시도 필요 | output_file 미생성 (아래 참고) |
| scope | 재시도 필요 | output_file 미생성 (아래 참고) |
| side_effect | 재시도 필요 | output_file 미생성 (아래 참고) |
| maintainability | LOW | ref 갱신이 파일 자체 컨벤션(effect 내 갱신)과 불일치(WARNING #1) + INFO 3건 + 긍정 발견 2건 |
| testing | LOW | webauthn 응답 shape "load-bearing 계약" pin 테스트 부재(WARNING #2) + happy path 편중 커버리지(INFO) |
| documentation | 재시도 필요 | output_file 미생성 (아래 참고) |
| user_guide_sync | 재시도 필요 | output_file 미생성 (아래 참고) |

## 발견 없는 에이전트

없음 — 실제 산출물을 확보한 4개 에이전트(security/performance/maintainability/testing) 모두 최소 INFO 이상을 보고했음(security/performance 는 모두 확인·조치 불필요로 귀결, 실질적 위험도는 NONE).

## 권장 조치사항

1. **[프로세스] requirement/scope/side_effect/documentation/user_guide_sync 5개 reviewer 재실행** — workflow 가 이 5개를 `status=success` 로 보고했으나 실제로는 `output_file` 이 디스크에 생성되지 않음(`ls` 로 실측 확인: `security.md`/`performance.md`/`maintainability.md`/`testing.md` 4개만 존재). 알려진 FS-write 비결정적 결손 패턴과 일치. 이 5개 영역(특히 `requirement` — spec 정합성, `scope` — 변경 범위)의 실제 발견사항이 이 요약에 전혀 반영되지 못했으므로, 해당 5개를 Agent 로 직접 재실행해 누락분을 확보한 뒤 본 요약을 갱신할 것.
2. **[WARNING #2]** `webauthn.controller.spec.ts` 에 `webauthnList` shape(`{ data: { items: [] } }`) 를 고정하는 단위 테스트 추가 — 새로 문서화한 "load-bearing 계약" 주석이 실제로는 어떤 테스트로도 보호되지 않는 상태.
3. **[WARNING #1]** `seedWaitingFromStatusRef` 갱신을 `apiRef` 와 동일하게 `useEffect` 로 이동하거나, render-time 대입이 안전한 이유를 컨벤션 주석 근처에 명시.
4. **[INFO #3]** `getStatus` 폴백 실패 시나리오(네트워크 오류/410) 를 최소 1건 테스트로 추가 — 데이터 유실 복구 수단 자체가 실패하는 케이스가 현재 unasserted.
5. 나머지 INFO(스타일 통일, 주석 중복 정리, 훅 분리 후보)는 즉시 조치 불필요, 후속 변경 시 참고.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync` (9명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (소스 코드 변경 시 항상 적용되는 규칙 + 문서 파일 변경 트리거 + spec 본문 변경 트리거)
  - **제외**: 아래 표 (5명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | 라우터가 이번 diff 범위(SSE 이벤트 소비 배선 1개 분기 + DTO 주석 + 테스트 리팩터)에 아키텍처 영향 없다고 판단(개별 사유 미전달) |
  | dependency | 신규/변경 의존성 없음(패키지 변경 없이 기존 코드 배선) |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 신규 동시성 이슈 트리거(락, 트랜잭션, race) 없음으로 판단 |
  | api_contract | 신규/변경 API 계약 없음 — DTO 변경은 주석뿐, 응답 shape 불변 |