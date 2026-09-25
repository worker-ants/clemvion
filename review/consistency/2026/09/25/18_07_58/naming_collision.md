# 신규 식별자 충돌 검토 — `spec-draft-workspace-path-guard-oracle-census.md`

## 검토 요약

target 문서는 `spec/data-flow/12-workspace.md` §Rationale «경로 파라미터 워크스페이스도 가드가 본다» 의 기존
두 문장을 취소선 + 각주로 **정정**하는 것이 전부다 — 새 요구사항 ID, 새 엔티티/DTO/인터페이스, 새 API endpoint, 새
이벤트/메시지명, 새 ENV var/config key, 새 spec 파일 경로 중 **어느 것도 신규 도입하지 않는다**. 아래는 문서에
등장하는 식별자를 전수 확인한 근거다.

## 점검 관점별 확인

### 1. 요구사항 ID 충돌
target 은 새 요구사항 ID를 부여하지 않는다. 기존 §Rationale 절의 서술(존재·유형 오라클 논의)을 "두 메서드" →
"세 메서드"로 갱신하는 각주 정정일 뿐이다. 해당 없음.

### 2. 엔티티/타입명 충돌
문서가 언급하는 식별자 `transferOwnership` · `leaveWorkspace` · `addMemberByEmail` · `CANNOT_TRANSFER_PERSONAL` ·
`OWNER_REQUIRED` 는 전부 **기존에 이미 존재하는** 식별자이며 의미도 일치한다.

- `transferOwnership`: `codebase/backend/src/modules/workspaces/workspaces.controller.ts:282`,
  `workspaces.service.spec.ts` 다수, `spec/data-flow/12-workspace.md:365`("Owner 요구 2곳(`remove` ·
  `transferOwnership`)")에 이미 등재된 기존 서비스 메서드. target 은 같은 메서드를 "인가 전 조회 오라클" 목록에
  추가할 뿐, 새 의미를 부여하지 않는다.
- `leaveWorkspace` / `addMemberByEmail`: `spec/data-flow/12-workspace.md:141,177,189` 및 서비스 코드에 기존
  정의 그대로.
- `CANNOT_TRANSFER_PERSONAL`: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1183`
  (`response: { code: 'CANNOT_TRANSFER_PERSONAL' }`)에 이미 구현·테스트된 에러 코드. target 인용과 의미 일치
  (개인 워크스페이스 소유권 이전 거부).
  참고: `spec/5-system/3-error-handling.md` §1.9 카탈로그에는 이 코드가 아직 별도 등재돼 있지 않을 수 있으나,
  이는 target 문서(오라클 계획 정정)가 아니라 `spec/data-flow/12-workspace.md` 본편(가드 확장 결정)의 등재 범위
  문제이고, target 은 이 코드를 "새로 도입"하는 것이 아니라 이미 커밋된 구현(`1f616ef05`)을 인용만 한다. 충돌
  아님.
- `OWNER_REQUIRED`: `spec/5-system/3-error-handling.md:48`, `spec/5-system/2-api-convention.md:196`,
  `codebase/backend/src/common/constants/workspace-roles.ts:63` 등에 이미 정의된 기존 코드. target 의 각주가
  "가드가 토큰 워크스페이스로 판정해 HTTP 로도 닿았다"는 서술에 이 코드를 재인용할 뿐 새 정의 아님.

### 3. API endpoint 충돌
target 은 신규 endpoint 를 정의하지 않는다. `transferOwnership` 이 매핑되는 라우트(`PATCH/POST
/api/workspaces/:id/...` 계열, 이미 `spec/data-flow/12-workspace.md`·컨트롤러에 존재)는 그대로다. 해당 없음.

### 4. 이벤트/메시지명 충돌
target 에는 webhook·queue·sse 이벤트명이 등장하지 않는다. 해당 없음.

### 5. 환경변수·설정키 충돌
target 에는 ENV var·config key 가 등장하지 않는다. 해당 없음.

### 6. 파일 경로 충돌
target 파일 경로 `plan/in-progress/spec-draft-workspace-path-guard-oracle-census.md` 를 확인했다.

- 기존 파일과 겹치지 않는다 (`find plan -iname "*oracle-census*"` → target 파일 1건만 존재).
- 같은 디렉터리의 `spec-draft-*` 명명 컨벤션(`spec-draft-nullable-notation-followups.md`,
  `spec-draft-eia-notification-payload-contract.md`, `spec-draft-eia-62-waiting-payload.md` 등)과 일치한다.
- 같은 기능의 형제 plan `plan/in-progress/workspace-path-guard-impl.md` 와 이름이 겹치지 않고 구분된다
  (`-oracle-census` suffix 로 역할이 다름을 명시).
- `spec_impact: spec/data-flow/12-workspace.md` 경로도 실재하는 기존 spec 파일이며, target 이 그 파일을 새로
  생성하는 것이 아니라 기존 절의 두 문장만 수정 대상으로 지정한다.

충돌 없음.

## 발견사항

없음. 신규 식별자 충돌 관점에서 지적할 CRITICAL/WARNING/INFO 항목이 없다.

## 요약

target 문서는 새 식별자를 전혀 도입하지 않는 순수 텍스트 정정(오라클 실측 "두 메서드" → "세 메서드", 취소선 +
각주)이다. 문서에 등장하는 모든 식별자(`transferOwnership`, `leaveWorkspace`, `addMemberByEmail`,
`CANNOT_TRANSFER_PERSONAL`, `OWNER_REQUIRED`)는 이미 spec 과 codebase 양쪽에 동일한 의미로 존재하며, target
파일 경로도 기존 `spec-draft-*` 명명 컨벤션을 따르고 기존 파일과 겹치지 않는다. 신규 식별자 충돌 관점에서는
문제가 없다.

## 위험도

NONE
