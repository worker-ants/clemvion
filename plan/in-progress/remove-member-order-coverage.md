---
title: removeMember 판정 순서 커버리지의 비대칭 두 칸
status: in-progress
owner: developer
worktree: remove-member-order-coverage
spec_impact: none
started: 2026-09-24
---

# 판정 순서 다섯 칸 중 두 칸만 뒤집어도 스위트가 초록이다

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 developer 항목
«`removeMember` 판정 순서 커버리지의 비대칭 두 칸»(낮음)을 닫는다. 등재 근거는
`/ai-review` `review/code/2026/09/24/11_10_45` INFO#3·#4 와, 그 다음 라운드 `11_37_06` 의
INFO#5·#6 **재지적**이다. 앞 PR(`member-auth-order`)이 수렴 예외로 미뤘다.

`removeMember` 의 판정 순서는 docstring 이 적은 대로 **멤버십 → 대상 존재 → self 위임 →
admin → 대상이 owner 인가** 다(`workspaces.service.ts` `removeMember` 머리 주석). 같은
describe 블록이 이 중 두 쌍을 **전용 조합**으로 가른다:

| 쌍 | 가르는 테스트 | 상태 |
| --- | --- | --- |
| 멤버십 → 대상 조회 | «비-멤버는 대상을 조회하기 전에 NOT_A_MEMBER 로 끝난다» | 있음 |
| self 위임 → admin | «비-admin 도 자기 자신이면 위임된다 — ADMIN_REQUIRED 가 아니다» | 있음 |
| admin → owner | «비-admin 이 owner 를 지목하면 … ADMIN_REQUIRED 다» | 있음 |
| **대상 존재 → admin** | — | **없음** (§A-1) |
| **요청자 role 1회 조회** | — | **없음** (§A-2) |

## A. 착수 전 실측

| 확인 | 실측 |
| --- | --- |
| 대상 부재 테스트의 요청자 | `대상이 없으면 삭제를 시도하지 않는다` 는 `wireFindOne(null)` — 요청자가 **기본값 owner** 라 admin 판정을 어차피 통과한다. 그래서 404 가 admin 판정보다 앞인지 뒤인지 가르지 못한다 |
| 비-admin 요청자 테스트의 대상 | 셋 다 **대상이 실존**한다(editor · owner · self). 대상 부재와 비-admin 을 겹친 조합이 없다 |
| 요청자 조회 횟수를 보는 단언 | **0건.** `targetLookups` 필터(대상 조회 0회)는 있지만 요청자 쪽 횟수는 아무도 안 센다 |
| 테스트 파일이 spec-linked 인가 | **그렇다** — `review_guard._spec_linked_changes()` 가 `workspaces.service.spec.ts` 를 잡는다. 매칭 glob 은 `spec/2-navigation/9-user-profile.md` 의 `codebase/backend/src/modules/workspaces/**`. 대조군(`codebase/backend/src/nonexistent-control/foo.ts`)은 안 잡혔다 → `--impl-done` 대상 |

### A-1. 왜 404 가 admin 판정보다 앞이어야 하나 — 그리고 왜 403 도 틀린 답은 아닌가

**403 으로 가도 결함은 아니다.** 비-admin 멤버에게 404 와 403 중 무엇을 줄지는 보안상 차이가
없다. `listMembers` 는 **멤버십만** 요구하므로(`assertMembership`, `workspaces.service.ts`
`listMembers` 첫 줄) 멤버는 이미 모든 `memberId` 를 열거할 수 있다. 404 가 새로 알려 주는 것이
없다. 비-멤버 쪽 오라클은 앞 칸(멤버십 → 대상 조회)이 닫는다.

**형제와는 답이 다르다.** `updateMemberRole` 은 `assertAdmin` 이 첫 await 라, 비-admin 이 없는
대상을 지목하면 **403 `ADMIN_REQUIRED`** 를 받는다. `removeMember` 는 같은 입력에 **404** 를
준다. 이유는 self 위임이다 — 자기 자신인지는 대상을 읽어야 알고, 읽었으면 없다는 사실이 먼저
드러난다.

**그래서 이 테스트가 고정하는 것은 «문서화된 순서» 이지 보안 불변이 아니다.** 순서를 403 쪽으로
바꾸는 편집(대상 null 검사를 admin 판정 뒤로 내리고 self 비교를 `member?.userId` 로)은
타입체크도 통과하고 기존 스위트도 통과한다. 결과로 docstring 이 적은 순서와 실제 동작이 조용히
갈린다. 테스트가 막으려는 것은 바로 그 **침묵**이다. 403 이 더 낫다고 판단한다면 docstring 과
이 테스트를 **함께** 바꾸면 되고, 테스트 주석에 그 경로를 적어 둔다.

### A-2. 요청자 role 을 한 번만 읽는다

docstring 은 *"요청자 role 을 **한 번만** 읽는다 — `assertMembership` 과 `assertAdmin` 은 둘 다
`getMemberRole` 을 부르므로 그대로 이어 쓰면 같은 쿼리가 두 번 돈다"* 고 적는다. 그런데
`if (!ADMIN_ROLES.has(requesterRole)) this.throwAdminRequired()` 를 형제처럼
`await this.assertAdmin(...)` 로 «정리» 해도 동작은 같다. 쿼리 하나가 조용히 늘 뿐이고, 지금은
아무것도 그것을 보지 않는다.

**세는 단위는 쿼리다, 메서드 호출이 아니다.** `getMemberRole` 을 spy 로 세면 `findOne` 을
인라인하는 편집을 놓친다. 그래서 `memberRepo.findOne` 호출 가운데 **요청자 모양**
(`where.userId === requesterId`)인 것을 센다. 기대값은 정확히 1이다 — 0 이면(조회 키가 바뀌면)
공허하게 통과하지 않고 RED 가 난다.

## B. 뮤턴트 — 예측을 먼저 적는다

| 뮤턴트 | 편집 | 예측: 현 스위트 | 예측: 새 테스트 | 실측 |
| --- | --- | --- | --- | --- |
| M-a | 대상 null 검사를 admin 판정 **뒤로**, self 비교는 `member?.userId` | 생존(GREEN) | (a) 만 RED | **139 중 (a) 1건만 RED** — Received `code` 가 `"ADMIN_REQUIRED"`(기대 `"MEMBER_NOT_FOUND"`) |
| M-b | admin 판정을 `await this.assertAdmin(workspaceId, requesterId)` 로 | 생존(GREEN) | (b) 만 RED | **139 중 (b) 1건만 RED** — Received length **2**(기대 1) |
| M-b2 | 첫 조회 앞에 `await this.assertMembership(workspaceId, requesterId)` 추가 | 생존(GREEN) | (b) 만 RED | **139 중 (b) 1건만 RED** — Received length **2**(기대 1) |

**측정 방법**: 커밋(`a0a9b3e0c`) 뒤, 서비스 파일을 `cp` 로 백업하고 치환 스크립트로 뮤턴트를
대입했다. 치환 앵커는 **정확히 1회** 매칭을 assert 한다 — 치환이 빗나간 무효 뮤턴트가 조용히
원본을 돌리는 일을 막는다. 러너는 `src/modules/workspaces/` 전체(6 스위트 · 139 테스트)다.
ts-jest 가 타입체크를 하므로 뮤턴트가 컴파일에 실패했다면 스위트 전체가 «failed to run» 으로
떨어졌을 것이다. 세 번 모두 **나머지 138건이 실행·통과**했으므로 RED 는 단언에서 온 것이다.
원복도 `cp` 로 했고, 원복 뒤 `git status` 가 비어 있음과 139 passed 를 확인했다.

«현 스위트 생존» 예측은 **새 두 테스트를 뺀 137건이 셋 다 초록**이었다는 뜻이다 — 두 칸이
실제로 비어 있었다는 트래커 서술이 실측으로 맞았다.

## C. 체크리스트

- [x] `/consistency-check --impl-prep` — **구현 전에** → `review/consistency/2026/09/24/22_01_45`
      **BLOCK: NO · Critical 0 · Warning 0 · INFO 2**(둘 다 조치 불요).
      `spec/data-flow/` 전체로 준비하면 대상 본문이 5/5 프롬프트에서 예산으로 빠져(본문 문장
      grep 0/5) 그 파일 하나만 담은 scratch 사본으로 돌렸다 — 본문 5/5 적재 확인. `meta.json` 은
      저장소 상대경로로 정정하고 `scope_note` 로 사실을 남겼다(선례 `21_04_26`)
- [x] 테스트 (a) 대상 부재 + 비-admin → `MEMBER_NOT_FOUND`
- [x] 테스트 (b) 요청자 조회 정확히 1회 — 둘 다 이름으로 실행 확인(`-t` 2 passed)
- [x] 뮤턴트 M-a · M-b · M-b2 실측 (표 §B 채우기) — 셋 다 예측과 일치
- [x] CHANGELOG 항목 (커밋 전 staged 확인)
- [ ] TEST WORKFLOW — lint · unit · build · e2e
- [ ] `/ai-review`
- [ ] `/consistency-check --impl-done` (spec-linked — §A 실측)
- [ ] 트래커 항목 닫기
