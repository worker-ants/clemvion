# RESOLUTION — 웹채팅 위젯 §R9 coalesce/cancel (PR-1)

`/ai-review --branch origin/main` (SUMMARY.md, risk MEDIUM, Critical 0, Warning 7) 조치 기록.
모든 fix 는 **본 REVIEW WORKFLOW 커밋**(RESOLUTION.md 포함)에 담긴다.

## 조치 항목

| # | Sev | 발견 | 조치 | 위치 |
|---|-----|------|------|------|
| W1 | WARNING | coalesce 조기 return 이 `resetSessionRefs()` 를 건너뛰어 `clearQueue()` 도 미실행 → booting 중 큐잉 텍스트가 흡수 세션의 첫 `awaiting_user_message` 로 누수(I1 불변식 위반) | **FIX**: coalesce 브랜치에 `clearQueue()` 추가(세션/gen/webhook 상태는 유지). **non-vacuous 회귀 테스트** 추가(fix 제거 시 실제 실패 확인) | `use-widget.ts` newChat coalesce 분기 + `use-widget-eager-start.test.ts` "R9-A: booting 중 큐잉 텍스트는 coalesce 시 폐기" |
| W2 | WARNING | `newChat`/`endConversation` 이 "캡처→teardown→best-effort 명령" 패턴 중복 | **DEFER(후속 리팩터)**: 공용 헬퍼 추출은 `endConversation`(async `await` interact)↔`newChat`(fire-and-forget `.catch`) **두 스타일 통합**을 요구하는데, 통합 시 endConversation 의 종료 타이밍(명령 완료까지 await)이 바뀌어 기존 종료 테스트 계약을 깰 위험이 있다. 리뷰어도 "백로그화" 권고. `plan/in-progress/webchat-widget-presentation-followups.md` 인접 후속 또는 별 리팩터 plan 으로 이관 | — |
| W3 | WARNING | coalesce 판정(`startedRef && !sessionRef`)이 `widget-state` 의 "phase 파생 단일화" 밖에서 재도출 — WidgetPhase booting 과 이중 진실 위험 | **FIX(주석+테스트)**: JSDoc 에 "현재 booting 과 동치, R9-A 테스트가 booting phase 고정 검증, phase 전이 변경 시 재확인" 명시. R9-A coalesce 테스트가 `phase==='booting'` 을 단언해 동치를 가드 | `use-widget.ts` newChat JSDoc |
| W4 | WARNING | 위젯 PR 에 `spec/` 정정 동봉 — developer 는 spec read-only | **조치 불요**: 해당 spec 정정(§3.1 "410 Gone")은 이미 **별도 `docs(spec):` 커밋 `924212b1b`** 로 분리됨(feat 커밋과 경계 구분). 리뷰어 "이미 별도 커밋이면 조치 불요" 조건 충족 | — |
| W5 | WARNING | 핵심 동기인 `wc:command {action:"resetSession"}` → bridge.onCommand → newChat 브릿지 경로가 미테스트(신규 3건 모두 `actions.newChat()` 직접 호출) | **FIX**: `sendHostCommand()` 헬퍼 + 실제 host postMessage 로 구동하는 브릿지 테스트 추가 | `use-widget-eager-start.test.ts` "R9-B-1: host wc:command resetSession(브릿지 경로)" |
| W6 | WARNING | CHANGELOG 에 fix 미등재 + #874 항목("새 대화는 명시 종료 없이 방치") stale·모순 | **FIX**: §R9 Unreleased 섹션 신설(A coalesce·B-1 cancel·SoT 링크) + #874 항목에 "이후 §R9 에서 정정됨" 각주 | `CHANGELOG.md` |
| W7 | WARNING | newChat JSDoc 인과 역전("resetSessionRefs 가 재개방해 막는다" — 실제론 조기 return 이 resetSessionRefs 를 건너뛰어 막음) | **FIX**: "조기 return 이 resetSessionRefs 호출을 건너뜀으로써 그것이 가드를 재개방해 2번째 POST 를 쏘는 것을 막는다" 로 인과 재서술 | `use-widget.ts` newChat JSDoc |

**INFO(18건) 처리**: 대부분 비강제·저위험. 반영: I15(plan 체크박스→실완료 갱신). 확인만: I1·I4·I5·I6·I17(안전 패턴/계획된 격차 재확인). Defer(저위험): I11(cancel 테스트 2세션 executionId 구분), I13(console.warn spy), I2·I3·I8·I9(헬퍼 추출 — W2 와 동일 후속), I16(§5.4 reason 예시 병기 — spec, 후속). 나머지 조치 불요.

## TEST 결과

- **lint**: 통과 (`_test_logs/lint-20260711-184012.log`)
- **unit**: 통과 (33 passed; use-widget-eager-start 25 passed — 신규 W1 회귀·W5 브릿지 포함)
- **build**: 통과 (`_test_logs/build-20260711-184220.log`)
- **e2e**: 통과 (backend docker-compose, 252 passed, 169s; `_test_logs/e2e-20260711-184352.log` — 리뷰 fix 후 재수행)

## 보류·후속 항목

- **W2 best-effort 명령 헬퍼 추출** — endConversation/newChat 두 스타일 통합 리스크로 별 리팩터 후속.
- **B-2 서버 idle-wait reaper (EIA-RL-07)** — PR-2(백엔드), 별 세션. 결정 SoT `plan/in-progress/spec-draft-webchat-execution-residuals.md`.
