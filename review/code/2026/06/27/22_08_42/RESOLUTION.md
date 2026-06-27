# RESOLUTION — 위젯 리팩터(B) + 테스트 보강(C) ai-review 후속

ai-review 결과: **RISK=LOW, Critical=0, Warning=0** (resolution-applier 미강제). INFO 14건 중
저비용·고가치 항목을 자율 반영하고, 나머지는 stale 오탐 / pre-existing backlog / planner followup 으로 분류.

## 조치 항목

| SUMMARY # | 분류 | 조치 | commit |
|---|---|---|---|
| #12 | 테스팅 | `isTextInputSurface` 직접 단위 테스트 4케이스(null/ai_conversation/buttons/form) 추가 | (본 후속 commit) |
| #9 | 유지보수성 | `TERMINAL_EVENTS as readonly string[]` 이중 캐스트 이유 주석 추가 | (본 후속 commit) |
| #13 | 테스팅 | fake-timer `>= 1` 단언의 재예약 고려 의도 주석 추가 | (본 후속 commit) |
| #4 | 문서화 | `web-chat-quality-backlog.md §B·§C` 체크박스 갱신(B1 deferred 명시) | (본 후속 commit) |
| #2·#3 | 요구사항 | **stale 오탐** — submitMessage(325)·flush effect(346) 이미 헬퍼 적용(grep 확인). 무조치 | — |
| #1 | SPEC-DRIFT | `pending=null` 텍스트표면 근거 spec 미기재 — **pre-existing 동작**, INFO 비차단 → planner spec polish followup 이관 | — |
| #5·#7 | 보안 | 에러 메시지 일반화·localStorage→sessionStorage — backlog §A 등록됨(다음 PR) | — |
| #6·#14 | 보안/테스팅 | configFromQuery apiBase 검증·phase=blocked Panel 테스트 — backlog §C 메모 등재 | (본 후속 commit) |
| #8 | 보안 | isTextInputSurface unknown-type — parseWaitingForInput 이 ai_conversation 으로 정규화(상류 차단). 저위험, JSDoc 명시 | — |
| #10·#11 | 유지보수성 | W9 라벨(본 파일 기존 컨벤션)·테스트 SSE 중복(기존 테스트 보존) — 현행 유지 | — |

post-impl `/consistency-check --impl-done spec/7-channel-web-chat/`: **BLOCK: NO** (Critical/Warning 0).
산출물 `review/consistency/2026/06/27/22_09_19/`. SPEC-DRIFT INFO 는 ai-review #1 과 동일 — planner followup.

## TEST 결과

- lint: **통과** (`_test_logs/lint-20260627-221634.log`)
- unit: **통과** — channel-web-chat 229 tests green (helper 단위 4건 추가)
- build: **통과** (`_test_logs/build-20260627-220334.log` — 직전 PASS 유효: 본 후속의 소스 변경은 주석 1건뿐, 나머지는 테스트 전용 추가라 빌드 산출 불변)
- e2e: **통과** (`_test_logs/e2e-20260627-220606.log` — 218 passed. 본 후속 소스 변경이 주석 only 라 동작 불변, 직전 PASS 유효)

## 보류·후속 항목

- **B1** (`useWidget` God hook 분리 → `useTokenRefresh`/`usePendingMessageQueue`): 회귀 위험·규모로 별도 후속 PR. `plan/in-progress/webchat-widget-refactor.md §후속`.
- **A** (sessionStorage 전환·에러 메시지 일반화): backlog §A, spec 4-security/3-auth-session/2-sdk 동반 — planner 선행.
- **spec polish (planner)**: `1-widget-app §3.1`(ended 재open·ERROR→pending 해제), `§2`(isTextInputSurface SoT cross-ref) — INFO·비차단.
- **configFromQuery apiBase origin 검증**(보안 #6), **phase=blocked Panel 테스트**(#14) — backlog 메모.
