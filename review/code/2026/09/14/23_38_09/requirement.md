# 요구사항(Requirement) Review — trigger-config-lost-update (10라운드째)

## 검토 방법

`plan/in-progress/trigger-config-lost-update.md` 가 9라운드 리뷰 이력을 상세히 기록하고 있어,
이번 라운드는 (a) 직전 라운드(`review/code/2026/09/14/23_01_18`)가 지적한 **Critical#1**
(`cleanupRotatedChatChannelTokens` 전환 후 동작 테스트 0건)과 **W1**(`rotateBotToken` 의
`chatChannel` 스냅샷 대입 — 같은 클래스의 네 번째 자리)이 최신 커밋(`833bb745a`)에서 실제로
닫혔는지, (b) 그 수정이 새 결함을 만들지 않았는지, (c) CHANGELOG·plan 서술과 코드가
line-level 로 계속 일치하는지를 직접 코드를 읽어 대조했다.

- `codebase/backend/src/modules/triggers/triggers.service.ts`(1608줄) 전체, `trigger-config-lock.ts`,
  `chat-channel-binder.service.ts`, `hooks.service.ts`, `schedules.service.ts` 를 Read 로 직접
  열어 `save(`/`update(`/`rewriteTriggerConfigLocked` 호출부를 전수 확인했다(grep 으로 위치
  특정 후 각 함수 본문을 읽음).
- `833bb745a` 의 diff(`git show`)를 직접 확인 — `rotateBotToken` 이 `mergeIntoFreshSubKey` 로
  전환됐고, `cleanupRotatedChatChannelTokens`/`promoteRotatedNotificationSecrets`(skip 시 미카운트)
  에 대한 동작 테스트가 실제로 추가된 것을 `triggers.service.spec.ts` diff 에서 확인했다.
- `trigger-config-lost-update.e2e-spec.ts`, `trigger-config-lock.spec.ts`,
  `trigger-transaction-mock.ts` 를 전문 Read.
- 관련 spec 3곳(`spec/2-navigation/4-integration.md:1444` Cafe24 advisory lock 기각 선례,
  `spec/5-system/15-chat-channel.md`, `spec/conventions/chat-channel-adapter.md`)을 grep/Read 로
  대조.
- 리뷰 중 저장소 파일을 수정하지 않았다 (`git status --short` 로 확인 — 잔여 변경은 이번
  리뷰 산출물 디렉터리뿐).

## 발견사항

- **[INFO]** 직전 라운드 Critical/Warning 은 실제로 닫혔다 — 코드로 재확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `rotateBotToken`(`mergeIntoFreshSubKey` 호출부), `cleanupRotatedChatChannelTokens`
  - 상세: `rotateBotToken` 의 `chatChannel` 병합이 스냅샷 통째 대입(`{ ...freshConfig, chatChannel: mergedChannel }`)에서 `mergeIntoFreshSubKey(freshConfig, 'chatChannel', mergedChannel, mergedChannel)` 로 바뀌어, 재읽은 행에 있고 `mergedChannel` 에는 없는 필드(`rateLimitPerMinute`·`uiMapping`·`languageLocale` 등)가 살아남는 것을 코드로 확인했다. `cleanupRotatedChatChannelTokens` 호출 경로(`triggers.service.spec.ts` 신규 테스트 `'cleanupRotatedChatChannelTokens — 컬럼만 쓰고 config 는 건드리지 않는다'`)도 `Object.keys(patch)` 를 `['chatChannelRotatedAt', 'chatChannelTokenV2']` 로 좁혀, 정적 래칫(`.save(` 만 세는 가드)이 못 보는 `.update(` 내용물 회귀를 잡도록 배선됐다. 코드가 CHANGELOG·commit 메시지가 주장하는 그대로다.
  - 제안: 없음(확인 목적).

- **[INFO]** spec fidelity — 이번 변경을 직접 정의하는 spec 요구사항 ID 없음, 락 설계는 기존 spec 의 기각 선례를 정확히 준수
  - 위치: `spec/2-navigation/4-integration.md:1444` (Cafe24 `pg_advisory_xact_lock` 기각 사유) vs `codebase/backend/src/modules/triggers/trigger-config-lock.ts` JSDoc + `chat-channel-binder.service.ts:243-321` + `triggers.service.ts:1269-1327`
  - 상세: `trigger.config` 동시성 전략(advisory lock 트랜잭션 단위·재읽기 시점·부재 처리)은 API 계약/요구사항 ID 로 spec 에 명세된 대상이 아니라 내부 구현 세부사항이다. 유일한 교차 참조 spec 본문(*"lock 보유 중 HTTP 요청을 transaction 안에 묶으면 DB 커넥션 점유 시간이 늘어난다"*)을 인용은 정확하고(문구 대조 완료), 실제 구현도 외부 `adapter.setupChannel`/`teardownChatChannel` 호출을 락 **밖**에서 끝낸 뒤에만 락을 잡도록 되어 있어 그 제약을 지킨다. `chatChannel.rateLimitPerMinute`/`uiMapping`/`languageLocale`/`inboundSigningRef` 등 필드명도 `spec/conventions/chat-channel-adapter.md`·`spec/5-system/15-chat-channel.md` 의 실제 `ChatChannelConfig` 정의와 일치한다. spec 불일치·spec drift 없음.
  - 제안: 없음(확인 목적, `plan` frontmatter 의 `spec_impact: none` 판정이 타당함을 재확인).

- **[INFO]** 남은 후속 백로그 항목들은 이번 PR 스코프 밖으로 이미 트리아지·문서화됨 — 새 지적 아님
  - 위치: `plan/in-progress/trigger-config-lost-update.md` §후속(developer 범위) 표 — `SchedulesService.update()` 의 trigger 컬럼 동기화가 락 도메인 밖, `cleanupRotatedChatChannelTokens` 의 무조건 null-write(동시 `rotateBotToken` 의 새 v2 회전을 지울 수 있음), `rotateNotificationSecret` 이 락 도메인 밖, `update()` 응답의 read-after-write 불일치
  - 상세: 이 항목들을 코드에서 직접 확인했다 — 예컨대 `cleanupRotatedChatChannelTokens`(`triggers.service.ts:1487-1493`)는 조건 없이 `{ chatChannelTokenV2: null, chatChannelRotatedAt: null }` 을 쓰므로, cron 이 후보를 조회한 직후 같은 트리거에 대해 `rotateBotToken` 이 새 v2 를 커밋하면 그 값을 지울 수 있다. 이 PR 이 닫는 것은 "동시 `config` 쓰기가 `inboundSigningRef` 를 지워 인입 서명 fail-open 을 만드는" 클래스이고, 이 항목은 그 클래스가 아니라(보안 영향 없음, grace window 정리 타이밍 문제) 별도 클래스라 plan 이 근거와 함께 후속으로 명시 등재했다. 이번 라운드에서 새로 발견한 것이 아니라 기존 트리아지가 여전히 타당함을 재확인.
  - 제안: 조치 불요(이번 PR 범위 밖, 이미 추적됨).

## 관점별 확인 (요약)

- **기능 완전성**: `save(entity)` 로 기존 행을 통째로 재저장하는 자리는 프로덕션 코드 전체에서 0건(신규 INSERT 2건 + 창 1 의 락 안 `m.save` 만 남고, 그 저장 대상은 락 안 재읽은 최신 행)이며 `endpoint-path-conflict-wrap.spec.ts` 의 `EXPECTED_UNWRAPPED_TRIGGER_SAVES: readonly string[] = []` 가 이를 정적으로 래칫한다.
- **엣지 케이스**: `config` null/undefined 좁힘(둘 다 개별 테스트), 락 안 재읽기 시점 행 삭제(`!fresh → false`, merge 콜백도 호출 안 함), 삭제 경로 5초 락 타임아웃 초과 시 로그+예외 전파가 각각 전용 유닛으로 커버된다.
- **TODO/FIXME/HACK/XXX**: `git diff origin/main...HEAD -- codebase/` 전체에서 0건.
- **의도-구현 괴리**: `touchLastTriggeredAt`·`extractInboundSigningRef`·`mergeIntoFreshSubKey`·`TRIGGER_ENTITY`(가드) 등 신규 심볼의 JSDoc 과 실제 동작이 일치한다.
- **에러 시나리오**: 동기 요청 창(창 1·`revokePerTriggerToken`·`rotateBotToken`)은 삭제 경합 시 404, best-effort 후속(binder 성공/실패)은 `false` 로 조용히 skip — 그 판단 기준(`trigger-config-lock.ts` JSDoc 표)과 실제 호출부 분기가 일치.
- **반환값**: `rewriteTriggerConfigLocked` 는 모든 경로에서 `boolean` 반환, 세 동기 호출부가 이를 분기에 사용, `promoteRotatedNotificationSecrets` 도 이번 라운드에서 `if (wrotePromotion) promoted++` 로 정정되어 쓰기 skip 을 거짓 카운트하지 않는다.
- **비즈니스 로직**: CHANGELOG 가 서술하는 "config 를 다시 쓰는 11개 자리"(원 4개 + 추가 7개)와 실제 코드의 write-site 분류(`rewriteTriggerConfigLocked` 사용 5곳 vs 컬럼 한정 `update()` 6곳)가 정확히 일치.

## 요약

직전 라운드(`23_01_18`)가 지적한 Critical#1(전환만 하고 테스트 없던 `cleanupRotatedChatChannelTokens`)과 W1(같은 클래스의 네 번째 자리 — `rotateBotToken` 의 `chatChannel` 스냅샷 대입)은 최신 커밋(`833bb745a`)에서 코드·테스트 양쪽으로 실제로 닫힌 것을 직접 코드를 읽어 확인했다. `trigger.config` 동시 PATCH lost-update(및 그로 인한 `inboundSigningRef` fail-open 재발) 수정은 CHANGELOG·plan 이 서술하는 설계·범위와 현재 코드가 line-level 로 계속 일치하며, 관련 spec 본문(Cafe24 advisory lock 기각 선례, `ChatChannelConfig` 필드 정의)과도 불일치가 없다. 남은 발견은 전부 이미 plan 의 후속 백로그 표에 근거와 함께 명시적으로 등재된 별도-클래스 항목(락 도메인 밖 write-site 3곳, 무조건 null-write 하나, read-after-write 불일치 하나)이며, 이번 PR 이 닫으려는 결함 클래스(동시 config 쓰기로 인한 인입 서명 fail-open)와는 다른 문제라 이번 배치를 막을 사유가 아니다.

## 위험도

NONE
