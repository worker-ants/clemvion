# 정식 규약 준수 검토 — `spec/5-system/`

검토 모드: `--impl-prep` (구현 착수 전), scope = `spec/5-system/`

> 프롬프트 예산 초과로 15/18 개 `spec/5-system/*.md` 파일과 269개 `spec/conventions/**` 파일 본문이
> 생략되어 있었다(알려진 이슈, `feedback_consistency_spec_mode_budget`). 해당 파일은 저장소에서
> 직접 `Read`/`grep` 하여 검증했다 — `1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 는
> 프롬프트 전문, 나머지 15개는 저장소 원본을 직접 열어 확인했다. `spec/conventions/` 는 대상과
> 직접 연관된 항목(error-codes·swagger·egress-masking·execution-context·spec-impl-evidence·
> node-output 등)을 원본에서 전문 확인했다.

## 발견사항

### [WARNING] `13-replay-rerun.md` §8.1·§8.2 의 401 코드가 표준 카탈로그와 다르다

- target 위치: `spec/5-system/13-replay-rerun.md` §8.1 (`POST /api/executions/:id/re-run`, line 240) ·
  §8.2 (`GET /api/executions/:executionId/chain`, line 269)
- 위반 규약: `spec/conventions/error-codes.md` §1 (제품 전체 에러 코드 카탈로그) +
  `spec/5-system/2-api-convention.md §5.3` "code 의 상태코드별 기본값: … 401=`AUTH_REQUIRED`" +
  `spec/5-system/3-error-handling.md §1.2` 카탈로그(`AUTH_REQUIRED` | 인증 필요 | 토큰 없음 | 401)
- 상세: 두 표 모두 `401 | UNAUTHORIZED | 인증 토큰 없음/만료`로 적고 있고, §8.1 행은 심지어
  "**표준 [Spec 에러 처리] 규약**"이라고 스스로 표준 준수를 주장한다. 그러나 실제 표준 코드는
  `AUTH_REQUIRED`다 — `error-codes.md`·`api-convention.md §5.3`·`error-handling.md §1.2` 세 곳이
  일관되게 `AUTH_REQUIRED`를 401 기본값으로 규정한다. 코드베이스 실측(`codebase/backend/src/common/
  filters/http-exception.filter.ts:144-145`, `case 401: return 'AUTH_REQUIRED'`)도 이를 뒷받침한다 —
  `UNAUTHORIZED`라는 문자열은 `error-codes.ts`·executions 모듈 어디에도 없다. 즉 실제 런타임 동작은
  이미 규약대로 `AUTH_REQUIRED`를 내는데, 본 문서의 두 표만 다른(비표준) 이름을 문서화하고 있다 —
  API 소비자가 이 문서를 신뢰해 `UNAUTHORIZED`로 분기하면 실제로는 절대 일치하지 않는다. `5-system/`
  다른 17개 문서 전수를 grep 했을 때 이 오기는 `13-replay-rerun.md` 2곳에만 있다(고립된 drift).
- 제안: 두 행의 `code` 열을 `UNAUTHORIZED` → `AUTH_REQUIRED` 로 정정한다. 이 정정은 문서 전용 수정이고
  `spec_impact: none`(현재 plan)과 무관하게 별도로 처리하거나, 발견 시점에 `developer`/`project-planner`
  턴에서 1줄 정정으로 흡수 가능하다.

### [INFO] `spec/5-system/` 6개 문서가 권장 3섹션 구성(`## Overview`)을 따르지 않는다

- target 위치: `2-api-convention.md`·`6-websocket-protocol.md`·`16-system-status-api.md` (Overview
  섹션 자체 부재, 첫 번째 `##` 헤딩부터 바로 본문) / `5-expression-language.md`·`7-llm-client.md`·
  `11-mcp-client.md` (`## Overview` 대신 `## 1. 개요`라는 다른 헤딩 레이블 사용)
- 위반 규약: `.claude/skills/project-planner/SKILL.md` "명명 컨벤션" 표
  (`## Overview (제품 정의)` / 본문 / `## Rationale` 3섹션) + 본 리뷰 관점 3의 "Overview / 본문 /
  Rationale 3섹션 권장"
- 상세: `grep -c '^## Overview'` 전수 검사 결과 18개 `5-system/*.md` 중 12개만 정확히 이 헤딩을
  갖고 있다. `## Rationale` 은 18개 전부(`_product-overview.md` 제외) 정확히 1개씩 있어 그 축은
  완전히 준수한다 — Overview 축만 부분 이탈이다. 이는 이번 plan(`spec_impact: none`, private 헬퍼
  추출)과 무관한 **기존(pre-existing) 상태**이며, build-time 가드(`spec-frontmatter.test.ts` 등)는
  frontmatter 필드(`id`/`status`)만 검증하고 본문 헤딩 존재는 검사하지 않는다 — 기계 강제 대상이 아니다.
- 제안: 즉각 수정을 요하는 CRITICAL 은 아니다. `project-planner` 가 이 6개 문서를 다음에 손댈 때
  `## Overview` 섹션(또는 최소 `## 1. 개요` → `## Overview`로 통일)을 추가해 권장 구조를 맞추는
  것을 권한다. 지금 이 시점(구현 착수 전 검토)에서 이 plan 이 이 6개 문서를 수정하지 않으므로
  본 항목 때문에 착수를 막을 이유는 없다.

### [INFO] 그 외 검토 결과 — 위반 없음 확인

다음 항목은 명시적으로 대조했으나 위반을 발견하지 못했다:

- frontmatter (`id`/`status`/`code`/`pending_plans`) — 18개 파일 전수, `spec-impl-evidence.md`
  §2·§3 스키마와 일치. `status: partial` 6개(`1-auth`·`14-external-interaction-api`·
  `15-chat-channel`·`4-execution-engine`·`9-rag-search`·`6-websocket-protocol`) 모두
  `pending_plans:` 보유, 참조된 10개 plan 파일 전부 `plan/in-progress/` 에 실존.
- 응답 포맷(`{ data }` / `{ data, pagination }` / `{ data: { items } }` pass-through, 부재 표현
  `null` vs 키 생략) — `2-api-convention.md §5`↔`swagger.md §1-4/§2-5/§5`↔`14-external-interaction-api.md
  §R17` 3자 교차 참조 정합.
- 에러 코드 명명(`INVALID_TRIGGER_PARAMETERS` 3-경로 통합, `MASKED_VALUE_RESUBMITTED` 신설,
  `RERUN_` prefix 의도적 생략) — `error-codes.md §4.2`(2026-08-22 신설) ↔ `3-error-handling.md
  §1.3/§1.7` ↔ `13-replay-rerun.md §8.1` ↔ `egress-masking.md` 4자 교차 참조 전부 정합. 구
  코드(`NODE_EXECUTION_FAILED`/`INTEGRATION_ERROR`/`LLM_ERROR`/`INVALID_INPUT`) 언급은 전부
  "더 이상 쓰지 않는다"는 이력 서술 맥락뿐, 활성 사용 없음.
- egress 마스킹 좌표계(`egress-masking.md`, 2026-08-22 신설 convention) — `14-external-interaction-api.md
  §R17` 이 스스로 "구현 좌표계는 별도 규약이 소유한다"고 위임 각주를 달아 SoT 분리 원칙 준수.
  마커 리터럴을 산문에 직접 적지 않는 규율("본 문서는 마커 리터럴을 적지 않는다")도 §R17 본문에서
  준수(마커 값 대신 "마스킹 마커 세 문자열"로만 지칭).
- `ExecutionContext` 필드 분류(`execution-context.md`) ↔ `3-error-handling.md §1.3
  RESERVED_VARIABLE_NAME` 행 상호 참조 정합.
- `spec/0-overview.md` `0-` prefix, `spec/5-system/_product-overview.md` 밑줄 prefix 등 파일
  명명 컨벤션 — 위반 없음.
- `spec/conventions/*.md` 타이틀 포맷 다양성(`# CONVENTION: X` / `# X 규약 (Conventions)` / 평문
  타이틀) — `egress-masking.md`(신설)의 `# CONVENTION: Egress 마스킹 좌표계 (...)` 형식은
  선례(`secret-store.md`)와 동일 패턴이라 이탈 아님.
- Swagger/DTO 명명 패턴(`swagger.md` §1~§6) — 5-system 문서 본문이 서술하는 응답 wrapping·
  `writeOnly`/`readOnly`·닫힌 union vs 열린 map 구분과 직접 모순되는 서술 없음.

## 요약

`spec/5-system/` 은 반복적인 정합성 검토 이력(commit log 상 수십 개 PR)이 누적된 상태로, 명명·
출력 포맷·API 문서 규약 대부분에서 매우 높은 수준의 준수도를 보인다. 이번 검토에서 발견한 실질
결함은 `13-replay-rerun.md` 의 401 에러 코드 표기(`UNAUTHORIZED` — 표준은 `AUTH_REQUIRED`) 1건
(WARNING, 문서 전용 drift, 런타임 동작은 이미 정상)과, 6개 문서의 `## Overview` 헤딩 부재/변형
(INFO, 기계 강제 대상 아닌 권장 사항)뿐이다. 둘 다 현재 plan(`rerun-input-resolution-extract`,
`spec_impact: none`)의 범위를 벗어난 사전 존재 상태이며, 착수를 차단할 CRITICAL 은 없다.

## 위험도

LOW
