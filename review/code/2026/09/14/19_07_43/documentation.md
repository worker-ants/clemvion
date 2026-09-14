# 문서화(Documentation) Review

## 검토 범위

이번 diff 는 `trigger.config` 동시 PATCH lost-update(창 넷)를 advisory lock + 락 안
재읽기로 닫는 수정과, 이전 두 리뷰 라운드(`review/code/2026/09/14/18_17_44`,
`review/consistency/2026/09/14/17_10_16`)가 지적한 항목의 반영분이다. 실제 코드
변경 파일(1~12번)과 `plan/in-progress/trigger-config-lost-update.md`, `CHANGELOG.md`
를 실측 대조했다. 13번 이후(`review/**` 산출물)는 이전 라운드의 감사 이력 커밋이라
문서화 관점 재검토 대상이 아니다(그 자체가 이미 리뷰 산출물).

이전 라운드 `documentation.md`(WARNING 2건 + INFO 1건)가 이번 diff 에서 어떻게
처리됐는지부터 실측했다.

## 이전 라운드 지적사항 처리 확인

- **CHANGELOG 누락 (WARNING)** → **해소**. `git show 567c82edb:CHANGELOG.md` 에는
  이 항목이 없었고, 마지막 커밋 `12ed21ff1` 에서 `## Unreleased — **Behavior
  change**: 동시 PATCH 가 인입 서명 ref 를 지워 fail-open 이 되던 경로를 닫는다`
  항목이 추가됐다. 서술("네 자리 전부", "외부 provider 호출은 락 밖")이 최종 코드
  상태(창 1 포함 4곳 전부 배선 완료)와 정확히 일치한다. 인용 코드
  (`if (!config.inboundSigningRef) return;`)도
  `chat-channel-inbound-authenticator.ts:64`(등 3곳)와 실측 일치.
- **`15-chat-channel.md` `code:`/§7 열거 누락 (WARNING)** → `spec/` 은 developer
  쓰기 권한 밖이라 코드로 해소할 수 없는 항목이고, plan §D 표
  (`spec/5-system/15-chat-channel.md` 의 `code:` glob 이 `trigger-config-lock.ts` 를
  안 문다 — requirement W5)에 planner 후속으로 정확히 등재돼 있다. 처리 방식 적절.
- **`trigger-config-lock.ts` 에 지배 plan 포인터 부재 (INFO)** → **부분 해소**.
  파일 상단에 `// 상위 plan: plan/in-progress/trigger-config-lost-update.md — 창
  넷의 실측, 설계 근거, ...` 포인터가 추가됐다. 다만 제안됐던 정확한 문구
  ("창 1 은 의도적으로 미배선 — 이유는 `triggers.service.ts` `update()` 주석")까지는
  옮겨지지 않았다 — 아래 INFO 참조.

## 발견사항

- **[INFO]** `trigger-config-lock.ts` 의 "네 자리" 서술이, 이 파일을 단독으로 열어본
  독자에게 "이 함수가 네 곳 전부에서 쓰인다"는 인상을 줄 수 있다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` — `rewriteTriggerConfigLocked` JSDoc의 "## 왜 필요한가" 절 ("네 자리가 «읽기 → (외부 호출) → 쓰기» 를...")
  - 상세: 실제로 `rewriteTriggerConfigLocked` 를 호출하는 곳은 3곳뿐이다
    (`chat-channel-binder.service.ts` 성공/실패 경로 2곳, `triggers.service.ts`
    `rotateBotToken` 1곳 — `grep -n rewriteTriggerConfigLocked` 로 실측). 창 1
    (`triggers.service.ts` `update()` 의 `save` 경로)은 `save()` 시맨틱을 지키기
    위해 같은 lock key 로 **자체 `transaction`+`query` 를 인라인** 한다(별도
    코드 리뷰 항목 아님 — 이미 잘 설명돼 있음). 이 파일의 JSDoc 은 "네 자리"라는
    배경 설명(문제의 범위)과 "이 함수가 배선된 자리"를 구분 없이 이어 써서, 이
    함수의 호출부를 grep 한 독자가 "3곳뿐인데 왜 넷이라고 했지?"라고 다시
    확인하게 만들 수 있다. 이전 documentation 라운드가 정확히 이 혼동을 겨냥해
    "창 1 은 의도적으로 미배선"이라는 명시적 각주를 제안했었는데, 이번에 추가된
    포인터 주석(줄 20~22)은 plan 문서로 안내는 하지만 "3/4만 배선"이라는 사실
    자체는 여전히 이 파일 안에서 직접 드러나지 않는다.
  - 제안: `rewriteTriggerConfigLocked` JSDoc 에 한 줄 추가 — 예: "배선: 창
    2·3·4(binder 성공/실패, rotateBotToken). 창 1(`update()` 의 `save`)은 이
    함수를 쓰지 않는다 — 이유는 `triggers.service.ts` `update()` 의 주석." 이미
    거의 다 돼 있어 우선순위는 낮다.

- **[INFO]** 창 1 을 닫은 종결 커밋인데도 원 트래커 항목과 이 plan 자신의 마지막
  체크리스트 항목이 아직 `[ ]` 로 남아 있다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:2278`
    (`- [ ] **동시 PATCH 가 \`trigger.config\` 를 잃을 수 있다 (lost update)...**`)
    및 `plan/in-progress/trigger-config-lost-update.md` 의 `## 체크리스트` 마지막 줄
    (`- [ ] 트래커 항목 [x] + 실측 각주 (창이 넷이었다는 정정 포함)`)
  - 상세: 이전 documentation 라운드(`review/code/2026/09/14/18_17_44/documentation.md`)
    는 이 두 미체크를 "결함 아님 — 종결 커밋 시점에 함께 갱신하기로 명시됨"으로
    처분했다. 마지막 커밋 메시지(`12ed21ff1 fix(triggers): 창 1 도 닫는다 —
    ...`)의 문구로 볼 때 이 라운드가 그 "종결 시점"에 해당할 가능성이 높은데,
    실측 결과 두 체크박스 모두 여전히 `[ ]` 다(작업물 자체는 완결 — 실측 각주
    내용은 plan 본문 §D 에 이미 다 적혀 있고 남은 것은 트래커 원본에 옮겨 적는
    사무적 동기화뿐). 이 상태로 `plan/complete/` 로 이동하면 `feedback_plan_checkbox_actual_state`
    교훈("체크와 complete/ 이동은 한 동작")과 어긋난다.
  - 제안: 이 라운드가 최종 라운드라면, `plan/complete/` 이동 전에 (a)
    `spec-draft-nullable-notation-followups.md:2278` 을 `[x]` + "창이 넷이었다"
    각주로 갱신하고 (b) 이 plan 의 마지막 체크박스도 `[x]` 로 닫는다. 아직
    후속 라운드가 예정돼 있다면 지금은 정보성 기록으로 충분하다.

## 그 밖에 확인했지만 문제 없음으로 판정한 것 (오탐 방지 기록)

- `trigger-transaction-mock.ts` 의 "provider 는 6개 파일에 흩어져 있다" 서술 —
  실측(`grep -rl getRepositoryToken(Trigger) **/*.spec.ts`)으로 정확히 6개 파일
  확인. 그중 `TriggersService` 를 실제로 인스턴스화하는 2개 파일(`triggers.service.spec.ts`,
  `triggers.web-chat.spec.ts`)만 `withTransactionMock` 을 적용했고, 나머지 4개
  (`interaction.controller.spec.ts`·`schedules.service.spec.ts`·`hooks.service.spec.ts`·
  `auth-configs.service.spec.ts`)는 `TriggersService` 를 아예 쓰지 않아
  `.manager.transaction` 경로에 진입하지 않는다 — 문서 서술이 "6곳 다 고쳐야
  한다"가 아니라 "6곳에 흩어져 있어 향후 검색 범위로 알아 둬야 한다"는 뜻이었고,
  실제 처리 범위와 모순되지 않는다.
- `rewriteTriggerConfigLocked` 의 `@returns false` 서술("호출부는 무시") —
  3개 호출부(`chat-channel-binder.service.ts` x2, `triggers.service.ts`
  `rotateBotToken` x1) 전부 `await rewriteTriggerConfigLocked(...)` 로 반환값을
  캡처하지 않아 서술과 일치. (반환값 미사용 자체는 plan §D 후속 표에 INFO#2 로
  이미 등재돼 있어 별도 지적 아님.)
- CHANGELOG 항목의 코드 인용·수치("네 자리", `pg_advisory_xact_lock(hashtext(...))`,
  Cafe24 기각 사유 인용)는 전부 실측 대조에서 현재 코드와 일치.
- `plan/in-progress/trigger-config-lost-update.md` §D 의 "유예했다가 되돌렸다"
  절은 원문을 취소선(`~~...~~`)으로 남기고 정정 사실·근거(리뷰 CRITICAL#1)를
  옆에 적는 자기-반증형 정정 관례를 정확히 따른다 — 위반 아님.
- `trigger-config-lock.spec.ts`·e2e spec 의 서두 docstring(대응표·판별 조건·왜
  telegram 인가)은 실제 테스트 바디와 1:1 대조에서 어긋남을 찾지 못했다.
- `endpoint-path-conflict-wrap-guard.ts` 의 `TRIGGER_ENTITY`/콜백 경계 관련 JSDoc
  은 실제 구현 조건(`ts.isFunctionLike(cur) && !ts.isCallExpression(cur.parent)`)과
  일치.

## 요약

이번 diff 의 문서화 수준은 이례적으로 높다 — JSDoc 마다 "왜"(설계 근거·기각된
대안·실측 수치·뮤턴트 결과)를 남기고, 이전 두 리뷰 라운드가 지적한 CHANGELOG
누락과 spec 열거 누락을 정확한 방식(전자는 직접 수정, 후자는 권한 밖이므로
planner 백로그 등재)으로 처리했다. 남은 것은 사실상 사무적 마무리 두 건 —
`trigger-config-lock.ts` 의 "네 자리" 배경 설명과 "3곳만 배선" 사실의 경계를
한 줄 더 명확히 하는 것, 그리고 종결 커밋 이후 원 트래커·plan 체크리스트의
잔여 `[ ]` 를 닫는 것 — 뿐이며 둘 다 INFO 수준이다.

## 위험도

LOW
