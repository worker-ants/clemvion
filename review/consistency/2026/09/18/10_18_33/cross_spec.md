# Cross-Spec 일관성 검토 — spec-draft-deletion-release-current-tense

## 방법

`--spec` 번들이 컨텍스트 예산으로 `data-flow/10-triggers.md`·`11-workflow.md`·`12-workspace.md`·
`conventions/secret-store.md`·`conventions/spec-impl-evidence.md`·`5-system/15-chat-channel.md`·
`5-system/4-execution-engine.md`(§4.4)를 스텁으로 절단했으므로, 이 9개 파일과 draft 가 실측 근거로
드는 구현 코드(`trigger-resource-release.ts`·`trigger-resource-releaser.service.ts`·
`workspaces.service.ts`·`workflows.service.ts`·`schedules.service.ts`)를 워킹트리에서 직접 Read 했다.
아울러 draft 가 명시 지목하는 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)의
관련 항목·라인 번호를 실측했다.

## 발견사항

- **[WARNING]** C10 Rationale(R-5) 의 "공유 트래커 3개 문서" 실측이 실제보다 1개 적다
  - target 위치: draft `### C10` 아래 `## Rationale R-5` 추가 문단 — *"(2026-09-18 기준 `spec/` 3개
    문서의 `pending_plans` 가 같은 트래커를 가리켰다)"*
  - 충돌 대상: `spec/2-navigation/1-workflow-list.md`·`spec/2-navigation/2-trigger-list.md`·
    `spec/conventions/secret-store.md`·**`spec/conventions/chat-channel-adapter.md`** frontmatter
    `pending_plans:`
  - 상세: `pending_plans:` 블록에서 실제 리스트 항목(주석이 아닌 `- ` 엔트리)으로
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 를 가리키는 spec 문서를 전수
    확인하면 **4개**다 — `1-workflow-list.md`·`2-trigger-list.md`·`secret-store.md` 외에
    `chat-channel-adapter.md` 도 이 트래커를 실제 리스트 엔트리로 갖고 있다(§1.1.2 fallback 제거
    판정 항목을 추적하는 용도이며, YAML 주석 3줄 뒤에 실 엔트리가 나온다 — grep `-A3` 로는
    안 잡히고 전체 블록을 봐야 드러난다). draft 서두("규칙을 새로 더하는 곳은 하나다" 문단)의
    "문서 셋" 은 **C7 적용 뒤 남는 문서 수**(workflow-list·trigger-list·chat-channel-adapter = 3)로는
    맞지만, R-5 의 "2026-09-18 기준 3개 문서" 는 시점상 **C7 적용 전** 상태를 가리키는 문장이라
    `secret-store.md` 자신을 포함해 4여야 앞뒤가 맞는다(R-5 문단 자체가 이어서 "첫 적용은
    secret-store.md" 라고 그 문서를 이 현상의 사례로 지목한다). 두 문장이 같은 숫자 "3" 을
    서로 다른 모집단(적용 전 전체 vs 적용 후 잔여)에 재사용해 읽는 사람이 어느 집합을 세었는지
    헷갈리게 한다.
  - 제안: R-5 문장을 "4개 문서(`secret-store.md` 포함)" 로 정정하거나, "이 문서를 제외한 다른 3개
    문서" 처럼 모집단을 명시한다. 새로 세우는 규약의 동기 서술이 실측 오류를 담으면 향후 이 규약을
    인용하는 판정(예: `2-trigger-list.md`·`chat-channel-adapter.md` 승격 시점)의 근거로 다시 쓰일 수
    있어 지금 정정하는 편이 싸다.

## 교차 검증 — CRITICAL 없음 (근거)

target 이 8개 spec 파일에 걸쳐 같은 사실(부모 삭제의 잠금 순서·5초 상한·권한 선검사 위치·비밀 정리
시점·`unregister` 단일화)을 반복 서술하므로, 문서 간 모순이 있다면 서로 다른 시점/순서로 적혔을
위험이 컸다. 다음을 코드와 대조해 전부 일치를 확인했다 — 어느 것도 CRITICAL/WARNING 급 모순 없음:

1. **데이터 모델 충돌 없음** — draft 는 신규 엔티티·컬럼을 정의하지 않는다. `trigger`/`workflow`/
   `workspace`/`secret_store` 스키마는 무변경.
2. **API 계약 충돌 없음** — `DELETE /api/workspaces/:id`(C6)·`DELETE /api/workflows/:id`(C5) 등
   endpoint·method·상태 코드는 draft 이전과 동일(`CANNOT_DELETE_PERSONAL` 403, owner 전용 — 확인:
   `spec/5-system/1-auth.md:359,369` "Workspace 삭제 | D" 행과 정합). 응답 shape 변경 없음.
3. **요구사항 ID 충돌 없음** — draft 는 신규 요구사항 ID(`WH-*`/`CCH-*`/`EIA-*` 류)를 발급하지 않는다.
4. **상태 전이 충돌 없음** — `trigger.is_active`(`data-flow/10-triggers.md §3.1`)·
   `workspace_invitation.accepted_at`(`12-workspace.md §3.1`)·`workflow.is_active`
   (`11-workflow.md §3.1`) 상태 머신은 무변경. C1 이 추가하는 "권한 선검사 통과 → 외부 해제 →
   잠금 재검사 거부" 잔여 창은 `workspaces.service.ts` `deleteWorkspace`/`assertWorkspaceDeletable`
   의 실제 catch 블록·에러 로그 문구와 표현까지 일치하며, `12-workspace.md`(C6) 서술과도 같은
   사실을 가리켜 문서 간 모순이 없다.
5. **RBAC 모델 충돌 없음** — C6 이 명문화하는 "권한 검사(owner)를 트랜잭션 밖에서 먼저" 는 RBAC
   *규칙*(owner 전용) 자체를 바꾸지 않고 *시점*만 서술한다. `1-auth.md §3.2` 의 owner-only 규칙과
   충돌 없음.
6. **계층 책임 충돌 없음** — C3 이 `2-trigger-list.md` frontmatter `code:` 에 추가하는
   `trigger-resource-release.ts`/`trigger-resource-releaser.service.ts` 는 실제로 트리거·워크플로·
   워크스페이스 삭제 세 경로가 공유하는 backend 전용 유틸이며(`grep unregister(` 전수 1곳),
   "트리거 PATCH·DELETE 계약 소유자인 이 문서가 문다" 는 같은 frontmatter 의 기존
   `trigger-config-lock.ts` 등재 주석과 동일한 책임 분할 원칙을 따른다 — 새 원칙 도입 아님.

개별 대조(발췌):

| draft 주장 | 대조 파일 | 결과 |
|---|---|---|
| "부모 삭제도 워크플로 → 워크스페이스 순으로 부모 행 잠금 뒤 트리거 id 열거" | `trigger-resource-releaser.service.ts` `lockParentAndListTriggerIds` | 일치 (`FOR UPDATE` on `Workflow`/`Workspace`, 그 뒤 `Trigger.find`) |
| "트랜잭션 첫 호출로 5초 lock_timeout" | 동 파일 — `setLocalLockTimeout(manager, TRIGGER_DELETE_LOCK_TIMEOUT_MS)` 가 잠금보다 먼저 | 일치. 트리거 단건 삭제(`triggers.service.ts`)도 같은 상수(`TRIGGER_DELETE_LOCK_TIMEOUT_MS=5000`)를 씀 — §4.4 기존 문장("락 대기 상한 5초")과 C2 추가분이 **같은 상수**를 가리켜 모순 없음 |
| "워크스페이스 삭제 잠금 순서 = 워크스페이스 → 멤버십, transferOwnership 과 동일(교착 회피)" | `workspaces.service.ts` `assertWorkspaceDeletable`(코드 순서: `wsRepo.findOne` → `memRepo.findOne`) vs `transferOwnership`(workspace 락 먼저) | 일치 |
| "스케줄 삭제는 unregister 호출부가 아니다(schedule 트리거는 chat channel 없음)" | `schedules.service.ts remove()` — `deleteTriggerSecretsAfterCommit` 만 호출, chat-channel teardown 없음. `grep unregister(` 전체 저장소 1곳(`trigger-resource-releaser.service.ts:155`) | 일치 |
| "secret-store.md 승격 감사 — 트래커 17개 중 열린 6개, 전부 미구현 surface 아님" | `spec-draft-nullable-notation-followups.md` 를 `- [ ]`/`- [x]` 블록 단위로 파싱 | 17/6 수치 정확히 일치. 6개 항목의 성격 분류(제안·질문·인용·harness·자기 자신)도 각 라인(1091/1141/1921/3982/4023/4552) 내용과 부합 |
| "spec-status-lifecycle 가드는 조기 승격 방향을 보지 않는다" | `spec-status-lifecycle.test.ts` — (c) 검증은 "partial 인데 pending_plans 전부 complete" 방향만 봄 | 일치 |
| "10-triggers/11-workflow/12-workspace 의 미구현(Planned) 태그는 이 넷 파일에만 있다" | `grep -rn "미구현 (Planned)"` 을 트리거/시크릿/삭제 문맥으로 필터 | 3개 target 파일 밖에 트리거 삭제 자원 정리 관련 잔존 Planned 태그 없음 — draft 가 놓친 파일 없음 |

## 요약

target 이 건드리는 8개 spec 문서(2-navigation 2개·data-flow 3개·conventions 2개·5-system 1개)에
흩어진 "트리거 삭제 자원 정리" 서술을 실제 머지 코드(`a9288bf6e`)와 대조한 결과, 잠금 순서·5초
상한·권한 선검사 위치·비밀 정리 시점·`unregister` 단일화 등 반복 서술되는 사실관계는 전부
코드·문서 간 일치했고, CRITICAL/WARNING 급 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층
책임 충돌은 발견되지 않았다. `execution-engine.md §4.4` 표에 트리거 정리 사례를 넣지 않기로 한
draft 의 "비대상" 판단도 그 표의 선언된 스코프(엔진 모듈 축)와 부합해 타당하다. 유일한 흠은 C10
Rationale(R-5)이 신설 규약의 동기로 드는 "공유 트래커를 가리키는 spec 문서 3개" 라는 실측 수치가
실제 4개(`chat-channel-adapter.md` 누락)와 어긋난다는 점이며, 이는 기능적 충돌이 아니라 새 규약의
근거 서술 정확도 문제다.

## 위험도

LOW
