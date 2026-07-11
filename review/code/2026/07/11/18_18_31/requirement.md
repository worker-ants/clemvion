# 요구사항(Requirement) Review 결과

대상: `codebase/channel-web-chat/src/lib/widget-state.ts`, `codebase/channel-web-chat/src/widget/use-widget.ts`,
`codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`, `plan/in-progress/spec-draft-webchat-execution-residuals.md`,
`spec/7-channel-web-chat/1-widget-app.md`, `review/consistency/2026/07/11/17_54_21/**`(신규 리포트, review-only).

관련 spec: `spec/7-channel-web-chat/1-widget-app.md` §3.1/§R9(신규), `spec/5-system/14-external-interaction-api.md` §3.4 EIA-RL-07/§5.4/§R19.
관련 plan: `plan/in-progress/spec-draft-webchat-execution-residuals.md` (A: single-flight coalesce, B-1: best-effort cancel, B-2: 서버 idle-wait reaper는 후속 PR로 명시 이연).

검증: `pnpm`(vitest) `use-widget-eager-start.test.ts` 23/23 통과, 패키지 전체 `vitest run` 303/303 통과, `tsc --noEmit` 0 에러, `eslint` 대상 3파일 0 에러(기존 파일의 pre-existing warning 1건은 본 diff 무관 라인(L470, commit b9acf02c77)).

## 발견사항

- **[WARNING]** booting 중 coalesce 흡수 시 C1 보류 메시지 큐(`usePendingMessageQueue`)가 클리어되지 않아, 흡수 직전 큐된 텍스트가 "새" 세션으로 누수될 수 있음 — 미검증·미테스트 엣지 케이스
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `newChat()` L418-419 (`if (startedRef.current && !sessionRef.current) return;` 조기 반환)
  - 상세: `newChat()`은 booting 중(coalesce) 분기에서 `resetSessionRefs()` 호출 **이전에** 조기 `return`한다. `resetSessionRefs()` 내부의 `clearQueue()`(`use-pending-message-queue.ts` L35 docstring: "새 대화(newChat) 시 **이전 대화의 큐 누수 차단**용 폐기(I1)")가 이 경로에서 실행되지 않는다. 따라서 시나리오: 런처 추천질문 버블 클릭으로 텍스트가 큐(`pendingSendRef`)에 담긴 직후(C1, booting 구간) host `resetSession`이 도착해 coalesce되면, 큐된 텍스트는 폐기되지 않고 그대로 남아 흡수된(=새로 취급되는) 세션의 첫 `awaiting_user_message`(텍스트 표면) 도달 시 `submit_message`로 flush된다 — "새 대화"임에도 직전 텍스트가 새 대화로 넘어가는 결과. `spec/7-channel-web-chat/1-widget-app.md` §R9의 "host-facing 투명성" 단락은 "유일한 잔여 edge"로 booting 창 안 `updateProfile` 소급 불가 케이스만 명시하고 이 큐 누수 케이스는 언급하지 않는다 — spec이 스스로 "유일한 잔여 edge"라 주장하는 점과 실제 코드 동작 사이에 괴리가 있다. `R9-A` 테스트도 큐가 비어있는 상태만 검증해 이 상호작용을 커버하지 않는다.
  - 제안: coalesce 분기에서도 `clearQueue()`만 별도 호출(세션/gen/webhook 상태는 건드리지 않고 큐만 비움)하거나, 의도적으로 유지하기로 결정했다면 그 근거를 §R9 "host-facing 투명성"에 추가하고 회귀 테스트(C1+R9-A 결합 시나리오)를 추가할 것. 코드 fix 대상(WARNING) — 실수로 보이는 편이 강함(다른 정리 항목은 전부 `resetSessionRefs()`를 거치는데 이 경로만 예외적으로 우회).

- **[INFO]** `newChat()` JSDoc 중 coalesce 설명 문장이 다소 모호함 — 실질 버그는 아님
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` L627-628(JSDoc), 동일 문구가 파일 하단 함수 정의 직전에도 재등장(diff 특성상 중복 아님, 단일 위치)
  - 상세: "resetSessionRefs 가 start 가드를 재개방해 2번째 POST 를 발사하는 것을 막는다"라는 문장은 실제로는 "coalesce 조기 반환이 `resetSessionRefs` 호출 자체를 건너뛰어(따라서 가드 재개방이 일어나지 않아) 2번째 POST 발사를 막는다"는 의미인데, 주어-서술 구조상 "resetSessionRefs가 막는다"처럼 읽혀 실제 제어 흐름(코드는 `resetSessionRefs`를 **호출하지 않음**으로써 막음)과 반대로 오독될 소지가 있다.
  - 제안: "coalesce 조기 반환은 resetSessionRefs 호출(및 그에 따른 start 가드 재개방)을 건너뛰어 2번째 POST 발사를 막는다" 식으로 재구성하면 명확해짐. 비차단.

- **[INFO]** (spec fidelity, 회색지대) `spec/7-channel-web-chat/1-widget-app.md` §3.1/§R9가 서버측 idle-wait backstop(EIA-RL-07, B-2)을 이미 동작하는 회수 경로처럼 서술하지만, 본 PR(코드 diff)은 클라이언트측 A(coalesce)/B-1(cancel)만 구현하고 B-2(서버 reaper)는 `plan/in-progress/spec-draft-webchat-execution-residuals.md`에 "(PR-2) 서버 idle-wait reaper 는 후속"으로 명시적으로 이연됨
  - 위치: `spec/7-channel-web-chat/1-widget-app.md` §3.1 "새 대화" 행("서버측 idle-wait backstop … 회수한다"), §R9 B-1 문단
  - 상세: `spec/5-system/14-external-interaction-api.md` EIA-RL-07 항목은 우선순위가 "권장"(다른 "필수"·"(구현됨)" 표기 항목과 구분)으로 정확히 미구현 상태를 반영하고 있어 스펙 문서 자체는 정합하다. 다만 widget-app.md의 산문은 현재형("회수한다")으로 서술돼 있어, 이 PR만 놓고 보면 아직 실재하지 않는 서버 동작을 전제로 읽힐 수 있다. plan 문서(`spec-draft-webchat-execution-residuals.md`)의 developer 위임 메모에 PR-2 이연이 명시돼 있으므로 실제로는 계획된 격차이지 결함은 아님.
  - 제안: 별도 조치 불요(계획된 순차 배포). PR-2(서버 reaper) 미착수 상태에서 §3.1 문구가 오독을 유발한다면 후속 PR에서 "(Planned)" 각주 고려 가능 — 차단 사유 아님.

## 준수 확인 (참고 — 위반 아님)

- **A(coalesce) 판정 로직**: `startedRef.current && !sessionRef.current` 판정이 spec §R9 A 문구("판정 = `startedRef.current && !sessionRef.current`")와 line-level로 정확히 일치.
- **B-1(best-effort cancel) 순서**: `prevSession`/`client`를 `resetSessionRefs()` **이전에** 캡처 → cleanup → optimistic dispatch → best-effort `cancel`(`command:"cancel", reason:"user_new_chat"`) 발사 순서가 §R9 B-1·plan `구현 위임 메모`와 정확히 일치. `InteractCommand`(`eia-types.ts` L191-196) 타입도 `{command:"cancel", reason?}`를 지원해 타입 안전.
- **EIA §5.4 cancel 필드 정합**: `reason` optional 필드(§5.4 예시 `"reason": "user_aborted"`)와 위젯의 `reason: "user_new_chat"` 사용이 부합. `interact`의 `command:"cancel"`이 `/cancel` alias와 동치(EIA-IN-05)이므로 기존 `endConversation()`과 동일한 채널(`client.interact`)을 재사용하는 방식도 일관.
- **단일 게이트 구조**: `panel.tsx`의 헤더 "새 대화"(확인 후 `a.newChat()`)와 `[ended]` CTA(`CONFIRM_COPY.new.action`), host `resetSession`(`bridge.onCommand` → `apiRef.current.newChat()`)이 모두 동일한 `newChat()`을 거쳐 "모든 start 진입점이 단일 게이트를 통과한다"(§R9 A)는 spec 주장이 구조적으로 성립.
- **테스트 실제 검증**: `R9-A`(booting coalesce, 2번째 POST/interact 미발사, phase 유지)·`R9-B-1`(확립 세션발 cancel + 새 POST)·`R9-B-1 optimistic`(cancel 실패해도 재시작 진행) 3개 테스트가 실제로 `vitest run`에서 통과함을 직접 실행 확인(정적 리뷰만이 아님). 기존 `W7`(newChat 기본 케이스)도 `installFetch()`의 `/interact` 202 스텁 추가에 영향받지 않고 그대로 통과.
- **위젯 상태기계**: `widget-state.ts`의 `isActiveConversationPhase` JSDoc 갱신은 순수 주석 변경이며 로직(booting 제외 판정)은 무변경 — 실제 동작과 갱신된 설명이 일치.
- **TODO/FIXME/HACK/XXX**: 3개 diff 파일 전체에서 미검출.
- **에러 시나리오**: cancel 명령 실패는 `.catch()`로 흡수 후 `console.warn`만 남기고 로컬 재시작을 되돌리지 않음(optimistic) — §R9-B-1 "실패/거부해도 로컬 재시작을 되돌리지 않는다"와 일치. 타입 판별 없이 범용 실패 로깅이라 410/409/네트워크 모두 동일 처리되는 점도 spec의 "410/409/네트워크" 열거와 부합.

## 요약

핵심 비즈니스 로직(A: booting 중 host `resetSession` single-flight coalesce, B-1: 확립 세션발 "새 대화" best-effort cancel)은 `plan/in-progress/spec-draft-webchat-execution-residuals.md`의 결정 및 `spec/7-channel-web-chat/1-widget-app.md` §R9 신규 Rationale과 line-level로 정확히 일치하며, 새 테스트 3건은 실제 실행으로 통과가 확인됐고 `tsc`/`eslint`도 클린하다. 유일한 실질 결함 후보는 booting-coalesce 경로가 `resetSessionRefs()`(따라서 `clearQueue()`)를 건너뛰어, C1 보류 메시지 큐의 텍스트가 "새 대화"로 누수될 수 있는 미검증 엣지 케이스이며, 이는 spec이 "유일한 잔여 edge"로 명시한 항목(profile 소급)에 포함되지 않은 점에서 의도된 결정이라기보다 검토 누락에 가깝다. 그 외 서버측 idle-wait backstop(B-2/EIA-RL-07)이 spec 산문에서 현재형으로 서술되는 점은 plan 문서에 "후속 PR"로 명시 이연돼 있어 결함이 아니라 계획된 순차 배포다.

## 위험도

LOW
