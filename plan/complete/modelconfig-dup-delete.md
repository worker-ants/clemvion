---
title: 모델 설정 동시 삭제도 감사 행을 두 번 남긴다 — 여덟 번째 자리
status: complete
owner: developer
worktree: modelconfig-dup-delete-4b8e2d
started: 2026-09-21
spec_impact: none
---

# `ModelConfigService.remove()` — 여덟 번째 자리

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 developer 항목
«`ModelConfigService.remove()` 도 동시 삭제에서 감사 행을 두 번 남긴다» (2026-09-21 등재)를 닫는다.

## A. 결함 — 형제 일곱과 같은 형태다

`model-config.service.ts:399-414`:

```ts
const config = await this.findEntity(id, workspaceId);  // 무락, 없으면 404 MODEL_CONFIG_NOT_FOUND
const { kind } = config;                                 // remove 가 id 를 지우므로 미리 캡처
await this.repo.remove(config);                          // ← 0행이어도 던지지 않는다
this.notifyInvalidated(id);
await this.recordAudit({ action: MODEL_CONFIG_DELETE, resourceId: id, kind });
```

락이 없으므로 처방도 #1372·#1373·#1374 와 같다 — **단일 원자적 `DELETE` 의 `affected`**:

```ts
const { affected } = await this.repo.delete({ id, workspaceId });
if (affected === 0) throw this.notFound();   // 진 쪽 — 통지도 감사도 없음
```

## B. 트래커에 내가 적은 것 하나가 과장이었다

등재할 때 «`notifyInvalidated` 도 두 번 발화한다 — 이 자리는 감사 중복에 **더해** 캐시 무효화
통지 중복까지 있다» 고 적었다. **그 「더해」는 과장이다.** 리스너를 따라가 보면
`llm.service.ts:81-82` 의 `clearClientCache(configId)` 하나뿐이고, 캐시 축출은 **멱등**이라
두 번 불려도 해로운 결과가 없다.

정확히 말하면: 중복 통지는 **고쳐야 할 별개 결함이 아니라**, 이 수정이 진 쪽에서 함께
건너뛰게 되는 부수 효과다. 단위 테스트는 그 사실을 단언한다(진 쪽에서 `notifyInvalidated`
미발화) — 「멱등이라 상관없다」와 「진 쪽이 아예 안 부른다」는 다른 주장이고, 후자가 이 수정의 계약이다.

## C. 형제 일곱과 다른 점 — 착수 전 실측

| 확인할 것 | 실측 |
| --- | --- |
| 404 코드 | **`MODEL_CONFIG_NOT_FOUND`** — 형제들의 `RESOURCE_NOT_FOUND` 가 **아니다**. 진 쪽은 `findEntity` 와 같은 코드를 받아야 하므로 기존 `this.notFound()` 를 그대로 쓴다 |
| 헬퍼 추출 | **불필요.** `private notFound(): NotFoundException` 이 이미 있다(`:148`). 이 계열에서 헬퍼가 이미 있던 첫 자리다 — #1370·#1371·#1372·#1373·#1374 는 전부 추출이 필요했다 |
| 라우트 성공 코드 | **204** (`@Delete(':id')` + `@HttpCode(HttpStatus.NO_CONTENT)`) |
| `remove`→`delete` 등가 | **성립.** `ModelConfig` 에 `cascade: true` 도 `@OneToMany` 도 없고(`ManyToOne(Workspace, {onDelete:'CASCADE'})` 뿐), 저장소 전체에 **remove 계열 라이프사이클 훅·subscriber 0건** |
| 참조 FK | 둘 다 **`ON DELETE SET NULL`** — `knowledge_base.rerank_config_id`(`V090:22`) · KB embedding(`V091:23`). DB 레벨이라 두 방식 모두 동일하게 발화한다 |
| `kind` 캡처 | `remove` 가 아니라 `delete` 를 쓰면 엔티티 id 가 지워지지 않지만, `kind` 는 **감사 payload 에 필요**하므로 `findEntity` 결과에서 그대로 읽는다. 기존 주석(«remove 가 id 를 지우므로») 은 전환 후 **사실이 아니게 되므로** 함께 고친다 |

## D. 재현을 먼저 한다

e2e 는 형제들의 행 락 기법 그대로: 테스트가 `model_config` 행을 `SELECT … FOR UPDATE` 로 쥐면
두 요청이 무락 `findEntity` 를 통과한 뒤 `DELETE` 에서 멈춘다.

- 단언: 상태쌍 `[204, 404]`(현행 예측은 `[204, 204]`) + 진 쪽 코드 `MODEL_CONFIG_NOT_FOUND`
  + `audit_log` 의 `model_config.delete` **1건**.
- 공허성 가드: 락을 놓기 **전에** 둘 다 아직 안 끝났음을 관측한다.

## 이 PR 이 하지 않는 것

- **아홉 번째 WebAuthn credential 삭제** — 별 PR. 그 자리는 감사가 **컨트롤러**에 있고
  서비스가 이미 `.delete()` 를 쓰되 `affected` 를 버리는 형태라 손대는 지점이 다르다.
- **동시성 e2e 공용 헬퍼 추출** — 이 PR(여덟 번째)은 하지 않는다. 리뷰가 두 라운드 연속
  «8·9번째 시점에 재검토» 로 권고했는데, **이 PR 이 하지 않는 유일한 근거는 "한 파일만
  고치면 형제 여덟과 비대칭이 된다"** 는 것뿐이다 — 유예를 또 유예로 넘기지 않는다.
  **선행 조건**: 아홉 번째(WebAuthn) PR 은 **착수 시점**에 공용 헬퍼(`raceDeleteRequests`
  + `assertSingleAudit` 등) 추출 여부를 실제로 **결정**하고, 그 결정(추출하거나, 추출하지
  않기로 한 새 근거)을 그 PR 의 plan 에 명시한다. 이 조건을 만족하지 못한 채 착수하면
  그 PR 은 시작할 수 없다.

## 체크리스트

- [x] `/consistency-check --impl-prep spec/2-navigation` — `review/consistency/2026/09/21/16_16_35`
      **BLOCK: NO** (Critical 0 · Warning 1). W1(옴니버스 트래커의 위치 스냅샷이 이 fix 착지 뒤
      stale 해진다)은 **그 자리에서** `6-config.md §Model Config API` 를 스냅샷에 더해 닫았다 —
      **`6-config.md` 한 파일에 두 행**이라는 주의도 함께 적었다(파일 단위로 훑으면 한 행만
      고치고 끝낼 수 있다). `5-system/8-embedding-pipeline.md` 는 **손으로 읽었다** — 그 문서의
      `pending_plans`(`update-returning-tuple-shape.md`)는 raw `.query()` 튜플 오독 클래스라
      Repository `.delete().affected` 를 쓰는 이 fix 와 무관하다(checker INFO 6 와 같은 결론)
- [x] 트래커의 과장(「캐시 무효화 통지 중복까지」) 정정 — 리스너가 `clearClientCache` 하나뿐이고
      캐시 축출은 멱등임을 확인해 트래커에 정정을 달았다
- [x] **e2e 로 결함 재현** — 고치기 전 `[204, 204]` 였고(공허성 가드 통과), DB 를 직접 조회해
      한 `id` 에 `model_config.delete` 감사가 **2건**임을 확인했다
- [x] 단위 테스트 + 구현 — 뮤턴트 **둘**이 예측과 일치했다: (a) `=== 0` → `!affected` →
      **대조군 2건 RED**(예측 2), (b) 404 분기 제거(고유 앵커, 3줄) → **진 쪽 1건 RED**(예측 1).
      원복은 `cp` 백업으로 했다.
      **전환이 기존 테스트 셋을 vacuous 하게 만드는 것을 먼저 처리했다**: 둘은 `mockRepo.remove`
      를 겨냥하던 단언이라 `delete` 로 옮겼고(#1372 에서 리뷰가 뮤테이션으로 실측한 형태),
      하나는 TypeORM 의 id 파괴를 흉내 내 «kind 를 미리 읽는다» 를 고정하던 테스트다 —
      `delete(criteria)` 는 엔티티를 건드리지 않아 그 흉내가 허구가 되므로 흉내를 지우고
      여전히 참인 계약만 남겼다
- [x] TEST WORKFLOW — lint PASS · unit PASS · build PASS(타입체크 ratchet 포함) ·
      **e2e 376 PASS** (`_test_logs/e2e-20260921-163527.log`)
- [x] `/ai-review` → **2라운드로 수렴** (정지 규칙 첫째 절: Critical·Warning 0).
      라운드 1 `review/code/2026/09/21/16_39_52` Critical 0 · Warning 3 → 전부 조치.
      **그중 둘이 내 문제였다**: CHANGELOG 관례를 또 빠뜨렸고(이 세션 세 번째, 한 번은 backfill
      커밋까지 만들어 놓고 반복), 더 중요하게는 **#1374 의 CHANGELOG 에 내가 써 넣은 예고
      («여덟 번째는 캐시 무효화 통지 중복까지 함께 있음»)를 이번 PR 이 반증했는데 트래커만
      고치고 배포 이력은 그대로 뒀다** — 취소선으로 정정하고 실측을 함께 실었다.
      INFO 2 도 내가 쓴 거짓 인과였다(«`isDefault: false` 를 쓰는 이유는 default 스왑 때문» —
      `remove()` 는 `isDefault` 를 **0회** 참조한다).
      라운드 2 `review/code/2026/09/21/17_08_12` **Critical 0 · Warning 0**(`RESOLUTION.md`).
      그 라운드 INFO 5 가 **정정의 근거 자체가 한 줄 어긋났음**을 잡았다(`llm.service.ts:81` 은
      리스너 선언, `clearClientCache` 호출은 `:82`) — 세 문서를 `:81-82` 로 고쳤다
- [x] `/consistency-check --impl-done spec/2-navigation` → `review/consistency/2026/09/21/17_17_08`
      **BLOCK: NO** (Critical 0 · Warning 1). W1: 아래 «이 PR 이 하지 않는 것» 의 착수 선행 조건이
      **곧 archive 될 이 plan 에만** 있어 실제 착수자가 보는 트래커에는 안 보인다는 지적 —
      트래커의 WebAuthn 항목에 **미러링했다**. 규칙이 읽히지 않는 자리에 있으면 규칙이 아니다
- [x] 트래커 항목 해소 + 이 plan `plan/complete/` 로
