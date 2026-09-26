# Rationale 연속성 검토 — `export-workflow-typed` (`spec/2-navigation/` scope, --impl-prep)

## 검토 대상

- 구현 계획: `plan/in-progress/export-workflow-typed.md` — `ExportWorkflowDto.nodes`/`.edges` 를
  타입 없는 `Record<string, unknown>[]` 대신 응답 전용 `ExportedNodeDto`/`ExportedEdgeDto` 로 광고.
- 소유 spec: `spec/2-navigation/1-workflow-list.md` §3.2 Export/Import JSON 포맷 (frontmatter `code:` 가
  `modules/workflows/dto/**` 를 문다).
- 대조한 과거 결정: 같은 문서 `## Rationale` §1~§4, `spec/5-system/2-api-convention.md` §5.4(부재 표현),
  `spec/conventions/swagger.md` §1-4/§5-1, 직전 PR `canvas-save-typed`(4691166fb, `CanvasSaveResultDto`).

## 발견사항

- **[INFO]** `ExportedNodeDto`/`ExportedEdgeDto` 가 index-기반 계약이라는 사실을 코드 주석에도 명시 제안
  - target 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts` (plan 방향 1 이 만들
    자리, `ExportWorkflowDto` 바로 위/옆)
  - 과거 결정 출처: `spec/2-navigation/1-workflow-list.md` §3.2 — "노드 간 참조는 UUID 가 아니라 `nodes[]`
    배열 index 기반이다"; 같은 파일 바로 위 `CanvasSaveResultDto` 의 기존 주석("원소를 타입 없는 객체로 두면
    응답 계약 검증자가 그 안으로 내려가지 않는다")
  - 상세: `CanvasSaveResultDto.nodes`/`.edges` 는 `NodeDto`/`EdgeDto` 를 **그대로 재사용**한다(엔티티 1:1, 실제
    UUID `id`/`workflowId` 포함) — 직전 PR 이 그렇게 광고를 바꿨다. 이번 plan 은 같은 파일 안에 `ExportedNodeDto`/
    `ExportedEdgeDto` 를 **별도로** 신설해 `NodeDto`/`EdgeDto` 를 재사용하지 않는다(§3.2 의 index-기반 참조와
    UUID 기반 `NodeDto.id` 가 양립할 수 없으므로 이 구분은 옳다 — 재도입·번복이 아니라 기존 §3.2 Rationale 을
    올바르게 지키는 방향이다). 다만 같은 파일에 "엔티티를 그대로 감싼 DTO"(`CanvasSaveResultDto`)와 "손으로 조립한
    index-정규화 DTO"(`ExportWorkflowDto`)가 나란히 있고 둘 다 `nodes`/`edges` 필드명을 공유하므로, 다음 사람이
    "일관성"을 이유로 `ExportedNodeDto`/`EdgeDto` 를 `NodeDto`/`EdgeDto` 로 되돌리는(즉 UUID 참조를 export JSON 에
    끌어들이는) 실수를 할 표면이 있다. 이는 아직 일어나지 않은 위험이며 현재 plan 이 저지르는 위반은 아니다.
  - 제안: plan 방향 1 구현 시 `ExportedNodeDto`/`ExportedEdgeDto` 선언 위에 "이 DTO 는 `NodeDto`/`EdgeDto` 와
    달리 UUID 를 싣지 않는다 — §3.2 의 index-기반 참조 계약(사용자 hand-edit 가능한 이식 가능 JSON)을 유지하기
    위함이며, `CanvasSaveResultDto` 패턴(엔티티 1:1 재사용)을 따르지 않는 것이 의도다" 한 줄을 남기면, 이후
    "왜 여기만 다른 DTO 를 새로 만들었나"를 다시 조사할 필요가 없어진다.

- **[INFO]** `formatVersion` 필드 갭은 이번 PR 범위 밖이며 target 이 그 사실을 스스로 명시함 — 재확인만
  - target 위치: `plan/in-progress/export-workflow-typed.md` "실측" 항목 6번째 줄
  - 과거 결정 출처: `spec/2-navigation/1-workflow-list.md` §3.2 — "⚠️ Swagger 응답 DTO(`ExportWorkflowDto`)는
    `formatVersion` 필드를 선언하지만, 현재 export 구현은 이 필드를 emit 하지 않는다 — 포맷 버전 협상은
    미구현(Planned)."
  - 상세: `formatVersion: number`(non-nullable, required 선언)가 실제로는 응답에 전혀 실리지 않는 상태가
    이미 spec 에 알려진 갭으로 남아 있고, e2e 는 `allowMissing: ['formatVersion']` 로 우회 중이다. 이는
    "문서화된 보장이 구현보다 넓다"는 유형의 결함이지만 **이번 plan 이 새로 만든 것이 아니고, 건드리지도
    않는다**는 사실을 plan 문서가 스스로 적었다 — 결정의 무근거 번복이 아니라 스코프 경계를 명시적으로
    선언한 것이다.
  - 제안: 조치 불필요. 이번 PR 의 스코프에 포함되지 않음을 재확인. 별도 트래커
    (`plan/in-progress/spec-draft-nullable-notation-followups.md`)가 이미 추적 중이므로 중복 항목을 만들지 말 것.

## 대조 확인 (문제 없음으로 판정한 항목)

- **§5.4(api-convention) 부재 표현 규칙과의 정합**: plan 은 `description`/`containerIndex`/`toolOwnerIndex`/
  `condition` 을 "상시 존재 키 + `null` 가능"(`@ApiProperty({ nullable: true })`) 으로 선언하겠다고 명시했다.
  이는 §5.4 의 기본값 규칙("`null` = 기본, 키 생략은 (a)/(b) 사유가 있을 때만")과 정확히 일치하며, `ImportNodeDto`/
  `ImportEdgeDto`(같은 필드를 `@ApiPropertyOptional()` + optional 로, `nullable` 없이 선언)를 그대로 재사용하지
  않기로 한 이유("응답에서는 항상 실리는데 요청 쪽은 optional" · "요청 쪽 `description`/`condition` 은 `nullable`
  선언이 없어 재사용하면 §5.4 위반")도 실측(`import-workflow.dto.ts` 직접 대조)으로 검증됨 — 선언 그대로 확인.
- **swagger §5-1 응답 DTO 명명 유일성**: 신설 클래스명 `ExportedNodeDto`/`ExportedEdgeDto` 는 저장소 전체에
  기존 동명 클래스가 없음을 직접 grep 으로 확인(`class ExportedNodeDto`/`ExportedEdgeDto` 0건). 프런트엔드의
  `ExportedNode`/`ExportedEdge`(이미 존재하는 타입) 와 이름 계열이 맞아 §5-1 "형제 DTO 는 이름을 다르게" 선례와도
  충돌하지 않는다.
  - swagger §5-1 이 요구하는 "같은 개념을 층별로 나눠 선언할 때는 이름을 다르게" 원칙도 이번 결정(응답 전용
    DTO 신설, 요청 DTO 미재사용)과 정확히 같은 방향이다 — `TriggerWorkflowRefDto` vs `ScheduleTriggerWorkflowRefDto`
    선례와 동일한 판단.
- **swagger §1-4 닫힌 union / 열린 map 규칙과의 정합**: plan 이 `type` 필드를 enum 이 아닌 `string` 으로
  선언하려는 결정("과거 저장된 값이 현재 허용 노드 타입 화이트리스트 밖일 수 있다")은 §1-4 의 "닫힌 union"/
  "열린 map" 규칙이 다루는 대상(가변 구조 필드)이 아니라 단순 scalar 필드이며, 기존 `NodeDto.type: string`
  선언과 완전히 동일한 기존 패턴을 그대로 따른다 — 신규 위반도 재도입도 아니다. `config`/`condition` 을 "열린
  맵"으로 유지하는 것도 §1-4 의 "실제로 키가 열려 있는 경우" 요건 그대로다.
- **1-workflow-list.md 자체 Rationale 4개 항목**(공유 워크플로우 정의 · import permissive config 정책 ·
  폴더 계층 무결성 · 태그 필터 단일화)과는 주제가 겹치지 않는다 — 이번 변경은 §3.2 export 응답의 **선언
  형태**만 바꾸고 §2/§4 API 의 필터·권한·계층 로직에는 손대지 않는다.
- **`spec_impact: none` 판단**: §3.2 는 export 의 키 목록·SoT(`ExportWorkflowDto`)만 서술하고 원소 타입까지는
  약속하지 않으므로, 원소 DTO 신설이 spec 서술과 충돌하지 않는다는 plan 의 판단은 실제 §3.2 본문과 대조해도
  맞다.

## 요약

이번 `export-workflow-typed` 계획은 직전 PR(`canvas-save-typed`)이 트래커에 남긴 후속 항목을 닫는 작업으로,
요청 DTO(`ImportNodeDto`/`ImportEdgeDto`) 재사용 여부를 실측으로 검토한 뒤 "응답 전용 DTO 신설"을 택했다.
이 선택은 `spec/2-navigation/1-workflow-list.md` §3.2 가 명시한 "index-기반 참조(UUID 아님)" 설계를 정확히
보존하며, `CanvasSaveResultDto`(엔티티 재사용, UUID 포함)와는 계약 성격이 근본적으로 달라 다른 DTO 를 신설한
것은 재도입이나 원칙 위반이 아니라 오히려 §3.2 Rationale 을 지키는 필연적 선택이다. `api-convention §5.4`
부재-표현 규칙, `swagger.md §1-4/§5-1` 명명·타입 규칙과도 실측 대조 결과 정합하며, 기존에 알려진
`formatVersion` 갭은 이번 PR 범위 밖임을 plan 문서가 스스로 명시했다. 유일한 제안 사항은 향후 "일관성"을
이유로 `ExportedNodeDto`/`EdgeDto` 를 `NodeDto`/`EdgeDto` 로 되돌리는 실수를 막기 위한 방어적 코드 주석
추가(INFO)이며, CRITICAL/WARNING 급 Rationale 연속성 위반은 발견되지 않았다.

## 위험도

NONE
