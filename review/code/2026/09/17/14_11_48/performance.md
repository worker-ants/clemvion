# 성능(Performance) 리뷰 — `trigger-save-partial-patch`

## 범위 요약

핵심 변경은 `codebase/backend/src/modules/triggers/triggers.service.ts` `TriggersService.update()` 의
저장 대상을 "재읽은 엔티티 통째" → "이 요청이 바꾸는 필드 + `config` 만 담은 부분 객체"로 좁힌 것
(`m.save(Trigger, { id: target.id, ...patch })`, 707~712행 부근). 나머지 파일은 테스트(mock 비동기화,
단위 회귀 2건, 신규 e2e 특성 테스트)·문서(CHANGELOG·plan)로, 런타임 경로에 영향이 없다.

## 발견사항

- **[INFO]** advisory lock 보유 시간은 이 diff 로 새로 늘지 않는다 — 이미 알려진 트레이드오프의 연장
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `update()` 632~718행 (트랜잭션
    블록 전체), 특히 707~711행
  - 상세: `save()`(엔티티 diff 기반 UPDATE, 내부적으로 저장 시점 DB 재읽기를 한다는 것이 이 PR 의
    실측 근거)를 `update()`(단순 UPDATE, 재읽기 없음) 대신 계속 쓰는 결정은 **이 PR 이전에 이미
    확정**된 것이고(코드 주석: "`update` + 재조회로 바꿨다가 되돌린 이력"), 직전 라운드
    (`review/code/2026/09/17/13_44_39` database INFO#9)에서 "lock 보유 시간 소폭 증가" 로 이미
    트래킹되어 있다. 이번 diff 는 그 `save()` 호출에 넘기는 **payload 크기만** 줄였을 뿐이라
    (통째 엔티티 → 필드 몇 개짜리 부분 객체), advisory lock 보유 시간을 늘리는 방향의 신규 변경은
    아니다 — 오히려 직렬화할 컬럼 수가 줄어 TypeORM 의 diff 계산·쿼리 파라미터 수가 약간 작아지는
    쪽이다. 새로 지적할 회귀는 없고, 기존 트래킹 항목이 유효함을 확인했다.
  - 제안: 조치 불요 — 이미 등재된 항목. 트리거 PATCH 트래픽이 늘면 `lock_timeout` 초과율을
    관측하라는 기존 권고를 유지.

- **[INFO]** 신규 e2e 특성 테스트가 트랜잭션당 SELECT/UPDATE 를 명시적으로 다중 실행하지만, 이는
  운영 hot path 가 아니라 CI 전용 검증 코드다
  - 위치: `codebase/backend/test/trigger-update-save-window.e2e-spec.ts` `saveAfterCascade`(108~128행 부근)·
    `saveAfterColumnWrite`(155~177행 부근)
  - 상세: 각 `it` 마다 워크플로/트리거 생성용 HTTP POST 2회 + 트랜잭션 내 `findOne`+경합 `UPDATE`/`DELETE`+
    `save` + 사후 조회 `SELECT` 를 수행한다. 테스트 스위트 규모(6건)에서는 무시할 수준이고, 프로덕션
    쿼리 패턴과 무관하다(순수 CI 실행 시간에만 영향). N+1 로 볼 대상이 아니다.
  - 제안: 조치 불요.

- **[INFO]** `patch` 객체 도입으로 저장/응답 경로의 소규모 객체 할당이 하나 늘었지만 무시 가능한 수준
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` 710~712행 (`const patch = { ...defined, config: mergedConfig }; const written = await m.save(Trigger, { id: target.id, ...patch }); Object.assign(target, patch);`)
  - 상세: 요청당 필드 몇 개짜리 얕은 스프레드 2회(patch 조립 + save 인자 조립)로, PATCH 요청 처리
    시간에 측정 가능한 영향을 줄 규모가 아니다. 오히려 종전의 `Object.assign(target, defined, {config: mergedConfig})` + `m.save(Trigger, target)`(전체 엔티티, 관계 포함 객체를 직렬화) 대비 **저장
    payload 가 작아져** TypeORM 이 diff 를 계산하는 컬럼 수·쿼리 파라미터 수가 줄었다 — 성능
    방향은 중립 내지 약간 긍정적이다.
  - 제안: 조치 불요.

- **[INFO]** N+1/캐싱/블로킹 I/O/데이터 구조 관점에서 신규 결함 없음
  - 위치: `TriggersService.update()` 전체
  - 상세: 반복문 안에서 DB·API 를 호출하는 패턴, 반복 계산을 캐싱해야 할 자리, 동기 블로킹 I/O,
    부적절한 자료구조(예: 배열을 사용해야 할 곳에 객체, 혹은 그 반대) 사용은 diff 전체에서 발견되지
    않았다. 트랜잭션 내 쿼리 수(락 획득 1 + `findOne` 1 + `save`(내부 diff-read 포함) 1~2)는 이
    diff 이전과 동일한 구조이고, 이 diff 는 그중 `save` 에 넘기는 **인자 모양만** 바꿨다. 직전
    라운드에서 router 가 이 계열 변경을 "단건 트리거 행 저장 방식 변경, 성능 특성 변화(신규
    쿼리 패턴·N+1 등) 없음"으로 판단해 performance reviewer 를 제외했던 것과 부합하는 결론이다.
  - 제안: 없음.

## 요약

이번 diff 는 `PATCH /api/triggers/:id` 의 락 안 `save()` 호출에 넘기는 객체를 "재읽은 엔티티 통째"에서
"이 요청이 바꾸는 필드만 담은 부분 객체"로 좁힌 데이터 정합성 버그 수정이며, 트랜잭션당 쿼리 개수·
루프 구조·I/O 패턴·캐싱 필요성 어느 축으로도 성능 특성을 악화시키지 않는다. 오히려 저장 payload
크기가 줄어 방향은 중립~약간 긍정적이다. 유일하게 성능과 맞닿은 항목(advisory lock 보유 시간)은
이 PR 이전부터 있던 `save()` vs `update()` 선택의 트레이드오프이며 직전 리뷰 라운드에서 이미
INFO 로 트래킹되어 있고, 이번 diff 가 그것을 더 악화시키지 않았음을 확인했다. 신규 e2e 특성
테스트는 CI 전용 코드로 운영 쿼리 패턴에 영향이 없다. 성능 관점에서 이 PR 을 막을 이유는 없다.

## 위험도
NONE
