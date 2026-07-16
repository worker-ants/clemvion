# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — requirement reviewer 가 mutation 재현으로 실측 확인한 cross-session stale 410 오종료 버그(세션 교체 후 도착한 옛 세션의 410 응답이 새로 시작된 세션을 잘못 종료시킴)가 있어 병합 전 수정이 필요하다. 그 외에는 세션 라이프사이클 견고성을 높이는 방어적 리팩토링으로 보안/범위 이탈 문제는 없다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항/동시성 | `sendCommand` 의 410 catch 가 세션 교체 후 도착한 stale 410 응답을 재검증 없이 `finalizeEnded("gone")` 으로 처리 → **살아있는 새 세션이 옛 세션의 지연 에러 응답 때문에 오종료**됨(host 는 잘못된 `conversationEnded` 통지 수신, storage/SSE/refresh timer 도 새 세션 것이 정리됨). `seedWaitingFromStatus` 에 추가된 staleness guard(W2)와 대칭이 되어야 하나 `sendCommand` 에는 누락. requirement reviewer 가 재현 테스트를 직접 작성·실행해 `phase==="ended"` 로 전이함을 실측 확인(비커밋, 코드는 원복) | `codebase/channel-web-chat/src/widget/use-widget.ts:412-432`(`sendCommand`, 특히 420-425 catch 블록) vs `:300`(`seedWaitingFromStatus` staleness guard, 대칭 부재) | catch 블록에서 `finalizeEnded` 호출 전 `if (sessionRef.current !== session) return;` 추가(또는 `finalizeEnded` 가 세션 인자를 받아 내부에서 동일 검사). 회귀 테스트: "in-flight 명령 대기 중 새 대화로 세션 교체 → 옛 명령의 지연 410 이 새 세션을 `ended` 로 전이시키지 않는다" |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화/요구사항 | `finalizeEnded` JSDoc 이 "두 진입점이 공유한다"고 서술하지만 이번 diff(W1 410 편입, W4 `endConversation` 편입) 이후 실제로는 **네 곳**(SSE terminal / REST 폴백 terminal / 410 Gone / 사용자 종료)이 호출 — documentation·requirement 중복 지적 | `use-widget.ts:166-179`(JSDoc, 미변경) vs 실제 호출 4곳 `:231`, `:307`, `:425`, `:577` | JSDoc 을 "네 진입점이 공유한다 — SSE terminal / REST 폴백 terminal / 410 Gone / 사용자 종료"로 갱신 |
| 2 | 부작용 | `endConversation()` 의 `resetSessionRefs(); finalizeEnded(reason);` 순서가 `endedRef` 1회 가드를 사실상 무력화(리셋 직후 재무장) — SSE terminal dispatch 의 비동기 커밋 창(React 배치)과 사용자의 stale 클로저 클릭이 겹치면 host 가 `conversationEnded` 를 2회 통지받는, 이번 diff 의 W1 이 고친 것과 동일 클래스의 회귀가 좁은 race 로 재발 가능 | `use-widget.ts:497-503`(`resetSessionRefs`), `:558-577`(`endConversation`) | `endConversation()` 최상단(`resetSessionRefs()` 호출 이전)에 `if (endedRef.current) return;` 추가, 또는 순서 재구성 |
| 3 | 부작용/동시성 | `sendCommand` 의 `useCallback` 의존성 배열에 신규 참조 `finalizeEnded` 누락(eslint `react-hooks/exhaustive-deps` 경고 실측 확인). 현재는 하위 의존 체인(`teardownSession`/`closeStream`/`clearRefreshTimer`)이 전부 stable 이라 무해하나 우연한 안전성이며, 같은 diff 가 `endConversation` 에는 정확히 deps 를 추가해 비일관 — side_effect·concurrency 중복 지적 | `use-widget.ts:412-432`(L425 `finalizeEnded("gone")` 호출부, L431 `}, [],);`) | `}, [finalizeEnded],);` 로 수정 |
| 4 | 부작용/테스트 | 신규 테스트 2건(fake timer, `postMessage` spy)이 `try/finally` 없이 정리 코드를 마지막 줄에만 배치 — assert 실패 시 `vi.useRealTimers()`/`postSpy.mockRestore()` 가 스킵되어 후속 테스트로 전역 상태 누수 가능. 같은 파일에 이미 올바른 `try/finally` 관례(:761-813) 존재하나 신규 테스트만 미준수 — side_effect·testing 중복 지적 | `use-widget-eager-start.test.ts:213-258`(fake timers), `:1481-1554`(`postMessage` spy) | `try { … } finally { vi.useRealTimers(); }` / `try { … } finally { postSpy.mockRestore(); }` 로 감싸거나 전역 `afterEach` 에 안전망 추가 |
| 5 | 테스트 | `applyConfig`(세션 복원) 고유의 `"stale"` 게이팅 라인을 전용으로 exercise 하는 테스트가 없음 — mutation 으로 "stale" 분기만 빠뜨려도 33개 테스트 전부 통과함을 실측 확인. 정확히 이 코드가 원래 고치려던 concurrency 결함의 위치라 커버리지 공백이 유의미함 | `use-widget.ts:643-646`(`const outcome = await seedWaitingFromStatus(...); if (outcome !== "continue") return;`) | 저장 세션 pre-seed → `boot()`(`applyConfig`) 의 `getStatus` 를 pending 으로 잡아둔 채 세션 교체 → terminal 응답 도착 시 `openStream` 미호출을 단언하는 `applyConfig` 전용 회귀 테스트 추가 |
| 6 | 동시성 | `applyConfig`/`start()` 모두 마지막 `await` 이후 컴포넌트 unmount 를 재검사하지 않아, `getStatus` in-flight 중 unmount 시 `openStream` 이 새 EventSource 를 열고 이후 어떤 cleanup 도 다시 돌지 않아 SSE 연결이 leak 될 수 있음(이번 diff 범위 밖의 잔존 gap, 신규 회귀 아님) | `use-widget.ts:619-651`(`applyConfig`, 특히 `:643-648`), `:365-410`(`start()`, 특히 `:395-399`) | 마운트 전용 `cancelledRef` 를 두 함수가 공유하도록 끌어올려 `openStream` 직전 재검사, 또는 `openStream` 자체에 "이미 destroy 됐으면 no-op" 가드 추가 |
| 7 | 문서화 | 위젯 세션-라이프사이클 버그 수정 커밋 체인(4개, `436ee334e`→`e99f46145`→`9dd47e6c9`→`4dad5993c`) 전체에 `CHANGELOG.md` 항목 없음 — 실사용자 관측 가능 동작 변경(무기한 멈춤 방지, 종료 중복 통지 방지)인데도 미기록 | `CHANGELOG.md`(Unreleased 섹션) | Unreleased 섹션에 "웹채팅 위젯 버퍼 만료(`replay_unavailable`) 종료 감지 + 종료 통지 중복 방지" 항목 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 진단 로그(`console.warn`)에 서버 에러 원문이 흐르는 기존 패턴이 이번 diff 로 3곳 확장(신규 노출 아님, UI 미노출) | `use-widget.ts:536-541`, `:583-586`, `:720-723` | 조치 불요. 추후 서버 에러 포맷 변경 시 `shared/utils/sanitize-error-message.ts` SECRET_LEAK_PATTERNS 재사용 검토 |
| 2 | 범위 | 코드 fix(W1~W7) 커밋에 직전 라운드 리뷰 산출물 12개 파일(~850줄)이 함께 커밋됨 — `review/code/**` 정식 위치라 무관한 파일은 아니나, `codebase/**` 포함이라 review-guard 재무장 구조 | 커밋 `4dad5993c` 전체 | 조치 불요. 이번 라운드 처리 후 최종 `review/**` 전용 커밋으로 마무리 권고 |
| 3 | 요구사항 | `RESOLUTION.md` 의 "widget 전체 127 passed" 서술이 실측(`npx vitest run src/widget`) 130 passed 와 불일치(카운트 오차, 기능 영향 없음) | `review/code/2026/07/17/02_31_18/RESOLUTION.md` | 문서 수치 정정(사소) |
| 4 | 문서화 | `seedWaitingFromStatus` JSDoc 내부 "호출 시점" 서술(두 경로)과 "@returns" 서술(세 호출부)이 불일치 — `handleEiaEvent` 의 `replay_unavailable` 폴백 호출 누락 | `use-widget.ts:268` vs `:286` | "호출 시점" 문장에 `handleEiaEvent`(fire-and-forget) 를 세 번째 경로로 추가 |
| 5 | 동시성 | `sessionRef.current` 가 `finalizeEnded`/`teardownSession` 단독 경로에서는 null 화되지 않아(`resetSessionRefs` 만 null 화), `clickButton`/`submitForm` 이 phase 가드 없이 종료된 세션에 커맨드를 보낼 수 있음. `endedRef` 가드가 중복 종료 통지는 막아 피해는 낭비된 네트워크 요청 1회로 제한적 | `use-widget.ts:158-164`(`teardownSession`), `:180-190`(`finalizeEnded`), `:464-476`(`clickButton`/`submitForm`) | `clickButton`/`submitForm` 에 `state.phase !== "ended"` 가드 추가 검토, 또는 `finalizeEnded` 가 `sessionRef.current = null` 도 함께 수행하도록 통합 |
| 6 | 부작용 | `endConversation()` 경로에서 `resetSessionRefs()`·`finalizeEnded()` 가 각각 `teardownSession()` 을 호출해 매번 2회 중복 실행(현재는 멱등이라 무해, 향후 비-멱등 부작용 추가 시 위험) | `use-widget.ts:497-503`, `:180-190`, 호출부 `:576-577` | `resetSessionRefs`/`finalizeEnded` 중 하나만 `teardownSession` 호출하도록 역할 재정리 고려 |
| 7 | 요구사항 | 신규 W6 fake-timer 테스트가 로컬 1회 flaky 실패 관찰됐으나 `--no-file-parallelism` + 8회 반복 재실행에서 재현 안 됨(mutation 검증 중 리소스 경합 추정) | `use-widget-eager-start.test.ts`(W6 신규 테스트) | 추가 조치 불요, 후속 관찰 권장 |
| 8 | 문서화 | `(ai-review 02_04_13 ...)`(날짜 없음, 기존) vs `(ai-review 2026-07-17 02_31_18 ...)`(날짜 포함, 신규) 인용 포맷 혼재 — 이미 인지·이월됨(RESOLUTION.md I2), 신규 인용은 일관되게 날짜 포함 | `use-widget.ts`·`use-widget-eager-start.test.ts` 전반 | 조치 불요(이미 추적됨), 향후 일괄 정리 라운드에서 처리 |
| 9 | 보안 | `seedWaitingFromStatus` 3-state(`SeedOutcome`) 승격은 `applyConfig` 게이팅을 명시 계약으로 통일해 무효 토큰 재사용/종료 세션 storage 부활 가능성을 구조적으로 줄인 순수 방어적 강화(문제 아님, 긍정 확인) | `use-widget.ts:82-88`(`SeedOutcome` 타입), `:643-647`(`applyConfig` 게이팅) | 해당 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 하드코딩 시크릿/인젝션/인가 우회 없음. `SeedOutcome` 3-state 승격은 순수 방어적 강화. `console.warn` 서버 원문 노출은 기존 패턴(INFO) |
| requirement | CRITICAL | cross-session stale 410 오종료를 mutation 재현으로 실측 확인(위 Critical #1). spec fidelity(§3.1, `3-auth-session.md`, `2-sdk.md`)는 일치 |
| scope | NONE | RESOLUTION.md 처분표(W1~W7, I1~I3) 와 diff 가 1:1 정확 대응, 범위 이탈 없음. 코드+리뷰 산출물 동시 커밋 구조만 INFO |
| side_effect | MEDIUM | `endConversation` 의 `endedRef` 가드 실질 무력화 경로, `sendCommand` useCallback deps 누락, 신규 테스트 cleanup 누락 |
| maintainability | 재시도 필요 | output_file 미생성 — "success" 로 보고됐으나 `maintainability.md` 파일 부재(FS-write flakiness), 내용 확보 불가 |
| testing | MEDIUM | `applyConfig` 고유 staleness 게이팅 테스트 커버리지 갭(실측), fake-timer cleanup 관례 불일치. W1/W3/W6 검출력은 mutation 재현으로 긍정 확인 |
| documentation | MEDIUM | `finalizeEnded` JSDoc stale(두 진입점→실제 네 곳), CHANGELOG.md 미반영. W3/I1 fix 는 정확히 반영됨 |
| concurrency | LOW | 직전 라운드 WARNING 2건(stale race, endedRef 커버리지)은 정확히 fix 됨(mutation 검증). deps 누락·unmount leak·sessionRef null화 잔존 이슈는 잔여 리스크 |
| user_guide_sync | 재시도 필요 | output_file 미생성 — "success" 로 보고됐으나 `user_guide_sync.md` 파일 부재(FS-write flakiness), 내용 확보 불가 |

## 발견 없는 에이전트

없음 — 실행된 9개 에이전트 중 파일을 확보한 7개는 모두 최소 INFO 이상의 발견사항을 보고했다(security·scope 는 CRITICAL/WARNING 없이 INFO 만).

## 권장 조치사항

1. **[CRITICAL, 최우선]** `sendCommand` 410 catch 에 세션 staleness 재검증 추가 — 세션 교체 후 도착한 stale 410 이 새 세션을 오종료시키지 못하도록 `if (sessionRef.current !== session) return;` 가드 삽입 + 회귀 테스트 추가.
2. `endConversation()` 의 `resetSessionRefs()`→`finalizeEnded()` 순서로 인해 `endedRef` 가드가 사실상 무력화되는 구조 정리(WARNING #2) — 최상단 가드 추가 또는 순서 재구성.
3. `sendCommand` 의 `useCallback` deps 에 `finalizeEnded` 추가(WARNING #3) — eslint 경고 해소, 저비용·저위험 수정.
4. `finalizeEnded` JSDoc 을 "네 진입점" 으로 갱신(WARNING #1)하고, `CHANGELOG.md` 에 이번 버그 수정 체인 항목 추가(WARNING #7).
5. `applyConfig` 고유 staleness 게이팅 전용 회귀 테스트 추가(WARNING #5), 신규 테스트 2건의 fake-timer/spy 정리를 `try/finally` 로 감싸 누수 방지(WARNING #4).
6. `applyConfig`/`start()` 의 unmount-after-await leak(WARNING #6)은 이번 diff 범위 밖이나 다음 라운드에서 정리 권장.
7. `maintainability`·`user_guide_sync` reviewer 출력 파일이 "success" 보고에도 불구하고 생성되지 않았다 — 해당 두 관점은 이번 라운드에서 검증되지 않았으므로 재실행 후 별도 확인 필요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, user_guide_sync (9명)
  - **제외**: 표 참고 (5명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 소스 코드 변경(`use-widget.ts`, `use-widget-eager-start.test.ts`) 및 문서 파일 변경(`review/code/2026/07/17/02_31_18/**`)에 대해 항상 적용되는 안전 규칙으로 강제 포함됨. `concurrency`·`user_guide_sync` 는 router 자체 판단으로 선택(강제 목록 아님)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터가 이번 diff(위젯 세션 상태 관리 리팩토링, 신규 네트워크/렌더 성능 경로 없음)와 관련성 낮다고 판단(상세 사유 로그 미제공) |
  | architecture | 동일 — 모듈 내부 리팩토링으로 아키텍처 경계 변경 없음 판단 |
  | dependency | 동일 — 신규/변경 의존성 없음 판단 |
  | database | 동일 — DB 접근 코드 변경 없음 판단 |
  | api_contract | 동일 — 외부 공개 API(`useWidget` 반환 shape) 변경 없음 판단 |

## 부록 — reviewer 출력 파일 무결성 참고

`maintainability`·`user_guide_sync` 는 workflow 상 `status=success` 로 보고됐으나 해당 `output_file`(`maintainability.md`, `user_guide_sync.md`)이 디스크에 생성되지 않아(알려진 FS-write flakiness 패턴) 본 요약에 반영하지 못했다. 다음 라운드에서 이 두 reviewer 를 재확인할 것을 권고한다.