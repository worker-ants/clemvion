# 정식 규약 준수 검토 — convention_compliance

## 검토 대상

`--impl-done` 모드, diff-base `origin/main`, scope `spec/conventions/`. 실제 델타 3개 파일:

- `spec/conventions/migrations.md` (기존 문서 소폭 수정 — 링크·각주 2건, README.md §6 인용 갱신 + 인덱스 교체 패턴 각주 추가)
- `spec/conventions/review-citations.md` (신규 136줄 — 새 정식 규약)
- `spec/conventions/spec-impl-evidence.md` (§2.1 `code:` 필드 정의에 예외 조항 1건 추가)

연동 구현 diff(`codebase/backend/migrations/README.md`, 42줄)도 함께 대조했다.

검토는 HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/plan-in-progress-items-b0c80b`)를 절대경로로 직접 열어(`git diff origin/main...HEAD -- <path>`, `git log`, `Read`) 실측했다 — frontmatter YAML 파싱, id 중복 여부 전수 grep, 상호 참조 section 번호·링크 타깃 실재, 인용된 마이그레이션 파일(V056/V106/V110) 실물 대조를 포함한다.

이 델타는 이미 같은 세션 안에서 5라운드의 `/consistency-check`(09_13_39 → 09_53_09 → 10_04_12 → 10_13_38 → 10_49_27)를 거쳐 발견된 WARNING·INFO가 순차 반영된 상태다. 본 라운드는 그 반영이 실제로 현재 워킹트리에 도달했는지 재확인하고, 독립적으로 새 위반을 찾는 데 집중했다.

## 발견사항

CRITICAL·WARNING 없음. 확인한 항목과 결과는 다음과 같다 (모두 통과).

### 확인 1 — 이전 라운드 WARNING/INFO 반영 여부 재확인

- target 위치: `review-citations.md` §3 표, Rationale
- 위반 규약: 해당 없음 (회귀 확인)
- 상세: `review/consistency/2026/09/05/09_53_09` W1("DTO JSDoc 이 §3 적용범위에서 배제되지 않아 `swagger.md` §3 과 잠재 충돌")이 지적한 사항은 현재 §3 표에 "**DTO·컨트롤러의 `/** */` JSDoc**" 행(대상 아님, `swagger.md` §3 cross-link)으로 반영돼 있다. `review/consistency/2026/09/05/10_49_27` INFO("각주로 등재"라는 표현이 실제로는 필드 정의 표 인라인 삽입과 다름)도 현재 `spec-impl-evidence.md` §2.1 문구를 가리키는 Rationale 문장이 "**필드 정의 설명 안에** 함께 등재했다"로 정정되어 있다(커밋 `623e19e4e`). 둘 다 재발 없음.
- 결론: 위반 없음 — 회귀 없이 반영 확인.

### 확인 2 — 신규 convention 문서(`review-citations.md`) 구조·명명 규약

- target 위치: `spec/conventions/review-citations.md` 전체
- 대조 규약: CLAUDE.md "Spec 문서 3섹션 구성(Overview/본문/Rationale)", `spec-impl-evidence.md` §1(적용 대상)·§2(frontmatter 스키마)
- 상세: frontmatter(`id: review-citations` / `status: implemented` / `code:` 2건) → `## Overview (제품 정의)` → `## 1~4` 본문 → `## Rationale` 순서로 3섹션 패턴을 그대로 따른다. YAML 파싱 검증(`yaml.safe_load`) 통과, `id`는 파일 basename과 일치. `grep '^id:' spec/conventions/*.md` 전수 대조 결과 실제 frontmatter 레벨 중복 없음 (`chat-channel` 2건 매치는 `spec-impl-evidence.md` §2/§5 **예시 코드펜스 안**의 문자열이라 실제 frontmatter 충돌 아님 — 오탐 배제 확인). 파일명도 prefix 없는 kebab-case로 기존 관례와 일치.
- 결론: 위반 없음.

### 확인 3 — `code:` 필드 예외 조항의 근거 실재성

- target 위치: `review-citations.md` frontmatter `code:` 2건, `spec-impl-evidence.md` §2.1 신설 예외 문구
- 대조 규약: `spec-impl-evidence.md` §2.1 "시행 코드가 없는 순수 문서형 convention" 예외 — "그 규약을 실제로 지키는 예시 파일을 적는다"
- 상세: 두 파일(`codebase/backend/src/common/guards/roles.guard.spec.ts`, `codebase/frontend/src/components/llm-config/sanitize-loader-error.ts`) 모두 워킹트리에 실존. 예외 조항이 두 문서(`spec-impl-evidence.md` §2.1 필드 정의 셀 + `review-citations.md` Rationale) 양쪽에 상호 링크로 동시 등재되어 SoT 분산 위험이 없다.
- 결론: 위반 없음.

### 확인 4 — `migrations.md` / README.md 상호 참조 section 번호 정확성

- target 위치: `migrations.md` 변경분(`README.md §6 말미`, `README.md §5` 인덱스 교체 패턴 각주)
- 대조 규약: spec 문서 간 SoT 참조는 실제 절 위치와 일치해야 한다는 정식 규약(상호참조 관례)
- 상세: `codebase/backend/migrations/README.md` 직접 대조 — "인덱스 교체는 DROP-먼저" 문구는 실제로 `### 5. executeInTransaction=false 파일은 한 statement 만` 절 아래에 있고, `migrate-repair` 절차(`docker compose up migrate-repair`)는 `### 6. 테이블-rewrite 형 ALTER COLUMN TYPE` 절 말미에 위치 — 두 인용 모두 정확. README.md 가 새로 언급하는 선례 `V110__schedule_workspace_next_run_index.sql`(DROP-먼저 패턴), `V056`(CREATE+DROP), `V106`(CREATE only)도 실물 파일을 열어 서술과 일치함을 확인(각각 0)DROP·1)CREATE·2)DROP 3-문장 순서 / CREATE+DROP만 / CREATE만).
- 결론: 위반 없음.

### 확인 5 — 링크 경로 실존 (spec-link-integrity 대상)

- target 위치: `review-citations.md` 의 `[swagger.md §3](./swagger.md)`, `[plan-lifecycle.md](../../.claude/docs/plan-lifecycle.md)`; `migrations.md` 의 `README.md` 상대링크
- 대조 규약: `spec-impl-evidence.md` §4.2 `spec-link-integrity.test.ts`
- 상세: 모든 경로 실존 확인. `swagger.md` §3("주석/설명 톤")은 실제로 "JSDoc 은 공개 OpenAPI 로 나간다 — 내부 서사를 담지 않는다"·"바로 위 `//` 주석" 문구를 담고 있어 `review-citations.md` 의 인용과 정합.
- 결론: 위반 없음.

### 확인 6 — 신규 마이그레이션 명명 규약 준수 (연동 검증)

- target 위치: README.md 가 인용하는 `V056`/`V106`/`V110` 파일명
- 대조 규약: `migrations.md` §1 명명 규약 (`V<번호>__<snake_case_descriptor>.sql`, `.conf` 페어 동일 base name)
- 상세: 세 파일 모두 `V<3자리>__<snake_case>` 패턴을 따르고 `.conf` 페어(`V110__schedule_workspace_next_run_index.conf`)의 base name 이 `.sql` 과 일치. alphanumeric suffix 없음.
- 결론: 위반 없음.

### INFO — 참고용 관찰 (조치 불요)

- **[INFO]** `migrations.md` 의 Overview 절 헤더가 `## Overview` (영문만)인 반면 `review-citations.md`/`spec-impl-evidence.md` 는 `## Overview (제품 정의)` 를 쓴다.
  - target 위치: `spec/conventions/migrations.md` 69행 vs 나머지 두 파일
  - 위반 규약: 없음 (CLAUDE.md 는 "Overview/본문/Rationale 3섹션 권장"만 명시, 헤더 문구 강제 없음)
  - 상세: 이번 diff 는 `migrations.md` 의 해당 헤더를 건드리지 않았으며(회귀 아님, 기존 상태 유지), `spec/conventions/` 전체를 봐도 두 표기가 혼재한다.
  - 제안: 강제 사항 아니므로 조치 불요. 향후 conventions 문서 헤더 표기를 통일하고 싶다면 별도 정리 작업으로 분리.

## 요약

이번 델타(`migrations.md` 소폭 수정, `spec-impl-evidence.md` 필드 예외 추가, `review-citations.md` 신규 등재)는 frontmatter 스키마, 3섹션 문서 구조, 파일·id 명명, section 상호 참조, 링크 실존, 그리고 인용된 마이그레이션 파일 명명까지 모두 실측 대조한 결과 CRITICAL·WARNING 없이 통과했다. 특히 이 델타는 같은 세션의 선행 5라운드 검토에서 발견된 지적(§3 적용범위 DTO JSDoc 배제, "각주" 표현 부정확)이 이미 반영되어 회귀 없이 유지되고 있음을 확인했다. API 응답/이벤트 페이로드/에러 코드 등 출력 포맷 규약이나 OpenAPI 데코레이터 규약은 이번 델타(순수 문서 규약 3건 + README.md 1건)가 건드리지 않아 해당 관점은 위반 여지가 없다. 발견된 유일한 항목은 헤더 표기 혼재라는 조치 불요 수준의 INFO 하나다.

## 위험도

NONE
