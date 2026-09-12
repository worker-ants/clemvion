# 동시성(Concurrency) 리뷰

## 발견사항

해당 없음.

이번 변경 셋(CHANGELOG.md, `plan/in-progress/*.md`, `login-history.service.ts`/`.spec.ts`,
`background-runs.service.ts`/`.spec.ts`)은 실질적으로 keyset 커서의 `id` 성분에
`isUuidShaped()` 검증을 추가하는 것이 전부다. 두 곳(`login-history.service.ts:53-65`,
`background-runs.service.ts:165-181` — 게이트 숫자는 diff 기준) 모두:

- **순수 동기 함수**다 — `decodeCursor` 는 `await` 도 콜백도 없는 문자열 파싱/정규식 검사로,
  요청 스코프 지역 변수만 다루고 공유 가변 상태를 읽거나 쓰지 않는다.
- 새 검증 술어 `isUuidShaped`(`codebase/backend/src/common/utils/uuid.ts:45-47`)는 모듈
  레벨 `RegExp` 상수(`UUID_SHAPE_PATTERN`)를 쓰지만 `g`/`y` 플래그가 없어 `lastIndex` 상태를
  갖지 않는다 — 동시 요청이 같은 정규식 객체의 `.test()` 를 인터리빙 호출해도 서로 간섭하지
  않는다(참고: `g`/`y` 플래그가 있었다면 Node 의 단일 스레드 이벤트 루프 안에서도 동기 코드
  중간에 인터리빙이 없어 실제로는 문제가 안 되지만, 스테이트풀 정규식 재사용 자체가 잠재
  위험 패턴이라 짚어둔다 — 이번 건은 해당 없음).
- `background-runs.service.ts` 의 기존 `Promise.all([fetchBodyPage, aggregateBodyStatus,
  fetchNotifications])` 병렬화(주석 `W-17`)는 이번 diff 의 대상이 아니다 — 세 쿼리는 서로
  다른 read 라 경쟁 조건 여지가 없고, 변경도 이 병렬 블록 바깥(커서 디코딩 단계)에 있다.
- 테스트 파일 변경은 fixture 값 교체 + 신규 `it()` 케이스 추가뿐이며 async 오용(await 누락,
  fire-and-forget)이나 공유 mock 상태 오염 패턴은 없다 — 각 테스트는 `beforeEach` 로 매번
  새 mock 을 만든다.
- CHANGELOG.md·`plan/in-progress/*.md` 는 문서이며 실행 코드가 아니다.

락·세마포어·커넥션 풀·이벤트 루프 블로킹·원자성 위반에 해당하는 코드 변경이 없다.

## 요약

이번 변경은 keyset 커서 디코더 두 곳에 순수 동기 UUID-형태 검증을 추가하는 보안/정합성
수정이며, 스레드·비동기 병행성·공유 자원·락과 관련된 표면을 전혀 건드리지 않는다. 기존에
있던 `Promise.all` 병렬 조회 블록도 diff 밖 컨텍스트일 뿐 아니라 서로 독립적인 read 쿼리라
경쟁 조건 우려가 없다. 동시성 관점에서 지적할 사항이 없다.

## 위험도

NONE
