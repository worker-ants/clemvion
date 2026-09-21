---
title: 멤버 제거도 동시 요청에서 감사 행을 두 번 남긴다 — 여섯 번째, 그리고 마지막이 아니다
status: in-progress
owner: developer
worktree: member-dup-remove-2d4f8b
started: 2026-09-21
spec_impact: none
---

# `WorkspacesService.removeMember()` — 여섯 번째 자리

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 developer 항목
«`WorkspacesService.removeMember()` 도 동시 삭제에서 감사 행을 두 번 남긴다» (2026-09-21 등재)를 닫는다.

## A. 「마지막」이라는 말을 이번엔 어떻게 세는가

직전 두 PR 이 연속으로 «마지막» 을 틀렸다. #1371 은 `AUDIT_ACTIONS.*_DELETED` **접미사로만** 세서
`MEMBER_REMOVED` 를 놓쳤고, #1372 는 그것을 고쳐 여섯 번째를 찾아냈다. 이번에는 접미사도
액션 이름도 아니라 **«저장소에서 행을 지우고 감사를 남기는 서비스 메서드»** 로 세고, 그 열거가
어떻게 틀릴 수 있는지를 먼저 적는다 — 세는 축을 적어 두지 않으면 다음 사람이 또 좁게 센다.

- [x] 열거 축을 **감사 액션이 아니라 저장소 삭제 호출**로 잡았다: `*.remove(` · `manager.remove(` ·
      `*.delete(` 를 backend `modules/` 전수로 훑어 삭제 호출 **15+17자리**를 뽑고, 그중 **감사를
      남기는** 것만 골랐다. (액션 이름으로 세면 `_DELETED`/`_REMOVED` 접미사 변종에서 샌다.)
- [x] **감사 호출은 서비스에만 있지 않다.** 서비스 안에서 `auditLogsService.record` 를 세면
      `webauthn` 자리를 놓친다 — 거기선 **컨트롤러**가 감사를 남긴다. 그래서 삭제 호출을 가진
      모든 모듈의 **컨트롤러도 함께** 셌다(나머지 8개는 0건 확인).

**실측으로 확정한 표** — 여섯 번째는 마지막이 아니다. **세 자리가 더 남는다**:

| # | 자리 | 형태 | 상태 |
| --- | --- | --- | --- |
| 1 | `workflows.service.ts` `remove()` | 부모 행 락 + 재조회 | #1369 |
| 2 | `workspaces.service.ts` `deleteWorkspace()` | 같은 락의 `parentPresence` | #1369 |
| 3 | `triggers.service.ts` `remove()` | advisory lock + 재조회 | #1370 |
| 4 | `schedules.service.ts` `remove()` | advisory lock + 트리거 `affected` | #1371 |
| 5 | `integrations.service.ts` `remove()` | 락 없음 → 원자적 `DELETE` 의 `affected` | #1372 |
| 6 | **`workspaces.service.ts` `removeMember()`** (`:806`) | **락 없음** | **이 PR** |
| 7 | `auth-configs.service.ts` `remove()` (`:287`) | 락 없음 — `findById` → `remove` → `AUTH_CONFIG_DELETE` | **남는다** |
| 8 | `model-config.service.ts` `remove()` (`:404`) | 락 없음 — `findEntity` → `remove` → `MODEL_CONFIG_DELETE` | **남는다** |
| 9 | `webauthn.service.ts` `deleteCredential()` (`:532`) | 락 없음 — `.delete()` 는 쓰지만 **`affected` 를 버린다**. 감사(`USER_2FA_DISABLED`)는 `webauthn.controller.ts:338` | **남는다** |
| — | `workspaces.service.ts` `leaveWorkspace()` (`:668`) | 트랜잭션 안 `pessimistic_write` 재조회 | **이미 닫혀 있다** |
| — | `workspace-invitations.service.ts` `revoke()` (`:424`) | 락 없음이지만 **감사를 남기지 않는다** | **이 계열 아님** |

> #9 가 이 축의 값을 보여 준다. 그 자리는 이미 `.delete()` 를 쓰고 있어서 «`remove(entity)` 를
> 찾자» 는 축으로는 안 걸리고, 감사가 컨트롤러에 있어서 «서비스에서 감사를 찾자» 는 축으로도
> 안 걸린다. **«지우고 감사한다» 는 요청 단위 서술만이 셋 다 잡는다.**

## B. 결함 — 통합 경로와 같은 형태다

`workspaces.service.ts:778-816`:

```ts
const member = await this.memberRepository.findOne({ where: { id: memberId, workspaceId } });  // 무락
if (!member) throw NotFound('MEMBER_NOT_FOUND');
if (member.userId === requesterId) { await this.leaveWorkspace(...); return; }   // 자가 탈퇴 위임
if (member.role === 'owner') throw Forbidden('CANNOT_REMOVE_OWNER');
await this.assertAdmin(workspaceId, requesterId);
await this.memberRepository.remove(member);   // ← 0행이어도 던지지 않는다
await this.auditLogsService.record({ action: MEMBER_REMOVED, details: { mode: 'removed', ... } });
```

처방은 #1372 와 같다 — 락을 새로 들이지 않고 **원자적 `DELETE` 의 `affected`**:

```ts
const { affected } = await this.memberRepository.delete({ id: memberId, workspaceId });
if (affected === 0) throw NotFound('MEMBER_NOT_FOUND');   // 진 쪽 — 감사 없음
```

판정은 `affected === 0` **명시 비교**다(`null`·`undefined` 는 «드라이버 미보고» 이지 «못 지웠다» 가
아니다). 그 **이유를 붙드는 대조군 테스트**도 함께 넣는다 — #1371 에서 그것이 빠져 뮤턴트가 32건을
통과했고, #1372 에서 처음부터 덮어 2건 RED 를 얻었다.

## C. 형제 다섯에 없던 갈래 둘 — 예고가 아니라 실측으로 가른다

1. **자가 제거는 `leaveWorkspace()` 로 위임된다**(`member.userId === requesterId`). 그 경로는
   트랜잭션 안 `pessimistic_write` 라 **이미 닫혀 있다** — 진 쪽은 잠금 해제 후 행이 없어 `NOT_A_MEMBER`
   403 이고 감사를 남기지 않는다. **이 PR 의 수정은 admin-이-타인을-제거하는 갈래에만 닿는다.**
   - [ ] 위 「이미 닫혀 있다」를 **e2e 로 실증**한다. 추정으로 두지 않는다 — 트래커에 같은 문장을
         두 번 적었는데 아직 코드로 확인한 적이 없다.
2. **owner 가드와 `assertAdmin` 이 무락 읽기 위에 있다.** 제거 직전에 동시 `transferOwnership` 이
   대상을 owner 로 승격시키면 «owner 는 제거 불가» 가드를 통과한 채 owner 가 지워질 수 있다.
   - [ ] 이것이 실제로 재현되는지 **프로브로 먼저 확인**한다. 재현되면 별 사안으로 등재하고
         (통합 경로의 사용처-검사 TOCTOU 와 같은 처분), 재현되지 않으면 **왜 안 되는지**를 적는다.
         재현 실패를 「없다」로 읽지 않는다 — 인터리빙 지점이 가설의 일부다.

## D. 재현을 먼저 한다

e2e 는 #1372 의 행 락 기법 그대로: 테스트가 `workspace_member` 행을 `SELECT … FOR UPDATE` 로 쥐면
두 요청이 무락 조회·가드를 통과한 뒤 `DELETE` 에서 멈춘다.

**형제 다섯과 다른 두 가지**(착수 전 실측):

- **이 라우트는 204 가 아니라 `200 {data:{ok:true}}`** 를 돌려준다(`workspaces.controller.ts:374`).
  형제 다섯은 전부 204 였으므로 단언을 그대로 베끼면 틀린다 — 상태쌍은 **`[200, 404]`**.
- **감사 개수를 셀 때 `details->>'mode' = 'removed'` 까지 걸어야 한다.** 자가 탈퇴와 admin 제거가
  `member.removed` 라는 **같은 액션 이름**을 공유하고 `mode` (`left`/`removed`)로만 갈리기 때문이다.
  형제들은 액션 이름만으로 갈렸다.

- 단언: 상태쌍 `[200, 404]`(현행 예측은 `[200, 200]`) + `mode='removed'` 감사 **1건**.
  진 쪽 에러 `code` 까지 본다 — 형제 `workspace-delete-concurrency` 가 `{status, code}` 로 단언하고,
  직전 PR 리뷰(INFO 4)가 «통합 e2e 는 status 만 봐서 형제보다 약하다» 고 지적했다.
- 공허성 가드: 락을 놓기 **전에** 둘 다 아직 안 끝났음을 관측한다.
- 셋업: `inviteAndAccept(...)` 로 editor 멤버를 붙인다. 초대 엔드포인트에 **1분당 10건 throttler**
  가 있어 헬퍼가 최대 ~30s backoff 재시도를 하므로 `beforeAll` timeout 을 넉넉히 잡는다.

## 체크리스트

- [x] A 의 전수 조사 — 삭제 호출 축으로 세고 표를 확정. 남는 세 자리 **트래커 등재**(grep 0→3)
- [x] `/consistency-check --impl-prep spec/2-navigation` — `review/consistency/2026/09/21/12_23_48`
  **BLOCK: NO** (Critical 0 · Warning 4). W2(«서술 부재 목록에 `9-user-profile.md` §6.1 ·
  `data-flow/12-workspace.md` §1.6 가 빠졌다», checker 셋 교차)는 **그 자리에서** 트래커 스코프를
  넓혀 닫았고, W1(멱등성 각주)은 «경로 수를 세지 말라» 는 주의와 함께 기존 항목에 덧붙였다 —
  전수 조사가 아홉 자리를 찾았으므로 «다섯 경로» 라 쓰면 곧 stale 이 된다. W3(번들 예산 절단)은
  harness 사안이고 checker 가 수동 Read 로 보완해 실질 영향 없음을 확인했다.
  **W4 가 아래 C-2 를 붙든다** — «프로브 전에는 `plan/complete/` 로 옮기지 말 것»
- [ ] **e2e 로 결함 재현** (고치기 전 실측을 숫자로 기록)
- [ ] C-1 자가 탈퇴 경로가 이미 닫혀 있음을 실증
- [ ] C-2 owner 승격 TOCTOU 프로브 — 재현 여부와 근거를 기록
- [ ] 단위 테스트 + 구현 (대조군 포함, 뮤턴트 유효성 확인 후 kill 수 읽기)
- [ ] TEST WORKFLOW (lint · unit · build · e2e)
- [ ] `/ai-review` → 수렴
- [ ] `/consistency-check --impl-done spec/2-navigation` → BLOCK: NO
- [ ] 트래커 항목 해소 + 이 plan `plan/complete/` 로
