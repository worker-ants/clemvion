# Convention Compliance Review — `spec/2-navigation/`

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/2-navigation/, diff-base=origin/main)
검토 일시: 2026-06-11

---

## 발견사항

### [INFO] `14-execution-history.md` — `## Overview` 섹션이 중복 헤더 구조를 형성하며 `## Rationale` 누락

- **target 위치**: `spec/2-navigation/14-execution-history.md` — 최상위 섹션 구조
- **위반 규약**: CLAUDE.md "문서 구조 규약" — "Overview / 본문 / Rationale 3섹션 권장"
- **상세**: 이 파일은 `## Overview (제품 정의)` 를 상단에 두고 그 아래에 다시 `## 1. 개요` (동일 내용 반복처럼 보이는 번호 섹션)를 추가한다. 또한 파일 끝에 `## Rationale` 섹션이 없다 — 설계 결정(Overview 섹션을 왜 분리했는지, 2단계 페이지 구조 선택 이유 등)에 대한 근거가 명시되지 않는다. 다른 파일(0-dashboard, 1-workflow-list 등)은 모두 `## Rationale` 로 종결한다.
- **제안**: `## Overview (제품 정의)` 와 `## 1. 개요` 의 역할을 명시적으로 분리하거나, Overview 를 서두 블록(frontmatter 이후 인트로)으로 처리하고 별도 번호 섹션 `## 1. 개요` 를 제거하여 중복을 줄인다. `## Rationale` 섹션을 추가한다(예: 2단계 페이지 구조 선택, EH-NAV-04 AI 도구 설계 근거 등).

---

### [INFO] `10-auth-flow.md` — `## 2` 하위 섹션 번호 순서 불일치 (§2.4 → §2.6 → §2.5)

- **target 위치**: `spec/2-navigation/10-auth-flow.md` — `### 2.4 처리 플로우` / `### 2.6 초대 토큰을 통한 가입` / `### 2.5 이메일 인증 안내 화면` (실제 파일 내 순서)
- **위반 규약**: CLAUDE.md "문서 구조 규약" — 암묵적 문서 가독성 기준. 정식 규약이 번호 순서를 명시하지는 않으나 섹션 번호가 물리적 순서와 어긋나면 레퍼런스 오용 위험이 있다.
- **상세**: 파일 내 물리적 등장 순서는 §2.4 → §2.6 → §2.5 다. §2.6(초대 토큰 가입)이 §2.5(이메일 인증 안내)보다 먼저 나오는 구조라 독자가 번호 기반 레퍼런스를 추적할 때 혼란이 생긴다.
- **제안**: §2.5 와 §2.6 의 물리적 순서를 번호와 일치하도록 재배열하거나, 번호를 물리적 순서에 맞게 재부여한다.

---

### [INFO] `7-statistics.md`, `8-marketplace.md` — `## Rationale` 섹션 누락

- **target 위치**: `spec/2-navigation/7-statistics.md` 파일 전체 / `spec/2-navigation/8-marketplace.md` 파일 전체
- **위반 규약**: CLAUDE.md "문서 구조 규약" — "Overview / 본문 / Rationale 3섹션 권장". 각 skill SKILL.md 도 Rationale 구성을 권장한다.
- **상세**: 두 파일 모두 `## Rationale` 섹션 없이 API 표로 끝난다. `8-marketplace.md` 는 `status: backlog` 라 설계 결정이 아직 확정되지 않았을 수 있으나, `7-statistics.md` 는 `status: implemented` 로 완성 spec 이다. 완성 spec 에서 Rationale 가 없으면 설계 근거가 사라진다(예: 통계 쿼리 파라미터를 `workflowId` camelCase 로 한 이유, LLM Usage 통계 포함 결정 등).
- **제안**: `7-statistics.md` 에는 구현 과정 또는 이전 sync 에서 결정된 사안(예: `workflow_id` 가 아닌 `workflowId` camelCase 사용 이유)을 `## Rationale` 에 기록한다. `8-marketplace.md` 는 `backlog` 상태이므로 INFO 수준으로만 표기한다.

---

### [WARNING] `14-execution-history.md` §5 목록 API 응답 형식 — `spec/conventions/swagger.md §5-2` 의 페이지네이션 래핑 구조와 불일치

- **target 위치**: `spec/2-navigation/14-execution-history.md` §5 "목록 API 응답 형식" 코드 블록
- **위반 규약**: `spec/conventions/swagger.md §5-2` — `ApiOkPaginatedResponse` 는 `{ data: { data: <Dto>[], pagination: { ... } } }` 구조 (pagination 이 `data` 래퍼 안에 있음)
- **상세**: `spec/conventions/swagger.md §5-2` 에 따르면 페이지네이션 응답의 최상위는 `{ data: { data: [...], pagination: {...} } }` 다(TransformInterceptor 의 `{data}` 래핑이 PaginatedResponseDto 전체를 감싼다). 그러나 `14-execution-history.md §5` 의 예시는 `{ "data": [...], "pagination": {...} }` (pagination 이 최상위)로 표기하고 있다. `spec/5-system/2-api-convention.md §5.2` 도 같은 `{ "data": [...], "pagination": {...} }` 형식을 사용하므로, 두 컨벤션 문서 자체가 상충하는 상황이다. 이 상태에서 `14-execution-history.md` 는 `api-convention §5.2` 를 따르고 있으나, `swagger.md §5-2` 와는 어긋난다.
  - 참고: `1-workflow-list.md §3` 에도 "페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수"라고만 명시하고 있어 `api-convention §5.2` 를 SoT 로 쓰는 패턴이 `2-navigation/` 전체의 일관된 방향이다.
- **제안**: `spec/conventions/swagger.md §5-2` 와 `spec/5-system/2-api-convention.md §5.2` 중 어느 쪽이 실제 런타임 응답의 SoT 인지 명확히 결정한 후, 어긋나는 쪽을 갱신한다. `14-execution-history.md §5` 는 결정 후 해당 SoT 와 일치하도록 수정한다. 이 결정이 없는 한 `14-execution-history.md` 는 현행 `api-convention §5.2` 를 따르고 있으므로 단독으로는 규약 위반이라 단정하기 어렵다.

---

### [INFO] `10-auth-flow.md` §2.6 — `lower_snake_case` 에러 코드 직접 참조

- **target 위치**: `spec/2-navigation/10-auth-flow.md` §2.6 "초대 토큰을 통한 가입", 7번 단계
- **위반 규약**: `spec/conventions/error-codes.md §1` — `UPPER_SNAKE_CASE` 원칙. §3 Historical-artifact 예외 레지스트리에 `invitation_email_mismatch`, `invitation_expired`, `invitation_already_used` 가 등재되어 있으나, `invitation_not_found` 는 **레지스트리에 없다** (auth-flow §2.6 의 7번 에러 분기에는 `invitation_not_found` 가 언급되지 않지만, 동 코드에서 나오는 코드들이 `spec/conventions/error-codes.md §3` 의 목록과 동일한지 확인이 필요).
- **상세**: `10-auth-flow.md §2.6` 은 `invitation_email_mismatch`, `invitation_expired`, `invitation_already_used` 세 코드를 언급한다. 이 세 코드는 `error-codes.md §3` 의 Historical-artifact 예외 레지스트리에 등재된 공식 예외이므로, **spec 이 이 코드를 lowercase 로 표기하는 것 자체는 규약상 허용**된다. 단, 본 파일이 이 코드들이 예외 레지스트리에 있는 historical artifact 임을 독자에게 알리는 cross-reference 가 없다.
- **제안**: 해당 에러 코드 옆에 `(error-codes.md §3 예외)` 또는 주석으로 historical artifact 임을 명시하면 가독성이 높아진다. 현 상태는 규약 위반은 아니나 컨텍스트 제공 면에서 미흡하다.

---

## 요약

`spec/2-navigation/` 는 전반적으로 정식 규약을 잘 준수하고 있다. 모든 파일에 `id` / `status` frontmatter 가 있고 `partial` 상태에는 `pending_plans` 가 등재되어 있다. 에러 코드는 `UPPER_SNAKE_CASE` 를 준수하며, lowercase 예외 코드도 `error-codes.md §3` 레지스트리에 등재된 historical artifact 만 사용한다. API endpoint 명명은 kebab-case REST 패턴이 일관되고, DTO 이름도 `<Domain>ResponseDto` / `<Domain>Dto` 패턴을 따른다. 주요 지적 사항은 (1) `14-execution-history.md` 의 `## Rationale` 누락 및 Overview/본문 중복 헤더, (2) `10-auth-flow.md` 의 §2.4→§2.6→§2.5 비순차 번호, (3) `7-statistics.md` 의 `## Rationale` 누락, (4) `spec/conventions/swagger.md §5-2` 와 `spec/5-system/2-api-convention.md §5.2` 간 페이지네이션 응답 구조 불일치(target 파일 자체의 직접 위반이 아닌 상위 컨벤션 간 충돌)다. 모두 CRITICAL 위반은 없다.

## 위험도

LOW
