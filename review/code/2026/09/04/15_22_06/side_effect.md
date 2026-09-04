# 부작용(Side Effect) 리뷰 — 응답 DTO 15필드 `required` false→true (1단계) + 부속 review/consistency 산출물 커밋

## 검토 범위 확인

diff 는 실질적으로 두 그룹이다.

1. **코드 변경 5건**: `CHANGELOG.md`, `codebase/backend/.../execution-response.dto.ts`(`ExecutionDto` 10필드),
   `codebase/backend/.../execution-status-response.dto.ts`(`ExecutionStatusDto` 5필드),
   `codebase/backend/.../execution-status-response.dto.spec.ts`(신규 `required` 단언 테스트),
   `plan/in-progress/spec-draft-nullable-notation-followups.md`(체크리스트 갱신).
   컨트롤러·서비스·엔티티 등 런타임 로직 파일은 diff 에 **직접 포함되지 않았다**(데코레이터·타입
   선언 레이어에만 국한).
2. **이전 리뷰 세션 산출물 커밋 19건**: `review/code/2026/09/04/14_54_36/**`(직전 side-effect 라운드가
   83필드 버전을 검토한 기록 + RESOLUTION/SUMMARY)와 `review/consistency/2026/09/04/15_16_28/**`.
   이는 프로젝트 관례(`review/**` 는 git-tracked 산출물)에 따른 정상적인 파일시스템 추가이고, 이번
   리뷰 대상 diff 가 만든 새로운 부작용이 아니다 — 조치 불요로 확인.

패턴은 소스 파일 전 필드에서 동일: `@ApiPropertyOptional({ nullable: true }) field?: T | null` →
`@ApiProperty({ nullable: true }) field: T | null`. `nullable: true` 는 보존되고 `required` 축만
뒤집혔다.

## 발견사항

- **[WARNING]** `ExecutionDto`/`ExecutionDetailDto` 의 "required 전환은 `tsc` 가 검증했다"는 전제가
  4개 노출 경로 중 **1개에만** 실제로 성립한다 — 나머지 3개(`stop`/`getChain`/`findById`+`reRun`)는
  DTO 타입이 아니라 엔티티 파생 타입(`ResponseExecution`)을 거친다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `toExecutionDto`
    (977~1004번째 줄, 반환 타입 `: ExecutionDto` 명시, 리스트 경로 `findByWorkflow` 전용) vs
    `toResponseExecution`(1070번째 줄, 반환 타입 `: ResponseExecution`) · `getChain`(595~627번째 줄,
    `Promise<ResponseExecution[]>`) · `stop`(881번째 줄, `Promise<ResponseExecution>`) · `reRun`
    (396~406번째 줄, `Promise<ExecutionDetailWithTrigger & {...}>`). `ResponseExecution`/
    `ExecutionDetailWithTrigger` 는 모두 `Omit<Execution, 'trigger'|'executor'>` 파생 타입(95번째 줄
    부근 정의)이지 `ExecutionDto`/`ExecutionDetailDto` 가 아니다.
    대응 컨트롤러 데코레이터: `codebase/backend/src/modules/executions/executions.controller.ts`
    — `stop()`(130번째 줄 `@ApiOkWrappedResponse(ExecutionDto,...)`), `getChain()`(300번째 줄
    `@ApiOkWrappedArrayResponse(ExecutionDto,...)`), `findById()`(70번째 줄
    `@ApiOkWrappedResponse(ExecutionDetailDto,...)`), `reRun()`(270번째 줄
    `@ApiCreatedWrappedResponse(ExecutionDetailDto,...)`).
  - 상세: 이번 diff(및 그 근거 문서인 `plan/in-progress/spec-draft-nullable-notation-followups.md`,
    `review/code/.../14_54_36/RESOLUTION.md`)는 "83곳 중 `tsc` 가 실제로 도달한(=DTO 타입 대입
    지점이 있는) 15곳만 남겼다"고 주장하고, 그 도달성 판정 기준은 "DTO-typed 대입 지점의 존재"다.
    `ExecutionDto` 는 이 기준을 만족하는 대입 지점이 하나 있다(`toExecutionDto`, 리스트 응답 전용) —
    그래서 10필드가 "검증됨"으로 분류됐다. 그러나 같은 `ExecutionDto`/`ExecutionDetailDto` 클래스는
    Swagger 데코레이터를 통해 **다른 세 엔드포인트**(`stop`/`getChain`/`findById`/`reRun`)의 응답
    스키마로도 선언되는데, 그 세 경로는 전부 `toResponseExecution` 또는 `ExecutionDetailWithTrigger`
    조립을 거치며 이들은 `ResponseExecution = Omit<Execution,...>` 타입, 즉 **엔티티 자신의 타입을
    그대로(Omit 만 적용) 되비추는 타입**으로 체크된다 — `rest` 스프레드가 `ResponseExecution` 을
    만족하는지 검사하는 것은 사실상 항등 검사이고, `ExecutionDto` 의 `required`/`nullable` 선언과는
    **구조적으로 무관**하다. 즉 "15곳은 tsc 가 검증했다"는 문장은 `ExecutionStatusDto` 5필드(단일
    노출 경로, `interaction.service.ts` `getStatus(): Promise<ExecutionStatusDto>` 하나뿐이라 정확)
    에는 완전히 성립하지만, `ExecutionDto` 10필드에는 **4경로 중 1경로에서만** 성립한다. 이는
    testing 리뷰어가 이미 지적한 "엔티티 패스스루 컨트롤러(alerts/folders/edges)는 DTO-typed 대입
    지점이 아예 없다"는 결함과 **같은 클래스**이지만, 그 리뷰가 짚지 않은 **새 사례**다 — 여기서는
    DTO 자체는 대입 지점을 하나 갖고 있어 "reachable" 로 분류됐지만, 그 대입 지점이 해당 DTO 의
    **모든** 노출 표면을 대표하지 않는다.
    실측: `executionRepository` 쿼리 중 `stop`/`getChain`/`findById`/`reRun` 경로에 partial
    `.select()` 사용은 없음을 확인(grep 0건) — 그래서 **오늘 시점 런타임 동작은 문제 없다**(엔티티
    컬럼이 항상 전체 로드되므로 10필드는 실제로 항상 채워진다). 다만 그 사실은 tsc 가 아니라
    "엔티티 쿼리가 우연히 partial select 를 안 쓴다"는 관측에 의존하며, 이는 정확히 이번 PR 이
    다른 68필드에 대해 "검증 없이는 `required: true` 를 주장할 수 없다" 고 판단했던 그 근거다.
  - 제안: `toResponseExecution`/`ExecutionDetailWithTrigger` 를 반환하는 경로들의 반환 타입을
    명시적으로 `ExecutionDto`/`ExecutionDetailDto` 로 좁히거나(구조 불일치 시 tsc 가 즉시 검출),
    최소한 이 갭을 후속 항목으로 기록해 향후 `executions` 조회 경로에 partial select 가 도입될 때
    회귀를 잡을 안전망을 남길 것을 권장. 이번 diff 를 막을 사안은 아니다(런타임 동작 불변, 오늘
    시점 필드는 실측상 항상 존재) — testing WARNING #1/#2 와 같은 처리(후속 티켓)가 적절해 보인다.

- **[INFO]** 공개 인터페이스 변경 — OpenAPI `required` 15필드 false→true, blast radius 는 백엔드
  내부로 국한
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`
    (19~20·42~43·46~47·57~62·72~77·88~93·96~97·100~101·112~113·116~117번째 줄, 10필드),
    `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts`
    (122~130·133~138·147~156·159~165·168~174번째 줄, 5필드)
  - 상세: `codebase/frontend`/`codebase/packages` 어디에도 이 DTO 클래스를 직접 import 하는 코드가
    없음을 확인(grep 0건) — 시그니처 협소화의 영향 범위는 백엔드 패키지 내부와 OpenAPI 로 타입을
    생성하는 외부 소비자로 한정된다. `CHANGELOG.md`(3~15번째 줄)에 영향 범위가 명시적으로 고지돼
    있다.
  - 제안: 조치 불요 — 고지·검증됨.

- **[INFO]** `ExecutionStatusDto` 5필드는 단일 노출 경로만 존재해 위 WARNING 이 적용되지 않는다 —
  전제가 정확히 성립하는 사례
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `getStatus()`
    (331번째 줄, 반환 타입 `Promise<ExecutionStatusDto>` 명시) — `codebase/backend/src/modules/external-interaction/interaction.controller.ts`
    (185번째 줄, 컨트롤러 메서드도 `Promise<ExecutionStatusDto>` 명시)
  - 상세: `ExecutionStatusDto` 를 반환 타입으로 쓰는 서비스/컨트롤러 메서드는 이 하나뿐임을 grep 으로
    확인(`.spec.ts` 제외 전수 검색). `tsc` 가 이 5필드의 `required` 전환을 실제로 전부 검사했다는
    주장은 여기서는 정확하다.
  - 제안: 없음 — 정상.

## 점검했으나 문제 없음으로 확인된 항목

- 전역 변수 도입/수정: 없음(순수 클래스 필드 선언·데코레이터 인자 변경 + 테스트 `it.each` 확장).
- 시그니처 변경(함수/메서드): DTO 클래스 필드는 함수 시그니처가 아니라 데이터 계약이며, 이 diff 가
  건드린 파일 안에서 함수/메서드 파라미터·반환 타입 변경은 없음.
- 환경 변수: 읽기/쓰기 없음.
- 네트워크 호출: 없음.
- 이벤트/콜백: 없음 — 런타임 흐름·이벤트 발행 지점 불변.
- `review/code/14_54_36/**`·`review/consistency/15_16_28/**` 신규 파일 19건은 프로젝트 관례상
  git-tracked 산출물이며, 이 리뷰 세션이 이 diff 를 만든 원인이 아님(선행 세션의 산출물을 이번
  커밋에 포함한 것) — 예상치 못한 파일시스템 부작용 아님.
- `NodeExecutionSummaryDto`(같은 파일, `execution-response.dto.ts` 137~213번째 줄)는 이번 배치에서
  의도적으로 건드리지 않았고 여전히 `@ApiPropertyOptional`+optional 패턴을 유지 — plan 문서 "2단계"
  항목에 이미 등재된 범위 밖이며 회귀 아님.

## 검증 방법

Bash(`grep`/`sed -n`)와 Read 로 저장소를 읽기 전용으로 조회했다. 저장소 트리에는 아무것도 쓰지
않았다(뮤테이션 없음) — `git status --short` 로 확인, 이 세션 산출물 디렉터리(`review/code/2026/09/04/15_22_06/`)
외 변경 없음.

## 요약

diff 자체는 컨트롤러·서비스·엔티티를 건드리지 않는 순수 Swagger 데코레이터/TS 옵셔널 마커 정합화이며,
런타임 wire·전역 상태·파일시스템·환경변수·네트워크·이벤트 부작용은 없다. 다만 이번 배치가 스스로 내세운
"15곳은 tsc 가 실제로 검증했다"는 근거를 `ExecutionDto` 소유 엔드포인트 4개에 대해 직접 대조한 결과,
검증이 성립하는 것은 리스트 경로(`toExecutionDto`) 1개뿐이고 `stop`/`getChain`/`findById`/`reRun` 3개는
엔티티 파생 타입(`ResponseExecution`/`ExecutionDetailWithTrigger`)을 거쳐 `ExecutionDto` 의 `required`
선언과 구조적으로 연결되지 않는다 — 오늘 시점 런타임은 정확하지만(partial select 없음, 실측 확인), 이는
바로 이 PR 이 다른 68필드에 대해 "검증 없이는 주장할 수 없다"고 판단한 것과 같은 근거 공백이다. 이
발견은 이번 diff 를 막을 CRITICAL 은 아니며(런타임 불변, 필드는 실측상 항상 존재), 이미 나온 testing
WARNING 들과 같은 성격의 후속 조치 대상으로 권고한다.

## 위험도

LOW — CRITICAL 없음. WARNING 1건은 검증 방법론의 사각지대(이 PR 이 만든 새 버그가 아니라, 이 PR 이
스스로 내세운 검증 주장의 범위가 실제보다 좁다는 지적)이며 런타임 동작·기존 계약에는 영향이 없다.
