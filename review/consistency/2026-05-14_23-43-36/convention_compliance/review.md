---

## 발견사항

### INFO 항목 1: `## Overview` 섹션 부재
- **target 위치**: 문서 최상단 — `## 1. 라우트 구성` 이 첫 번째 섹션
- **관련 규약**: `CLAUDE.md` 프로젝트 규약 — "각 spec 문서는 권장 3섹션 구성을 따른다: 1. Overview (제품 정의) 2. 본문 (스펙) 3. Rationale"
- **상세**: 영역 전체 Overview 는 `_product-overview.md` 에 별도 분리되어 있고 (`[PRD 내비게이션](./_product-overview.md#34-integration-통합)` 참조), 본 spec 파일은 기술 명세에 집중하는 구조다. CLAUDE.md 가 "다중 spec 파일을 가진 영역에서 `_product-overview.md` 를 두는 케이스" 로 명시적으로 허용하므로 규약 위반은 아니다. 다만 문서 상단에 단 한 줄의 요약 context (예: 이 파일이 무엇을 다루는지) 가 있으면 탐색성이 높아진다.
- **제안**: 변경 필요 없음 (규약상 허용 케이스). 선택적으로 문서 첫 단락에 "본 spec 은 `/integrations` 화면의 라우트·UI·API·상태전이를 정의한다" 한 줄 추가 검토.

### INFO 항목 2: `spec/conventions/swagger.md` 참조 — 검토 범위 외
- **target 위치**: `§9.4` — `"swagger 규약(spec/conventions/swagger.md §2-4 — 중복/충돌은 409, INTEGRATION_IN_USE(409) 선례) 에 맞춤"`
- **관련 규약**: 본 검토에서 `swagger.md` 는 제공되지 않았음
- **상세**: 문서가 `swagger.md §2-4` 를 명시 참조하지만 해당 컨벤션 파일이 이번 검토 스코프에 포함되지 않아 준수 여부를 확인할 수 없다. CAFE24_PRIVATE_APP_ALREADY_CONNECTED(409) 코드 선택이 올바른 컨벤션 근거를 갖는지 별도 확인이 권장된다.
- **제안**: 구현 착수 전 `spec/conventions/swagger.md §2-4` 를 별도로 열람해 409 응답 코드 패턴이 해당 컨벤션과 일치하는지 확인. (인접 문서인 `spec/4-nodes/4-integration/4-cafe24.md` 에도 동일 에러 코드가 등재되어 있으므로 양쪽 동시 검토 권장)

---

## 요약

`spec/2-navigation/4-integration.md` 는 제공된 세 정식 규약(`cafe24-api-metadata.md`, `migrations.md`, `node-output.md`) 에 대해 **위반이 없다**.

- **cafe24-api-metadata.md**: §5.8 scope 프리셋 18 카테고리가 메타데이터 디렉토리 18 resource 와 1:1 일치. `mall.read_<resource>` / `mall.write_<resource>` 형식 준수. §14.2 allowlist grouping 이 `cafe24-api-metadata.md §6` 을 올바르게 인용. `scopeType` 명명 충돌 회피 패턴도 doc 전반에 반영돼 있음.
- **migrations.md**: 본 문서는 UI/API 명세 파일로 migration 정의가 없으며 §13 데이터 모델 영향 요약은 참조 성격 — 컨벤션 적용 범위 외.
- **node-output.md**: §14.1 에러 코드가 `UPPER_SNAKE_CASE` 를 준수하며, `error` 포트 사용 언급(HTTP 노드 등)이 Principle 3.3 과 일치. `status_reason` 의 `snake_case` 는 DB 컬럼 컨벤션으로 Rationale 에 명시적으로 구분 처리됨.

문서 구조(Rationale 섹션 완비, `_product-overview.md` 분리, 번호 prefix 명명)도 `CLAUDE.md` 컨벤션을 준수한다.

---

## 위험도

**LOW** — CRITICAL/WARNING 없음. INFO 2건은 모두 구현 착수를 차단할 사유가 아니며, swagger.md 참조 확인은 구현 중 409 에러 코드 처리 시 병행 검토하면 충분하다.