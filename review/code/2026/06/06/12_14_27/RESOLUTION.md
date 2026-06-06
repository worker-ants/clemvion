# RESOLUTION — 12_14_27

> 세션: `review/code/2026/06/06/12_14_27`
> 대상: channel-web-chat eager-start §R6 코드 리뷰 후속 처리
> 처리일: 2026-06-06
> Fix commit: `6a4af359`

---

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| C1        | 코드  | 6a4af359    | `pendingSendRef` 큐+flush effect 도입 — open 직후 booting 중 submitMessage 텍스트 큐잉, `awaiting_user_message`+`ai_conversation` 진입 시 `submit_message` 전송. 런처 버블·패널 suggestions race 해소. C1 회귀 테스트(ControllableEventSource SSE 주입) 추가. |
| W1        | 코드  | 6a4af359    | panel suggestions 버튼이 C1 큐 경로를 타므로 인라인 주석으로 명시. submitMessage 내부 큐 분기가 race를 흡수. |
| W2        | SPEC-DRIFT | (draft 위임) | `plan/in-progress/spec-update-webchat-eager-start.md` — §2 런처 버블 설명 eager 기준 갱신 제안. |
| W3        | 코드(주석) | 6a4af359 | newChat 순서 의존성 주석 명시(6단계 순서·이유). |
| W5        | 코드(테스트) | 6a4af359 | `eia-client.test.ts` firstMessage 구버전 단언 제거 + `not.toHaveProperty("firstMessage")` + profile 검증 추가. |
| W6        | 코드(테스트) | 6a4af359 | `panel.test.tsx` 신규 — phase/pending 조합 6종 Composer disabled/enabled 검증(booting, streaming, buttons, form → disabled; ai_conversation, null → enabled). |
| W7        | 코드(테스트) | 6a4af359 | `use-widget-eager-start.test.ts` — newChat() → 기존 세션 정리 후 새 webhook POST 1회 검증. |
| W8        | 코드(테스트) | 6a4af359 | webhook 500 실패 → ERROR phase → 재open 시 startedRef 복구 + 새 POST 발생 검증. |
| W9        | 코드  | 6a4af359    | newChat 내 closeStream 직후 `refreshTimerRef` clearTimeout 추가 — null된 sessionRef에 타이머 쓰기 방지. |
| W10       | 코드(주석) | 6a4af359 | start() JSDoc 에 check-then-set 구조 주의 명시 — 첫 await 이전 플래그 세팅 위치 유지 요구. |
| I1        | SPEC-DRIFT | (draft 위임) | `plan/in-progress/spec-update-webchat-eager-start.md` — 다이어그램 `[panel]` 중간 단계 표시 제안. |
| I2        | SPEC-DRIFT | (draft 위임) | `plan/in-progress/spec-update-webchat-eager-start.md` — `awaiting_user_input` → `awaiting_user_message` 다이어그램 정정 제안. |
| I3        | 코드(주석) | 6a4af359 | actions.start 반환 위에 "open 이 자동 호출 — 외부 직접 호출 불필요" 주석. |
| I8        | 코드(테스트) | 6a4af359 | `NO_EXTRA_CALL_WAIT_MS = 20` 상수 추출. |
| I9        | 코드(테스트) | 6a4af359 | `NINETY_MIN_MS = 90 * 60 * 1000` 상수 추출. |
| I11       | 코드(JSDoc) | 6a4af359 | widget-state.ts START action JSDoc 추가. |
| I12       | 코드(주석) | 6a4af359 | updateProfile 주석 "첫 메시지/새 대화" → "패널 open/새 대화" 수정. |

---

## TEST 결과

- lint  : 통과 (channel-web-chat eslint — backend node_modules 미설치는 pre-existing 워크트리 환경 문제, 본 변경과 무관)
- unit  : 통과 (181 passed — channel-web-chat 181/181, 기존 172 대비 9건 신규 추가)
- build : 해당 없음 (channel-web-chat 코드만 변경, 전체 빌드는 pre-existing deps 환경 문제)
- e2e   : 통과 (174/174) — `_test_logs/e2e-20260606-123357.log`

---

## 보류·후속 항목

### spec-drift 위임 (ESCALATE=spec)
- W2/I1/I2 SPEC-DRIFT draft: `/Volumes/project/private/clemvion/plan/in-progress/spec-update-webchat-eager-start.md`
  - §2 런처 버블 설명 eager 기준으로 갱신
  - §3 다이어그램 `[panel]` 중간 단계 추가 + `awaiting_user_input` → `awaiting_user_message` 정정
  - §3 워크플로우 시작 시점 설명 eager 기준으로 갱신
  - §3.2 updateProfile 설명 "첫 메시지" → "패널 open" 갱신
  main 에서 `consistency-check --spec` 후 project-planner 가 spec 반영.

### 백로그 (RESOLUTION 기재만, 자동 수정 미대상)
- INFO W4: `useWidget` God Hook 분리 (useTokenRefresh 추출) — 즉각 리팩터 불필요.
- INFO W10 구조적: start() 향후 수정 시 check-then-set 플래그 위치 유의 (주석 명시 완료).
- INFO I4: 방치 execution row cleanup — `end_conversation` idle 전략 별도 backlog.
- INFO I6: Composer allowlist (pending.type 열거) — 타입 확장 시 재검토.
- INFO I10: SSE 이벤트명 배열 eia-types.ts 파생 — TODO 주석 별도.
- INFO I13: plan 체크리스트 미완료 상태 — 해당 plan 파일 별도 갱신 필요.
- INFO I14: EiaClient.startConversation firstMessage 제거 — 하위 호환 확인됨(서버 선택적 처리).
