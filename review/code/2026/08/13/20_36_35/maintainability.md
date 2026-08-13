# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

- **[WARNING]** UPDATE/DELETE `RETURNING` 튜플 문제에 대한 해법이 코드베이스에 3가지 서로 다른 관용구로 공존한다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:63-78` (`이미 올바른 두 선례는 그대로 유지된다` 테스트가 이 3-way 분기를 명시적으로 고정), `codebase/backend/src/common/utils/update-returning-rows.ts:1-35` (신규 공유 헬퍼)
  - 상세: 같은 TypeORM 튜플 문제에 대해 (1) `agent-memory-admin.service.ts` 의 로컬 `deletedRowCount()` 헬퍼, (2) `stuck-document-recovery.service.ts` 의 `const [rows] = await …query()` 구조분해, (3) 이번에 새로 도입된 공유 `updateReturningRows()` 세 가지 관용구가 동시에 존재한다. plan(`plan/in-progress/update-returning-tuple-shape.md`)도 두 기존 선례를 "이미 올바르다"며 통합하지 않기로 명시적으로 결정했다. 스코프 확대를 피하려는 합리적 판단이지만, 이후 이 문제를 처음 마주치는 개발자는 세 가지 해법 중 어느 것을 따라야 할지 판단 기준이 없다 — 신규 지점에서 로컬 헬퍼를 또 재발명하거나 구조분해를 베낄 위험이 남는다.
  - 제안: 최소한 `updateReturningRows` 의 JSDoc 또는 관련 spec 파일 주석에 "신규 지점은 이 헬퍼를 쓰고, 기존 두 선례는 과거 호환을 위해 유지만 한다"는 지침을 한 줄 명시하면 향후 판단 비용을 줄일 수 있다. 별도 PR 로 세 곳을 완전히 통합할지는 별개 결정.

- **[WARNING]** 구조적 회귀 가드 테스트가 정규식 매칭 개수(2, 5, 3, 10)를 두 특정 서비스 파일에 하드코딩해, 무관한 리팩터링에도 깨지기 쉽다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:46` (`CONSUMING` 정규식), `:49-52` (`EXPECTED` 배열의 `[파일, 2]`/`[파일, 5]`), `:54-61` (helper 호출 수 검증), `:80-88` (소비 지점 총수 `[3, 10]` 검증)
  - 상세: 이 테스트는 `execution-engine.service.ts`/`knowledge-base.service.ts` 두 파일에서 `const 변수 = await …query(` 패턴과 `updateReturningRows(`/`updateReturningRows<` 패턴의 **문자열 등장 횟수**를 정확히 맞춰야 통과한다. 의도(신규 소비 지점이 헬퍼 없이 추가되는 것을 막는 tripwire)는 타당하고, 주석도 "정적 grep 이라 정밀하지 않다" 며 한계를 스스로 인정하고 있다. 다만 유지보수 관점에서는 — 이 두 파일에 대한 **UPDATE/DELETE 와 무관한** 리팩터링(예: 로직 재정렬로 `let` 변수 도입, 다른 raw query 추가, 파일 분할)도 이 개수를 바꿔 테스트를 깨뜨릴 수 있고, 실패 메시지(`Expected: 5, Received: 6`)만으로는 "진짜 회귀"인지 "우연한 개수 변화"인지 코드를 다시 읽어야 판별 가능하다. 즉 이 테스트는 향후 이 두 파일을 건드리는 모든 PR 에 낮은 확률의 잡음 비용을 부과한다.
  - 제안: 이미 인지된 트레이드오프이므로 현 상태 유지도 방어 가능하지만, 실패 시 조사 부담을 줄이려면 `expect(helper).toBe(count)` 실패 메시지에 "개수가 늘었으면 새 UPDATE/DELETE 소비 지점에 헬퍼 적용 여부를 확인하라, 무관한 변경이면 EXPECTED 값을 갱신하라" 같은 커스텀 메시지를 붙이는 것을 고려.

- **[INFO]** `updateReturningRows(...)` 호출부에서 반환값을 변수로 받아 재사용하는 지점과 인라인으로 1회만 쓰는 지점의 스타일이 갈린다.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:345`, `:719` (인라인, CAS 락 체크 1회성) vs `:541`, `:572`, `:740` (각각 `rowsOut`/`rowsOut`/`resetRows` 변수로 받아 재사용)
  - 상세: 사용 패턴(1회성 길이 체크 vs 이후 `.map`/`.length` 반복 사용) 차이에서 자연스럽게 갈린 것이라 실질적 문제는 아니지만, `resetRows` 와 `rowsOut` 처럼 변수명이 상황마다 다르게 지어져 패턴을 한눈에 알아보기는 약간 어렵다.
  - 제안: 선택사항 — 필수 수정 아님.

- **[INFO]** `execution-engine.service.spec.ts` 에 추가된 두 신규 테스트(`실측 shape([rows,count])로도 admitted 여야 한다`, `실측 shape 로 0행 매칭…`)가 arrange 블록을 상당 부분 중복한다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4405-4424`, `:4426-4446`
  - 상세: 두 테스트는 `mockExecutionRepo.manager.transaction` mock 값(`[[{id:'e1'}],1]` vs `[[],0]`)과 기대 방향(`toBe('admitted')` vs `not.toBe('admitted')`)만 다르고 나머지 arrange/act/finally 골격이 동일하다. 같은 파일의 신규 `update-returning-rows.spec.ts` 는 이런 반복을 `it.each` 로 통합했는데, 이 두 테스트는 그렇게 하지 않았다.
  - 상세2: 다만 이 스타일(케이스별 개별 `it` + 인라인 mock, 파라미터화 미사용)은 이 파일 전체의 기존 관례이기도 해서(예: 근처 `cap 여유(affected=1) → admitted…` 테스트도 동일 패턴), 이번 diff 만의 새로운 일탈은 아니다.
  - 제안: 필수 수정 아님 — 기존 파일 컨벤션과 일관되므로 그대로 두어도 무방.

## 요약

이번 변경은 TypeORM 이 `UPDATE`/`DELETE … RETURNING` 에서만 `[rows, rowCount]` 튜플을 돌려주는 실측 결함을 단일 헬퍼(`updateReturningRows`)로 봉합하고, 7개 소비 지점(execution-engine 2곳, knowledge-base 5곳)을 교체했다. 헬퍼 자체는 짧고 JSDoc 이 실측 근거·실패 모드를 명확히 설명하며, 신규 테스트(`update-returning-rows.spec.ts`)도 정상 경로·예외 경로·회귀 가드를 고르게 커버해 가독성·함수 길이·복잡도 측면에서 문제가 없다. 가장 눈에 띄는 유지보수성 트레이드오프는 (1) 같은 문제에 대한 해법이 코드베이스에 3가지 관용구로 공존하게 됐고 이를 통합하지 않기로 의도적으로 결정한 점, (2) 회귀 방지용 구조적 가드 테스트가 두 파일의 문자열 매칭 개수에 정밀히 결속돼 있어 향후 무관한 리팩터링에도 실패할 수 있다는 점이다. 둘 다 문서(plan/헬퍼 JSDoc)에 근거와 한계가 이미 명시돼 있어 "몰랐던 부채"는 아니지만, 다음 유지보수자를 위해 "언제 어떤 관용구를 따를지" 한 줄 지침을 남겨두는 것을 권장한다. 전반적으로 CRITICAL 급 유지보수성 결함은 없다.

## 위험도

LOW
