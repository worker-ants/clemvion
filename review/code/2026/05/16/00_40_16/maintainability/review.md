# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: `backend/src/modules/knowledge-base/graph/kb-stats.helper.ts`

- **[INFO]** `refresh()` 메서드가 `RETURNING` 절로 결과를 받아오지만 반환값을 완전히 무시함
  - 위치: L237 — `await this.dataSource.query(...)`
  - 상세: 변경 전 코드는 `rows[0]?.entity_count` 등으로 결과를 소비했으나, 변경 후 반환값이 `void` 이므로 DB가 RETURNING 결과를 생성해도 TypeScript 수준에서 아무런 단서가 없다. 현재는 의도적 선택(WebSocket emit 제거)이지만, 나중에 이 메서드를 읽는 개발자가 "왜 RETURNING을 쿼리에 두었는가"를 이해하려면 JSDoc 주석까지 읽어야 한다.
  - 제안: SQL에서 `RETURNING` 절을 제거하거나, 의도적으로 유지하는 이유를 인라인 주석으로 명시. 예: `/* RETURNING은 row 존재 여부 검증용 — count는 현재 미사용 */`

- **[INFO]** 타입 없는 `query()` 호출
  - 위치: L237 — `await this.dataSource.query(`
  - 상세: 변경 전 `dataSource.query<{ entity_count: number; relation_count: number }[]>(...)` 형태로 제네릭 타입을 명시했으나, 변경 후 타입 인자가 사라졌다. 결과값을 사용하지 않으므로 런타임 영향은 없지만, 쿼리 반환 구조에 대한 문서적 가치가 소실된다.
  - 제안: 결과를 사용하지 않더라도 `query<{ entity_count: number; relation_count: number }[]>` 제네릭을 유지하면 쿼리의 의도를 코드 자체에서 전달할 수 있다. 또는 `RETURNING` 제거와 함께 단순 `query<void>` 로 표기.

- **[INFO]** JSDoc 주석이 구현 파일과 spec 외부 문서를 교차 참조함
  - 위치: L229-231 — `plan/complete/kb-graph-stats-dead-path.md` 와 `spec/5-system/6-websocket-protocol.md` 참조
  - 상세: plan 문서는 작업 추적용이며 `complete/`로 이동한 이후에도 경로가 바뀔 수 있다. spec 문서 참조는 적절하나, plan 문서 참조는 시간이 지날수록 dead link가 될 수 있다.
  - 제안: plan 문서 참조 대신 `spec/5-system/6-websocket-protocol.md ## Rationale` 만 남기거나, plan 참조는 "결정 당시 근거 참조 (plan 은 archive 이동 예정)" 등의 단서를 덧붙인다.

---

### 파일 2: `backend/src/modules/knowledge-base/graph/kb-stats.helper.spec.ts` (신규)

- **[INFO]** 첫 번째 테스트가 SQL 구조 검증에 집중하나 반환값 미검증
  - 위치: L50-65 — `'runs a single atomic UPDATE...'` 테스트 블록
  - 상세: 테스트가 SQL 패턴(UPDATE, SET, WHERE, RETURNING)과 파라미터를 검증하고 있어 SQL 형식 회귀 방지 목적은 충족한다. 그러나 `helper.refresh('kb-1')`의 반환값(`Promise<void>`)에 대한 명시적 `resolves.toBeUndefined()` assertion이 없다. 현재 `await helper.refresh('kb-1')` 이후 예외 없이 실행되는 것만 암묵적으로 확인된다. 두 번째 테스트(`resolves.toBeUndefined()`)와 패턴이 불일치한다.
  - 제안: 첫 번째 테스트에도 `await expect(helper.refresh('kb-1')).resolves.toBeUndefined()` 형태로 명시적 assertion 추가. 또는 `await helper.refresh('kb-1')` 를 그대로 유지하되 `// resolves without error` 주석 추가.

- **[INFO]** `dataSource.query.mock.calls[0]` 접근 방식이 취약한 인덱스에 의존
  - 위치: L58 — `dataSource.query.mock.calls[0] as [string, unknown[]]`
  - 상세: `mock.calls[0]`은 "첫 번째 호출"을 의미하는 매직 인덱스다. 이미 `toHaveBeenCalledTimes(1)` assertion이 앞에 있어 호출 횟수는 보장되지만, `0` 이라는 숫자는 의미 없이 하드코딩된 것처럼 보인다. 더 표현력 있는 방법이 존재한다.
  - 제안: `jest.mocked(dataSource.query).mock.lastCall` 또는 `toHaveBeenCalledWith(expect.stringMatching(...), ...)` 형태로 개선하면 인덱스 의존 없이 더 가독성 높은 테스트가 된다.

- **[INFO]** SQL 정규식 패턴이 테스트 내 분산 배치
  - 위치: L60-64 — 5개의 `expect(sql).toMatch(...)` 호출
  - 상세: SQL 구조를 5개 정규식으로 개별 검증하는 방식은 각 assertion 실패 시 어떤 SQL 요소가 누락되었는지 명확히 드러나는 장점이 있다. 다만 정규식 리터럴이 테스트 본문에 직접 기재되어, 향후 SQL 변경 시 어떤 패턴이 무슨 의미인지 추가 설명 없이는 해독 부담이 있다.
  - 제안: 각 `toMatch()` 호출 위에 의도를 설명하는 짧은 인라인 주석 추가. 예: `// SET 절이 서브쿼리 COUNT(*) 방식인지 확인`. 현 구조를 유지하면서 가독성 향상 가능.

---

### 파일 3: `plan/in-progress/kb-graph-stats-dead-path.md`

- **[INFO]** 작업 단위 체크리스트에 아직 완료되지 않은 항목이 남아 있으나 파일 위치는 `in-progress/`로 유지됨 — 규약 준수 확인
  - 위치: L377-381 — `[ ]` 항목 다수
  - 상세: CLAUDE.md 규약에 따르면 미체크 항목이 있으면 `in-progress/`에 두어야 한다. 현재 올바르게 위치하고 있다. 이는 규약 위반 아님.
  - 제안: 해당 없음 — 정상 상태.

- **[INFO]** `decision` 필드가 frontmatter에 추가되었으나 frontmatter 표준 키 목록에 없는 비표준 필드
  - 위치: frontmatter `decision: option-B (코드 제거, spec 변경 reverse 없음)`
  - 상세: CLAUDE.md frontmatter 규약(`worktree`, `started`, `owner`)에 `decision` 필드는 정의되어 있지 않다. 맥락 정보로서 유용하지만 비표준 확장이다.
  - 제안: 추가 정보이므로 허용 가능하나, 향후 consistency-checker 의 `plan_coherence` 가 알 수 없는 필드로 경고를 낼 수 있다면 표준 frontmatter 에 `decision` 필드를 공식 추가하거나, 본문 상단 별도 섹션으로 이동하는 것을 고려한다.

---

## 요약

이번 변경은 dead path 코드(도달 불가능한 WebSocket emit 블록)를 제거하고 `KbStatsHelper`를 단순화하는 리팩토링으로, 유지보수성 측면에서 전반적으로 긍정적이다. 불필요한 의존성(`WebsocketService`) 제거, 타입 강제 캐스트(`as never`) 제거, 비-원자 로직 단순화로 코드 복잡도가 실질적으로 낮아졌다. 새로 추가된 테스트 파일은 핵심 동작(원자 UPDATE, 빈 RETURNING 허용, 오류 전파)을 명확히 검증하며 TDD 기조를 잘 따른다. 개선 여지로는 `RETURNING` 절을 SQL에서 유지하는 이유에 대한 인라인 단서 추가, 테스트에서 인덱스 기반 mock 접근 방식의 표현력 강화, JSDoc의 plan 문서 참조가 장기적으로 dead link가 될 수 있다는 점 정도가 있다. 전체적으로 낮은 위험도의 깔끔한 제거 작업이다.

## 위험도

LOW
