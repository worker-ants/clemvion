# 동시성(Concurrency) 리뷰 — `trigger-cascade-window-probe`

## 범위 요약

핵심 변경은 `codebase/backend/src/modules/triggers/triggers.service.ts`
`TriggersService.update()`(창 1) — advisory lock(`acquireTriggerConfigLock`) 안에서 재읽은
`Trigger` 엔티티를 **통째로** `m.save(Trigger, target)` 하던 것을, **이 요청이 바꾸는 필드
(`defined`) + `config`(병합 결과) 만 담은 부분 객체**로 좁혔다(`const patch = { ...defined,
config: mergedConfig }; const written = await m.save(Trigger, { id: target.id, ...patch });`).
나머지 파일은 이 수정을 검증·문서화한다: 신규 e2e 특성 테스트
(`test/trigger-update-save-window.e2e-spec.ts`, 실제 Postgres + 별도 `DataSource` 로 트랜잭션
A 재읽기 → 연결 B 경합 커밋 → A 저장 인터리빙을 결정적으로 재현), 공용 mock
(`trigger-transaction-mock.ts` — `save` 를 `async` 로 바꾸고 반환값을 실제 TypeORM 처럼
"항상 객체" 로 보정), 단위 테스트(`triggers.service.spec.ts`), `jest.config.ts` 주석 갱신,
plan/CHANGELOG.

이 PR 은 이전 라운드(`review/code/2026/09/17/13_44_39`)의 처분을 반영한 결과물이며, 프롬프트에
그 라운드의 `concurrency.md`(LOW, INFO 2건)를 포함한 산출물 다수가 "리뷰 대상 파일"로 함께
들어와 있다 — 이들은 문서/리포트 산출물이므로 동시성 코드 관점의 재검토 대상이 아니다.

## 검증한 것

- `triggers.service.ts` `update()` 전체(551~766행 부근)를 직접 읽고, 락 획득(634행) →
  재읽기(641행) → `assertTriggerFound`(679행, `fresh` 가 null 이면 즉시 throw) → 부분 객체
  `save`(710~711행) → `Object.assign` + 조건부 `updatedAt` 반영(712~716행) 흐름을 대조했다.
- `assertTriggerFound`(356~359행)가 재읽은 행이 없을 때 저장을 아예 안 하고 던지는 것을
  확인 — `remove()`(1075행 부근)가 **같은 락 키**(trigger id)로 `acquireTriggerConfigLock` 을
  거치므로, "삭제 후 같은 id 로 되살아난다" 는 경로는 이 락으로 직렬화되어 막힌다.
- `config`(JSONB) 컬럼은 이번 수정 뒤에도 **매번 `patch` 에 포함**된다(넘기지 않는 컬럼 목록에
  안 들어간다) — 이 컬럼에 대한 lost-update 보호는 "컬럼을 안 싣는" 이번 수정과는 다른
  메커니즘(같은 advisory lock 을 공유하는 PATCH 끼리의 직렬화 + 별도 `config` JSONB
  키-단위 병합, `trigger-config-lost-update.e2e-spec.ts`)에 의존한다는 것을 확인했다 — 이번
  diff 가 그 메커니즘을 바꾸지 않았고, `config` 를 쓰는 다른 경로(`rotateBotToken`·binder)가
  건드리는 것은 `config` 자체가 아니라 별도 컬럼들(`chatChannelHealth` 등)이라는 점도
  주석·기존 코드로 교차 확인했다(파일 밖이라 상세 대조는 이번 diff 범위 밖).
- 신규 e2e(`trigger-update-save-window.e2e-spec.ts`)의 인터리빙 설계를 검토했다 — 별도
  connection(raw `pg.Client`)의 `UPDATE`/`DELETE` 는 autocommit 이라 트랜잭션 A 진행 중
  즉시 커밋되고, Postgres READ COMMITTED 는 문장 단위로 새 스냅샷을 잡으므로 A 안에서
  나중에 실행되는 `m.save()` 의 내부 재조회가 B 의 커밋을 실제로 관측한다 — 시나리오가
  이론이 아니라 재현 가능함을 논리적으로 확인했다.
- `save: jest.fn(async (_entity, target) => { const result = saveMock ? await saveMock(target)
  : undefined; return result ?? target; })` 변경이 async 로 바뀐 이유(호출부가 이제
  `written.updatedAt` 을 읽으므로 undefined 반환 시 `TypeError`)를 확인했고, 동기 throw 든
  비동기 throw 든 `await m.save(...)` 호출부 관점에서 최종적으로 rejected promise 로
  귀결되어 에러 전파 의미가 달라지지 않음을 확인했다.

## 발견사항

### INFO — `updatedAt` 폴백이 무신호로 스테일해질 수 있는 경로 (기존 INFO 재확인)
- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `if (written.updatedAt)
  target.updatedAt = written.updatedAt;` (`TriggersService.update()`, 트랜잭션 콜백 마지막 부분)
- 상세: `written.updatedAt` 이 falsy 인 경우 응답은 재읽기(`fresh`) 시점의 `updatedAt` 을 그대로
  낸다. 실제 Postgres 경로에서는 `@UpdateDateColumn` 이 항상 채우므로(e2e ②c
  `written.updatedAt` 을 `toBeInstanceOf(Date)` 로 실측) 발생 확률은 낮지만, 이 분기가 참이
  되는 경로(드라이버 교체·부분 객체가 `updatedAt` 을 포함하지 않을 때 TypeORM 내부 동작 변경
  등)를 직접 단언하는 회귀는 없다 — 조용히 stale timestamp 를 반환하는 유일한 폴백이다.
  이전 라운드(`review/code/2026/09/17/13_44_39/concurrency.md`)에서도 같은 지적이 있었고
  이번 diff 는 이 조건문 자체를 바꾸지 않았다.
- 제안: 차단 사유 아님. 여유가 있으면 `written.updatedAt` 부재를 로그 한 줄로 남기거나
  invariant 로 눈에 띄게 실패시키는 편이 조용한 폴백보다 안전하다.

### INFO — FK CASCADE 창은 advisory lock 범위 밖에 여전히 남아 있다 (회귀 아님, 재확인)
- 위치: `codebase/backend/test/trigger-update-save-window.e2e-spec.ts` `describe('① 재읽기 뒤
  workflow 삭제 (FK CASCADE — advisory lock 으로 못 막는 경로)', ...)`
- 상세: `acquireTriggerConfigLock` 은 trigger id 로 잠그므로, 부모 `workflow` 삭제(CASCADE)는
  이 락으로 직렬화되지 않는다. e2e ①/①b 가 "시끄러운 실패 + 롤백"(통째 엔티티는 23503,
  부분 객체는 23502)으로 끝나고 부활이 없음을 고정했으므로 데이터 손상은 없다 — 설계상
  수용된 gap 이고, 이번 diff 가 새로 만든 것도 아니다. plan(`plan/in-progress/
  trigger-save-partial-patch.md` "이 PR 이 안 하는 것")도 이를 인지하고 후속(404/409 매핑
  검토)으로 명시적으로 미룬 상태다.
- 제안: 조치 불요. 이 창이 "조용한 lost update" 로 바뀌는 방향의 변경(예: 저장 실패를 삼키는
  캐치 추가)이 향후 들어오면 즉시 재검토가 필요하다는 캐너리 역할은 이 e2e 파일이 이미 한다.

## 검증하지 않은 것

- `chat-channel-binder.service.ts`(binder/`rotateBotToken`)가 `config` JSONB 밖 컬럼들
  (`chatChannelHealth` 등)에 쓸 때 실제로 `acquireTriggerConfigLock` 을 거치는지는 diff 밖
  파일이라 직접 추적하지 않았다 — 기존 리뷰(`review/code/2026/09/14/19_07_43` database
  WARNING#2, `18_17_44` security CRITICAL#1)에서 이미 검증된 전제로 취급했다. 이번 diff 가
  그 잠금 경로 자체를 바꾸지 않았다.
- 저장소를 뮤테이션하는 검증(코드를 실제로 고쳐 재현)은 수행하지 않았다 — plan 문서가 이미
  실측(뮤턴트 M1~M4 RED, mock 배선 60 RED, `run-test-all.sh` e2e 314 ALL PASS)을 상세히
  기록하고 있고, 이번 검토에서 그 논리를 코드 대조로 재구성해 충분히 확인했다고 판단했다.
  저장소 상태는 건드리지 않았다(`git status --short` 로 확인할 변경 없음 — 아무 파일도
  쓰지 않았다).

## 요약

이번 diff 는 `#1334` 가 "이론적 TOCTOU" 로 유예했던 자리(advisory lock 재읽기 **이후** 락
밖에서 커밋된 컬럼이 `save()` 의 통째 엔티티 저장에 의해 옛 값으로 되써지는 lost-update)를
실제 Postgres + TypeORM 조합으로 재현해 확정하고, 저장 대상을 "이 요청이 바꾸는 필드 +
config" 로 좁혀 근본적으로 차단한다. 같은 락을 공유하는 형제 창(`remove()`)과의 직렬화,
재읽기 뒤 행이 사라진 경우의 되살리기 방지(`assertTriggerFound`)는 그대로 유지되고, FK
CASCADE 창(락으로 못 막는 별개 경로)은 손상 없는 loud failure 로 남아 있음이 신규 e2e 로
확인됐다. PR 진행 중 스스로 낸 회귀(부분 `save` 반환값을 통째로 덮어 `endpointPath` 를
지운 것)도 e2e 가 잡아 같은 PR 안에서 수정됐고 단위 테스트에 반영됐다. 이번 리뷰에서
새로 발견한 차단급 동시성 결함은 없다 — INFO 2건은 이전 라운드에서도 지적된 사항의
재확인이며 모두 비차단이다.

## 위험도
LOW — 실제 재현·뮤테이션 테스트로 뒷받침된 정당한 lost-update 수정이고, 이번 검토에서 새로
발견한 결함은 없다.
