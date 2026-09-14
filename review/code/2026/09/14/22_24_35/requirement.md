# 요구사항(Requirement) Review — trigger-config-lost-update

## 검토 범위

이 PR 은 8라운드째 `/ai-review` 를 도는 배치로, 실질 코드는
`codebase/backend/src/modules/{triggers,hooks,schedules}/**` 와
`codebase/backend/src/repo-guards/__tests__/**`(정적 래칫), `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts`
다. 나머지 대량 파일(19~146번)은 `plan/`·이전 라운드 `review/code/**`·`review/consistency/**`
산출물로, 이번 라운드 자체의 신규 코드 변경이 아니라 이전 리뷰 이력이다.

핵심 요구사항: **동시 PATCH/rotate/cron 이 `trigger.config` 를 스냅샷 통째 저장으로 잃는
lost-update 를 닫고, 특히 `chatChannel.inboundSigningRef` 유실로 인한 인입 웹훅 서명 검증
fail-open 을 막는다.** 대상 write-site 전수(창 4 + 추가 7 + hot-path 2 = 13곳)를 실제 소스
(`trigger-config-lock.ts`, `chat-channel-binder.service.ts`, `triggers.service.ts`,
`hooks.service.ts`, `schedules.service.ts`)를 직접 Read 해 확인했다.

## 검증 방법

- `trigger-config-lock.ts` 전문 Read — `rewriteTriggerConfigLocked`/`acquireTriggerConfigLock`
  의 락 획득→재읽기→머지→쓰기 순서, 삭제 감지(`!fresh` → `false`), 컬럼/설정 스프레드 순서 확인.
- `chat-channel-binder.service.ts` 전문 Read — 성공/실패 두 경로 모두 락 안 재읽기 +
  `survivesWithFresh` presence 게이트 재계산 확인.
- `triggers.service.ts` 전문 Read(1~1549줄) — `update()`(창 1), `remove()`(삭제 락+5초 상한),
  `rotateBotToken()`, `normalizeNotificationSecretRef`, `revokePerTriggerToken`,
  `promoteRotatedNotificationSecrets`, `cleanupRotatedChatChannelTokens` 전부 확인.
- `hooks.service.ts` 두 hot-path 호출부(`touchLastTriggeredAt` 공용화) 확인.
- `schedules.service.ts#update` 의 컬럼 한정 patch 확인.
- `grep -rl "Trigger" src | xargs grep -l "\.save("` 로 트리거 레포를 잡을 수 있는 전 파일을
  훑어, `execution-engine`·`workflows`·`alerts-evaluator`·`executions`·`auth-configs`·
  `schedule-runner` 서비스가 `triggerRepository.save()` 를 호출하지 않음을 확인 — CHANGELOG 의
  "기존 행에 `save(entity)` 하는 자리는 한 곳도 남지 않는다" 를 코드 레벨로 재확인.
- `endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`/fixture 를 Read 해 정적 래칫이 실제로
  `EntityManager.save(Trigger, …)` 형태(트랜잭션 콜백 경계 포함)까지 인식하는지, 빈
  `EXPECTED_UNWRAPPED_TRIGGER_SAVES` 로 회귀를 잡는지 확인.
- `trigger-config-lock.spec.ts`(단위) · `triggers.service.spec.ts` 3649~4008줄(락 재읽기 ·
  삭제 경합 · 락 순서 · lock_timeout · listener 게이트) · `trigger-config-lost-update.e2e-spec.ts`
  전문 Read — 3-단언(PATCH 값 생존/ref 생존/미접촉 키 생존) + 공허성 가드(④) 확인.
- `spec/2-navigation/4-integration.md:1444` 를 직접 열어 JSDoc 이 인용한 Cafe24 advisory-lock
  기각 문장이 원문과 정확히 일치하는지 대조(일치).
- `spec/5-system/15-chat-channel.md:371` 을 확인해 `rotateBotToken` 의 삭제-경합 신규 404
  경로가 기존에 문서화된 `RESOURCE_NOT_FOUND` 계약과 같은 코드·의미임을 확인(신규 에러 코드
  아님, spec 위반 아님).

## 발견사항

- **[INFO]** 정적 래칫(`endpoint-path-conflict-wrap`)의 스캔 범위는 `modules/triggers/` 뿐이라, CHANGELOG 의 "기존 행에 `save(entity)` 하는 자리는 한 곳도 남지 않는다(정적 래칫이 고정한다)" 는 문장이 커버하는 기계적 보증 범위보다 넓게 읽힐 수 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap.spec.ts` (`const TRIGGERS_DIR = path.join(SRC_ROOT, 'modules', 'triggers');`), CHANGELOG.md 게이트 16번째 줄(`그 결과 기존 행에 save(entity) 하는 자리는 한 곳도 남지 않는다(정적 래칫이 고정한다).`)
  - 상세: 이 래칫은 `modules/triggers/` 안의 `triggerRepository.save`/`manager.save(Trigger, …)` 호출만 스캔한다. `schedules.service.ts`(같은 `Trigger` 레포지토리를 주입받아 씀)는 스캔 대상 밖이다. 이번 PR 이 `schedules.service.ts#update` 를 컬럼 한정 `update` 로 이미 고쳐 두었고, 현재 `schedules.service.ts` 에 남은 유일한 `triggerRepository.save(trigger)`(173줄, `create()`)는 신규 INSERT라 안전함을 직접 확인했다 — 지금 이 순간 결함은 없다. 다만 누군가 나중에 `schedules.service.ts` 에 "기존 트리거 행을 통째로 save" 하는 코드를 다시 넣어도, 이 래칫은 `modules/triggers/` 밖이라 잡지 못한다. "한 곳도 남지 않는다" 는 지금 시점의 실측으로는 참이지만, "정적 래칫이 고정한다" 는 문구는 그 보증이 `schedules.service.ts`·`hooks.service.ts` 등 형제 모듈까지 기계적으로 묶여 있다는 인상을 준다.
  - 제안: 차단 사유 아님(코드 결함 없음, 지금 실측은 참). CHANGELOG/JSDoc 에 "래칫은 `modules/triggers/` 스캔에 한정되고, `schedules.service.ts`/`hooks.service.ts` 의 대응 수정은 회귀 테스트(단위 assert)로만 지켜진다"는 한 줄을 덧붙이거나, 이미 plan 의 후속 항목("헬퍼가 `Trigger` 에 하드코딩")과 같은 결에서 래칫 스캔 대상 확장을 후속으로 등재하면 다음 사람이 보호 범위를 오인하지 않는다.

- **[INFO]** `TriggersService.update()` 에서 삭제-경합(락 안 재읽기 결과 `fresh === undefined`) 시 `mergedConfig` 계산이 `assertTriggerFound` 이전에 수행돼 낭비된다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` 트랜잭션 콜백 (`baseConfig`/`mergedConfig` 계산 → `assertTriggerFound(fresh)` 순서)
  - 상세: `fresh` 가 `undefined` 인 경로(트리거가 그 사이 삭제됨)에서도 `stripInlineAuthKeys`·`mergeExternalConfig` 가 먼저 실행된 뒤에야 `assertTriggerFound` 가 예외를 던진다. 결과에는 영향이 없다(예외가 던져지고 `Object.assign`/`m.save` 는 실행되지 않음) — 순수한 계산 낭비이지 정합성 결함이 아니다.
  - 제안: 조치 불요 수준(트랜잭션 안의 순수 함수 호출 한 번이라 비용이 무시할 만함). 가독성 차원에서 `assertTriggerFound(fresh)` 를 병합 계산보다 앞에 두는 정도의 사소한 재배치만 고려 가능.

- **[INFO]** 위 두 항목 외에는 CRITICAL/WARNING 급 요구사항 결함을 찾지 못했다 — 아래 "요약" 참조.

## 요구사항 충족 확인 근거 (요약이 아니라 검증 로그)

- **창 4곳** (`update()` 창1, binder 성공/실패 창2·3, `rotateBotToken` 창4) 모두 "외부 호출은
  락 밖, 재읽기+머지+쓰기는 락 안" 설계를 실제로 구현하고 있음을 소스에서 직접 확인.
- **추가 7곳**(`normalizeNotificationSecretRef`·`revokePerTriggerToken`·
  `promoteRotatedNotificationSecrets` 2분기·`rotateNotificationSecret`·
  `cleanupRotatedChatChannelTokens`·`schedules.service.ts#update`)이 각각 "config 를 명시
  수정하면 락 안 재작성, 컬럼만 고치면 컬럼 한정 `update`" 규율을 정확히 따름을 확인.
- **hot-path 2곳**(`hooks.service.ts` 의 webhook/chat-channel 인입)이 `touchLastTriggeredAt`
  공용 헬퍼로 통합돼 컬럼 한정 `update` 만 씀을 확인 — 두 호출부 모두 배선돼 있다(1라운드에서
  한쪽만 고쳐 회귀했던 결함이 재발하지 않았다).
- **삭제 경합**: `remove()` 가 같은 advisory lock 을 잡고(5초 상한), 실패 시 삼키지 않고 던지며
  ("반쯤 삭제된 상태" 를 로그+예외로 드러냄), 순서(상한 설정→락→삭제)가 배열 하나로 테스트에서
  단언됨을 확인.
- **부재 처리 비대칭**(동기 요청=404 / cron·best-effort 후속=조용한 skip)이 설계 표
  (`trigger-config-lock.ts` JSDoc)와 실제 호출부(`revokePerTriggerToken`·`rotateBotToken`=
  404, binder 두 경로·cron 셋=무시) 사이에 정확히 일치함을 확인.
- **e2e**: `trigger-config-lost-update.e2e-spec.ts` 가 advisory lock 을 직접 쥐어 겹침을
  강제하고, 3-단언(PATCH 값·ref 생존·미접촉 키 생존) + 공허성 가드(④ "B 가 아직 안 끝났다")를
  갖춰 "고치기 전엔 반드시 실패, 고친 뒤엔 통과"를 실제로 판별함을 확인.
- **정적 래칫**: `endpoint-path-conflict-wrap` 가드가 `manager.transaction(async (m) =>
  m.save(Trigger, …))` 형태(콜백 경계 통과)까지 인식하도록 확장됐고, 대조군 fixture
  (`managerSaveWrapped`/`managerSaveUnwrapped`/`managerSaveOtherEntity`)로 술어가 넓지도
  좁지도 않음을 확인.
- **spec 인용 정확성**: JSDoc 이 인용한 `spec/2-navigation/4-integration.md:1444` 원문과
  일치, `rotateBotToken` 의 신규 404 경로가 `spec/5-system/15-chat-channel.md:371` 이 이미
  선언한 `RESOURCE_NOT_FOUND` 계약과 같은 코드임을 확인(신규 에러 코드 도입 아님).
- TODO/FIXME/HACK/XXX 주석: `git diff origin/main...HEAD -- codebase/` 전수 grep 0건.
- 반환값 누락 경로: `rewriteTriggerConfigLocked` 의 7개 호출부 전부 `Promise<boolean>` 반환을
  설계 표의 규율대로 소비(체크 또는 의도적 무시)함을 확인 — 누락된 경로 없음.

## 요약

동시 PATCH/rotate/cron 이 `trigger.config` 를 스냅샷 통째 저장으로 잃어 인입 웹훅 서명 검증이
fail-open 되는 lost-update 결함을, advisory lock(트리거 단위) + "외부 호출은 락 밖, 재읽기·머지·
쓰기는 락 안" 설계로 닫는 PR 이다. 실측으로 찾은 write-site 13곳(창 4 + 형제 7 + hot-path 2)
전부가 배선됐음을 소스를 직접 읽어 확인했고, 삭제 경합·부재 처리 비대칭·정적 래칫 회귀·e2e
판별력 모두 설계 문서(plan)와 정확히 일치한다. `grep` 으로 트리거 레포지토리를 참조하는 전
서비스 파일을 훑어 "기존 행에 대한 full-entity save 가 한 곳도 남지 않았다"는 CHANGELOG 의
핵심 주장을 코드 레벨에서 재확인했다. spec 인용문(Cafe24 advisory-lock 기각 선례, 404
`RESOURCE_NOT_FOUND` 계약)도 원문과 line-level 로 일치한다. 발견한 두 항목은 모두 INFO 수준
(정적 래칫의 스캔 범위가 CHANGELOG 문구의 함의보다 좁다는 문서 정밀도 문제, 그리고 삭제
경합 경로의 사소한 계산 낭비)이며 어느 것도 기능적 결함이나 spec 불일치가 아니다. 이 배치를
막을 요구사항 관점의 사유는 없다.

## 위험도

NONE
