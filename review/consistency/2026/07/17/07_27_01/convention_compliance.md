### 발견사항

- **[WARNING] `cafe24-api-catalog` field-level entity id 의 "kebab-case" 규정과 실제 산출물(30%) 불일치**
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md §7.1` ("`<entity_id>` 는 Cafe24 docs 의 sub-resource 식별자 (kebab-case — docs anchor 식별자와 동일 형식, 예: `appstore-orders`)")
  - 위반 규약: 본 컨벤션 자기 자신(§7.1)이 선언한 명명 규칙
  - 상세: 실제 HEAD 워크트리를 전수 확인한 결과 (`git ls-tree -r --name-only HEAD spec/conventions/cafe24-api-catalog/ | grep __`), 222개 field-level 파일 중 **67개(약 30%)** 가 `__`(더블 언더스코어) 를 쓴다 — 예: `category/categories__decorationimages.md`(frontmatter `cafe24_docs: .../#categories--decorationimages`), `order/orders-inflowgroups__inflows.md`(anchor `#orders-inflowgroups--inflows`), `supply/suppliers-users__regionalsurcharges-setting.md`(anchor `#suppliers-users--regionalsurcharges-setting`). 세 예시를 대조하면 규칙이 명확하다 — Cafe24 공식 docs anchor 의 **더블 하이픈(`--`)**(두 sub-resource 결합을 의미)은 entity id/파일명에서 **더블 언더스코어(`__`)** 로 치환되고, 단일 하이픈(`-`, 한 토큰 내부 복합어)은 그대로 유지된다(`orders-inflowgroups`, `subscription-shipments`, `suppliers-users`, `regionalsurcharges-setting` 등). 이는 우연이 아니라 67개 파일에 걸쳐 일관되게 적용된 생성기의 의도된 규칙이지만, `_overview.md` 어디에도 이 `--`→`__` 치환 규칙이 문서화돼 있지 않다(`grep -n -i '__|underscore|더블|이중'` 로 전수 확인 — 유일하게 걸리는 문장은 §7.3 의 "code 엔드포인트 URL 의 `<data-resource>` 는 entity id 의 hyphen 을 underscore 로 치환한 값" 뿐이며, 이는 entity id → fetch URL 파생 규칙이지 entity id 자체의 명명 규칙 서술이 아니다). §7.1 의 "kebab-case" 라는 문언만 보면 이 67개 파일이 규약 위반처럼 보이지만, 실제로는 규약 쪽이 자신이 생성한 산출물의 실제 패턴을 다 담지 못한 것이다.
  - 제안: `_overview.md §7.1` 에 "docs anchor 의 `--` 는 두 sub-resource 결합을 의미하며 entity id/파일명에서 `__` 로 치환한다(단일 `-` 는 그대로 유지)" 를 명시적 하위 규칙으로 추가해 규약을 실제 산출물에 맞춰 갱신. 코드 변경은 불필요(현재 산출물은 이미 이 규칙을 일관되게 따르고 있음).

- **[WARNING] `audit-action.const.ts` 가 신설 SoT `spec/conventions/audit-actions.md` 를 인용하지 않고 taxonomy 를 인라인 재서술**
  - target 위치: `spec/conventions/audit-actions.md` §Rationale "왜 시제를 한 규약으로 묶는가" (SoT 통합 결정) ↔ 실제 코드 `codebase/backend/src/modules/audit-logs/audit-action.const.ts` JSDoc 헤더 (HEAD 워크트리 절대경로로 확인)
  - 위반 규약: CLAUDE.md "정보 저장 위치" 표 — "정식 규약 → `spec/conventions/<name>.md`" (단일 진실 원칙). `audit-actions.md` 자신의 Overview 도 "본 문서가 유일하게 소유하는 것: ① `<resource>.<verb>` 구조 규칙, ② verb 시제 3분류 taxonomy, ③ 도메인별 분류 레지스트리" 라고 명시.
  - 상세: `audit-actions.md` 의 Rationale 은 "감사 액션 명명·시제 규칙은 원래 `5-system/1-auth.md §4.1` 본문에 산문으로 흩어져 있었고... 전 도메인 시제 규칙을 단일 conventions 문서로 통합"했다고 밝힌다. 그런데 `audit-action.const.ts`(본 문서 frontmatter `code:` 가 가리키는 유일한 구현 파일) 의 JSDoc 헤더는 여전히 "SoT: `spec/5-system/1-auth.md §4.1`" 만 인용하고, `spec/conventions/audit-actions.md` 는 어디서도 언급하지 않는다. 대신 "Naming 규약: `<resource>.<verb>`... verb 는 도메인 관례를 따른다 (integration 은... 과거분사, execution 은 `re_run`, auth_config 은 CRUD 동사 현재형..., user 는... 과거분사)" 라는 taxonomy 요약을 자체적으로 재서술한다 — 내용은 현재 `audit-actions.md` 와 정확히 일치하지만(레지스트리 22개 액션 전수 대조 완료, 불일치 없음), SoT 를 신설한 목적(단일 문서로 통합해 "도메인이 늘수록 산문 규약은 누락·표류하기 쉽다" 는 문제를 해결)이 코드 주석 쪽에서는 그대로 재현될 위험이 남는다 — 향후 `audit-actions.md` 의 분류가 바뀌어도 코드 JSDoc 은 자동으로 갱신되지 않는다.
  - 제안: `audit-action.const.ts` JSDoc 첫 줄을 "SoT: `spec/conventions/audit-actions.md` (명명·시제 규약) + `spec/5-system/1-auth.md §4.1` (카탈로그·workspace 귀속)" 로 갱신하고, 도메인별 시제 재서술 문단은 요약 인용으로 축소해 이중 SoT 표류를 예방. 기능적 영향 없음(현재 내용은 일치) — 다음 갱신 시점의 drift 예방이 목적.

- **[INFO] `cafe24-api-catalog` resource index 문서(`application.md`/`category.md` 등)는 명시적 `## Overview`/`## Rationale` 헤딩이 없음 — 기존 전체 관례와 일치, 위반 아님**
  - target 위치: `spec/conventions/cafe24-api-catalog/application.md`, `category.md` 전체 구조 (frontmatter `id`/`status`/`code` 뒤 바로 `## 표` → `## Field-level 상세 카탈로그`)
  - 위반 규약: `project-planner/SKILL.md` §Spec 문서 구조 (3섹션 권장: Overview/본문/Rationale)
  - 상세: 18개 resource index 파일 전부가 동일하게 표(table)-only 구조이며 이는 이번 target 이 새로 만든 편차가 아니라 카탈로그 전체의 확립된 관례다(`_overview.md` 자신은 `## Rationale` 을 갖고 있어 3섹션 권장을 부분적으로 따른다). 순수 레퍼런스 테이블 문서(operation enumeration)라는 성격상 산문형 Overview/Rationale 이 항상 필요하지는 않다고 판단됨.
  - 제안: 조치 불요. 다만 카탈로그류 문서가 3섹션 권장의 명시적 예외 대상이라는 점을 `spec-impl-evidence.md` 또는 `_overview.md` 에 한 줄 각주로 남기면 향후 checker 의 반복 재확인 비용을 줄일 수 있음(선택 사항).

## 명명·출력 포맷·API 문서·금지 항목 점검 결과 요약

- **명명 규약**: `audit-actions.md` §1/§2/§3 의 `<resource>.<verb>` + underscore 토큰 구분 규칙을 코드(`AUDIT_ACTIONS`, 22개 액션 전수 대조)가 정확히 준수. `cafe24-api-catalog` operation `id` 컬럼(`<resource>_<sub>_<verb>`, snake_case) 도 `application.ts`/`category.ts` 메타데이터의 실제 `id` 값과 1:1 일치(전수 대조: application 17개, category 17개 모두 매치). entity id(field-level) 의 `--`→`__` 치환 규칙만 문서화 갭(위 WARNING).
- **출력 포맷 규약**: 이 target 범위(감사 액션 명명 + Cafe24 API 카탈로그)에는 API 응답 스키마·이벤트 페이로드·에러 코드 신설이 없음 — 해당 없음.
- **문서 구조 규약**: `audit-actions.md` 는 frontmatter(`id`/`status`/`code`) + Overview + 번호 본문(§1~3) + Rationale 의 정석 3섹션 구조를 완전히 준수. `cafe24-api-catalog/_overview.md` 는 `spec-impl-evidence.md` 의 `_*.md`(밑줄 prefix, layout/index) 면제 대상이라 frontmatter 부재가 정상(위반 아님) — 실제로 frontmatter 가 없음을 확인. resource index(`<resource>.md`) 는 면제 대상이 아니며 실제로 `id`/`status`/`code` frontmatter 를 보유(§7.1 예외 규칙과 일치). field-level 파일(`<resource>/<entity>.md`) 은 명시적으로 lifecycle frontmatter 의무에서 제외되고(§1 exclude 목록), 실제로 `resource`/`entity`/`cafe24_docs`/`source` 4필드만 사용 — 규약과 정확히 일치.
- **API 문서 규약(OpenAPI/Swagger 데코레이터·DTO)**: 이 target 범위는 REST 프록시 카탈로그(외부 Cafe24 API 문서화)라 우리 서비스의 OpenAPI/Swagger 데코레이터·DTO 패턴과 무관 — 해당 없음.
- **금지 항목**: `audit-actions.md` §1 "인라인 문자열 금지"(신규 action 은 반드시 `AUDIT_ACTIONS` union 에 추가) 를 코드가 준수(전 액션이 const 경유, 인라인 리터럴 없음 — `AuditLogsService.record({ action })` 타입 강제 확인). `cafe24-api-catalog/_overview.md` §8 "outright 제거 vs `deprecated` 구분" 규칙 위반 사례 없음(target 범위 내 신규 제거 없음).

## 요약

target(`spec/conventions/audit-actions.md` + `spec/conventions/cafe24-api-catalog/**`)은 명명·출력 포맷·문서 구조·API 문서·금지 항목의 5개 관점에서 CRITICAL 위반은 없다. `audit-actions.md` 의 22개 액션 레지스트리는 실제 구현(`audit-action.const.ts`, HEAD 워크트리 절대경로로 전수 대조)과 정확히 일치하고, `cafe24-api-catalog` 의 operation `id`·coverage matrix 숫자(application/category 표본 대조)도 실제 메타데이터와 일치한다. 발견된 두 WARNING 은 모두 "빌드를 깨지 않지만 규약 문언과 산출물/코드 사이에 거리가 있어 규약 쪽 갱신이 바람직한" 성격이다 — ① field-level entity id 의 `--`→`__` 치환 규칙이 §7.1 "kebab-case" 문언에 문서화돼 있지 않음(67/222 파일, 약 30% 영향), ② `audit-action.const.ts` JSDoc 이 신설된 단일 SoT(`audit-actions.md`) 를 인용하지 않고 taxonomy 를 자체 재서술해 향후 drift 위험을 남김. 나머지 관찰(카탈로그 index 문서의 3섹션 미준수)은 전체 관례와 일치하는 기존 패턴이라 INFO 수준.

## 위험도

LOW
