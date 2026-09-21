# 동시성(Concurrency) 리뷰

## 발견사항

- **[INFO]** `delete()` 성공 후 감사 로그 기록·`broadcastCredentialChange` 가 같은 트랜잭션으로 묶여 있지 않다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `remove()`, `  799|`~`  817|` (`const { affected } = await this.integrationRepository.delete(...)` 부터 `await this.broadcastCredentialChange(id);` 까지)
  - 상세: 행 삭제(`delete`)는 커밋되지만 그 뒤 `auditLogsService.record()`/`broadcastCredentialChange()`가 실패하면 "리소스는 지워졌는데 감사·캐시 무효화는 안 됨" 상태가 될 수 있다. 다만 이는 이번 diff 가 새로 만든 문제가 아니라 `remove(entity)` 시절부터 있던 순서 그대로이고, 형제 4경로(workflow/workspace/trigger/schedule)도 동일 패턴이며, 직전 리뷰(`review/code/2026/09/21/10_54_47/SUMMARY.md` INFO #4)에서 이미 "기존 패턴, 신규 회귀 아님 — 조치 불요"로 처분됐다. 재확인 결과 이번 diff(원자적 `delete` 전환·`throwIntegrationNotFound()` 헬퍼 추출)가 이 순서를 바꾸지 않았음을 확인했다.
  - 제안: 조치 불요(형제와 일관, 기존 처분 유지). 향후 "삭제+감사 원자성" 트래커가 생기면 4~5경로를 함께 다룰 것.

- **[INFO]** 감사 로그 `details`(`serviceType`/`name`)가 잠금 없는 `findOne` 시점의 스냅샷
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `remove()`, `  766|`~`  768|` (`findOne`) 과 `  810|`~`  813|` (`details: { serviceType: entity.serviceType, name: entity.name }`)
  - 상세: `delete` 가 완료되기 전에 다른 요청이 같은 행을 `update()`로 바꾸면 감사 메타데이터가 stale 할 수 있다. 삭제 판정 자체(동시 DELETE 두 건의 이중 감사)와는 별개의 훨씬 좁은 문제이고, 이전 라운드(SUMMARY INFO #6)에서 "형제 구현과 동일 패턴, 영향 낮음 — 조치 불요"로 이미 처분됨. 이번 diff 로 인한 신규 노출 없음(레이스 윈도우 크기 불변).
  - 제안: 조치 불요(기존 처분 유지).

- **[정보/검증]** 원자적 `DELETE` + `affected === 0` 명시 비교 패턴은 이 경로의 실제 경쟁 조건(동시 DELETE 두 건의 이중 감사)을 올바르게 닫는다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `remove()` `  799|`~`  803|`
  - 검증: `id`+`workspaceId` 를 조건으로 하는 단일 `DELETE` 문은 Postgres 에서 원자적이라 동시 두 요청 중 하나만 1행을 지운다(둘 다 락 없는 `findOne`/사용처 검사를 통과해도, 실제 판별은 `DELETE` 결과의 `affected`). `affected === 0`(명시 비교)만 404 로 처리하고 `null`/`undefined`(드라이버 미보고)는 정상 삭제로 취급하는 것도 옳다 — `!affected` 로 썼다면 드라이버가 `affected` 를 보고하지 않는 상황에서 정상 삭제를 오탐 404 로 뒤집었을 것이고, 실제로 형제 PR(#1371)에서 이 뮤턴트가 대조군 테스트 부재로 32건 전건 GREEN 으로 살아남았던 전례가 있다. 이번 diff 는 그 대조군(`affected` 를 `undefined`/`null` 두 값으로 도는 테스트, `codebase/backend/src/modules/integrations/integrations.service.spec.ts:1097-1109`)을 처음부터 갖추고 있다.
  - `throwIntegrationNotFound()` 헬퍼 추출(`  602|`, `  613|`~`  618|`, `  740|`, `  769|`, `  1191|`, `  1219|`, `  1480|`)은 순수 리팩터로 제어 흐름·락·비동기 순서를 바꾸지 않는다 — `never` 반환이라 `if (!x) this.throwIntegrationNotFound();` 뒤 코드는 그대로 도달 불능 처리된다. 동시성 관점에서 중립.
  - e2e (`codebase/backend/test/integration-delete-concurrency.e2e-spec.ts`)는 advisory key 가 없는 이 경로의 특성에 맞춰 `SELECT ... FOR UPDATE`(`  81|`~`  84|`)로 행 자체를 잠가 두 요청을 `DELETE` 문에서 실제로 충돌시키고, `Promise.race` 로 "락을 풀기 전엔 둘 다 아직 안 끝났다"는 공허성 가드(`  89|`~`  97|`)까지 두어 겹침이 실제로 만들어졌음을 검증한다. 두 상태코드가 정렬 후 `[204, 404]`(`  103|`)이고 감사 행이 정확히 1건(`  109|`~`  115|`)임을 단언 — 이 경로가 형제 4개와 처방(락 vs 원자적 DELETE)이 다름을 정확히 반영한 재현 기법이다. 데드락 유발 가능성 없음(단일 락 계층, `locker`→`fireDelete` 단방향 대기).

## 요약

핵심 변경(`IntegrationsService.remove()`)은 락 없는 경로에서 동시 DELETE 두 건이 각각 성공 판정을 내려 감사 로그를 두 번 남기던 경쟁 조건을, 단일 원자적 `DELETE` 문의 `affected` 를 명시적으로 `=== 0` 비교하는 방식으로 정확히 닫았다. `!affected` 오판(정상 삭제를 404로 뒤집는 함정)을 막는 대조군 단위 테스트와, 실제 DB 행 락으로 겹침을 강제하고 공허성까지 가드하는 e2e 테스트가 함께 있어 판별력이 실측으로 뒷받침된다. 이번 diff 에서 추가된 `throwIntegrationNotFound()` 헬퍼 추출은 순수 리팩터로 동시성에 영향이 없다. 남은 것은 delete-then-audit 이 단일 트랜잭션이 아니라는 점과 감사 details 가 잠금 없는 스냅샷이라는 점인데, 둘 다 이번 diff 이전부터 있던 형제 공통 패턴이고 직전 리뷰 라운드에서 이미 "조치 불요"로 처분됐으며 이번 변경이 그 노출 범위를 넓히지 않음을 재확인했다. 신규 Critical/Warning 없음.

## 위험도

LOW
