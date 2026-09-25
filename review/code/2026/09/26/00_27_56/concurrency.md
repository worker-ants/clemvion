# 동시성(Concurrency) 리뷰

## 발견사항

발견된 Critical/Warning 없음.

- **[INFO]** rotate() 의 최종 UPDATE 는 `id` 단독 조건 — 안전하나 다른 경로와 관례가 다름
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `rotate()` 내부 `repo.update({ id: entity.id }, changes)` 호출부 (트랜잭션 내부, `pessimistic_write` 락으로 `fresh` 조회 직후)
  - 상세: 같은 파일의 `update()`/`remove()`/`updateScope()`/`reauthorize()` 는 판정 근거(`scope`)까지 실은 `judgedRow(entity)` 조건으로 조건부 UPDATE/DELETE 를 수행해 "판정과 쓰기 사이 변경"을 CAS 로 차단하는 일관된 패턴을 쓴다. 반면 `rotate()` 의 최종 `repo.update({ id: entity.id }, changes)` 는 `id` 만 조건으로 쓴다. 다만 이는 **결함이 아니다** — 바로 위에서 같은 트랜잭션 커넥션으로 `pessimistic_write` 행 락을 잡은 `fresh` 를 대상으로 하므로, 커밋 전까지 다른 트랜잭션이 같은 행을 바꿀 수 없어 `scope` 재확인이 이미 락으로 보장된다. CAS 패턴은 "락 없는 경로"에서 판정-쓰기 원자성을 흉내 내는 용도이므로 락이 있는 이 경로엔 불필요하다. 다만 두 처방(락 vs CAS)이 같은 파일에 공존해 처음 읽는 사람이 "왜 여기만 다른가"를 되짚어야 한다 — 주석(`// 바꾸는 컬럼만 update...`)이 그 이유를 설명하고 있어 실질 위험은 낮음.
  - 제안: 현행 유지로 충분. 필요하면 `judgedRow` 헬퍼를 락 보유 경로에도 통일 적용해 "이 파일의 쓰기는 항상 판정 조건을 싣는다"는 불변식을 코드로도 강제할 수 있으나, 락이 이미 그 불변식을 보장하므로 우선순위는 낮음.

## 확인한 동시성 설계 (문제 없음 — 참고용)

- `integration-oauth.service.ts` 의 OAuth 콜백 커밋 경로(`this.dataSource.transaction` 블록, 함수는 `handleCallback` 계열)는 `pessimistic_write` 로 대상 `Integration` 행을 잠근 뒤 `assertRequesterStillAllowed(integration, record, manager)` 를 호출해 락을 쥔 시점 값으로 인가를 재판정한다. `manager` 를 그대로 넘겨 `WorkspacesService.getMemberRole(workspaceId, userId, manager)` 가 **같은 트랜잭션 커넥션**에서 역할을 읽으므로, 풀에서 두 번째 커넥션을 빌리지 않는다 — 커넥션 풀 고갈이나 자기 자신을 기다리는 형태의 데드락을 피한다. 이는 이전 라운드(커밋 `a8b5c8b13`, "/ai-review 3라운드")에서 지적·수정된 항목이 이번 diff 에 반영된 상태로 확인됨.
- `integrations.service.ts` 의 `rotate()` 도 동일 패턴: 외부 HTTP 커넥션 테스트(`dispatchTest`, 수 초 소요)는 트랜잭션 **밖**에서 수행하고, 임계 구간(재조회 + 인가 재판정 + 병합 + UPDATE)만 `pessimistic_write` 트랜잭션 안에 두어 락 보유 중 외부 I/O 대기를 피한다. Organization 스코프일 때만 `workspacesService.getMemberRole(workspaceId, userId, manager)` 를 같은 커넥션으로 호출한다 — OAuth 콜백과 동일한 보장.
- `update()`/`remove()`/`updateScope()`/`reauthorize()`(non-OAuth 브랜치)는 락 대신 **판정 근거(scope)를 실은 조건부 UPDATE/DELETE** 로 lost-update 를 차단한다 — TypeORM `save()` 의 전체 컬럼 스냅샷 갱신 대신 바뀌는 컬럼만 쓰고, `affected === 0` 을 명시 비교해 판정-쓰기 사이 변경을 404 로 fail-closed 처리한다. `remove()` 의 원자적 `DELETE ... WHERE id=$1 AND workspace_id=$2 AND scope=$3` 은 동시 삭제 두 건 중 하나만 성공시키는 판별자로 정확히 동작한다.
- `CandidateLookupService.fillCandidates()` 의 `Promise.all(pending.map(async ...))` 은 각 필드가 독립적인 읽기 전용 DB 조회만 수행하고 공유 가변 상태를 쓰지 않아 안전.
- 나머지 파일(controller 배선, DTO 설명 문자열, workflow-assistant 계열 `userId` 전달, e2e/spec 테스트, mdx 문서)은 동시성과 무관한 plumbing 변경.

## 요약

이번 diff 는 Organization 통합의 인가 재판정을 다루는 동시성 민감 경로(OAuth 재인증 콜백 커밋, credential rotate)에서 "행 락을 쥔 트랜잭션 안에서 같은 커넥션으로 역할을 재조회"하는 패턴을 일관되게 적용하고 있으며, 이는 이전 리뷰 라운드에서 지적된 "락 안에서 별도 커넥션을 빌려 역할을 읽는" 문제(커넥션 풀 고갈/잠재적 대기 사슬 위험)를 해소한 상태다. 락이 없는 쓰기 경로(update/remove/updateScope)는 판정 근거를 실은 조건부 UPDATE/DELETE(CAS)로 TOCTOU 를 차단하는 일관된 설계를 쓰고 있고, `affected` 값도 `=== 0` 명시 비교로 다루어 드라이버의 `null`/`undefined` 오판을 피한다. 새로 도입된 Critical/Warning 급 동시성 결함은 발견되지 않았다. 저장소 파일에 대한 뮤테이션 없이 정적 분석만 수행했으며 `git status --short` 기준 변경 없음.

## 위험도

LOW
