# 문서화(Documentation) 리뷰 결과

## 발견사항

- **[WARNING]** CHANGELOG 미갱신 + 기존 항목 stale화(behavior 서술이 이번 수정으로 사실과 어긋남)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/llm-usage-doc-alignment-01d7a4/CHANGELOG.md` L70 (PR #874 항목) — 본 변경분(`codebase/channel-web-chat/src/widget/use-widget.ts` `newChat`)에는 CHANGELOG 신규 항목 없음
  - 상세: 이 프로젝트는 사용자 관측 가능한 동작 변경에 대해 `CHANGELOG.md` 에 "Unreleased" 섹션으로 상세 항목을 남기는 확립된 컨벤션을 쓰고 있다(같은 파일의 `variables.__*` 강제, presentation truncation 수정, KB WS drift 등 최근 항목 다수가 이 패턴). 특히 CHANGELOG L70 은 PR #874 당시 "새 대화"는 저장 세션/스트림을 정리하고 새 execution 을 시작한다(**이전 execution 은 명시 종료 없이 서버에서 `waiting_for_input` 잔존, 토큰만 TTL/idle 만료**)"라고 명시적으로 서술한다. 그런데 이번 diff(`use-widget.ts` `newChat`)는 정확히 이 동작을 고쳐 확립 세션발 "새 대화" 시 이전 execution 에 best-effort `cancel` 을 발사하도록 바꿨다(§R9-B-1, spec `1-widget-app.md` §3.1 "새 대화" 행에도 반영됨). 즉 CHANGELOG L70 의 서술이 현재 코드와 모순되는 stale 정보가 됐고, 이번 fix 자체는 CHANGELOG 에 전혀 등재되지 않았다. release note 소비자·후속 개발자가 CHANGELOG 만 보고 "새 대화는 여전히 이전 execution 을 방치한다"고 오인할 수 있다.
  - 제안: CHANGELOG 에 신규 "Unreleased" 항목을 추가해 (A) booting 중 host `resetSession` single-flight coalesce, (B-1) 확립 세션발 "새 대화" best-effort `cancel` 을 요지·SoT(`spec/7-channel-web-chat/1-widget-app.md §R9`)와 함께 기술하고, 필요하면 L70 항목에 "이 동작은 이후 PR(§R9)에서 정정됨" 각주를 남긴다.

- **[WARNING]** JSDoc 인과관계 서술이 실제 코드 흐름과 어긋나 혼동 소지
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/llm-usage-doc-alignment-01d7a4/codebase/channel-web-chat/src/widget/use-widget.ts` L407-411 (`newChat` JSDoc "A. single-flight coalesce" 단락), 대응 코드 L419-420
  - 상세: JSDoc 은 "... in-flight `start()` 에 **흡수**한다 — resetSessionRefs 가 start 가드를 재개방해 **2번째 POST 를 발사하는 것을 막는다**" 라고 쓰여 있다. 그러나 실제 코드는 `if (startedRef.current && !sessionRef.current) return;` 로 **조기 return** 해 이 분기에서는 `resetSessionRefs()` 가 아예 호출되지 않는다(L420 직후 return, `resetSessionRefs()` 는 L423 이후에만 실행). 즉 "resetSessionRefs 가 start 가드를 재개방해 ... 막는다"는 문장은 (a) resetSessionRefs 는 이 경로에서 호출되지 않고, (b) 설령 호출됐다면 가드를 "재개방"하는 것은 오히려 2번째 POST 를 **허용**하는 방향이라 "막는다"와 인과가 뒤집혀 있다. 실제 의미는 "이 조기 return 이 resetSessionRefs 호출(및 그로 인한 start 가드 재개방)을 건너뛰게 해 2번째 POST 를 막는다"일 것으로 추정되나, 현재 문구만으로는 반대로 읽힐 수 있어 동시성에 민감한 이 가드를 수정할 후속 개발자를 오도할 위험이 있다.
  - 제안: 예) "in-flight `start()` 에 **흡수**한다 — 조기 return 이 `resetSessionRefs()`(가 호출됐다면 start 가드를 재개방했을 것) 실행 자체를 건너뛰게 해 2번째 POST 발사를 막는다" 처럼 인과 순서를 명확히 재서술.

- **[INFO]** plan 체크리스트 상태가 실제 구현 완료도와 다소 어긋날 가능성
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/llm-usage-doc-alignment-01d7a4/plan/in-progress/spec-draft-webchat-execution-residuals.md` L1604-1605
  - 상세: "developer 위임: (PR-1) 위젯 single-flight coalesce + 새 대화 cancel **착수**" 로 `[~]`(부분 완료) 표시돼 있으나, 본 리뷰 대상 diff 는 `widget-state.ts`/`use-widget.ts` 구현 + `use-widget-eager-start.test.ts` 신규 테스트 3건(R9-A, R9-B-1 ×2)까지 포함해 기능적으로는 완결된 상태로 보인다("착수"라는 표현이 실제 진행도를 과소평가할 수 있음). 사용자 메모리 관례상 "plan 체크박스 = 실제 상태" 원칙과 대조하면, PR-1 완료 후 커밋 시점에 `[x]`로 갱신하거나 "구현 완료·리뷰 대기"로 문구를 정정하는 편이 낫다.
  - 제안: 이 diff 를 커밋하는 시점에 plan 체크박스/문구를 실제 구현 완료 상태에 맞춰 갱신.

- **[INFO]** `reason` 필드 신규 예시값(`"user_new_chat"`) spec 미기재
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/llm-usage-doc-alignment-01d7a4/codebase/channel-web-chat/src/widget/use-widget.ts` L428, 대비 `/Volumes/project/private/clemvion/.claude/worktrees/llm-usage-doc-alignment-01d7a4/spec/5-system/14-external-interaction-api.md` L489
  - 상세: EIA §5.4 `cancel` 명령의 `reason` 필드는 자유 문자열(`reason?: string`)이고 spec 은 예시로 `"user_aborted"` 하나만 보여준다. 이번에 위젯이 `reason: "user_new_chat"` 값을 신규로 실어 보내는데, 이는 닫힌 union 이 아니므로 계약 위반은 아니지만 진단/로그 분석 시 위젯이 실제로 어떤 reason 값들을 보내는지 spec 에서 한눈에 알기 어렵다.
  - 제안: 필수는 아니나, EIA §5.4 예시 목록에 `user_new_chat`/`user_ended` 등 위젯이 실제로 보내는 reason 값을 병기하면 운영 로그 판독에 도움.

## 요약

이번 변경분은 문서화 관점에서 전반적으로 우수하다 — `use-widget.ts`의 `newChat` JSDoc 은 A(coalesce)/B-1(cancel) 결정을 상세히 설명하고, `widget-state.ts` 의 `isActiveConversationPhase` 독스트링도 새 동작(coalesce 가 UI 게이팅의 booting 제외 필요성을 어떻게 완결하는지)을 정확히 갱신했으며, 신규 테스트에도 §R9-A/§R9-B-1 참조 주석이 붙어 있다. spec(`1-widget-app.md`) 도 §3.1 표·§R9 Rationale 을 동시에 갱신해 코드-스펙 정합이 잘 유지된다. 다만 (1) 프로젝트 컨벤션상 이런 사용자 관측 가능 동작 변경은 `CHANGELOG.md`에 등재돼야 하는데 누락됐고, 기존 PR #874 항목(L70)이 이번 fix 로 인해 사실과 어긋나는 stale 서술이 됐다는 점, (2) `newChat` JSDoc 의 coalesce 인과 설명 한 문장이 실제 코드 흐름과 논리적으로 어긋나 혼동을 유발할 수 있다는 점은 조치가 필요하다. 두 사항 모두 기능 자체에는 영향이 없는 문서 정확성 이슈다.

## 위험도
MEDIUM
