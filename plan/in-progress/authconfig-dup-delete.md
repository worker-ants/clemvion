---
title: 인증 설정 동시 삭제도 감사 행을 두 번 남긴다 — 일곱 번째 자리
status: in-progress
owner: developer
worktree: authconfig-dup-delete-7e3a1c
started: 2026-09-21
spec_impact: none
---

# `AuthConfigsService.remove()` — 일곱 번째 자리

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 developer 항목
«`AuthConfigsService.remove()` 도 동시 삭제에서 감사 행을 두 번 남긴다» (2026-09-21 등재)를 닫는다.
그 항목은 #1373 의 전수 조사(열거 축 = «리소스 행을 지우고 감사를 남기는 요청»)가 찾아냈다.

## A. 결함 — 통합·멤버 경로와 같은 형태다

`auth-configs.service.ts:279-295`:

```ts
const config = await this.findById(id, workspaceId);   // 무락, 없으면 404 RESOURCE_NOT_FOUND
await this.authConfigRepository.remove(config);        // ← 0행이어도 던지지 않는다
await this.recordAudit({ action: AUTH_CONFIG_DELETE, ..., resourceId: id });
```

락이 없으므로 처방도 #1372·#1373 과 같다 — **단일 원자적 `DELETE` 의 `affected`**:

```ts
const { affected } = await this.authConfigRepository.delete({ id, workspaceId });
if (affected === 0) this.throwAuthConfigNotFound();   // 진 쪽 — 감사 없음
```

판정은 `affected === 0` **명시 비교**(드라이버 미보고를 «없다» 로 읽지 않는다)이고,
그 **이유를 붙드는 대조군 테스트**를 처음부터 넣는다.

**`throwAuthConfigNotFound(): never` 헬퍼도 처음부터 만든다.** 형제 넷이 전부 같은 추출을 했고
(#1370·#1371·#1372·#1373), 그중 둘은 **리뷰가 지적한 뒤에야** 했다 — 같은 지적을 다섯 번째로
받는 것은 낭비다. `findById` 에 이미 리터럴이 있으므로 이번 수정이 두 번째 사용처를 만든다.

## B. 착수 전 실측 — 「같은 형태」라는 말을 검증한다

| 확인할 것 | 실측 |
| --- | --- |
| 라우트 성공 코드 | **204** (`@HttpCode(HttpStatus.NO_CONTENT)` 1개, `ok: true` 0개). #1373 의 workspaces 와 달리 여기선 형제 패턴 그대로다 |
| `remove`→`delete` 가 동작을 바꾸나 | **아니다.** `AuthConfig` 엔티티에 `cascade: true` 도 `@OneToMany` 도 없고(`ManyToOne(Workspace, {onDelete:'CASCADE'})` 뿐), 저장소 전체에 ORM 라이프사이클 훅·subscriber 가 **0건** |
| 참조하는 FK | `trigger.auth_config_id` → `auth_config(id)` **`ON DELETE SET NULL`** (`V001__initial_schema.sql:210`). DB 레벨이라 두 방식 모두 동일하게 발화한다 |
| 사용처 검사 | **없다.** 컨트롤러 설명이 «참조 중인 트리거는 인증에 실패하므로 사전 확인이 필요» 라고만 적는다 — 통합 경로의 `INTEGRATION_IN_USE` 같은 서버 가드가 없다 |
| 404 코드 | `RESOURCE_NOT_FOUND` (`findById` 가 쓰는 것과 같아야 한다 — 진 쪽이 다른 코드를 받으면 안 된다) |

## C. 재현을 먼저 한다

e2e 는 #1372·#1373 의 행 락 기법 그대로: 테스트가 `auth_config` 행을 `SELECT … FOR UPDATE` 로
쥐면 두 요청이 무락 조회를 통과한 뒤 `DELETE` 에서 멈춘다.

- 단언: 상태쌍 `[204, 404]`(현행 예측은 `[204, 204]`) + 진 쪽 코드 `RESOURCE_NOT_FOUND`
  + `audit_log` 의 `auth_config.delete` **1건**.
- 공허성 가드: 락을 놓기 **전에** 둘 다 아직 안 끝났음을 관측한다.

## 이 PR 이 하지 않는 것

- **`model-config` (여덟 번째) · `webauthn` (아홉 번째)** — 각각 별 PR. 트래커 등재 상태 유지.
- **사용처 검사 부재** — 참조 중인 트리거가 있어도 막지 않는 것은 이 PR 이 만든 문제가 아니고,
  `ON DELETE SET NULL` 이 데이터 무결성은 지킨다(트리거가 인증 없는 상태가 될 뿐). 표면이 다르다.

## 체크리스트

- [x] `/consistency-check --impl-prep spec/2-navigation` — `review/consistency/2026/09/21/14_41_01`
      **BLOCK: NO** (Critical 0 · Warning 5). 처리:
      - W1(신규 헬퍼명이 `triggers.service.ts` 의 **400** `AUTH_CONFIG_NOT_FOUND` 와 근접) →
        헬퍼 JSDoc 에 **둘이 다른 자리임을 명시**했다. `3-error-handling.md` §1.11 이 그 400 을
        «이 저장소의 유일한 `_NOT_FOUND`≠404 예외» 로 적어 둔 자리라 혼동 비용이 크다
      - W2(`spec-sync-auth-gaps.md:215` 가 **같은 버그를 2026-08 부터 이중 추적**) → 확인했다.
        «동시 삭제 중복 감사 (W7, 기존 `auth-configs` 패턴과 함께) — 우선순위 낮음» 한 줄이다.
        **종결 단계에서 함께 해소한다**
      - W3(e2e `code:` 항목이 6축 고정 열거) → **착수 전에 이미 재열거형으로 일반화**해 뒀다
      - W4(§3 멱등성, 7번째 인스턴스)·W5(`1-workflow-list.md` pending_plans stale) → 기등재·무관
      - `5-system/12-webhook.md`·`1-auth.md` 를 **손으로 읽었다** — 둘 다 삭제 계약을 서술하지
        않으므로 이번 변경의 대상이 아니다
- [x] **부수 발견 — #1373 에서 등재한 근거가 틀렸다.** 「`workspaces.controller.ts` 에
      `RolesGuard` 가 없다」고 적었는데 그것은 **전역 `APP_GUARD`**(`app.module.ts:213`)다.
      결론(상류 차단 없음)은 유지되지만 이유가 다르고 더 넓다 — 가드가 통과시키는 것은
      `@Roles()` 가 없고 핸들러가 `@WorkspaceId()` 대신 `@Param('id')` 를 써
      `handlerConsumesWorkspaceId` 가 false 이기 때문이다. **같은 컨트롤러 17개 중 13개가
      같은 형태**이고, 완료된 `auth-workspace-membership-guard.md` 의 모집단(«`@WorkspaceId()`
      를 소비하는 73건»)은 이들을 구성상 포함하지 않는다. 트래커를 정정했다(`893365572`)
- [x] **e2e 로 결함 재현** — 고치기 전 `[204, 204]` 였고(공허성 가드 통과), DB 를 직접 조회해
      한 `id` 에 `auth_config.delete` 감사가 **2건**임을 확인했다
- [x] 단위 테스트 + 구현 — 뮤턴트 **둘**이 예측과 일치했다: (a) `=== 0` → `!affected` →
      **대조군 2건 RED**(예측 2), (b) 404 분기 제거(고유 앵커) → **진 쪽 1건 RED**(예측 1).
      원복은 `cp` 백업으로 했다
- [x] TEST WORKFLOW — lint PASS · unit PASS · build PASS · **e2e 375 PASS**.
      **타입체크 ratchet 이 두 번 잡았다**: 대조군의 `affected: null|undefined` 가
      `DeleteResult` 에 대입되지 않는 것, 그리고 캐스트를 넣어도 mock 팩토리의 **추론된 리터럴
      반환 타입**이 `mockResolvedValueOnce` 의 파라미터를 좁혀 여전히 거부하는 것. 팩토리에
      `Promise<DeleteResult>` 를 명시해 닫았다 — jest 도 `nest build` 도 못 보는 자리다
- [ ] `/ai-review` → 수렴
- [ ] `/consistency-check --impl-done spec/2-navigation` → BLOCK: NO
- [ ] 트래커 항목 해소 + 이 plan `plan/complete/` 로
