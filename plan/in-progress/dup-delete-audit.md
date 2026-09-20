---
title: 동시 중복 DELETE 가 감사 행을 두 번 남긴다 — 잠금 뒤 부모 부재를 호출자에게 돌려준다
status: in-progress
owner: developer
worktree: dup-delete-audit-8b2e41
started: 2026-09-20
spec_impact: none
---

# 워크플로 삭제 두 요청이 겹치면 `workflow.deleted` 가 두 번 남는다

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 developer 항목
«동시 중복 DELETE 가 감사 행을 두 번 남길 수 있다» (2026-09-17 등재 · `/ai-review`
`review/code/2026/09/17/18_45_09` INFO 19·21)를 닫는다.

## A. 결함 — 잠금은 잡는데, 잠근 행이 **있는지**는 버린다

`WorkflowsService.remove()` 의 순서:

1. `findById(id, workspaceId)` — **잠금 없음**. 동시 두 요청이 모두 통과한다.
2. `releaseExternalForParent({ workflowId })` — 외부 자원 해제(트랜잭션 밖, 되돌릴 수 없다).
3. 트랜잭션: `lockParentAndListTriggerIds(manager, { workflowId })` → `manager.remove(workflow)`.
4. `recordAudit(WORKFLOW_DELETED)`.

3의 헬퍼는 부모 행을 `pessimistic_write` 로 잠그지만 **`findOne` 의 결과를 버린다**:

```ts
await manager.findOne(Workflow, { select: { id: true }, where: { id: parent.workflowId },
                                  lock: { mode: 'pessimistic_write' } });   // ← 반환값 미사용
```

그래서 먼저 커밋한 요청이 행을 지운 뒤에도 두 번째 요청은 «잠글 행이 없다» 를 알지 못한 채 진행한다.
`manager.remove(workflow)` 는 이미 없는 PK 를 지우려 해 **0행이지만 던지지 않으므로**, 두 번째 요청도
200 과 함께 `workflow.deleted` 감사 행을 한 번 더 남긴다. **데이터 손상은 없다** — 감사 기록이 사실과
어긋날 뿐이다(같은 워크플로가 두 번 삭제된 것처럼 읽힌다).

## B. 처방 — 헬퍼가 «부모가 있었는가» 를 돌려주고, 워크플로 호출자가 404 로 끝낸다

이미 잠그며 읽고 있으니 **추가 조회가 없다** — 버리던 결과를 돌려주기만 한다.

반환은 이름 있는 상태로 한다. `string[] | null` 은 «부모 부재» 와 «트리거 0개» 가 호출부에서 섞이기
쉽다(이 저장소가 반복해 밟은 형태 — truthiness 로 판정하지 말 것):

```ts
{ parentPresence: 'present' | 'absent'; triggerIds: string[] }
```

> 필드 이름은 리뷰 1라운드(`review/code/2026/09/20/20_06_26` WARNING 2)에서 `parent` → `parentPresence` 로 바꿨다 —
> 같은 함수의 파라미터 이름이 `parent` 라 한 자리에서 두 의미로 읽혔다. **위 스니펫도 그 이름으로 적는다**:
> 다음 사람이 이 문서를 트래커로 옮겨 적을 때 옛 이름이 두 번째 문서로 퍼지지 않게(2라운드 WARNING 2).

- **워크플로 삭제**: `absent` 면 `NotFoundException({ code: 'RESOURCE_NOT_FOUND' })` 를 던진다 — 트랜잭션이
  롤백되고 감사도 남지 않는다. 두 번째 요청은 404 를 받는다(이미 없는 것을 지울 수 없다).
- **워크스페이스 삭제**: ~~그 경로는 잠금 뒤 `assertWorkspaceDeletable(... pessimistic_write)` 로 **이미
  재검사**한다 — 행이 사라졌으면 거기서 거부된다. 그래도 헬퍼의 계약이 바뀌므로 호출부를 새 반환 형태에
  맞춘다(동작 변화 없음).~~ **정정 (`/ai-review` `review/code/2026/09/20/20_06_26` WARNING#1 이 반증)**:
  틀렸다 — `assertWorkspaceDeletable` 의 판정 순서는 «멤버십(권한) → 존재» 다. 동시 삭제의 진 쪽은
  CASCADE 로 멤버 행까지 사라진 뒤라 재검사가 «존재» 를 보기 전에 «멤버십 없음» 으로 먼저 걸려 403
  `OWNER_REQUIRED` 를 받고, 바깥 `.catch` 는 그것을 «수동 정리가 필요하다» 는 거짓 ERROR 로 남긴다 —
  워크플로 경로에서 없앤 것과 같은 패턴이 여기는 남아 있었다. 워크플로와 대칭으로
  `locked.parentPresence === 'absent'` 를 재검사보다 먼저 검사해 404(`WORKSPACE_NOT_FOUND`)로
  단락하고, `.catch` 에서도 `NotFoundException` 을 거짓 로그 없이 재던지도록 고쳤다(동작 변화 없다는
  전제는 유지되지 않았다 — 403→404 로 응답이 바뀐다, 의도된 변경).

### `--impl-prep` 이 요구한 것 (`review/consistency/2026/09/20/19_30_57`, BLOCK: NO · Warning 2)

- **(W2) 같은 헬퍼를 겨냥한 열린 설계 항목과 교차 참조한다.** 트래커의 «`trigger-config` advisory lock 이 남긴
  developer 범위 후속» 1번(«네 자리의 «트랜잭션 → 실패 로그 → 재던짐» 공용 형태»)이 바로 이 헬퍼를 포함한다.
  그 설계가 착수될 때 **이 PR 이 바꾼 반환 계약(`{ parent, triggerIds }`)을 전제로** 해야 하므로, 트래커의 그 칸에
  한 줄 남긴다(같은 문서 안 갱신이라 spec 변경이 아니다).
- **(W1) `2-trigger-list.md` §3 의 `details.field='endpoint_path'`** 는 같은 문서가 wire 를 `endpointPath` 로 쓰는 것과
  어긋난다 — **spec 이라 developer 권한 밖**이다. 트래커에 planner 항목으로 등재한다. 이 PR 의 코드와는 무관하다.

### 선례 — 트리거는 이미 «두 번째 요청은 404» 다

`2-trigger-list.md` §4.4 가 트리거 동시 삭제에서 두 번째 요청을 404 로 정한다(`--impl-prep` cross-spec INFO 3 이
그 대칭을 확인했다). 이 PR 은 **워크플로 삭제를 그 선례에 맞추는 것**이지 새 정책을 만드는 것이 아니다 —
`spec_impact: none` 인 이유다.

### 이 PR 이 하지 않는 것

- **2의 외부 해제 중복은 그대로 둔다.** 두 요청 모두 3 이전에 외부 해제를 부르므로 teardown 이 두 번 돈다 —
  그 경로는 이미 멱등을 전제로 쓰여 있고(해제 대상이 없으면 no-op), 고치려면 외부 해제를 잠금 뒤로 옮겨야
  하는데 그러면 schedule 행이 CASCADE 로 사라져 job id 를 못 찾는다(헬퍼 JSDoc 이 적어 둔 «남는 창»).
  **이 항목의 표적은 감사 중복이다.**
- `findById` 를 잠금 조회로 바꾸지 않는다 — 트랜잭션 밖 조회라 잠글 수 없고, 잠금은 이미 3 에 있다.

## 체크리스트

- [x] `/consistency-check --impl-prep spec/2-navigation` — `review/consistency/2026/09/20/19_30_57` **BLOCK: NO**
  (Critical 0 · Warning 2 — 위 §«`--impl-prep` 이 요구한 것» 에 반영)
- [x] 테스트 선작성 — 단위 RED 확인 후 구현. 뮤턴트 둘(404 분기 제거 · 헬퍼가 부재를 무시)이 **각각 한
  테스트만** 죽였다. 헬퍼 쪽은 «부재+0행» 과 «존재+0행» 두 fixture 로 두 사실을 갈랐다
- [x] 구현
- [x] TEST WORKFLOW — lint PASS · unit PASS · build PASS · **e2e 368 PASS**.
  **판별력 실측**: `origin/main` 의 네 파일로 되돌려 e2e 이미지를 재빌드하니 두 DELETE 가 **둘 다 204** 로
  RED 였고, 그 상태의 DB 를 직접 조회해 **`workflow.deleted` 감사 행 2건**(`resource_id` 하나에 `count=2`)을
  확인했다 — 트래커가 «남을 수 있다» 고 적은 것을 값으로 본 것이다. 고친 코드로는 `[204, 404]` · 감사 1건.
  - 두 가지가 더 드러났다: (1) **단위는 GREEN 인데 `build` 가 타입 오류를 잡았다**(`LockedParentTriggers`
    import 누락) — jest 경로가 타입을 강제하지 않는다. (2) 뮤턴트 원복에 `git checkout --` 을 써서 커밋 뒤에
    넣은 그 import 를 **다시 날렸다**(build 가 또 잡았다). 이 저장소가 이미 기록한 형태다 — 원복은 `cp` 로.
- [ ] `/ai-review` → Critical/Warning 0
- [ ] `/consistency-check --impl-done spec/2-navigation` → BLOCK: NO
- [ ] 트래커 항목 해소 + 이 plan `plan/complete/` 로
