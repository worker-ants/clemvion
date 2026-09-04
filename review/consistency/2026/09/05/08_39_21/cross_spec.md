# Cross-Spec 일관성 검토 — numeric wire 타입 규약 draft

target: `plan/in-progress/spec-draft-numeric-wire-convention.md`
spec_impact: `spec/1-data-model.md`, `spec/conventions/swagger.md`

## 검토 방법

target 이 인용하는 실측(코드 라인·grep 결과)을 저장소에서 직접 재실행해 재현했고,
target 이 수정하려는 두 spec 파일의 현재 원문과 target 이 제안하는 교체본을 대조했으며,
`threshold`/`cost_usd`/numeric·decimal wire 타입을 언급하는 `spec/**` 전 영역을 grep 으로
전수 확인했다.

## 발견사항

없음 — CRITICAL/WARNING/INFO 어느 등급의 충돌도 발견하지 못했다.

### 검증한 내용 (참고용, 결함 아님)

- **실측 재현**: `grep -rhoiE "^\s+[a-z_]+ +(NUMERIC|DECIMAL)\([0-9]+, *[0-9]+\)" codebase/backend/migrations/*.sql`
  및 대소문자/들여쓰기 조건을 뺀 광역 재검색 둘 다 `cost_usd NUMERIC(12,6)`(`V014`),
  `threshold NUMERIC(12,4)`(`V016`) 두 건만 반환 — target 의 "numeric 컬럼은 저장소에 둘뿐"
  전제가 맞다.
- **코드 대조**: `statistics.service.ts:346,376`(및 `:430,457` 대응 라인)이 `SUM(u.cost_usd)::float`
  + `Number(row.costUsd)` 를 실제로 건다. `alert-rule-response.dto.ts` 는 이미
  `threshold: string` + `@ApiProperty({ type: String, example: '10.0000' })` 이고, JSDoc
  (`/** */`) 과 경위 주석(`//`) 분리도 이미 적용돼 있다 — target 의 "이미 머지된 것을 문서화"
  라는 주장과 일치.
- **가드 대조**: `swagger-dto-contract-guard.ts` 의 `findNumericAsNumber` 는 `collectTsFiles(SRC_ROOT)`
  로 저장소 전역을 스캔하고, `<Entity>Dto` 이름 관례 한계가 docstring(`## 짝짓기는
  '<Entity>Dto' 이름 관례에 의존한다 (알려진 한계)`)에 실제로 캐너리로 고정돼 있다 — target
  §3 인용과 일치.
- **spec 원문 대조**: `spec/1-data-model.md:851`(`cost_usd | Numeric(12,6)?`)·`:873`
  (`threshold | Float`, 같은 행 설명은 `NUMERIC(12,4)` 라고 스스로 반박)를 직접 읽어 target
  §1 의 지적이 정확함을 확인. `rerank_score_threshold | Float?`(`:361`)는 실제
  `DOUBLE PRECISION`(`V082__knowledge_base_rerank.sql`)이라 target 의 "오탐 배제"(건드리지
  않음) 판단도 맞다.
- **삽입 위치 대조**: `spec/conventions/swagger.md` 의 `### 1-5. writeOnly/readOnly`(끝 157행)
  → `## 2) Controller 패턴`(161행) 사이, 그리고 `## 3) 주석/설명 톤` 의 길이 표(끝 275행)
  → 보안·정책 캐비엇 인용문(277행 시작) 사이에 실제 빈 자리가 있어 target 이 지정한 삽입
  위치(변경안 B, C)가 문서 구조와 어긋나지 않는다. `#1-6-...` 앵커 슬러그도 기존
  `#1-4-nested--enum--union`(`### 1-4. nested / enum / union`) 패턴과 동일 규칙(구두점 제거
  후 공백→hyphen)을 따르므로 깨지지 않는다.
- **다른 영역과의 wire 타입 서술 충돌 없음**: `spec/2-navigation/9-user-profile.md:406` 은
  `POST /api/alerts` **요청** body 의 `threshold` 를 `number` 로 적는데, 이는 target 이 명시한
  "쓰기는 number 를 받는다"(응답만 문자열)와 정확히 같은 구분이라 충돌이 아니라 오히려
  일치. 같은 문서·`data-flow/9-observability.md:157`·`data-flow/5-integration.md` 등 다른
  영역 어디에도 응답(GET) 의 `threshold`/`costUsd` 를 다른 wire 타입으로 규정한 서술이
  없다 — 즉 target 이 새로 성문화하려는 규칙과 모순되는 기존 서술이 없다.
- **동명이인 필드 확인**: `spec/5-system/9-rag-search.md:83` 의 `"threshold": { "type": "number" }`
  는 KB 검색 tool(`kb_*`) 의 LLM 함수 호출 인자 스키마로, AlertRule.threshold 나 numeric
  DB 컬럼과 무관한 별개 개념(같은 이름, 다른 도메인)이다. 응답 DTO 도, DB numeric 컬럼도
  아니므로 target 의 §1-6 규약 대상이 아니고 충돌도 아니다.
- **요구사항 ID/RBAC/상태 전이/계층 책임**: target 은 새 요구사항 ID 를 부여하지 않고, 권한
  구조·상태 머신을 변경하지 않는다. "정적 판별 가능한 갈래는 가드, 나머지는 규약" 이라는
  책임 분업 서술도 `spec/conventions/**` 의 기존 가드-책임 서술(예: `node-cancellation.md`,
  `spec-impl-evidence.md`)과 같은 패턴(가드 커버리지의 한계를 별도 서술로 메움)이라
  충돌하지 않는다.

## 요약

target 은 코드 변경 없이 spec 서술만 정정하는 draft이며, 인용한 모든 실측(마이그레이션
grep, 서비스 코드 라인, DTO·가드 코드, 삽입 위치 좌표)을 직접 재현·대조한 결과 전부 정확했다.
저장소에 numeric/decimal 컬럼이 실제로 둘뿐이라는 전제, 그 둘이 서로 다른 wire 타입을
갖는다는 관찰, 다른 spec 영역(`2-navigation/9-user-profile.md`, `data-flow/9-observability.md`
등)의 관련 서술과의 정합성 모두 확인됐다. 새 §1-6/§3 삽입 위치도 문서 구조와 어긋나지 않고,
동명이인 `threshold` 필드(RAG 검색 tool 인자)는 별개 도메인이라 혼동 소지가 없다. Cross-Spec
관점에서 이 draft 를 그대로 채택해도 다른 영역과 모순이 발생하지 않는다.

## 위험도

NONE
