# Rationale 연속성 검토 결과

검토 모드: 구현 착수 전 (--impl-prep)
대상 범위: `spec/conventions/cafe24-api-catalog` (18 resource 파일 + `_overview.md`)
참조 Rationale 출처: `cafe24-api-metadata.md §Rationale`, `cafe24-restricted-scopes.md ##Rationale`, `spec/2-navigation/4-integration.md ##Rationale` (연관 발췌)

---

## 발견사항

### [INFO] 대부분 catalog 파일에 독립 `## Rationale` 섹션 부재 (위임 패턴은 일관)
- target 위치: `application.md`, `category.md`, `collection.md`, `community.md`, `customer.md`, `design.md`, `order.md`, `personal.md`, `product.md`, `promotion.md`, `salesreport.md`, `shipping.md`, `supply.md`, `translation.md` — 15개 파일 모두 `## Rationale` 섹션 없음
- 과거 결정 출처: `cafe24-api-metadata.md` §Rationale 및 `_overview.md` §2·§4 — 컬럼 정의·동기 정책·status enum 의 Rationale 이 해당 문서에 집중
- 상세: `mileage.md`, `notification.md`, `privacy.md`, `store.md` 4개 파일은 `## Rationale` 을 갖고 그 안에서 `_overview.md` 와 `cafe24-restricted-scopes.md##Rationale` 로 위임한다. 나머지 15개 파일은 Rationale 섹션 자체가 없으며 위임도 없다. 이 불균형이 합의 위반은 아니다 — `_overview.md` 가 컨벤션 전체의 근거를 보유하도록 명문화되어 있고, restricted 컬럼이 없는 resource 는 별도 Rationale 이 필요한 독자적 결정이 없기 때문이다. 그러나 위임 문장이라도 갖추는 편이 문서 간 연결을 명확히 한다.
- 제안: 15개 파일에 최소 한 줄 `## Rationale` + `_overview.md §2·§4 참고` 위임 문장 추가 권장 (차단 요인은 아님).

### [INFO] `_overview.md` 자체에 `## Rationale` 섹션 없음
- target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` — `## 7. CHANGELOG` 가 결정 이력을 상세히 기록하고 있으나 `## Rationale` 표제로 분리되어 있지 않음
- 과거 결정 출처: CLAUDE.md "정보 저장 위치" 표 — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" 로 명문화
- 상세: `_overview.md` 의 CHANGELOG(§7) 는 design decision 내용을 매우 상세히 포함하고 있지만 (restricted 컬럼 도입, op→operation 토큰 통일, 동기 테스트 도입 등), 정식 `## Rationale` 섹션이 아니라 변경 로그 형식으로 기록되어 있다. 합의된 invariant 나 기각된 대안은 `cafe24-restricted-scopes.md ##Rationale` 에 위임 기록되어 있으므로 실질적인 누락은 없다. CLAUDE.md 규약상 명시적 `## Rationale` 헤더를 두는 것이 SoT 원칙 준수에 가장 부합한다.
- 제안: `_overview.md` 에 `## Rationale` 섹션 신설 — "컬럼 정의 근거는 §2, 동기 정책은 §4, restricted 라벨링은 `cafe24-restricted-scopes.md ##Rationale`" 식의 위임형으로도 충분. CHANGELOG 를 Rationale 로 전환할 필요는 없으나 문서 규약 준수 차원에서 헤더 추가 권장.

### [INFO] `order.md` 의 `planned` 행에 `paginated: ✓` 마킹 존재 — spec 허용이나 실효성 명시 없음
- target 위치: `spec/conventions/cafe24-api-catalog/order.md` — `orders_inflowgroups_list`, `orders_inflows_list`, `orders_saleschannels_list`, `cashreceipt_list`, `unpaidorders_list` (5건) 가 `status=planned`, `method/path=?` 이면서 `paginated: ✓`
- 과거 결정 출처: `_overview.md` §2 `paginated` 컬럼 정의 — "planned 시 `?` 허용" 은 `method`/`path`/`scope` 에만 명시; `paginated` 컬럼에 대한 `planned` 행의 정책은 명시되지 않음. §4 동기 검증 규칙 3 — "`supported` row 의 `paginated` 컬럼이 메타데이터와 일치" (planned 는 검증 대상 제외)
- 상세: spec 의 `paginated` 컬럼 정의는 "`paginated: true` 인 operation 만 표시" 로 `supported` 에 한정한 규약은 없다. `planned` 행에 `✓` 를 미리 기입하는 것이 기각된 대안은 아니며, 동기 테스트도 `planned` 의 `paginated` 를 검증하지 않는다. 다만 "구현 시점에 공식 docs 를 다시 검증한 뒤 갱신" 원칙 (§3 끝) 에 비추어, `planned` 행의 `paginated: ✓` 가 미검증 상태로 기재된 경우 구현 시 오기가 되면 테스트가 잡지 못하는 사각이 생긴다.
- 제안: `_overview.md` §2 `paginated` 컬럼 정의에 "planned 행의 `paginated` 는 잠정값 — 구현 시점에 반드시 재검증" 메모 추가 권장.

---

## 기각된 대안 재도입 여부

`cafe24-restricted-scopes.md ##Rationale` 에서 명시적으로 기각한 4가지 대안을 target 에서 재도입하는지 확인했다.

| 기각 대안 | 기각 출처 | target 상태 |
|---|---|---|
| (A) 별도 승인 scope 체크 시 사용자 차단 | `cafe24-restricted-scopes.md` 기각 (A) | 재도입 없음 — catalog 는 `restricted` 컬럼으로 라벨링만, 차단 정책은 없음 |
| (B) 신규 에러 코드 `CAFE24_APPROVAL_REQUIRED` 추가 | `cafe24-restricted-scopes.md` 기각 (B) | 재도입 없음 — catalog 는 메타데이터 SoT 역할이며 에러 코드 정의와 무관 |
| (C) `status` enum 에 `restricted` 값 추가 | `cafe24-restricted-scopes.md` 기각 (C) — "이 컬럼은 `status` 와 직교하며 `status` 의 값이 아니다" | 재도입 없음 — `status` 값은 `supported`/`planned`/`deprecated` 만, `restricted` 는 별도 컬럼으로 유지 |
| (D) 명단을 spec 본문에 직접 enumerate | `cafe24-restricted-scopes.md` 기각 (D) | 재도입 없음 — 명단 SoT 는 `cafe24-restricted-scopes.md` 유지 |

`cafe24-api-metadata.md §Rationale` 기각 대안 확인:

| 기각 대안 | 기각 출처 | target 상태 |
|---|---|---|
| (A) backend wrapper 가 timezone 자동 변환 | `cafe24-api-metadata.md §Rationale` 기각 (A) | catalog 는 timezone 처리를 직접 담당하지 않으므로 무관 |
| (B) AI 시스템 프롬프트에만 timezone 명시 | `cafe24-api-metadata.md §Rationale` 기각 (B) | 무관 |

**결론**: 기각된 대안의 재도입 없음.

---

## 합의된 원칙 준수 여부

### 원칙 1 — `restricted` 컬럼 ↔ `status` 직교성

`_overview.md` §2 및 `cafe24-restricted-scopes.md ##Rationale` (기각 C) 에서 합의: "restricted 는 status 와 직교". target 전체에서 `supported + restricted:operation` 조합 (store.md 의 paymentgateway 4건), `planned + restricted:operation` 조합 (store.md activitylogs/menus/kakaopay/naverpay/financials 등), `supported + restricted:scope` 조합 (mileage/notification/privacy 전체) 이 혼재하고 있다. 이는 합의된 "직교" 원칙에 정확히 부합한다. 위반 없음.

### 원칙 2 — `planned` 행의 `method`/`path`/`scope` `?` 허용, 구현 시 재검증

`_overview.md` §3 끝 문장: "구현 시점에 공식 docs 를 다시 검증한 뒤 `supported` 로 승격시키며 정확한 값으로 갱신한다." target 전체의 `planned` 행이 `?` 값을 적절히 사용하고 있다. 위반 없음.

### 원칙 3 — catalog-sync 테스트 양방향 검증 보호

`_overview.md` §4 의 8개 검증 규칙 중 `level='program'` 제외 규정 (규칙 8) 을 target 이 준수하는지 확인: catalog 내에 `level='program'` 에 해당하는 Analytics 등의 row 가 없으며, `cafe24-api-metadata.md §2` 의 `approvalGroup='analytics'` 는 "catalog 대상 외 트랙, catalog 화 대상이 아닌 별도 트랙" 임이 명문화된 채 catalog 파일에 등재되지 않았다. 위반 없음.

### 원칙 4 — `approvalGroup` 이름 (naming collision 회피)

`cafe24-api-metadata.md §2` Rationale: "`category` 가 아닌 `approvalGroup` 채택 — `Cafe24Resource.category` enum 및 `Node.category` 와의 명명 충돌 회피." catalog 파일은 컬럼명 `restricted` 를 사용하며 `approvalGroup` 을 컬럼으로 노출하지 않는다 (`_overview.md` §4 규칙 8에서 "catalog 컬럼으로 노출하지 않는다" 명시). 위반 없음.

---

## 요약

`spec/conventions/cafe24-api-catalog` 의 18개 resource 파일과 `_overview.md` 는 `cafe24-restricted-scopes.md ##Rationale` 및 `cafe24-api-metadata.md §Rationale` 에서 합의·기각된 모든 결정 (restricted/status 직교성, 기각 대안 A~D, approvalGroup 명칭, catalog-sync 양방향 동기, program 트랙 제외 등) 을 충실히 계승하고 있다. CRITICAL 또는 WARNING 등급의 Rationale 연속성 위반은 발견되지 않았다. 다만 세 가지 INFO 사항이 있다: (1) 15개 resource 파일에 `## Rationale` 섹션 또는 위임 문장이 없어 CLAUDE.md 의 spec 문서 3섹션 구성 규약에 일부 미달하고, (2) `_overview.md` 자체도 동일 이유로 `## Rationale` 헤더가 누락되어 있으며, (3) `order.md` 의 `planned` 행 일부에 `paginated: ✓` 가 미검증 상태로 기재되어 구현 시 테스트 사각이 발생할 수 있다. 이 세 사항은 모두 차단 요인이 아닌 문서 품질 개선 권장 사항이다.

---

## 위험도

LOW
