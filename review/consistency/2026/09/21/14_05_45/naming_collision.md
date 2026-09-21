# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 재확인

- 프롬프트 지정 target 은 `spec/2-navigation` (impl-done, diff-base `origin/main`) 이지만, 실측 결과
  이 브랜치는 **`spec/2-navigation` 을 한 파일도 바꾸지 않았다** (delta 0). 따라서 이 target 문서가
  "새로 도입하는" spec 식별자는 없다.
- 실제 코드 변경은 `spec/2-navigation` 과 무관한 워크스페이스 멤버 제거 동시성 버그 수정이다
  (`git diff origin/main...HEAD` 기준 codebase 변경 3파일):
  - `codebase/backend/src/modules/workspaces/workspaces.service.ts` (+62/-13)
  - `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` (+163)
  - `codebase/backend/test/member-remove-concurrency.e2e-spec.ts` (신규, +208)
  - 나머지 diff 는 `plan/**`, `review/**` 문서 변경(비-코드)이다.
- 위 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/member-dup-remove-2d4f8b`)를
  절대경로로 직접 열어 확인했다 (prompt 의 예산 절단 경고에 따라 diff 본문을 재현·검증함).

이 스코프 불일치 자체는 정상이다 (코드 전용 PR 은 spec/2-navigation 델타가 0일 수 있다). 아래는 실제
diff 가 도입하는 신규 식별자를 기존 사용처와 대조한 결과다.

## 발견사항

- **[INFO]** 신규 e2e 파일명이 형제 다섯의 명명 패턴(`*-delete-concurrency.e2e-spec.ts`)과 다르다
  - target 신규 식별자: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts` (`-remove-`)
  - 기존 사용처: `codebase/backend/test/{workflow,workspace,trigger,schedule,integration}-delete-concurrency.e2e-spec.ts` 다섯 개는 전부 `-delete-concurrency` 패턴
  - 상세: 실제 이름 충돌(동일 경로)은 없고, 접미사 관례만 어긋난다. 다만 이 사실은 이미
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에 developer 스스로
    "형제마다 같은 누락이 반복됐다" · "«다섯» 과 `*-delete-concurrency` 글롭으로 적혀 있었는데 …
    여섯 번째 파일을 다른 이름으로 추가해 착지 즉시 stale 이 됐다" 로 자체 정정·등재되어 있다
    (`/ai-review` `review/code/2026/09/21/13_28_12` WARNING 3 인용). 즉 "새로 발견된" 충돌이 아니라
    이미 추적 중인 항목이다.
  - 제안: 추가 조치 불요 — 트래커의 후속 항목(각 spec `code:` frontmatter 등재, 개수/패턴 고정 금지
    지침)이 이미 이 드리프트를 정확히 서술하고 있다. 재-flag 로 중복 백로그를 만들지 말 것.

- **[INFO]** `throwMemberNotFound()` — 형제 서비스와 명명 대칭, 충돌 없음 확인
  - target 신규 식별자: `WorkspacesService.throwMemberNotFound()` (private, `workspaces.service.ts:342`)
  - 기존 사용처: `TriggersService.throwTriggerNotFound()`(`triggers.service.ts:412`) ·
    `SchedulesService.throwScheduleNotFound()`(`schedules.service.ts:151`) ·
    `IntegrationsService.throwIntegrationNotFound()`(`integrations.service.ts:613`)
  - 상세: 각 클래스 private 스코프라 실제 충돌 가능성이 없고, 명명 패턴(`throw<Resource>NotFound`)도
    형제 세 자리와 정확히 대칭된다. 문제 없음 — 참고용으로만 기록.

## 확인했으나 충돌 없음으로 판정한 항목

- **에러 코드 `MEMBER_NOT_FOUND`**: diff 이전부터 `workspaces.service.ts`(2곳) ·
  `workspaces.controller.spec.ts` · `workspaces.service.spec.ts`(3곳)에서 동일 의미로 이미 쓰이던
  코드를 그대로 재사용한 것이며, 새로 부여된 코드가 아니다. 다른 의미로 쓰이는 곳 없음.
- **감사 액션 `member.removed` / `details.mode='removed'|'left'`**: 기존에 이미 존재하던 액션·필드
  값을 그대로 재사용(신규 아님). `mode` 두 값 다 기존 자가탈퇴(`leaveWorkspace`) 경로와 이번 PR
  대상 경로가 이미 공유하던 구분자다.
- **API endpoint**: 신규 endpoint 없음. 기존 `DELETE /api/workspaces/:id/members/:memberId` 의
  내부 구현(조회+`remove()` → 원자적 `delete()`)만 바뀌었고 method+path 는 그대로다.
- **테스트 헬퍼 `getAudit()`**: `workspaces.service.spec.ts` 전체에서 정의가 정확히 1곳
  (`:38`)이며, 선행 커밋(`65b082596`)이 이미 중복 정의를 제거했다. 이번 diff 의 신규 `describe`
  블록(`removeMember — 동시 제거`, `:1459`)은 그 단일 정의를 재사용할 뿐 재정의하지 않는다.
  `describe('removeMember — 동시 제거', ...)` 블록명도 파일 내 유일하다.
- **ENV var·config key**: 신규 도입 없음.
- **spec 파일 경로**: `spec/2-navigation` 델타 0 — 신규·변경 spec 파일 없음.
- **plan 파일 경로** `plan/in-progress/member-dup-remove.md`: 기존 `plan/in-progress/` ·
  `plan/complete/` 어디에도 동일 경로가 없어 충돌 없음.

## 요약

이번 diff 는 `spec/2-navigation` 을 전혀 건드리지 않으며(0-파일 delta), 실제 변경은 워크스페이스
멤버 제거 동시성 버그를 고치는 백엔드 코드(`workspaces.service.ts`)와 그 테스트 2건이다. 신규로
도입된 식별자는 private 헬퍼 `throwMemberNotFound()` 와 e2e 파일
`member-remove-concurrency.e2e-spec.ts` 뿐이며, 전자는 형제 서비스들과 명명이 정확히 대칭되어
충돌이 없고, 후자는 형제 다섯의 `-delete-concurrency` 접미사와 다른 `-remove-` 를 쓰지만 실제
경로 충돌이 아니라 관례 드리프트이며 — 이 드리프트는 이미 developer 자신이 같은 PR 의 plan
트래커에 실측·자기정정으로 등재해 두었다(재작업 불필요). 에러 코드·감사 액션·API endpoint 는 모두
기존 정의를 그대로 재사용한 것으로 확인되어 "다른 의미로 이미 쓰이는 식별자" 충돌은 발견되지
않았다.

## 위험도

NONE
