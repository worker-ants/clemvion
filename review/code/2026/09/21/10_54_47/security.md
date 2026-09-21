# 보안(Security) 리뷰 — integration-dup-delete-9e52a7

## 검토 범위

- `codebase/backend/src/modules/integrations/integrations.service.ts` (`remove()` — `repository.remove(entity)` → 원자적 `repository.delete({id, workspaceId})` + `affected` 판정)
- `codebase/backend/src/modules/integrations/integrations.service.spec.ts` (단위 테스트 갱신)
- `codebase/backend/test/integration-delete-concurrency.e2e-spec.ts` (신규 e2e)
- `plan/in-progress/integration-dup-delete.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` (plan/트래커, 코드 아님)
- `review/consistency/2026/09/21/10_27_27/*` (직전 consistency 검토 산출물, 코드 아님)

핵심 변경은 동시 `DELETE /api/integrations/:id` 두 건이 감사 로그(`integration.deleted`)를 두 번 남기던 결함을 원자적 `DELETE` 문의 `affected` 값으로 판별하도록 고친 것이다. 보안 관점에서 이 변경 자체와 주변 인가 경로를 함께 확인했다(`integrations.controller.ts#remove`, `@WorkspaceId()`/`@Roles('editor')`/`ParseUUIDPipe` 는 이번 diff 대상이 아니라 회귀 여부만 대조).

## 발견사항

없음 (Critical/Warning 없음).

### 확인 사항 (비차단, 참고용 INFO)

- **[INFO]** 테넌트 격리(workspace 스코프)는 diff 전후로 동일하게 유지된다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:800-803` (원자적 `delete` 호출)
  - 상세: 기존 `remove(entity)` 는 `findOne({ where: { id, workspaceId } })`(`:762-764`)로 이미 workspace 소유를 검증한 엔티티를 지웠다. 새 코드는 `delete({ id, workspaceId })` 로 **삭제 쿼리 자체에도 workspaceId 조건을 유지**해, 다른 워크스페이스의 동일 `id` 를 실수로 지우는 경로가 새로 생기지 않는다. TypeORM `delete(criteria)` 는 객체 리터럴 조건을 파라미터 바인딩으로 처리하므로 SQL 인젝션 표면도 없다.
  - 제안: 없음(회귀 없음 확인).
- **[INFO]** 에러 응답이 정보를 추가로 노출하지 않는다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:804-809`
  - 상세: `affected === 0` 분기의 `NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Integration not found' })` 는 앞선 `findOne` 실패 시(`:765-770`)와 **동일한 코드·메시지**를 반환한다. "동시 삭제로 진 경우"와 "애초에 존재하지 않거나 다른 워크스페이스 소유인 경우"를 응답으로 구분할 수 없어, 리소스 존재/소유 여부를 추론하는 information disclosure 경로가 생기지 않는다.
  - 제안: 없음.
- **[INFO]** 사용처 검사와 삭제 사이의 TOCTOU 는 이번 PR 의 의도적 비목표이며 신규 취약점이 아니다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `remove()` — 사용처 검사(`queryUsageNodes`, `:775`)와 `delete` 호출(`:800`) 사이 구간
  - 상세: `plan/in-progress/integration-dup-delete.md` "이 PR 이 하지 않는 것" 절이 이 TOCTOU 를 명시적으로 별개 사안으로 남긴다고 밝히고 있고, 트래커(`spec-draft-nullable-notation-followups.md`)에도 별도 등재돼 있다. 사용처 검사 통과 후 다른 요청이 같은 통합을 새 노드에 연결하면 "사용 중인데 삭제된" 상태가 될 수 있으나, 이번 diff 가 만든 회귀가 아니라 기존부터 존재하던 처리 순서이고 처리 계획도 문서화돼 있다.
  - 제안: 별도 트래킹 그대로 유지(이번 리뷰의 차단 사유 아님).
- **[INFO]** e2e/unit 테스트의 자격증명 값은 실제 시크릿이 아니다.
  - 위치: `codebase/backend/test/integration-delete-concurrency.e2e-spec.ts:62` (`credentials: { token: 'e2e-intdel-token' }`)
  - 상세: 로컬 e2e 컨테이너 환경에서만 쓰이는 고정 문자열 fixture 이고, 실제 서비스 자격증명이나 운영 시크릿이 아니다. 형제 e2e 스펙들과 동일한 패턴이다. 하드코딩된 시크릿으로 분류하지 않는다.
  - 제안: 없음.

## 요약

이번 diff 는 `IntegrationsService.remove()` 를 무락 `findOne` + `remove(entity)` 조합에서 원자적 `DELETE … WHERE id = $1 AND workspace_id = $2` + `affected` 명시 판정(`=== 0`)으로 바꿔 동시 삭제 경합 시 감사 로그 이중 기록을 막는다. 삭제 쿼리에도 `workspaceId` 조건이 그대로 유지되어 테넌트 격리(인가 스코프)가 diff 전후로 동등하며, TypeORM 파라미터 바인딩으로 인젝션 표면이 없고, 승자/패자 양쪽 응답이 기존과 동일한 일반화된 404 메시지를 사용해 정보 노출이 늘지 않는다. 테스트 파일들의 자격증명 값은 로컬 e2e fixture 로 실제 시크릿이 아니다. 사용처 검사와 삭제 사이의 TOCTOU 는 기존부터 있던 별개 사안으로 이번 PR 이 명시적으로 범위 밖에 두고 트래커에 등재했으므로 이번 diff 의 신규 결함이 아니다. 보안 관점에서 차단할 이슈는 발견되지 않았다.

## 위험도

NONE
