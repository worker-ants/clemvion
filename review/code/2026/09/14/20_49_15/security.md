# Security Review — trigger-config-lost-update (라운드 20_49_15)

## 검토 범위

이번 라운드(`567c82edb`~`889c93cd9`)에서 최종 상태에 도달한 `trigger.config` lost-update
수정 전체를 확인했다. 핵심 변경:

- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (신규) —
  `pg_advisory_xact_lock` + 락 안 재읽기(`acquireTriggerConfigLock`/`rewriteTriggerConfigLocked`)
- `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()`(창 1, 인라인 락),
  `remove()`(이번 라운드 신규 — 삭제도 같은 락을 잡음), `rotateBotToken()`(창 4)
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` — `setupChatChannel()`
  성공·실패 경로(창 2·3) + `survivesWithFresh` presence 게이트 재계산
- `codebase/backend/src/modules/hooks/hooks.service.ts` — 인입 hot path 두 자리를
  `save(trigger)`(엔티티 통째 저장) → `touchLastTriggeredAt()`(컬럼 한정 `update()`)로 교체
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` — `extractInboundSigningRef`
  헬퍼 추출(동작 동일, 세 자리 중복 캐스트 통합)
- 나머지(각 spec 파일, `trigger-transaction-mock.ts`, `endpoint-path-conflict-wrap-guard.ts` 등
  정적 분석 가드/테스트 유틸, `plan/`·`review/` 산출물)는 비-런타임 코드이거나 저장소 내부
  정적 분석 도구라 보안 표면에 직접 영향이 없다.

이 배치가 고치는 결함 자체가 보안 결함이다 — 동시 PATCH/rotate 가 `trigger.config` 를
in-memory 스냅샷으로 통째 덮어써 `chatChannel.inboundSigningRef` 를 유실시키고,
`ChatChannelInboundAuthenticator` 의 `if (!config.inboundSigningRef) return;` 가 그 유실을
"서명 검증 없음(legacy fail-open)"으로 읽어 **인입 웹훅 서명 검증이 우회**됐다. 수정은
advisory lock 으로 트리거 단위 재작성 네 자리(+ 이번 라운드에 삭제까지 다섯 번째)를
직렬화하고, 락 안에서 최신 행을 재읽어 서브키만 머지하는 방식으로 이를 닫는다.

## 이전 라운드 대비 변경사항 확인

- 직전 라운드(`review/code/2026/09/14/20_17_16/security.md`)가 INFO 로 남겨 둔 "삭제 레이스의
  좁은 창"(`remove()` 가 `trigger-config` advisory lock 을 잡지 않아, `findOne` 확인 직후
  삭제가 끼어들면 뒤이은 `update()` 가 조용히 no-op 하는 경합)이 `889c93cd9` 에서 닫혔다 —
  `triggers.service.ts` 의 `remove()` 가 이제 `manager.transaction` 안에서
  `acquireTriggerConfigLock(m, id)` 를 잡은 뒤 `m.remove(trigger)` 를 호출한다. `trigger`
  자체는 `remove()` 진입 시점의 `findById(id, workspaceId)` 로 이미 workspace 소유권이
  검증된 엔티티이므로 PK 기반 삭제에 IDOR 여지가 없다. 외부 호출(`teardownChatChannel`)은
  여전히 락 밖에서 먼저 끝나 임계 구간에 들어가지 않는다 — 설계 일관성 유지.
- `triggers.service.ts` 의 `update()`(창 1)도 재확인 — `findByIdForUpdate(id, workspaceId)` 로
  workspace 스코프를 먼저 검증하고, 락 안 재읽기(`m.findOne(Trigger, { where: { id, workspaceId } })`)
  도 동일하게 `workspaceId` 를 조건에 포함해 락 획득 이후 재조회 단계에서도 cross-tenant
  접근 경로가 열리지 않는다.

## 발견사항

- **[INFO]** `rewriteTriggerConfigLocked`/`acquireTriggerConfigLock` 자체는 `triggerId` 만
  받고 workspace 소유권을 검증하지 않는다 — 이전 라운드부터 지적된 항목의 재확인, 아직 유효
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` 함수
    `rewriteTriggerConfigLocked` (`m.findOne(Trigger, { where: { id: triggerId } })` — `where` 에
    `workspaceId` 가 없다)
  - 상세: 현재 프로덕션 호출부(`chat-channel-binder.service.ts` 의 성공/실패 경로,
    `triggers.service.ts` 의 `rotateBotToken`)는 모두 `findById(id, workspaceId)` 를 거쳐
    이미 workspace 검증이 끝난 `trigger.id` 만 넘긴다. 실제 cross-tenant 접근 경로는
    확인되지 않았다. 다만 이 함수는 공유 유틸리티로 설계돼 있어(JSDoc 이 재사용을 전제), 향후
    workspace 검증을 아직 거치지 않은 id 로 호출하는 자리가 추가되면 IDOR 로 이어질 수 있는
    형태 그대로다. 이번 라운드가 다섯 번째 호출부(`remove()`)를 추가했지만 그 호출부는
    `acquireTriggerConfigLock`(락 전용, 소유권 검증 없음)만 쓰고 `rewriteTriggerConfigLocked`
    는 쓰지 않으므로 — `remove()` 도 이미 검증된 `trigger` 엔티티를 그대로 `m.remove()` 에
    넘겨 위험이 늘지 않았다.
  - 제안: 지금 배치를 막을 사유는 아니다(호출부 전량 안전 확인됨). 여력이 있으면
    `rewriteTriggerConfigLocked` 시그니처에 선택적 `workspaceId` 파라미터를 추가해 함수
    스스로 이 불변식을 강제하도록 하거나, 최소한 JSDoc 에 "호출자가 이미 workspace 소유권을
    검증한 id 만 넘겨야 한다"는 전제를 명시.

- **[INFO]** advisory lock 에 `lock_timeout` 없음 — 기존에 수용된 설계, 재확인만
  - 위치: `trigger-config-lock.ts:39-46`(`acquireTriggerConfigLock`), `triggers.service.ts` 의
    `update()`/`remove()` 인라인 락 획득
  - 상세: 임계 구간에 외부 HTTP 호출이 없어 보유 시간이 유계라는 근거가 JSDoc 에 명시돼 있고
    선례(`execution-engine.service.ts`)와 동일하다. 같은 트리거에 대해 다수의 PATCH/rotate/DELETE
    를 보낼 수 있는 인증 사용자가 자기 자신의 리소스에 대한 순차 대기 체인을 만들 수 있으나,
    이는 self-scoped 지연이며 타 워크스페이스로 전이되지 않는다.
  - 제안: 조치 불요(이미 수용). 향후 임계 구간에 외부 호출/긴 계산이 들어가면 JSDoc 이 예고한
    대로 `SET LOCAL lock_timeout` 을 함께 추가.

## 관점별 확인

- **인젝션**: 신규/변경 쿼리 전부 파라미터 바인딩 사용 —
  `pg_advisory_xact_lock(hashtext($1))` (`trigger-config-lock.ts:43`), TypeORM
  `findOne`/`update`/`save`/`remove`, e2e 의 raw SQL(`UPDATE trigger SET config = $2::jsonb
  WHERE id = $1`, `SELECT config FROM trigger WHERE id = $1`)도 전부 `$1`/`$2` 바인딩. 문자열
  concat 없음 — SQL 인젝션 없음. 경로 탐색·커맨드 인젝션·XSS·LDAP 인젝션 대상 표면 변경 없음.
- **하드코딩된 시크릿**: 없음. `trigger-config-lost-update.e2e-spec.ts` 의
  `botToken: '111:e2eTelegramBotToken'` 은 격리된 로컬 e2e 환경 전용 더미 값이며 실제 provider
  자격 증명이 아니다. diff 전체를 정규식(`api[_-]?key|secret|password|token|bearer` 뒤에 오는
  12자 이상 리터럴)으로 훑어도 유출 후보 0건.
- **인증/인가**: 컨트롤러·가드 변경 없음. `update()`/`remove()`/`rotateBotToken()`/
  `setupChatChannel()` 모두 이미 workspace 로 스코프된 `trigger`/`triggerId` 만 락·재읽기
  대상으로 삼는다. 이번 라운드가 새로 락으로 감싼 `remove()` 도 진입 시점 `findById(id,
  workspaceId)` 로 검증된 엔티티를 그대로 삭제 대상으로 쓴다 — 인가 우회 없음. 이 수정의
  핵심 목적 자체가 "인입 웹훅 서명 검증 fail-open" 을 닫는 것이고, 다섯 쓰기 지점(창 1~4 +
  삭제) 전부 presence 게이트/삭제 가드를 락 안에서 재계산·재확인하도록 배선돼 목적을
  달성한다.
- **입력 검증**: DTO·validation pipe 변경 없음. `extractInboundSigningRef(config: unknown)`
  은 optional chaining 으로 비객체/null/undefined 입력에도 안전하게 `undefined` 를 반환한다
  (`chat-channel-input-rules.spec.ts` 의 7-케이스 `it.each` 로 커버).
- **암호화/평문 노출**: secret store 쓰기 순서·게이팅(`storeUserSuppliedSecrets`) 로직 변경
  없음. `extractInboundSigningRef` 가 다루는 것은 secret store 를 가리키는 **참조 문자열**
  (`secret://triggers/<id>/inbound-signing`)뿐이고 평문 비밀 자체는 이 diff 어디에도 새로
  로그·응답·config 에 노출되지 않는다.
- **에러 처리**: `rewriteTriggerConfigLocked`/`manager.transaction` 실패는 기존 `update()`/
  `save()` 예외 전파 경로와 동일하게 위로 던져진다. `rotateBotToken`/`update()` 가 락 재읽기
  시점에 행 부재를 만나면 `NotFoundException({ code: 'RESOURCE_NOT_FOUND', ... })` 로 응답 —
  내부 스택트레이스·쿼리·워크스페이스 존재 여부 같은 민감 정보 노출 없음. `hooks.service.ts`
  의 `touchLastTriggeredAt` 도 마찬가지로 컬럼 한정 update 실패 시 새로운 에러 표면을 만들지
  않는다.
- **의존성 보안**: `package.json`/lockfile 변경 없음, 신규 외부 패키지 없음. `typeorm` 내부
  서브패스(`typeorm/query-builder/QueryPartialEntity`) import 는 기존 `workflows.service.ts`
  선례를 재사용한 것으로 이번 PR 이 새로 노출 표면을 넓히지 않는다.
- **OWASP Top 10**: 이 수정이 닫는 결함은 A07(식별 및 인증 실패)/A04(안전하지 않은 설계)
  성격의 fail-open 이었고, 락 안 재계산 도입으로 해당 클래스가 이번 라운드까지 포함해 다섯
  자리 모두 닫혔다. 그 외 신규 공격 표면은 확인되지 않았다.

## 요약

이번 라운드는 직전 보안 리뷰(`20_17_16`)가 INFO 로 남겨 둔 삭제-레이스 창을 `remove()` 에도
같은 advisory lock 을 씌워 닫았고, 그 변경이 workspace 소유권 검증(진입 시점 `findById(id,
workspaceId)`)을 그대로 보존해 새로운 인가 우회를 만들지 않았음을 확인했다. 핵심 보안 결함
(동시 쓰기로 인한 인입 웹훅 서명 검증 fail-open)은 advisory lock + 락 안 재읽기·병합 패턴이
다섯 쓰기 지점(update/remove/setupChatChannel 성공·실패/rotateBotToken) 모두에 일관되게
적용되어 해소됐다. 모든 신규/변경 쿼리가 파라미터 바인딩을 사용하고, 신규 하드코딩 시크릿·
의존성 변경이 없으며, 에러 처리도 민감 정보를 노출하지 않는다. 남은 항목(공유 유틸
`rewriteTriggerConfigLocked` 의 workspace 검증 비강제, lock timeout 부재)은 전부 INFO
수준이고 현재 호출부 기준으로는 악용 경로가 없으며 이미 설계 근거와 함께 이전 라운드에서
문서화·수용됐다. 이 배치를 막을 보안 사유는 없다.

## 위험도

NONE
