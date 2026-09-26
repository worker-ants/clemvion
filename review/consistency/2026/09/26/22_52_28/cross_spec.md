# Cross-Spec 일관성 검토 — `export-workflow-typed` (impl-prep, scope=spec/2-navigation/)

## 검토 대상 요약

`plan/in-progress/export-workflow-typed.md` — `GET /api/workflows/:id/export` 응답의
`nodes`/`edges` 를 타입 없는 `Record<string, unknown>[]` 대신 신규 응답 전용 DTO
(`ExportedNodeDto`(10키) · `ExportedEdgeDto`(6키))로 광고한다. `spec_impact: none` (spec 텍스트
변경 없음 — `spec/2-navigation/1-workflow-list.md` §3.2 는 원소 타입을 서술하지 않으므로 그대로
유효하다는 판단). 대상 코드: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts`.

아래는 이 결정이 `spec/**` 의 다른 영역(데이터 모델·API 규약·data-flow·swagger 관례)과
모순되는지를 6개 관점으로 대조한 결과다. 실측: `workflow-response.dto.ts` (`ExportWorkflowDto` 현재
선언) · `import-workflow.dto.ts` (`ImportNodeDto`/`ImportEdgeDto`) · `node-response.dto.ts` ·
`edge-response.dto.ts` · `spec/1-data-model.md` §2.6/§2.7 (Node/Edge) · `spec/data-flow/11-workflow.md`
§1.5 · `spec/5-system/2-api-convention.md` §5.4 · `spec/conventions/swagger.md` §1-4/§1-7/§5-1.

## 발견사항

특이사항(CRITICAL/WARNING)은 발견되지 않았다. 참고용 INFO 두 건만 기록한다.

- **[INFO]** `ExportedNodeDto.description`/`ExportedEdgeDto.condition` 의 표현 형태가 형제 DTO 와 다르다
  - target 위치: plan §방향-1 (`description`·`containerIndex`·`toolOwnerIndex`·`condition` 을
    `@ApiProperty({ nullable: true })` + 항상-required 로 선언한다는 결정)
  - 충돌 대상: `codebase/backend/src/modules/nodes/dto/responses/node-response.dto.ts` 의
    `NodeDto.description`(`@ApiPropertyOptional({ nullable: true })` + `description?: string | null`)과
    `edge-response.dto.ts` 의 `EdgeDto.condition`(같은 optional+nullable 조합)
  - 상세: `spec/5-system/2-api-convention.md` §5.4 는 "상시 존재 + null 가능" 필드는
    `@ApiProperty({ nullable: true })`(옵셔널 아님)를, "키 생략" 필드는 `@ApiPropertyOptional()` +
    `| null` 금지를 요구한다 — 두 표현을 섞는 `@ApiPropertyOptional({ nullable: true })` 는 §5.4 기준
    양쪽 다 틀린 조합이라고 그 절 자신이 명시한다. 그런데 기존 `NodeDto`/`EdgeDto` 는 정확히 그
    혼합형을 쓰고 있고, 이번 plan 은 (§5.4 를 정확히 따라) 같은 원본 컬럼(`Node.description`,
    `Edge.condition` — 둘 다 항상 SELECT 되는 nullable 컬럼)에 대해 신규 `ExportedNodeDto`/
    `ExportedEdgeDto` 에서는 **다른 표현**(순수 required+nullable)을 쓴다. 즉 같은 컬럼이 응답 표면
    (canvas 저장 vs export)에 따라 다른 OpenAPI 계약 모양으로 광고된다.
  - 이것이 이번 plan 이 만드는 결함은 아니다 — `NodeDto`/`EdgeDto` 는 기존 코드이고, 이번 plan 이
    §5.4 를 정확히 따르는 쪽이다. 다만 cross-spec 관점에서 "같은 데이터 모델 필드가 영역별로 다른
    계약 형태로 광고된다"는 사실 자체는 기록해 둘 가치가 있다 — 다음에 `NodeDto`/`EdgeDto` 를 만질
    때 §5.4 미준수를 고치는 후속 트랙의 근거가 된다.
  - 제안: target 문서·plan 수정 불필요(이번 PR 스코프 밖). `NodeDto.description`/`EdgeDto.condition`
    의 §5.4 비준수는 별도 백로그 항목으로 남기는 정도면 충분.

- **[INFO]** 프런트엔드 `ExportedNode.description?: string` 이 신규 백엔드 계약과 형태가 어긋난다
  - target 위치: plan `## 관찰 (이 PR 밖)` 절 (이미 자체적으로 명시)
  - 충돌 대상: `codebase/frontend/src/lib/api/workflows.ts` 의 `ExportedNode.description?: string`
    (nullable 미반영)
  - 상세: 신규 `ExportedNodeDto.description` 은 `string | null` (상시 존재)로 광고되지만 프런트엔드
    타입은 optional-only 다. plan 은 이를 "소비처가 falsy 로만 다뤄 동작 결함은 아니다"로 이미
    스코프 밖 처리했다 — cross-spec 관점에서도 이 판단에 동의한다(FE/BE 계약 불일치이지 spec 간
    모순은 아니다).
  - 제안: 현행 유지. plan 이 이미 기록했으므로 추가 조치 불필요.

## 대조 상세 (충돌 없음 확인)

- **데이터 모델**: `ExportedNodeDto` 10키(`type`/`category`/`label`/`positionX`/`positionY`/`config`/
  `isDisabled`/`description`/`containerIndex`/`toolOwnerIndex`) · `ExportedEdgeDto` 6키
  (`sourceNodeIndex`/`sourcePort`/`targetNodeIndex`/`targetPort`/`type`/`condition`)는
  `spec/1-data-model.md` §2.6 Node · §2.7 Edge 컬럼과 이름·nullable 여부가 모두 일치한다
  (`container_id`/`tool_owner_id` → UUID 대신 index 로 치환하는 것은 §2.6 이 아니라
  `spec/2-navigation/1-workflow-list.md` §3.2 + `spec/data-flow/11-workflow.md` §1.5 가 이미
  export 전용 규칙으로 정의해 둔 기존 결정이며, 이번 plan 이 새로 만드는 것이 아니다).
- **API 계약**: `spec/data-flow/11-workflow.md` §1.5 (export 는 "UUID 대신 nodes 배열 인덱스로 치환")와
  일치. `node.type` 을 enum 이 아닌 `string` 으로, `edge.type` 을 `EdgeType` enum 으로 표기하겠다는
  plan 의 결정은 기존 `NodeDto.type: string` / `EdgeDto.type: EdgeType` 표기와 정확히 같은 패턴이라
  신규 불일치가 아니다.
  `ExportWorkflowDto` 클래스명(`ExportedNodeDto`/`ExportedEdgeDto`)은 저장소 전체 grep 0건 —
  `swagger.md` §5-1 의 "응답 DTO 클래스명은 저장소 전체에서 유일해야 한다" 규칙 위반 없음.
- **요구사항 ID**: 이번 plan 은 신규 요구사항 ID 를 부여하지 않는다 — 충돌 대상 없음.
- **상태 전이**: 대상 없음 (응답 DTO 타입 선언 변경, 엔티티 상태 머신 무관).
- **권한·RBAC**: 대상 없음 (`GET /api/workflows/:id/export` 의 인가 게이트는 이번 plan 과 무관하게
  유지).
- **계층 책임**: 변경 파일(`workflows/dto/responses/workflow-response.dto.ts`)은
  `spec/2-navigation/1-workflow-list.md` frontmatter `code:` 의
  `codebase/backend/src/modules/workflows/dto/**` 글롭 범위 안에 있다 — 다른 spec 문서의 `code:` 와
  같은 파일을 이중 소유하지 않는다(grep 확인).

## 요약

`export-workflow-typed` plan 은 이미 병합된 직전 PR(캔버스 저장 `NodeDto`/`EdgeDto` 광고, #1411)과
같은 패턴을 export 엔드포인트로 확장하는 좁은 스코프의 변경이며, `spec/1-data-model.md` (Node/Edge
컬럼) · `spec/data-flow/11-workflow.md` §1.5 (export 의 index 치환 규칙) · `spec/5-system/2-api-convention.md`
§5.4 (null vs 키 생략) · `spec/conventions/swagger.md` (DTO 명명·nested/enum 표기) 어느 쪽과도 직접
모순되지 않는다. `spec_impact: none` 판단도 §3.2 본문이 원소 타입을 서술하지 않는다는 실측과 일치해
근거가 있다. 유일하게 기록할 가치가 있는 것은 신규 DTO 가 (기존 `NodeDto`/`EdgeDto` 와 달리) §5.4 를
정확하게 따르면서 같은 원본 컬럼이 응답 표면마다 다른 OpenAPI 형태로 광고되는 기존 비일관성을
부각시킨다는 점인데, 이는 이번 plan 이 만든 결함이 아니라 별도 후속 트랙감이다.

## 위험도

NONE
