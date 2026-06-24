# 정식 규약 준수 검토 — `spec/2-navigation/`

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/2-navigation/, diff-base=origin/main)
검토일: 2026-06-24

---

## 발견사항

### 1. **[INFO]** `14-execution-history.md` — `## Overview` 섹션 존재하나 나머지 파일은 미적용
- target 위치: `spec/2-navigation/14-execution-history.md` 전체, 비교 대상 `0-dashboard.md` / `10-auth-flow.md` / `11-error-empty-states.md` / `15-system-status.md` / `16-agent-memory.md` / `13-user-guide.md` / `2-trigger-list.md`
- 위반 규약: CLAUDE.md §정보 저장 위치 — "제품 정의·요구사항: `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`"
- 상세: `14-execution-history.md` 는 `## Overview (제품 정의)` 섹션을 두고 있으나, 같은 영역의 `0-dashboard.md` / `10-auth-flow.md` / `11-error-empty-states.md` / `15-system-status.md` / `16-agent-memory.md` 는 `## Overview` 섹션이 없이 바로 번호 절로 시작한다. 스타일 불일치이지만 CLAUDE.md 는 "권장"(recommended)이며 강제는 아니다. 다만 `14-execution-history.md` 가 유일하게 Overview + 요구사항 표까지 갖추고 있어 혼재가 눈에 띈다.
- 제안: 차이가 의도적이면 정책 불일치를 허용한다는 내용을 어딘가에 기록. 의도적이지 않다면 일관성을 맞출 때 나머지 파일에도 간략한 `## Overview` 절 추가를 검토.

### 2. **[INFO]** `15-system-status.md` — `## Rationale` 는 있으나 `## Overview` 없이 3섹션 권장에 부합하지 않음
- target 위치: `spec/2-navigation/15-system-status.md` 전체 구조
- 위반 규약: CLAUDE.md §정보 저장 위치 "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 권장"
- 상세: 문서가 Overview 절 없이 바로 `## 1. 화면 구조`로 시작하고 `## Rationale`로 끝난다. Rationale 은 있어 3섹션 중 2/3는 충족. `## Overview` 부재가 INFO 수준.
- 제안: 파일 상단에 1~2줄 요약 `## Overview` 절 추가를 검토 (필수는 아님).

### 3. **[INFO]** `16-agent-memory.md` — `id: nav-agent-memory` 가 basename과 불일치
- target 위치: `spec/2-navigation/16-agent-memory.md` frontmatter `id: nav-agent-memory`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — "id: spec 식별자. 파일 basename(확장자 제외) 기반 권장. **같은 basename 이 영역을 달리해 중복될 때는 후발 문서가 영역 prefix 로 충돌을 회피한다**"
- 상세: `spec/5-system/17-agent-memory.md` 가 `id: agent-memory` 를 선점하여 `spec/2-navigation/16-agent-memory.md` 가 `nav-agent-memory` 를 사용하는 것은 spec-impl-evidence.md §2.1 이 명시적으로 허용하는 의도된 패턴이다. 따라서 위반이 아님 — 규약 준수 확인. INFO 수준의 참고 메모.
- 제안: 없음 (규약 준수).

### 4. **[INFO]** `10-auth-flow.md` §5.4 — OAuth callback `?error=` 값의 `lower_snake_case` 표기가 historical-artifact 레지스트리에 등재됨
- target 위치: `spec/2-navigation/10-auth-flow.md §5.4 OAuth 에러 처리` — `invalid_state` / `token_exchange_failed` / `email_required` / `server_error`
- 위반 규약: `spec/conventions/error-codes.md §1` — 에러 코드는 `UPPER_SNAKE_CASE`
- 상세: 이 값들은 `spec/conventions/error-codes.md §3 Historical-artifact 예외 레지스트리` 에 명시적으로 등재되어 있으며 "rename = breaking(§2)" 이유로 유지가 허용된다. 문서 내에도 "historical-artifact 레지스트리 등재"를 각주로 명기하고 있다. 규약 위반이 아닌 허용 예외.
- 제안: 없음 (규약 준수 — §3 레지스트리 등재로 커버됨).

### 5. **[INFO]** `0-dashboard.md` — API 응답 예시가 `{ "data": ... }` 래퍼 없이 내부 형태만 기술
- target 위치: `spec/2-navigation/0-dashboard.md §7 API 엔드포인트` 응답 예시
- 위반 규약: `spec/conventions/swagger.md §2-5` — "응답 wrapping: 프로젝트는 `TransformInterceptor`로 모든 성공 응답을 `{ data: ... }`로 감싼다. Swagger 응답 스키마 표기 시에도 이 구조를 반영"
- 상세: 문서 내에 `> 응답 본문은 공통 래퍼({ "data": ... })로 감싸진다. 아래 예시는 data 내부 형태다.` 라는 명시적 안내문이 있어 독자에게 래퍼 존재를 알린다. swagger.md 의 적용 대상은 Swagger 데코레이터 코드 패턴이며 spec 문서 자체를 직접 규제하지는 않는다. INFO 수준.
- 제안: 없음 (명시적 안내문으로 충분히 커버됨).

### 6. **[INFO]** `14-execution-history.md` — 응답 예시가 `data` + `pagination` 최상위 래퍼 구조를 직접 표기하여 규약과 일치함
- target 위치: `spec/2-navigation/14-execution-history.md §5 API 엔드포인트` 목록 응답 JSON 예시
- 위반 규약: 없음
- 상세: 목록 API 응답이 `{ "data": [...], "pagination": {...} }` 형태로 래퍼 포함하여 기술하고 있다. `spec/conventions/swagger.md §5-2` `ApiOkPaginatedResponse` 규약 및 api-convention §5.2 와 정합. 긍정적 확인.
- 제안: 없음.

### 7. **[WARNING]** `14-execution-history.md` §5 — 목록 API 경로가 `/api/executions/workflow/:workflowId` 이나 표준 RESTful endpoint 명명 규약 관점 확인 필요
- target 위치: `spec/2-navigation/14-execution-history.md §5 API 엔드포인트` — `GET /api/executions/workflow/:workflowId`
- 위반 규약: `spec/conventions/swagger.md` 및 `spec/5-system/2-api-convention.md` 에서 RESTful 경로 규칙 확인 필요. 직접적인 금지 명시는 없으나 `GET /api/workflows/:id/executions` 가 더 계층적으로 자연스러운 REST 구조.
- 상세: 다른 spec 문서들(1-workflow-list §3, 14-execution-history §4.2-4.3 등)에서 프론트엔드 라우팅 경로는 `/workflows/:id/executions` 로 일관되지만, 백엔드 API endpoint 는 `GET /api/executions/workflow/:workflowId` 를 쓴다. 이 불일치는 설계 의도일 수 있으나 `spec/5-system/2-api-convention.md` 가 target payload 에 포함되지 않아 직접 검증이 불가하다. 또한 현재 상태로 구현이 완료(status: implemented)되어 있어 규약 위반보다 설계 결정에 가깝다.
- 제안: `spec/5-system/2-api-convention.md` RESTful 경로 규약과 대조 확인. 의도적 분리라면 `14-execution-history.md Rationale` 에 기록 추가를 권장.

---

## 요약

`spec/2-navigation/` 전체 파일군은 정식 규약(`spec/conventions/**`)을 전반적으로 잘 준수하고 있다. 가장 유의미한 관측은: (1) `14-execution-history.md` 만 `## Overview` 섹션 + 요구사항 표를 갖추고 나머지 파일은 그렇지 않아 내부 구조 일관성이 부재하나, CLAUDE.md 는 이를 "권장"으로만 규정하므로 강제 위반은 아니다. (2) `10-auth-flow.md` 의 OAuth `lower_snake_case` 에러 코드는 `error-codes.md §3` 레지스트리에 정식 등재되어 규약 준수로 처리된다. (3) `16-agent-memory.md` 의 `id: nav-agent-memory` 는 basename 충돌 회피를 위한 규약 명시 패턴으로, 위반 아님. CRITICAL 또는 WARNING 등급의 정식 규약 직접 위반은 발견되지 않았으며, WARNING 하나는 백엔드 API 경로 명명의 설계 의도 확인 권장 수준이다.

---

## 위험도

LOW
