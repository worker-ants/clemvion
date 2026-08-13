# 테스트(Testing) 코드 리뷰 결과

## 검토 방법

- `git diff origin/main...HEAD -- codebase plan` 로 실제 소스 diff(12개 파일)를 직접 확인 (프롬프트가 크기 제한으로 일부 diff 를 생략해 원본을 재조회).
- 영향받는 spec 파일 3종 격리 실행: `update-returning-rows.spec.ts` + `assert-row-array.spec.ts` + `auth-oauth.service.spec.ts` → **35 passed**.
- `execution-engine.service.spec.ts` + `knowledge-base.service.spec.ts` 전체 실행 → **505 passed** (회귀 없음).
- 실측 shape 판별 테스트가 실제로 뮤턴트를 잡는지 직접 검증: `knowledge-base.service.ts` 의 `reExtractAll` CAS 락에서 `updateReturningRows(acquired, …).length === 0` 를 `(acquired as {id:string}[]).length === 0` 로 되돌리는 뮤턴트를 주입 → 신규 "0행 튜플…409" 테스트가 **RED 로 정확히 떨어짐**을 확인, `cp` 로 원복(잔여 diff 없음 확인).

## 발견사항

- **[WARNING]** 새로 추가된 admission "cap 초과" 판별 테스트가 같은 describe 블록의 기존 관례보다 약한 단언(`not.toBe`)을 쓴다 — 정확한 기대값을 검증하지 못한다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4426` (테스트 제목 `실측 shape 로 0행 매칭(cap 초과)이면 admitted 가 아니어야 한다`), 단언은 `:4442` (`await expect(admit(exec)).resolves.not.toBe('admitted')`)
  - 상세: `admitExecutionOrDefer` 는 `'admitted' | 'cancelled' | 'deferred'` 세 값을 반환한다. 이 테스트의 mock(`queuedAt: new Date()`, 5분 타임아웃 미도달)과 UPDATE 0행(`[[], 0]`)이라는 조건은, 바로 옆의 기존 테스트 `cap 초과(affected=0) → deferred: delayed 재큐`(`:4482`, 비-튜플 mock `[]` 로 같은 코드 경로를 검증하며 `resolves.toBe('deferred')` 를 씀)와 동일한 분기를 탄다 — `cancelled` 로 빠지는 유일한 경로(`:4501` 큐 대기 5분 초과)는 `queuedAt` 이 10분 전이어야 하므로 이 테스트에서는 도달 불가능하다. 즉 기대값은 명확히 `'deferred'` 인데, 실제 단언은 `not.toBe('admitted')` 로 완화돼 있어 "0행 튜플 → 'cancelled' 를 잘못 반환" 같은 회귀도 통과시킨다. 이 PR 전체의 핵심 주제가 "느슨한 단언이 버그를 4개월 숨겼다"인데, 그 교훈을 적용해 새로 추가한 테스트 자체가 같은 패턴(느슨한 단언)을 재도입했다.
  - 제안: `resolves.toBe('deferred')` 로 강화. 기존 `:4482` 테스트와 나란히 두면 "튜플 shape 이든 아니든 같은 값이 나온다"는 것도 명시적으로 드러난다.

- **[WARNING]** 신규 헬퍼 `updateReturningRows` 자신의 예외 테스트가, 자매 헬퍼 `assertRowArray` 의 동일 테스트와 달리 `detail` 컨텍스트가 에러 메시지에 실제로 포함되는지 검증하지 않는다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:21-29` (`it.each([...])('%s 면 던진다', (_l, v) => { expect(() => updateReturningRows(v, 'computeChainDepth 재귀 CTE')).toThrow(/배열이 아님/); })`) — 자매 파일의 대응 테스트: `codebase/backend/src/common/utils/assert-row-array.spec.ts:27-31` (`toThrow(/배열이 아님.*computeChainDepth 재귀 CTE/s)`)
  - 상세: `update-returning-rows.ts` 의 JSDoc(2번째 인자 `detail`)은 "**필수다** — 자매 헬퍼 `assertRowArray` 와 같은 계약이고, 선택으로 두었더니 8곳 중 한 곳(`auth-oauth`)이 비워 뒀다 … 극단 상황에서 로그만으로 지점을 특정할 수 있어야 하고, 그건 '권장'으로는 지켜지지 않는다"고 명시한다 — 즉 이 인자를 필수로 승격한 이유 자체가 "에러 메시지에 detail 이 실려야 진단 가능하다"는 런타임 계약이다. 그런데 구현(`update-returning-rows.ts:47-49`)은 `` `… (typeof=${typeof result}) — ${detail}` `` 로 detail 을 메시지에 이어 붙이면서도, 이를 검증하는 테스트는 `/배열이 아님/` 만 매칭해 **detail 이 실제로 메시지에 포함되는지는 아무 데서도 단언하지 않는다.** 자매 헬퍼(`assertRowArray`)의 동일 목적 테스트는 이미 `.*computeChainDepth 재귀 CTE/s` 로 context 포함 여부를 정확히 검증하고 있어, 두 "쌍" 헬퍼 중 하나만 이 속성을 커버한다 — 이 저장소가 반복적으로 지적해 온 "방어(또는 검증)의 정의를 자매 함수 한쪽에만 적용" 패턴과 같은 모양이다. 향후 누군가 실수로 `${detail}` 보간을 지우거나 순서를 바꿔도 이 테스트는 계속 GREEN 이다.
  - 제안: 정규식을 `/배열이 아님.*computeChainDepth 재귀 CTE/s` 로 자매 헬퍼와 동일하게 강화(1줄 변경).

## 긍정적 관찰

- 신규 판별 테스트들(admission·`updateExecutionStatus`·KB CAS 락 2곳·재큐 2곳·reset)이 전부 **실측 드라이버 shape**(`[[...], n]` 튜플)을 그대로 mock 값으로 사용한다 — 이 PR 이 고치는 결함의 근본 원인("mock 이 틀린 현실을 인코딩")을 정확히 겨냥한 설계다.
- "0행" 케이스를 판별자로 선택한 것(튜플 길이는 항상 2 이므로 1행/0행이 아니라 반드시 값 자체로 갈라야 한다)이 여러 테스트에 걸쳐 일관되며, 직접 뮤테이션으로 확인한 결과도 실제로 갈린다(위 검증 방법 참조).
- KB `retryFailedDocuments`/`reEmbedAll` 재큐 테스트들은 개수뿐 아니라 큐에 실린 `documentId` **값**까지 단언해(`undefined` 언랩 실패를 개수 일치로는 못 잡는 사각지대를 닫음) 커버리지 품질이 높다.
- `assert-row-array.spec.ts`/`update-returning-rows.spec.ts` 의 "자매 지점 전수" 구조적 회귀 가드는 실제로 GREEN/RED 를 가르는 살아있는 그물임을 라이브 뮤테이션으로 직접 확인했다(위 검증 방법 참조) — vacuous 아님.
- `jest.clearAllMocks()`(auth-oauth) · `beforeEach` 서비스 재생성(execution-engine, 주석 `:719` 로 명시) 로 테스트 간 격리가 유지된다. mock 오염으로 인한 순서 의존성 없음.

## 요약

이 diff 는 TypeORM `UPDATE`/`DELETE … RETURNING` 튜플-오인 결함을 헬퍼 하나로 봉합하고, 8개 소비 지점(execution-engine 2·knowledge-base 5·auth-oauth 1) 전부에 실측 shape 판별 테스트를 붙인 성숙한 수정이다. 직접 실행(540개 관련 테스트 GREEN)과 라이브 뮤테이션 검증(대표 지점 1곳에서 RED 확인, 원복 확인)으로 판별 테스트들이 실제로 의미 있는 그물임을 확인했다. 다만 이 PR 자체의 교훈("느슨한 단언이 버그를 숨긴다")을 새 테스트 두 곳이 정확히 반복한다 — admission cap-초과 테스트가 `not.toBe('admitted')` 로 결과값을 완전히 특정하지 않고, `updateReturningRows` 예외 테스트가 자매 헬퍼와 달리 `detail` 이 메시지에 실제로 실리는지 검증하지 않는다. 둘 다 현재 동작을 깨지는 않지만, 향후 회귀를 놓칠 수 있는 방향으로 완화된 단언이라 WARNING 으로 남긴다. 회귀 테스트 관점에서 기존 스위트(504건 + 상기 35건)가 이번 diff 로 깨진 곳은 없다.

## 위험도

LOW
