STATUS=success convention_compliance review complete — 0 CRITICAL, 0 WARNING, 0 INFO
===REPORT_MARKDOWN_BELOW===
# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-inputoverride-marker-reject.md`

## 검토 범위·방법

target 은 `spec/5-system/14-external-interaction-api.md`(§R17) · `3-error-handling.md`(§1.7) ·
`13-replay-rerun.md`(§10.2) 세 spec 문서의 편집을 예고하는 **plan(spec draft) 문서**다. `spec/conventions/**`
가운데 target 이 실제로 건드리는 표면과 직결되는 다음 규약을 원문으로 열어 대조했다:
`error-codes.md`(에러 코드 명명·안정성), `secret-store.md`(마스킹/시크릿 도메인 근접 대조), `swagger.md`
(API 문서 데코레이터·DTO), `spec-impl-evidence.md`(문서 구조·frontmatter), `node-output.md` 목차(§3.2
표기 SoT), `execution-context.md`(마스킹 관련 여부 확인). 아울러 target 이 인용한 코드 사실(파일:라인,
상수값, 헬퍼 함수명)을 실제 저장소와 대조해 규약 위반이 "근거 없는 서술" 에 숨어 있지 않은지 확인했다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

## 대조 상세 (근거)

### 1. 명명 규약 — 신규 에러 코드 `MASKED_VALUE_RESUBMITTED`

- **규약**: [`spec/conventions/error-codes.md` §1](../../../../../../spec/conventions/error-codes.md) —
  ① `UPPER_SNAKE_CASE`, ② 의미 기반 명명(구현/전이 맥락 아닌 "무엇이 잘못됐는가"), ③ 도메인 prefix 는
  "권장"이나 §3 Rationale 이 "모듈 내 기존 일관성 보존이 prefix 도입보다 우선"이라고 명시.
- **대조**: 실제 형제 코드 3종(`codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
  의 `MISSING_REQUIRED_FIELD` / `TYPE_COERCION_FAILED` / `INVALID_SCHEMA`)은 전부 prefix 없이 조건을
  기술한다. target 이 제안하는 `MASKED_VALUE_RESUBMITTED` 도 같은 형태(prefix 없음·조건 서술·과거분사
  종결)로, 신설이 아니라 **기존 4항 매핑 테이블(reason→code)의 다섯 번째 항 확장**이다. 내부 `reason`
  값 `masked_marker` 도 형제 값(`missing_required`/`coerce_failed`/`invalid_schema`)과 동일한
  lower_snake_case. 위반 없음.
- **비고**: target 자신이 "`coerce_failed` 를 재사용하지 않는다"(§에러 계약)고 명시한 것은 error-codes.md
  §2 "rename 대신 신설" 원칙과 §1 "의미 기반 명명" 원칙에 정확히 부합하는 결정이다 — 오히려 규약이 금지하는
  안(의미가 다른 기존 코드 재사용)을 target 이 스스로 기각한 사례.

### 2. 출력 포맷 규약 — envelope·`details[]` 확장 지점

- **규약**: `error-codes.md` 는 카탈로그·envelope SoT 를 `5-system/3-error-handling.md §1`/`§2.1` ·
  `2-api-convention.md §5.3` 로 위임하고, 도메인 특화 코드는 "정의 SoT 는 도메인 spec, §1 은 공용 카탈로그
  가시성 등재"라는 기존 패턴(§1.5~§1.7)을 따른다.
- **대조**: `3-error-handling.md §1.7` 원문을 확인한 결과, `error.details[].code` 의 `MISSING_REQUIRED_FIELD`
  /`TYPE_COERCION_FAILED`/`INVALID_SCHEMA` 는 이미 이 패턴(정의는 도메인 spec/helper, §1.7 은 등재)으로
  문서화돼 있다. target 이 "정의 SoT 는 §R17, `3-error-handling.md §1.7` 에는 등재만" 이라고 쓴 것은 기존에
  이미 확립된 문서 책임 분리 패턴을 그대로 따른 것이다 — 새 예외를 만들지 않는다.
- **봉투 정확성**: target 이 인용한 `INVALID_TRIGGER_PARAMETERS`(execute 경로)는 실제로
  `workflows.controller.ts:321` / `workflows.service.ts:931` 에 존재해 사실과 일치.
- `ErrorResponseBodyDto.details` (`codebase/backend/src/common/swagger/error-response.dto.ts`)는
  `type: 'object', additionalProperties: true` (열린 스키마) — `details[].code` 값 추가는 Swagger DTO
  enum 갱신을 요구하지 않는다. 위반 없음.

### 3. 문서 구조 규약 — plan frontmatter·3섹션 구성

- target frontmatter(`title`/`worktree`/`started`/`owner`/`status`/`priority`/`spec_impact`)는
  [`spec-impl-evidence.md` §4.2](../../../../../../spec/conventions/spec-impl-evidence.md)·
  `.claude/docs/plan-lifecycle.md` 의 top-level `plan/in-progress/*.md` 3필드 의무(`worktree`/`started`
  ISO/`owner`)를 충족하고, `spec_impact` 는 bare string/빈 배열이 아닌 리스트(3개 spec 경로) — Gate C
  형식과도 사전 정합.
- 본문은 도입부(왜 지금인가) → 범위 → 형태 → 에러 계약 → spec 변경 지점 → `## Rationale`(기각한 대안 포함)
  순서로, `audit-actions.md` 등 기존 conventions 문서들이 쓰는 "본문 + Rationale(+ 기각된 대안 하위섹션)"
  패턴과 동형이다. plan 문서는 spec-impl-evidence.md 의 `id`/`status`/`code:` frontmatter 의무 대상이
  아니므로(그 규약은 `spec/**.md` 한정) 해당 스키마 미적용은 위반이 아니다.

### 4. API 문서 규약 — Swagger 데코레이터·DTO

- target 은 신규 엔드포인트·DTO 필드를 추가하지 않는다(기존 두 호출부의 값 검증 강화 + 기존
  `details[]` 카탈로그 확장). `swagger.md` §1/§5 의 DTO·데코레이터 패턴이 적용될 신규 표면이 없다. 위반 없음.

### 5. 금지 항목

- `error-codes.md` §2 가 금지하는 "이름 정확성만을 위한 rename"을 target 은 시도하지 않는다(신설 경로 선택).
- §1 이 금지하는 "구현 세부/전이적 맥락을 이름에 박기"에 해당하지 않는다(`MASKED_VALUE_RESUBMITTED` 는
  조건 서술이지 호출부·구현 경로를 지칭하지 않음).
- `secret-store.md`·`execution-context.md` 어디에도 마스킹 마커 리터럴(`***`/`[REDACTED]`/
  `[REDACTED_DEPTH]`)·`MAX_REDACT_DEPTH` 를 규정하는 조항이 없음을 확인했다 — 이 어휘의 실제 SoT 는
  `codebase/backend/src/shared/utils/sanitize-error-message.ts`(값 10 실측 확인)이고 spec 표면 SoT 는
  `14-external-interaction-api.md` 자체다. target 이 별도 `spec/conventions/` 문서를 새로 요구하지 않는
  것은 규약 회피가 아니라 이 개념이 아직 cross-cutting convention 화 대상이 아니라는 기존 구조와 일치한다.

## 요약

target 이 제안하는 신규 에러 코드(`MASKED_VALUE_RESUBMITTED`)·내부 `reason`(`masked_marker`) 명명은
`error-codes.md` §1(의미 기반·UPPER_SNAKE_CASE)과 기존 형제 코드 3종의 로컬 모듈 관행(prefix 없음)에
정확히 부합하며, `coerce_failed` 재사용을 의도적으로 기각한 결정은 §2(rename-vs-신설) 원칙을 스스로
따른 사례다. `3-error-handling.md §1.7` 로의 "등재만, 정의 SoT 는 도메인 spec" 서술은 기존 §1.5~§1.7 이
이미 쓰던 문서 책임 분리 패턴의 반복이라 신규 예외가 아니다. plan frontmatter·문서 구조는 관련 스키마
의무를 모두 충족한다. 신규 엔드포인트·DTO 가 없어 swagger 규약 표면도 없다. target 이 인용한 코드
사실(파일 경로·상수값·헬퍼명)도 실측과 일치해, 규약 위반이 서술 이면에 숨어 있을 가능성도 낮다.
**정식 규약 준수 관점에서 이 target 은 깨끗하다.**

## 위험도

NONE
