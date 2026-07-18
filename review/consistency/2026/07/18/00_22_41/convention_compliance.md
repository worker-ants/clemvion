# 정식 규약 준수 검토 — `spec/conventions/frontend-layering.md`

## 검토 범위 확정 경위

payload 에 첨부된 "Target 문서" 덤프는 `audit-actions.md`·`cafe24-api-catalog/**` 등
이번 diff 와 무관한 `spec/conventions/` 하위 파일 전문을 포함하고 있었다(크기 한도로
중간에 truncate 됨). 그러나 `diff-base 29aa918a6` 대비 실제 변경분을
`git diff 29aa918a6 --name-status -- spec/conventions/` 로 재확인한 결과 이번 diff 가
건드린 `spec/conventions/**` 파일은 **`frontend-layering.md` 단 하나**였다 (payload 말미의
"정식 규약 모음 (spec/conventions/)" 섹션도 "(없음)" 으로 이를 재확인). 따라서 본 검토는
`spec/conventions/frontend-layering.md` 의 diff(`status: partial→implemented`, `pending_plans` 제거,
§4/§4.1 본문 갱신)를 실제 target 으로 삼아 `spec/conventions/spec-impl-evidence.md` (frontmatter·
문서구조 SoT) 기준으로 준수 여부를 점검했다. (참고용으로 payload 에 포함된 audit-actions.md·
cafe24-api-catalog 덤프는 이번 diff 와 무관해 별도 지적 대상에서 제외했다.)

## 점검 결과

### 1. 명명 규약
- `id: frontend-layering` — basename(`frontend-layering.md`) 과 일치, kebab-case. `spec-impl-evidence.md §2.1` 규칙 준수.
- 문서 제목 `# Frontend 레이어 경계 규약` — 다른 conventions 문서(`# 감사 액션 명명 규약 (Conventions)` 등)와 동일하게 "…규약" 접미 패턴 유지.
- 코드측 `LOWER_LAYERS` 상수명 — spec/conventions/ 에 JS/TS 식별자 네이밍을 규정하는 정식 규약 문서가 별도로 없어 위반 대상 자체가 없음.

### 2. 출력 포맷 규약
해당 없음 — 이번 diff 는 ESLint 정적분석 설정·문서·테스트만 변경, API 응답/이벤트 페이로드/에러코드 변경 없음.

### 3. 문서 구조 규약
- `## Overview` → `## 1~4` 본문 → `## Rationale` 3섹션 구성 유지 (CLAUDE.md 권장 구조 준수).
- frontmatter 스키마(`id`/`status`/`code`) 가 `spec-impl-evidence.md §2` 스키마와 일치. `status: implemented` 전이 시 `pending_plans:` 제거 — §3 라이프사이클 "모든 pending_plans 가 complete/ 로 이동하면 implemented 로 승격" 규칙과 정합. 실제로 같은 커밋(`00b3b05a4`)에서 `plan/in-progress/spec-draft-frontend-layering.md` → `plan/complete/spec-draft-frontend-layering.md` rename(R060)이 함께 일어났음을 `git show --stat` 로 확인 — §3.1 "partial → implemented: 마지막 pending_plans 가 complete/ 로 이동한 commit 안에서 승격" 요구사항 충족.
- `code:` 글로브 2건(`codebase/frontend/eslint.config.mjs`, `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts`) 모두 워킹트리에 실존 확인 (`ls -la` 실측) — `spec-code-paths.test.ts` 의 "status implemented 는 code: ≥1 매치 의무" 통과 조건 충족.
- `spec/conventions/` 은 `spec-impl-evidence.md §4.2` 의 `spec-area-index.test.ts` 예외 목록("flat reference, 무-index")에 명시적으로 포함돼 있어 index 미보유가 위반이 아님.
- 상호링크: 본문 상단 `[Spec 0-Overview §4]` 참조가 실제 `spec/0-overview.md` 의 `## 4. 영역별 진입 문서` 섹션과 일치하고, `spec/0-overview.md` 348행이 역으로 `frontend-layering.md` 를 링크 — 양방향 연결 정상.

### 4. API 문서 규약
해당 없음 — OpenAPI/Swagger DTO/데코레이터 변경 없음.

### 5. 금지 항목
- `spec/conventions/` 어떤 문서에서도 "spec 본문에 PR 번호를 인용하지 말 것" 류의 명시적 금지 규정을 찾지 못했다 (`interaction-type-registry.md` 등 다른 conventions 문서도 PR 번호를 인용하는 선례가 있음). §4 는 "PR #969" 를 유지하고 §4.1 은 동일 문구에서 PR 번호를 제거해 문서 내부적으로 인용 정책이 비일관인 지점이 있으나(이미 `review/code/2026/07/17/23_49_51/SUMMARY.md` documentation INFO#13 로 별도 추적 중), 이는 정식 규약 위반이 아니라 문서 내 스타일 일관성 문제이므로 본 검토의 등급 기준(정식 규약 직접 위반/거리감)에 해당하지 않아 별도 CRITICAL/WARNING 으로 올리지 않음.
- §2 가 "규약은 금지하지만 CI 가드는 없음"(`types→lib`, `components→app`) 상태를 문서가 스스로 명시 — `CLAUDE.md`/spec 어디에도 "선언한 규약은 반드시 즉시 100% 가드돼야 한다"는 금지 규정이 없고, 오히려 본 문서 자체가 판단 근거(관측된 역전 압력 0)를 Rationale 에 남겨 정당화하므로 금지 항목 위반 아님.

## 종합
`spec/conventions/frontend-layering.md` 의 이번 변경(status 승격, `pending_plans` 제거, §4/§4.1 본문 갱신)은 `spec-impl-evidence.md` 가 정의한 frontmatter 스키마·상태 전이 규칙·문서 3섹션 구조를 모두 실측 기준으로 충족한다. 코드측 `LOWER_LAYERS` 확장·테스트 스코프 스위트도 spec 이 서술하는 내용과 실제 워킹트리 코드가 일치함을 diff·grep 으로 직접 확인했다. 정식 규약(`spec/conventions/**`) 관점에서 CRITICAL/WARNING 급 위반은 발견되지 않았다.

## 발견사항
없음.

## 요약
이번 diff 의 실제 target 은 `spec/conventions/frontend-layering.md` 하나이며(다른 conventions 파일 변경 없음), frontmatter(`id`/`status`/`code`)·상태 전이(`partial→implemented`, `pending_plans` 제거와 plan 이동이 동일 커밋)·문서 3섹션 구조·상호링크 모두 `spec/conventions/spec-impl-evidence.md` 가 정의한 정식 규약과 정합했다. §4/§4.1 사이 PR 번호 인용 비일관은 이미 별도 코드리뷰 트랙에서 INFO 로 추적 중인 스타일 이슈일 뿐 정식 규약 위반은 아니다. 정식 규약 준수 관점에서 이번 변경은 깨끗하다.

## 위험도
NONE
