# Cross-Spec 일관성 검토 — `spec-draft-api-convention-verifier-registration.md`

## 검토 방법 메모

`_prompts/cross_spec.md` 번들이 컨텍스트 예산 초과로 target 의 실제 수정 대상인
`spec/5-system/2-api-convention.md`·`spec/conventions/swagger.md` 본문을 **모두 절단**했다
(`> ⚠️ 본문 생략됨 — 컨텍스트 예산 초과`). 두 파일 다 이 draft 가 직접 편집하는 대상이라
번들 없이는 이 checker 의 6개 관점(특히 데이터 모델·API 계약·계층 책임)을 판정할 수
없으므로, 워크트리 디스크의 실제 파일(`spec/5-system/2-api-convention.md`·
`spec/conventions/swagger.md`·`plan/in-progress/spec-draft-nullable-notation-followups.md`·
관련 코드 3개)을 직접 읽어 보완했다.

## 발견사항

- **[WARNING]** 등재하려는 검증자가 실제로는 두 spec 이 나눠 가진 규칙 두 개를 판정하는데, `code:` 등재는 한쪽에만 붙는다
  - target 위치: `plan/in-progress/spec-draft-api-convention-verifier-registration.md` §③ (`spec/5-system/2-api-convention.md` 변경안 1) 및 `## Rationale` "기각한 대안 — `spec/conventions/swagger.md` 에만 등재"
  - 충돌 대상: `codebase/backend/src/shared/testing/response-contract.ts` 자신의 JSDoc(판정 규칙 표) vs `spec/conventions/swagger.md §5-1`("엔티티를 그대로 노출하지 말고 API 응답 형태에 맞춰 별도 DTO 를 만듭니다. 비밀값(credentials, passwordHash 등)은 마스킹하거나 제외")
  - 상세: `response-contract.ts` 의 판정 규칙 표(파일 상단 JSDoc, 32~55행)는 5개 행 중 4개가 §5.4(부재 표현) 축이지만, 다섯째 행 **"스키마에 없는 키"(undeclared)** 는 파일 스스로 *"§5.4 아님 — 이 검증자의 확장"* 이라고 명시한다. 이 축이 실제로 잡는 결함(같은 JSDoc 이 예시로 드는 것)은 `GET /api/audit-logs` 가 `AuditLogUserDto`(3필드)를 광고하면서 raw `User` 엔티티를 그대로 실어 `passwordHash`·`totpRecoveryCodes`·`passwordResetToken` 등 26개 키를 노출하던 사례다 — 이는 정확히 `swagger.md §5-1` 이 금지하는 "엔티티를 그대로 노출" 위반이지 `2-api-convention.md §5.4`(null vs 키 생략)의 관할이 아니다.
    target 의 Rationale 은 *"이 검증자가 판정하는 규칙은 §5.4 이고 그 규칙의 소유자는 `2-api-convention.md` 다"* 라는 단일-축 서술만으로 `swagger.md` 등재를 기각하는데, 검증자 자신의 문서가 이미 두 축을 인정하고 있어 그 전제가 절반만 맞다. 결과적으로 `response-contract.ts` 는 `swagger.md` 의 `code:` 어디에도 걸리지 않는 채로 남는다 — 이 draft 가 애초에 닫으려던 문제("검증자를 무력화하는 편집이 `--impl-done` SPEC-CONSISTENCY 게이트를 안 문다")가 `swagger.md §5-1` 축에서는 그대로 재발한다. 즉 이 파일의 "undeclared key" 판정 로직이 완화되는 방향으로 바뀌어도 `swagger.md` 를 대상으로 하는 impl-done 재검토는 트리거되지 않는다.
  - 제안: 다음 중 하나를 target 에 반영. (a) `response-contract.ts` 를 `swagger.md` 의 `code:` 에도 추가(선례: `error-response.dto.ts` 가 이미 `2-api-convention.md`(단일 파일 경로)와 `swagger.md`(`common/swagger/**` 글롭)양쪽에 걸리는 것과 동형). (b) 등재는 `2-api-convention.md` 에만 유지하되, 신설할 "검증 층" 문단과 `swagger.md` 양쪽에 *"undeclared-key 축은 §5.4 가 아니라 `swagger.md §5-1`(엔티티 패스스루 금지) 을 시행한다"* 는 한 문장을 명시해, 문서만 보고 오독하지 않게 한다. 최소 (b) 는 반드시 반영 — 현재 초안은 이 축의 존재 자체를 언급하지 않는다.

- **[INFO]** "검증 층" 문단이 아직 미확정 — 코드 JSDoc 표와 중복 서술될 위험
  - target 위치: `plan/in-progress/spec-draft-api-convention-verifier-registration.md` §③ 2번 항목 ("§5.4 끝에 **검증 층** 문단 신설")
  - 충돌 대상: `codebase/backend/src/shared/testing/response-contract.ts` JSDoc 의 "판정 규칙" 표(정확히 같은 5행 분류를 이미 담고 있음)
  - 상세: 실제 집행 시 spec 문단이 코드 JSDoc 의 표를 그대로 옮기면 두 곳이 될 시 하나가 바뀌어도 다른 하나가 안 바뀌는 drift 소스가 새로 생긴다. `swagger.md §1-4`·`§5.2` 가 이미 "SoT 는 코드/타 문서, 여기는 포인터만" 패턴을 쓰는 것과 같은 절제가 필요.
  - 제안: 문단은 "두 검증자의 경계"(정적 vs 런타임, 무엇을 못 보는지)만 한 단락으로 요약하고, 판정 규칙 표 자체의 SoT 는 코드 JSDoc 으로 남겨 위임할 것.

## 확인했으나 충돌 없음 (기록용)

- `response-contract.ts`/`swagger-probe.ts` 는 `spec/**` 어느 문서의 기존 `code:` 글롭에도 걸리지 않는다 (전수 grep) — 이중 등재·글롭 충돌 없음.
- 같은 파일이 두 spec 의 `code:` 에 동시에 등재되는 것 자체는 이 저장소의 기존 관행이다(`error-response.dto.ts` 가 `2-api-convention.md`(명시 경로)·`swagger.md`(`common/swagger/**` 글롭) 양쪽에 이미 걸림) — target 이 `swagger-probe.ts` 를 두 문서 모두에 등재하는 것과 동형이라 문제없음.
- `response-contract.ts` 의 "런타임(e2e)" 표기는 실측 확인 — `test/workflow-execution.e2e-spec.ts`·`audit-logs.e2e-spec.ts`·`workflow-crud.e2e-spec.ts`·`session-revocation.e2e-spec.ts` 4개 e2e 파일이 실제로 소비한다.
- `swagger-dto-contract-guard.ts` 의 "정적(AST)" 표기도 실측 확인 — `typescript` 컴파일러 API 기반, 소비처는 `swagger-dto-contract.spec.ts`(unit) 뿐 e2e 아님.
- `## Overview (제품 정의)` 처분 근거로 인용한 `project-planner/SKILL.md` "다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일" 문구 — 실측 확인(SKILL.md 43행), 인용 정확함.
- 이 draft 가 실행하려는 항목들은 `plan/in-progress/spec-draft-nullable-notation-followups.md` §후속의 열린 체크박스(§5.4 검증자 역할 경계 명문화, `code:` 등재, `## Overview` 유무 처분)와 정확히 대응 — 중복 작업이나 상충하는 병행 결정 없음. `origin/main` 이 로컬 HEAD(`f5d97aa39`)와 동일해 다른 세션이 먼저 반영한 흔적도 없음.

## 요약

target 은 이미 병합된 코드(`response-contract.ts`/`swagger-probe.ts`, PR #1288)를 spec 의 `code:` 게이트 사각지대에서 구해내는 문서 전용 정합화 작업이며, 대부분의 결정(등재 위치, 리네임 기각, `## Overview` 부분 적용)은 저장소의 기존 관행·타 문서 실측과 잘 맞아떨어진다. 다만 등재하려는 검증자(`response-contract.ts`) 자신이 명시적으로 "§5.4 아님"이라 밝힌 두 번째 판정 축(엔티티 과다노출 — `swagger.md §5-1` 소관)이 이번 등재 계획에서 어느 spec 에도 연결되지 않아, 이 draft 가 닫으려는 게이트 사각지대가 그 축에서는 그대로 남는다. CRITICAL 수준의 직접 모순은 없다.

## 위험도

MEDIUM
