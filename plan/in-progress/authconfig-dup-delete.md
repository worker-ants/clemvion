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

- [ ] `/consistency-check --impl-prep spec/2-navigation` → BLOCK: NO
      (`6-config.md` 의 `code:` 가 `modules/auth-configs/**` 를 문다. 단
      `5-system/12-webhook.md`·`1-auth.md` 도 이 서비스 파일을 직접 지목하므로 **그 둘은 손으로
      읽는다** — `related_specs` 예산이 `5-system/` 에 도달하지 못한다는 기록이 있다)
- [ ] **e2e 로 결함 재현** (고치기 전 실측을 숫자로 기록)
- [ ] 단위 테스트 + 구현 (대조군 포함, 뮤턴트 유효성 확인 후 kill 수 읽기)
- [ ] TEST WORKFLOW (lint · unit · build · e2e)
- [ ] `/ai-review` → 수렴
- [ ] `/consistency-check --impl-done spec/2-navigation` → BLOCK: NO
- [ ] 트래커 항목 해소 + 이 plan `plan/complete/` 로
