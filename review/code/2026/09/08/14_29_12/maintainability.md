# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[INFO]** `raceErrorSurfaces` 배열(주석 포함 약 26줄)이 cafe24/makeshop 두 spec 파일에 문자 그대로 중복된다
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts` 함수/블록 `describe('업스트림 콜백 처리') > it.each(raceErrorSurfaces)` 위 상수 선언, `codebase/backend/src/modules/integrations/integration-oauth.service.makeshop.spec.ts` 동일 위치의 상수 선언(각 파일의 `const raceErrorSurfaces: ReadonlyArray<[string, () => Error]> = [...]` 블록)
  - 상세: 두 파일 모두 동일한 `// **두 표면을 모두 건다.**...` 주석과 동일한 flat/wrapped 두 케이스(같은 제약 이름 `idx_integration_workspace_service_mall`, 같은 SQLSTATE `23505`, 같은 메시지)를 각자 리터럴로 선언한다. 이 저장소에는 `cafe24-api.client.ts`/`makeshop-api.client.ts` 구조적 미러 중복을 provider 고유 로직이라는 이유로 의도적으로 확정한 선례가 있으나, 여기서 중복되는 것은 provider 와 무관한 **Postgres 에러 모양(raw/wrapped 두 표면)**을 흉내 내는 순수 테스트 픽스처라 같은 근거가 그대로 적용된다고 보기는 어렵다. 이미 같은 디렉터리 옆에 그런 목적의 공유 fixture 패턴(`repo-guards/__tests__/fixtures/endpoint-path-save.fixture.ts`)이 새로 생겼다. 이 항목은 직전 라운드(`review/code/2026/09/08/13_34_28/maintainability.md` INFO)에서 이미 지적·확인됐고 "지금 당장 조치 불요"로 처분된 자리이며, 이번 diff 에서도 그대로 남아 있어 재확인 차원에서 다시 적는다 — 새로 생긴 결함이 아니다.
  - 제안: 지금 당장 수정할 크기는 아니다. 다음에 세 번째 provider(또는 이 배열을 다시 만질 기회)가 생기면 `codebase/backend/src/common/db/__test-utils__/pg-race-error-surfaces.fixture.ts` 류의 공유 fixture 로 뽑아 두 spec 이 import 하는 것을 고려한다.

- **[INFO]** `WorkflowVersionDetailProjection` 개명 배경 JSDoc 이 실제 타입 선언(4줄) 대비 큰 분량이다 — 기존 관례와 일치하며 이미 두 차례 검토·처분된 자리
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` `WorkflowVersionDetailProjection` 선언 바로 위 JSDoc 블록(선언부는 `export type WorkflowVersionDetailProjection = Omit<...>` 로 시작하는 4줄)
  - 상세: 개명 배경(왜 `…Projection` 접미인지, 프런트엔드 미러와의 형태 차이, 과거 W3/W5 "유일 정의" 오판 이력)을 설명하는 문단이 타입 본문보다 훨씬 길다. 직전 두 라운드(`12_53_08`, `13_34_28`) 의 maintainability 리뷰가 이미 같은 자리를 지적하고 "이 저장소의 확립된 rationale-in-code 관례와 일치하므로 조치 불요"로 처분했다. 이번 diff 는 그 JSDoc 을 다시 손대며 표(종전/개명 근거 비교)까지 추가해 분량이 소폭 더 늘었지만, 같은 패턴이 `workspaces.service.ts`(B-4 select 주석)·`user-entity-exposure.spec.ts`·프런트엔드 `workflows.ts` 에도 일관되게 반복되므로 이 PR 만의 새로운 이탈은 아니다.
  - 제안: 조치 불요(재확인). 다음에 이 타입 주변을 다시 열 때 역사적 배경은 `review/**` 링크 한 줄로 축약하고 "현재 유효한 계약"만 JSDoc 최상단에 남기는 선택지를 열어 둔다.

- **[INFO]** `endpoint-path-conflict-wrap-guard.ts` / `user-entity-exposure-guard.ts` 두 형제 가드가 `source-scan.ts` 의 공용 `enclosingScopeName` 을 정상적으로 공유한다 — 이전 라운드가 지적한 워커 중복이 이번 diff 에서 실제로 해소됨을 확인
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` (`enclosingScopeName` 함수), 소비처 `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`(`enclosingName` 삭제 후 import 로 치환) · `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`(신규 소비)
  - 상세: 직전 라운드(`13_34_28`)가 "같은 책임의 AST 워커가 두 가드에 각자 손으로 있다"고 지적했던 중복이 `source-scan.ts` 로 승격되어 제거됐다. 승격 과정에서 한 번 추가됐다가 뮤테이션 테스트로 죽은 코드임이 드러난 분기(초기자가 함수인 변수 우선)를 다시 지운 이력까지 JSDoc 에 정확히 남아 있어, 코드와 문서가 서로 어긋나지 않는다. 결함이 아니라 긍정적 관찰로 기록.
  - 제안: 없음.

- **[INFO]** `.claude/test-stages.sh` 의 `_cmd_typecheck_ratchets()` 네이밍·구조가 기존 관례(`_cmd_*` 내부 헬퍼, `&&` 체이닝)와 일관됨을 확인
  - 위치: `.claude/test-stages.sh:80-85`(`_cmd_typecheck_ratchets`), 호출부 `:95`
  - 상세: 같은 파일의 `_ensure_deps`·`_run_internal`·`_cmd_build_docker_images`·`_cmd_backend_image_hygiene_smoke` 와 동일한 `_cmd_*` prefix·`&&` 체이닝 스타일을 따른다. 새로운 컨벤션 이탈 없음.
  - 제안: 없음.

## 요약

이번 라운드(4번째)의 diff 는 앞선 세 라운드(`12_53_08`→`13_34_28`→`14_01_56`)가 지적한 유지보수성 항목 — CHANGELOG 누락, `production-build-devdep.spec.ts` 반복 `it()` 미파라미터화, `resolveBuildFileNames` 중복 호출, AST 워커 중복(`enclosingName`/`enclosingScopeName`), orphaned JSDoc, 뮤테이션으로 드러난 죽은 분기, plan 체크리스트의 라운드 이력 누락 — 을 실제 코드에서 확인 가능한 형태로 전부 반영했다. `production-build-devdep.spec.ts` 는 `it.each` 로 파라미터화되고 `buildFiles` 캐싱이 `describe` 최상단으로 옮겨져 주석-코드 대응도 복원됐으며, `enclosingScopeName` 은 `source-scan.ts` 로 단일화되고 죽은 분기는 정당화 대신 삭제됐다. 새로 추가된 AST 가드(`endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`/fixture)는 기존 형제 가드와 동일한 구조·네이밍·문서화 규율(순수 로직/소비 spec 분리, 정확 프로퍼티 매칭, fail-open 방지 대조군)을 따르고, 함수 길이·중첩 깊이·순환 복잡도 모두 정상 범위다. 매직 넘버는 이름 있는 상수(`CONFLICT_WRAPPER`, `TRIGGER_REPOSITORY`, `STORE_IDENTIFIER_UNIQUE_CONSTRAINT`)로 방어돼 있다. 남아 있는 것은 cafe24/makeshop 두 spec 간 테스트 픽스처 배열의 문자 그대로 중복(이미 검토·의도적 유예)과 개명 JSDoc 의 분량(기존 관례와 일치, 이미 두 차례 확인)뿐이며, 둘 다 새로운 결함이 아니라 재확인 수준의 관찰이다. 이 배치는 8개 독립 항목이 각각 작고 목적이 분명한 diff 로 나뉘어 있고, 3라운드에 걸친 자기 검토·수정 이력이 코드와 plan 문서 양쪽에 정확히 반영돼 있어 유지보수성 관점에서 위험이 낮다.

## 위험도

LOW
