# Database Review — trigger.config lost-update 수정 (2026-09-14 19:44 라운드)

## 검토 범위

`origin/main...HEAD` 전체 diff 중 DB 관점에 실질적인 파일: `trigger-config-lock.ts`(신규) ·
`trigger-config-lock.spec.ts`(신규) · `chat-channel-binder.service.ts` · `triggers.service.ts` ·
`hooks.service.ts`(+spec) · 테스트 배선(`trigger-transaction-mock.ts`, `triggers.service.spec.ts`,
`triggers.web-chat.spec.ts`) · e2e `trigger-config-lost-update.e2e-spec.ts`. 소스는 워킹트리에서
직접 `Read`/`grep`/`git diff`로 실측했다(뮤테이션 없음, 저장소 미변경 — `git status --short` 로
확인).

이번 라운드는 이전 두 라운드(`review/code/2026/09/14/18_17_44`, `19_07_43`)의 database.md 가
지적한 항목이 이후 커밋(`567c82edb`, `12ed21ff1`, `c7a9c107e`)으로 어떻게 처리됐는지를 실제
코드로 재확인하는 것이 핵심이다.

## 발견사항

- **[INFO]** (해소 확인) 이전 라운드(19_07_43) WARNING — "창 1 이 형제 창의 부분 UPDATE 를 되돌린다" — 현재 코드에서 수정됨
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:582-584` (`update()` 내부 트랜잭션 콜백)
  - 상세: 19_07_43 라운드는 `Object.assign(trigger, defined, { config: mergedConfig })` 가 락
    **이전**에 로드한 stale `trigger` 를 베이스로 `m.save(Trigger, trigger)` 하여, 같은 advisory
    lock 을 공유하는 형제 창(`rotateBotToken`/`chat-channel-binder`)이 커밋한
    `chatChannelHealth`/`chatChannelTokenV2`/`chatChannelRotatedAt` 등을 되돌릴 수 있다고
    WARNING(MEDIUM 기여 요인)으로 지적했다. 현재 코드는 `const target = fresh ?? trigger;
    Object.assign(target, defined, { config: mergedConfig }); return m.save(Trigger, target);`
    로 바뀌어 있다 — `fresh` 는 락을 잡은 **뒤** `m.findOne(Trigger, {...})` 으로 재조회한
    행이므로, 같은 락으로 직렬화된 형제 창의 커밋이 이 시점에 이미 반영돼 있다. `defined`
    (PATCH 의 `name`/`isActive`/`endpointPath`/`authConfigId`)는 `chatChannelHealth` 류와
    겹치는 필드가 없어(`UpdateTriggerDto` 확인) 이 병합이 그 컬럼들을 건드리지 않는다.
    지적된 WARNING 은 이 라운드의 코드에서 재현되지 않는다.
  - 제안: 없음(회귀 여부만 재확인). 다만 이 불변식("형제 창 컬럼은 `target=fresh` 를 통해서만
    보존된다")이 코드 주석에는 있지만 타입 수준으로 강제되지는 않으므로, 향후 이 트랜잭션
    콜백을 수정할 때 `trigger`(stale) 를 실수로 다시 베이스로 쓰면 같은 결함이 조용히
    재발한다 — 이미 `trigger-config-lock.spec.ts`/`triggers.service.spec.ts` 의 "락 안 재읽기가
    동시 확립분을 본다" suite 가 이 경로를 뮤테이션 테스트로 고정해 두어 회귀 시 RED 가 난다.

- **[INFO]** 웹훅 hot path 의 `save(trigger)` → 컬럼 한정 `update()` 전환 — 올바른 방향, 새 위험 없음
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:232-236`, `:699-704`
  - 상세: 두 자리 모두 `trigger.lastTriggeredAt = new Date()` 뒤 `triggerRepository.update({id},
    {lastTriggeredAt})` 로 바뀌어, 요청 시작 시점에 읽은 `config` 를 더 이상 함께 쓰지 않는다.
    이 경로는 인입 메시지마다 도는 hot path 라 PATCH-PATCH 경합보다 빈도가 훨씬 높았고, 잃는
    대상이 같은 `inboundSigningRef` 라 이 전환의 우선순위가 타당하다. PK(`id`) 단일 컬럼
    갱신이라 인덱스·락 이슈 없음. 두 개의 동시 웹훅 호출이 같은 트리거의 `lastTriggeredAt` 을
    경합해도 마지막 쓰기가 이기는 정도이고(필드의 의미상 손실 허용), advisory lock 을 씌울
    필요는 없다 — 이 판단은 타당하다.
  - 제안: 없음.

- **[INFO]** 삭제 레이스의 좁은 창 — 변경 없음, 이미 트래커에 등재
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:93-129`
    (`rewriteTriggerConfigLocked`) vs `triggers.service.ts:914` (`remove()` 의
    `this.triggerRepository.remove(trigger)`)
  - 상세: `remove()` 는 같은 `triggerConfigLockKey` advisory lock 을 잡지 않는다. 락 안
    `m.findOne` 이 행을 본 **직후** 다른 요청이 그 트리거를 삭제하면, 뒤이은 `m.update(Trigger,
    {id}, patch)` 는 0행에 영향을 주고도 함수는 `true` 를 반환한다. 데이터 손상은 없음(고아
    UPDATE 는 무해), "성공했다고 관측되는 조용한 no-op" 수준. `plan/in-progress/trigger-config-lost-update.md`
    §D 후속 표에 `remove() 가 같은 락을 안 잡는다 | 삭제 레이스의 좁은 창. 데이터 손상은 없다`
    로 명시적으로 등재돼 있어 새 지적이 아니다.
  - 제안: 조치 불요(추적됨). 필요하면 `m.update()` 의 `affected` 카운트로 0 이면 `false` 반환하도록 좁힐 수 있다.

- **[INFO]** 같은 클래스의 무가드 full-entity `save()` 가 8곳 더 있다 — 이번 PR 범위 밖, 계획서에 전수 열거·처분 완료
  - 위치: `triggers.service.ts` — `normalizeNotificationSecretRef`(:775) · `rotateNotificationSecret`(:960,
    `notificationSecretV2`/`notificationRotatedAt` 컬럼 갱신에 `save(trigger)` 사용) ·
    `revokePerTriggerToken`(:1008, `config.interaction` 을 명시 수정 후 `save(trigger)`) 등
  - 상세: 세 자리 모두 `this.findById()` 로 로드한 stale in-memory `trigger` 를 그대로
    `save()` 하며, advisory lock 을 잡지 않는다 — 이번 diff 가 닫은 4개 창(window 1/2/3/4)과
    같은 lost-update 클래스다. 다만 이 세 자리는 이번 PR 의 diff 범위(`git diff
    origin/main...HEAD`)에 포함되지 않은 기존 코드이고, `plan/in-progress/trigger-config-lost-update.md`
    §D "같은 클래스의 자리가 넷보다 많다" 절이 21건 전수 열거 후 8곳의 `save(entity)` 자리를
    표로 처분했다 — `revokePerTriggerToken`(최우선) · `normalizeNotificationSecretRef` ·
    `promoteRotatedNotificationSecrets`(2자리) 는 "후속(developer 범위)" 로, `rotateNotificationSecret` ·
    `cleanupRotatedChatChannelTokens` · `schedules.service.ts#update` 는 "컬럼만 고치지만 save 라
    config 가 암묵적으로 실린다" 로 이미 계획서에 명시돼 있다. 새로 발견한 결함이 아니라 계획된
    범위 경계의 재확인이다.
  - 제안: 조치 불요(이번 PR 범위 밖, 이미 추적됨). 후속 PR 착수 시 `revokePerTriggerToken` 을
    최우선으로, 이번에 만든 `rewriteTriggerConfigLocked` 를 재사용하려면 `columns` 파라미터가
    임의 컬럼 집합을 받을 수 있어야 하므로(`rotateNotificationSecret`/`revokePerTriggerToken` 은
    `config` 서브키가 다름) 그 시점에 시그니처 일반화가 함께 필요하다.

- **[INFO]** `chatChannelSetupAt`/`chatChannelRotatedAt` 타임스탬프가 락 획득 **전** 캡처됨 — 컨텐션 시 완료 시각과 괴리, 이미 트래커에 등재
  - 위치: `triggers.service.ts:1158` (`const rotatedAt = new Date();` → `rewriteTriggerConfigLocked` 호출 인자로 전달)
    / `chat-channel-binder.service.ts:273` (`chatChannelSetupAt: new Date()` 인라인)
  - 상세: 두 값 모두 advisory lock 획득 이전(호출 시점)에 평가된다. 동시 요청으로 락 대기가
    길어지면, 기록되는 시각이 실제 커밋 시각보다 앞선 값이 된다. 데이터 정합성 문제는 아니고
    관측성(감사·모니터링) 관점의 사소한 괴리다. §D 후속 표에 동일 항목으로 등재돼 있다.
  - 제안: 조치 불요(추적됨). 필요하면 `columns` 평가를 락 획득 이후로 늦추는 것을 고려.

- **[INFO]** advisory lock 무제한 대기가 커넥션 풀 관점에서 갖는 함의 — 설계상 수용된 트레이드오프, 재확인 차원
  - 위치: `trigger-config-lock.ts:39-46` (`acquireTriggerConfigLock`, `lock_timeout` 미설정)
  - 상세: `manager.transaction()` 은 콜백이 끝날 때까지 풀에서 커넥션 하나를 점유한다.
    `pg_advisory_xact_lock` 에 `lock_timeout` 이 없으므로, 같은 트리거에 대한 동시 쓰기가
    누적되면 그 요청들의 커넥션이 락 해제까지 풀에 묶인 채 대기한다 — 다른 트리거·다른
    요청과는 무관하지만, **같은 트리거**에 비정상적으로 많은 동시 쓰기가 몰리는 극단적
    상황에서는 풀 슬롯을 오래 점유하는 요인이 될 수 있다. 코드 JSDoc·이전 concurrency 라운드가
    "새 공유 블로킹 자원"이라는 프레임으로 이미 이 트레이드오프를 명시했고, 임계 구간이 DB
    왕복 두 번(외부 호출 없음)으로 유계라는 근거로 수용됐다 — 커넥션 풀 고갈이라는 구체적
    프레임으로는 명시되지 않았을 뿐, 실질적으로 같은 위험의 다른 표현이라 새 지적은 아니다.
  - 제안: 조치 불요. 트리거 하나에 대한 동시 PATCH/rotate 빈도가 지금 가정(낮음)보다 커지면
    `SET LOCAL lock_timeout` 도입을 고려 — 이미 `trigger-config-lock.ts` JSDoc 에 그 조건이
    적혀 있다.

## 관점별 확인

- **인덱스**: 모든 신규/변경 쿼리는 PK(`id`), 일부는 `workspaceId` 와 조합 — 기존 인덱스로 충분, 신규 인덱스 불요.
- **N+1**: 반복문 내 개별 쿼리 없음. 모든 쓰기가 단일 트리거 단위 read-merge-write 로 배선됨(`rewriteTriggerConfigLocked`·창 1 모두 1행 대상).
- **트랜잭션**: `manager.transaction()` + `pg_advisory_xact_lock(hashtext($1))` 조합이 4개 쓰기 창(창1·binder 성공·binder 실패·rotateBotToken) 모두에 일관되게 적용됐다. 외부 HTTP 호출(`adapter.setupChannel`)을 트랜잭션/락 밖에 두어 저장소의 기각된 선례(Cafe24 advisory lock — HTTP 를 트랜잭션에 묶으면 커넥션 점유 길어짐)를 정확히 피했다. 이전 라운드가 지적한 "창 1이 형제 창의 부분 UPDATE 를 되돌린다" WARNING 은 `target = fresh ?? trigger` 전환으로 해소됐다(위 발견사항 1번).
- **마이그레이션 안전성**: 이번 변경에 DDL 없음 — 해당 없음.
- **스키마 설계**: `Trigger.config`(jsonb) 를 락 안에서 재읽은 최신 값 위에 서브키만 머지하는 방식으로 통일 — lost-update 근본 원인(스냅샷 기반 통째 덮어쓰기)을 이 diff 범위 안의 4개 창에서 구조적으로 제거했다. 같은 엔티티에 아직 무가드 `save()` 로 남은 8곳(위 발견사항)이 있어 모듈 전체로 보면 두 정합성 모델이 당분간 공존하지만, 그 경계는 계획서에 명시돼 있다.
- **커넥션 관리**: `manager.transaction()` 이 커넥션 획득/해제를 관리하며, 정상/예외 경로 모두 콜백 종료 시 반환된다. `pg_advisory_xact_lock` 은 트랜잭션 종료(커밋/롤백) 시 자동 해제되어 락 누수 없음. `lock_timeout` 부재로 인한 풀 점유 연장 가능성은 위 발견사항에 재확인 차원으로 기록.
- **SQL 인젝션**: `SELECT pg_advisory_xact_lock(hashtext($1))` 및 e2e 의 모든 raw 쿼리(`UPDATE trigger SET config = $2::jsonb WHERE id = $1`, `SELECT config FROM trigger WHERE id = $1`, `DELETE FROM trigger WHERE id = $1`)가 파라미터 바인딩을 사용 — 문자열 concat 없음. 안전.
- **대량 데이터**: 단일 행 조회/갱신만 발생, 페이지네이션·대용량 스캔과 무관.

## 요약

이번 라운드는 새 코드를 추가하기보다 이전 두 라운드(`18_17_44`, `19_07_43`)의 DB 지적사항이
실제로 해소됐는지를 검증하는 성격이 강하다. 가장 중요한 확인은 19_07_43 라운드가 MEDIUM 으로
등재했던 "창 1(`update()`)의 `save(trigger)` 가 같은 advisory lock 을 공유하는 형제 창의 부분
UPDATE(`chatChannelHealth`/`chatChannelTokenV2`/`chatChannelRotatedAt` 등)를 되돌릴 수 있다"는
결함이, 저장 대상을 락 이전 스냅샷(`trigger`)에서 락 안 재읽은 행(`fresh`)으로 바꾸는 수정으로
해소됐다는 점이다 — 코드·테스트(뮤테이션 커버리지 포함) 양쪽에서 확인했다. 추가로 웹훅 인입
hot path(`hooks.service.ts` 두 자리)도 전체 엔티티 `save()` 에서 컬럼 한정 `update()` 로
전환돼, PATCH-PATCH 경합보다 훨씬 잦은 fail-open 재발 경로를 닫았다. 파라미터화 쿼리·PK 기반
조회·트랜잭션/락 경계 설계(외부 호출을 락 밖에 두는 것) 모두 이 저장소의 기존 선례를 정확히
따른다. 남은 항목(삭제 레이스의 좁은 창, 같은 클래스의 무가드 `save()` 8곳, 타임스탬프 캡처
시점, 무제한 락 대기의 커넥션 점유 함의)은 전부 INFO 수준이며, 데이터 손상 위험이 없거나
이미 계획서(`plan/in-progress/trigger-config-lost-update.md` §D)에 전수 열거·처분되어 이번
PR 을 막을 사유가 아니다.

## 위험도

LOW
