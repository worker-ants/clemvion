# Database Review — trigger.config lost-update 수정

## 발견사항

- **[INFO]** 삭제 레이스가 완전히 닫히지 않았다 — `findOne` 과 `update` 사이의 좁은 창
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:75-94` (`rewriteTriggerConfigLocked`)
  - 상세: 이 함수는 advisory lock(`trigger-config:<id>`)을 잡은 뒤 `m.findOne`으로 존재를 확인해 `!fresh`면 `false`를 반환하지만, 그 확인은 **findOne 시점** 것이다. `TriggersService.remove()`(`triggers.service.ts:875`, `this.triggerRepository.remove(trigger)`)는 같은 advisory lock 을 잡지 않으므로, `findOne` 이 행을 본 **직후** 다른 요청이 그 트리거를 삭제하면 뒤이은 `m.update(Trigger, {id}, patch)` 는 0 행에 영향을 주고도 함수는 `true`(성공)를 반환한다. 데이터 손상은 없고(고아 UPDATE는 무해), 영향은 "성공했다고 관측되는 조용한 no-op" 수준이라 이 함수의 문서화된 목적("조용히 아무것도 안 했다를 관측 가능하게 한다")을 부분적으로만 만족시킨다.
  - 제안: `remove()` 경로도 같은 `triggerConfigLockKey` 를 잡거나, `m.update()` 의 반환된 `affected` 카운트를 확인해 0이면 `false` 를 반환하도록 좁힐 수 있다. 심각도가 낮아(고아 UPDATE 자체는 안전) 이번 배치를 막을 사유는 아니다.

- **[INFO]** 전역 32비트 advisory lock 키 공간을 두 네임스페이스가 공유 (이미 별도 리뷰에서 지적·수용됨)
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:1-18` (`TRIGGER_CONFIG_LOCK_PREFIX`) vs `execution-engine.service.ts` 의 `exec-cap:<workspaceId>`
  - 상세: `pg_advisory_xact_lock(hashtext(...))` 는 `hashtext` 가 만드는 int4 공간을 두 계열(`exec-cap:*`, `trigger-config:*`)이 접두 문자열만 다르게 공유한다. 우연 충돌 시 서로 다른 자원의 쓰기가 불필요하게 직렬화되는 정도(정확성 훼손 아님, 과직렬화)이며, 이미 `review/consistency/2026/09/14/17_10_16` naming_collision INFO#8 로 등재·수용됐다. 새로운 지적이 아니라 재확인 차원.
  - 제안: 조치 불요(수용됨). 여유가 있으면 `pg_advisory_xact_lock(key1, key2)` 2-int 오버로드로 네임스페이스 분리 검토.

- **[INFO]** 창 1(`TriggersService.update()` 의 `save(trigger)`)은 이번 배치에서 의도적으로 미해결
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` 내 `save(trigger)` 호출부(주석 블록 `// **이 자리(창 1)는 이 배치에서 고치지 않는다...`)
  - 상세: `plan/in-progress/trigger-config-lost-update.md` §D 가 실측(6개 unit 케이스 RED)과 함께 이 창을 열어 둔 이유를 명시했다. `inboundSigningRef` 의 **영속적** 유실(보안에 직결되는 fail-open)은 이번 수정이 닫는 3개 창(2·3·4)으로 해소되고, 창 1에 남는 것은 "PATCH가 건드리지 않은 다른 `config` 키"의 lost update뿐이라 위험도가 다르다. 트래커에 후속 항목으로 등재되어 있다.
  - 제안: 조치 불요(추적됨). 후속 PR 에서 `save()` 의 세 계약(반환 엔티티·subscriber·UNIQUE 충돌 경로)을 먼저 테스트로 고정한 뒤 진행할 것.

## 관점별 확인

- **인덱스**: 신규 쿼리(`findOne`/`update`)는 모두 PK(`id`)로 필터링 — 기존 PK 인덱스로 충분, 신규 인덱스 불요.
- **N+1**: 반복문 내 개별 쿼리 없음. 단일 트리거 단위 read-merge-write.
- **트랜잭션**: `manager.transaction()` + `pg_advisory_xact_lock` 조합이 적절하다. 특히 **외부 HTTP 호출(`adapter.setupChannel`)을 트랜잭션/락 밖으로 뺀 설계**가 좋다 — `spec/2-navigation/4-integration.md` 의 Cafe24 advisory lock 기각 선례(HTTP를 트랜잭션 안에 묶으면 커넥션 점유가 길어짐)를 정확히 피했다. 임계 구간이 「재읽기+머지+UPDATE」로 짧아 락·커넥션 보유 시간이 최소화된다. `pg_advisory_xact_lock` 은 트랜잭션 종료 시 자동 해제되므로 예외 경로에서도 락 누수가 없다.
- **마이그레이션 안전성**: 이번 변경에 DDL 없음 — 해당 없음.
- **스키마 설계**: `Trigger.config` (jsonb) 를 통째로 재구성하지 않고 락 안에서 재읽은 최신 값 위에 서브키만 머지하는 방식으로 변경 — lost-update 근본 원인(스냅샷 기반 통째 덮어쓰기)을 구조적으로 제거한다.
- **커넥션 관리**: `manager.transaction()` 이 TypeORM 을 통해 커넥션 획득/해제를 관리하며, 콜백 종료(정상/예외 불문) 시 반환된다. 별도 누수 지점 없음.
- **SQL 인젝션**: `SELECT pg_advisory_xact_lock(hashtext($1))` 및 e2e 의 모든 raw 쿼리가 파라미터 바인딩(`$1`, `$2`)을 사용 — 문자열 concat 없음. 안전.
- **대량 데이터**: 단일 행 조회/갱신만 발생, 페이지네이션·대용량 스캔과 무관.

## 요약

동시 PATCH 가 `trigger.config` 를 스냅샷으로 통째 덮어써 `inboundSigningRef`(인입 서명 검증에 쓰이는 키)를 잃던 lost-update/TOCTOU 결함을, `pg_advisory_xact_lock` 기반의 트리거 단위 직렬화 + "락 안에서 재읽고 머지" 패턴으로 닫았다. 외부 HTTP 호출을 락 밖에 두어 커넥션·락 보유 시간을 최소화한 설계는 이 저장소의 기각된 선례(Cafe24 advisory lock)를 정확히 학습해 반영했고, presence 게이트(`inboundSigningRefSurvives`)를 락 안에서 재계산하도록 정정한 점도(`--impl-prep` WARNING#1 대응) 결함 재발을 막는다. 파라미터화 쿼리·PK 기반 조회·트랜잭션 범위 모두 적절하다. 남은 항목(삭제-레이스의 좁은 창, 창 1 의 비-보안성 lost update, advisory lock 키 공간 공유)은 전부 INFO 수준이며 위험이 낮거나 이미 트래커/별도 리뷰에 문서화·수용되어 이번 변경을 막을 사유가 아니다.

## 위험도

LOW
