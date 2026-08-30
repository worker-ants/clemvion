# 정식 규약 준수 검토 — spec-draft-raw-query-results.md

## 발견사항

- **[WARNING]** 신규 `spec/conventions/raw-query-results.md` 초안에 명시적 `## Overview` 섹션이 없다
  - target 위치: §A 전체 (`### frontmatter (필수)` ~ `### 집행`)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` "단일 진실 원칙: 각 spec 문서는 3섹션 (Overview / 본문 / Rationale)" 및 CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 권장"
  - 상세: §A 는 frontmatter → "왜 기존 `migrations.md` 확장이 아니라 신규 문서인가" → 불변식 (a)/(b) → "이 규약이 없어서 난 일" → "집행" 순으로 전부 `###` 레벨 소제목만 나열하고, 이를 감싸는 `## Overview` (또는 그에 준하는 최상위 절)가 없다. 번들에 실려온 자매 conventions 문서 5개 중 4개 — `migrations.md`("## Overview" + 3항목 안전성 기준), `audit-actions.md`("## Overview" + 책임 경계 bullet), `error-codes.md`("## Overview" + 책임 경계 bullet), `spec-impl-evidence.md`("## Overview (제품 정의)") — 가 모두 명시적 `## Overview` 헤더로 문서 범위·SoT 경계를 요약한 뒤 본문에 들어간다. 유일한 예외인 `node-cancellation.md` 도 "## 1. 목적" 이라는 동등 역할의 대체 헤더는 갖고 있어, §A 처럼 최상위 요약 절 자체가 없는 경우는 없다. §A 의 "왜 기존 `migrations.md` 확장이 아니라 신규 문서인가" 절이 내용상 SoT 경계 설명(Overview 가 하는 역할)을 담고 있긴 하나, 헤더 레벨·이름이 그 역할을 명시하지 않는다.
  - 제안: 실제 `spec/conventions/raw-query-results.md` 작성 시 title 바로 아래 `## Overview` 절을 두고, "raw `UPDATE`/`DELETE … RETURNING` 결과 shape 규율만 정의하며 스키마 변경 절차(`migrations.md`)·노드 출력 계약(`node-output.md`)과는 축이 다르다"는 책임 경계를 요약한다. §A 의 "왜 신규 문서인가" 절은 그 Overview 아래 Rationale 성격의 세부 논거로 남기거나, Overview 문단에 흡수한다. 의도적으로 `node-cancellation.md` 식 "## 목적" 패턴을 택했다면 그 선택을 Rationale 에 한 줄 남기는 편이 다음 저자에게 낡은 관성으로 오독되지 않는다.

- **[INFO]** §A 소제목이 전부 `###` (h3) 레벨이라 최상위 numbered-section 관례와 어긋난다
  - target 위치: §A 전체
  - 위반 규약: 명시적 규정은 없으나 `migrations.md`(`## 1. 명명 규약`), `audit-actions.md`(`## 1. 구조`), `error-codes.md`(`## 1. 의미 기반 명명`), `node-cancellation.md`(`## 1. 목적`, `## 2. 컨트랙트`) 전부 최상위 절을 `##`(h2)로 잡고 `###`(h3)는 그 하위 세부 항목에만 쓰는 일관된 관행
  - 상세: §A 의 "왜 신규 문서인가"·"불변식 (a)"·"불변식 (b)"·"이 규약이 없어서 난 일"·"집행" 은 성격상 서로 형제(sibling) 최상위 절인데 전부 `###` 로 같은 깊이에 있어, 실제 파일로 옮길 때 의도한 헤더 계층(어느 것이 h2 이고 어느 것이 h2 아래 h3 인지)이 불명확하다. 이는 계획 문서의 편의적 표기일 수 있어 CRITICAL/WARNING 이 아니라 INFO 로 남긴다.
  - 제안: 최종 파일 작성 시 "왜 신규 문서인가"를 Overview 하위 문단으로, "불변식 (a)/(b)"·"이 규약이 없어서 난 일"·"집행"을 `## 1.`~`## 4.` 식 h2 numbered section 으로 승격해 자매 문서와 헤더 깊이를 맞춘다.

## 그 외 점검 결과 (위반 없음)

- **명명 규약**: `id: raw-query-results` — 파일 basename 과 일치, 기존 15개 convention id 와 충돌 없음(`grep '^id:' spec/conventions/*.md` 로 확인). `plan/in-progress/spec-draft-raw-query-results.md` 경로·파일명은 `project-planner/SKILL.md` §3 "`plan/in-progress/spec-draft-<name>.md`" 패턴 및 선례(`plan/complete/spec-draft-web-chat-console.md`)와 일치. 신설 에러 코드 `OAUTH_STATE_MISMATCH` 는 `error-codes.md §1` 이 이미 "의미 기반 명명" 예시로 직접 인용하는 이름이라(§1: "`OAUTH_STATE_MISMATCH`(state 불일치)") 명명 원칙 위반이 아니라 오히려 그 문서 자신이 인정한 이름을 카탈로그에 등재하는 것뿐이다.
- **출력 포맷 규약**: 대상 문서는 API 응답 payload 형식을 바꾸지 않는다. `OAUTH_STATE_MISMATCH` 를 `3-error-handling.md §1.2` 표(코드/이름/설명/HTTP 4열)에 등재하고 `data-flow/2-auth.md` 와 상호링크하는 안은, 같은 표에 이미 있는 `NOT_A_MEMBER`(도메인 spec cross-link 보유) 행과 동형 패턴이며, `data-flow/2-auth.md` §3.3·Rationale "OAuth state 의 one-shot DELETE" 가 실제로 그 흐름의 서술 SoT 임을 실측으로 확인했다(`grep` 결과 해당 절 실재).
- **frontmatter 스키마 규약**: 신규 파일의 `id`/`status: implemented`/`code:` 3필드는 `spec/conventions/spec-impl-evidence.md §2.1`·§3 스키마와 일치하고, `code:` 3경로(`update-returning-rows.ts`/`.spec.ts`/`source-scan.ts`) 는 모두 저장소에 실존(`ls` 로 확인) — `spec-code-paths.test.ts` 가드 통과 조건 충족. `pending_plans:` 추가 대상(`plan/in-progress/update-returning-tuple-shape.md`)도 실존. 최상위 plan frontmatter(`worktree`/`started`/`owner`)도 `.claude/docs/plan-lifecycle.md §4` 3필드 스키마를 충족 — 문서 자신이 "개정 2" 각주에서 밝힌 초판 BLOCK:YES(필수 필드 누락) 가 이번 개정에서 해소된 상태로 확인됨.
- **문서 구조 규약 (plan draft 자체)**: `project-planner/SKILL.md` §3 이 요구하는 "본문 끝에 `## Rationale`" 요건은 대상 문서 말미의 `## Rationale`(기각한 대안 2건 + "왜 지금 남기나")로 충족.
- **API 문서 규약**: DTO·OpenAPI 데코레이터·swagger 변경 없음 — 이 규약 영역은 대상 문서와 무관.
- **금지 항목**: `error-codes.md §2`(불필요한 rename 금지)·`migrations.md`(append-only 등) 등 조사한 규약들의 명시적 금지 패턴을 반복하지 않는다.

## 요약

대상 spec draft 는 frontmatter 스키마(`id`/`status`/`code`/`pending_plans`/plan 3필드)·파일명 패턴·에러 코드 명명·에러 카탈로그 배치 방식 등 검증 가능한 정식 규약 항목을 모두 충족했고, 초판에서 지적된 필수 필드 누락도 이번 개정에서 해소됐다. 유일하게 걸리는 지점은 신규로 승격시키는 `spec/conventions/raw-query-results.md` 의 제안 내용에 자매 conventions 문서 대다수가 갖춘 명시적 `## Overview` 절이 빠져 있다는 점으로, 내용상 SoT 경계 설명은 존재하나 헤더 레벨이 그 역할을 드러내지 않는다 — 실제 파일 작성 단계에서 반영을 권한다. CRITICAL 급 위반은 없다.

## 위험도
LOW
