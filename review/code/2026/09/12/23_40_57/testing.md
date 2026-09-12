# 테스트(Testing) Review

## 발견사항

- **[WARNING]** 이 수정이 의존하는 핵심 전제("비-UUID 문자열이 `uuid` 컬럼에 바인딩되면 Postgres 가 SQLSTATE 22P02 로 거부한다")가 실 DB 를 태우는 테스트로 한 번도 검증되지 않는다. 두 서비스 모두 unit 스펙은 `createQueryBuilder`/`andWhere` 를 mock 하므로, `decodeCursor` 가 값을 **정확히 거부하는지**만 보고 "그 값을 실제로 통과시켰을 때 Postgres 가 정말 22P02 를 내는가"는 아무 테스트도 확인하지 않는다.
  - 위치: `codebase/backend/src/modules/auth/login-history.service.spec.ts:194`(새 테스트, mock 기반) / `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts:633`(새 테스트, mock 기반). 두 엔드포인트 모두 실 DB 를 쓰는 e2e 가 이미 존재한다 — `codebase/backend/test/session-revocation.e2e-spec.ts`(`GET /api/users/me/login-history`, 226번째 줄 근방) / `codebase/backend/test/background-monitoring.e2e-spec.ts`(`GET /api/executions/:id/background-runs/:bgid`, 279번째 줄 근방) — 하지만 어느 쪽에도 잘못된 커서 id 케이스가 없다.
  - 상세: 이 저장소는 정확히 같은 종류의 위험을 이미 한 번 인지하고 대응한 선례가 있다. `codebase/backend/test/webhook-trigger.e2e-spec.ts:184` 의 주석은 *"단위 테스트가 mock 하는 드라이버 에러 형태가 실제와 같은지는 이 케이스만 확인한다 … 실 DB 가 그 형태(제약 이름·SQLSTATE)를 정말 돌려주는지는 mock 이 원리적으로 말해 주지 못한다"* 라고 명시하며, 그 판단으로 B4 e2e 를 추가했다. 이번 변경의 전제(문자열 → `uuid` 캐스트 실패 → 22P02)는 PG 의 잘 알려진 동작이라 리스크는 B4(제약 이름 매칭)보다 낮지만, 판단 원칙 자체는 동일하게 적용된다 — mock 은 "코드가 검증 로직을 올바르게 호출하는가"만 증명하고 "그 검증이 실제로 필요했는가(즉 실 DB 가 정말 500 을 냈었는가)"는 증명하지 못한다. `plan/in-progress/keyset-cursor-uuid-validation.md` 의 뮤테이션 표(M1~M6)도 전부 mock 레벨이라 이 축을 다루지 않는다.
  - 제안: 두 e2e 스펙에 각각 1건씩 — 잘못된 id 성분을 가진 커서로 요청해 (a) 응답이 500 이 아니라 CHANGELOG 가 약속한 200/1페이지(`login-history`) 또는 400 `INVALID_CURSOR`(`background-runs`) 인지, (b) 서버 로그/응답 어디에도 `INTERNAL_ERROR` 가 없는지 확인하는 케이스를 추가한다. 비용이 크지 않다 — 두 e2e 파일 모두 이미 해당 엔드포인트를 실 DB 로 호출하는 헬퍼가 갖춰져 있다.

- **[WARNING]** `isUuidShaped` 의 "프로덕션 호출부는 1곳뿐" 이라는 기존 테스트 주석이 이번 변경으로 거짓이 됐는데 갱신되지 않았다.
  - 위치: `codebase/backend/src/common/utils/uuid.spec.ts:54-57` (`"이 둘이 유일한 방어선이다 — 실측: isUuidShaped 의 프로덕션 호출부는 workspace-context.util.ts:74 한 곳뿐이다."`)
  - 상세: 이번 PR 이 `codebase/backend/src/modules/auth/login-history.service.ts:65` 와 `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:178` 에 `isUuidShaped` 호출을 새로 추가해, 실제 프로덕션 호출부는 이제 3곳이다(`grep -rn "isUuidShaped" codebase/backend/src` 로 확인). `uuid.spec.ts` 의 이 문장은 "이 둘(uuid.spec.ts 경계 테스트 + workspace-context.util.spec.ts nil UUID 테스트)이 `isUuidShaped` 를 지키는 유일한 방어선"이라는 주장의 근거로 호출부 개수를 세는데, 그 개수 자체가 이제 틀렸다. 테스트는 여전히 기계적으로 통과하지만(런타임 단언이 아니라 docstring 서술이므로), 다음에 이 술어의 의미를 바꾸려는 사람이 이 주석을 보고 "영향 범위가 워크스페이스 헤더 축 하나뿐"이라고 오판할 수 있다 — 실제로는 keyset 커서 축(두 곳)도 이 술어에 의존한다.
  - 제안: `uuid.spec.ts:56` 의 "한 곳뿐이다" 를 이번 PR 이 추가한 두 호출부까지 반영해 정정한다(또는 개수 주장을 빼고 "호출부 전수는 grep 으로 확인" 식으로 완화한다).

## 요약

이 PR 의 테스트 작업 자체는 수준이 높다 — 두 디코더 각각에 (a) 거부 케이스, (b) `isValidUuid` 오채택을 막는 대조군(nil UUID 통과), 게다가 `background-runs` 쪽은 커서가 실제로 `fetchBodyPage` 의 `lastId` 까지 소비되는 완주 경로까지 검증한다. plan 문서에 기록된 6개 뮤테이션(정상 삭제 2 + 대조군 엄격 술어 교체 2 + 조건 반전 2)이 전부 RED 로 확인되어, 1차 리뷰가 지적한 "조건이 뒤집혀도 안 잡힌다"는 우려도 절반은 반증하고 절반(완주 미검증)은 이번 라운드에서 보강했다. 다만 이 모든 검증이 mock 레벨에 머물러 있어, 이 수정의 존재 이유인 "Postgres 가 실제로 22P02 를 던진다"는 전제 자체는 어느 테스트도 실 DB 로 확인하지 않는다 — 이 저장소가 이미 유사한 상황(webhook-trigger B4)에서 정확히 이 이유로 e2e 를 추가한 선례가 있어 비대칭이 눈에 띈다. 또한 이번 변경이 만든 부수 효과로 `uuid.spec.ts` 의 "호출부 1곳" 서술이 조용히 거짓이 됐다. 두 항목 모두 기능 결함이 아니라 커버리지/문서 정합성 갭이라 CRITICAL 로 보지는 않는다.

## 위험도

LOW
