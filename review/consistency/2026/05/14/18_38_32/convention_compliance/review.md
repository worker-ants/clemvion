전체 문서를 읽었습니다. 제공된 3개 정식 규약에 대한 점검 결과입니다.

---

## 발견사항

- **[INFO]** `spec/conventions/swagger.md` 가 리뷰 범위에 미포함
  - target 위치: §9.4 "공통 응답 포맷" — `"swagger 규약(spec/conventions/swagger.md §2-4 — 중복/충돌은 409, INTEGRATION_IN_USE(409) 선례)"`
  - 위반 규약: 해당 없음 (규약 문서의 존재 확인 문제)
  - 상세: `spec/conventions/swagger.md`를 §9.4에서 인용하고 있으나 이번 검토 대상 규약 집합에 포함되지 않았다. 파일 자체가 존재하는지, §2-4 조항이 현재 문서 내용과 일치하는지 미확인 상태.
  - 제안: 구현 전 `spec/conventions/swagger.md` 실존 여부를 확인하고, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED (409)` 코드가 해당 규약 §2-4의 중복/충돌 처리 기준과 정합하는지 검증.

---

## 규약별 점검 결과

**`cafe24-api-metadata.md`** — **준수**
- §5.8 scope 테이블이 컨벤션 §1 디렉토리의 18개 resource (store, product, order, customer, community, design, promotion, application, category, collection, supply, shipping, salesreport, personal, privacy, mileage, notification, translation) 와 1:1 대응함 ✓
- `mall.read_<resource>` / `mall.write_<resource>` scope 형식 일치 ✓
- UI 맥락에서 "카테고리", 백엔드 맥락에서 "Resource" 사용 — 컨벤션 §6 용어 규칙 준수 ✓
- `credentials.app_type` (`public` / `private`) 와 메타데이터 `application.ts` (Cafe24 Application API) 의 naming collision 위험을 컨벤션 ⚠ 주석이 경고하는 바와 동일하게 인식하여 분리 기술함 ✓
- §14.2 allowlist UI 가 카테고리 단위 grouping 으로 동작하고 bare operation ID 를 저장하는 설계가 컨벤션 §6 과 정합 ✓

**`migrations.md`** — **해당 없음**
본 spec 은 navigation UI 명세이며 마이그레이션 파일을 직접 정의하지 않음. §13 "데이터 모델 영향 요약" 은 필드 목록만 나열하며, 실제 V번호 할당은 구현 단계에서 `migrations.md` 절차를 따를 사항.

**`node-output.md`** — **준수**
- §14.1 에러 코드 vocabulary 전체가 `UPPER_SNAKE_CASE` 규칙 준수 (Principle 3.2 `code: UPPER_SNAKE_CASE`) ✓
- §9.4 API 응답 오류 코드도 동일 케이스 준수 ✓
- DB 컬럼 `status_reason` 값은 `snake_case` (`install_timeout`, `oauth_token_exchange_failed` 등), HTTP 레이어 에러 코드는 `UPPER_SNAKE_CASE` — Rationale 에서 의도적 구분으로 명시되어 있고 Principle 3.2 가 node output 의 `error.code` 에 한정된 규칙이므로 DB 저장값과의 혼동이 없음 ✓

---

## 요약

`spec/2-navigation/4-integration.md` 는 3개 정식 규약(cafe24-api-metadata, migrations, node-output)을 실질적으로 모두 준수하고 있다. 다중 spec 파일 영역(`_product-overview.md` 존재)이므로 `## Overview` 섹션 부재도 CLAUDE.md 컨벤션에 적합하다. 구현 전 단일 확인 항목은 §9.4 에서 인용하는 `spec/conventions/swagger.md` 의 실존 여부뿐이다.

## 위험도
**NONE**