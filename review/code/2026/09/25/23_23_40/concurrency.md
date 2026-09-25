# 동시성(Concurrency) 리뷰

## 발견사항

- **[INFO]** 커밋 직전 인가 재확인이 `pessimistic_write` 락 보유 구간 안에서 별도 커넥션을 잠깐 더 빌린다
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` — `assertRequesterStillAllowed()`
    (게이트 405-430), 호출부 `handleCallback()` 트랜잭션 블록 (게이트 801-821, 특히 810-813 의
    `lock: { mode: 'pessimistic_write' }` 와 821 의 `await this.assertRequesterStillAllowed(integration, record)`)
  - 상세: `dataSource.transaction()` 안에서 `manager.getRepository(Integration).findOne({ lock: { mode: 'pessimistic_write' } })`
    으로 integration row 락을 잡은 뒤, 같은 트랜잭션 안에서 `assertRequesterStillAllowed` 가
    `this.workspacesService.getMemberRole(...)` 을 호출한다. `getMemberRole` 은 `WorkspacesService` 내부의
    `memberRepository.findOne(...)` (plain repository, `manager` 가 아님) 을 쓰므로 **트랜잭션 커넥션과는 별도로
    커넥션 풀에서 한 번 더 커넥션을 대여**한다. 즉 이 요청 하나가 (트랜잭션 커넥션 + 멤버십 조회 커넥션) 두 개를
    잠깐 동시에 점유하며, 그 사이 integration row 의 `pessimistic_write` 락도 계속 유지된다.
    설계 의도 자체(락을 쥔 채 커밋 직전 값으로 인가를 다시 봐 begin↔callback 사이의 TOCTOU 를 닫는 것)는
    타당하고 올바르다 — `CONC H-3` 주석이 설명하는 기존 lost-update 방지 패턴을 그대로 확장한 것이다. 다만
    `rotate()` 의 거부 근거("advisory lock 재도입 아님 — 그쪽이 거부된 이유는 락 보유 중 **HTTP 요청**")와 비교하면,
    이번 추가는 HTTP 호출이 아니라 짧은 단일 `SELECT` 라 즉각적 위험은 낮지만, 동시 재인증/scope 추가 요청이 몰리는
    상황에서는 락 대기 시간이 늘고 그만큼 풀 점유 구간도 늘어난다.
  - 제안: 별도 조치가 급하진 않음. 커넥션 풀 크기가 작은 환경(스테이징 등)에서는 동시 재인증 트래픽이 몰릴 때
    풀 고갈/락 대기 지표를 관찰할 가치가 있다. 필요하면 `getMemberRole` 조회도 같은 `manager` (트랜잭션 컨텍스트)
    로 태워 커넥션 하나로 통일할 수 있다.

- **[INFO]** (참고, 새 결함 아님) `rotate()` 의 락-재확인은 통합 행의 `scope`/가시성만 다시 읽고, 요청자의 role 은
  요청 시작 시점 값을 그대로 재사용한다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `rotate()` 트랜잭션 블록
    (게이트 1292-1300, 특히 1297-1300 의 `isIntegrationVisibleTo(fresh, userId)` 와 `assertCanModify(fresh, userRole, 'rotate')`)
  - 상세: 외부 연결 테스트(`dispatchTest`, 수 초 소요)가 끝난 뒤 트랜잭션 안에서 행을 다시 락 걸어 읽고
    `scope`/가시성은 새로 읽은 `fresh` 값으로 재판정하지만, `assertCanModify` 에 넘기는 `userRole` 은 함수 인자로
    받은, 요청 시작 시점에 컨트롤러가 조회한 값 그대로다. 따라서 연결 테스트가 도는 수 초 사이 요청자의 워크스페이스
    role 이 Admin → Viewer 로 강등돼도 이 재확인은 잡아내지 못한다. 같은 PR 이 새로 추가한
    `integration-oauth.service.ts` 의 `assertRequesterStillAllowed` 는 반대로 **role 도 락 안에서
    `getMemberRole` 로 다시 조회**해 이 종류의 TOCTOU 를 완전히 닫는다 — 두 지점이 "커밋 직전 재확인"이라는
    같은 문구를 쓰지만 닫는 범위가 다르다.
    이 `rotate()` 패턴 자체는 이번 diff 가 새로 만든 게 아니라 `plan/complete/rotate-lost-update.md` §D 에서
    이미 검토·수용된 기존 트레이드오프다(그 문서도 "권한도 옛 스냅샷"이라고 명시하고 재확인 범위를 `scope` 변경
    시나리오로 한정했다). 새로 도입된 결함으로 보고하는 것은 아니며, 두 메커니즘 간 보장 범위 차이를 기록해 둔다.
  - 제안: 조치 불요(기존 결정 존중). 다만 향후 `rotate()` 의 재확인 범위를 넓힐 계획이 생기면
    `assertRequesterStillAllowed` 와 동일하게 락 안에서 role 도 재조회하는 편이 일관적이다.

- **[INFO]** (긍정 확인) `judgedRow()` compare-and-set 패턴이 `save()` 의 lost-update 위험을 올바르게 제거함
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `judgedRow()` (게이트 677-683),
    `update()`(852-855) · `remove()`(918-921) · `updateScope()`(1438-1442) · `reauthorize()`(1483-1487) 의
    `repository.update(this.judgedRow(entity), …)` / `repository.delete(this.judgedRow(entity))` 호출부
  - 상세: 판정 근거인 `scope` 를 조건절에 함께 실어 조건부 `UPDATE`/`DELETE` 의 `affected` 로 동시 수정을
    판별한다. 엔티티 전체 `save()` 대신 바뀌는 컬럼만 쓰는 방식이라, 판정과 쓰기 사이 다른 요청이 `scope` 를
    바꾸거나(`update`/`remove`/`updateScope`) `logUsage` 가 `lastUsedAt` 을 원자적으로 갱신해도(`rotate`) 되돌리지
    않는다. 락을 새로 들이지 않고 단일 SQL 문의 원자성에 기대는 설계로, 결함이 아니라 잘 짜인 concurrency 처방이다.

## 요약

이번 변경의 핵심은 "Personal 통합은 생성자만 보고, Organization 통합 변경은 Admin 이상"이라는 인가 규칙을 컨트롤러·서비스
전반에 배선하는 것이며, 동시성 관점에서 실질적으로 새로 만든 코드는 OAuth 콜백(`handleCallback`)에 추가된
`assertRequesterStillAllowed` 뿐이다. 이 함수는 기존 `pessimistic_write` 행 락(`CONC H-3`) 안에서 커밋 직전 값으로
가시성·role 을 다시 검사해, begin 과 callback 사이(state TTL)의 강등·소유권 변경 TOCTOU 를 올바르게 닫는다. 경쟁
조건·데드락·원자성 관점에서 새로 도입된 결함은 발견되지 않았고, 락 순서가 바뀌거나 다른 테이블에 새 락을 거는
지점도 없어 데드락 위험도 없다. 유일한 주목할 점은 그 재확인이 락을 쥔 채로 별도 커넥션(멤버십 리포지토리)을
한 번 더 대여한다는 것인데, 짧은 단일 조회라 위험도는 낮다. `rotate()` 의 기존 락-재확인이 role 은 재조회하지
않는 것과 비교하면 두 메커니즘의 보장 범위가 다르지만, 이는 이번 PR 이전부터 검토·수용된 트레이드오프이지 새
결함이 아니다. `judgedRow()` 기반 조건부 쓰기(`update`/`delete`)는 `save()` 의 lost-update 위험을 피하는 올바른
compare-and-set 패턴으로 확인됐다.

## 위험도

LOW
