# 동시성(Concurrency) 리뷰

## 발견사항

해당 없음.

검토 대상 diff(`CHANGELOG.md`, `login-history.service.ts`/`.spec.ts`,
`background-runs.service.ts`/`.spec.ts`, `plan/in-progress/*.md`)는 keyset 커서의 `id`
성분에 `isUuidShaped()`(순수 동기 정규식 함수, `common/utils/uuid.ts` — 이번 diff에서
신설되지 않고 기존 함수를 새로 import) 검증을 추가해 Postgres SQLSTATE 22P02(비-UUID
바인딩) 유발 500을 각 엔드포인트 기존 실패 계약(무시 후 1페이지 / 400
`INVALID_CURSOR`)으로 바꾸는 순수 입력 검증 변경이다.

- 새 코드는 동기 함수(`decodeCursor`) 내부의 조기 반환/조기 throw 분기 추가뿐이며, 공유
  가변 상태·락·세마포어·스레드/커넥션 풀 설정을 전혀 건드리지 않는다.
- `background-runs.service.ts`의 `getBackgroundRun`에 있는 `Promise.all([...])` 병렬 조회
  (`fetchBodyPage`/`aggregateBodyStatus`/`fetchNotifications`)는 diff 범위 밖(기존 코드,
  줄 번호 unchanged)이며 이번 변경으로 인해 실행 순서·의존관계가 바뀌지 않는다 — `cursor`
  검증(`this.decodeCursor(query.cursor)`)은 이 `Promise.all` **이전**에 동기적으로 완료되고
  실패 시 즉시 throw 하므로 경쟁 조건을 만들지 않는다.
- 테스트 변경(`login-history.service.spec.ts`, `background-runs.service.spec.ts`)도 동기/
  단일 `await` 패턴의 assertion 추가일 뿐, mock 공유나 비동기 인터리빙을 새로 도입하지 않는다.
- `isUuidShaped`가 참조하는 `UUID_SHAPE_PATTERN` 정규식은 상태를 갖지 않는 top-level
  `RegExp` 리터럴이며 `test()` 호출 간 `lastIndex` 부작용이 있는 `g`/`y` 플래그가 없어
  동시 요청 간 상태 공유·경쟁 문제가 없다.

## 요약

이번 변경은 동기적 입력 검증(정규식 술어) 추가에 국한되며 락·공유 가변 상태·비동기 흐름
제어·리소스 풀 구성 어디에도 영향을 주지 않는다. 기존에 있던 `Promise.all` 병렬 조회는
diff 밖이고 이번 변경이 그 실행 순서에 개입하지 않으므로 동시성 관점에서 새로 도입된 위험이
없다.

## 위험도

NONE
