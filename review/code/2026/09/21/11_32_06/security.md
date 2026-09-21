# 보안(Security) 리뷰 — integration-dup-delete-9e52a7

## 검토 범위

- `codebase/backend/src/modules/integrations/integrations.service.ts` — `remove()`: 무락 `findOne` + `repository.remove(entity)` → 원자적 `repository.delete({ id, workspaceId })` + `affected` 판정. `throwIntegrationNotFound(): never` 헬퍼 추출(7개 호출부 통합).
- `codebase/backend/src/modules/integrations/integrations.service.spec.ts` — 단위 테스트 갱신(`delete` mock, 동시 삭제 진 쪽/대조군 테스트 추가, conflict-path 단언을 `remove`→`delete` 참조로 교체).
- `codebase/backend/test/integration-delete-concurrency.e2e-spec.ts` — 신규 e2e, 행 락(`SELECT … FOR UPDATE`)으로 경합을 재현.
- `CHANGELOG.md`, `plan/in-progress/integration-dup-delete.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` — 문서/plan, 코드 아님.
- `review/code/2026/09/21/10_54_47/*`, `review/consistency/2026/09/21/10_27_27/*` — 직전 리뷰·consistency-check 세션의 산출물(마크다운/JSON 리포트). 애플리케이션 코드가 아니며, 그 자체로 시크릿·인젝션·인가 표면을 갖지 않는다. 다만 내용상 새 보안 발견은 없는지 훑었다(아래 참고).

핵심 변경은 동시 `DELETE /api/integrations/:id` 두 건이 감사 로그(`integration.deleted`)를 두 번 남기던 결함을, 락 없이 원자적 `DELETE` 문 하나의 `affected` 값으로 판별하도록 고친 것이다. 컨트롤러(`integrations.controller.ts`)의 `@Delete(':id')` 핸들러, `@Roles('editor')`, `@WorkspaceId()`, `ParseUUIDPipe`(id 검증)는 이번 diff 대상이 아니며 직접 열람해 회귀 없음을 확인했다.

## 발견사항

없음 (Critical/Warning 없음).

## 확인 사항 (비차단, 참고용 INFO)

- **[INFO]** 테넌트 격리(workspace 스코프)가 삭제 쿼리 자체에도 유지된다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `remove()` — `const { affected } = await this.integrationRepository.delete({ id, workspaceId });`
  - 상세: 종전 `remove(entity)` 는 이미 `findOne({ where: { id, workspaceId } })` 로 소유권을 검증한 엔티티를 지웠다. 새 코드는 그 검증된 `id`/`workspaceId` 를 `delete()` **criteria 객체**로 다시 넘겨, 삭제 SQL(`DELETE … WHERE id = $1 AND workspace_id = $2`) 자체도 workspace 밖으로 새지 않는다. TypeORM 이 criteria 객체를 파라미터 바인딩으로 컴파일하므로 SQL 인젝션 표면도 없다. 다른 워크스페이스가 동일 `id` 의 통합을 지울 수 있는 경로는 생기지 않는다.
  - 제안: 없음(회귀 없음 확인).
- **[INFO]** 승자/패자 응답이 동일한 일반화된 404 를 반환해 정보 노출이 늘지 않는다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `throwIntegrationNotFound()` 헬퍼(신규 `affected === 0` 분기와 기존 `findOne` 실패 분기가 모두 이 헬퍼를 공유)
  - 상세: "동시 삭제에서 진 경우"(방금까지 존재했다)와 "애초에 없거나 다른 워크스페이스 소유인 경우"가 완전히 동일한 `{ code: 'RESOURCE_NOT_FOUND', message: 'Integration not found' }` 를 반환해 응답만으로 두 상황을 구분할 수 없다. 존재/소유 여부를 추론하는 오라클이 늘지 않는다.
  - 제안: 없음.
- **[INFO]** 사용처 검사(`queryUsageNodes`)와 원자적 `delete` 사이의 TOCTOU 는 여전히 남지만 이번 diff 의 신규 결함이 아니다
  - 위치: `integrations.service.ts` `remove()` — `queryUsageNodes` 호출부와 `delete` 호출부 사이
  - 상세: 사용처 0건 확인 직후 다른 요청이 같은 통합을 새 노드에 연결하면 "사용 중인데 삭제된" 상태가 될 수 있다. 이 순서·락 부재는 종전 `remove(entity)` 코드에도 동일하게 있었다 — 이번 diff 가 만든 회귀가 아니다. `plan/in-progress/integration-dup-delete.md` "이 PR 이 하지 않는 것" 절에 명시적으로 스코프 아웃되어 있고 트래커에도 등재돼 있다.
  - 제안: 별도 트래킹대로 진행. 이번 PR 범위에서 조치 불요.
- **[INFO]** e2e 테스트의 자격증명 값은 실제 시크릿이 아니다
  - 위치: `codebase/backend/test/integration-delete-concurrency.e2e-spec.ts` (`credentials: { token: 'e2e-intdel-token' }`)
  - 상세: 로컬 e2e 컨테이너 전용 고정 문자열 fixture 이며 운영 자격증명이 아니다. 형제 e2e 스펙들과 동일한 패턴. 하드코딩된 시크릿으로 분류하지 않는다.
  - 제안: 없음.
- **[INFO]** 리뷰/consistency-check 산출 마크다운(`review/code/2026/09/21/10_54_47/*`, `review/consistency/2026/09/21/10_27_27/*`)에 시크릿·자격증명·개인정보 노출 없음을 훑어 확인했다. 감사 로그 관련 신규 유출도 없다 — `remove()` 의 감사 `details` 는 `serviceType`/`name` 만 기록하며(기존과 동일), `credentials` 필드는 어디에도 로깅되지 않는다.

## 요약

이번 diff 는 `IntegrationsService.remove()` 를 무락 `findOne` + `repository.remove(entity)` 조합에서 원자적 `DELETE … WHERE id = $1 AND workspace_id = $2` + `affected === 0` 명시 판정으로 바꿔 동시 삭제 경합 시 감사 로그 이중 기록을 막는다. 삭제 쿼리에도 `workspaceId` 조건이 그대로 유지되어 테넌트 격리(인가 스코프)가 diff 전후로 동등하고, TypeORM 파라미터 바인딩으로 SQL 인젝션 표면이 없으며, 승자/패자 양쪽 응답이 동일한 일반화된 404 를 반환해 리소스 존재·소유 여부를 추론하는 정보 노출 경로도 늘지 않는다. 컨트롤러의 인가 데코레이터(`@Roles('editor')`, `@WorkspaceId()`)는 변경 대상이 아니며 직접 확인한 결과 그대로다. 테스트 파일의 자격증명 값은 로컬 e2e fixture 로 실제 시크릿이 아니다. 사용처 검사와 삭제 사이의 TOCTOU 는 기존부터 있던 별개 사안으로 이번 PR 이 명시적으로 범위 밖에 두고 트래커에 등재했으므로 신규 결함이 아니다. 함께 포함된 plan/consistency-check 산출물에도 시크릿 유출이나 인가 로직 변경은 없다. 보안 관점에서 차단할 이슈는 발견되지 않았다.

## 위험도

NONE
