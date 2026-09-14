# 요구사항(Requirement) Review — trigger-config-lost-update

## 검토 방법

`plan/in-progress/trigger-config-lost-update.md` 가 이미 8라운드 리뷰 이력을 상세히 기록하고
있어, 이번 라운드는 (a) 그 이력이 주장하는 처분이 **현재 코드에 실제로 반영됐는지**, (b) 8라운드
C4 로 새로 닫힌 자리(`mergeIntoFreshSubKey` 도입)가 **다시 같은 함정을 재현하지 않는지**, (c)
CHANGELOG 서술과 코드가 line-level 로 일치하는지를 직접 코드를 읽어 대조했다. 추가로:

- `codebase/backend` 전체 `tsc --noEmit` 실행 → 변경 파일(`trigger-config-lock.ts`,
  `triggers.service.ts`, `chat-channel-binder.service.ts`, `chat-channel-input-rules.ts`,
  `hooks.service.ts`, `schedules.service.ts`, `endpoint-path-conflict-wrap-guard.ts` 등)에서
  **신규 타입 오류 0건** (기존 오류 전부는 `origin/main` 과 diff 없는 무관 파일 — 확인함).
- `jest` 로 `trigger-config-lock.spec.ts` · `chat-channel-input-rules.spec.ts` ·
  `endpoint-path-conflict-wrap.spec.ts` · `hooks.service.spec.ts` · `schedules.service.spec.ts`
  (130 케이스), `triggers.service.spec.ts` + `triggers.web-chat.spec.ts` (148 케이스, 1 skip —
  이 PR 과 무관한 기존 placeholder) 를 직접 실행 — **전건 통과**.
- 리뷰 중 저장소 파일을 수정하지 않았다 (`git status --short` 로 확인, 잔여 변경 없음).

## 발견사항

- **[INFO]** `promoteRotatedNotificationSecrets` 의 `promoted` 카운터가 쓰기 skip(그 사이 삭제)
  시에도 증가한다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `promoteRotatedNotificationSecrets` 메서드, `rewriteTriggerConfigLocked(...)` 호출 직후 `promoted++;` 줄
  - 상세: `rewriteTriggerConfigLocked` 가 그 사이 트리거가 삭제돼 `false` 를 반환해도 반환값을
    확인하지 않고 `promoted++` 가 실행된다. 이 카운트는 `NotificationSecretRotatorService.handleHourly()` 에서 `this.logger.log(...)` 로만 소비되므로(재시도·재계산·알림 트리거에 쓰이지 않음),
    영향은 **cron 로그 문구의 숫자가 실제 DB 쓰기 건수보다 1 커질 수 있다**는 관측성 수준이며
    데이터 무결성에는 영향이 없다(그 트리거 행 자체가 없으므로 "되돌려야 할 상태"도 없다).
  - 제안: 급하지 않음. 고치려면 `if (wrote) promoted++;` 로 좁히면 된다.

- **[INFO]** spec fidelity — 이 변경을 직접 정의하는 spec 본문 없음, `spec_impact: none` 이 정확
  - 위치: `plan/in-progress/trigger-config-lost-update.md` frontmatter, `spec/2-navigation/4-integration.md:1444` (Cafe24 advisory lock 기각 선례)
  - 상세: `trigger.config` 의 동시성/락 전략은 API 계약·요구사항 ID로 spec 에 명세된 대상이
    아니라 내부 구현 세부사항이다. 유일하게 교차 참조되는 spec 본문(Cafe24 advisory lock 기각
    사유 — "lock 보유 중 HTTP 요청을 transaction 안에 묶으면 커넥션 점유가 늘어난다")은 이번
    설계가 **정확히 그 제약을 지키도록**(외부 `adapter.setupChannel` 호출을 락 밖에 두고, 락
    안에서는 재읽기+머지+UPDATE 만) 구현돼 있음을 코드에서 직접 확인했다(`trigger-config-lock.ts`
    JSDoc, `chat-channel-binder.service.ts:243-321`, `triggers.service.ts:1183-1330`). spec 과의
    불일치·spec drift 없음.

## 관점별 확인 (요약)

- **기능 완전성**: CHANGELOG 가 주장하는 "config 를 다시 쓰는 모든 자리" 를 실측 대조했다.
  프로덕션에서 기존 행에 `save(entity)` 하는 자리는 이제 0건(신규 INSERT 2건 + 창 1 의 락 안
  `m.save` 만 남음, `endpoint-path-conflict-wrap.spec.ts` 의 `EXPECTED_UNWRAPPED_TRIGGER_SAVES`
  가 빈 배열로 이 상태를 래칫함)이다. `normalizeNotificationSecretRef` · `revokePerTriggerToken`
  · `promoteRotatedNotificationSecrets`(승격) 는 `rewriteTriggerConfigLocked` + 신규
  `mergeIntoFreshSubKey` 로 하위 키까지 재읽어 병합하고, `rotateNotificationSecret` ·
  `promoteRotatedNotificationSecrets`(stale clear) · `cleanupRotatedChatChannelTokens` ·
  `schedules.service.ts#update` 는 컬럼 한정 `update()` 로 전환됐다 — CHANGELOG 의 "일곱 자리"
  개수·분류와 코드가 정확히 일치한다. `hooks.service.ts` 의 두 인입 hot path 도
  `touchLastTriggeredAt` 공용 헬퍼로 통합돼 `config` 를 더 이상 재작성하지 않는다.
- **엣지 케이스**: `rewriteTriggerConfigLocked` 의 `config` null/undefined 좁힘, 재읽기 시점 행
  삭제(`!fresh`) 시 쓰기 skip + `false`, 삭제 락 타임아웃(5s) 초과 시 `logger.error` + 예외 전파
  등이 전용 유닛(`trigger-config-lock.spec.ts`)과 서비스 테스트에서 개별적으로 커버된다.
- **에러 시나리오**: 창 1/`revokePerTriggerToken`/`rotateBotToken`(동기 요청)은 삭제 경합 시
  404, binder 성공/실패 경로(저장 뒤 best-effort)는 `false` 로 조용히 skip — 이 비대칭이
  `trigger-config-lock.ts` JSDoc 표에 근거와 함께 명시돼 있고 테스트로 양쪽 다 확인된다.
- **반환값**: `rewriteTriggerConfigLocked` 는 성공/스킵 두 경로 모두 `boolean` 을 반환하고,
  세 호출부(동기 요청 계열)는 그 값을 실제로 분기에 사용한다. 부수 작업 계열(binder,
  promote/cleanup cron)은 무시하는 것이 문서화된 설계다.
- **TODO/FIXME/HACK/XXX**: 변경된 프로덕션·테스트 파일 전체에서 0건.
- **의도-구현 괴리**: `touchLastTriggeredAt`·`extractInboundSigningRef`·`mergeIntoFreshSubKey`
  등 신규 함수 이름과 JSDoc 이 실제 동작과 일치한다. `endpoint-path-conflict-wrap-guard.ts` 의
  `TRIGGER_ENTITY`/콜백 경계 판정 로직도 JSDoc 이 설명하는 그대로 구현돼 있고, 대조군 fixture
  (`managerSaveWrapped`/`managerSaveUnwrapped`/`managerSaveOtherEntity`) 로 3-way 분기가 실제로
  갈리는 것을 확인했다.
- **e2e (`trigger-config-lost-update.e2e-spec.ts`)**: advisory lock 을 테스트가 직접 쥐어 요청
  B 를 인위적으로 정지시키고 요청 A 를 그 사이 커밋시키는 설계가 "겹침을 우연에 맡기지 않는다"
  는 목표에 부합하며, 세 단언(①PATCH 값 생존 ②ref 생존 ③미접촉 키 생존)이 각기 다른 코드
  경로를 물어 하나만 남기는 회귀를 잡을 수 있는 구조다.

## 요약

`trigger.config` 동시 PATCH lost-update(및 그로 인한 `inboundSigningRef` fail-open 재발) 수정은
CHANGELOG·plan 이 서술하는 설계·범위와 현재 코드가 line-level 로 일치한다. 8라운드에 걸쳐 지적된
Critical 은 이번 라운드에서 재확인한 범위 내에서 전부 해소돼 있고(전수 `save()` 스캔 결과 기존
행 통째 저장 0건, 최상위 키뿐 아니라 하위 키까지 재읽는 `mergeIntoFreshSubKey` 로 8라운드 C1 이
막던 재발도 관측 안 됨), 실행한 typecheck·jest 도 변경 파일 기준 신규 실패가 없다. 남은 발견은
로그 카운터 오프-바이-원(INFO, 데이터 무결성 무관)과 spec 부재 확인(INFO, `spec_impact: none`
이 타당함을 뒷받침) 둘뿐이며 둘 다 차단 사유가 아니다.

## 위험도

NONE
