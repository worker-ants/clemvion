# 변경 범위(Scope) Review

## 검토 대상 확인

payload(`_prompts/scope.md`, 16개 파일)와 `git diff origin/main...HEAD --stat` 결과를 대조 확인 — 16개 파일, `553 insertions(+), 5 deletions(-)` 로 정확히 일치한다. 이 세션의 scope.md payload 자체는 (다른 consistency-checker 파일들이 겪은) mis-scope 문제 없이 정상 스코프됐다.

## 발견사항

- **[INFO]** 서비스 계층 `settings` 대입식 변경 — 의도된 타입 브릿지, 동작 동일
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` L286-287
  - 상세: `settings: dto.settings ?? {}` → `settings: { ...dto.settings } as Record<string, unknown>`. `ImportWorkflowDto.settings` 타입이 `Record<string, unknown>` 에서 `WorkflowSettingsDto` 인스턴스로 바뀐 데 따른 TypeScript 타입 정합(jsonb 컬럼은 여전히 plain object 기대) 목적의 1줄 변경이며, `dto.settings` 가 `undefined` 인 경우 `{ ...undefined }` === `{}` 로 값 자체는 기존과 동일하다. 붙은 주석("검증된 WorkflowSettingsDto 인스턴스를 jsonb Record 로 평탄화")도 이 변경 이유를 정확히 설명하는 최소 주석이며 무관한 주석 추가가 아니다. 신규 `workflows.service.spec.ts` 테스트 2건(설정 영속·omit 시 `{}` 기본값)이 이 지점을 직접 커버한다. 스코프 내 필요 변경으로 판단.
  - 제안: 없음.

- **[INFO]** CHANGELOG.md 변경은 diff 상 신규 엔트리 1건만 삽입
  - 위치: `CHANGELOG.md` L34-39 (diff hunk 기준)
  - 상세: diff 는 `+## Unreleased — workflow import settings validated DTO (patch 대칭)` 섹션 헤더+본문 1개만 상단에 추가하며 그 아래 기존 "orphan pending backstop" 등 여러 이전 Unreleased 섹션들은 **payload 의 "전체 파일 컨텍스트"에 표시된 것일 뿐 diff 대상이 아니다** (unchanged context). 실제 diff hunk 는 6줄 추가뿐 — 스코프 위반 아님. 신규 섹션 문구도 본 변경(§8 import DTO strict화)에 한정되어 있고 다른 PR 서술을 침범하지 않는다.
  - 제안: 없음.

- **[INFO]** spec 문서 변경은 이번 작업이 직접 만든 비대칭(§3.2 목록 누락)을 해소하는 doc-sync — 스코프 내
  - 위치: `spec/2-navigation/1-workflow-list.md` L161(§3.2 항목 6 추가), L189(Rationale §2 말미 예외 단서 추가)
  - 상세: 두 changes 모두 이번 코드 변경(ImportWorkflowDto.settings strict화)이 유발하는 신규 400 실패 모드 + "permissive 정책은 node config 한정, workflow-level settings 는 제외" 명시를 문서화하는 것으로, `--impl-prep` consistency-check(`cross_spec`, `rationale_continuity`)가 INFO 로 명시 권고한 doc-sync 항목과 정확히 대응한다. 코드 스코프 밖 문서 확장이 아니라 동일 변경의 필수 부속.
  - 제안: 없음.

- **[INFO]** `review/consistency/2026/07/04/22_46_30/**` 산출물 8개 파일 — 프로젝트 규약상 예상된 커밋 대상
  - 위치: `review/consistency/2026/07/04/22_46_30/{SUMMARY.md, meta.json, _retry_state.json, cross_spec.md, rationale_continuity.md, convention_compliance.md, plan_coherence.md, naming_collision.md}`
  - 상세: `developer` 워크플로가 구현 착수 직전 의무화한 `consistency-check --impl-prep` 산출물이며, 프로젝트 규약("review/ 는 gitignored 아님 — SUMMARY/RESOLUTION 도 커밋")에 따라 커밋 대상이 맞다. 각 checker 파일이 스스로 payload mis-scope(엉뚱한 spec 문서 번들)를 감지·기록하고 fallback 절차로 실제 코드/spec 을 직접 조사했다는 내용을 담고 있으나, 이는 checker 실행 시점의 오케스트레이터 결함 기록이지 이번 코드 변경의 스코프 이탈이 아니다. `_retry_state.json` 은 오케스트레이터 상태 파일로 통상적인 부산물.
  - 제안: 없음. (다만 반복 관측되는 "target 문서 mis-scope" 는 orchestrator prompt 조립 로직 자체의 별도 이슈로, 이번 코드 변경 스코프 리뷰와는 무관하므로 여기서는 판단 대상에서 제외.)

- **[INFO]** `plan/in-progress/import-workflow-settings-dto.md` 신규 — 규약 준수
  - 위치: 신규 파일
  - 상세: `spec_impact: [spec/2-navigation/1-workflow-list.md]` 로 실제 spec 변경 파일과 일치. 체크리스트도 이번 PR 범위(DTO 타이핑, CHANGELOG, spec doc-sync, 테스트)만 나열하고 있어 범위 이탈 없음.
  - 제안: 없음.

- **[INFO]** DTO/테스트 변경은 `WorkflowSettingsDto` 순수 재사용 — 신규 파일·신규 임포트 최소
  - 위치: `codebase/backend/src/modules/workflows/dto/import-workflow.dto.ts` (`WorkflowSettingsDto` import 1건 추가, `settings` 필드 데코레이터 교체), `workflow-dto-validation.spec.ts`(`ImportWorkflowDto` import 1건 추가 + 신규 describe 블록), `workflows.service.spec.ts`(신규 테스트 2건), `workflow-crud.e2e-spec.ts`(신규 e2e 케이스 1건)
  - 상세: 기존 `UpdateWorkflowDto.settings` 패턴을 그대로 복제한 것으로 신규 DTO/파일 생성 없음. 추가된 JSDoc 주석(L307-312)도 필드 자체의 검증 정책을 설명하는 필요 주석. 데코레이터 순서·조합도 `UpdateWorkflowDto` 선례와 일치. import 추가 2건(`WorkflowSettingsDto`, `ImportWorkflowDto`)은 모두 실사용되며 미사용 임포트 없음.
  - 제안: 없음.

CRITICAL/WARNING 급 스코프 이탈 없음.

## 요약

16개 변경 파일 전부가 "ImportWorkflowDto.settings 를 UpdateWorkflowDto 와 동일한 strict WorkflowSettingsDto 로 전환(import/patch 검증 대칭)"이라는 단일 의도에 직접 종속된다. 서비스 계층의 1줄 타입 브릿지(`{ ...dto.settings } as Record<string, unknown>`)는 DTO 타입 변경에 따른 필수 컴파일 수정이며 런타임 값은 기존과 동일(undefined→{}), 붙은 주석도 그 이유를 설명하는 최소 분량이다. CHANGELOG·spec 문서(§3.2 항목 추가, Rationale 예외 단서)·plan 파일·consistency-check 산출물은 모두 프로젝트 규약(doc-sync 의무, review 산출물 커밋 의무)이 요구하는 부속물로 코드 변경 자체와 일관된 스코프 안에 있다. 무관한 리팩토링, 포맷팅 잡음, 미사용 임포트, 기능 확장(over-engineering), 의도치 않은 설정 변경은 발견되지 않았다.

## 위험도
NONE

STATUS: SUCCESS
