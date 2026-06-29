# 신규 식별자 충돌 검토 결과

## 발견사항

충돌 또는 주의를 요하는 식별자가 존재하지 않는다.

이번 변경이 도입하는 새 식별자를 항목별로 정리한다.

**`R-10` (Rationale 섹션 번호)**
- target 신규 식별자: `### R-10. user_guide: build-time 가드 미적용` (spec/conventions/spec-impl-evidence.md:252)
- 기존 사용처: 같은 파일에 R-1 ~ R-9 가 순서대로 정의되어 있다. `spec/2-navigation/_product-overview.md` 에 `NAV-TR-10` 이 있지만 이는 다른 네임스페이스(NAV 요구사항 ID)이며 R-계열 Rationale 번호와 충돌하지 않는다. 코퍼스 전체에서 동일 파일 외에 `R-10` 이라는 Rationale 번호를 선점한 문서는 없다.
- 상세: 순번 연속이며 의미 중복 없음.

**`spec-user-guide-paths.test.ts` (미래 가드 파일명 언급)**
- target 신규 식별자: R-10 본문에서 언급된 미래 확장 가드 파일명.
- 기존 사용처: `codebase/frontend/src/lib/docs/__tests__/` 에 동명 파일이 존재하지 않는다. 기존 테스트 파일 목록(`spec-frontmatter.test.ts`, `spec-code-paths.test.ts`, `spec-status-lifecycle.test.ts`, `spec-pending-plan-existence.test.ts`, `spec-link-integrity.test.ts`, `spec-area-index.test.ts`, `plan-frontmatter.test.ts`, `spec-plan-completion.test.ts` 등)과 이름이 겹치지 않는다.
- 상세: "향후 추가할 수 있다"는 조건부 언급이며 현재 파일을 생성하지 않으므로 충돌 없음.

**`spec/data-flow/**` 제외 설명 단락**
- target 신규 식별자: 새 식별자(ID/이름)를 도입하지 않는다. 기존 `spec/data-flow/` 경로와 `§4.2` 섹션 참조를 설명하는 산문으로, 이미 존재하는 경로·섹션에 대한 해설이다.

**`spec-area-index.test.ts` 주석 변경**
- `// SoT: spec/conventions/spec-impl-evidence.md.` → `// This guard belongs to the §4.2 knowledge-base/plan-integrity family.\n// SoT: spec/conventions/spec-impl-evidence.md §4.2.`
- 새 식별자를 도입하지 않으며, 기존 §4.2 앵커 참조를 명확화하는 주석 편집이다.

## 요약

이번 변경(`spec/conventions/spec-impl-evidence.md` + `spec-area-index.test.ts`)이 도입하는 신규 식별자는 Rationale 번호 `R-10` 하나뿐이다. 같은 파일 내 R-1~R-9 와 순번 연속이며, 타 문서에서 동일 번호를 다른 의미로 선점한 사례는 없다. `spec-user-guide-paths.test.ts` 는 미래 확장 가능성으로 언급된 파일명으로 현재 충돌 대상이 존재하지 않는다. API endpoint, 환경변수, 이벤트명, 파일 경로, 엔티티명 계열의 신규 식별자는 도입되지 않았다.

## 위험도

NONE
