# 신규 식별자 충돌 검토 — spec/2-navigation (impl-done)

## 조사 방법

- scope(`spec/2-navigation`) 의 spec 델타는 0개 파일. 실제 구현 diff(`origin/main...HEAD`)는
  `codebase/backend/src/modules/model-config/model-config.service.ts`,
  `model-config.service.spec.ts`, 신규 `codebase/backend/test/model-config-delete-concurrency.e2e-spec.ts`
  (+ `CHANGELOG.md`, `plan/in-progress/modelconfig-dup-delete.md`) 3개 코드 파일 316줄이다.
  모두 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/modelconfig-dup-delete-4b8e2d`)에서
  `git diff origin/main...HEAD -- <path>` 로 직접 확인했다.
- 변경 내용은 `ModelConfigService.remove()` 를 `repo.remove(entity)` → 원자적
  `repo.delete({ id, workspaceId })` + `affected === 0` 판정으로 바꾼 동시-삭제 결함 수정
  (형제 #1369~#1374 와 같은 클래스, 여덟 번째 자리)이다. 신규 요구사항 ID, 신규 엔티티/DTO,
  신규 API endpoint, 신규 이벤트, 신규 ENV/설정키를 선언하는 변경이 아니다.

## 발견사항

- **[INFO]** 신규 파일은 기존 e2e 명명 컨벤션을 그대로 따름
  - target 신규 식별자: `codebase/backend/test/model-config-delete-concurrency.e2e-spec.ts` (신규 파일)
  - 기존 사용처: 같은 디렉터리의 `workflow-delete-concurrency.e2e-spec.ts` ·
    `workspace-delete-concurrency.e2e-spec.ts` · `trigger-delete-concurrency.e2e-spec.ts` ·
    `schedule-delete-concurrency.e2e-spec.ts` · `integration-delete-concurrency.e2e-spec.ts` ·
    `auth-config-delete-concurrency.e2e-spec.ts` · `member-remove-concurrency.e2e-spec.ts`
    (형제 #1369~#1374, `ls codebase/backend/test/`로 실측)
  - 상세: `<resource>-delete-concurrency.e2e-spec.ts` 패턴에 정확히 맞춘 이름이라 충돌·혼동
    여지가 없다. 파일 경로 관점에서는 오히려 모범 사례.
  - 제안: 없음 (조치 불필요, 참고용 기록).

- **[INFO]** 에러 코드 `MODEL_CONFIG_NOT_FOUND` 는 재사용이지 신규 선언이 아님
  - target 신규 식별자: 해당 없음 — diff 는 `MODEL_CONFIG_NOT_FOUND` 를 새로 만들지 않는다.
  - 기존 사용처: `codebase/backend/src/modules/model-config/model-config.service.ts:148`
    (`origin/main` 기준 이미 존재하는 `private notFound()` 헬퍼) ·
    `spec/5-system/3-error-handling.md:85` · `spec/conventions/error-codes.md:171` ·
    `spec/5-system/9-rag-search.md:379` 등에 이미 문서화된 기존 코드.
  - 상세: diff 는 "진 쪽" 분기(`if (affected === 0) throw this.notFound();`)에서 기존
    `notFound()` 헬퍼를 그대로 재사용한다. `findEntity()` 실패 경로와 동일 코드를 의도적으로
    맞춘 것(“없어서 404”와 “져서 404”를 클라이언트가 구분하지 못하게)이며 새 코드를 발행하지
    않는다. 형제 PR들이 각자 `RESOURCE_NOT_FOUND` 를 재사용한 것과 대칭.
  - 제안: 없음 — 신규 식별자 아님, 충돌 아님.

- **[INFO]** CHANGELOG 신규 섹션 제목 중복 없음
  - target 신규 식별자: `## Unreleased — 동시 DELETE 두 건이 \`model_config.delete\` 감사 행을
    두 번 남기던 것` (CHANGELOG.md 신규 섹션 헤더)
  - 기존 사용처: 같은 파일 내 형제 헤더 7개(`auth_config.delete` · `member.removed` ·
    `integration.deleted` · `schedule.deleted` · `trigger.deleted` · `workflow.deleted` 등,
    `grep -n "^## Unreleased" CHANGELOG.md` 로 전수 실측 — 총 68개 헤더 중 완전 동일 문자열 없음).
  - 상세: 리소스명(`model_config.delete`)이 헤더에 명시돼 있어 다른 헤더와 문자열이 겹치지
    않는다. 감사 액션명 `model_config.delete` 자체도 CHANGELOG:2778 "감사 로깅 커버리지 확장:
    workflow / trigger / schedule / model_config" 항목에서 이미 도입된 기존 액션명의 재사용이다.
  - 제안: 없음.

## 요약

target(`spec/2-navigation`)은 이번 브랜치에서 spec 델타가 0개이고, 실제 구현 diff(3파일/316줄)는
`ModelConfigService.remove()` 내부의 동시-삭제 경합 수정(원자적 `DELETE` 전환)으로, 신규
요구사항 ID·엔티티/DTO·API endpoint·이벤트/메시지명·ENV/설정키를 전혀 새로 도입하지 않는다.
유일하게 새로 생기는 파일 경로(`model-config-delete-concurrency.e2e-spec.ts`)는 형제 7개 e2e
파일과 동일한 명명 컨벤션을 정확히 따르며, 재사용되는 식별자(`MODEL_CONFIG_NOT_FOUND`,
`model_config.delete`, `notFound()`)는 모두 `origin/main` 시점에 이미 존재하던 것을 그대로
가져다 쓴 것으로 확인했다. CRITICAL/WARNING 급 신규 식별자 충돌은 발견되지 않았다.

## 위험도

NONE
