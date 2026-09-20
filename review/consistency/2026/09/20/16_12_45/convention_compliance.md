# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-integration-error-facts.md`

## 검토 범위 및 방법

target 은 `plan/in-progress/` 의 spec draft(사실 정정 4건)이며, 4개 spec 파일(`0-common.md` ·
`1-http-request.md` · `2-database-query.md` · `2-navigation/4-integration.md`)에 반영할 변경안을
담고 있다. 번들 프롬프트에서 `error-codes.md`·`spec-impl-evidence.md`·`review-citations.md`·
`swagger.md`·`node-output.md` 등 핵심 규약 파일 본문이 "컨텍스트 예산 초과" 로 절단되어 있어
(`review/consistency/2026/09/20/16_12_45/_prompts/convention_compliance.md` L565-627 — 알려진 문제,
`feedback_consistency_spec_mode_budget.md`), 해당 규약은 `spec/conventions/` 원본을 직접 읽어
대조했다. 또한 target 이 실제로 편집을 예고하는 4개 spec 파일의 **현재** frontmatter·표·섹션 구조를
직접 읽어, 변경안이 삽입될 자리의 기존 스키마와 정합하는지 확인했다.

## 발견사항

이번 검토에서 CRITICAL/WARNING 급 정식 규약 위반은 발견하지 못했다. 아래는 확인 결과와 참고용
INFO 두 건이다.

- **[INFO]** `INTEGRATION_AUTH_UNSUPPORTED` 신규 행의 표 내 삽입 위치 미명시
  - target 위치: `## 변경안 ③` 두 번째 불릿 (§14.1 어휘 표에 두 행 추가)
  - 위반 규약: 직접 위반은 아님 — `error-codes.md` §1 "도메인 prefix" 관련 표 가독성 참고
  - 상세: `2-navigation/4-integration.md` §14.1 어휘 표(라인 1102-1122)는 코드를 대략
    `INTEGRATION_*` 공통군 → `EMAIL_*` → `DB_*` → `HTTP_*` 순으로 묶어 배치한다.
    `INTEGRATION_AUTH_UNSUPPORTED` 는 `INTEGRATION_` prefix 를 쓰지만 실제로는
    `resolveHttpCredentials`(HTTP 전용 공유 함수)만 발행하는 HTTP-request 특정 코드다(§4.1 표,
    `1-http-request.md` L115). draft 는 "`INTEGRATION_INCOMPLETE` 행에 문구를 덧붙인다" 고만
    적어 새 `INTEGRATION_AUTH_UNSUPPORTED` 행을 그 바로 아래(공통군 블록)에 넣을지, 아니면
    `HTTP_*` 블록 쪽에 둘지가 반영 시점에 반영자 재량에 맡겨진다.
  - 제안: 반영 시 `INTEGRATION_INCOMPLETE` 행(L1107) 바로 아래에 삽입해 같은 `resolveHttpCredentials`
    출처 코드 둘을 붙여 두는 편이 기존 그룹핑 관례와 맞는다는 점을 draft 에 한 줄 명시하면
    다음 반영자가 임의로 배치하지 않는다. CRITICAL/WARNING 은 아니다 — 표는 grep 가능한
    코드 열만 강제되고(가드 없음) 행 순서 자체를 검증하는 build 가드는 없다.

- **[INFO]** review-citations.md 관점에서 draft 의 처리는 이미 규약을 앞서 반영한 상태
  - target 위치: `## 변경안 ②` `(--spec 2차 W2)` 문단
  - 관련 규약: `spec/conventions/review-citations.md` §3 (`spec/**` 문서는 인용 규약 적용 대상) ·
    `spec-impl-evidence.md` §4.2 `spec-link-integrity.test.ts` (마크다운 링크 `[..](path)` 만 스캔)
  - 상세: draft 는 스스로 "트래커 파일 경로(`plan/…`)를 spec 본문에 backtick 코드로 넣으면
    `spec-link-integrity.test.ts` 의 마크다운 링크 감시망 밖이라 트래커가 이동해도 죽은 참조가
    남는다" 는 이유로 해당 인용을 넣지 않기로 이미 정정했다(1차 CRITICAL 대응 이후 2차 W2).
    직접 확인한 결과 이 판단은 정확하다 — `spec-link-integrity.test.ts` 는 in-repo `[..](path)`
    타깃만 검사하므로 backtick 코드 안의 경로 문자열은 대상이 아니다. 반영 후 실제 4개 spec
    파일에 삽입될 문구에도 `review/**`·`plan/**` 인용이 전혀 없어 review-citations.md 를 위반할
    표면 자체가 없다. 규약 위반이 아니라 **이미 올바르게 회피된 사례**로, 향후 유사 draft 의
    참고 선례로 남겨도 좋다.

## 확인했으나 문제 없음으로 판정한 항목 (참고)

- **에러 코드 명명**: 변경안이 언급하는 모든 코드(`INTEGRATION_CALL_FAILED` · `HTTP_BLOCKED` ·
  `HTTP_TRANSPORT_FAILED` · `DB_HOST_BLOCKED` · `INTEGRATION_INCOMPLETE` ·
  `INTEGRATION_AUTH_UNSUPPORTED` · `HTTP_CONNECT_FAILED` · `CAFE24_INSUFFICIENT_SCOPE` ·
  `MAKESHOP_AUTH_FAILED`)는 전부 코드베이스에 이미 존재하는 `UPPER_SNAKE_CASE` · 도메인-prefix
  코드다(`grep` 으로 실존 확인). 신규 코드 신설·rename 이 없어 `error-codes.md` §1(의미 기반
  명명)·§2(rename 은 breaking) 어느 쪽도 건드리지 않는다. draft 의 "비대상 — 새 코드·새 규약
  없다" 서술과 일치한다.
- **표 스키마 정합**: `0-common.md` §4.2(2열: 코드/조건), `1-http-request.md` §6·`2-database-query.md`
  §6(코드/조건/response/headers/statusCode), `2-navigation/4-integration.md` §14.1(코드/원인/영향) ·
  §5.3(불릿 `- 조건 → CODE — 설명`) 각각의 기존 컬럼 스키마를 직접 대조한 결과, draft 가
  제안하는 문구·행은 모두 기존 컬럼 구조에 자연스럽게 삽입되는 형태다.
- **`code:` frontmatter 필드**: `1-http-request.md` 에 추가되는 두 파일(`http-redirect.ts`,
  `http-credentials.ts`)은 `codebase/backend/src/nodes/integration/http-request/` 에 실존하며,
  `spec-impl-evidence.md` R-1(글롭보다 명시 파일 선호) 관행과 일치한다.
- **마크다운 링크 anchor**: `## 변경안 ④` 가 추가하는
  `[MakeShop 노드 §9.5](../4-nodes/4-integration/5-makeshop.md#95-별도-승인restricted-scope-미도입)`
  링크를 실제 대상 헤딩("### 9.5 별도 승인(restricted) scope 미도입")에 대해 github-slugger 규칙으로
  직접 슬러그를 계산해 대조했다 — 정확히 일치한다(`spec-link-integrity.test.ts` 통과 예상).
  상대경로(`spec/2-navigation/` → `spec/4-nodes/4-integration/`)도 올바르다.
- **plan frontmatter**: draft 자신의 frontmatter(`owner`/`worktree`/`started`/`spec_impact`)는
  `plan-frontmatter.test.ts`·Gate C(`spec-plan-completion.test.ts`) 요구를 충족하는 형태다 —
  `spec_impact` 가 실재 spec 경로 4개의 리스트로, bare 경로도 `- none` 도 아니다
  (`feedback_spec_impact_gate_c_list.md` 가 지적하는 세 실패 형태 어디에도 해당하지 않음).
- **문서 구조(Overview/본문/Rationale)**: draft 가 편집을 예고하는 4개 spec 파일은 모두 이미
  `## Rationale` 섹션으로 끝나는 기존 구조를 유지하고 있고, draft 의 변경안은 그 구조를 깨지
  않는 append 형태다. draft 자신은 `plan/**` 문서라 CLAUDE.md 의 3섹션 권장 대상이 아니다.
- **API 문서 규약(swagger.md)**: 이번 변경안은 NestJS 컨트롤러/DTO·OpenAPI 데코레이터를 건드리지
  않는다(노드 내부 에러 코드 문서화 한정) — 해당 관점은 이 target 에 적용 대상이 없다.

## 요약

target 은 정식 규약 관점에서 이미 상당히 안전하게 작성됐다. 제안하는 모든 에러 코드는 기존
`UPPER_SNAKE_CASE` 도메인-prefix 코드를 재사용할 뿐 신설·rename 이 없어 `error-codes.md` 를
위반하지 않고, 4개 대상 spec 문서의 기존 표·불릿·frontmatter 스키마에 정확히 들어맞으며,
마크다운 링크 앵커도 실제 헤딩과 슬러그 단위로 일치한다. 특히 트래커 경로를 spec 본문에
backtick 인용하지 않기로 한 2차 정정은 `spec-link-integrity.test.ts` 의 실제 스캔 범위(마크다운
링크만)를 정확히 파악한 규약 준수 사례다. 발견한 두 건은 모두 INFO 수준(표 삽입 위치 명시
권장, 선례 기록)으로 반영을 막을 사유가 아니다.

## 위험도

NONE
