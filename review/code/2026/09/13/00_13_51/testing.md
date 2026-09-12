# 테스트(Testing) 리뷰 — keyset 커서 id 검증 (filter-pg-invalid-text)

## 발견사항

- **[WARNING]** `background-runs.service.ts` 의 `getBackgroundRun` 은 `decodeCursor`(신규 UUID 검증 포함)가 `verifyExecutionAccess`(워크스페이스 소유권 검사) **보다 먼저** 실행된다. 이번 diff 로 `decodeCursor` 가 `i` 검증에 실패하면 소유권 검사 이전에 400 `INVALID_CURSOR` 로 즉시 throw 하게 됐는데, "cross-workspace + 잘못된 커서" 조합을 검증하는 테스트가 없다.
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:92-95` (`const cursor = this.decodeCursor(query.cursor);` 가 93행, `await this.verifyExecutionAccess(...)` 가 95행)
  - 상세: 이 변경 전에는 `i` 를 검증하지 않았으므로 cross-workspace + 비-UUID 커서 요청은 `verifyExecutionAccess` 에서 먼저 404 `NotFoundException` 을 받았다(기존 IDOR 테스트 `'throws NotFound when execution is from a different workspace'` 가 이를 고정). 이번 diff 이후에는 같은 조합이 소유권 검사 도달 전에 400 `INVALID_CURSOR` 로 응답이 바뀐다. 정보 유출은 아니다(400 은 리소스 존재 여부와 무관하게 커서 파싱 실패만 알린다) — `resolveLimit` 도 같은 순서(소유권 검사보다 먼저 검증)로 이미 동작하고 있어 저장소의 기존 관행과 일관될 가능성이 높다. 다만 이 diff 가 새 실패 경로(400)를 추가하면서 그 상호작용을 잠그는 회귀 테스트가 빠졌다 — 나머지 케이스들(단독 유효/무효 커서, 대조군, mutation 6/6)은 촘촘히 덮였는데 이 조합만 비어 있다.
  - 제안: `getBackgroundRun('exec-1', 'bg-run-id', { cursor: <비-UUID i> }, 'ws-OTHER')` 형태로 cross-workspace + 잘못된 커서 조합을 단언하는 테스트를 추가해 현재 관측되는 우선순위(400 `INVALID_CURSOR`, 404 아님)를 명시적으로 고정한다. 만약 팀이 이 우선순위를 의도된 것으로 확정한다면 plan 문서(`keyset-cursor-uuid-validation.md`)에도 한 줄 등재하는 편이 다음 리뷰에서 재지적을 막는다.

- **[INFO]** 새로 추가된 `background-runs.service.spec.ts` 의 `'i 성분이 UUID 가 아니면 400 INVALID_CURSOR'` 테스트에서 `executionRepo.createQueryBuilder.mockReturnValueOnce(buildOwnershipQB('ws-1'))` 설정이 실제로는 소비되지 않는다.
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts:638-640` (unified diff 게이트 기준 신규 추가분)
  - 상세: 위 WARNING 에서 확인했듯 `decodeCursor` 가 `verifyExecutionAccess`(= `executionRepo.createQueryBuilder` 의 유일한 소비처) 보다 먼저 throw 하므로, 이 mock 은 세팅돼도 실행되지 않는 죽은 코드다. 테스트 자체는 여전히 통과하고 결함도 없지만, 이 mock 이 있다는 사실이 "소유권 검사가 먼저 일어난다" 는 잘못된 인상을 다음 독자에게 줄 수 있다 — 실제로는 그 반대다.
  - 제안: 이 mock 세팅을 제거하거나(불필요함을 명확히 하기 위해), 반대로 주석으로 "decodeCursor 가 먼저 실행되므로 이 mock 은 도달하지 않는다" 를 남겨 순서를 명시한다.

- **[INFO]** nil UUID(`'00000000-0000-0000-0000-000000000000'`) 리터럴이 `uuid.spec.ts`·`login-history.service.spec.ts`·`background-runs.service.spec.ts`·`background-monitoring.e2e-spec.ts` 네 곳에 각각 하드코딩돼 있다.
  - 위치: 각 파일의 신규 대조군(`[대조군]`) 테스트
  - 상세: 검증 로직이 공용 유틸(`isUuidShaped`)이라 중복은 아니지만, 같은 매직 리터럴이 4곳에 흩어져 있어 향후 "nil UUID 가 왜 통과해야 하는가" 를 바꿀 때 한 곳을 놓치기 쉽다.
  - 제안: 시급하지 않음. 공용 테스트 fixture(e.g. `shared/testing/` 에 `NIL_UUID` export)로 추출하면 향후 유지보수 비용을 낮출 수 있다.

## 그 외 확인한 점 (문제 없음)

- `login-history.service.spec.ts` 의 `'applies composite cursor filter when provided'` 기존 fixture 를 `'cursor-id'`(비-UUID)에서 실제 UUID 로 교체한 것은 정확한 회귀 수정이다 — 종전 fixture 가 이번에 고친 결함을 "정상" 으로 고정하고 있었다는 plan 의 서술과 diff 내용이 일치한다.
- 두 서비스 모두 (a) 비-UUID 거부, (b) nil UUID 같은 느슨한 형태 통과(대조군) 를 쌍으로 테스트해 `isValidUuid` 로의 오교체를 막는 캐너리 역할을 한다. `[대조군]` 테스트의 두 번째 단언(`bodyPageQB.andWhere`/`selectQb.andWhere` 의 `cursorId`/`lastId` 값 확인)은 "완주해서 실제로 그 값이 쿼리에 소비됐는가" 까지 보므로 조건이 뒤집혀도 흡수되지 않는다 — plan 의 mutation 표(M1~M6, 6/6 RED)와 부합한다.
- e2e 두 건(`background-monitoring.e2e-spec.ts`, `session-revocation.e2e-spec.ts`)이 mock 만으로는 검증 불가능한 전제("Postgres 가 실제로 22P02 를 내고 그게 실제로 500 이 되는가")를 실 DB 로 확인한다. 각각 유효 커서 대조군을 동반해 "무조건 400/200 이 아니다" 를 함께 고정했다 — vacuous 위험을 잘 차단했다.
- `uuid.spec.ts` 주석이 소비처 개수를 하드코딩하지 않고 grep 명령으로 재현 가능하게 적어 둔 것("개수를 다시 박지 않는다")은 이전 라운드에서 지적된 "호출부는 한 곳뿐" 문장이 낡았던 문제를 재발 방지 구조로 고친 것으로 보인다.
- 신규 테스트는 전부 `async/await` 로 통일돼 있어(`.then()` 체이닝 혼용으로 인한 vacuous 위험 없음), 기존 파일 스타일과도 일치한다.

## 요약

이번 변경은 keyset 커서의 id 성분 검증 누락(22P02 → 500 마스킹)을 고치면서 테스트를 이례적으로 촘촘하게 갖췄다 — 각 자리마다 (거부/느슨한 통과) 대조군 쌍, mutation 6/6 예측 일치, 그리고 mock 만으로는 원리적으로 확인 불가능한 전제(Postgres 가 실제로 22P02 를 내는가)를 실 DB e2e 로 검증한 점이 특히 두드러진다. 다만 이번 diff 로 `background-runs.service.ts` 의 커서 검증이 소유권 검사보다 먼저 실행되게 되면서 "cross-workspace + 잘못된 커서" 조합의 응답 코드가 404→400 으로 바뀌는 상호작용이 새로 생겼는데, 이를 고정하는 테스트가 없다(정보 유출은 아니며 기존 `resolveLimit` 과 같은 순서 관행일 가능성이 높다). 그 외에는 죽은 mock 세팅 1건, 매직 리터럴 중복 정도의 사소한 지적뿐이다.

## 위험도

LOW
