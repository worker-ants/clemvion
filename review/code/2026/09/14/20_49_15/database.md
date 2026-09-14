# Database Review — trigger.config lost-update 수정 (5차 라운드)

## 검토 범위

이전 라운드(`review/code/2026/09/14/18_17_44`, `19_07_43`, `19_44_08`, `20_17_16`)가 이미
advisory lock + 락 안 재읽기 설계를 LOW 위험도로 판정했고, 이번 라운드는 그 라운드들이 남긴
갭을 닫는 후속 수정이다. DB 관점에서 실질 변경이 있는 파일만 추적했다:

- `codebase/backend/src/modules/triggers/triggers.service.ts` — `remove()` 가 config 락을
  잡도록 변경, `findByIdForUpdate()` 신설(불필요한 JOIN 제거)
- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` — 로직 변경 없음(주석만 갱신)
- `codebase/backend/src/modules/hooks/hooks.service.ts` — 웹훅 인입 hot path 두 자리를
  `save(trigger)`(full-entity) → `touchLastTriggeredAt()`(컬럼 한정 `update()`) 로 교체
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` — 로직 변경 없음(이전
  라운드에서 이미 `rewriteTriggerConfigLocked` 로 전환됨, 이번엔 주석/헬퍼 정리)
- 테스트: `trigger-config-lock.spec.ts`(신규), `triggers.service.spec.ts`(락-재읽기 suite
  대폭 추가), `trigger-config-lost-update.e2e-spec.ts`(신규 e2e), `hooks.service.spec.ts`(hot
  path 컬럼-한정 update 회귀 테스트 2건), `trigger-transaction-mock.ts`(공용 트랜잭션 mock)

## 발견사항

- **[INFO]** 이전 라운드가 지적한 "삭제 레이스가 완전히 닫히지 않았다" 갭이 이번 라운드에서 해소됨 — 확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `remove()` 메서드
    (`await this.triggerRepository.manager.transaction(async (m) => { await acquireTriggerConfigLock(m, id); await m.remove(trigger); });`)
  - 상세: `review/code/2026/09/14/18_17_44/database.md` 가 "`findOne` 과 `update` 사이의 좁은
    창 — `remove()` 가 같은 advisory lock 을 잡지 않아 «읽었을 땐 있었는데 저장 직전에
    삭제되는» TOCTOU 가 남는다"고 지적했었다. 이번 라운드에서 `remove()` 가 삭제 직전
    `acquireTriggerConfigLock(m, id)` 로 같은 락을 잡도록 바뀌어, `update()`/`rotateBotToken`/
    binder 의 "락 안에서 재읽기 → 없으면 skip" 경로와 `remove()` 의 삭제가 완전히 직렬화된다.
    외부 호출(`teardownChatChannel`·`secrets.deleteByPrefix`·BullMQ 해제)은 여전히 락 **밖**에
    남아 있어 `trigger-config-lock.ts` 의 "외부 호출을 락 안에 두지 않는다" 제약도 지켜진다.
    `triggers.service.spec.ts` 의 `remove() 도 같은 config 락을 잡는다` 테스트가 `onLock` 콜백으로
    실제 락 키(`trigger-config:trig-l`) 획득을 관측해 회귀를 고정했다. 새로운 결함이 아니라
    이전 지적의 해소 확인.
  - 제안: 없음 (이미 해결됨).

- **[INFO]** 웹훅 인입 hot path 의 `save(trigger)` → 컬럼 한정 `update()` 전환 — lost-update 표면을 좁힘
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:227`, `:686`
    (`await this.touchLastTriggeredAt(trigger);`), 헬퍼 정의 `:978-984`
  - 상세: 종전 두 호출부는 `trigger.lastTriggeredAt = new Date(); await this.triggerRepository.save(trigger);`
    로 엔티티를 통째로 저장했다 — 요청 시작 시점에 읽은 `config` 까지 함께 써서, 동시 PATCH가
    그 사이 확립한 `chatChannel.inboundSigningRef` 를 인입 메시지마다 되돌릴 수 있었다(트리거
    호출 빈도만큼 자주 도는 hot path라 PATCH 끼리의 경합보다 훨씬 잦음). 새 헬퍼는
    `triggerRepository.update({ id }, { lastTriggeredAt })` 로 단일 컬럼만 쓴다 — `config` JSONB
    를 전혀 건드리지 않으므로 advisory lock 없이도 lost-update 위험이 구조적으로 사라진다(락이
    보호하는 것은 `config` 병합이지, 서로 다른 컬럼을 쓰는 두 트랜잭션의 교차가 아니다).
    `hooks.service.spec.ts` 에 두 호출부(`handleWebhook`·chat-channel 인입 경로) 모두 "save 미호출
    + update 가 `lastTriggeredAt` 단일 키만 patch" 를 단언하는 회귀 테스트가 추가됐고, 주석이
    명시하듯 이전에 한쪽 호출부만 테스트를 가져 다른 쪽이 뮤테이션에도 GREEN 이었던 결함을
    양쪽 모두 커버하도록 고쳤다. 설계·테스트 모두 적절.
  - 제안: 없음.

- **[INFO]** `update()` PATCH 당 SELECT 횟수가 순쿼리 1회 → 순쿼리 2회(JOIN 없음 + JOIN 있음)로 재배치됨 — 트레이드오프, 문제 아님
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `findByIdForUpdate()`(관계 없는
    가벼운 조회) + `update()` 내부 트랜잭션의 `m.findOne(Trigger, { where: { id, workspaceId }, relations: ['workflow'] })`
  - 상세: 이전 라운드(`20_17_16` performance WARNING#1)가 "검증만 하는 `findById` 가 불필요한
    `relations: ['workflow']` JOIN 을 실어 락 안 재읽기와 합쳐 같은 JOIN SELECT 가 PATCH 마다
    두 번 돈다"를 지적했었다. 이번 수정은 그 JOIN 을 검증용 조회에서 제거해(`findByIdForUpdate`
    는 관계 없이 조회) 총 쿼리 부하를 줄였다 — 순수 SELECT 횟수는 여전히 2회(락 밖 검증용 1회 +
    락 안 재읽기 1회, 그중 JOIN 이 있는 것은 후자뿐)지만, 이는 advisory lock 이 트랜잭션 안에서만
    유효하다는 제약상 구조적으로 필요한 최소 횟수다(lost-update 방지를 위해 "락을 잡은 뒤 다시
    읽기"가 필수). 단일 트리거 단위 PK 조회라 인덱스·N+1·대량 데이터 관점에서 문제 없음.
  - 제안: 없음.

- **[INFO]** advisory lock 무경계 대기·32비트 키 공간 공유 — 이전 라운드에서 이미 수용된 트레이드오프, 재확인만
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:77-87`(대기 상한 부재
    JSDoc), `:1-18`(`TRIGGER_CONFIG_LOCK_PREFIX`)
  - 상세: `lock_timeout` 미설정으로 같은 트리거의 동시 쓰기는 무한정 대기하며(임계 구간에 외부
    호출이 없어 "DB 왕복 두 번" 으로 유계라는 근거가 이번 라운드에서도 변하지 않음), `hashtext()`
    32비트 해시 공간을 `exec-cap:*` 계열과 공유한다(우발적 충돌 시 과직렬화, 정확성 훼손 아님).
    둘 다 `review/code/2026/09/14/18_17_44`·`review/consistency/2026/09/14/17_10_16` 에서 이미
    지적·수용된 항목이며, 이번 라운드의 diff 는 이 설계를 바꾸지 않았다.
  - 제안: 조치 불요(기존 수용 유지).

## 관점별 확인

- **인덱스**: 이번 라운드 신규/변경 쿼리는 전부 PK(`id`) 필터 — `findByIdForUpdate`, 락 안
  `m.findOne`/`m.update`/`m.remove`, `touchLastTriggeredAt` 의 `update({id}, ...)` 모두 기존 PK
  인덱스로 충분. 신규 인덱스 불요.
- **N+1**: 반복문 내 개별 쿼리 없음. 모두 단일 트리거 단위 read-merge-write 또는 단일 컬럼 update.
- **트랜잭션**: `remove()` 가 삭제를 `manager.transaction()` + advisory lock 안으로 옮겨, config
  재작성 네 자리(`update`/binder 성공·실패/`rotateBotToken`)와 삭제가 완전히 직렬화된다. 락
  획득 순서가 모든 경로에서 동일(advisory lock → 트리거 행 조작)해 데드락 유발 요인 없음. 외부
  호출은 이번 라운드에서도 락 밖에 유지됨.
- **마이그레이션 안전성**: DDL 변경 없음 — 해당 없음.
- **스키마 설계**: 변경 없음. hot path 의 컬럼 한정 `update()` 전환은 오히려 "필요한 컬럼만
  쓴다"는 원칙에 더 부합.
- **커넥션 관리**: `manager.transaction()` 이 TypeORM 을 통해 커넥션을 관리하며 콜백 종료(성공/
  예외 불문) 시 반환 — 이번 라운드가 추가한 `remove()` 의 트랜잭션도 동일 패턴이라 누수 없음.
- **SQL 인젝션**: 신규/변경된 쿼리 전부 파라미터 바인딩(`hashtext($1)`, TypeORM
  `update`/`findOne`/`remove` 빌더) 사용 — 문자열 concat 없음.
- **대량 데이터**: 단일 행 조회/갱신/삭제만 발생 — 페이지네이션·대용량 스캔과 무관.

## 요약

이번 라운드는 이전 리뷰가 남긴 두 갭(삭제-시점 경합 창, 웹훅 인입 hot path 의 full-entity
`save` 로 인한 fail-open)을 정확히 그 두 자리에서 닫았다. `remove()` 가 config 락을 공유하게
되어 "읽기 시점엔 있었는데 저장 직전에 삭제" 경합이 구조적으로 사라졌고, 웹훅 인입 두 지점은
컬럼 한정 `update()` 로 바뀌어 `config` JSONB 를 아예 건드리지 않으므로 락 없이도 lost-update
표면에서 제외된다. 두 수정 모두 회귀를 고정하는 단위 테스트(락 키 관측, save 미호출 + patch
키 단언)가 동반됐고, `update()` 의 쿼리 재배치는 이전에 지적된 중복 JOIN 을 제거하면서도
advisory lock 의 "락 안에서 재읽기" 요구를 그대로 만족한다. 트랜잭션 범위·파라미터화 쿼리·PK
기반 조회 모두 적절하며, 이번 diff 에서 새로 발견된 CRITICAL/WARNING 급 DB 이슈는 없다. 남은
항목(advisory lock 무경계 대기, 32비트 키 공간 공유)은 이전 라운드에서 이미 실측 근거와 함께
수용된 트레이드오프이고 이번 변경이 그 설계를 건드리지 않았다.

## 위험도

LOW
