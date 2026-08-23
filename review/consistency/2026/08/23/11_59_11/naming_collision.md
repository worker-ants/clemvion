# 신규 식별자 충돌 검토 — `plan/in-progress/swagger-decisions.md`

## 검토 범위 요약

target 은 3건의 **사용자 결정 집행**을 기록하는 plan 문서다.

| 항목 | 성격 | 신규 식별자 도입 여부 |
| --- | --- | --- |
| ① `execute` 여분 키 400 거부 — 현행 유지 | 코드 무변경, 결정 기록만 | 없음 |
| ② `ExecuteWorkflowDto.input` → `deprecated: true` | 기존 필드에 플래그 추가 (리네임 아님) | 없음 (기존 필드명 유지) |
| ③ `swagger.md §3` 길이 규칙 비강제화 명문화 | 문서 개정 + Rationale | 없음 (기존 절 번호 §3 재사용) |

세 항목 모두 **새 요구사항 ID·엔티티명·endpoint·이벤트명·ENV 키를 도입하지 않는다.** 아래는 관점별 실측이다.

## 발견사항

### [INFO] `ExecuteWorkflowDto.input` ↔ `ExecuteNodeDto.input` 은 target 이 만든 충돌이 아니라 기존에 이미 문서화된 충돌이다

- target 신규 식별자: 없음 — target 은 `ExecuteWorkflowDto.input` (기존 필드)에 `deprecated: true` 만 추가한다.
- 기존 사용처:
  - `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` — `ExecuteWorkflowDto.input` (요청 봉투, `.parameters` 를 품음)
  - `codebase/backend/src/modules/workflows/dto/execute-node.dto.ts` — `ExecuteNodeDto.input` (단일 노드 수동 입력값 자체)
  - `plan/in-progress/spec-sync-external-interaction-api-gaps.md:965` — 이 동명이의가 `00_33_31 naming_collision W1` 로 이미 등재·검토됐고, "즉시 변경 불요 + 리네임 성립 안 함" 으로 이미 판정된 항목
- 상세: 두 DTO 필드가 같은 컨트롤러의 OpenAPI 표면(`@ApiBody`)에 동시 노출되며 이름은 같고 의미가 다르다. 이는 **target 이 새로 만든 충돌이 아니라 선행 리뷰가 이미 발견·기록한 상태**이며, target 은 그 상태를 "리네임 대신 `deprecated` 유도"로 **집행**하는 것뿐이다. 실제 코드(`execute-workflow.dto.ts` 현재 상태)를 확인한 결과 `{@link ExecuteNodeDto.input}` 상호 참조 docstring 과 `deprecated: true` 가 이미 반영돼 있다.
- 제안: 조치 불요. 트래커 항목(`00_33_31 naming_collision W1`)을 target 작업의 "트래커 3건 종결" 단계에서 함께 닫는 것을 권장 — 이미 target 이 그 결정을 실행했으므로 열어 둔 채로 두면 다음 리뷰가 같은 조사를 반복한다.

### [INFO] plan 파일 경로 `plan/in-progress/swagger-decisions.md` 는 컨벤션·기존 파일과 충돌 없음

- target 신규 식별자: `plan/in-progress/swagger-decisions.md`
- 기존 사용처: `ls plan/in-progress/` 전수 확인 — 동일/유사 파일 없음. `swagger-decisions` 문자열은 `review/consistency/2026/08/23/11_59_11/` 하위 자기 자신의 리뷰 산출물에서만 재등장(정상, 검토 대상 자기 참조).
- 상세: kebab-case, 동사 없는 명사구 네이밍이 `spec-sync-*`, `webchat-*` 등 기존 관행과 일치한다.
- 제안: 조치 불요.

### [INFO] `swagger.md §3` 문서 개정은 기존 절 번호를 재사용하며 새 헤딩/앵커 충돌 없음

- target 신규 식별자: 없음 — target 은 기존 `## 3) 주석/설명 톤` 절 본문을 "강제 대상 아님" 방향으로 개정할 계획이라고만 밝히고 구체 문구는 아직 없음.
- 기존 사용처: `spec/conventions/swagger.md:254-270` (`## 3) 주석/설명 톤` + 이미 있는 "예외 — 보안·정책 캐비엇" 콜아웃과 `### §3 보안·정책 캐비엇 예외 — ...` Rationale 앵커).
- 상세: 기존 §3 에는 이미 "예외" 서브섹션과 전용 Rationale 앵커가 있다. target 이 "규칙 비강제화" 를 별도 하위 섹션(예: 두 번째 "예외" 블록)으로 추가할 경우, 기존 "보안·정책 캐비엇 예외" 와 제목이 지나치게 유사하면 두 예외의 **적용 범위(보안·정책 캐비엇 vs 일반 스타일 힌트)** 가 헷갈릴 수 있다 — 다만 이는 문구 구체화 이전 단계라 지금은 잠재적 주의사항이다.
- 제안: §3 개정 시 새 콜아웃 제목을 기존 "예외 — 보안·정책 캐비엇" 과 구분되는 표현(예: "비강제 명문화" 또는 "스타일 힌트")으로 잡아, 두 예외 블록이 이름으로도 구분되게 할 것. CRITICAL/WARNING 아님 — 아직 실체가 없는 문구에 대한 사전 권고.

## 그 외 점검 관점 (충돌 없음, 상세 생략)

- **요구사항 ID**: target 이 신규 부여하는 요구사항 ID 없음. 본문이 인용하는 `00_07_27`(requirement W1), `00_33_31`(naming_collision W1), `20_05_10`/`22_53_02`(convention_compliance/rationale_continuity) 는 모두 **과거 리뷰 세션 타임스탬프 ID** 이며 새로 부여되는 것이 아니라 기존 트래커에서 인용만 한다.
- **API endpoint**: 신규 endpoint 없음. `POST /api/workflows/:id/execute` 는 기존 endpoint 그대로.
- **이벤트/메시지명**: 해당 없음.
- **환경변수·설정키**: 해당 없음.

## 요약

target 문서는 3건 모두 **결정 집행 기록**이며, 신규 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·ENV 키를 하나도 새로 도입하지 않는다. 유일하게 "동명이의"로 보이는 `ExecuteWorkflowDto.input` ↔ `ExecuteNodeDto.input` 충돌은 target 이 만든 것이 아니라 선행 리뷰(`00_33_31`)가 이미 발견·판정한 상태를 target 이 `deprecated: true` 로 집행하는 것뿐이며, 실측 결과 코드에도 이미 반영돼 있다. plan 파일 경로도 기존 명명 관행과 충돌 없다. §3 문서 개정은 아직 구체 문구가 없어 실제 헤딩 충돌 여부는 판단 불가하나, 기존 "보안·정책 캐비엇 예외" 콜아웃과 제목이 겹치지 않도록 사전 권고만 남긴다.

## 위험도

NONE
