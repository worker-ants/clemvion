### 발견사항

- **[WARNING] 필드-레벨 entity 파일명이 §7.1 이 정의한 "kebab-case = docs anchor 와 동일 형식" 규칙과 실제로 다름**
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` §7.1 (`<entity_id>` 정의) 및 `spec/conventions/cafe24-api-catalog/category/categories__decorationimages.md`, `.../category/categories__seo.md` 등 (전체 222개 중 67개, 예: `order/orders__items.md`, `promotion/coupons__issues.md`)
  - 위반 규약: 자기 자신(`_overview.md §7.1`) — "`<entity_id>` 는 Cafe24 docs 의 sub-resource 식별자 (kebab-case — docs anchor 식별자와 동일 형식, 예: `appstore-orders`)."
  - 상세: 실제로는 두 가지 별개 구분자를 쓴다 — 한 path segment 내부 복합어는 `-`(예: `appstore-orders`), **중첩 path segment 경계는 `__`(이중 언더스코어)**(예: `categories__decorationimages` ↔ docs anchor 는 `categories--decorationimages`, 이중 하이픈). `_generator.py` (`render_entity`, `anchor=e['id'].replace('_','-')`) 를 보면 이 치환이 의도된 결정적 규칙임이 확인되지만, `_overview.md §7.1` 은 이를 전혀 언급하지 않고 "kebab-case, docs anchor 와 동일 형식" 이라고만 서술해 실제 동작(언더스코어 사용, anchor 와 문자 자체가 다름)과 어긋난다. 222개 중 67개(30%)에 영향을 미치는 체계적 패턴이라 우연한 오타가 아니라 미문서화된 규칙이다.
  - 제안: §7.1 에 "이중 언더스코어(`__`)는 중첩 API path segment 경계, 단일 하이픈(`-`)은 한 segment 내 복합어 결합" 규칙을 명시적으로 추가. 손으로 새 entity 파일을 추가하는 유지보수자가 규칙을 정확히 따르도록 규약 문서를 실제 생성기 동작에 맞춰 갱신 필요.

- **[INFO] 카탈로그 최상위 문서에 명시적 `## Overview` 헤더 부재**
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` (도입부, `## 1. 디렉토리 구조` 이전), `application.md`, `category.md` (frontmatter 직후 제목·표만 존재)
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장 사항
  - 상세: `_overview.md` 는 `## Rationale` 섹션은 갖췄으나 라벨링된 `## Overview` 헤더 없이 비표제 도입 문단으로 대체한다. `application.md`/`category.md` 는 Rationale 섹션 자체도 없다 (카탈로그 성격상 결정 근거가 적을 수 있어 이해되나, 3섹션 권장과는 형식적으로 다름). `audit-actions.md` 는 반대로 `## Overview`/`## Rationale` 을 모두 명확히 갖춰 대조된다.
  - 제안: "권장" 수준이라 CRITICAL 은 아니며, 카탈로그류 reference 문서는 성격이 달라 실용적으로 생략 가능하다는 점을 컨벤션에 명시하거나(면제 문서화), 일관성을 위해 `## Overview` 라벨만이라도 붙이는 것을 고려.

- **[INFO] §2 id 정의의 "resource" 용어가 두 레벨을 혼용**
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` §2 (표 컬럼 정의, `id` 행)
  - 상세: §2 는 `id` 를 `<resource>_<verb>` 형식이라 정의하지만 실제로는 `resource` 가 카탈로그 파일명(Cafe24Resource enum, 예: `application`)이 아니라 그 하위 API sub-resource(예: `scripttags`, `appstore_orders`, `mains`, `autodisplay`)를 가리킨다 — `application.md` 의 id 는 `application_*` 이 아니라 `scripttags_list`/`apps_update` 식이고, `category.md` 도 `category_*` 외에 `mains_*`/`autodisplay_*` 가 섞여 있다. 동작 자체는 전체적으로 일관돼 있어 CRITICAL 은 아니지만, §1(디렉토리 구조 "resource 이름은 Cafe24Resource enum 과 1:1")과 §2("id: `<resource>_<verb>`")가 같은 단어를 다른 대상에 써 처음 읽는 사람에게 혼동을 줄 수 있다.
  - 제안: §2 예시에 "여기서 resource 는 카탈로그 파일이 아니라 해당 operation 이 속한 API sub-resource 세그먼트" 라는 단서를 추가.

- **[검증 완료 — 위반 없음]** `spec/conventions/audit-actions.md` 의 도메인별 분류 레지스트리(§3)는 `codebase/backend/src/modules/audit-logs/audit-action.const.ts` (HEAD 워킹트리, 절대경로로 직접 확인)의 `AUDIT_ACTIONS` 와 정확히 일치한다 (integration 6종, workspace 3종, member 3종, execution 1종, auth_config 5종, user 4종). "미구현" 표기(workflow/trigger/schedule/model_config)도 실제로 const 에 없음을 확인. CRITICAL 없음.
  - `spec/conventions/cafe24-api-catalog/application.md`·`category.md` 의 Coverage Matrix 행 수·"Field-level 상세 카탈로그" 목록의 field/ops 개수 표기는 실제 표·응답 속성 행 수와 전부 일치 (직접 카운트 검증).

- **[참고 — 실제 diff 는 규약 위반 없음]** `origin/main...HEAD` 의 `spec/conventions/` 변경분은 4개 파일·4줄뿐이다 (`git diff --stat` 확인): `cross-node-warning-rules.md`·`execution-context.md`·`node-cancellation.md` 의 `plan/in-progress/parallel-p2-followups.md` → `plan/complete/parallel-p2-followups.md` 링크 정정(실제로 해당 plan 이 `plan/complete/` 로 이동했음을 `ls` 로 확인 — 정당한 dead-link 예방 수정), `spec-impl-evidence.md` 의 `spec-link-integrity.test.ts` 대상 범위 서술 정정(실제 테스트 코드 주석 `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` 과 대조해 정확함을 확인). 이 4건은 규약 위반이 아니라 오히려 기존 부정확한 서술을 바로잡는 개선이다.

### 요약
실제 `origin/main` 대비 diff 범위(`spec/conventions/` 4개 파일 링크·서술 정정)는 규약 위반이 없고 오히려 이전의 부정확한 서술(plan 경로·가드 대상 범위)을 바로잡는 정당한 수정이다. payload 로 함께 제공된 `spec/conventions/` 광역 스냅샷(`audit-actions.md`, `cafe24-api-catalog/**`)을 대조 검증한 결과 카탈로그 데이터 정합성(coverage matrix, field/ops 카운트, `AUDIT_ACTIONS` 코드 일치)은 우수했고 CRITICAL 급 위반은 발견되지 않았다. 다만 field-level entity 파일명의 이중 언더스코어(`__`) 경로-구분 규칙이 `_overview.md §7.1` 이 명시한 "kebab-case, docs anchor 와 동일 형식" 서술과 실제로 어긋나는 미문서화 패턴(67/222 파일 영향)이 WARNING 으로 확인됐고, 카탈로그 최상위 문서들의 `## Overview` 헤더 부재·"resource" 용어 혼용은 INFO 수준의 사소한 개선 여지다.

### 위험도
LOW