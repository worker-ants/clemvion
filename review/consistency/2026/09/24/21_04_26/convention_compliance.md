# 정식 규약 준수 검토 — spec/conventions/spec-impl-evidence.md

## 검토 범위 참고
- **검토 모드**: `--impl-prep` (scope=prep-scope-2, plan `docs-guard-trigger` — `.github/workflows/spec-link-checks.yml` 의 pathspec·실행 범위 확장 작업의 착수 전 검토)
- **target 문서**: 번들에 전문이 포함된 것은 `spec/conventions/spec-impl-evidence.md` 뿐이다. 나머지 `spec/conventions/**` (swagger.md, error-codes.md, node-output.md 등 대부분)는 컨텍스트 예산 초과로 절단되어 본 검토에서 대조 불가 — 이 문서들과의 교차 검증은 수행하지 못했다(추정 아닌 사실 고지).
- 실제로 대조 가능했던 참조 문서: `audit-actions.md`(전문), `cafe24-api-catalog/_overview.md`(부분), `cafe24-api-catalog/category.md`(전문).

## 발견사항

검토 결과 CRITICAL/WARNING 급 규약 위반은 발견되지 않았다. 아래는 실측으로 확인한 정합 사실이며, 참고용으로 남긴다.

- **[INFO] frontmatter 서술과 실제 구현의 일치 (실측 확인)**
  - target 위치: `spec-impl-evidence.md` §1 (적용 대상·제외), §2.2, §3.1
  - 위반 규약: 해당 없음 — 오히려 **일치 확인**
  - 상세: 문서가 서술하는 세 가지 SoT 주장을 코드와 직접 대조했다.
    1. §1 의 `INCLUDE_PREFIXES`(6개 경로)·`EXCLUDE_BASENAMES`(`0-overview.md`/`1-data-model.md`/`6-brand.md`)·`CATALOG_FIELD_FILE` 정규식 서술 — `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:48-73` 과 **문자 그대로 일치**.
    2. §2.2 의 `plan-scan.ts` `TERMINAL_PLAN_STATUSES` 서술(`complete`/`implemented`/`applied`/`superseded`) — `plan-scan.ts:147-152` 과 **일치**.
    3. §2.1 의 basename 충돌 회피 예시(`agent-memory` vs `nav-agent-memory`) — `spec/5-system/17-agent-memory.md`(`id: agent-memory`) · `spec/2-navigation/16-agent-memory.md`(`id: nav-agent-memory`) 실제 frontmatter 와 **일치**.
    4. R-9 서술대로 §4.2 의 4개 build 가드(`spec-link-integrity.test.ts`/`spec-area-index.test.ts`/`plan-frontmatter.test.ts`/`spec-plan-completion.test.ts`)가 문서 자신의 frontmatter `code:` 목록에 실제로 전부 등재돼 있음을 확인.
  - 제안: 조치 불요. 착수 예정 작업(`spec-link-checks.yml` pathspec 확장)의 근거로 인용된 §4.2 서술(“spec 본문 스캔에는 target 필터가 없어 `plan/**` 링크도 검사 대상”)이 실측과 일치하므로, 해당 plan 의 전제는 이 문서 기준으로 유효하다.

- **[INFO] Rationale 절 표기 스타일이 conventions 문서군 내에서 두 갈래**
  - target 위치: `spec-impl-evidence.md` §Rationale (`### R-1.` ~ `### R-11.`)
  - 위반 규약: 없음 — CLAUDE.md/SKILL.md 는 Overview/본문/Rationale **3섹션**만 권장할 뿐 Rationale 내부 소제목 형식은 규정하지 않는다.
  - 상세: 같은 번들에 포함된 `audit-actions.md` 는 Rationale 소제목을 서술형(`### 왜 시제를 한 규약으로 묶는가`, `### 기각된 대안`)으로 쓰는 반면, 본 문서는 `R-1.`…`R-11.` 식별자 접두를 쓴다. 두 방식 모두 유효하고 실제로 프로젝트 내 다른 spec 문서에서도 `R-N` 접두 선례가 있어(예: EIA 관련 spec) 위반이 아니라 단순 스타일 차이다.
  - 제안: 조치 불요. 다만 conventions 문서군 전체의 Rationale 소제목 형식을 통일하고 싶다면 `spec/conventions/` 자체에 메타 규약을 신설해야 하며, 이는 이번 target 문서 단독의 문제가 아니다.

- **[INFO] 교차 검증 갭 — 대부분의 `spec/conventions/**` 원문 미확보**
  - target 위치: 해당 없음(검토 프로세스 자체의 한계)
  - 위반 규약: 없음
  - 상세: `swagger.md`(API 문서 규약, 점검 관점 4번과 직결) · `error-codes.md`(출력 포맷 규약, 점검 관점 2번과 직결) · `node-output.md` · `redis-keys.md` 등이 모두 컨텍스트 예산 초과로 절단되어 본 세션에서 target 문서와의 교차 위반 여부를 확인하지 못했다. 다만 target 문서(`spec-impl-evidence.md`)는 API 응답 포맷·OpenAPI 데코레이터를 다루는 문서가 아니므로(순수 frontmatter/문서 lifecycle 메타 규약), 점검 관점 2·4번(출력 포맷·API 문서 규약)은 **적용 대상 자체가 아님**으로 판단한다.
  - 제안: 만약 orchestrator 가 이 문서 간 교차 검증을 원한다면 별도 라운드에서 `spec/conventions/swagger.md`·`error-codes.md` 만 별도 번들로 좁혀 재검토를 요청할 것.

## 요약

target 문서 `spec/conventions/spec-impl-evidence.md` 는 CRITICAL/WARNING 급 정식 규약 위반이 없다. 명명 규약(§2.1 kebab-case id, basename 충돌 회피 규칙), 문서 구조 규약(Overview/본문/Rationale 3섹션 준수), 자기 자신이 정의한 필드·라이프사이클 규칙 모두 실제 구현 코드(`spec-frontmatter-parse.ts`, `plan-scan.ts`)와 문자 그대로 일치함을 실측으로 확인했다. 다만 대부분의 다른 `spec/conventions/**` 문서(특히 API 문서 규약을 다루는 `swagger.md`, 출력 포맷 규약을 다루는 `error-codes.md`)는 이번 번들에서 컨텍스트 예산 초과로 절단되어 교차 검증하지 못했다 — 이 문서는 애초에 그 규약들의 적용 대상이 아니라고 판단했으나, 확정적 반증은 아니다. 진행 중인 plan(`docs-guard-trigger`, `.github/workflows/spec-link-checks.yml` pathspec/실행범위 확장)이 인용하는 §4.2 서술은 구현과 일치해 전제가 유효하다.

## 위험도
NONE
