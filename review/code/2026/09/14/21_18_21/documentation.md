# 문서화(Documentation) Review

## 검토 범위

실제 코드/plan 변경은 17개 파일(`origin/main...HEAD` 기준 110개 변경 파일 중 나머지 ~93개는
`review/code/**`·`review/consistency/**` 의 과거 라운드 산출물이며 이번에 새로 문서화 관점을
적용할 대상이 아니다 — 이미 그 자체가 리뷰 보고서다):

- `CHANGELOG.md`
- `codebase/backend/src/modules/hooks/hooks.service.ts` (+`.spec.ts`)
- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (신규, +`.spec.ts`)
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (+`.spec.ts`)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (+`.spec.ts`, `.web-chat.spec.ts`)
- `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` (신규)
- `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` (+spec, fixture)
- `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts` (신규)
- `plan/in-progress/trigger-config-lost-update.md`

전반적으로 이 PR 의 JSDoc/plan 문서화 밀도는 이 저장소 평균을 크게 웃돈다 — 설계 근거,
기각된 대안(Cafe24 advisory lock 선례), 라운드별 리뷰 처분 이력, 뮤테이션 실측까지 코드
주석·plan 에 촘촘히 남아 있다. 그 안에서도 다음 2건은 실제 코드 상태와 어긋나 있어 보고한다.

## 발견사항

- **[WARNING]** 고아(orphaned) JSDoc — `touchLastTriggeredAt` 위에 `markChatChannelRateLimited` 를 설명하는 옛 주석이 얹혀 있다
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:957`~`984` (docblock 957-961, 새 `touchLastTriggeredAt` JSDoc 962-977, 함수 정의 978-984), 그리고 실제 `markChatChannelRateLimited` 정의는 그 아래 `:986`
  - 상세: 이번 diff 가 `touchLastTriggeredAt` 헬퍼(+ 그 JSDoc)를 원래 `markChatChannelRateLimited` 바로 위에 있던 CCH-NF-03 docblock(`* CCH-NF-03 — per-chat 분당 rate-limit 초과 시 trigger 의 chat_channel_health 를 degraded 로 갱신 …`)과 그 함수 정의 **사이**에 끼워 넣었다. 그 결과 지금 파일 구조는:
    1. `:957-961` — "rate-limit 초과 시 degraded 로 갱신…" 을 설명하는 옛 docblock
    2. `:962-977` — 이번에 새로 추가한 `touchLastTriggeredAt` 용 docblock
    3. `:978-984` — `touchLastTriggeredAt` 함수 본문 (rate-limit 과 무관, `lastTriggeredAt` 만 갱신)
    4. `:986` — 실제 `markChatChannelRateLimited` 함수 정의 (지금은 **바로 위에 자신을 설명하는 docblock 이 없다**)

    즉 CCH-NF-03 docblock 이 지금 `touchLastTriggeredAt` 을 설명하는 것처럼 보이는 자리로 밀려났고(내용은 전혀 다른 함수 얘기), 정작 `markChatChannelRateLimited` 는 자기 설명 없이 남았다. 이 파일은 정확히 `chatChannel.inboundSigningRef` fail-open 을 다루는 보안 민감 모듈이고, 이 PR 자체가 "복제된 주석이 다음 결함을 문다"·"orphan JSDoc" 류의 위험을 여러 차례 스스로 지적해 온 맥락이라(`plan/in-progress/trigger-config-lost-update.md` §D 참조) 이 자리의 재발은 특히 아이러니하다. 5라운드에 걸친 이전 `/ai-review` documentation 리뷰(`18_17_44`~`20_49_15`)에서도 이 자리는 지적되지 않았다 — grep 으로 확인.
  - 제안: CCH-NF-03 docblock(`:957-961`)을 `markChatChannelRateLimited` 정의(`:986`) 바로 위로 옮기고, `touchLastTriggeredAt` 용 docblock(`:962-977`)은 그 함수 바로 위(`:978`)에만 남긴다.

- **[WARNING]** CHANGELOG 의 "대기 상한은 없다" 가 삭제 경로의 `lock_timeout` 예외를 언급하지 않는다
  - 위치: `CHANGELOG.md` — "## Unreleased — **Behavior change**: 동시 PATCH 가 인입 서명 ref 를 지워 fail-open 이 되던 경로를 닫는다" 절, 마지막 문단("**대기 상한은 없다** — …")
  - 상세: 이 문단은 "같은 트리거의 동시 요청은 앞선 요청이 커밋할 때까지 기다린다"·"그 제약이 깨지는 변경을 하면 `lock_timeout` 을 함께 넣어야 한다" 고 **일반적으로** 서술한다. 그런데 실제 구현(`codebase/backend/src/modules/triggers/trigger-config-lock.ts` `TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000`, `acquireTriggerConfigLock` 의 `options.timeoutMs`)은 **삭제(`DELETE /api/triggers/:id`) 경로에 한해 이미 5초 `SET LOCAL lock_timeout` 을 걸어 뒀다** — plan 문서(`plan/in-progress/trigger-config-lost-update.md` §D 5라운드 W2)도 "삭제 경로에만 `SET LOCAL lock_timeout = 5000ms`" 라고 명시한다. CHANGELOG 는 바로 두 문단 앞에서 삭제 락을 별도로 언급하면서도("삭제(`DELETE /api/triggers/:id`)도 같은 락을 잡는다") 그 삭제 락에 상한이 있다는 사실은 빠뜨려, "대기 상한은 없다" 를 읽는 사람이 삭제 요청도 무한정 기다린다고 오해할 수 있다. DELETE 가 락 경합 시 타임아웃 에러로 실패할 수 있다는 것 자체가 클라이언트 관점에서 새로운 동작(behavior change)이라 CHANGELOG 가 다뤄야 할 내용이다.
  - 제안: "대기 상한은 없다" 문단에 "단, 되돌릴 수 없는 정리(teardown)를 이미 마친 삭제 경로는 예외로 5초 `lock_timeout` 을 둔다" 한 줄을 추가하거나, 그 문단 앞에 이미 있는 삭제 관련 문장에 타임아웃 사실을 합쳐 적는다.

## 그 외 확인 항목 (문제 없음)

- `trigger-config-lock.ts`·`rewriteTriggerConfigLocked`·`triggers.service.ts` 의 JSDoc 은 실제 구현(스프레드 순서, `!fresh` 처리, 창 1/2/3/4 배선, Cafe24 기각 선례 인용)과 코드를 대조한 결과 전부 일치한다.
- `extractInboundSigningRef` JSDoc 이 "세 자리 복제" 라고 서술한 것을 `grep` 으로 실측 — 정의 자리를 빼면 정확히 3개 호출부(`chat-channel-binder.service.ts`, `triggers.service.ts` 2곳)와 일치한다.
- `endpoint-path-conflict-wrap-guard.ts` 의 `TRIGGER_ENTITY`·콜백 경계 주석은 실제 조건식(`ts.isFunctionLike(cur) && !ts.isCallExpression(cur.parent)`, `first.getText(sf) === TRIGGER_ENTITY`)과 정확히 대응한다.
- `trigger-transaction-mock.ts` 의 "이 수는 시점 의존이다" 각주는 스스로 낡을 수 있음을 미리 인정해 뒀다 — 좋은 관행.
- `hooks.service.spec.ts` 의 두 신규 회귀 테스트 docstring(부재 단언 + 형태 단언)은 실제 단언 코드와 1:1 대응한다.
- API 문서: 컨트롤러·DTO·라우트 변경이 없어 OpenAPI/swagger 갱신 불필요 (`api_contract.md` 과거 라운드와 동일 결론, 재확인).
- README/설정 문서: 신규 환경변수·설정 옵션 없음(모두 코드 내부 상수). 새 모듈 README 요구 관례 없음.
- 예제 코드: 내부 동시성 버그 수정이라 별도 사용 예제 불필요 — e2e 스펙 자체가 재현/검증 예제 역할을 겸한다.

## 요약

이 PR 의 문서화 수준은 예외적으로 높다 — 새 유틸리티(`trigger-config-lock.ts`)의 JSDoc 은 설계 근거·기각된 대안·트레이드오프·라운드별 리뷰 처분을 전부 코드에 남기고, plan 문서는 다섯 라운드에 걸친 실측·반증·정정 이력을 투명하게 기록한다. 다만 이번 라운드에서 두 가지 실제 불일치를 새로 확인했다: (1) `hooks.service.ts` 에서 `touchLastTriggeredAt` 추출 과정에서 `markChatChannelRateLimited` 를 설명하던 옛 docblock 이 새 함수 위로 밀려나 지금은 엉뚱한 함수를 설명하는 고아 주석이 됐고, 정작 `markChatChannelRateLimited` 자신은 설명을 잃었다. (2) CHANGELOG 의 "대기 상한은 없다" 는 일반 서술이 실제로 존재하는 삭제 경로의 5초 `lock_timeout` 예외를 언급하지 않아, CHANGELOG 만 읽는 독자에게 구현보다 넓은 보장으로 읽힐 수 있다. 둘 다 기능적 결함은 아니고 한두 줄 수정으로 해소되는 문서 정확성 문제다.

## 위험도

LOW
