# Code Review 통합 보고서

> 대상: webchat eager start (§R6 — 패널 open 시 execution 시작, firstMessage 폐기)
> 생성일: 2026-06-06
> 세션 디렉토리: `review/code/2026/06/06/12_14_27/`

---

## 전체 위험도

**HIGH** — 런처 추천질문(launcher.suggestions) 탭 시 사용자 입력이 에러 없이 조용히 유실되는 기능 회귀가 존재함. 즉각 수정 필요.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| C1 | 요구사항 | **런처 추천질문 탭 시 텍스트 유실**: `open()` 내부 `void start()` 는 비동기이나 직후 동기적으로 호출되는 `submitMessage(text)` 는 `sessionRef.current === null` 조건에서 텍스트를 조용히 드롭함. spec `1-widget-app §2` "버블 탭 → 패널 open + 해당 텍스트 first message 제출" 요구사항이 완전히 깨짐 | `codebase/channel-web-chat/src/widget/widget-app.tsx` 35–38행 | `pendingFirstMessageRef = useRef<string|null>(null)` 도입 후 `awaiting_user_message` 진입 시 자동 전송하거나, `open(text?: string)` 시그니처 확장으로 pre-fill 텍스트를 start 흐름 내에서 처리 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | 요구사항 | **패널 welcome.suggestions 탭 중 booting 단계 메시지 유실**: 추천질문 버튼이 `phase` 를 체크하지 않아 `sessionRef.current === null` 상태에서 탭 시 동일 race 조건으로 드롭됨. `Composer` 에는 `awaiting_user_message` 가드가 있지만 suggestions 버튼에는 없음 | `codebase/channel-web-chat/src/widget/components/panel.tsx` 82–86행 | suggestions 버튼을 `phase !== "awaiting_user_message"` 시 disabled 처리하거나 C1 의 pre-fill 큐로 함께 처리 |
| W2 | SPEC-DRIFT | **[SPEC-DRIFT] spec `1-widget-app §2` 런처 버블 설명이 구 lazy 동작 기준**: "버블 탭 → 패널 open + 해당 텍스트를 first message 로 제출" 기술이 eager start 채택 후 갱신되지 않음 | `spec/7-channel-web-chat/1-widget-app.md` 30–31행 | 코드 유지 + spec §2 런처 설명을 eager start 기준("버블 탭 → 패널 open + `submit_message` 로 전송(pre-fill)")으로 갱신 |
| W3 | 아키텍처 | **`newChat` SRP 경계 두꺼움**: `newChat` 이 세션 정리·상태 리셋·새 execution 시작까지 5단계를 단일 콜백에서 순서 의존적으로 처리. 순서 변경 시 버그 위험 | `use-widget.ts` `newChat` 콜백 (라인 1463–1470) | 순서 의존적 이유를 인라인 주석으로 명시하거나, 향후 복잡도 증가 시 별도 헬퍼 추출 고려 |
| W4 | 아키텍처 | **`useWidget` God Hook 누적 복잡도**: 8개 관심사(iframe bridge, 보안 검증, 세션 영속화, SSE 스트림, 토큰 갱신 타이머, 상태기계 디스패치, 사용자 인터랙션, eager 가드)가 단일 훅에 집중 | `use-widget.ts` 전체 (약 330줄) | 즉각 리팩터 불필요. 토큰 갱신 로직(`scheduleRefresh`, `refreshTimerRef`)을 향후 `useTokenRefresh` 별도 훅으로 추출 backlog 등록 |
| W5 | 테스팅 | **`eia-client.test.ts` — 폐기된 `firstMessage` payload 검증 잔존**: `startConversation` 테스트가 `firstMessage: "hi"` 를 payload 에 포함·검증하며, 변경된 계약("firstMessage 미포함")을 검증하지 않음 | `codebase/channel-web-chat/src/lib/eia-client.test.ts` L80, L87 | `firstMessage` 단언 제거 + `expect(...).not.toHaveProperty("firstMessage")` 단언 추가 |
| W6 | 테스팅 | **`panel.tsx` Composer disabled 로직 전용 테스트 없음**: eager 시작 핵심 UX 변경(booting/streaming 중 입력 비활성) 검증 케이스 부재. `awaiting_user_message` + `pending.type=buttons` 조합 경계값 미검증 | `codebase/channel-web-chat/src/widget/components/panel.tsx` L776–783 | phase별 Composer enabled/disabled 5개 케이스를 `panel.test.tsx` 또는 `widget-app.test.tsx` 에 추가 |
| W7 | 테스팅 | **`newChat` eager 재시작 테스트 없음**: newChat 후 execution 새로 시작·세션 정리·`startedRef` 리셋 흐름 미검증 | `use-widget.ts` `newChat` (라인 1463–1470) | `newChat()` → 기존 세션 정리 → 새 webhook POST 1회 발생 검증 케이스 추가 |
| W8 | 테스팅 | **`start()` 실패 후 재시도 경로 테스트 없음**: webhook 실패 → `startedRef.current = false` 복구 → 재open 시 새 POST 발생 흐름 미검증 | `use-widget.ts` `start` catch 블록 | webhook 500 실패 → ERROR dispatch → 재open 시 새 POST 발생 케이스 추가 |
| W9 | 동시성 | **`newChat()` 내 `refreshTimerRef` 미정리**: `closeStream()` + `sessionRef.current = null` 이후에도 이미 예약된 `setTimeout` 타이머가 null 된 `sessionRef` 에 쓰기 시도 가능 | `use-widget.ts` `newChat` 콜백 | `closeStream()` 직후 `if (refreshTimerRef.current) { clearTimeout(refreshTimerRef.current); refreshTimerRef.current = null; }` 추가 |
| W10 | 동시성 | **`start()` check-then-set 패턴 구조적 취약**: 현재 동기 구조에서는 안전하지만 향후 `start()` 내부 첫 `await` 삽입 전에 `startedRef.current = true` 세팅이 없으면 즉시 경쟁 조건 발생 | `use-widget.ts` `start` 라인 1387–1409 | `newChat()` 에서 `startedRef.current = false` 후 즉시 `void start()` 하는 패턴에 주석 명시. 향후 `start()` 수정 시 플래그 세팅 위치 유의 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | SPEC-DRIFT | **[SPEC-DRIFT] spec 상태기계 다이어그램 `[collapsed]→[booting]` vs 코드의 중간 `panel` 단계**: 코드는 `OPEN`→`panel`→`START`→`booting` 을 거치지만 spec 다이어그램은 `open → [booting]` 직접 전이로 표현 | `spec/7-channel-web-chat/1-widget-app.md §3` 다이어그램 | 코드 유지 + spec 다이어그램에 `[panel] (transient)` 주석 추가 |
| I2 | SPEC-DRIFT | **[SPEC-DRIFT] phase 이름 불일치**: spec 다이어그램 `[awaiting_user_input]` vs 코드 `awaiting_user_message` | `spec/7-channel-web-chat/1-widget-app.md §3` vs `widget-state.ts` 13행 | 코드 유지 + spec 다이어그램 `awaiting_user_input` → `awaiting_user_message` 수정 |
| I3 | 요구사항 | **`start` 가 `actions` 반환 객체에 공개 노출**: eager start 이후 `start` 는 `open()` 내부에서만 호출되어야 하나 외부 직접 호출 가능 | `use-widget.ts` 414행 `actions.start` | `start` 를 `actions` 에서 제거하거나 "open 이 자동 호출 — 외부 직접 호출 불필요" 주석 명시 |
| I4 | 성능 | **방치 execution row 누적**: eager 전환으로 패널 open 마다 POST가 즉시 호출되어 방치 세션이 DB에 TTL 만료 전까지 잔류 가능. spec §R6 에 알려진 트레이드오프로 기재됨 | `use-widget.ts` `open()` / `newChat()` | `close` 이벤트 또는 idle 타임아웃 후 `end_conversation` 명령 전송 cleanup 전략 백로그 등록 |
| I5 | 아키텍처 | **`panel` 중간 phase가 spec 다이어그램에 미표현**: 기능 결함 아님. I1 과 동일 컨텍스트 | `widget-state.ts` `OPEN` 케이스, spec 다이어그램 | I1 과 통합 처리 |
| I6 | 아키텍처 | **Composer disabled 조건의 `pending.type` 열거값 allowlist 미전환**: 현재 `"buttons"`, `"form"` 두 값을 명시 — `ExternalInteractionType` 확장 시 누락 위험 | `panel.tsx` 라인 776–783 | 타입이 5개 이상으로 늘면 `phase !== "awaiting_user_message" || (pending?.type !== "ai_conversation")` 형태로 전환 고려 |
| I7 | 유지보수성 | **`newChat` 다단계 순서 의존성 미문서화**: 6단계(`closeStream → clearSession → sessionRef null → startedRef false → dispatch → start`)의 순서가 중요하나 주석 없음 | `use-widget.ts` `newChat` (라인 1463–1470) | 순서 의존적 이유를 인라인 주석으로 명시 |
| I8 | 유지보수성 | **테스트 `setTimeout(r, 20)` 매직 넘버**: 타이밍 의존 취약한 패턴. CI 부하에 따라 flaky 가능 | `use-widget-eager-start.test.ts` L907–908, L923–924 | `NO_EXTRA_CALL_WAIT_MS = 20` 상수 추출 + 주석. `vitest` fake timer 또는 `waitFor` + 역-assertion 패턴 검토 |
| I9 | 유지보수성 | **테스트 `90 * 60 * 1000` 매직 넘버**: "90분 ms" 의미이나 코드만으로 불분명 | `use-widget-eager-start.test.ts` L839, L915 | `NINETY_MIN_MS = 90 * 60 * 1000` 상수 추출 |
| I10 | 유지보수성 | **`openStream` 내 SSE 이벤트 이름 배열 하드코딩**: `eia-types.ts` 타입 추가 시 이 배열 수동 갱신 필요. 이번 변경 직접 대상 아님 | `eia-client.ts` `openStream` (라인 178–187) | `eia-types.ts` 에서 이름 union/tuple export 후 파생. PR 범위 밖이면 TODO 주석 |
| I11 | 문서화 | **`WidgetAction.START` JSDoc 없음** | `widget-state.ts` `WidgetAction` union | `/** eager 시작(§R6) — open 시 발행. userText 없음. */` JSDoc 추가 |
| I12 | 문서화 | **`updateProfile` 주석의 "첫 메시지" 표현이 구 lazy 모델 언어 잔존** | `use-widget.ts` `updateProfile` 인라인 주석 (라인 1474) | "다음 시작(패널 open/새 대화)"으로 수정 |
| I13 | 문서화 | **plan 체크리스트 미완료 상태**: 구현이 완료된 항목이 미체크로 남아 있음 | `plan/in-progress/webchat-eager-start.md` | 완료된 항목 체크 업데이트 |
| I14 | API 계약 | **`EiaClient.startConversation` `firstMessage` 제거는 클라이언트 측 변경 (서버 무변경)**: 서버는 선택적 필드로 처리하므로 하위 호환성 파손 없음 | `eia-client.ts` `startConversation` payload 타입 | 이상 없음. 다른 클라이언트(BYO-UI 등)의 `EiaClient` 공유 여부 확인 권장 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | HIGH | 런처 추천질문 탭 시 텍스트 유실(C1), 패널 suggestions race(W1), SPEC-DRIFT 3건 |
| testing | MEDIUM | `eia-client.test.ts` firstMessage 구버전 검증 잔존(W5), panel disabled 케이스 미검증(W6), newChat/실패 재시도 경로 미검증(W7, W8) |
| architecture | LOW | newChat SRP 경계(W3), useWidget God Hook 누적(W4), panel 중간 phase spec drift(I1) |
| concurrency | LOW | newChat refreshTimerRef 미정리(W9), check-then-set 구조적 취약(W10) |
| side_effect | LOW | open() 네트워크 부작용 미명시(주석 권장), ended 상태 재open 경로 미테스트 |
| maintainability | LOW | 순서 의존성 미문서화, 테스트 매직 넘버, spec 상태명 오타 |
| documentation | LOW | spec 다이어그램 상태명 불일치(I2), updateProfile 주석 구 표현(I12) |
| performance | NONE | 방치 execution row 누적은 알려진 트레이드오프, 코드 성능 문제 없음 |
| api_contract | NONE | 서버 API 계약 유지, firstMessage 제거는 클라이언트 측 only |
| scope | NONE | 변경 범위 적절, 오류 수정성 nav 링크 추가 1건 수용 가능 |
| security | 결과 없음 | output_file 부재 — 재시도 필요 |

---

## 발견 없는 에이전트

- **scope**: 명확한 기능 문제 없음 (INFO 수준 편의 수정 확인)
- **api_contract**: API 계약 준수 양호, 위험 요소 없음
- **performance**: Critical/Warning 수준 성능 이슈 없음

---

## 권장 조치사항

1. **[즉시 필수] C1 — 런처 추천질문 유실 수정**: `widget-app.tsx` 의 `open()` + `submitMessage(text)` 동기 호출 패턴을 `pendingFirstMessageRef` 큐 또는 `open(text?)` 시그니처 확장으로 대체. `awaiting_user_message` 진입 시 pre-fill 자동 전송.

2. **[즉시 필수] W1 — 패널 suggestions 비활성 가드 추가**: `panel.tsx` welcome suggestions 버튼에 `phase !== "awaiting_user_message"` disabled 조건 추가.

3. **[즉시 권장] W9 — `newChat` refreshTimerRef 정리**: `closeStream()` 직후 `clearTimeout(refreshTimerRef.current)` 추가로 null 된 sessionRef 에 대한 타이머 쓰기 방지.

4. **[즉시 권장] W5 — `eia-client.test.ts` firstMessage 구버전 단언 수정**: `firstMessage` 전송·검증 제거 + `not.toHaveProperty("firstMessage")` 단언 추가.

5. **[권장] W6/W7/W8 — 테스트 커버리지 보강**: panel Composer disabled 케이스(5종), newChat eager 재시작, start() 실패 재시도 경로.

6. **[권장] W2/I1/I2 — SPEC-DRIFT spec 갱신 (project-planner 위임)**: `spec/7-channel-web-chat/1-widget-app.md` 에서 (a) §2 런처 버블 설명 eager 기준으로 갱신, (b) 상태기계 다이어그램 `panel` 중간 단계 표시, (c) `awaiting_user_input` → `awaiting_user_message` 수정.

7. **[백로그] W3/W4 — 유지보수성 개선**: `newChat` 순서 의존성 주석화, `useTokenRefresh` 별도 훅 추출 준비.

8. **[백로그] I4 — 방치 execution row cleanup**: `close` 이벤트 또는 idle 타임아웃 후 `end_conversation` 전송 전략.

---

## 라우터 결정

라우터 사용됨 (`routing_status=done`).

- **실행** (11명): `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `concurrency`, `api_contract`
- **강제 포함 (router_safety)** (7명): `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`
- **제외** (3명):

| 제외된 reviewer | 이유 |
|------------------|------|
| dependency | 라우터 제외 (의존성 변경 없음으로 판단) |
| database | 라우터 제외 (DB 스키마 변경 없음으로 판단) |
| user_guide_sync | 라우터 제외 (사용자 가이드 변경 불필요로 판단) |

> **주의**: `security` reviewer 는 강제 포함으로 실행됐으나 `output_file` 이 존재하지 않아 결과를 읽을 수 없었습니다. security 검토 결과가 이 보고서에 반영되지 않았습니다 — 재시도 필요.