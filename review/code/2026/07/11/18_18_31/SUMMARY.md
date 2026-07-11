# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 없음. 실질 기능 결함 1건(coalesce 경로에서 대기 메시지 큐 미클리어로 인한 "새 대화" 로 텍스트 누수)과 문서 정합성(CHANGELOG stale, JSDoc 인과 오류) 이슈가 겹쳐 architecture/side_effect/documentation 3개 관점이 독립적으로 MEDIUM 을 보고했다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect / requirement | `newChat()` 의 booting-중 coalesce 조기 반환(`if (startedRef.current && !sessionRef.current) return;`)이 `resetSessionRefs()` 를 건너뛰어 그 내부 `clearQueue()`(I1: "새 대화 시 이전 큐 누수 차단")도 실행되지 않는다. Booting 중 `pendingSendRef` 에 큐잉된 텍스트가 흡수된("새") 세션의 첫 `awaiting_user_message` 도달 시 `submit_message` 로 flush 되어, "새 대화"임에도 직전 텍스트가 새 세션으로 유출된다. spec §R9 "host-facing 투명성" 이 "유일한 잔여 edge" 로 명시한 항목(profile 소급)에 이 케이스는 포함되지 않아 의도된 결정이 아니라 검토 누락으로 보인다. | `codebase/channel-web-chat/src/widget/use-widget.ts` `newChat` L1090-1109 (조기 반환부 L1092/구현상 L418-420) | coalesce 분기에서도 `clearQueue()` 만 별도 호출(세션/gen/webhook 상태는 유지)하거나, 의도적 유지라면 §R9 에 근거를 명시하고 C1+R9-A 결합 회귀 테스트 추가 |
| 2 | architecture | `newChat`/`endConversation` 이 "세션·클라이언트 캡처 → optimistic teardown/dispatch → best-effort fire-and-forget 명령" 6단계 패턴을 독립적으로 재구현. 향후 세 번째 종료류 액션 추가 시 동일 패턴이 또 복제될 위험. | `use-widget.ts` `newChat` (L1090-1109) vs `endConversation` (L1123-1151) | 공용 헬퍼(예: `fireBestEffortCommand(session, client, command, logLabel)`) 로 추출해 커맨드 구성만 다르게 넘기도록 리팩터 백로그화 |
| 3 | architecture | `newChat` 의 booting 판정(`startedRef.current && !sessionRef.current`)이 `widget-state.ts` 가 스스로 선언한 "phase 파생 로직은 본 모듈에 단일화" 원칙 밖에서 별도로 재도출됨 — 현재는 `WidgetPhase` booting 과 동치이나 향후 phase 전이가 추가/변경되면 조용히 어긋날 수 있는 잠재적 이중 진실. | `use-widget.ts` L1092 vs `widget-state.ts` L92-93 docstring | 두 정의의 동치를 보증하는 회귀 테스트 추가, 또는 주석에 "WidgetPhase 확장 시 필수 재확인" 명시 |
| 4 | scope | 위젯 코드 changeset(PR-1, developer 역할)에 `spec/7-channel-web-chat/1-widget-app.md` 정정(§3.1 "410 Gone" 라벨)이 동봉됨. 내용 자체는 정확·정당(정합성 리뷰 SUMMARY.md 가 발견한 W1 정정)이나, 그 SUMMARY.md 스스로 "별도 docs commit" 으로 명시했고 CLAUDE.md 상 `spec/` 쓰기는 project-planner 전용·developer 는 read-only 이므로 커밋 경계 분리 여부 확인 필요. | `spec/7-channel-web-chat/1-widget-app.md` §3.1 (line 2320→2321) | 이 spec 정정이 developer(PR-1) 커밋에 실제 포함됐다면 project-planner 세션의 별도 커밋으로 분리. 이미 별도 커밋이면 조치 불요(diff 배치 아티팩트 확인만) |
| 5 | testing | 이번 PR 의 핵심 동기인 "host `resetSession` 이 booting 중 in-flight `start()` 와 겹치는" 시나리오를 신규 테스트 3건 모두 `actions.newChat()` 직접 호출로 검증하고, 실제 `wc:command {action:"resetSession"}` → `bridge.onCommand` → `apiRef.current.newChat()` 브릿지 경로는 어떤 테스트도 타지 않는다(`use-widget-commands.test.ts` 에도 `resetSession` 케이스 0건). | `use-widget-eager-start.test.ts` R9-A/R9-B-1, `use-widget.ts:535` (`case "resetSession"`) | `use-widget-commands.test.ts` 또는 본 파일에 실제 `wc:command` postMessage 를 주입해 `newChat()` 호출을 검증하는 테스트 1건 추가 |
| 6 | documentation | `CHANGELOG.md` 에 이번 fix(coalesce/best-effort cancel) 미등재. 기존 L70(PR #874) 항목은 "새 대화는 이전 execution 을 명시 종료 없이 방치한다" 고 서술하는데, 이번 diff 가 정확히 이 동작을 고쳐(§R9-B-1 cancel 추가) 해당 서술이 stale·모순이 됐다. | `CHANGELOG.md` L70; 신규 항목 부재 | Unreleased 섹션에 (A) coalesce, (B-1) best-effort cancel 항목 추가 + SoT(`spec §R9`) 링크, L70 에 "이후 §R9 에서 정정됨" 각주 |
| 7 | documentation / requirement | `newChat` JSDoc 이 "resetSessionRefs 가 start 가드를 재개방해 2번째 POST 를 막는다" 고 서술하나, 실제 코드는 조기 `return` 으로 `resetSessionRefs()` 자체를 건너뛰어(호출 안 함) 2번째 POST 를 막는다 — 인과가 뒤집혀 읽힐 수 있어 후속 개발자가 이 동시성 민감 가드를 오독할 위험. | `use-widget.ts` L407-411(JSDoc) 대응 코드 L419-420 | "조기 return 이 resetSessionRefs 호출(및 그로 인한 가드 재개방)을 건너뛰어 2번째 POST 를 막는다" 식으로 인과 순서 재서술 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | best-effort `cancel` 실패 원문이 `console.warn` 으로 노출되나, 기존 `errMessage()`("UI 는 일반화, console 은 진단 원문") 설계와 동일 패턴이며 UI 비노출 — 신규 위험 아님 | `use-widget.ts` L1099-1106 | 현행 유지 |
| 2 | architecture | `use-widget.ts` 훅이 프레젠테이션·비즈니스·데이터 3계층 응집이 이번 diff(+~20줄)로 더 심화 | `newChat` (L1090-1109) | 세션 lifecycle 을 React 비의존 오케스트레이터로 분리하는 안을 리팩터 백로그 후보로 |
| 3 | architecture / maintainability | best-effort 실패 로깅 문구(`"[widget] <액션> 실패(...):"`)가 호출부마다 하드코딩 중복, `newChat`/`endConversation` 이 fire-and-forget vs async/await 두 스타일로 공존 | `use-widget.ts` L1101-1106 외 다수 | `warnBestEffort`/`fireAndForgetCommand` 류 헬퍼로 통합 고려(비강제) |
| 4 | requirement | 서버측 idle-wait backstop(EIA-RL-07, B-2)이 spec 산문(§3.1)에서 현재형으로 서술되나 본 PR 은 클라이언트측(A/B-1)만 구현, B-2 는 plan 문서에 후속 PR 로 명시 이연 — 계획된 격차, 결함 아님 | `spec/7-channel-web-chat/1-widget-app.md` §3.1, §R9 | 조치 불요(후속 PR 에서 "(Planned)" 각주 고려 가능) |
| 5 | scope | `review/consistency/2026/07/11/17_54_21/**` 신규 6파일은 impl-prep 의무 게이트 산출물, plan 체크박스 갱신도 실제 완료 반영 — 스코프 이탈 아님 | `review/consistency/...`, `plan/in-progress/spec-draft-webchat-execution-residuals.md` L1296-1300 | 조치 불요 |
| 6 | side_effect | `newChat()` 에 신규 서버측 부작용(`cancel` fire-and-forget)이 추가됐으나 plan/spec 에 사전 승인된 의도된 변경이며 스코프·실패 처리·순서 모두 안전 | `use-widget.ts` L1098-1107 | 조치 불요, 사실 기록 |
| 7 | side_effect / testing | 테스트 헬퍼 `installFetch()` 에 `/interact` → 202 분기가 추가돼 이 파일의 기존 모든 테스트에 영향 — 의도치 않은 `/interact` 호출이 있어도 더 이상 `unexpected fetch` 오류로 드러나지 않아 테스트 관측성이 소폭 저하 | `use-widget-eager-start.test.ts` L255-260 | 필요 시 R9 전용 테스트에만 별도 fetch mock 적용(선택 사항) |
| 8 | maintainability | 인라인 `fetchMock` 보일러플레이트가 기존 10회→12회로 증식(기존 `installFetch`/`installControllableSse` 옵션화로 흡수 가능했음) | `use-widget-eager-start.test.ts` 신규 R9-A/R9-B-1 케이스 | 다음 유사 케이스부터 기존 헬퍼 옵션화 권장 |
| 9 | maintainability | 에러 포맷 삼항식(`e instanceof Error ? e.message : String(e)`)이 파일 내 4곳으로 중복 | `newChat` 신규 catch 블록 외 3곳 | `formatErr(e)` 순수 헬퍼로 통합 고려(비강제) |
| 10 | testing | `newChat` 의 idle(미시작, `prevSession`/`client` 둘 다 null) 분기 미검증 — 동작 자체는 pre-diff 와 동일해 위험 낮음 | `use-widget.ts:418-437` false 분기 | 우선순위 낮음, 여유 시 매트릭스 완결용 테스트 1건 |
| 11 | testing | R9-B-1(성공) 테스트가 이전/신규 세션에 동일 mock 값을 재사용해 "정확히 이전 세션만 캡처"를 강하게 구분 검증하지 못함(구조상 실질 위험은 낮음) | `use-widget-eager-start.test.ts:322-346` | 두 번째 webhook 응답에 다른 `executionId`/`token` 부여 권장 |
| 12 | testing | 확립 세션에서 `newChat()` 연속 더블클릭(coalesce guard 재사용 경로) 시나리오 미검증 | `use-widget.ts:418-437` | `newChat(); newChat();` 연속 호출 테스트 1건 추가 권장 |
| 13 | testing | cancel 실패 테스트가 `console.warn` 호출을 스파이/단언하지 않아 테스트 로그 노이즈 발생 | `use-widget-eager-start.test.ts:349-382` | `vi.spyOn(console, "warn")` 으로 억제 겸 단언(선택) |
| 14 | testing | 신규 R9-A 테스트도 real-timer `NO_EXTRA_CALL_WAIT_MS`(20ms) 기반 negative 타이밍 단언에 의존 — 느린 CI 에서 거짓 음성 가능성(기존 패턴, 신규 결함 아님) | `use-widget-eager-start.test.ts:307` | 인지만, 조치 불요 |
| 15 | documentation | plan 체크리스트가 "(PR-1) ... 착수"(`[~]`) 로 남아있어 실제로는 구현+테스트까지 완결된 현재 상태를 과소평가 | `plan/in-progress/spec-draft-webchat-execution-residuals.md` L1604-1605 | 커밋 시점에 `[x]`/문구를 실제 완료 상태로 갱신 |
| 16 | documentation | 신규 `reason: "user_new_chat"` 값이 EIA §5.4 예시 목록(`"user_aborted"` 뿐)에 미기재 — 계약 위반 아님, 열거 참고성 갭 | `use-widget.ts` L428 vs `spec/5-system/14-external-interaction-api.md` L489 | §5.4 예시에 `user_new_chat`/`user_ended` 등 병기 고려(비강제) |
| 17 | concurrency | best-effort cancel 은 캡처~발사 사이 `await` 지점이 없어 새 세션에 옛 cancel 이 잘못 발사되는 race 는 설계상 발생하지 않음 — 확인된 안전 패턴 | `use-widget.ts:1094-1108` | 현행 유지, 향후 리팩터 시 캡처~호출 사이 `await` 삽입 금지 |
| 18 | concurrency | `newChat`/`endConversation` 교차 호출 시 이론적 stale-closure 경합 — 이번 diff 가 도입한 것이 아니라 기존 패턴이며 실사용 트리거 경로가 달라 실개연성 낮음 | `use-widget.ts` (`endConversation` state 클로저 가드 vs `newChat`/`resetSessionRefs` ref 즉시 갱신) | 우선순위 낮음. 필요 시 `endConversation` 가드를 ref 기반으로 전환 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 위험 패턴 없음(cancel 실패 로그 노출은 기존 설계 재확인) |
| architecture | MEDIUM | best-effort 패턴 중복(#2), coalesce 판정 이중 진실 위험(#3) |
| requirement | LOW | 큐 클리어 누락(#1, WARNING) 확인, B-2 이연은 계획된 것 |
| scope | LOW | spec/ 정정 동봉 커밋 경계 확인 필요(#4), 그 외 스코프 정합 |
| side_effect | MEDIUM | 큐 클리어 누락(#1, WARNING) 상세 재현 경로 확보 |
| maintainability | LOW | 보일러플레이트/스타일 중복 다수(INFO), 즉시 차단 사유 없음 |
| testing | LOW | 실제 실행(23/23·141/141)+뮤테이션 킬 검증 완료, 브릿지 경로 미검증(#5, WARNING) |
| documentation | MEDIUM | CHANGELOG stale(#6), JSDoc 인과 오류(#7) |
| concurrency | LOW | 신규 race 없음, 기존 이론적 경합 1건 재확인 |

## 발견 없는 에이전트

없음 — 전 에이전트가 최소 1건 이상(INFO 이상) 발견을 보고함.

## 권장 조치사항

1. **[필수]** `newChat()` coalesce 조기 반환 경로에서도 `clearQueue()` 를 호출해 booting 중 큐잉된 텍스트가 "새 대화"로 유출되는 상태 누수를 차단(#1). 결정적 회귀 테스트(C1+R9-A 결합) 추가.
2. **[필수]** `newChat` JSDoc 의 coalesce 인과 설명을 실제 코드 흐름(조기 return → resetSessionRefs 미호출)과 일치하도록 재서술(#7).
3. **[권장]** `CHANGELOG.md` 에 이번 fix(coalesce/best-effort cancel) 항목을 추가하고 L70 의 stale 서술을 정정 또는 각주 처리(#6).
4. **[확인 필요]** `spec/7-channel-web-chat/1-widget-app.md` §3.1 정정이 developer(PR-1) 커밋에 실제 포함됐는지 확인 — 포함됐다면 project-planner 세션의 별도 커밋으로 분리(#4).
5. **[권장]** 실제 host `wc:command {action:"resetSession"}` 브릿지 경로를 타는 회귀 테스트를 최소 1건 추가해 이 PR 의 핵심 트리거 경로 커버리지 확보(#5).
6. **[백로그]** `newChat`/`endConversation` 의 "캡처→teardown→dispatch→best-effort fire" 반복 패턴과 booting 판정 이중 소스를 공용 헬퍼/단일 SoT 로 정리(#2, #3).
7. **[선택]** plan 체크리스트를 실제 완료 상태(`[x]`)로 갱신하고, EIA §5.4 `reason` 예시에 `user_new_chat` 등을 병기(#15, #16).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency (9명)
  - **제외**: 5명 (표 참고)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 changeset 은 순수 클라이언트 상태-머신/네트워크 호출 순서 조정으로 성능 특성 변경 범위 밖으로 판단됨(상세 사유는 `_routing_decision.json` 미제공, 위 skipped 목록 기준) |
  | dependency | router 판단 — 신규 의존성/패키지 변경 없음 |
  | database | router 판단 — 서버·DB 코드 변경 없음(위젯 프런트엔드 전용 diff) |
  | api_contract | router 판단 — 신규/변경 서버 API 계약 없음(기존 EIA `cancel` 명령 재사용) |
  | user_guide_sync | router 판단 — 사용자 가이드 문서 대상 변경 없음 |

---