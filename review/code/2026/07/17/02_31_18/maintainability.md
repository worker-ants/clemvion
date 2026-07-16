# 유지보수성(Maintainability) Review

## 검토 범위

prompt 에 포함된 19개 파일 중 실질 코드는 3개(파일 1~3)이며, 나머지(파일 4~18)는 직전 ai-review 라운드(`02_04_13`)의 산출물(RESOLUTION.md·SUMMARY.md·9개 reviewer md·meta.json·`_retry_state.json`)과 plan 체크리스트 갱신, 파일 19(`spec/7-channel-web-chat/1-widget-app.md`)는 spec 문서 갱신이다. 이번 분석은 실행 코드가 있는 파일 1~3에 집중하고, 문서·메타 산출물은 참조용으로만 대조했다.

## 발견사항

- **[WARNING]** `handleEiaEvent` 의 `execution.replay_unavailable` 분기 인라인 주석이 이번 fix 로 바뀐 실제 동작을 반영하지 못해 코드-내부 서술 간 모순 발생
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `execution.replay_unavailable` 분기 주석(`handleEiaEvent` 내부, "**종료 신호가 아니므로 스트림·세션은 유지** — 이후 이벤트는 정상 처리된다") vs 같은 파일의 `seedWaitingFromStatus` JSDoc "**종료 상태 처리**" 절, vs `spec/7-channel-web-chat/1-widget-app.md`(파일 19, 이번 diff 로 갱신됨)
  - 상세: 이번 diff 는 `seedWaitingFromStatus` 가 terminal 스냅샷을 만나면 `finalizeEnded`(teardown+ENDED+host 통지)를 수행하도록 동작을 확장했고, spec(`1-widget-app.md §3.1`)에는 "단, 스냅샷이 이미 terminal 이면 종료로 확정한다"는 예외를 정확히 반영했다. 그런데 이 예외를 트리거하는 호출부 바로 위, 같은 파일 안의 `execution.replay_unavailable` 분기 주석은 여전히 "종료 신호가 아니므로 스트림·세션은 **유지**" 라고 무조건 서술한다. 직전 라운드(`02_04_13`) 의 documentation reviewer 가 정확히 이 두 지점(인라인 주석 + spec)을 함께 지적했는데, spec 쪽만 수정되고 코드에 가장 가까운 인라인 주석은 그대로 남았다 — SoT 는 갱신됐지만 실제로 유지보수자가 먼저 마주치는 코드 주석은 여전히 잘못된 정보를 준다. 이 파일이 바로 "댓글을 믿고 되돌렸다가 무기한 streaming 정지 버그가 재발"할 위험이 실증된 곳이라는 점에서 재발 방지 효과가 반감된다.
  - 제안: `handleEiaEvent` 의 해당 주석을 "기본적으로 스트림·세션은 유지되나, `seedWaitingFromStatus` 재조회 결과가 이미 terminal 이면 `finalizeEnded` 로 종료 확정한다" 정도로 spec 문구와 동형화.

- **[WARNING]** "대화 종료" 공개 액션(`endConversation`)이 이번에 도입된 `finalizeEnded`/`endedRef` 1회 가드 체계에 편입되지 않고, 별도의 인라인 시퀀스 + 별도 가드(`state.phase === "ended"`)를 그대로 유지 — 동일 개념이 파일 내 두 갈래 메커니즘으로 분산
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `finalizeEnded`(신규 헬퍼, `endedRef` 로 1회 가드) vs `endConversation`(기존 공개 액션, `resetSessionRefs()` 호출 후 자체적으로 `dispatch({type:"ENDED"...})` + `bridgeRef.current?.sendEvent("conversationEnded",...)` 를 인라인 반복, 가드는 함수 최상단의 `if (state.phase === "ended") return;`)
  - 상세: RESOLUTION.md(W1 처분 근거)는 "공개 액션 `endConversation()` 이 이미 존재해 이름 충돌 → `finalizeEnded` 로 개명"이라고 명시해 이 함수의 존재를 인지하고 있었다. 하지만 이름 충돌만 피했을 뿐, 로직 자체는 통합하지 않았다 — 결과적으로 "대화를 종료 처리한다"는 동일한 3단계(teardown 계열 정리 → ENDED dispatch → host 통지)가 `finalizeEnded` 와 `endConversation` 두 곳에 여전히 각자 구현돼 있고, 중복 방지 메커니즘도 서로 다르다(`endedRef` boolean vs `state.phase` 검사). 게다가 `endConversation` 이 호출하는 `resetSessionRefs()` 는 `endedRef.current = false` 로 **되돌리면서**(새 대화 재시작을 위한 의도된 리셋) 곧바로 자체 `dispatch`/`sendEvent` 를 실행하므로, 이 경로를 거친 뒤에는 `state.phase === "ended"` 인데 `endedRef.current === false` 인 불일치 상태가 남는다. 현재는 이 상태에서 SSE 가 이미 닫혀 있고(`resetSessionRefs` → `teardownSession` 이 스트림을 먼저 닫음) fire-and-forget `seedWaitingFromStatus` 도 staleness 가드(`sessionRef.current !== session`)로 막히기 때문에 즉각적인 중복 통지로 이어지진 않는 것으로 보이나, 두 개의 서로 다른 "1회 종료" 불변식(ref 플래그 vs state 검사)이 같은 파일에 공존하며 서로의 존재를 모르는 구조는 향후 이 경로들을 수정할 때(예: `finalizeEnded` 를 다른 곳에서도 재사용하거나 가드 로직을 리팩터할 때) 다시 어긋나기 쉽다 — CRITICAL#1 이 바로 "함수 안에 넣으면 모든 호출부가 안전하다는 착각"에서 비롯됐다는 이번 라운드 자체의 교훈과 같은 패턴이다.
  - 제안: `endConversation` 도 `finalizeEnded(reason)` 을 호출하도록 통합하거나(가드용 “새 대화 시작 안 함” 등 `endConversation` 고유 로직은 유지하되 종료 3줄만 위임), 최소한 `endConversation` 이 자체 종료 시퀀스를 수행한 직후 `endedRef.current = true` 로 재설정해 두 가드 간 불변식을 맞출 것.

- **[INFO]** `ai-review` 인용 주석이 프로젝트 컨벤션(`ai-review YYYY-MM-DD`)과 달리 리뷰 라운드의 시각 컴포넌트만 사용해 날짜 추적이 안 됨 — 이번 diff 에서 재발·확산
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` 4곳(`(ai-review \`02_04_13\` W1)`, `CRITICAL#1`, `W2`, `CRITICAL#1 — ...`), `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:211`(`(ai-review 02_04_13 CRITICAL#1.)`) — 참고로 같은 파일 1240행의 `(ai-review 01_42_44 requirement WARNING.)` 도 동일 패턴으로 이전부터 잔존
  - 상세: 코드베이스 전반의 기존 관례는 `// ai-review 2026-06-03`, `(ai-review 2026-06-21 ...)` 처럼 날짜 기반이다(`execution-context.service.spec.ts`, `oauth-provider-strategy.spec.ts`, `cafe24-api.client.ts` 등에서 확인). 반면 이번 신규 주석들은 `review/code/<YYYY>/<MM>/<DD>/<hh_mm_ss>/` 디렉토리의 시각 컴포넌트(`02_04_13`)만 인용해, 코드만 보고는 어느 날짜의 리뷰인지 알 수 없다. 직전 라운드(`02_04_13`) 의 documentation reviewer 가 이미 동일 패턴(`01_42_44`)을 INFO 로 지적했으나 RESOLUTION.md 처분표에 반영되지 않았고, 이번 fix 커밋에서 같은 형식이 4곳 더 늘었다 — 저비용으로 고칠 수 있는 사안임에도 반복 확산 중.
  - 제안: `(ai-review 2026-07-17 02_04_13 W1)` 처럼 날짜를 포함해 기존 관례와 통일. 향후 유사 주석 작성 시 정형 템플릿(날짜+라운드 ID)을 습관화.

- **[INFO]** `seedWaitingFromStatus` JSDoc 최상단 한 줄 요약이 함수의 확장된 책임(terminal 처리)을 반영하지 못함 — 직전 라운드 INFO 그대로 잔존
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `seedWaitingFromStatus` JSDoc 첫 줄("`getStatus` REST 응답으로 현재 `waiting_for_input` 표면을 시드한다.")
  - 상세: 본문 중간의 "**종료 상태 처리**" 절에는 이번 diff 로 확장된 계약(반환값 `Promise<boolean>`, terminal 시 `finalizeEnded`)이 상세히 문서화돼 있지만, 스캔 시 가장 먼저 읽히는 요약 줄은 여전히 "표면 시드" 로만 서술한다. 함수가 이제 "시드 또는 종료 확정" 두 가지 책임을 갖는다는 점이 첫 줄만 봐서는 드러나지 않는다.
  - 제안: 요약 줄을 "현재 표면을 시드하거나, 이미 종료된 execution 이면 `finalizeEnded` 로 정리한다" 정도로 확장.

- **[INFO]** (긍정적 확인) `finalizeEnded` 추출은 중복 제거·계약 명시 양쪽에서 잘 설계됨
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:180-190`(정의), `handleEiaEvent`/`seedWaitingFromStatus` 두 호출부
  - 상세: 직전 라운드 W1(중복)·CRITICAL#1(계약 미명시)에 대한 정공법 대응이다. 기존 공개 액션 `endConversation()` 과 이름이 충돌할 뻔한 것을 사전에 인지해 `finalizeEnded` 로 개명한 점(RESOLUTION.md 명시), `Promise<boolean>` 반환으로 "이 호출이 종료를 유발했는가" 라는 암묵적 부작용을 타입 레벨에서 강제해 세 호출부(`start`/`applyConfig`/`replay_unavailable` 폴백)가 동일한 게이팅 패턴(`const ended = await ...; if (ended) return;`)을 반복하도록 만든 것은 가독성·일관성 모두에 긍정적이다. 다만 위 WARNING 이 지적하듯 `endConversation()` 자체는 이 개선의 수혜를 받지 못했다.

- **[INFO]** `useWidget` 훅의 단일 함수 비대화는 여전히 진행형(직전 라운드에서도 지적, 조치 보류 확인)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `useWidget` 함수 전체
  - 상세: 이번 diff 로 `endedRef`·`finalizeEnded`·staleness 가드·반환 게이팅 3곳이 추가되며 함수 스코프에 상태·계약이 계속 누적되고 있다. diff 자체의 신규 기여분은 작지만, 위 WARNING 두 건(주석-동작 불일치, 종료 로직 이원화)이 보여주듯 이 훅이 커질수록 "여러 지점에 흩어진 계약을 유지보수자가 전부 추적해야 하는" 위험이 커진다.
  - 제안: 즉시 조치 불필요. 이전 라운드가 제안한 `useEiaStream`(가칭) 분리 시 종료 판정·teardown 계약을 그 훅의 단일 진입점으로 강제하는 설계를 다시 권장.

- **[NONE]** `webauthn.controller.spec.ts` 신규 `describe`/`it` 블록, `use-widget-eager-start.test.ts` 신규 `it` 블록
  - 상세: 두 테스트 모두 같은 파일의 기존 관용구(mock 구성, assertion 스타일, `(init?.method ?? "GET") === "GET"` 판정 패턴, `NINETY_MIN_MS` 기존 상수 재사용)와 일관되며 매직 넘버·과도한 중첩·불필요한 반복이 없다.

## 요약

이번 diff 는 직전 라운드(`02_04_13`)의 CRITICAL(세션 복원 경로 무방비)과 WARNING(terminal 처리 중복)을 `finalizeEnded` 헬퍼 + `Promise<boolean>` 반환 계약으로 정공법 해결했고, 세 호출부 모두 동일한 게이팅 패턴을 따르게 만들어 구조적으로도 개선됐다 — 이름 충돌(`endConversation`) 회피 판단도 신중하다. 다만 그 개선이 완전히 마무리되지 않은 두 지점이 남아 있다: (1) `handleEiaEvent` 의 인접 인라인 주석이 이번에 확장된 실제 동작(terminal 시 종료 확정)을 반영하지 못해 spec 은 갱신됐지만 코드 내부 서술은 여전히 모순되고, (2) 기존 공개 액션 `endConversation()` 이 신규 `endedRef` 1회 가드 체계 밖에서 독자적인 종료 시퀀스·가드를 유지해 "종료 처리"라는 동일 개념이 파일 내 두 메커니즘으로 분산돼 있다. 두 항목 모두 즉각적인 버그로 이어진다는 확증은 없으나(다른 가드가 우연히 방어), 바로 이 패턴("함수 안에 넣으면 모든 호출부가 안전할 것"이라는 착각)이 이번 라운드 CRITICAL 의 근본 원인이었다는 점에서 재발 방지 관점의 실질 리스크로 판단해 WARNING 처리했다. 그 외 ai-review 인용 포맷 불일치는 직전 라운드 INFO 가 반영되지 않은 채 반복·확산되는 추세라 저비용 정리를 권장한다.

## 위험도

MEDIUM
