# 동시성(Concurrency) 리뷰

## 발견사항

- **[INFO]** `withFiles` 의 async-오용 감지는 "반환값이 thenable" 만 잡는다 — 콜백이 반환하지 않고 벌인 비동기 작업(예: `setTimeout`/`setImmediate`/미반환 detached promise)은 여전히 조용한 레이스로 남는다
  - 위치: `codebase/backend/src/common/__test-utils__/temp-fixture.ts:56-65` (`withFiles` 함수 본문)
  - 상세: 이번 diff 는 "리뷰 W4"에서 지적된 레이스(`fn` 이 async 함수라 pending `Promise` 를 반환하면 `finally` 의 `rmSync` 가 그 완료를 기다리지 않고 먼저 실행돼 tmpdir 이 조기 삭제되는 문제)를 고쳤다. 고친 방식은 회피가 아니라 **명시적 실패로 전환**이다 — `isThenable(result)` 로 반환값이 thenable 인지 검사해 즉시 `throw` 한다. 이 판정 자체는 정확하다(`async function` 은 항상 즉시 `Promise` 를 반환하므로 `isThenable` 이 반드시 `true` 를 낸다). 다만 탐지 범위가 "반환값" 에 한정돼 있어, 콜백이 `fn(paths) => { setTimeout(() => fs.readFileSync(paths['a.ts']), 0); }` 처럼 **반환하지 않는 비동기 부작용**을 예약하는 경우는 여전히 감지되지 않고 조용한 `ENOENT` 레이스가 재현 가능하다. 다만 이는 새로 만들어진 결함이 아니라 이 헬퍼가 "동기 콜백 전용" 이라는 계약 자체의 한계이며, JSDoc 이 이미 "동기 콜백 전용" 이라고 명시하고 현재 소비처는 전부 순수 동기(파일 읽기·문자열 매칭)라 실제 발현 경로가 없다.
  - 제안: 현재로선 조치 불필요(설계가 의도적으로 좁다 — "async 소비처가 생기면 그때 `async`/`await` 로 확장한다"는 방침이 코드 주석에 명시돼 있음). 향후 소비처를 추가할 때 콜백이 "반환값은 동기이지만 내부적으로 detached 비동기 작업을 예약"하지 않는지 코드 리뷰에서 확인하는 정도로 충분.

- **[INFO]** `isThenable` 감지로 `throw` 한 뒤, 원래 async 콜백이 반환했던 pending `Promise` 자체는 어디에도 `await`/`catch` 되지 않고 버려진다(dangling)
  - 위치: `codebase/backend/src/common/__test-utils__/temp-fixture.ts:56-65`
  - 상세: `const result = fn(paths); if (isThenable(result)) { throw ... }` 흐름에서, `result`(async 콜백이 즉시 반환한 pending `Promise`) 는 이후 어떤 참조도 유지하지 않은 채 스코프를 벗어난다. 콜백이 이후 `await` 지점에서 **reject** 하는 경우(예: 미래에 추가될 소비처가 `await someAsyncOp()` 를 쓰다가 실패), 그 rejection 은 아무도 처리하지 않는 unhandled promise rejection 으로 이벤트 루프에 남는다 — Jest 프로세스 전역에 `UnhandledPromiseRejectionWarning`(또는 Node 설정에 따라 프로세스 종료)를 일으켜, `withFiles` 호출부와 무관한 다른 테스트의 로그·종료 코드에 간섭할 수 있다. 현재 테스트(`temp-fixture.spec.ts`)의 async 픽스처들은 전부 `await` 없이 즉시 `resolve` 하는 값(`'ignored'`, `1`)만 반환하므로 이 경로는 실제로 발현하지 않는다.
  - 제안: 현재 우선순위는 낮음(발현 경로 없음, 헬퍼가 "동기 전용" 이라고 명시). 굳이 닫으려면 `if (isThenable(result)) { void (result as PromiseLike<unknown>).catch(() => {}); throw ...; }` 처럼 dangling promise 에 no-op catch 를 붙여 unhandled rejection 자체를 원천 차단할 수 있다 — 다만 이는 "동기 전용" 계약을 어기는 사용을 부드럽게 만드는 셈이라, 지금처럼 하드 fail 로 두고 문서화만 유지하는 현재 선택도 합리적이다.

## 요약

이번 diff 의 실질 변경은 대부분 Swagger DTO 선언(`@ApiPropertyOptional`→`@ApiProperty({nullable:true})` 등)과 신규 AST 기반 repo-guard(`swagger-dto-contract-guard.ts`)로, 둘 다 요청/응답 시점에 순수하게 동기적으로 동작하며 공유 가변 상태·락·비동기 조합이 없어 동시성 관점에서 위험이 없다. 유일하게 동시성과 맞닿은 자리는 `common/__test-utils__/temp-fixture.ts` 의 `withFiles` 헬퍼로, 이번 diff 가 정확히 "리뷰 W4"에서 지적된 조용한 async 레이스(콜백이 `Promise` 를 반환하면 `finally` 의 `rmSync` 가 완료를 기다리지 않고 먼저 실행돼 tmpdir 이 조기 삭제)를 회피가 아니라 **명시적 즉시 실패**로 전환해 고쳤다. `isThenable` 판정과 신설 `temp-fixture.spec.ts` 의 async 오용 테스트(콜백이 thenable 을 반환하면 `/동기 콜백만 지원/` 메시지로 throw, 그 경우에도 `finally` 는 여전히 돌아 tmpdir 이 지워짐)가 이 수정을 정확히 검증한다. 두 잔여 사항(반환하지 않는 detached 비동기 부작용 미탐지, dangling promise 의 잠재적 unhandled rejection)은 모두 현재 소비처가 0건인 이론적 여지라 INFO 로만 표기했고, 두 사항 다 실제 실행 경로가 없어 차단 사유가 아니다. 나머지 파일(DTO·repo-guard·plan·review 산출물)에는 스레드/프로세스 간 공유 자원, 락, async 조합 로직이 없다.

## 위험도
LOW
