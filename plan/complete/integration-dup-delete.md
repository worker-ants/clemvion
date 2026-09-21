---
title: 통합 동시 DELETE 도 감사 행을 두 번 남긴다 — 락이 없는 경로라 처방이 다르다
status: complete
owner: developer
worktree: integration-dup-delete-9e52a7
started: 2026-09-21
spec_impact: none
---

# `IntegrationsService.remove()` — 락이 없는 자리

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 developer 항목
«`IntegrationsService.remove()` 도 동시 삭제에서 감사 행을 두 번 남긴다» (2026-09-20 등재)를 닫는다.

## A. 이 결함 클래스를 다시 센다 — 내 지난 주장이 또 좁았다

직전 PR(#1371)이 «다섯 번째이자 마지막 자리는 `IntegrationsService.remove()`» 라고 적었다. **그 열거가
`AUDIT_ACTIONS.*_DELETED` 접미사로만 셌기 때문에 틀렸다** — 삭제성 감사 액션에는 `_REMOVED` 도 있다.
이번엔 접미사가 아니라 **«리소스 행을 지우고 감사를 남기는 요청»** 으로 정의하고 다시 셌다:

| 자리 | 형태 | 상태 |
| --- | --- | --- |
| `workflows.service.ts` `remove()` | 부모 행 락 + 재조회 | #1369 |
| `workspaces.service.ts` `deleteWorkspace()` | 같은 락의 `parentPresence` | #1369 |
| `triggers.service.ts` `remove()` | advisory lock + 재조회 | #1370 |
| `schedules.service.ts` `remove()` | advisory lock + 트리거 `affected` | #1371 |
| **`integrations.service.ts` `remove()`** | **락 없음** | **이 PR** |
| **`workspaces.service.ts` `removeMember()`** | **락 없음** — 무락 `findOne` → 가드 → `remove(member)` → `member.removed` 감사 | **남는다**(트래커 등재) |
| `workspaces.service.ts` `leaveWorkspace()` | 트랜잭션 안 `pessimistic_write` 재조회 | **이미 닫혀 있다** — 진 쪽은 `NOT_A_MEMBER` 403, 감사 없음 |

## B. 결함 — 잠글 것이 아무것도 없다

```ts
const entity = await this.integrationRepository.findOne({ where: { id, workspaceId } });  // 무락
if (!entity) throw NotFound;
const usages = await this.queryUsageNodes(id, workspaceId);                                // 사용처 검사
if (usages.length > 0) throw ConflictException('INTEGRATION_IN_USE');
await this.integrationRepository.remove(entity);   // ← 0행이어도 던지지 않는다
await this.auditLogsService.record({ action: INTEGRATION_DELETED, ... });
await this.broadcastCredentialChange(id);
```

형제 넷과 달리 **advisory lock 도 행 락도 없다**. 그래서 처방도 다르다 — 락을 새로 들이지 않고
**단일 원자적 `DELETE` 의 `affected`** 를 판별자로 쓴다. `DELETE ... WHERE id = $1 AND workspace_id = $2`
한 문장은 그 자체로 원자적이라 둘 중 하나만 1행을 지운다.

```ts
const { affected } = await this.integrationRepository.delete({ id, workspaceId });
if (affected === 0) throw NotFound;   // 진 쪽 — 감사·broadcast 없음
```

- `remove(entity)` → `delete(criteria)` 전환은 **동작을 바꾸지 않는다**: `Integration` 엔티티에
  `cascade: true` 관계도 `@OneToMany` 도 없다(실측). DB 레벨 FK CASCADE 는 그대로 동작한다.
- 판정은 `affected === 0` **명시 비교**다 — `null`·`undefined`(드라이버 미보고)를 «없다» 로 읽지 않는다.
  같은 규율을 #1371 이 스케줄 경로에 적용했고, 그 근거는 `rewriteTriggerConfigLocked` 가 세웠다.
  그 **이유를 붙드는 대조군 테스트**도 함께 넣는다(#1371 에서 그것이 빠져 뮤턴트가 32건을 통과했다).

## C. 재현을 먼저 한다

e2e 는 형제들과 같은 기법이되 **행 락**을 쓴다(이 경로엔 advisory key 가 없다): 테스트가 통합 행을
`SELECT … FOR UPDATE` 로 쥐면 두 요청 모두 무락 조회·사용처 검사를 통과한 뒤 `DELETE` 에서 멈춘다.

- 단언: 상태쌍 `[204, 404]`(현행은 `[204, 204]`) + `audit_log` 의 `integration.deleted` **1건**.

## 이 PR 이 하지 않는 것

- **사용처 검사와 삭제 사이의 TOCTOU** — 검사를 통과한 뒤 다른 요청이 그 통합을 노드에 연결하면
  «사용 중인데 지워진» 상태가 된다. 트래커 항목이 «별개 사안이니 함께 닫으려 하지 말 것» 이라고 적었고,
  그 경로는 노드 저장 쪽 가드가 필요해 표면이 다르다.
- **`WorkspacesService.removeMember()`** — 위 표의 남는 자리. 서비스도 리소스도 다르므로 별 PR.
  **트래커에 지금 등재한다**(산문 약속이 아니라 상태로 — 착수 게이트가 세 번 잃었다고 지적한 형태다).
- `broadcastCredentialChange` 중복 — 진 쪽이 404 로 끝나면 애초에 부르지 않으므로 이 수정으로 함께 닫힌다.

## 체크리스트

- [x] 트래커에 `WorkspacesService.removeMember()` 등재 — grep 0→1 확인
- [x] `/consistency-check --impl-prep spec/2-navigation` — `review/consistency/2026/09/21/10_27_27` **BLOCK: NO**
  (Critical 0 · Warning 3, 전부 문서·frontmatter). W3(«이번에 생길 404 를 반영할 문서 갱신 자리가 트래커
  스코프에서 빠졌다»)은 **그 자리에서** 트래커 스코프에 `4-integration.md` §9 를 더해 닫았다 — 형제 셋이
  매 착수마다 스코프를 넓혀 온 관례다. W1(data-flow 상태도의 `error` 삭제 종단 누락)·W2(`1-workflow-list.md`
  frontmatter 의 완료 plan 참조)는 **spec 이라 권한 밖**이고 이 PR 의 코드와 무관하다 — 기존 오픈 항목이 덮는다
- [x] **e2e 로 결함 재현** — `[204, 204]` 로 RED 였고, DB 를 직접 조회해 `integration.deleted` 가 한
  `resource_id` 에 **2건**임을 확인했다
- [x] 단위 테스트 + 구현 — 원자적 `delete` 의 `affected === 0` 판정 + 404. 뮤턴트 **둘**이 각각 한
  테스트만 죽인다: (a) 404 분기 제거(156자, 고유 앵커로 유효성 확인) → 진 쪽 테스트 RED,
  (b) `=== 0` → `!affected` → **대조군** RED. 형제 PR(#1371)에서 (b) 뮤턴트가 32건을 통과했던 자리를
  이번엔 처음부터 덮었다
- [x] TEST WORKFLOW — lint PASS · unit PASS · build PASS · **e2e 372 PASS**
- [x] `/ai-review` → **2라운드로 수렴**. 라운드 1(`review/code/2026/09/21/10_54_47`) Critical 0 · Warning 3 →
  전부 조치(`RESOLUTION.md`), 라운드 2(`review/code/2026/09/21/11_32_06`) **Critical 0 · Warning 0**.
  **W1 은 내가 만든 결함이었다** — `remove()` → `delete()` 전환으로 그 이전부터 있던 conflict-path 단언
  2건이 없는 mock 을 겨냥하게 돼 vacuous 해졌다(리뷰어가 뮤테이션으로 실측). 교체 후 같은 뮤턴트가
  두 테스트를 RED 로 만드는 것을 재실측했다(`Received number of calls: 1`)
- [x] `/consistency-check --impl-done spec/2-navigation` → `review/consistency/2026/09/21/11_42_00`
  **BLOCK: NO** (Critical 0 · Warning 1). Warning 1 은 **새 표면**이라 트래커 스코프를 넓혀 닫았다 —
  `spec/5-system/2-api-convention.md` §3 의 HTTP 메서드 표가 `DELETE` 를 멱등 `O` 로 적는데,
  이 계열 다섯 경로가 이제 진 쪽에 404 를 준다. 앞선 네 항목이 «안 적혀 있다» 였다면 이것은
  **적힌 것과 다르게 동작한다** — planner 소유라 각주 추가로 등재했다. INFO 4(다섯 e2e 파일이
  어느 spec 의 `code:` 에도 없다)도 별 항목으로 등재했다
- [x] 트래커 항목 해소 + 이 plan `plan/complete/` 로

## 수렴 시점에 미룬 것 (등재로 갈음)

- `integrations.service.spec.ts:131` 의 죽은 `remove` mock 스텁 (라운드 2 INFO 2). 리뷰어는 «다음 근접
  편집에서» 라고 적었지만 이 계열의 다음 PR 은 workspaces 를 건드리므로 그 편집은 오지 않는다 —
  산문이 아니라 트래커 항목으로 남겼다. 한 줄 삭제가 리뷰 freshness 를 재무장시켜 라운드를 한 번 더
  돌리는 자리라 `developer` SKILL §수렴 예외 (a)(b)(c)(d) 에 해당한다.
