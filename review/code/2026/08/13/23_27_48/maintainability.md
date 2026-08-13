# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

- **[WARNING]** 새로 추가된 주석이 바로 아래 남아 있는 옛 주석과 모순된다 — "제네릭을 안 쓴다" 고 써놓고 11줄 뒤에 "위 제네릭은…" 이라고 지칭한다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2916-2919`(신규 주석) 와 `:2931`(그대로 남은 기존 주석), 함수 `admitExecutionOrDefer`
  - 상세: 이번 diff 는 `const rows = await m.query<{ id: string }[]>(...)` 를 `const rows: unknown = await m.query(...)` 로 바꾸며 제네릭을 **의도적으로 제거**했고, 그 이유를 새 주석(2916-2919행)에 "제네릭을 **달지 않는다**… 어떤 제네릭도 검증되지 않는 주장일 뿐" 이라고 명시했다. 그런데 바로 그 아래, 이번 diff 가 건드리지 않은 기존 주석(2931행)이 여전히 "`EntityManager.query` 의 선언 타입은 `Promise<any>` 라 **위 제네릭**은 주장이지 검증이 아니다" 라고 말한다 — 코드에는 더 이상 제네릭이 없으므로 "위 제네릭" 이 가리키는 대상이 사라졌다. 두 주석이 사실상 같은 주장("제네릭이 있어도 타입 안전은 보장 안 된다")을 다른 전제(제네릭이 있다 vs 없다)로 반복하고 있어, 다음 유지보수자가 읽으면 "제네릭을 없앴다면서 왜 아직 제네릭 얘기를 하지?" 하고 혼란스러워진다. 이 PR 의 RESOLUTION(`review/code/2026/08/13/20_36_35/RESOLUTION.md` CRITICAL 2)이 바로 이 함수 안의 "정반대 옛 주석" 을 이미 한 번 잡아 지웠는데, 이번 라운드 편집으로 유사한 성격(다른 전제를 지칭하는 낡은 문구)의 잔재가 다시 생겼다.
  - 제안: 2931-2933행의 "위 제네릭은 **주장이지 검증이 아니다**" 부분을 삭제하거나, 2916-2919행과 통합해 "제네릭을 달지 않고 `unknown` 으로 받는다 — 드라이버가 배열이 아닌 것을 돌려주면 이후 `updateReturningRows` 가 즉시 던진다" 한 곳으로 정리한다.

- **[INFO]** `auth-oauth.service.ts` 의 `updateReturningRows` 호출 스타일이 같은 PR 안의 다른 7개 호출부와 다르다.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts:146-152` (`updateReturningRows<AuthOAuthState>(await this.dataSource.query(...), ...)` 로 `await` 표현식을 인자 자리에 인라인) vs `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2920`·`:8512`, `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:336`·`:544`·`:578`·`:720`·`:739` (모두 `const x: unknown = await …query(...)` 로 먼저 변수에 받은 뒤 별도 줄에서 `updateReturningRows(x, detail)` 호출)
  - 상세: 기능적으로는 동일하지만, 8곳 중 7곳이 "타입 미확정 변수로 받기 → 헬퍼에 넘기기" 2단계 관용구를 쓰는데 auth-oauth 한 곳만 인라인이다. 이 비대칭은 우연이 아니라 `update-returning-rows.spec.ts:90-101` 의 구조적 가드 테스트가 명시적으로 인지하고 있다("auth-oauth 이 0곳인 이유: … `const x = await …query(` 패턴이 사라졌다") — 의도된 결과이고 결함은 아니다. 다만 앞으로 새 소비 지점을 추가하는 개발자가 다수(7/8)가 아니라 auth-oauth 를 참고 사례로 삼으면 스타일이 갈릴 수 있다.
  - 제안: 필수 수정 아님. 신규 지점 추가 시 참고할 "정본" 스타일(2단계 변수 받기)을 헬퍼 JSDoc 표에 한 줄 덧붙이면 향후 일관성을 지키기 쉬워진다.

- **[INFO]** 신규 plan 문서에서 인용 블록(`>`)이 줄바꿈 중간에 끊겨 렌더링 시 인용문 밖으로 문장이 새어 나간다.
  - 위치: `plan/in-progress/update-returning-tuple-shape.md:109-111`
  - 상세: 109-110행은 `> ` 로 시작하는데, 같은 문장이 이어지는 111행("전에 6~8차 결론을 코드로 재검증해야 한다.")에는 `> ` 접두가 빠졌다. 마크다운 렌더러에서 이 문장은 인용 블록 밖의 별도 문단으로 떨어져 나가, "처음엔 '두 plan 모두' 라고 써 놓고 한 곳만 고쳤다" 는 경고성 소급 정정 메모의 시각적 그룹핑이 깨진다. 내용 자체(사실 관계)는 정확하다.
  - 제안: 111행 앞에 `> ` 를 붙여 인용 블록을 닫지 않고 이어지게 한다.

- **[INFO]** `knowledge-base.service.ts` 의 두 대칭 CAS 락 블록(`reExtractAll`/`reEmbedAll`)이 prettier 자동 줄바꿈으로 인해 시각적으로 다르게 보인다.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:345-348`(`.length === 0` 이 새 줄로 분리) vs `:728-730`(한 줄에 유지)
  - 상세: 두 블록은 로직상 완전히 대칭(`updateReturningRows(acquired, detail).length === 0`)인데, `detail` 문자열 길이 차이(`KB re-extract CAS 락` vs `KB re-embed CAS 락`, 1글자 차)로 프린트 폭 80자를 한쪽만 넘어 prettier 가 다르게 줄바꿈했다. `prettier --check` 는 둘 다 통과하므로 결함은 아니고 수정 대상도 아니지만, 나란히 읽을 때 같은 패턴임을 알아채기 약간 어렵다.
  - 제안: 필수 수정 아님.

- **[INFO]** (참고, 조치 불필요) 구조적 회귀 가드 테스트(`update-returning-rows.spec.ts` 의 "UPDATE/DELETE 결과를 직접 소비하는 지점이 다시 생기지 않는다")가 두 파일의 정규식 매칭 개수를 하드코딩해 무관한 리팩터링에도 깨질 수 있다는 트레이드오프는 직전 라운드(`20_36_35`)에서 이미 지적됐고, 실패 시 판단 절차를 주석(96-104행)에 상세히 남겨 완화돼 있다. 추가 조치를 요구하지 않는다.

## 요약

이번 diff 는 TypeORM 이 `UPDATE`/`DELETE … RETURNING` 에서만 `[rows, rowCount]` 튜플을 돌려주는 실측 결함을 공유 헬퍼(`updateReturningRows`)로 통일하고, 8개 소비 지점(execution-engine 2곳, knowledge-base 5곳, auth-oauth 1곳)을 교체한 다중 라운드 누적 변경이다. 헬퍼 자체는 짧고 JSDoc 이 실측 근거·3가지 기존 관용구와의 관계·`detail` 인자를 필수로 만든 이유까지 명확히 설명하며, 8개 소비 지점 모두 실측 shape(`[[…],n]` / `[[],0]`) 을 직접 mock 하는 판별 테스트로 뒷받침돼 가독성·함수 길이·복잡도는 전반적으로 양호하다. 가장 눈에 띄는 결함은 `admitExecutionOrDefer` 안에서 이번 편집이 추가한 새 주석("제네릭을 안 쓴다")과 그 바로 아래 손대지 않은 옛 주석("위 제네릭은…")이 서로 다른 전제를 지칭해 모순돼 보인다는 점이다 — 이 PR 이 이미 한 번 "고친 함수 안의 정반대 옛 주석" 을 CRITICAL 로 잡아 지운 이력이 있는 자리라 재발 성격이 있다. 그 외에는 auth-oauth 호출부의 스타일 비대칭(문서화된 의도)과 plan 문서의 깨진 인용 블록 등 조치 없이도 무방한 INFO 성격 관찰뿐이다. CRITICAL 급 유지보수성 결함은 없다.

## 위험도

LOW
