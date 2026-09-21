# 동시성(Concurrency) 리뷰 — model-config 동시 DELETE 중복 감사 수정

## 발견사항

CRITICAL/WARNING 없음. 아래는 검증 과정과 참고용 INFO 하나다.

- **[INFO]** `notifyInvalidated` 이후 `recordAudit` 실패 시 순서 비대칭 (사전부터 있던 패턴, 이번 diff 로 `remove()` 경로에 확장 적용됨)
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` — `remove()` 메서드, 게이트 430(`this.notifyInvalidated(id);`)~437(`await this.recordAudit({...})` 종료) 사이
  - 상세: `delete()` 로 승자가 확정된 뒤 `notifyInvalidated(id)` 를 동기 호출하고, 그다음 `await this.recordAudit(...)` 를 호출한다. `recordAudit` 이 실패(예: DB 커넥션 문제)하면 캐시 무효화 통지는 이미 나갔는데 감사 기록은 남지 않는 상태가 된다. 다만 이는 `update()`(게이트 341~348)에도 이미 존재하는 기존 순서이고 이번 diff 가 새로 만든 것이 아니며, plan 문서(`plan/in-progress/modelconfig-dup-delete.md` §B)에서도 "무효화는 best-effort 부수효과"로 명시적으로 다뤄진 기존 설계다. 동시성 결함은 아니고 신규 이슈로 보지 않는다.
  - 제안: 조치 불요(기존 설계 범위). 필요하다면 별도 트래커로 "감사-통지 순서/실패 처리" 일반 정책을 논의.

## 분석 상세

### 핵심 변경 — `ModelConfigService.remove()` (`codebase/backend/src/modules/model-config/model-config.service.ts`)

기존 결함: `findEntity`(무락 SELECT) 뒤 `this.repo.remove(config)` 를 호출했는데, TypeORM `remove()` 는 대상 행이 이미 없어도 예외를 던지지 않는다. 두 동시 DELETE 요청이 둘 다 무락 조회를 통과하면 둘 다 `remove()` 를 "성공"으로 처리해 `model_config.delete` 감사 행이 두 번 남았다(실측: plan 문서에 "고치기 전 `[204, 204]`, 감사 2건" 기록).

수정 후:
```ts
const { affected } = await this.repo.delete({ id, workspaceId });
if (affected === 0) {
  throw this.notFound();
}
```

- **경쟁 조건**: `DELETE ... WHERE id = ? AND workspaceId = ?` 단일 SQL 문은 Postgres 에서 그 자체로 원자적 트랜잭션이다. 두 커넥션이 동시에 같은 행을 대상으로 DELETE 를 실행하면, 먼저 도착한 트랜잭션이 행 락을 얻어 삭제·커밋하고, 뒤의 트랜잭션은 그 커밋을 기다렸다가(READ COMMITTED) WHERE 절을 재평가해 행이 이미 없으므로 0행 삭제(`affected: 0`)로 끝난다. `findEntity` 의 무락 조회와 실제 삭제 사이에 TOCTOU 간극이 있어도, 최종 판별이 DB 가 보장하는 `affected` 카운트이므로 감사 중복이 발생하지 않는다. 형제 7건(#1369~#1374)과 동일한 검증된 패턴이다.
- **원자성**: "확인 후 행동" 복합 연산을 단일 원자적 DELETE 문 + `affected` 판별로 대체해 원자성을 DB 레벨에서 확보했다. `!affected` 같은 truthy 비교 대신 `affected === 0` **명시 비교**를 쓴 점도 맞다 — `undefined`/`null` (드라이버가 rowCount 를 보고하지 않는 경우)을 "삭제 실패"로 오판하지 않는다. 이 구분이 없어서 과거(#1371) 뮤턴트 32건이 통과한 전례가 있었는데, 이번 PR 은 대조군 테스트(`it.each([[undefined],[null]])`)로 그 회귀를 명시적으로 방어한다.
- **데드락**: 새로 도입된 락(advisory lock, `SELECT ... FOR UPDATE` 등)이 없다. `delete()` 는 단일 문장(암묵적 자동커밋 트랜잭션)이라 사전에 어떤 락도 보유한 채 대기하지 않는다 — `saveWithDefaultSwap`/`setDefault` 의 명시적 트랜잭션(두 단계 UPDATE)과 동시에 실행되어도, DELETE 쪽이 락을 선점 대기 중일 뿐 다른 락을 쥐고 있지 않으므로 상호 대기(데드락) 조건이 성립하지 않는다.
- **kind 캡처 순서**: `const { kind } = config;` 를 `delete()` 호출 **이전**에 읽는다. 종전 `remove(entity)` 는 엔티티 객체의 `id`(및 관련 필드)를 지웠기 때문에 순서가 중요했지만, `delete(criteria)` 는 엔티티 객체를 전혀 건드리지 않으므로 이 순서 자체는 더 이상 정합성에 영향을 주지 않는다(diff 의 주석 및 테스트 설명이 이 점을 정확히 반영해 과거 "순서 고정" 테스트를 vacuous 판정하고 제거했다 — 근거 타당).
- **진 쪽 처리**: `affected === 0` 이면 `notifyInvalidated`/`recordAudit` 모두 건너뛰고 즉시 `this.notFound()` 를 던진다. 승자만 통지·감사를 남기므로 "감사 두 번" 결함이 재발하지 않는다. 404 코드가 형제들의 `RESOURCE_NOT_FOUND` 가 아니라 `MODEL_CONFIG_NOT_FOUND`(기존 `findEntity` 실패와 동일 코드)인 이유도 plan 문서에서 실측 근거(도메인 고유 코드 유지)로 뒷받침된다.

### 테스트 커버리지 검증

- **단위 테스트** (`model-config.service.spec.ts`): `describe('remove — 동시 삭제', ...)` 블록이 (a) 진 쪽 — `affected: 0` → 404 `MODEL_CONFIG_NOT_FOUND`, 감사·리스너 모두 미호출을 단언하고, (b) 대조군 — `affected: undefined`/`null` → 정상 삭제로 취급(감사 호출됨)을 `it.each` 로 단언한다. `!affected` 로의 회귀를 잡는 대조군이 명시적으로 포함되어 과거(#1371) 결함 클래스의 재발 방지 근거가 확실하다.
- **e2e 테스트** (`model-config-delete-concurrency.e2e-spec.ts`, 신규): 별도 커넥션(`locker`)으로 대상 행을 `SELECT ... FOR UPDATE` 로 잡아 두 DELETE 요청을 실제로 겹치게 만든다. 락 해제 전에 `Promise.race` 로 "아직 둘 다 끝나지 않았음"을 공허성 가드로 확인한 뒤 락을 풀어 `[204, 404]` + 감사 1건을 단언한다. 실제 DB 레벨 행 락을 이용해 애플리케이션 레벨 인터리빙을 강제하는 방식으로, 목(mock) 기반 단위 테스트가 놓칠 수 있는 실제 동시성 타이밍을 검증한다 — 방법론이 견고하다.

### 뮤테이션 검증 여부

저장소 파일을 직접 수정해 재현하지는 않았다(plan 문서 §체크리스트에 이미 개발자가 `cp` 백업 방식으로 뮤테이션 검증을 수행했다고 기록되어 있고 — `=== 0` → `!affected` 뮤턴트로 대조군 2건 RED, 404 분기 제거로 진 쪽 1건 RED — 병렬 리뷰 중 저장소를 건드리지 않기 위해 별도 재현은 생략했다). `git status --short` 로 확인한 결과 본 리뷰 세션에서 저장소에 남긴 변경은 없다.

## 요약

`ModelConfigService.remove()` 의 동시 DELETE 이중 감사 결함을 "확인 후 행동(무락 SELECT → 무조건 성공 처리되는 `remove()`)" 패턴에서 "단일 원자적 `DELETE` + `affected === 0` 명시 비교" 패턴으로 전환한 수정이다. 이 패턴은 같은 코드베이스에서 이미 7차례(#1369~#1374) 검증·적용된 것과 동일하며, DB 의 행 수준 락/커밋 가시성에 의존해 애플리케이션 레벨 락 없이도 원자성을 보장한다는 점에서 설계가 타당하다. `affected` 판별을 `!affected` 대신 `=== 0` 로 명시 비교해 드라이버 미보고(`undefined`/`null`)를 오판하지 않도록 방어했고, 이를 검증하는 대조군 단위 테스트와 실제 DB 행 락으로 인터리빙을 강제하는 e2e 테스트가 모두 포함되어 있다. 신규 락 도입이 없어 데드락 가능성도 없고, kind 캡처 순서·진 쪽 스킵 로직도 정확하다. 새로 도입된 CRITICAL/WARNING 급 동시성 결함은 발견되지 않았다.

## 위험도

NONE
