# 성능(Performance) 리뷰 — `trigger-save-partial-patch` (3라운드)

## 범위 요약

핵심 변경은 `codebase/backend/src/modules/triggers/triggers.service.ts` `TriggersService.update()` 의
advisory lock 안 저장 방식을 "재읽은 엔티티 통째 `save`" → "이 요청이 바꾸는 필드 + `config` 만 담은
부분 객체 `save`" 로 좁힌 데이터 정합성(lost-update) 수정이다 (`const patch = { ...defined, config:
mergedConfig }; const written = await m.save(Trigger, { id: target.id, ...patch });`). 이번 라운드
(14_34_56)의 diff 자체는 이전 두 라운드(13_44_39 → 14_11_48)에서 이미 성능 NONE 으로 판정된 코드에 대해
CHANGELOG 문구 정정·mock JSDoc 재측정 규칙화(숫자 삭제)·주석 정정만 추가한 것으로, `triggers.service.ts`
의 런타임 로직 자체는 이전 라운드 대비 변경이 없다. 직접 소스(`triggers.service.ts` 590~730행)를 다시
읽고 e2e 신규 파일(`trigger-update-save-window.e2e-spec.ts`) 전문을 대조해 독립적으로 재확인했다.

## 발견사항

- **[INFO]** advisory lock 보유 시간·트랜잭션당 쿼리 수는 이 diff 로 변하지 않는다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `TriggersService.update()`
    트랜잭션 블록(`acquireTriggerConfigLock` 호출부터 `return target` 까지)
  - 상세: 락 획득 1 + `findOne`(관계 `workflow` 포함) 1 + `save`(내부 diff 계산을 위한 저장 시점
    재읽기 포함) 1 라는 쿼리 구조는 이전 라운드와 동일하며, 이번 diff 는 `save` 에 넘기는 **인자
    모양만**(통째 엔티티 → `{id, ...defined, config}` 부분 객체) 바꿨다. 오히려 직렬화되는 컬럼 수가
    줄어 TypeORM 의 diff 계산·UPDATE 파라미터 수는 약간 작아지는 방향이라 성능에 부정적 영향이 없다.
    직전 두 라운드(`14_11_48`, `13_44_39`)의 performance/database 리뷰가 이미 같은 결론(NONE)에
    도달했고, 소스를 직접 재확인한 결과도 일치한다.
  - 제안: 조치 불요.

- **[INFO]** 신규 e2e 특성 테스트(`trigger-update-save-window.e2e-spec.ts`)는 CI 전용 코드로, 트랜잭션당
  다중 SELECT/UPDATE/DELETE 를 명시적으로 수행하지만 운영 hot path 와 무관하다
  - 위치: `codebase/backend/test/trigger-update-save-window.e2e-spec.ts` `saveAfterCascade`(108~128행),
    `saveAfterColumnWrite`(155~177행), `② … 반환값은 DB 재조회가 아니다`(188~214행)
  - 상세: 각 `it` 마다 워크플로/트리거 생성용 HTTP POST 2회 + 별도 `pg.Client` 쿼리 + `DataSource`
    트랜잭션 내 `findOne`+경합 `UPDATE`/`DELETE`+`save`+사후 `SELECT` 를 수행한다. 스위트 규모(7건,
    `describe` 3그룹)에서 CI 실행 시간에 미치는 영향은 무시할 수준이고, 프로덕션 쿼리 패턴을 대표하지
    않는다. `afterAll` 에서 `ds.destroy()`·`db.end()` 를 모두 호출해(102~105행) 커넥션 누수도 없음을
    확인했다(`jest.config.ts` 주석이 이 예외를 명시적으로 문서화한 것과 일치).
  - 제안: 조치 불요.

- **[INFO]** `trigger-transaction-mock.ts` 의 `save` mock 동기→비동기 전환은 테스트 유틸리티 변경으로
  런타임 성능과 무관
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` (`save:
    jest.fn(async (_entity, target) => { … })`)
  - 상세: 운영 코드가 `m.save(...)` 반환값의 `.updatedAt` 을 실제로 `await` 해 읽게 된 것에 대역을
    맞춘 변경이며, jest 목(mock) 이라 프로덕션 요청 경로의 지연시간과 무관하다.
  - 제안: 조치 불요.

- **[INFO]** N+1/캐싱/블로킹 I/O/부적절한 자료구조 관점에서 신규 결함 없음
  - 위치: `TriggersService.update()` 전체, `trigger-update-save-window.e2e-spec.ts` 전체
  - 상세: 반복문 안에서 DB·외부 API 를 호출하는 패턴, 반복 계산을 캐싱해야 할 자리, 동기 블로킹
    I/O, 용도에 맞지 않는 자료구조(선형 탐색이 필요한 곳에 없는 인덱스 등)는 diff 전체에서 발견되지
    않았다. `Object.fromEntries(Object.entries(rest).filter(...))`(613~615행)와 `{ ...defined, config:
    mergedConfig }`(710행)는 요청당 필드 몇 개짜리 얕은 객체 스프레드로, 측정 가능한 오버헤드가 아니다.
  - 제안: 없음.

## 요약

이번 라운드의 diff 는 이전 두 라운드에서 이미 성능 NONE 으로 확정된 `PATCH /api/triggers/:id` 부분
객체 `save` 수정에 대해 문서·주석·mock JSDoc 만 정정한 것이며, 런타임 쿼리 구조·루프·I/O 패턴·캐싱
필요성 어느 축에서도 성능 특성을 바꾸지 않는다. 저장 payload 가 통째 엔티티에서 부분 객체로 줄어든
방향은 여전히 중립~약간 긍정적이다. 신규 e2e 특성 테스트는 CI 전용이며 커넥션 정리도 확인됐다. 소스를
직접 재확인한 결과 이전 라운드의 결론과 일치하며, 이번 라운드에서 새로 발견한 성능 결함은 없다.

## 위험도

NONE
