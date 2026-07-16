### 발견사항

- **[WARNING]** 이번 fix가 무효화한 "스트림·세션 유지" 서술이 인접 주석·SoT spec 양쪽에 그대로 남아 stale 상태
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:178` (`handleEiaEvent` 의 `execution.replay_unavailable` 분기 인라인 주석), `spec/7-channel-web-chat/1-widget-app.md:104-107` (§3.1, SoT 문서)
  - 상세: 이번 diff(`e99f46145`)는 `seedWaitingFromStatus` 내부에 terminal 분기(`teardownSession()` + `dispatch ENDED`)를 추가해, `getStatus` 재조회 결과가 이미 종료 상태면 **스트림·세션을 정리**하도록 바꿨다(정확히는 W-req 버그 fix). 그런데 이 함수를 호출하는 `handleEiaEvent`의 `execution.replay_unavailable` 분기 바로 위 주석(178행)은 여전히 "**종료 신호가 아니므로 스트림·세션은 유지** — 이후 이벤트는 정상 처리된다" 라고 단정한다. 같은 문장이 SoT인 `spec/7-channel-web-chat/1-widget-app.md:106`("**종료 신호가 아니므로 스트림·세션은 유지**되며 이후 도착하는 이벤트는 정상 처리된다")에도 그대로 남아 있다(이 spec 파일은 이번 diff 범위 밖 — 직전 커밋 `436ee334e`에서 작성된 이후 갱신 안 됨, `git diff 436ee334e..e99f46145`로 미변경 확인). 두 서술 모두 이제는 **부분적으로만 참**이다(재조회 결과가 `waiting_for_input`/진행 중이면 유지, terminal 이면 정리+ENDED). 이 코드베이스는 spec을 "단일 진실"로 매우 엄격히 취급하고(이번 diff 자체가 그 문화의 산물), 정확히 이 지점에서 실질 버그가 있었다가 막 고쳐졌으므로, 향후 유지보수자가 이 주석/spec 문구를 근거로 "terminal 분기는 spec 위반" 이라 판단해 되돌리면 방금 고친 무기한 streaming 정지 버그가 재발할 위험이 있다.
  - 제안: 두 곳 모두 "종료 신호 자체는 아니지만, 재동기화 결과 execution 이 이미 terminal 이면 세션을 정리하고 ENDED 로 전이한다"는 조건부 서술로 정정. spec 쪽은 별도 developer follow-up 또는 project-planner 위임으로 §3.1 문구를 이번 fix 내용과 동기화할 것.

- **[INFO]** CHANGELOG.md 에 이 동작 변경(및 상위 ⑨ 기능 전체)에 대한 항목 없음
  - 위치: `/CHANGELOG.md` (58개 기존 `## Unreleased —` 항목 중 `replay_unavailable`/webchat 관련 항목 부재), 관련 커밋 `436ee334e`(기능 도입)·`e99f46145`(본 fix)
  - 상세: 이 리포는 사용자/호스트 관찰 가능한 동작 변경마다 CHANGELOG 에 상세 `## Unreleased` 섹션을 다는 관례가 매우 일관적이다(웹채팅 위젯 관련만도 6개 기존 항목 — carousel truncation, table truncation, EN locale, idle-wait reaper, "새 대화" coalesce, presentation truncation). `execution.replay_unavailable` 소비 배선(이전엔 완전 no-op 이던 SSE 이벤트가 이제 `GET status` 네트워크 호출 + 경우에 따라 `conversationEnded` 자동 발생을 유발)은 같은 급의 관찰 가능 동작 변경인데 항목이 없다. 본 fix 커밋 자체는 버그 수정이라 별도 항목이 필수는 아니나, 아직 "Unreleased" 상태인 상위 기능에 항목이 없으므로 릴리스 전 추가 시 이 terminal-handling 동작까지 포함해야 함.
  - 제안: 릴리스 노트 정리 시점에 `⑨` 배선(feat)과 이번 terminal fix 를 묶어 CHANGELOG 항목 1개로 등재 권장.

- **[INFO]** `seedWaitingFromStatus` JSDoc 요약 첫 줄이 함수의 확장된 책임을 반영하지 못함
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:219` ("`getStatus` REST 응답으로 현재 `waiting_for_input` 표면을 시드한다.")
  - 상세: 본문 중간의 "**종료 상태 처리**" 불릿(234-235행)에 terminal 분기가 문서화돼 있지만, 함수 목적을 한 줄로 요약하는 최상단 문장은 여전히 "waiting_for_input 표면 시드"로만 서술해 스캔 시 놓치기 쉽다.
  - 제안: 요약 줄을 "현재 표면을 시드하거나(waiting_for_input) 이미 종료된 execution 이면 ENDED 로 정리한다" 정도로 확장.

- **[INFO]** 신규 테스트 주석의 리뷰 세션 인용 포맷이 코드베이스 기존 관례(`ai-review YYYY-MM-DD`)와 다름
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:1196` (`(ai-review 01_42_44 requirement WARNING.)`)
  - 상세: 코드베이스 전반에 `// ai-review 2026-06-03`, `(ai-review 2026-06-21 ...)` 처럼 날짜 기반 인용 관례가 이미 자리잡혀 있다(`execution-engine.service.spec.ts`, `oauth-provider-strategy.spec.ts` 등). 이번 신규 주석은 날짜 없이 `01_42_44`(review 디렉토리의 시각 컴포넌트만) 로 인용해, 코드만 보고는 어느 날짜의 리뷰인지 특정할 수 없다.
  - 제안: `(ai-review 2026-07-17 01_42_44 requirement WARNING.)` 처럼 날짜를 포함해 기존 관례와 통일.

- **[NONE]** `webauthn.controller.spec.ts` 신규 `describe('webauthnList', ...)` — spec 교차참조(§5.2, `1-auth.md`) 와 `sessions.controller.spec.ts` 대칭성을 명시한 헤더 주석 품질 양호. 빈 배열 envelope 유지 케이스까지 커버.
- **[NONE]** RESOLUTION.md 의 테스트 통과 수 주장(`use-widget-eager-start.test.ts` 29 passed, `webauthn.controller.spec.ts` 10 passed) 을 직접 재실행해 검증 — 두 수치 모두 정확함(오래된/부정확한 문서화 아님).
- **[NONE]** `review/code/2026/07/17/01_42_44/**` (RESOLUTION.md·SUMMARY.md·9개 reviewer .md·meta.json·_retry_state.json) 신규 커밋 — CLAUDE.md 컨벤션(`review/code/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`)에 정확히 부합하는 산출물 보관이며 내용 자체도(교차검증 결과) 부정확한 서술 없음.

### 요약
이번 diff의 핵심(`use-widget.ts` terminal 분기 fix, webauthn `webauthnList` envelope pin 테스트, replay_unavailable 폴백 실패 soft-fail 테스트)은 JSDoc·인라인 주석이 코드 변경과 대체로 잘 동기화되어 있고 spec 교차참조도 정확하다. 다만 이번 fix가 "재동기화 결과가 terminal 이면 세션을 정리한다"로 동작을 바꿨음에도, 바로 인접한 `handleEiaEvent` 호출부 주석(178행)과 SoT인 `spec/7-channel-web-chat/1-widget-app.md:106`(diff 범위 밖, 직전 커밋에서 작성)이 여전히 "스트림·세션은 무조건 유지"라고 서술해 코드-문서 drift 가 생겼다 — 정확히 이 지점에서 방금 실질 버그를 고쳤다는 점에서 재발 위험이 있는 가장 중요한 발견이다. 그 외에는 CHANGELOG 미등재(상위 기능 전체 대상, 릴리스 전 정리 권장), JSDoc 요약 줄의 사소한 불완전성, 리뷰 인용 포맷 불일치 정도의 저위험 개선사항이며, 함께 커밋된 review/** 산출물의 사실관계(테스트 통과 수 등)는 직접 재실행으로 정확함을 확인했다.

### 위험도
LOW