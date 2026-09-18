---
title: 트리거 삭제 자원 정리를 spec 에 현재형으로 — 구현(#1346) 머지 뒤 거짓이 된 문장 정리
status: in-progress
owner: project-planner
worktree: spec-deletion-current-1fc723
started: 2026-09-18
spec_impact:
  - spec/2-navigation/2-trigger-list.md
  - spec/2-navigation/1-workflow-list.md
  - spec/data-flow/10-triggers.md
  - spec/data-flow/11-workflow.md
  - spec/data-flow/12-workspace.md
  - spec/conventions/secret-store.md
  - spec/5-system/15-chat-channel.md
---

# spec draft — 트리거 삭제 자원 정리, 구현 뒤 현재형으로

트래커 planner 항목 «트리거 삭제 자원 정리 구현이 머지된 뒤 spec 을 현재형으로»(2026-09-17 등재)를 닫는다.
#1345 는 구현 **전에** 계약을 세우며 «미구현 (Planned)» 태그와 과도기 문구를 달았고, 구현 #1346 이 머지돼
그 문장들이 **지금 거짓**이다. 계약 자체는 바꾸지 않는다 — 구현이 추가로 굳힌 동작(부모 잠금 상한 · 권한
선검사 · job 해제 부분 실패 복구 · 새 잔여 창 하나)을 서술에 더할 뿐이다.

## 실측 — 머지된 코드(`a9288bf6e`)와 대조

| 트래커 행 | 현재 spec 문면 | 코드 |
|---|---|---|
| 1 | `2-trigger-list.md §4.3` 표 다음 문단: *"(2026-09-17 결정, 구현은 frontmatter `pending_plans` 에서 추적 — 그 전까지는 트리거 화면 삭제만 …, 비밀을 행 삭제 **전에** 지운다)"* | 네 경로 모두 정리한다. 트리거 삭제는 비밀을 커밋 뒤에 지운다(`TriggersService.remove` → `releaseSecretsAfterCommit`) |
| 1(잔여) | 같은 문단의 남는 창 목록: 외부 해제용 열거 뒤 생긴 트리거 · 해제 뒤 재등록 · 커밋과 정리 사이 종료 | 워크스페이스 삭제는 **트랜잭션 밖 권한 선검사 → 외부 해제 → 잠금 재검사** 순이라, 그 사이 역할이 바뀌면 재검사가 거부해 워크스페이스는 남는데 외부 해제는 이미 끝났다 — 목록에 없는 창이다. 코드는 트랜잭션 실패 시 error 로그로 드러낸다 |
| — | §4.3 은 외부 해제 **실패** 시 동작을 말하지 않는다 | schedule job 해제 실패는 삭제를 멈춘다(스케줄 삭제 `removeJob` · releaser 둘 다 던진다). releaser 는 job 을 전부 시도하고, 하나라도 실패하면 이미 해제한 **활성** job 을 다시 등록한 뒤 던진다(`removeScheduleJobsOrRestore`). provider teardown 은 best-effort(binder 가 삼킨다) |
| 2 | `§4.4` «락 대기 상한 5초» 는 트리거·스케줄 화면 삭제만 말한다 | `lockParentAndListTriggerIds` 가 부모 삭제 트랜잭션의 **첫 호출**로 `SET LOCAL lock_timeout = 5000ms` 를 건다 — 부모 행 · 멤버십 · CASCADE 되는 트리거 행 잠금 모두에 걸린다 |
| 3 | «미구현 (Planned)» 6자리: `10-triggers.md §1.4` 두 행 · `11-workflow.md §2.1`·`§3.1` 각 한 행 · `12-workspace.md §1.10`·`§2.1` 각 한 행 | 전부 구현됨. 단 `12-workspace §1.10` 행은 순서가 코드와 다르다 — 문면은 *"멤버십·워크스페이스 row 를 잠근 뒤"* 인데 코드는 **워크스페이스 → 멤버십**(소유권 이전과 같은 순서, 교착 방지)이고 권한 선검사가 트랜잭션 밖에 먼저 있다 |
| 4 | `secret-store.md` frontmatter `status: partial` + `pending_plans`(트래커) | 이 문서가 약속한 표면(§2 `deleteByPrefix` 선언 · §2.1 두 행 · §5.3 순서 · §6)은 전부 구현됨. `partial` 로 내린 것은 #1345 이고 그 사유뿐이었다 |
| 4' | `1-workflow-list.md` `pending_plans` 에 트래커(#1345 가 삭제 행 때문에 추가) | 삭제 행의 정리는 구현됨 — 나머지 두 plan 항목(마켓플레이스 · 복제)은 그대로 |
| 5 | `15-chat-channel.md` 리스너 라이프사이클: *"`teardownChannel()` (또는 `TriggersService.remove`) 시 해당 `triggerId` 의 entry 를 반드시 unregister"* | `unregister` 호출부는 저장소 전체에 **`TriggerResourceReleaserService` 한 곳**(grep) — 트리거·워크플로·워크스페이스 삭제가 지난다. 스케줄 삭제는 부르지 않는다(스케줄 트리거는 chat channel 을 못 가져 등록되지 않는다) |
| 7 | `2-trigger-list.md` `code:` 에 정리 시행 파일이 없다 | `triggers/trigger-resource-release.ts`(순서·실패 정책) · `triggers/trigger-resource-releaser.service.ts`(배선) · 증거 e2e `test/trigger-deletion-releases-resources.e2e-spec.ts` |

## 변경안

### C1. `spec/2-navigation/2-trigger-list.md §4.3` 표 다음 문단

첫 문장의 괄호를 *"(2026-09-17 결정, 구현은 frontmatter `pending_plans` 에서 추적 — 그 전까지는 …)"* →
*"(2026-09-17 결정)"* 로 줄인다.

외부/비밀 표 **다음** 문단(부모 잠금 뒤 열거 · 남는 창)을 다음으로 바꾼다(§4.3 註는 인용 블록이라 줄마다 `> `):

> 워크플로·워크스페이스 삭제는 비밀을 지울 트리거를 **부모 행을 잠근 뒤 같은 트랜잭션에서** 열거한다 —
> 잠금 뒤엔 그 부모를 참조하는 트리거 INSERT 가 FK 검사에서 막혀 열거에서 빠지는 트리거가 없다.
> 외부 해제가 **실패**하면: provider teardown 은 best-effort 라 삭제를 계속하고, schedule job 해제가
> 실패하면 **삭제를 멈춘다**. 여러 job 을 해제하는 부모 삭제는 전부 시도한 뒤, 이미 해제한 활성 job 을
> 다시 등록하고 멈춘다 — 스케줄은 활성인데 발화하지 않는 상태를 남기지 않으려고.
> 남는 창은 외부 자원 쪽이다: 외부 해제용 열거 뒤에 생긴 트리거, 해제 뒤·행 삭제 전에 동시 요청이 다시 만든
> provider 등록·schedule job, 그리고 워크스페이스 삭제의 권한 선검사와 잠금 재검사 사이에 역할이 바뀌어
> 재검사가 거부한 경우(워크스페이스는 남지만 외부 해제는 이미 끝났다 — 서버 error 로그로 드러난다).
> 행 삭제 커밋과 비밀 정리 사이에 프로세스가 죽으면 비밀이 남는다.

### C2. `spec/2-navigation/2-trigger-list.md §4.4` «락 대기 상한 5초» 불릿 끝에 덧붙임

`워크플로·워크스페이스 삭제도 외부 해제를 먼저 끝내므로 그 트랜잭션의 **모든** 락 대기(부모 행 · 멤버십 · CASCADE 되는 트리거 행)에 같은 5초 상한을 건다 — 넘기면 오류로 끝내고 «외부 해제는 이미 끝났다» 를 서버 로그에 남긴다.`

### C3. `spec/2-navigation/2-trigger-list.md` frontmatter `code:` — `trigger-config-lock.ts` 항목 뒤에 추가

```yaml
  # 시행 코드 — §4.3 «트리거 행을 없애는 모든 경로» 의 순서·실패 정책(순수 함수)과 그 배선.
  # 네 삭제 경로와 쓰기 보상이 모두 이 둘을 지난다.
  - codebase/backend/src/modules/triggers/trigger-resource-release.ts
  - codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts
```

증거 e2e 는 기존 e2e 항목들 뒤에:

```yaml
  # §4.3 을 고정하는 e2e — 네 경로의 비밀·schedule job 정리(이웃 트리거 대조군 포함)와, 실제 Postgres 에서
  # «행 삭제 → 정리 → 늦은 쓰기 → 0행 → 보상» 순서를 재진입으로 고정한 보상 합성.
  - codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts
```

### C4. `spec/data-flow/10-triggers.md §1.4`

- «Schedule 삭제» 행 Trigger 칸: *"행 삭제 커밋 **뒤** 그 트리거의 `secret_store` 비밀 정리 — **미구현 (Planned)** ([…])"* → 태그 제거.
- «Workflow·Workspace 삭제 (FK CASCADE) — **미구현 (Planned)**» 이벤트 칸 → 태그 제거.

### C5. `spec/data-flow/11-workflow.md`

- §2.1 `workflow` 삭제 행: *"**트리거 자원 정리 — 미구현 (Planned)**: 같은 트랜잭션에서 …"* → *"**트리거 자원 정리**: 외부 자원을 트랜잭션 **전에** 해제하고, 삭제 트랜잭션의 첫 호출로 잠금 대기 상한(5초)을 건 뒤 `workflow` 행을 먼저 잠그고(`pessimistic_write`) 그 워크플로의 트리거 id 를 열거한 다음 삭제, 커밋 **뒤** 그 트리거들의 `secret_store` 비밀을 지운다([트리거 목록 §4.3](../2-navigation/2-trigger-list.md#43-cascade-동작))"* — 외부 해제 문장을 앞으로 옮겨 실행 순서대로 읽히게 한다.
- §3.1 `trigger` 행 끝: *"… 정리는 이 CASCADE 앞뒤로 앱이 한다 — **미구현 (Planned)**, [트리거 목록 §4.3](…)."* → *"… 정리는 이 CASCADE 앞뒤로 앱이 한다 — [트리거 목록 §4.3](…)."*

### C6. `spec/data-flow/12-workspace.md`

§1.10 `DELETE /api/workspaces/:id` 행 동작 칸을 **실행 순서대로** 다시 쓴다:

`team 전용(personal 은 \`403 CANNOT_DELETE_PERSONAL\`). **권한 검사(owner · team)를 트랜잭션 밖에서 먼저** 한다 — 거부될 요청이 트리거 외부 자원부터 뜯지 않게. 이어 워크스페이스 트리거의 외부 자원(schedule job · chat channel teardown · listener registry)을 해제하고([트리거 목록 §4.3](../2-navigation/2-trigger-list.md#43-cascade-동작)), 단일 트랜잭션에서 잠금 대기 상한(5초)을 건 뒤 워크스페이스 row 를 비관적 락(\`pessimistic_write\`)으로 잠가 트리거를 열거하고, 워크스페이스 → 멤버십 순으로 잠근 채 권한을 **다시** 검사한 다음, FK 관계가 선언되지 않은 \`workspace_invitation\` 을 **명시 DELETE** → \`workspace_member\` DELETE → \`workspace\` 삭제(트리거는 FK CASCADE, \`deleteWorkspace\`). 커밋 **뒤** 열거한 트리거들의 \`secret_store\` 비밀을 지운다. 트랜잭션이 실패하면(재검사 거부 포함) 외부 해제가 이미 끝났다는 사실을 서버 로그에 남긴다. 잠금 순서(워크스페이스 → 멤버십)는 소유권 이전과 같다 — 둘이 겹칠 때 교착하지 않게.`

§2.1 `secret_store` 행: *"워크스페이스 삭제 (§1.10) — **미구현 (Planned)**"* → *"워크스페이스 삭제 (§1.10)"*.

### C7. `spec/conventions/secret-store.md` frontmatter

```yaml
status: implemented
code:
  - codebase/backend/src/modules/secret-store/**
```

(`pending_plans` 블록 삭제 — #1345 가 이 문서를 `partial` 로 내린 사유가 트리거 정리 하나였고 구현됐다.)

### C8. `spec/2-navigation/1-workflow-list.md` frontmatter

`pending_plans` 에서 `plan/in-progress/spec-draft-nullable-notation-followups.md` 한 줄만 뺀다(#1345 가 삭제 행 때문에
더한 것). `status: partial` 은 남은 두 항목 때문에 그대로.

### C9. `spec/5-system/15-chat-channel.md` 리스너 라이프사이클 정책

*"`teardownChannel()` (또는 `TriggersService.remove`) 시 해당 `triggerId` 의 entry 를 반드시 unregister"* →
*"`teardownChannel()` 시 — 그리고 트리거 행을 없애는 경로(트리거 · 워크플로 · 워크스페이스 삭제 — 행 삭제 **전**
외부 해제 단계, [트리거 목록 §4.3](../2-navigation/2-trigger-list.md#43-cascade-동작)) — 해당 `triggerId` 의 entry 를
반드시 unregister"*. 스케줄 삭제는 대상이 아니다(스케줄 트리거는 chat channel 을 갖지 못해 등록되지 않는다).

## 비대상 — 트래커 6행을 하지 않는 이유

| 자리 | 판정 |
|---|---|
| 트래커 6행 `spec/5-system/4-execution-engine.md §4.4` 순환 기법 표에 «던지는» `ModuleRef` 사례 추가 | **하지 않는다.** 그 표는 §4.4(이벤트 발행 sink) 안에서 *"엔진의 DI 순환은 … 두 가지 표준 기법으로 해결한다"* 로 열리고, 사례 넷이 전부 실행 엔진·이벤트 발행·알림 서비스다. 트리거 정리의 지연 해석은 워크플로·워크스페이스 서비스의 것이고 이유(모듈 import 순환 회피)도 적용 기준(인스턴스화 순서 함정)과 다르다 — 넣으면 엔진 표가 저장소 전체 규약처럼 읽힌다. «못 찾으면 던진다» 는 구현 JSDoc(`trigger-resource-release.ts` 토큰 · `resolveTriggerResourceReleaser`)이 SoT 로 이미 말한다 |
| `spec/2-navigation/3-schedule.md` 삭제 서술 | #1345 처분 유지 — 틀린 문장이 없다 |
| `2-trigger-list.md` `pending_plans` | 트래커의 다른 미해결 항목(성능 인덱스 등)이 이 문서 영역에 남아 유지 |

## 트래커 반영 (같은 PR)

planner 항목 «트리거 삭제 자원 정리 구현이 머지된 뒤 spec 을 현재형으로» 를 종결 표시하고, 6행은 위 비대상 사유로
처분을 적는다.

## Rationale

### 계약은 그대로, 서술만 현재형으로

#1345 의 결정(D1~D7)은 하나도 바꾸지 않는다. 구현이 **더한** 것 — 부모 삭제의 잠금 상한, 권한 선검사, schedule
job 해제 부분 실패 복구 — 은 리뷰에서 나온 결함 수정이고 계약의 방향과 같다. spec 이 그것을 말하지 않으면 다음
사람이 «§4.4 의 5초는 트리거·스케줄 화면만» 으로 읽고 부모 삭제 경로를 상한 없이 바꿀 수 있다.

### 권한 선검사 창을 잔여 목록에 넣는 이유

#1345 의 남는 창 목록은 «외부 해제 뒤 행 삭제 전» 을 트리거 생성·재등록 경합으로만 봤다. 구현이 권한 검사를
외부 해제 **앞**으로 당기면서 «선검사 통과 → 해제 → 잠금 재검사 거부» 라는 창이 새로 생겼다. 워크스페이스가 남는
데 트리거가 발화하지 않는 결과라 사용자에게 보이는 쪽이고, 코드가 error 로그로 드러내는 것까지 적어야 운영자가
그 로그를 이 계약과 연결한다.
