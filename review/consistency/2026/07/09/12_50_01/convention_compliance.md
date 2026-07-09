<!-- main 이 journal(wf_3dcc5db4-28c)에서 복원 — subagent write 격리. -->

### 발견사항

- **[INFO]** `1-workflow-list.md` 내 Rationale 앵커 정밀도 불일치
  - target 위치: `spec/2-navigation/1-workflow-list.md` §2.3 소유 필터 설명 중 `([Rationale §1](#rationale))`
  - 위반 규약: 직접적인 위반이라기보다 문서 내부 일관성 이슈 — `spec-link-integrity.test.ts` (`spec/conventions/spec-impl-evidence.md` §4.2)가 앵커 *존재*만 검증하므로 build 는 통과하지만, 같은 문서의 다른 인용(예: `([Rationale §4](#4-태그-필터는-단일-free-text-로-하향-2026-07-06))`)은 정밀 sub-heading 앵커를 쓰는 반면 §1 인용만 상위 `#rationale` (섹션 최상단)로 뭉뚱그려 가리킨다.
  - 상세: 클릭 시 정확히 "1. 공유 워크플로우의 정의" 서브섹션이 아니라 `## Rationale` 섹션 맨 위로 이동한다. 기능적으로는 유효하나 문서 내 인용 스타일이 혼재.
  - 제안: `#1-공유-워크플로우의-정의--팀-워크스페이스-전체` 형태의 정밀 앵커로 통일 (강제성 없는 사소한 스타일 정합).

- **[INFO]** Export 응답 DTO(`ExportWorkflowDto`)가 `dto/responses/` 규약 위치 밖에 위치
  - target 위치: `spec/2-navigation/1-workflow-list.md` §3.2 Export/Import JSON 포맷 (`SoT: import-workflow.dto.ts / ExportWorkflowDto`)
  - 위반 규약: `spec/conventions/swagger.md` §5-1 "응답 DTO 위치: `codebase/backend/src/modules/<module>/dto/responses/*-response.dto.ts`"
  - 상세: `GET /api/workflows/:id/export` 는 응답을 내려주는 엔드포인트인데, 그 응답 DTO(`ExportWorkflowDto`)가 관례상 `dto/responses/`가 아니라 `import-workflow.dto.ts`(가져오기 측 파일)에 위치한다고 spec이 정확히 명시하고 있다. 이는 spec 문서 자체의 오류가 아니라 **기존 코드가 convention 대비 드리프트**된 상태를 spec이 사실대로 반영한 것 — spec은 정직하게 SoT를 기록했다는 점에서 문서 품질은 양호하나, 근본 원인(코드 위치)은 규약과 어긋난다.
  - 제안: spec 수정은 불필요(현실을 정확히 기술 중). 코드 리팩터 시 `dto/responses/export-workflow-response.dto.ts` 로 이동하는 후속 정리를 backlog 화 권장 (spec 변경 아님, 코드 정리 트랙).

- **[INFO]** `spec/2-navigation/` 내 "Overview(제품 정의)" 섹션 유무의 폴더 내 불균일
  - target 위치: `14-execution-history.md`(EH-LIST/EH-DETAIL/EH-NAV 요구사항 테이블을 담은 `## Overview (제품 정의)` 보유) vs `0-dashboard.md`/`1-workflow-list.md`/`10-auth-flow.md`/`11-error-empty-states.md`/`13-user-guide.md`/`15-system-status.md`(해당 섹션 없이 바로 본문 시작)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` "Spec 문서 구조 (3섹션 권장)" — "다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일"
  - 상세: `spec/2-navigation/_product-overview.md`는 각 화면 spec 문서로의 링크만 제공하고 세부 요구사항(Overview)은 복제하지 않는다. 대부분의 대상 문서는 이 규칙대로 Overview를 생략하지만, `14-execution-history.md`(및 폴더 밖 참고로 `6-config.md`)는 자체 `## Overview (제품 정의)` + 요구사항 ID 표를 보유한다. 레포 전체를 보면 이 패턴(리프 문서가 자체 Overview 보유) 자체는 18개 문서에서 이미 널리 쓰이는 확립된 관행이라 강한 위반으로 보긴 어렵지만, 같은 영역 폴더 안에서조차 문서별로 구조가 갈리는 점은 일관성 관점에서 재검토 여지가 있다.
  - 제안: 규약을 어긴 것은 아니므로 수정 강제 불필요. 다만 향후 `spec/2-navigation/*.md` 신규/개정 시 "복합 요구사항 ID 표가 필요한 화면"과 "단순 화면 spec"을 구분하는 기준을 project-planner SKILL.md에 명문화하면 재현 가능한 판단 기준이 됨(규약 갱신 제안, target 수정 아님).

검증 완료(위반 없음, 참고용):
- frontmatter 스키마(`id`/`status`/`code`/`pending_plans`) 7개 대상 문서 전부 `spec-impl-evidence.md` §2·§3 준수 확인(`id` 유일성, `code:` glob 실존, `partial`↔`pending_plans` 매칭 등 실제 파일시스템 대조 완료).
- 에러 코드(`VALIDATION_ERROR`/`RESOURCE_CONFLICT`/`DUPLICATE_NODE_LABEL`/`CONTAINER_CYCLE`/`CYCLE_DETECTED`, OAuth `lower_snake_case` query param)는 `spec/conventions/error-codes.md` 카탈로그·historical-artifact 예외 레지스트리와 정확히 일치하며, `10-auth-flow.md`는 예외 등재 근거까지 명시적으로 인용.
- 응답 포맷(`{ "data": ... }` 단일 래핑, `{ data: [...], pagination }` 페이징, `{ data: { providers: [...] } }` 단일 리소스형)은 `swagger.md` §2-5/§5, `5-system/2-api-convention.md` §5.1-5.2 single-wrap 정책과 부합.
- i18n 키 네이밍(`workflows.executionHistory`, `auth.register.strengthWeak` 등)은 `spec/conventions/i18n-userguide.md` Principle 1/2 패턴과 부합.
- `13-user-guide.md` §8 `<ImplAnchor kind>` enum(`ui-entry`/`component`/`api-endpoint`/`e2e-scenario`)은 `user-guide-evidence.md` §1.2와 완전 일치.
- 대상 문서 내 교차 링크(앵커) 표본 검증 — `_layout.md#22-메뉴-항목`, `9-user-profile.md#3-워크스페이스-전환`, `13-replay-rerun.md#102-re-run-모달`, `#rr-pl-05`/`#rr-pl-06`, `2-api-convention.md#41/#52` 등 모두 실제 헤딩 존재 확인.

### 요약
`spec/2-navigation/` 내 검토 대상 7개 문서(`0-dashboard`, `1-workflow-list`, `10-auth-flow`, `11-error-empty-states`, `13-user-guide`, `14-execution-history`, `15-system-status`)는 `spec/conventions/**`(특히 `spec-impl-evidence.md`, `error-codes.md`, `swagger.md`, `i18n-userguide.md`, `user-guide-evidence.md`)의 명명·출력 포맷·frontmatter 규약을 광범위하고 정밀하게 준수하고 있으며, 다수 지점에서 규약 문서를 명시적으로 인용해 근거를 남기는 등 모범적인 정합 수준을 보인다. CRITICAL/WARNING 급 위반은 발견되지 않았고, 발견된 사항은 앵커 인용 정밀도·기존 코드의 DTO 위치 드리프트·Overview 섹션 사용의 폴더 내 경미한 불균일 등 INFO 수준의 스타일/정리 여지에 그친다.

### 위험도
NONE