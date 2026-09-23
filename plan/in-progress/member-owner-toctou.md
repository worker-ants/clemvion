---
title: removeMember 의 owner 보호 가드가 TOCTOU 로 뚫린다
status: in-progress
owner: developer
worktree: member-owner-toctou-51309a
spec_impact: none
started: 2026-09-24
---

# 가드는 무락 읽기 위에 서 있고, 그 사이에 대상이 owner 가 된다

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 developer 항목
«`removeMember()` 의 owner 보호 가드가 TOCTOU 로 뚫린다 — 실측 확인됨» 을 닫는다.
**#1373 에서 내가 등재**했고, 같은 PR 이 «계약이 다른 별 사안» 으로 유예한 항목이다.

`workspaces.service.ts` 의 «owner 는 제거할 수 없다» 가드는 **무락 `findOne`** 위에 있다.
읽기와 DELETE 사이에 그 멤버가 owner 로 승격되면 가드를 통과한 채 owner 가 지워지고,
`workspace.ownerId` 는 **멤버십 없는 사용자**를 가리키게 된다.

## A. 왜 «감사 중복» 과 다른 결함인가

| | #1373 이 닫은 것 | 이 PR |
| --- | --- | --- |
| 계약 | 감사를 두 번 남기지 않는다 | **owner 를 지우지 않는다** |
| 겹치는 상대 | 같은 `DELETE` 두 건 | `DELETE` × **`transferOwnership`** |
| 손상 | 감사 행 2건 | `workspace.ownerId` 가 비-멤버를 가리킴 (**데이터 정합성**) |

#1373 이 함께 닫지 않은 사유는 비용이 아니라 **판별자 오염**이었다 — 그 PR 의 주제가
`affected === 0` 판별자를 세우는 것인데, 여기서 `role` 술어를 더하면 그 0 의 의미가
하나에서 둘로 늘어난다. 이제 판별자가 자리를 잡았으므로 그 위에 쌓는다.

## B. 처방 — 새 락을 들이지 않는다

```ts
const { affected } = await this.memberRepository.delete({
  id: memberId, workspaceId, role: Not('owner'),
});
if (affected === 0) {
  // 0 의 이유가 둘이다 — 행이 사라졌나, owner 가 됐나. 0-행 경로에서만 한 번 더 읽어 가른다.
  const still = await this.memberRepository.findOne({ where: { id: memberId, workspaceId } });
  if (still?.role === 'owner') throw Forbidden('CANNOT_REMOVE_OWNER');
  throw NotFound('MEMBER_NOT_FOUND');
}
```

**왜 술어 하나로 충분한가 — 실측으로 확인할 메커니즘**: `transferOwnership` 은 대상 멤버 행에
`pessimistic_write` 를 쥔다. 겹친 DELETE 는 그 락을 기다렸다가, 커밋 뒤 **갱신된 행 버전에
대해 `WHERE` 를 다시 평가**한다(Postgres READ COMMITTED 의 EvalPlanQual). 그래서
`role != 'owner'` 가 승격된 행을 제외한다 — 이 경로에 락을 새로 들일 필요가 없다.

> **이것은 검증할 주장이지 전제가 아니다.** e2e 가 이 문장을 직접 행사한다 — 재평가가
> 일어나지 않는다면 owner 가 지워지고 테스트가 RED 가 된다.

**기각한 대안 — 트랜잭션 + 잠근 재조회.** 정확하지만 **지금 락이 하나도 없는 경로에 락을
들인다.** 형제 아홉(#1369~#1376)이 이 경로를 무락으로 유지한 것은 의도였고, 술어 하나로
같은 보장을 얻는다면 그 결정을 뒤집을 이유가 없다.

**이른 가드는 남긴다** — `member.role === 'owner'` 검사는 흔한 경우를 `assertAdmin` 전에
403 으로 끊는다. DELETE 의 술어는 그 뒤를 받는 **backstop** 이다.

## C. 착수 전 실측 — 미검증 전제를 먼저 지웠다

| 전제 | 실측 |
| --- | --- |
| `delete()` 가 FindOperator 를 받는가 | **받는다.** `EntityManager.delete` → `normalizeAndValidateWhereCriteria` → 객체는 non-primitive 경로라 `whereInIds` 가 아니라 `qb.where(object)` 로 간다 |
| 그 렌더링이 **실제로 맞는가** | 저장소 선례 4건(`delete({expiresAt: LessThan(…)})` 3곳 · `update({familyId: Not(…)})` 1곳) |
| 선례가 **테스트로 고정**돼 있나 | **실 DB e2e 로 고정됨** — `session-revocation.e2e-spec.ts` D «revoke-others → 현재 세션만 남고 나머지 모두 무효». `Not` 이 무시되면 현재 세션도 폐기돼 RED |
| 단위 테스트로 갈음 가능한가 | **불가.** `sessions.service.spec.ts` 가 *"`Not(...)` 절은 jest deep-equality 에 불투명"* 이라 적고 criteria 객체만 본다 — 오라클은 실 DB 뿐이다 |
| `CANNOT_REMOVE_OWNER` 가 spec 에 있나 | 있다 — `spec/5-system/1-auth.md` 가 이 가드를 직접 서술(각주 † · §3.2 정정) |

spec 은 «대상이 Owner 인 경우 거부된다» 고 적는다. 이 PR 은 그 문장을 **동시성 하에서도
참으로 만드는 것**이라 서술을 바꾸지 않는다 → `spec_impact: none`.

## D. 이 PR 이 거짓으로 만드는 내 예고 — 같이 고친다

`workspaces.service.ts` 의 DELETE 위 주석에 내가 이렇게 적었다:

> *"그것은 계약이 다른 별 사안이라 함께 닫지 않았다 — 여기서 `role: Not('owner')` 를 더하면
> `affected === 0` 의 의미가 둘로 늘어나 이 판별자 자체가 흐려진다."*

이 PR 이 정확히 그것을 한다. **주석을 남겨 두면 다음 사람이 「하면 안 되는 일」로 읽는다.**
`spec/` 이 아니라 코드 주석이므로 자기-반증형 소정정 조항의 대상이 아니다 — 그냥 고친다.
같은 메서드의 JSDoc(«동시성 보장: …») 도 보장 범위가 넓어지므로 함께 갱신한다.

## E. TDD — 결정적 재현을 먼저

레이스로는 인터리빙을 못 고른다(둘 다 같은 행 락을 기다려 큐 순서에 달린다). **재진입으로**
만든다 — 테스트가 락을 쥐고 승격을 끼워 넣는다:

1. locker 가 `SELECT id FROM workspace_member WHERE id=$1 FOR UPDATE`
2. `DELETE /api/workspaces/:id/members/:memberId` 발사 → 무락 읽기(`role='editor'`)와
   가드를 지나 삭제에서 멈춘다 (공허성 가드로 «아직 안 끝남» 관측)
3. locker 가 `UPDATE workspace_member SET role='owner' WHERE id=$1` 후 COMMIT
   — `transferOwnership` 이 그 행에 가하는 **효과의 대역**이다
4. 단언: 요청은 **403 `CANNOT_REMOVE_OWNER`**, 멤버 행은 **남아 있다**

- [ ] **고치기 전 RED 를 먼저 본다.** 예측: `status=200` · `rows_remaining=0`
      (트래커가 등재 시 실측한 값 — 내가 다시 잰다).
- [ ] 고친 뒤 GREEN + 뮤턴트로 단언 유효성 확인.

> **기존 e2e 가 그대로 초록인지도 본다** — `member-remove-concurrency.e2e-spec.ts` 의
> `[200, 404]` 는 **owner 가 아닌** 두 DELETE 의 겹침이라 이 변경에 영향받지 않아야 한다.
> 영향받으면 술어가 너무 넓은 것이다.

## F. 하지 않는 것

- **권한 검사 순서 오라클**(이른 `CANNOT_REMOVE_OWNER` 가 `assertAdmin` 보다 먼저라
  비-admin 에게 대상의 role 을 흘린다) — 트래커 별 항목이다. 계약이 또 다르다.
- `leaveWorkspace` 갈래 — 이미 트랜잭션 + `pessimistic_write` 로 닫혀 있고 기존 e2e 가 고정한다.

## 체크리스트

- [ ] `/consistency-check --impl-prep spec/5-system` → BLOCK: NO
- [ ] e2e 재현 (RED 실측)
- [ ] 구현 + 주석·JSDoc 정정 (§D)
- [ ] 뮤턴트로 단언 유효성 (예측/실측 두 칸)
- [ ] TEST WORKFLOW (lint · unit · build · e2e) — 숫자는 로그 파일명과 함께
- [ ] `/ai-review` → 수렴
- [ ] `/consistency-check --impl-done spec/5-system` → BLOCK: NO
- [ ] 트래커 항목 해소 + plan `complete/` 로 (**한 커밋으로**)
