---
title: 트리거 삭제 자원 정리를 spec 에 현재형으로 — 구현(#1346) 머지 뒤 거짓이 된 문장 정리
status: complete
owner: project-planner
worktree: spec-deletion-current-1fc723
started: 2026-09-18
completed: 2026-09-18
spec_impact:
  - spec/2-navigation/2-trigger-list.md
  - spec/2-navigation/1-workflow-list.md
  - spec/data-flow/10-triggers.md
  - spec/data-flow/11-workflow.md
  - spec/data-flow/12-workspace.md
  - spec/conventions/secret-store.md
  - spec/5-system/15-chat-channel.md
  - spec/conventions/spec-impl-evidence.md
---

# spec draft — 트리거 삭제 자원 정리, 구현 뒤 현재형으로

트래커 planner 항목 «트리거 삭제 자원 정리 구현이 머지된 뒤 spec 을 현재형으로»(2026-09-17 등재)를 닫는다.
#1345 는 구현 **전에** 계약을 세우며 «미구현 (Planned)» 태그와 과도기 문구를 달았고, 구현 #1346 이 머지돼
그 문장들이 **지금 거짓**이다. 삭제 자원 정리 계약 자체는 바꾸지 않는다 — 구현이 추가로 굳힌 동작(부모 잠금
상한 · 권한 선검사 · job 해제 부분 실패 복구 · 새 잔여 창 하나)을 서술에 더할 뿐이다.

**규칙을 새로 더하는 곳은 하나다** — C10(`spec-impl-evidence.md §3.1`, 공유 트래커를 가리키는 `partial` 의 승격
시점). `--spec` 1회차가 C7(`secret-store.md` 승격)의 근거를 물었고, 그 판정이 이 트래커를 `pending_plans` 로
가리키는 다른 문서에도 반복되므로 규약으로 올렸다.

## 실측 — 머지된 코드(`a9288bf6e`)와 대조

| 트래커 행 | 현재 spec 문면 | 코드 |
|---|---|---|
| 1 | `2-trigger-list.md §4.3` 표 다음 문단: *"(2026-09-17 결정, 구현은 frontmatter `pending_plans` 에서 추적 — 그 전까지는 트리거 화면 삭제만 …, 비밀을 행 삭제 **전에** 지운다)"* | 네 경로 모두 정리한다. 트리거 삭제는 비밀을 커밋 뒤에 지운다(`TriggersService.remove` → `releaseSecretsAfterCommit`) |
| 1(잔여) | 같은 문단의 남는 창 목록: 외부 해제용 열거 뒤 생긴 트리거 · 해제 뒤 재등록 · 커밋과 정리 사이 종료 | 워크스페이스 삭제는 **트랜잭션 밖 권한 선검사 → 외부 해제 → 잠금 재검사** 순이라, 그 사이 역할이 바뀌면 재검사가 거부해 워크스페이스는 남는데 외부 해제는 이미 끝났다 — 목록에 없는 창이다. 코드는 트랜잭션 실패 시 error 로그로 드러낸다 |
| — | §4.3 은 외부 해제 **실패** 시 동작을 말하지 않는다 | schedule job 해제 실패는 삭제를 멈춘다(스케줄 삭제 `removeJob` · releaser 둘 다 던진다). releaser 는 job 을 전부 시도하고, 하나라도 실패하면 이미 해제한 **활성** job 을 다시 등록한 뒤 던진다(`removeScheduleJobsOrRestore`). provider teardown 은 best-effort(binder 가 삼킨다) |
| 2 | `§4.4` «락 대기 상한 5초» 는 트리거·스케줄 화면 삭제만 말한다 | `lockParentAndListTriggerIds` 가 부모 삭제 트랜잭션의 **첫 호출**로 `SET LOCAL lock_timeout = 5000ms` 를 건다 — 부모 행 · 멤버십 · CASCADE 되는 트리거 행 잠금 모두에 걸린다 |
| 3 | «미구현 (Planned)» 6자리: `10-triggers.md §1.4` 두 행 · `11-workflow.md §2.1`·`§3.1` 각 한 행 · `12-workspace.md §1.10`·`§2.1` 각 한 행 | 전부 구현됨. 단 `12-workspace §1.10` 행은 순서가 코드와 다르다 — 문면은 *"멤버십·워크스페이스 row 를 잠근 뒤"* 인데 코드는 **워크스페이스 → 멤버십**(소유권 이전과 같은 순서, 교착 방지)이고 권한 선검사가 트랜잭션 밖에 먼저 있다 |
| 4 | `secret-store.md` frontmatter `status: partial` + `pending_plans`(트래커) | 이 문서가 약속한 표면(§2 `deleteByPrefix` 선언 · §2.1 두 행 · §5.3 순서 · §6)은 전부 구현됨. `partial` 로 내린 것은 #1345 이고 그 사유뿐이었다(#1345 직전 `aaee17206^` 의 이 파일은 `status: implemented`, `pending_plans` 없음) |
| 4(감사) | 트래커가 `secret-store.md` 를 지목하는 **열린** 항목 — 트래커 항목 전수(`- [ ]`/`- [x]` 로 시작하는 블록) 중 본문에 `secret-store.md` 가 든 17개, 그중 열린 6개 | **미구현 surface 0.** 열린 6개: ① 열린 `config` 맵 비밀의 e2e 동반을 **규칙 문장으로 새로 적자**는 제안(2026-09-05, 착지점 `secret-store.md §1.1` 또는 `2-api-convention.md §5.4` 미정) · ② 비밀-부재 헬퍼를 `code:` 에 등재할지 **질문** · ③ repo-guard 를 `code:` 에 등재할지 **질문** · ④ DTO 검증자 스윕(`secret-store.md §1.1` 을 제약으로 **인용**만) · ⑤ `--spec` 번들 절단(harness) · ⑥ 이 항목. 문서가 이미 약속한 동작의 구현이 남은 항목은 없다(①이 요구하는 문장은 문서에 아직 없다 — `secret-store.md` 안 `toHaveProperty` 0건). ①~④는 이 문서가 `implemented` 이던 기간(09-05~09-17)에도 열려 있었다 |
| 4' | `1-workflow-list.md` `pending_plans` 에 트래커(#1345 가 삭제 행 때문에 추가) | 삭제 행의 정리는 구현됨 — 나머지 두 plan 항목(마켓플레이스 · 복제)은 그대로 |
| 5 | `15-chat-channel.md` 리스너 라이프사이클: *"`teardownChannel()` (또는 `TriggersService.remove`) 시 해당 `triggerId` 의 entry 를 반드시 unregister"* | `unregister` 호출부는 저장소 전체에 **`TriggerResourceReleaserService` 한 곳**(grep) — 트리거·워크플로·워크스페이스 삭제가 지난다. 스케줄 삭제는 부르지 않는다(스케줄 트리거는 chat channel 을 못 가져 등록되지 않는다) |
| 7 | `2-trigger-list.md` `code:` 에 정리 시행 파일이 없다 | `triggers/trigger-resource-release.ts`(순서·실패 정책) · `triggers/trigger-resource-releaser.service.ts`(배선) · 증거 e2e `test/trigger-deletion-releases-resources.e2e-spec.ts`. 그 e2e 의 케이스는 비밀 정리 **네 경로**(대조군 포함) · schedule job 해제 **워크플로·워크스페이스 삭제 둘** · 권한 없는 워크스페이스 삭제(403)는 아무것도 정리하지 않음 · 보상 합성 1 — 트리거·스케줄 삭제의 job 해제는 이 파일이 보지 않는다 |
| 7' | 같은 `code:` 목록을 겨냥한 미해결 트래커 항목(2026-09-14 등재, «`2-trigger-list.md` 의 `code:` 가 §3 계약의 시행 파일 하나를 놓친다») | `test/schedule-trigger.e2e-spec.ts` 헤더가 *"`TriggerDto.workflow` 양성 — 목록(C-2)·PATCH(G·H) 세 자리"* 를 스스로 밝힌다 — 같은 필드를 여는 이 PR 에 묶는다 |
| — | `1-workflow-list.md §2.6` 삭제 행 | 이미 현재형이고 코드와 맞다(*"트리거가 쓰던 외부 등록과 비밀도 정리한다"*) — 고치지 않는다 |

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
  # 시행 코드 — §4.3 «트리거 행을 없애는 모든 경로» 의 순서·실패 정책(순수 함수 — 네 삭제 경로와
  # 쓰기 보상이 모두 지난다)과 그 배선(서비스 — 스케줄 삭제는 모듈 순환 때문에 거치지 않고 순수 함수를 직접 부른다).
  - codebase/backend/src/modules/triggers/trigger-resource-release.ts
  - codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts
```

증거 e2e 는 기존 e2e 항목들 뒤에:

```yaml
  # §4.3 을 고정하는 e2e — 네 경로의 비밀 정리(이웃 트리거 대조군 포함) · 워크플로·워크스페이스 삭제의
  # schedule job 해제 · 권한 없는 워크스페이스 삭제는 아무것도 정리하지 않음, 그리고 실제 Postgres 에서
  # «행 삭제 → 정리 → 늦은 쓰기 → 0행 → 보상» 순서를 재진입으로 고정한 보상 합성.
  - codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts
```

`trigger-workflow-ref.e2e-spec.ts` 항목 뒤에(실측 7' 해소):

```yaml
  # §3 `TriggerDto.workflow` 계약을 **schedule 타입**에 대해 시행하는 자리 — 목록(C-2)·PATCH(G·H).
  - codebase/backend/test/schedule-trigger.e2e-spec.ts
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

(`pending_plans` 블록 삭제 — #1345 가 이 문서를 `partial` 로 내린 사유가 트리거 정리 하나였고 구현됐다.
트래커 파일은 다른 문서 몫 때문에 `in-progress/` 에 남는다 — 승격 판정은 위 실측 «4(감사)» 가 한다. 그 판정을
규약으로 세우는 것이 C10 이다.)

### C8. `spec/2-navigation/1-workflow-list.md` frontmatter

`pending_plans` 에서 `plan/in-progress/spec-draft-nullable-notation-followups.md` 한 줄만 뺀다(#1345 가 삭제 행 때문에
더한 것). `status: partial` 은 남은 두 항목 때문에 그대로.

### C9. `spec/5-system/15-chat-channel.md` 리스너 라이프사이클 정책

*"`teardownChannel()` (또는 `TriggersService.remove`) 시 해당 `triggerId` 의 entry 를 반드시 unregister"* →
*"`teardownChannel()` 시 — 그리고 트리거 행을 없애는 경로(트리거 · 워크플로 · 워크스페이스 삭제 — 행 삭제 **전**
외부 해제 단계, [트리거 목록 §4.3](../2-navigation/2-trigger-list.md#43-cascade-동작)) — 해당 `triggerId` 의 entry 를
반드시 unregister"*. 스케줄 삭제는 대상이 아니다(스케줄 트리거는 chat channel 을 갖지 못해 등록되지 않는다).

### C10. `spec/conventions/spec-impl-evidence.md` §3.1 · 새 R-11 — 공유 트래커를 가리키는 `partial` 의 승격 시점

§3.1 `partial → implemented` 불릿 **바로 아래에 2칸 들여쓴 자식 불릿** 하나(아래 인용이 들여쓰기까지 그대로다):

>   - **`pending_plans` 가 공유 트래커일 때** — 여러 문서의 항목을 함께 담는 plan 은 다른 문서 몫 때문에 오래 `in-progress/` 에 남는다. 그때 승격 시점은 트래커 파일의 이동이 아니라 **그 문서 몫의 미구현 surface 가 0 이 된 commit** 이다. 판정은 트래커에서 그 문서를 지목한 **열린 항목을 전수로 열어** 각각이 §2.1 의 «미구현 surface»(문서가 이미 약속한 동작의 구현 미완)인지, 아니면 문서 위생·`code:` 등재 질문·**아직 문서에 없는** 새 규칙 제안인지 가른다. 후자만 남으면 승격하고 `pending_plans` 에서 트래커를 뺀다. 가드는 이 방향을 보지 않으므로(«전부 `complete/` ⇒ 승격» 만 강제한다) **판정 근거를 승격 commit 에 남긴다** ([R-11](#r-11-공유-트래커를-가리키는-partial-의-승격-시점--파일-이동이-아니라-그-문서-몫의-항목))

`## Rationale` **끝(R-10 다음)** 에 새 절 — R-5 에 덧붙이지 않고 번호를 새로 연다(검색성, `--spec` 2회차 INFO 2):

> ### R-11. 공유 트래커를 가리키는 `partial` 의 승격 시점 — 파일 이동이 아니라 그 문서 몫의 항목
>
> [R-5](#r-5-status-partial-의-pending_plans-의무화--plan-라이프사이클-역방향-강제) 의 역방향 링크는 «어떤 plan 도 책임지지 않는 빈 약속» 을 막으려고 있다. 그런데 트래커 파일 하나가 여러 문서의 `pending_plans` 에 걸리면 — 이 규칙을 세운 2026-09-18 에 `spec/` 4개 문서(`1-workflow-list.md`·`2-trigger-list.md`·`secret-store.md`·`chat-channel-adapter.md`)가 같은 트래커를 가리켰다 — 파일 이동을 승격 신호로 쓰는 §3.1 규칙은 **이미 구현된 문서를 트래커가 닫힐 때까지 `partial` 로 묶어** 반대 방향의 거짓을 만든다. 그래서 신호를 파일이 아니라 그 문서 몫의 항목으로 옮기되(§3.1 하위 불릿), «빈 약속» 을 다시 만들지 않게 판정 술어를 §2.1 의 «미구현 surface» 로 고정했다.
>
> **가드가 보던 자리를 사람이 본다** — `spec-status-lifecycle.test.ts` 는 «전부 `complete/` ⇒ 승격» 만 강제하므로 이 방향의 승격은 기계가 검사하지 않는다. 그래서 판정 근거(열린 항목 전수와 각 항목의 분류)를 승격 commit 에 남기게 했다.
>
> **이해상충을 밝혀 둔다** — 이 규칙의 첫 적용 대상은 규칙을 세운 같은 변경의 [`secret-store.md`](./secret-store.md) 다(트리거 삭제 자원 정리 하나 때문에 `partial` 로 내려갔다가 그 구현이 머지된 뒤 승격). 규칙을 결론에 맞춰 만들었다는 의심을 덜려고 판정(열린 항목 6개 전수 · 미구현 surface 0)을 규칙 없이도 따라갈 수 있게 `plan/complete/spec-draft-deletion-release-current-tense.md` 에 표로 남겼다. 또 그 문서는 같은 항목들이 열린 채로 2026-09-05~09-17 에 이미 `implemented` 였다 — 규칙이 새 결론을 만든 것이 아니라 트리거 정리 이전 상태로 되돌린다.

## 비대상 — 트래커 6행을 하지 않는 이유

| 자리 | 판정 |
|---|---|
| 트래커 6행 `spec/5-system/4-execution-engine.md §4.4` 순환 기법 표에 «던지는» `ModuleRef` 사례 추가 | **하지 않는다.** 지연 해석을 고른 이유가 표의 기준과 다르다 — 표의 `ModuleRef` 행은 **DI 인스턴스화 순서 함정**(생성자 `@Optional` 주입이 `undefined` 로 굳는 경우)이고, 트리거 정리는 **모듈 import 순환**(`TriggersModule → SchedulesModule → ExecutionEngineModule → WebsocketModule → WorkflowsModule`)을 새 `forwardRef` 없이 피하려고 골랐다(`trigger-resource-release.ts` 의 `TRIGGER_RESOURCE_RELEASER` JSDoc — `#676` 이 `forwardRef` 순환을 없앤 선례). 그 표는 §4.4(이벤트 발행 sink) 안에서 *"엔진의 DI 순환은 … 두 가지 표준 기법으로 해결한다"* 로 열리고, 사례 넷이 전부 실행 엔진·이벤트 발행·알림 서비스다. 트리거 정리의 지연 해석은 워크플로·워크스페이스 서비스의 것이고 이유(모듈 import 순환 회피)도 적용 기준(인스턴스화 순서 함정)과 다르다 — 넣으면 엔진 표가 저장소 전체 규약처럼 읽힌다. «못 찾으면 던진다» 는 구현 JSDoc(`trigger-resource-release.ts` 토큰 · `resolveTriggerResourceReleaser`)이 SoT 로 이미 말한다 |
| `spec/2-navigation/3-schedule.md` 삭제 서술 | #1345 처분 유지 — 틀린 문장이 없다 |
| `2-trigger-list.md` `pending_plans` | 트래커의 다른 미해결 항목(성능 인덱스 등)이 이 문서 영역에 남아 유지 |

## 트래커 반영 (같은 PR)

planner 항목 «트리거 삭제 자원 정리 구현이 머지된 뒤 spec 을 현재형으로» 를 종결 표시하고, 6행은 위 비대상 사유로
처분을 적는다. «`2-trigger-list.md` 의 `code:` 가 §3 계약의 시행 파일 하나를 놓친다»(2026-09-14)도 C3 로 종결 표시한다.

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

### `--spec` 1회차 처분 (`review/consistency/2026/09/18/09_58_25` — BLOCK: YES)

- **CRITICAL (rationale_continuity)** — «`secret-store.md` 승격이 트래커의 미해소 항목(열린 `config` 맵 비밀 규칙)을
  감사하지 않았다». 감사가 빠진 것은 맞다(C7 이 C8 과 달리 남은 항목을 세지 않았다). 트래커 전수를 열어 판정했다
  — 실측 «4(감사)»: 열린 6개 모두 미구현 surface 가 아니고, 그중 넷은 이 문서가 `implemented` 이던 기간에도
  열려 있었다. **승격은 유지**하고, 판정 절차를 C10 으로 규약에 올렸다 — 한 번 판정하고 끝나는 문제가 아니라 같은
  트래커를 `pending_plans` 로 가리키는 문서 넷이 모두 만날 문제다(이 PR 뒤에도 `2-trigger-list.md`·`chat-channel-adapter.md` 가
  남는다 — 2회차 WARNING 1 이 넷째를 찾았다).
- **WARNING 1 (convention_compliance)** — §3.1 승격 트리거와 다르다 → C10 이 그 예외를 명문화한다. checker 가 선례로
  든 `aecf877c1` 은 «같은 PR 에서 완전 구현돼 지연 surface 가 아니므로 `pending_plans` 를 두지 않는다» 는 결정이라
  공유 트래커 승격의 선례가 아니다 — 선례로 인용하지 않는다(이 트래커를 가리키던 문서가 트래커 `in-progress` 인 채
  승격된 적은 frontmatter 변경 이력 전수로 0건, 이번이 처음).
- **WARNING 2 (plan_coherence)** — 같은 `code:` 목록의 미해결 등재 → C3 에 묶었다(실측 7').
- **INFO 5** → 실측 표에 `1-workflow-list.md §2.6` 행을 넣었다(이미 옳음). **INFO 3**(`12-workspace.md` Rationale 에
  잠금 순서 근거) → 넣지 않는다: 근거가 표 칸에 이미 한 문장으로 있고, 그 순서의 SoT 는 `assertWorkspaceDeletable`
  JSDoc(«`transferOwnership` 과 같게 둬야») 이다. **INFO 1·2·4·6·7** → 이 PR 범위 밖이거나 조치 불요(SUMMARY 제안대로).
- **스스로 찾은 것**: C3 의 증거 e2e 주석이 «네 경로의 비밀·schedule job 정리» 라 적어, job 해제를 네 경로 모두 본다고
  읽혔다 — 실제 job 해제 케이스는 부모 삭제 둘뿐이다(실측 7). 주석을 케이스대로 좁혔다.

### `--spec` 2회차 처분 (`review/consistency/2026/09/18/10_18_33` — BLOCK: YES)

- **CRITICAL (convention_compliance)** — C10 의 앵커가 `#r-5-…` 자리표시로 남았다. 적용 스크립트에는 실제 slug 가 있었는데
  draft 에 줄여 적었다 — 검토자가 보는 것은 draft 라 결함이 맞다. R-11 로 옮기면서 slug 를 **저장소 링크 가드와 같은
  라이브러리**(`mdast-util-from-markdown` + `mdast-util-to-string` + `github-slugger`, `spec-links.ts` 의 `slugify` 와 같은 조합)로
  계산했고, 같은 도구가 기존 앵커 `43-cascade-동작` 을 그대로 재현함을 대조로 확인했다. 적용 뒤 `spec-link-integrity` 가 최종 판정한다.
- **WARNING 1 (cross_spec · rationale_continuity)** — «3개 문서» 가 틀렸다, 4개다(`chat-channel-adapter.md`). 1회차에 «8개» 를 «3개» 로
  고칠 때 쓴 셈이 `pending_plans:` 바로 뒤 **연속된 `- ` 줄**만 읽어, YAML 주석 뒤 항목을 놓쳤다 — `review_guard` 의 `code:` 파서가
  2026-09-06 까지 가졌던 결함과 같은 형태다. YAML 파서(`yaml.safe_load`)로 다시 셌다.
- **WARNING 2 (rationale_continuity)** — 규칙을 세운 변경이 그 규칙의 첫 수혜자다 → R-11 에 이해상충 문단을 넣고, 규칙 없이도 판정을
  따라갈 수 있는 근거(실측 «4(감사)» 표 · 승격 전 `implemented` 이력)를 가리켰다. 커밋 분리는 하지 않는다 — 한 PR 안이라 리뷰어가
  보는 단위가 같다.
- **INFO 1**(자식 불릿 들여쓰기) → C10 지시문에 «2칸 들여쓴 자식 불릿» 명시. **INFO 2**(R 번호) → R-11 신설. **INFO 3**(비대상 근거)
  → 비대상 표에 JSDoc 근거 한 문장. **INFO 4·5** → 조치 불요.

**정지 규칙 (3회차 결과를 보기 전에 적는다)**: 3회차가 BLOCK: NO 면 적용한다. 그때 WARNING 은 반영하되, 반영이 적용 문면의 **의미**를
바꾸지 않으면(수치·표현 정정) 4회차를 돌리지 않고 이 절에 처분만 적는다. 의미를 바꾸면 4회차를 돌린다.

### `--spec` 3회차 처분 (`review/consistency/2026/09/18/10_32_27` — **BLOCK: NO**)

위 정지 규칙대로 4회차 없이 반영했다 — 둘 다 적용 문면의 의미가 아니라 표현을 좁히는 정정이다.

- **WARNING 1 (plan_coherence)** — C3 첫 `code:` 주석 «네 삭제 경로와 쓰기 보상이 모두 **이 둘**을 지난다» 가 넓었다. 순수 함수
  (`trigger-resource-release.ts`)는 넷 모두와 쓰기 보상이 지나지만(스케줄 삭제 `schedules.service.ts` 와 binder 의 보상은 순수 함수를
  직접 부른다), 배선 서비스는 스케줄 삭제가 거치지 않는다(그 서비스 JSDoc 이 스스로 «스케줄 삭제만 이 서비스를 쓰지 않는다» 고 적는다).
  1회차에 **바로 아래 e2e 주석**의 같은 과잉을 고치면서 인접 블록은 다시 보지 않았다 — 고친 자리의 이웃을 같은 질문으로 보지 않은 탓이다.
- **INFO 4** — C10 의 `>` 는 draft 안 인용 표시다. 적용 스크립트는 `  - ` 자식 불릿과 R-11 절을 인용 부호 없이 넣는다(§4.3 의 `>` 는
  원문이 인용 블록이라 유지 — C1 참조).
- **INFO 5** — 새 잔여 창(권한 선검사 → 외부 해제 → 잠금 재검사 거부)을 트래커 sweeper 항목의 창 목록에 한 줄 더한다(트래커 반영).
- **INFO 1·2·3·6** — 조치 불요(범위 밖 기존 모호성 · 이미 명문화 · 확인 완료 · 이름 계보는 본문에 명시).
