# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 확인

`_prompts/naming_collision.md` 에 번들된 spec/5-system/ 페이로드에는 실제 diff(`<git diff origin/main...HEAD -- code_areas>`)가 컨텍스트 예산 초과로 누락돼 있었다. 프롬프트 지시에 따라 원문을 신뢰하지 않고 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/execute-body-dto-c37965`)에서 `git diff origin/main...HEAD` 를 직접 재확인했다.

**실제 변경 범위**: `spec/` 파일은 이번 diff 에서 **전혀 변경되지 않았다**(`plan/complete/execute-body-openapi.md` frontmatter 도 `spec_impact: none`). 변경은 순수 코드 3개 파일 — `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts`(신규) · `codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts`(신규 테스트) · `codebase/backend/src/modules/workflows/workflows.controller.ts`(6줄 추가: `@ApiBody` 배선) — 로, 기존 `POST /api/workflows/:id/execute` 엔드포인트(method+path 불변)에 OpenAPI 문서만 추가한 것이다. 따라서 신규 식별자 충돌 검토는 이 코드 changeset 이 도입하는 식별자(`ExecuteWorkflowDto` 클래스, `parameterValues`/`input` 필드)를 대상으로 한다.

## 관점별 확인

1. **요구사항 ID 충돌** — 신규 요구사항 ID 부여 없음(spec 미변경). 해당 없음.
2. **엔티티/타입명 충돌** — `ExecuteWorkflowDto` 는 코드베이스 전체(`codebase/`, `spec/`)에서 이번 신설 파일 외 참조가 없다(grep 확인). 기존 타입명과 충돌 없음. 다만 하위 필드 `input` 이 같은 컨트롤러의 형제 DTO 와 이름이 겹친다 — 아래 발견사항 참조.
3. **API endpoint 충돌** — 신규 endpoint 없음. `POST /workflows/:id/execute` 는 기존 엔드포인트이며 이번 변경은 `@ApiBody` 데코레이터 추가뿐.
4. **이벤트/메시지명 충돌** — 신규 webhook/queue/SSE 이벤트 없음. 해당 없음.
5. **환경변수·설정키 충돌** — 신규 ENV/config key 없음. 해당 없음.
6. **파일 경로 충돌** — `dto/execute-workflow.dto.ts` 는 형제 `dto/execute-node.dto.ts` 와 동일한 kebab-case + `.dto.ts` 컨벤션을 따르며 기존 파일과 겹치지 않는다. 기존 명명 컨벤션 위반 없음.

## 발견사항

- **[WARNING]** `ExecuteWorkflowDto.input` 필드명이 형제 DTO `ExecuteNodeDto.input` 과 이름은 같지만 형태(shape)가 다르고, 이번 PR 로 처음 OpenAPI 문서 표면에 동시 노출됐다.
  - target 신규 식별자: `ExecuteWorkflowDto.input?: Record<string, unknown>` (`codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:58`, `POST /api/workflows/:id/execute` 의 `@ApiBody`)
  - 기존 사용처: `ExecuteNodeDto.input?: Record<string, unknown>` (`codebase/backend/src/modules/workflows/dto/execute-node.dto.ts:31`, 같은 `WorkflowsController` 의 `POST /api/workflows/:id/nodes/:nodeId/execute`)
  - 상세: 두 필드 모두 TypeScript 타입은 동일(`Record<string, unknown>`)하지만 의미가 다르다 — `ExecuteNodeDto.input` 은 단일 노드 실행의 수동 입력값 **그 자체**(predecessor 미시딩 포트의 override)인 반면, `ExecuteWorkflowDto.input` 은 "레거시 봉투"로 안에 `.parameters` 키가 있어야 실제 파라미터가 추출된다(컨트롤러 `body?.input.parameters`). 같은 컨트롤러·같은 Swagger 태그(workflows) 아래 인접한 두 endpoint 에서 필드명이 겹치므로, description 전문을 읽지 않고 Swagger UI 를 스캔하는 API 소비자는 두 `input` 이 같은 shape 라고 오인할 수 있다. 다만 개발자가 DTO docstring 에서 `{@link ExecuteNodeDto.input}` 을 명시적으로 인용해 "이름만 같고 형태가 다르다"고 이미 대조·문서화했고(`execute-workflow.dto.ts:44-47`), OpenAPI `description` 에도 "레거시 봉투" 문구를 명시했으므로 완전한 미인지 상태는 아니다. 이번 PR 이전에는 `execute()` 에 `@ApiBody` 자체가 없어 Swagger 문서에 이 필드가 노출되지 않았으므로, 이 충돌 표면이 관측 가능해진 것은 이번이 처음이다.
  - 제안: 현행 docstring/description 교차 링크로 최소한의 완화는 돼 있어 즉시 변경을 요구할 정도는 아니나, 여지가 있다면 `ExecuteWorkflowDto` 쪽 필드명을 `legacyInput` 처럼 구분되게 리네이밍하거나(런타임 계약 변경 없이 DTO 필드명만 바꾸는 것은 가능 — `@ApiBody` 전용이라 실제 파싱은 컨트롤러의 인라인 타입이 담당), 최소한 두 endpoint 의 `@ApiOperation`/`description` 상단에 상호 참조 배너를 유지한다.

- **[INFO]** `ExecuteWorkflowDto` 라는 클래스명이 프로젝트 관례(`spec/conventions/swagger.md` §1: "DTO 파일(`*.dto.ts`)에서 class-validator 데코레이터 → `@ApiProperty` 자동 생성")가 암시하는 "검증되는 요청 DTO" 기대와 어긋난다 — 이 클래스는 의도적으로 class-validator 데코레이터가 전혀 없는 **OpenAPI 스키마 전용** 클래스다(docstring 에 사유 명시). 이 관점은 이미 같은 changeset 의 코드 리뷰(`review/code/2026/08/23/00_24_55/architecture.md`)에서 INFO 로 지적·기록됐으므로 중복 차단 조치는 불필요하며 여기서는 교차 확인만 한다.

## 요약

이번 changeset 은 `spec/` 문서를 전혀 변경하지 않고, 기존 `POST /api/workflows/:id/execute` 엔드포인트에 OpenAPI 문서(신규 `ExecuteWorkflowDto` 클래스 + `@ApiBody`)만 추가하는 순수 코드 변경이다. 신규 요구사항 ID·API endpoint·이벤트명·ENV/설정키·spec 파일 경로 충돌은 전혀 없으며, 유일한 주목할 지점은 신설 `ExecuteWorkflowDto.input` 필드가 같은 컨트롤러의 형제 `ExecuteNodeDto.input` 과 이름은 같고 형태가 다른 채로 처음 Swagger 문서 표면에 나란히 노출된다는 점이다 — 개발자가 docstring/description 에 이미 상호 참조로 명시해 상당 부분 완화돼 있어 WARNING 수준으로 판단한다. 그 외 CRITICAL 급 식별자 충돌은 발견되지 않았다.

## 위험도

LOW
