# 신규 식별자 충돌 검토

## 검토 범위 재확인

prompt 는 "구현 대상 영역: `spec/5-system/`" 전체를 번들했지만, 실제 diff(`git diff origin/main`)를
확인한 결과 이번 turn 의 실질 변경은 다음 3개뿐이다 (spec 변경 없음, `plan/in-progress/execute-body-openapi.md`
frontmatter `spec_impact: none` 과 일치):

- `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` (신규 파일) — `ExecuteWorkflowDto` 클래스
- `codebase/backend/src/modules/workflows/workflows.controller.ts` — `@ApiBody({ type: ExecuteWorkflowDto })` 데코레이터 1줄 추가 (import 포함)
- `plan/in-progress/execute-body-openapi.md` (신규 plan 문서)

`ExecuteWorkflowDto` 는 **OpenAPI 문서화 전용**이며 `@Body()` 파라미터 타입은 그대로 inline 유지 —
런타임 검증 경로·기존 필드(`parameterValues`, `input`)의 의미는 변경되지 않는다. 이 전제 위에서
신규로 "도입"되는 식별자는 (a) 클래스명 `ExecuteWorkflowDto`, (b) 파일 경로
`dto/execute-workflow.dto.ts` 뿐이고, `parameterValues`/`input` 필드 자체는 기존 런타임 계약을
문서화한 것일 뿐 신규 도입이 아니다.

## 발견사항

### INFO — `input` 필드명이 형제 DTO(`ExecuteNodeDto`)와 같은 이름·다른 형태로 동시에 문서 표면에 노출된다

- target 신규 식별자: `ExecuteWorkflowDto.input` (신규 `@ApiBody` 문서화 대상, `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:37`)
- 기존 사용처: `ExecuteNodeDto.input` (`codebase/backend/src/modules/workflows/dto/execute-node.dto.ts` — `POST /api/workflows/:id/nodes/:nodeId/execute`)
- 상세: 같은 `WorkflowsController`(같은 Swagger tag `workflows`) 안에서 형제 엔드포인트 두 곳이
  모두 top-level `input` 필드를 받지만 의미가 다르다 — `ExecuteWorkflowDto.input` 은 **레거시
  봉투**(`input.parameters` 를 읽음, `parameterValues` 미지정 시의 fallback)이고
  `ExecuteNodeDto.input` 은 **직접 값**(predecessor 미충족 포트의 override, 봉투 아님)이다.
  둘 다 Swagger 스키마 상 `type: Object` 로 느슨하게 타입되어 있어 스키마 레벨 충돌은 없지만,
  이번 변경으로 `input`(ExecuteWorkflowDto 쪽)이 **처음으로 OpenAPI 문서 표면에 공식 등재**되면서
  같은 컨트롤러의 두 엔드포인트 문서를 나란히 보는 API 소비자가 "같은 필드명 = 같은 형태"로
  오인할 여지가 생긴다. 이는 신규 도입이 아니라 **기존 런타임 필드의 최초 문서화**이며, 각 필드의
  `description` 이 이미 형태 차이를 명시하고 있어(레거시 봉투 vs 직접 값) 혼선 위험은 낮다.
- 제안: 별도 대응 불필요(현재 description 으로 충분히 방지됨). 추후 문서를 더 다듬을 계기가 있으면
  `ExecuteWorkflowDto.input` 의 description 앞에 "(ExecuteNodeDto.input 과 무관·형태 다름)" 같은
  상호 참조를 덧붙이는 정도가 선택적 개선안.

## 점검했으나 충돌 없음으로 확인된 항목

- **엔티티/타입명**: `ExecuteWorkflowDto` — 저장소 전체(`codebase/`, `spec/`, `plan/`) grep 결과
  이번에 추가된 파일과 `workflows.controller.ts` 의 import/사용처 외 다른 정의·참조 없음. 기존
  `WorkflowDto`(응답 DTO, `workflows.controller.ts:64` 등)와는 별개 식별자이며 접두사 규칙
  (`Create/Update/Import/Query/Execute` + `WorkflowDto`)에도 부합해 오히려 기존 명명 컨벤션과
  일관적이다.
- **API endpoint**: `POST /api/workflows/:id/execute` 는 기존에 이미 존재하던 엔드포인트다. 이번
  변경은 `@ApiBody` 문서화 1줄 추가일 뿐 신규 endpoint 도입이 아니므로 endpoint 충돌 대상 자체가 없다.
- **요구사항 ID**: 신규 spec ID 도입 없음 (`spec_impact: none`, spec 파일 diff 없음).
- **이벤트/메시지명**: webhook·queue·SSE 이벤트 신설 없음.
- **환경변수·설정키**: 신규 ENV/config key 없음.
- **파일 경로**: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` 는 같은
  디렉터리의 `execute-node.dto.ts`/`create-workflow.dto.ts`/`update-workflow.dto.ts` 와 동일한
  `<verb>-<entity>.dto.ts` kebab-case 컨벤션을 따르며 기존 파일과 경로 충돌 없음(신규 파일).
- **`parameterValues` 필드명**: `schedules` 모듈(`ScheduleEntity.parameterValues`,
  `CreateScheduleDto`/`UpdateScheduleDto`/`ScheduleResponseDto`)·`workflows.controller.ts` 기존
  inline 타입·frontend(`lib/api/workflows.ts`, `lib/api/schedules.ts`, `schedules/page.tsx`,
  `triggers.mdx`)에 걸쳐 이미 "Manual Trigger 파라미터 값"이라는 동일한 의미로 광범위하게 쓰이고
  있다. 이번 DTO 는 그 기존 의미를 그대로 문서화한 것으로 의미 충돌 없음.

## 요약

이번 turn 의 실질 변경은 `spec/5-system/` 어느 파일도 건드리지 않는 순수 코드 diff
(신규 `ExecuteWorkflowDto` OpenAPI-only DTO 1개 + `@ApiBody` 데코레이터 1줄)이며, 새로 도입되는
식별자는 클래스명 `ExecuteWorkflowDto` 와 그 파일 경로뿐이다. 두 식별자 모두 저장소 전체 grep 기준
기존 사용처와 충돌하지 않고, 기존 DTO 명명 컨벤션(`<Verb>WorkflowDto`)·파일 경로 컨벤션과도 일치한다.
DTO 가 문서화하는 `parameterValues`/`input` 필드는 이미 런타임에 존재하던 필드를 그대로 옮긴 것이라
신규 도입으로 볼 수 없으며, 유일한 관찰점은 형제 엔드포인트(`ExecuteNodeDto`)와 `input` 이라는 필드명을
공유하되 의미가 다르다는 점인데 이는 기존부터 존재하던 상태이고 description 으로 이미 구분되어 있어
INFO 수준에 그친다. Critical/Warning 급 신규 식별자 충돌은 발견되지 않았다.

## 위험도

NONE
