# Database Review — trigger.config lost-update 수정 (2026-09-14 19:07 라운드)

## 검토 범위

DB 관점에서 실질적인 코드는 5개다: `trigger-config-lock.ts`(신규) · `trigger-config-lock.spec.ts`(신규) ·
`chat-channel-binder.service.ts` · `triggers.service.ts` · `trigger-transaction-mock.ts`/
`triggers.service.spec.ts`/`triggers.web-chat.spec.ts`(테스트 배선) · e2e
`trigger-config-lost-update.e2e-spec.ts`. 나머지(`review/code/2026/09/14/18_17_44/**`,
`review/consistency/2026/09/14/17_10_16/**`, `plan/**`, `CHANGELOG.md`, repo-guard 3파일)는
이전 라운드 산출물이거나 정적 AST 가드로, DB 관점 해당 없음. 이번 diff 는 `origin/main...HEAD`
전체(커밋 `567c82edb` + `12ed21ff1`)를 반영한 최종 상태를 대상으로 했다 — 소스는 워킹트리에서
직접 `Read`/`grep` 으로 실측했다(뮤테이션 없음, 저장소 미변경).

## 발견사항

- **[WARNING]** "창 1" 이 잠근 것은 `config` 뿐 — 같은 락 안에서도 나머지 컬럼은 여전히 pre-lock 스냅샷으로 전체 저장돼, `rotateBotToken`/chat-channel-binder 의 부분 UPDATE 를 되돌릴 수 있다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:472`(pre-lock 최초 로드)
    및 `:556-574`(락 안 재읽기~`m.save(Trigger, trigger)`), 구체적으로 `:573`
    `Object.assign(trigger, defined, { config: mergedConfig });` / `:574`
    `return m.save(Trigger, trigger);`
  - 상세: `update()` 는 트랜잭션/락 진입 **훨씬 전**(`:472`, `this.findById(id, workspaceId)`)에
    `trigger` 를 로드하고, 그 뒤 스케줄 검증·`assertAuthConfigInWorkspace` 등 비동기 검증을
    거친 뒤에야 advisory lock 을 잡는다. 락 안에서 `fresh` 를 다시 읽지만(`:556`), 그 값은
    **`config` 를 병합하는 데만** 쓰인다(`:565-572`). `Object.assign(trigger, defined, {
    config: mergedConfig })` 는 여전히 `trigger`(락 이전에 로드된 stale 객체)를 베이스로
    삼고, `m.save(Trigger, trigger)` 는 TypeORM 의 **전체 엔티티 저장**이라 `trigger` 가 들고
    있는 **모든** 컬럼을 그대로 다시 쓴다.
    같은 PR 의 다른 세 창(`chat-channel-binder.service.ts:263-267,300-303`,
    `triggers.service.ts:1137-1148`(`rotateBotToken`))은 전부 `rewriteTriggerConfigLocked` 의
    `columns` 파라미터로 **부분 UPDATE**(`chatChannelHealth`/`chatChannelLastError`/
    `chatChannelSetupAt`/`chatChannelRotatedAt`/`chatChannelTokenV2`)만 건드리도록 정확히
    설계돼 있는데, 창 1 이 그 위에 **전체 엔티티**로 덮어써 버리면 그 설계가 무력화된다.
    구체적 시나리오: 사용자가 트리거 이름만 바꾸는 `PATCH`(요청 A, chatChannel 미포함)와 동시에
    다른 요청이 `rotateBotToken`(요청 B)을 호출한다. A 가 `:472` 에서 `trigger` 를 로드한
    **직후**, B 가 advisory lock 을 잡고 `chatChannelTokenV2`/`chatChannelRotatedAt`(24h grace
    rotation 메타, `trigger.entity.ts:143-149` 주석 — *"notification_secret_v2 패턴과 동일"*)
    ·`chatChannelHealth`·`chatChannelLastError` 를 커밋한다. 그 다음 A 가 락을 잡아 `fresh.config`
    는 B 가 갱신한 `config.chatChannel`(botTokenRef 등)을 정확히 반영하지만, A 의 `trigger`
    객체에 남아 있는 **B 이전의** `chatChannelTokenV2`(보통 `null`)·`chatChannelRotatedAt`
    (`null`)·`chatChannelHealth`(`'unknown'`/`'degraded'`)가 `m.save(Trigger, trigger)` 로
    그대로 다시 써져 B 의 커밋을 **조용히 지운다.** 이 PR 이 `inboundSigningRef` 에 대해 정확히
    막으려던 것과 **같은 클래스의 lost update**가, 같은 advisory lock 을 공유하면서도 컬럼을
    바꿔 재발한다 — 다만 대상이 인입 서명 검증(fail-open, 보안)이 아니라 봇 토큰 회전 grace
    메타·헬스 상태(운영/관측성)라 심각도는 다르다. `save(trigger)` 유지 결정의 근거로 남은
    주석("여기서 바꾸는 것은 «어느 config 위에 병합하는가» 와 «그 구간이 직렬화되는가» 뿐이고,
    저장 동사는 건드리지 않는다", `:544-546`)이 이 잔여 위험을 정확히 서술하지만, 그 위험이
    구체적으로 *어느 컬럼*에 해당하는지(회전 grace 메타 포함)는 코드·plan 어디에도 명시되어
    있지 않다 — 이전 두 라운드(`review/code/2026/09/14/18_17_44` concurrency INFO·database
    INFO)가 지적한 "health 컬럼 레이스"는 **이 diff 범위 밖의 다른 코드 경로**를 원인으로
    지목했을 뿐, 창 1 자신의 전체 저장이 같은 락 안의 형제 창들을 덮을 수 있다는 점은
    어느 라운드도 짚지 않았다.
  - 제안: 즉시 차단할 사유는 아니지만(보안 fail-open 은 아니고, 재시도로 복구 가능), 후속으로
    (a) `Object.assign(fresh, defined, { config: mergedConfig })` 처럼 재읽은 행을 베이스로
    쓰거나, (b) 창 1 도 `columns` 방식의 부분 UPDATE 로 전환하는 편이 근본적이다. 두 방법 모두
    이미 실측된 6건 RED(반환 엔티티·subscriber·UNIQUE 충돌 경로) 를 다시 건드리므로, plan
    §D 트래커에 "창 1: `save(trigger)` 가 같은 락 안의 형제 창(rotate/binder) 부분 UPDATE 를
    되돌릴 수 있음" 항목으로 구체 명시해 둘 것을 권고한다.

- **[INFO]** 삭제 레이스의 좁은 창 — 이미 이전 라운드에서 지적·수용됨, 재확인만
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:74-113`
    (`rewriteTriggerConfigLocked`) vs `triggers.service.ts:883-896`(`remove()`)
  - 상세: `remove()` 는 같은 `triggerConfigLockKey` advisory lock 을 잡지 않는다. `findOne` 이
    행을 본 직후 `remove()` 가 그 트리거를 삭제하면 뒤이은 `m.update()` 는 0행에 영향을 주고도
    함수는 `true` 를 반환한다 — 고아 UPDATE 자체는 무해하다. `review/code/2026/09/14/18_17_44/database.md`
    INFO#1 과 동일한 결론이며 이번 라운드에도 변경되지 않았다.
  - 제안: 조치 불요(이미 트래커 대상). 필요하면 `affected` 카운트로 좁힐 수 있다.

- **[INFO]** advisory lock 32비트 키 공간을 `trigger-config:*` / `exec-cap:*` 두 네임스페이스가 공유 — 이미 별도 리뷰·consistency-check 에서 지적·수용됨
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:6-18`
    (`TRIGGER_CONFIG_LOCK_PREFIX`)
  - 상세: `pg_advisory_xact_lock(hashtext(...))` 충돌 시 무관한 자원이 과잉 직렬화될 뿐 정확성
    훼손은 아니다. `review/consistency/2026/09/14/17_10_16` naming_collision INFO#8 로 등재됨.
  - 제안: 조치 불요.

## 관점별 확인

- **인덱스**: 신규/변경된 쿼리는 전부 PK(`id`, 및 `workspaceId` 필터 조합)로 필터링 — 기존 인덱스로 충분.
- **N+1**: 반복문 내 개별 쿼리 없음. 단일 트리거 단위 read-merge-write.
- **트랜잭션**: `manager.transaction()` + `pg_advisory_xact_lock` 조합 자체는 견고하다. 외부 HTTP 호출(`adapter.setupChannel`)을 트랜잭션 밖에 두어 Cafe24 advisory-lock 기각 선례(HTTP 를 트랜잭션에 묶으면 커넥션 점유가 길어짐)를 정확히 피했다. 다만 위 WARNING 처럼, "같은 락으로 직렬화된다" 는 것이 "전체 엔티티 저장이 형제 창의 부분 UPDATE 를 덮지 않는다" 를 보장하지 않는다는 점은 트랜잭션 경계 설계와는 별개의 함정이다.
- **마이그레이션 안전성**: 이번 변경에 DDL 없음 — 해당 없음.
- **스키마 설계**: `Trigger.config`(jsonb) 를 락 안에서 재읽은 최신 값 위에 서브키만 머지하는 방식은 `config` 자체의 lost-update 근본 원인을 구조적으로 제거한다. 다만 위 WARNING 이 지적하듯 `Trigger` 엔티티가 "JSONB 서브키별 부분 머지"와 "그 밖 컬럼은 스냅샷 전체 저장"이라는 두 정합성 모델을 컬럼 단위로 혼재시키는 설계가 됐다.
- **커넥션 관리**: `manager.transaction()` 이 TypeORM 을 통해 커넥션 획득/해제를 관리하며 콜백 종료(정상/예외 불문) 시 반환된다. `pg_advisory_xact_lock` 은 트랜잭션 종료 시 자동 해제. 별도 누수 지점 없음(e2e 테스트 전용 `lockDb` 커넥션의 실패 경로 정리는 concurrency 리뷰 소관으로 이관).
- **SQL 인젝션**: `SELECT pg_advisory_xact_lock(hashtext($1))` 을 포함해 모든 raw 쿼리(e2e 포함)가 `$1`/`$2` 파라미터 바인딩을 사용 — 문자열 concat 없음. 안전.
- **대량 데이터**: 단일 행 조회/갱신만 발생, 페이지네이션·대용량 스캔과 무관.

## 요약

핵심 수정(`rewriteTriggerConfigLocked` + 세 호출부 재배선)은 advisory lock 을 외부 HTTP 호출
밖에 두고 락 안에서 최신 행을 재읽어 `config` 서브키만 머지하는 정석적인 lost-update 방지
패턴이며, 파라미터화 쿼리·PK 기반 조회·트랜잭션 범위 모두 적절하다. 그러나 "창 1 도 닫는다"고
서술된 `triggers.service.ts::update()` 의 `save(trigger)` 는 **`config` 필드만** 재읽은 값을
베이스로 삼을 뿐, 그 밖의 모든 컬럼(`chatChannelHealth`/`chatChannelLastError`/
`chatChannelSetupAt`/`chatChannelRotatedAt`/`chatChannelTokenV2` 등)은 여전히 락 이전에 로드된
stale 스냅샷으로 전체 저장된다. 이는 `rotateBotToken`/`chat-channel-binder` 가 **같은 advisory
lock 안에서** 수행하는 부분 UPDATE 를 창 1 이 뒤따라와 조용히 되돌릴 수 있다는 뜻이며, 이 PR
자체가 막으려는 lost-update 와 정확히 같은 구조적 원인(전체 엔티티 stale 저장)이 다른 컬럼
집합에 대해 재발하는 형태다. 대상이 인입 서명 검증의 보안 fail-open 이 아니라 봇 토큰 회전
grace 메타·헬스 상태라 즉시 차단할 사유는 아니지만, 이전 두 라운드의 리뷰 어디에서도 "창 1
자신의 전체 저장이 형제 창을 덮는다"는 정확한 인과가 지적되지 않았으므로 새 WARNING 으로
등재한다. 나머지(삭제 레이스의 좁은 창, advisory lock 키 공간 공유)는 이미 이전 라운드에서
지적·수용된 낮은 위험의 INFO 로, 이번 라운드에도 유효하지만 변경 사유는 아니다.

## 위험도

MEDIUM
