# 신규 식별자 충돌 검토 — Personal 통합 소유자 강제 (impl-done)

## 검토 범위와 근거

이 PR 의 spec 델타는 `2-navigation/4-integration.md`(§8 신설) · `3-workflow-editor/4-ai-assistant.md` ·
`5-system/3-error-handling.md`(`ADMIN_REQUIRED` 설명 보강) · `4-nodes/4-integration/_product-overview.md`(`INT-MG-07`
설명 보강)이며, 구현 델타는 `codebase/backend/src/modules/integrations/**` · `workflow-assistant/tools/**` ·
`workspaces.service.ts` 27개 파일이다. 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/integration-personal-owner`)를
절대경로로 `git diff origin/main...HEAD` 하여 신규 식별자를 전수 추출하고, 각각을 저장소 전체에서 재검색해 충돌 여부를 확인했다.

## 발견사항

이번 PR 이 새로 도입한 식별자를 6개 관점으로 대조한 결과, **충돌은 발견되지 않았다.**

- **요구사항 ID** — `INT-MG-07` 은 신규 ID 가 아니라 기존 항목의 설명만 보강(§8 링크 추가)했다. `ADMIN_REQUIRED` 코드도
  마찬가지로 2026-09-25 이전에 이미 도입된 기존 코드(`RolesGuard`/`WorkspacesService.assertAdmin()` 발행)를 재사용한 것이며,
  이 PR 은 발행처(`IntegrationsService` 의 Organization 판정)를 추가했을 뿐 새 코드를 만들지 않았다 — plan 의 `--impl-prep`
  W4 항목도 같은 결론(§5 Rename 이력 미등재는 정상, retired 코드가 아니므로)으로 처리되어 있다(`plan/in-progress/integration-personal-owner.md`).
- **엔티티/타입명** — 새로 추가된 순수 함수·서비스 메서드 `isIntegrationVisibleTo` · `integrationVisibilityClause`
  (`codebase/backend/src/modules/integrations/integration-visibility.ts`), `requireVisible` · `assertCanModify` ·
  `requireModifiable`(`integrations.service.ts`)는 저장소 전체에서 grep 했을 때 이 PR 이 만든 자리 외에는 0건 — 기존
  `requireEntity`(실행 엔진 전용으로 존치)와도 이름이 겹치지 않는다.
- **API endpoint** — 컨트롤러 diff 에 신규 `@Get/@Post/@Patch/@Delete` 데코레이터가 없다(`git diff` 확인). 이 PR 은 기존
  엔드포인트(목록·`:id`·`oauth/begin`·precheck)의 가시성/권한 판정만 바꿨고 새 method+path 를 추가하지 않았다.
- **이벤트/메시지명** — webhook·queue·SSE 이벤트 이름 신설 없음(diff 에 해당 표면 변경 없음).
- **환경변수·설정키** — diff 상 유일한 `process.env` 참조(`E2E_BASE_URL`, 신규 e2e 스펙)는 기존 e2e 스펙 65개가 이미 쓰는
  코드베이스 관례를 그대로 재사용한 것으로 신규 키가 아니다. `getMemberRole` 에 추가된 `manager?: EntityManager` 파라미터도
  같은 파일의 다른 메서드(`assertAdmin` 류)가 이미 쓰는 이름·타입과 동일해 명명 충돌이 없다.
- **파일 경로** — 신규 파일 `integration-visibility.ts`/`.spec.ts`, `integrations.controller.owner.spec.ts`,
  `test/integration-personal-owner.e2e-spec.ts` 는 기존 파일과 겹치지 않으며, `<controller>.<aspect>.spec.ts` 분리 패턴은
  `workflow-assistant.controller.swagger.spec.ts` 에 선례가 있어 컨벤션에서 벗어나지 않는다. spec 쪽은 이번 PR 이 새 파일을
  만들지 않고 기존 4개 문서만 수정했다.
- **spec 섹션 번호** — `2-navigation/4-integration.md` 에 §8 «권한 규칙» 을 새로 끼워 넣으면서 기존 §8(API)이 §9 로
  밀렸는데, 이를 참조하던 모든 교차문서(`0-overview.md`, `3-workflow-editor/4-ai-assistant.md` 3곳, `4-nodes/4-integration/_product-overview.md`,
  `5-system/3-error-handling.md`, `1-data-model.md`)가 새 앵커(`#8-권한-규칙`/`#9-api`)로 이미 동기화되어 있어 끊어진 링크나
  앵커 충돌이 없다.

## 요약

이번 PR 이 도입하는 식별자(신규 함수/메서드명, `ADMIN_REQUIRED` 재사용, `INT-MG-07` 보강, spec §8 신설과 그에 따른 §9 재번호,
신규 테스트/서비스 파일 경로)를 저장소 전체 사용처와 대조했으나 다른 의미로 이미 쓰이고 있는 식별자와의 충돌, 끊어진 교차참조,
새 API endpoint·이벤트명·환경변수 충돌은 발견되지 않았다. 특히 재사용된 `ADMIN_REQUIRED` 는 새 코드가 아니라 기존 코드의
발행처 확장이라 rename 정책과도 충돌하지 않으며, §8 신설로 인한 섹션 재번호는 모든 참조가 동시에 갱신되어 있다.

## 위험도

NONE
