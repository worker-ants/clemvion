# 문서화(Documentation) 리뷰

## 검증 방법

`response-contract.ts`/`response-contract.spec.ts` 의 JSDoc 이 인용하는 수치(엔티티-DTO 불일치
59건·정상 케이스 46건·§5.4 미검증 DTO 78곳)를 `plan/in-progress/spec-draft-nullable-notation-followups.md`
원문과 대조했고, e2e 4개 파일에 새로 붙은 인라인 주석(§5.4 대조 이유)이 실제 컨트롤러 코드(반환 타입
미명시 여부)와 맞는지 `workflows.controller.ts` 를 직접 열어 확인했다. 배선된 4개 DTO
(`ExecutionDto`/`WorkflowDto`/`AuditLogDto`/`SessionDto`)의 실제 필드·`@ApiPropertyOptional` 개수를
세어 plan 문서 표의 "required" 열(12/10/8/7)과 대조했다. `tsconfig.build.json`, `CHANGELOG.md`,
`codebase/backend/test/` 의 README 유무도 확인했다.

## 발견사항

- **[INFO]** `response-contract.ts` 가 아직 어떤 spec 의 frontmatter `code:` glob 에도 등재돼
  있지 않다
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts` (신규 파일 전체)
  - 상세: 이 파일은 `spec/5-system/2-api-convention.md` §5.4 를 **실제로 시행하는** 유일한
    코드인데, 어떤 spec 문서의 `code:` glob 에도 걸리지 않아 이 파일이 바뀌어도
    `--impl-done` 의 SPEC-CONSISTENCY 게이트가 반응하지 않는다. 다만 이 갭은 이번 diff 에
    포함된 `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목("`2-api-convention.md`
    frontmatter `code:` 에 §5.4 검증자 등재", 2026-09-05 등재)이 이미 정확히 이 문제를 지목하고
    planner 트랙으로 넘겨 두었다(developer 는 `spec/` 쓰기 권한이 없음). **새 결함이 아니라 이미
    올바르게 추적 중인 항목**이므로 이번 PR 에서 조치를 요구하지 않는다.
  - 제안: 조치 불요 — 다음 planner 턴에서 그 plan 항목을 집행할 것.

- **[INFO]** CHANGELOG 항목 없음 — 하지만 이 저장소 관례상 이번 PR 은 대상이 아니다
  - 위치: `CHANGELOG.md`(변경 없음)
  - 상세: `CHANGELOG.md` 의 기존 `## Unreleased` 항목들(예: `AlertRuleDto.threshold` wire 타입
    정정, `workflowId` 쿼리 파라미터 제거)은 전부 **API 소비자에게 보이는 동작/wire 변경**을
    기록하는 용도다. 이번 PR 은 §5.4 검증 헬퍼를 일반화하고 e2e 4곳에 배선했을 뿐 — 뮤테이션
    검증(`payload → {}`)으로 4개 DTO 모두 기존 응답이 선언과 이미 일치함을 확인했으므로 wire
    변경도, 새로 발견된 버그도 없다. 기존 관례를 따르면 CHANGELOG 항목은 불필요하다.
  - 제안: 조치 불요 — 향후 이 검증자가 실제 §5.4 위반을 잡아내 DTO/코드를 고치는 후속 PR 이
    나오면 그때 CHANGELOG 항목을 남길 것.

- **[INFO]** `ContractViolation`/`ContractCheckOptions` 인터페이스 자체에는 최상위 JSDoc 이 없다
  (필드별 주석은 있음)
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts` — `ContractViolation`,
    `PropertyContract` 인터페이스 선언부
  - 상세: `ContractViolation`은 `readonly property/kind/detail` 세 필드에 개별 주석이 없고,
    인터페이스 자체 설명도 없다(바로 아래 `findContractViolations` 함수 JSDoc 이 반환값을
    설명하긴 하지만 타입 자체엔 없음). 파일 상단 대형 JSDoc 이 판정 규칙을 이미 표로 설명하고
    있어 실질적으로 자명하므로 영향은 경미하다.
  - 제안: 선택사항 — `/** 위반 1건 — findContractViolations 의 반환 원소 */` 한 줄 정도 추가하면
    타입만 보고 온 독자에게 더 친절해진다.

## 검증 결과 (문제 없음으로 확인 — 오탐 방지 기록)

- `response-contract.ts` JSDoc 의 "엔티티-DTO 불일치 59건 중 46건이 `Date`→`string`" 수치는
  `plan/in-progress/spec-draft-nullable-notation-followups.md:312,332` 의 실측 기록과 정확히 일치.
  "§5.4 미검증 DTO 78곳"도 같은 문서(68 패스스루 + `ExecutionDto` 10)와 일치 — 지어낸 근거가 아니다.
- `workflow-crud.e2e-spec.ts` 신규 주석 "이 컨트롤러는 엔티티를 그대로 반환하므로 DTO 선언을
  강제하는 것이 이 단언뿐이다"는 `workflows.controller.ts#findAll` 이 실제로 반환 타입
  애노테이션 없이 서비스 값을 그대로 리턴함을 직접 열어 확인 — 사실과 일치.
- `workflow-execution.e2e-spec.ts` 주석의 "`ExecutionDto` 의 22개 필드"는 실제 클래스 필드 수(22)와
  일치. `AuditLogDto`(8)·`SessionDto`(7)·`WorkflowDto`(10) required 필드 수도 plan 문서 표와
  실제 DTO 선언(옵셔널 필드 제외 카운트)이 모두 일치한다.
- `src/shared/testing/**` 는 이미 `tsconfig.build.json` exclude 에 디렉터리 단위로 등재돼 있어
  `response-contract.ts`(devDependency `@nestjs/swagger`/`@nestjs/common` 만 사용하지만 인접
  `swagger-probe.ts` 와 같은 디렉터리)가 `dist` 로 새어나갈 위험은 없다 — 별도 문서화 불필요.
- `response-contract.spec.ts` 의 `ProbeDto` 픽스처·"[전제]" 캐너리 테스트는 각 필드/축에 대해
  왜 필요한지(§5.4 네 축을 독립적으로 물기 위함)를 클래스·필드 단위 JSDoc 으로 잘 설명한다.
- `plan/in-progress/spec-conventions-engine-error-code-surface.md` 의 diff — 취소선 보존 +
  실측 날짜 병기 형식이 CLAUDE.md 의 "자기-반증형 소정정" 5조건 형식을 그대로 따른다(다만 이
  항목 자체는 developer 트랙 잔여 항목에 대한 **plan 메타 정리**이며 spec 본문 수정이 아니다).
  `review/consistency/2026/09/05/12_48_13/plan_coherence.md` WARNING #2 가 정확히 이 stale
  체크리스트를 지적했고, 같은 diff 안에서 이미 그 WARNING 이 해소됐다 — 리뷰 루프가 제대로
  닫힌 사례.

## 요약

이번 diff 의 핵심 신규 코드(`response-contract.ts`/`response-contract.spec.ts`)는 "왜 있나 / 왜
엔드포인트마다 개별 단언을 안 쓰나 / 판정 규칙"을 표와 함께 설명하는 대형 JSDoc 을 갖추고 있고,
인용하는 모든 수치(59건·46건·78곳·22/10/8/7 필드)를 직접 대조한 결과 전부 정확했다. e2e 4개
파일에 추가된 인라인 주석도 실제 컨트롤러 반환 타입 상태와 일치한다. 발견한 것은 모두 INFO
수준이며, 그중 가장 눈에 띄는 "spec `code:` glob 미등재" 갭은 이미 같은 diff 에 포함된 plan
문서가 스스로 지목하고 planner 트랙으로 정확히 위임해 두었다 — 이번 PR 범위에서 추가 조치가
필요한 문서화 결함은 없다.

## 위험도

NONE
