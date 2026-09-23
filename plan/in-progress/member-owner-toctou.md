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

### 기각한 대안 — 트랜잭션 + 잠근 재조회 (형제 셋과 동형)

`--impl-prep` `07_29_15` 의 `rationale_continuity` **WARNING 1** 이 이 선택을 정면으로 짚었고,
확인해 보니 **지적이 맞다** — 같은 도메인의 형제 셋이 전부 비관적 락이다
(`spec/data-flow/12-workspace.md:188` `deleteWorkspace` · `:189` `leaveWorkspace` ·
`transferOwnership`). 게다가 **같은 엔드포인트의 자가 탈퇴 갈래는 이미 락을 쓴다**
(`removeMember` → `leaveWorkspace` 위임). 그래서 한 번 더 저울질했다.

기각 사유는 취향이 아니라 **셀 수 있는 손실**이다:

> 락 안에서 재조회하면 존재가 보장되므로 `delete` 는 **항상 1행**이다. 즉 #1373 이 이 메서드에
> 세운 `affected === 0` 판별자가 도달 불가가 되고, 그것을 고정하는 기존 단위 테스트가 죽은
> 코드를 가리키게 된다. 그 판별자는 «감사가 두 번 남는다» 를 실측으로 닫은 장치다 — 8일 전에
> 세운 방어를 무르게 만들면서 얻는 것이 «형제와 같은 모양» 뿐이다.
>
> **두 주장을 갈라 둔다.**
> - *실측*: 그 판별자에 의존하는 기존 테스트는 **`it` 선언 2개 / 실행 케이스 3개**다 —
>   «진 쪽은 404 이고 감사를 남기지 않는다»(1) + 드라이버 미보고 대조군
>   `it.each([[undefined], [null]])`(2). (세어 봤다. «3건» 이라고만 적으면 단위가 모호하다.)
> - *추론*: 락 안에서는 그 셋이 도달 불가가 된다는 것 — Option 2 를 짓지 않았으므로
>   측정이 아니다. 기각 사유의 무게는 여기 실려 있으니, 이 추론이 틀리면 재판단한다.

부수 사유 둘: (i) 드문 레이스 하나 때문에 **모든** 멤버 제거에 트랜잭션 + 잠금 읽기를 얹는다.
(ii) `spec/data-flow/12-workspace.md:141` 은 «owner 는 제거 불가» 만 적고 **메커니즘을 규정하지
않는다** — 형제들의 락은 그 행들에 명시돼 있지만 이 행에는 없다. 그래서 spec 위배가 아니다.

**대신 WARNING 1 이 요구한 것은 이행한다**: (a) spec Rationale 명문화는 `spec/` 권한 밖이라
planner 항목으로 등재하고, (b) 코드 주석에 `4-execution-engine.md` §8 선례
(**타-행 집계 조건**)와 이번 자리(**같은-행 조건**)의 차이를 적어 다음 리뷰어의 오적용을 막는다.

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

- [x] **고치기 전 RED 를 먼저 봤다.** 실측: **`Expected: 403, Received: 200`**
      (`_test_logs/e2e-20260924-074419.log`). 공허성 가드(`expect(raced).toBe('pending')`)를
      **통과한 뒤** 난 실패라 겹침은 실제로 만들어졌다 — 공허한 RED 가 아니다.
      > 트래커의 등재 실측은 `status=200` · `rows_remaining=0` 이었다. **`status=200` 은 다시
      > 쟀고 일치한다. `rows_remaining` 은 그 단언보다 앞에서 테스트가 끊겨 이번 RED 에선
      > 관측되지 않았다** — 200 이면 DELETE 가 1행을 지웠다는 뜻이지만 그것은 추론이다.
- [x] 고친 뒤 GREEN + 뮤턴트 3종.

### 뮤턴트 — 예측과 대조

| 뮤턴트 | 예측 | 실측 | 죽은 테스트 |
| --- | --- | --- | --- |
| **A**: `role: Not('owner')` 제거 | unit 1 · **e2e 1** | **1 · 1** | unit «한 행을 지우면 …»(술어 단언) · e2e «owner 로 승격되면 403»(`Expected 403, Received 200`) |
| **B**: `still?.role === 'owner'` → `still` | unit 1 | **1** | «진 쪽은 404 이고 감사를 남기지 않는다» |
| **C**: `affected === 0` → `!affected` | unit 2 | **2** | 드라이버 미보고 대조군 `undefined`·`null` |

**A 의 두 다리가 서로를 보완한다** — unit 은 «술어를 넘겼다» 만, e2e 는 «그것이 SQL 로
렌더돼 실제로 owner 를 지키는가» 를 본다. unit 만으로는 `Not` 이 deep-equality 에
불투명해 무엇도 확인되지 않는다.

**B 가 «0이면 무조건 403» 으로 줄이는 편집을 죽인다.** 그래서 «행이 사라졌으면 404» 블록을
따로 뒀다 — 그 블록 없이는 재조회 결과를 안 보는 편집이 살아남는다.

> **기존 e2e 가 그대로 초록인지도 본다** — `member-remove-concurrency.e2e-spec.ts` 의
> `[200, 404]` 는 **owner 가 아닌** 두 DELETE 의 겹침이라 이 변경에 영향받지 않아야 한다.
> 영향받으면 술어가 너무 넓은 것이다.

## F. 하지 않는 것

- **권한 검사 순서 오라클** — 트래커 별 항목이다. 계약이 또 다르다.

  > **노출 대상은 «비-admin» 이 아니라 «임의 인증 사용자» 다.** 처음 이 절에 *"비-admin 에게
  > 대상의 role 을 흘린다"* 라 적었는데 한 칸 좁았다. `RolesGuard` 는 전역 `APP_GUARD` 지만
  > `handlerConsumesWorkspaceId` 가 false 면 단락하고(`roles.guard.ts:116`), 이 핸들러는
  > `@WorkspaceId()` 가 아니라 `@Param('id')` 를 쓴다 — 즉 **멤버십 검사가 가드 층에서
  > 전혀 돌지 않는다.** 서비스의 첫 멤버십 검사인 `assertAdmin` 은 owner 가드 **뒤**다.
  >
  > `/ai-review` `08_09_57` W2 가 이 좁음을 짚었는데 **대상 문서를 잘못 지목했다** —
  > 트래커 항목은 이미 *"요청자가 그 워크스페이스 멤버가 아니어도"* 로 정확하고
  > 13/17 라우트 분석까지 담고 있다. 좁게 적힌 것은 이 plan 의 이 줄이었다.
  > (트래커는 고칠 것이 없다 — 확인하고 손대지 않았다.)
- `leaveWorkspace` 갈래 — 이미 트랜잭션 + `pessimistic_write` 로 닫혀 있고 기존 e2e 가 고정한다.

## 체크리스트

- [x] `/consistency-check --impl-prep spec/5-system` → **BLOCK: NO · Critical 0 · Warning 4**
      (`review/consistency/2026/09/24/07_29_15`). WARNING 1 이 설계 선택을 짚어 재저울질했고
      (§B 기각 블록), 나머지 셋은 planner/harness 소유라 같은 턴에 트래커로 등재했다.
- [x] e2e 재현 (RED 실측 — `Expected 403, Received 200`)
- [x] 구현 + 주석·JSDoc 정정 (§D) + `throwCannotRemoveOwner()` 추출
- [x] 뮤턴트 3종 — **전부 예측=실측**
- [x] TEST WORKFLOW — lint PASS(`lint-20260924-075122.log`) · backend unit **472스위트/9943**
      (`unit-20260924-075218.log`) · build PASS 타입체크 ratchet 포함
      (`build-20260924-075401.log`) · **e2e 379 PASS**(`e2e-20260924-075712.log`, 378 → 379)
- [ ] `/ai-review` → 수렴
- [ ] `/consistency-check --impl-done spec/5-system` → BLOCK: NO
- [ ] 트래커 항목 해소 + plan `complete/` 로 (**한 커밋으로**)
