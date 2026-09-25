# 동시성(Concurrency) 리뷰

## 발견사항

- **[WARNING]** `update()` / `updateScope()` / `reauthorize()` 의 비-OAuth 리셋 분기 — 인가 판정 뒤 "전체 엔티티 save()" 로 인한 lost-update 가 `scope` 필드를 조용히 되돌릴 수 있다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts`
    - `update()`: `requireModifiable` 판정(810~816행), `this.integrationRepository.save(entity)`(823행)
    - `updateScope()`: `entity.scope = body.scope;`(1407행), `this.integrationRepository.save(entity)`(1408행)
    - `reauthorize()` 비-OAuth 분기: `this.integrationRepository.save(entity)`(1447행)
  - 상세: 세 경로 모두 "요청 시작 시점에 읽은 `Integration` 엔티티(JS 객체)를 일부 필드만 바꾸고 `repository.save(entity)` 로 통째로 다시 쓴다" 패턴이다. TypeORM 의 `save()` 는 dirty-checking 이 없어 엔티티 객체가 들고 있는 **모든** 컬럼 값을 UPDATE 문에 싣는다. 즉 이 요청이 `entity` 를 읽은 시점(check) 과 `save()` 가 커밋되는 시점(act) 사이에 **다른 요청이 같은 행의 다른 필드(특히 `scope`)를 바꿔 커밋**하면, 이 `save()` 가 그 변경을 옛 값으로 되돌린다(고전적 lost update / TOCTOU).
    구체 시나리오: Editor 가 자신의 personal 통합에 대해 `update(name 변경)` 을 호출해 `requireModifiable` 을 통과한 직후, Admin 이 같은 행에 `updateScope(→organization)` 을 동시에 커밋하면, Editor 의 `save(entity)` 가 `scope` 컬럼을 다시 `'personal'` 로 덮어써 Admin 의 scope 승격이 조용히 유실된다. 반대 방향(Editor 의 personal→organization 승격이 뒤이은 update() 에 의해 personal 로 되돌아가는 경우)도 대칭적으로 가능하다. 이 되돌림은 이 PR 이 강제하려는 바로 그 불변식(`scope==='organization'` 이면 Admin 만 수정)을 레이스 상황에서 무너뜨린다 — 판정에 쓰인 `scope` 값 자체가 커밋 시점엔 stale 해질 수 있기 때문이다.
    같은 파일의 `rotate()` (1215~1311행)는 정확히 이 문제를 이미 인지하고 고쳐둔 선례다: 외부 연결 테스트가 끝난 뒤 트랜잭션 안에서 `pessimistic_write` 로 행을 다시 잠그고, `assertCanModify` 를 재판정한 뒤, `repo.update({id}, changes)` 로 **바뀐 컬럼만** 쓴다(주석: "엔티티 전체를 save 하면 … 컬럼을 재읽기 시점 값으로 되돌린다"). 그런데 이번 diff 가 `update()`/`remove()`/`reauthorize()` 에 새로 추가한 `requireModifiable`/`assertCanModify` 인가 판정은 이 재확인·부분-update 규율을 물려받지 못했다 — 같은 파일 안에서 "보안 직결 코드는 한 곳에서만 고치면 drift 난다" 는 rotate() 자신의 주석이 경고하는 바로 그 drift 다.
  - 제안: `update()`/`updateScope()`/`reauthorize()` 리셋 분기도 `rotate()` 와 동일한 처방(트랜잭션 + `pessimistic_write` 재조회 + 인가 재판정 + 변경 컬럼만 `update()`)을 적용하거나, 최소한 낙관적 락(`@VersionColumn`)을 두어 stale write 를 감지해 실패시키는 편이 필요하다. 윈도우가 매우 좁아(외부 호출이 없는 동기 경로) 실제 트리거 확률은 낮지만, 이 PR 이 새로 강제하는 인가 경계를 레이스로 무력화할 수 있다는 점에서 "낮은 확률 · 명확한 불변식 위반" 조합이다.

- **[WARNING]** `remove()` — 새로 추가된 인가 판정(`requireModifiable`)이 실제 `DELETE` 커밋 시점까지 유효하다고 보장하지 않는다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `requireModifiable` 호출(848~854행) 부터 `this.integrationRepository.delete({id, workspaceId})`(884~887행) 까지
  - 상세: 이번 diff 는 `remove()` 에 처음으로 역할·가시성 인가 판정을 추가했다(이전에는 존재 확인만 했다). 그런데 판정과 실제 `DELETE` 사이에는 `queryUsageNodes` 조회가 끼어 있을 뿐 재잠금·재판정이 없고, `DELETE … WHERE id = :id AND workspace_id = :workspaceId` 조건에는 `scope` 가 들어 있지 않다. 따라서 "Editor 가 자신의 personal 통합을 삭제 요청 → 인가 통과" 직후, 그 사이에 Admin 이 같은 행을 `organization` 으로 승격시키면, Editor 의 `DELETE` 는 여전히 성공한다 — 커밋 시점 기준으로는 Admin 권한이 필요했을 행을 Editor 가 지운 셈이 된다. 바로 옆(872~876행) 주석은 이 함수가 "행 락을 쓰지 않고 원자적 DELETE 의 `affected` 만으로 이중-삭제를 판별한다" 는 설계를 설명하지만, 그 설계는 **존재 여부 레이스**(둘 다 지우려는 경쟁)만 다루고 **인가 값(scope)이 판정 이후 바뀌는 레이스**는 다루지 않는다 — 이 diff 가 새로 추가한 인가 계층에 대해서는 재확인이 없다.
  - 제안: 최소 대응으로 `DELETE` 조건에 판정 시점의 `scope`(또는 `updatedAt`)를 포함시켜 조건부 삭제로 만들고 `affected===0` 이면 (사용처 재확인 없이) 다시 `requireModifiable` 을 태워 정확한 사유(404 vs 403)를 판별하거나, `rotate()` 처럼 트랜잭션 + `pessimistic_write` 재조회로 통일한다. 실제 발생 확률은 매우 낮다(Admin 의 scope 변경과 Editor 의 삭제가 밀리초 단위로 겹쳐야 한다) — 위 update()/updateScope() 항목과 근본 원인이 같으므로 한 번에 처리하는 것을 권장한다.

## 참고 — 올바르게 처리된 부분

- `rotate()`(1215~1311행): 외부 연결 테스트(수 초 소요) 이후 트랜잭션 + `pessimistic_write` 로 행을 재조회하고, 가시성(`isIntegrationVisibleTo`)·인가(`assertCanModify`)·자격증명 병합을 모두 그 시점 값으로 다시 수행한 뒤 변경 컬럼만 `update()` 한다. TOCTOU 를 정면으로 다룬 모범 사례이며, 신규 유닛테스트("rotate — 락 안 재읽기에서 남의 personal 로 바뀌었으면 404 · 커밋하지 않는다")도 이 경로를 명시적으로 고정한다.
- `CandidateLookupService.fillCandidates()` 의 `Promise.all(pending.map(...))`: 각 필드 조회가 서로 독립적이고 결과가 배열의 각기 다른 인덱스에 쓰이므로 순서·경쟁 문제 없음.
- `pickPrecheckConflict` / precheck 경로: 순수 조회 로직이며 공유 가변 상태가 없어 동시성 이슈 없음.

## 요약

이번 changeset 의 본체(스코프 문자열 `userId` 를 여러 서비스 계층에 관통시키는 부분, `integration-visibility.ts` 의 순수 함수들, SQL `WHERE` 절 기반 가시성 필터)는 동시성 관점에서 안전하다. 유의미한 리스크는 `integrations.service.ts` 한 파일에 집중되어 있으며, 이 PR 이 새로 추가한 인가 판정(`requireModifiable`/`assertCanModify`)이 `update()`·`updateScope()`·`reauthorize()`(비-OAuth 분기)·`remove()` 네 경로에서 "판정 시점"과 "실제 쓰기 커밋 시점" 사이의 TOCTOU 윈도우를 재확인 없이 남겨 둔다는 점이다. 같은 파일의 `rotate()` 는 정확히 이 클래스의 문제(외부 호출이 낀 넓은 윈도우)를 트랜잭션 + `pessimistic_write` 재조회 + 부분 `update()` 로 이미 해결해 둔 선례가 있어, 나머지 네 경로에도 같은 처방을 적용하지 않은 것이 구조적 비일관성(drift)으로 남는다. 윈도우 자체는 좁고(대부분 외부 호출 없는 동기 경로) 두 명의 서로 다른 행위자(승격하는 Admin + 동시에 쓰는 다른 사용자)가 밀리초 단위로 겹쳐야 트리거되므로 실전 발생 확률은 낮지만, 트리거되면 이 PR 이 명시적으로 강제하려는 "Organization 통합 변경은 Admin 이상" 불변식을 레이스 상황에서 조용히 무력화한다는 점에서 문서화·후속 조치가 필요하다.

## 위험도

MEDIUM
