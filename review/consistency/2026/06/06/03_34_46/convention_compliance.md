# 정식 규약 준수 검토 결과

검토 모드: --impl-done, scope=spec/5-system, diff-base=origin/main
검토 대상: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md`, `spec/conventions/cafe24-api-catalog/_overview.md`, `spec/conventions/cafe24-api-catalog/application.md`, `spec/conventions/cafe24-api-catalog/application/apps.md`, `spec/conventions/cafe24-api-catalog/application/appstore-orders.md`

---

## 발견사항

### [INFO] 1-auth.md — Overview / 본문 / Rationale 3섹션 구조에 Overview 섹션 제목 없음
- **target 위치**: `spec/5-system/1-auth.md` 전체 구조
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "Overview / 본문 / Rationale 3섹션 권장"
- **상세**: 문서 본문이 §1~§5 + Rationale 로 구성되어 있지만 명시적인 `## Overview` 섹션 제목이 없다. `10-graph-rag.md` 는 `## Overview (제품 정의)` 섹션을 갖춰 권장 구조를 따른다. `1-auth.md` 는 최상단 관련 문서 링크 바로 다음에 `## 1. 인증 (Authentication)` 으로 진입해 Overview 레이어가 생략되어 있다.
- **제안**: `## Overview` 섹션을 추가하거나 `_product-overview.md` 에 명시적으로 위임하는 링크를 서두에 선언. 단, 본 문서가 순수 기술 spec 으로 분류됐고 `_product-overview.md` 가 동일 디렉토리에 존재하므로 INFO 수준.

---

### [WARNING] 1-auth.md §1.5.4 — 에러 코드 historical-artifact 레지스트리 등재 대상 이름 불일치
- **target 위치**: `spec/5-system/1-auth.md §1.5.4 에러 응답` 인라인 주석
- **위반 규약**: `spec/conventions/error-codes.md §3 Historical-artifact 예외 레지스트리` 표
- **상세**: `1-auth.md §1.5.4` 의 주석은 에러 코드 `forbidden` / `rate_limited` 가 초대 흐름 전용 historical artifact 로 레지스트리에 등재됐다고 설명한다. 실제 `error-codes.md §3` 레지스트리 표에는 `invitation_not_found` · `invitation_expired` · `invitation_already_used` · `invitation_email_mismatch` · `forbidden` · `rate_limited` 가 열거되어 있고, 두 문서의 내용은 일치한다. 그러나 `1-auth.md §1.5.4` 표의 에러 코드 값(`invitation_not_found`, `invitation_expired`, `invitation_already_used`, `invitation_email_mismatch`, `forbidden`, `rate_limited`)이 `lower_snake_case` 임을 본문에서 명시했음에도, 정작 `error-codes.md §3` 테이블의 "코드" 열에서 `forbidden` · `rate_limited` 항목 설명 본문("초대 흐름 전용 historical artifact — 다른 영역의 `UPPER_SNAKE_CASE` 범용 코드와 별개")이 spec 본문과 완전히 정합하지 않는다. `1-auth.md` 에서 "본 `forbidden`/`rate_limited` (lowercase) 는 초대 흐름 전용" 이라고 명시하지만 `error-codes.md §3` 의 같은 row 설명에는 이 강조가 나타나지 않아 양방향 참조자에게 혼동 가능성이 있다.
- **제안**: `error-codes.md §3` 의 `forbidden`·`rate_limited` row 에 "초대 흐름 한정" 단서를 명시적으로 추가해 `1-auth.md §1.5.4` 의 강조와 동기화. (이미 링크는 있으므로 단어 1~2개 추가로 충분.)

---

### [INFO] 10-graph-rag.md — Overview 내부 구현 상태 이모지 사용
- **target 위치**: `spec/5-system/10-graph-rag.md §Overview (제품 정의)` 구현 상태 블록
- **위반 규약**: 직접적인 이모지 금지 규약은 `spec/conventions/` 에 없으나 CLAUDE.md 프로젝트 지침에서 "파일에 이모지 작성 금지"를 선언
- **상세**: `## Overview (제품 정의)` 블록 안에 `✅ **P0~P2 구현 완료**` 형태로 이모지가 사용되어 있다. 요구사항 표(`§3`)에도 상태 컬럼에 `✅` 이모지가 반복 등장한다. CLAUDE.md 는 "Only use emojis if the user explicitly requests it. Avoid writing emojis to files unless asked." 를 명시한다.
- **제안**: `✅` 를 텍스트 상태 표지로 대체 (예: `[완료]`, `implemented`, `done`). 단 이미 merge 된 spec 파일이고 일관성 목적이라면 규약 갱신 시 일괄 처리해도 무방한 수준.

---

### [WARNING] 10-graph-rag.md — `## 1. 개요` 섹션과 `## Overview (제품 정의)` 섹션 중복 구조
- **target 위치**: `spec/5-system/10-graph-rag.md §1. 개요` vs `§ Overview (제품 정의)`
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "Overview / 본문 / Rationale 3섹션 권장"
- **상세**: 이 파일은 `## Overview (제품 정의)` (요구사항·범위·단계별 도입 등 제품 정의)와 별도로 `## 1. 개요` (기술 개요)를 동시에 갖는다. 권장 구조는 Overview → 본문 → Rationale 이며 `## 1. 개요` 는 본문 최초 섹션으로 이해할 수 있으나, 문서 상단의 Overview 섹션에도 § 1. 목표 / §2. 범위 / §3. 요구사항 / §4. 기술 결정 사항 등 본문급 내용이 포함되어 있어 두 계층이 사실상 중복 역할을 한다. 독자 입장에서는 "제품 정의"(상단 Overview 블록) 와 "기술 개요"(§1 개요) 의 경계가 모호하다.
- **제안**: `## Overview (제품 정의)` 를 순수 제품 정의(목표, 사용자 가치, 범위 개요)로 축약하고, 기술적 상세(데이터 모델, 파이프라인, API 등)는 본문 섹션(§1~)에 통합. 또는 현 구조를 이 파일의 관행으로 인정한다면 `CLAUDE.md` 에서 "spec-only 문서는 PRD(제품 정의) + 기술 명세를 하나로 통합 가능"이라는 명시가 필요.

---

### [INFO] 11-mcp-client.md — `skipReason` 값이 `lower_snake_case` 임을 명시하나 규약 참조 방식 불완전
- **target 위치**: `spec/5-system/11-mcp-client.md §6.2 진단 누적 skipReason vocabulary`
- **위반 규약**: `spec/conventions/node-output.md §3.2` — `code` 는 `UPPER_SNAKE_CASE`
- **상세**: 문서가 `skipReason` 값을 `lower_snake_case` 로 의도적으로 정의하고, 이것이 `node-output.md §3.2` 의 `code` 규약과 구분된다는 설명을 포함한다. 이 설계는 합리적이나, "`skipReason` 은 에러 코드가 아닌 운영 진단용 enum" 이라는 구분의 근거가 본 spec 본문에만 있고 `error-codes.md` 나 `node-output.md` 에 역참조(back-reference)가 없다. 즉, 다른 검토자가 `skipReason` 값을 보면 `error-codes.md §3 historical-artifact` 에 해당하는지 확인하러 갈 가능성이 있다.
- **제안**: `11-mcp-client.md §6.2` 의 설명이 충분하므로 현 상태도 허용 가능. 원한다면 `error-codes.md §1` (적용 범위) 에 "`skipReason` 같은 진단용 내부 enum 은 `code:` SoT 범위 밖" 을 한 줄 추가하면 규약 경계가 명확해진다.

---

### [INFO] 11-mcp-client.md — `## 1. 개요` 가 Overview 섹션 역할을 겸함 (3섹션 구조 미정렬)
- **target 위치**: `spec/5-system/11-mcp-client.md §1. 개요`
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "Overview / 본문 / Rationale 3섹션 권장"
- **상세**: 이 문서는 `## 1. 개요` 로 시작하며 Overview 별도 섹션이 없다. 권장 구조는 `## Overview` → 본문 → `## Rationale` 이다. 10-graph-rag.md 와 달리 이 파일은 Overview 블록 자체가 없어 제품 정의와 기술 명세의 경계가 `## 1. 개요` 한 섹션에 혼재한다.
- **제안**: `## Overview` 섹션을 `## 1. 개요` 앞에 추가하거나, 현 `## 1. 개요` 를 `## Overview` 로 개명하고 세부 기술 섹션을 `## 2. Transport` 부터 시작하도록 번호 재정렬. 단 후자는 기존 `§2.1`, `§2.3` 등 내부 상호참조 갱신 필요.

---

### [WARNING] cafe24-api-catalog/_overview.md — `_overview.md` 파일에 spec frontmatter (`id`/`status`) 부재
- **target 위치**: `spec/conventions/cafe24-api-catalog/_overview.md` 파일 시작
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1 적용 대상` + `§2 Frontmatter 스키마`
- **상세**: `spec/conventions/**.md` 는 frontmatter 의무 대상이다. `_overview.md` 는 basename 이 `_*.md` (밑줄 prefix) 이므로 `spec-impl-evidence.md §1` 의 제외 규칙(`spec/_*.md` 및 `spec/<영역>/_*.md`)에 해당한다. 따라서 frontmatter 가드 면제가 **정상**이다. 다만 이 파일의 제외 근거가 "layout/index 성격" 이라는 주석이 `spec-impl-evidence.md §1` 에 있는 반면, `_overview.md` 는 사실상 카탈로그 전체 구조를 정의하는 핵심 컨벤션 문서다. frontmatter 의무가 면제되어도 문서 역할(컨벤션 SoT)과 파일명(`_overview.md`)의 의미(layout/index)가 어긋날 수 있다.
- **제안**: 현 상태는 가드 통과 기준으로 올바르다(WARNING이 아닌 INFO 수준일 수 있음). 단 `spec-impl-evidence.md §1` 의 `_*.md` 면제 설명에 "카탈로그 진입 컨벤션 문서(`_overview.md`)도 포함" 을 명시해 의도성을 명확히 하면 후속 검토자의 혼동을 줄일 수 있다.

---

### [INFO] cafe24-api-catalog/application.md — `## Field-level 상세 카탈로그` 섹션 구조 추가 (Rationale 없음)
- **target 위치**: `spec/conventions/cafe24-api-catalog/application.md` 전체
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "Overview / 본문 / Rationale 3섹션 권장, 결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`"
- **상세**: `application.md` 는 endpoint 표(본문)와 field-level 상세 카탈로그 링크 목록을 포함하지만 `## Rationale` 섹션이 없다. 이 파일은 카탈로그 레퍼런스 성격이 강하고, 결정 근거는 `_overview.md` 에 집중되어 있으므로 파일 자체의 Rationale 생략이 현실적으로 이해 가능하다. 단, "`applications_list` / `webhooks_list` docs 부재 seed" 관련 배경 설명이 본문 주석으로 처리되어 있는데, 이 결정 사유는 Rationale 섹션이 더 적합한 위치다.
- **제안**: `## Rationale` 섹션을 추가하고 "docs 부재 seed 유지 결정"(`applications_list` / `webhooks_list`) 의 근거를 이동. 단, 카탈로그 파일들이 일관되게 Rationale 을 갖지 않으므로 `_overview.md` 에서 이 패턴을 허용한다고 명시하면 INFO 수준으로 수용 가능.

---

### [INFO] cafe24-api-catalog/application/apps.md 및 appstore-orders.md — field-level 파일에 spec frontmatter 완전 면제 확인 (정상)
- **target 위치**: `spec/conventions/cafe24-api-catalog/application/apps.md`, `spec/conventions/cafe24-api-catalog/application/appstore-orders.md`
- **위반 규약**: 해당 없음 (면제 정상 확인)
- **상세**: 두 파일의 frontmatter 가 `resource`/`entity`/`cafe24_docs`/`source` 키만 보유하고 `id`/`status` 를 갖지 않는 것은 `spec-impl-evidence.md §1` 제외 규칙(`spec/conventions/<name>-api-catalog/<resource>/**/*.md`)에 의해 **정상**이다. 생성기 산출물 레퍼런스로 lifecycle 추적 대상이 아님이 `_overview.md §7.1` 에도 명시되어 있다.
- **제안**: 조치 불필요. 현 상태가 규약에 정합한다.

---

### [WARNING] 10-graph-rag.md — `document:graph_error` dead-declared 이벤트와 WebSocket 이벤트 표 간 불일치
- **target 위치**: `spec/5-system/10-graph-rag.md §6 WebSocket 이벤트` 표 및 주석
- **위반 규약**: `spec/conventions/node-output.md` Principle 0 — 5필드 불변 / 정식 규약과 구현 사이 gap 은 `spec-impl-evidence.md §3 partial` 로 처리
- **상세**: `§6 WebSocket 이벤트` 표에 `document:graph_error` 가 등장하지 않으면서, 주석에 "타입 union 에만 dead-declared, 미emit" 이라고 설명한다. 즉 spec 본문 표는 실제 emit 되는 5개 이벤트만 열거하고 dead-declared 항목은 표에서 제외했다. 이는 spec 문서 자체로는 정합하나, 구현 코드(`websocket.service.ts`) 가 이 이벤트를 타입으로 선언하지만 실제로 emit 하지 않는다는 사실이 spec 표에서 완전히 드러나지 않아 코드 검토자가 혼동할 수 있다. 또한 이 dead-declared 항목의 정리(삭제 또는 emit 추가)를 위한 `pending_plans` 언급이 없다.
- **제안**: spec `§6` 표 아래 주석에 이미 설명이 있으므로 크게 문제되지 않는다. 그러나 코드 측 dead-declaration 을 정리하려면 해당 cleanup 을 `pending_plans` 에 연결하거나 plan 에 언급해야 한다. 단, 본 spec 은 `status: implemented` 이므로 구현 정합성 gap 이 있는 이 항목은 `partial` 로 정정 또는 별도 minor plan 이 필요할 수 있다.

---

### [CRITICAL] 11-mcp-client.md — `status: partial` 이지만 `pending_plans` 참조 plan 파일의 존재 여부 확인 필요
- **target 위치**: `spec/5-system/11-mcp-client.md` frontmatter `pending_plans:`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4` — `spec-pending-plan-existence.test.ts` 가드 — `pending_plans:` 의 모든 path 가 `plan/in-progress/` 또는 `plan/complete/` 에 실존 의무
- **상세**: `11-mcp-client.md` 의 frontmatter `pending_plans:` 에 `plan/in-progress/spec-sync-mcp-client-gaps.md` 가 등록되어 있다. 본 검토는 해당 파일의 실존을 직접 확인하지 못했으나(prompt 의 diff 제공 범위 밖), 만약 이 plan 파일이 `plan/in-progress/` 에 실존하지 않으면 `spec-pending-plan-existence.test.ts` 가드가 build-time 에 실패한다. 이는 CRITICAL — spec frontmatter 가 가리키는 plan 파일 부재는 build 차단 요건이다.
- **제안**: `plan/in-progress/spec-sync-mcp-client-gaps.md` 파일이 실존하는지 확인. 없다면 즉시 생성하거나 `pending_plans:` 에서 해당 경로를 제거해야 한다. 단, 이 plan 파일의 실존 여부는 본 정식 규약 검토의 범위 바깥(코드베이스 state 확인 필요)이므로, 만약 파일이 실제로 존재한다면 이 항목은 FALSE POSITIVE 다.

---

### [INFO] 전체 — `spec/5-system/` 파일들 응답 봉투 형식 참조가 복수 SoT 로 분산
- **target 위치**: `spec/5-system/1-auth.md §1 인증 표`, `spec/5-system/10-graph-rag.md §4.3 출력 메타데이터`
- **위반 규약**: `spec/conventions/error-codes.md §Overview` — "응답 봉투(envelope) 형식 SoT 는 `5-system/3-error-handling.md §2.1` · `5-system/2-api-convention.md §5.3`"
- **상세**: `1-auth.md §1 표`의 `비밀번호 분실` 항목에 `200 { data: { message } }` 라는 인라인 응답 예시가 있다. 이 형식은 `api-convention.md §5.3` 의 `{ data: ... }` 봉투와 일치하므로 정합 자체는 문제없다. 다만 spec 파일들이 응답 봉투 구조를 각자 인라인으로 표기하는 패턴이 반복되고 있어, 봉투 형식이 변경될 경우 여러 파일을 일일이 갱신해야 하는 risk 가 있다.
- **제안**: `api-convention.md §5.3` 을 단일 SoT 로 유지하고, 각 spec 에서 인라인 봉투 형식 표기 대신 링크 참조로 대체하는 것을 권장. 단, 이해 편의를 위한 인라인 예시가 가독성에 기여하므로 INFO 수준 의견.

---

## 요약

`spec/5-system/` 대상 3개 파일과 `spec/conventions/cafe24-api-catalog/` 대상 파일들을 정식 규약(`spec/conventions/`) 기준으로 검토했다. CRITICAL 항목 1건은 `11-mcp-client.md` 의 `pending_plans:` 참조 plan 파일 실존 여부로, build-time 가드(`spec-pending-plan-existence.test.ts`)에 의해 자동 검증되므로 실제 파일이 존재한다면 문제없다. WARNING 항목은 에러 코드 레지스트리 설명 불일치(1-auth ↔ error-codes 간 단서 미동기), Overview/본문 구조 혼재(10-graph-rag), `_overview.md` 면제 의도 명시 부족, `document:graph_error` dead-declared 항목의 plan 연결 부재 등으로, 규약 위반이 명백하지는 않으나 개선이 권장된다. 전반적으로 spec 파일들은 frontmatter 스키마, `id`/`status` 라이프사이클, 에러 코드 표기(historical-artifact 레지스트리 포함)를 대체로 잘 준수하고 있으며, `cafe24-api-catalog` 카탈로그 파일들도 면제 규칙이 올바르게 적용된 상태다.

## 위험도

MEDIUM
