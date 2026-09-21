# 변경 범위(Scope) 리뷰

## 발견사항

없음.

## 상세 근거

- **핵심 프로덕션 변경** (`codebase/backend/src/modules/integrations/integrations.service.ts` `remove()`): `this.integrationRepository.remove(entity)` 한 줄을 원자적 `delete({ id, workspaceId })` + `affected === 0` 판정 4줄로 교체한 것이 유일한 로직 변경이다. `NotFoundException` 은 이미 파일 상단에서 import 되어 다른 4곳에서도 쓰이고 있어(예: 603, 732, 766행) 신규 import 가 필요 없었고 실제로 추가되지 않았다. 무관한 코드 이동·포맷팅·주석 삭제는 없다 — diff 전체가 해당 블록에 국한된다.
- **단위 테스트** (`integrations.service.spec.ts`): mock repo 에 `delete` 스텁 추가, 기존 `remove` 단언을 `delete` 단언으로 교체, 그리고 두 개의 신규 `it()`(진 쪽 404 케이스 + `affected` 미보고 대조군 케이스) — 전부 `describe('remove', ...)` 블록 안에 있고 프로덕션 변경과 1:1 대응한다. 다른 `describe` 블록·다른 메서드의 테스트는 건드리지 않았다.
- **신규 e2e** (`test/integration-delete-concurrency.e2e-spec.ts`): 새 파일이며, 직전 PR들(#1369~#1371)의 `workflow-`/`trigger-`/`schedule-delete-concurrency.e2e-spec.ts` 와 동일한 패턴(행 락으로 겹침 유도 → `[204, 404]` + audit 1건 단언)을 따른다. 무관한 e2e suite 를 수정하지 않았다.
- **plan 신규 파일** (`plan/in-progress/integration-dup-delete.md`): 이번 작업 전용 plan. `spec_impact: none` 이며 `.claude/docs/plan-lifecycle.md` 프로세스를 따른다.
- **트래커 파일 수정** (`plan/in-progress/spec-draft-nullable-notation-followups.md`): 순수 추가 diff 2건 — (a) `WorkspacesService.removeMember()` 를 "이 결함 클래스의 6번째 자리"로 새로 등재, (b) 기존 항목의 문서-갱신 스코프에 `4-integration.md §9` 추가. `git log` 로 확인한 결과 직전 세 PR(#1369, #1370, #1371) 모두 **동일한 방식으로 같은 트래커 파일에 새 발견을 등재**해 왔다(예: fc5ea6b76 커밋 메시지가 "이 PR 뒤에도 `IntegrationsService.remove()`" 를 언급하며 다음 자리를 예고). 이는 이 PR 이 만든 관례가 아니라 이미 확립된 반복 패턴이며, plan 체크리스트(`- [x] 트래커에 ... 등재 — grep 0→1 확인`)에 명시적으로 기록돼 있어 의도된 작업이다.
- **consistency-check 산출물 6건** (`review/consistency/2026/09/21/10_27_27/*`): 전부 신규 파일이며, `CLAUDE.md` 가 명시하는 "developer 는 구현 착수 직전 `consistency-check --impl-prep` 의무" 단계의 자동 산출물이다(plan 체크리스트에도 실행 로그로 기록됨). `meta.json` 을 확인한 결과 정상적인 5-checker 조합·정상 타임스탬프이며, 임의 내용이 섞여 있지 않다.
- 포맷팅/공백/불필요한 주석/사용하지 않는 import/설정 파일 변경은 발견되지 않았다. 추가된 주석은 전부 이번 변경의 판정 로직(원자적 DELETE, `=== 0` 명시 비교, cascade 무영향 확인)을 설명하는 것으로 실질 변경과 분리되지 않고 정확히 그 옆에 위치한다.
- `git diff --stat origin/main...HEAD` 로 branch 전체 diff 를 재확인했고, 프롬프트에 나열된 13개 파일과 정확히 일치했다 — 프롬프트에 없는 숨은 변경은 없다.

## 요약

변경은 "통합 동시 DELETE 감사 중복" 결함 하나에 정확히 국한된다. 프로덕션 코드는 `remove()` 메서드 내부 삭제 판정 로직 교체 한 곳뿐이고, 나머지는 그에 대응하는 단위/e2e 테스트, 이번 작업 전용 plan, 그리고 프로젝트 규약이 의무화한 트래커 등재·`--impl-prep` consistency-check 산출물이다. 트래커 파일 수정은 언뜻 "무관한 대형 문서 편집"처럼 보일 수 있으나, 직전 세 자매 PR 모두 동일한 방식으로 같은 파일을 건드려 온 확립된 관례이며 이번 PR 의 plan 체크리스트에도 명시돼 있어 범위 이탈이 아니다. Over-engineering, drive-by 리팩토링, 무관한 파일 수정, 포맷팅 오염, 불필요한 import/주석 변경은 발견되지 않았다.

## 위험도

NONE
