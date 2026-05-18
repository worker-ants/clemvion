# Rationale 연속성 검토 — spec/conventions/cafe24-api-catalog/

검토 모드: 구현 착수 전 (--impl-prep)
검토 대상: `spec/conventions/cafe24-api-catalog/` 전체 파일

---

### 발견사항

- **[WARNING]** `restricted` 컬럼이 없는 파일들의 헤더 일관성 — `restricted` 컬럼 표준 누락
  - target 위치: `application.md`, `category.md`, `collection.md`, `community.md`, `customer.md`, `design.md`, `order.md`, `personal.md`, `product.md` 의 표 헤더
  - 과거 결정 출처: `_overview.md §2` 컬럼 정의 및 §7 CHANGELOG "2026-05-17 (drift fix): §2 컬럼 정의 순서를 실제 파일 헤더 기준으로 정정"
  - 상세: `_overview.md §2` 는 `restricted` 컬럼을 공식 컬럼으로 정의하면서 "값이 비어 있어도 컬럼 자체는 존재" 를 의미한다고 볼 수 있다. CHANGELOG drift fix 는 "컬럼 정의 순서를 실제 파일 헤더 기준으로 정정" 하여 `scope → restricted → paginated → status → docs` 순서를 표준으로 확립했다. 그런데 `application.md`, `category.md`, `collection.md`, `community.md`, `customer.md`, `design.md`, `order.md`, `personal.md`, `product.md` 는 `restricted` 컬럼 자체가 표 헤더에 없다. `mileage.md`, `notification.md`, `privacy.md` 는 `restricted` 컬럼을 헤더에 포함해 실제 값을 기재하고 있다. 동기 테스트 규칙 8도 `restricted` 컬럼 ↔ 메타데이터 `restrictedApproval` 양방향 동기를 검증하므로, 헤더 부재가 테스트 파서 작동에 영향을 줄 수 있다.
  - 제안: `_overview.md §2` 에 "restricted 컬럼은 값이 비어있는 경우(일반 사용 가능) 표 헤더에서 생략 가능하다" 또는 반대로 "모든 카탈로그 파일의 헤더에 포함한다" 중 하나를 명문화한다. 현재 mileage/notification/privacy 가 헤더를 포함하는 일관성이 있으므로, 다른 파일들에도 `restricted` 컬럼을 헤더에 추가하되 값은 공란으로 두는 방향이 spec §2 정의와 정합하다.

- **[INFO]** `store.md` 파일이 target 에 포함되지 않아 `restricted: operation` 케이스 검증 불가
  - target 위치: `_overview.md §2` restricted 컬럼 정의 및 §7 CHANGELOG "2026-05-17: store 표 헤더·row 동시 갱신"
  - 과거 결정 출처: `_overview.md §2` restricted 설명: "`scope` = 본 scope 자체가 카페24 별도 승인 대상", "`operation` = 본 row 만 단독 승인 대상 (store 안 케이스)"
  - 상세: `_overview.md` 는 `store` resource 에 `restricted: operation` 케이스가 존재한다고 명시하고 있으나 (`store.md` 만이 `restricted: operation` 의 예시 케이스), 본 검토의 target 파일 집합에 `store.md` 가 포함되지 않아 실제 적용 여부를 확인할 수 없다. 동기 검증 규칙 8 에서 `level='scope'` / `level='operation'` 구분이 catalog row ↔ 메타데이터 양방향 검증 대상이므로, store.md 의 적용 현황을 별도 확인할 필요가 있다.
  - 제안: store.md 를 추가 검토 대상에 포함시켜 `restricted: operation` 컬럼 기재가 `_overview.md §2` 정의와 일치하는지 확인한다.

- **[INFO]** `mileage.md`, `notification.md`, `privacy.md` 의 Rationale 섹션이 참조 위임 형식
  - target 위치: `mileage.md ## Rationale`, `notification.md ## Rationale`, `privacy.md ## Rationale`
  - 과거 결정 출처: CLAUDE.md §스펙 문서 구조: "Rationale — 결정의 배경·근거·폐기된 대안. 옛 memory/ ADR 의 자리"
  - 상세: 세 파일의 `## Rationale` 섹션은 각각 "설계 근거는 `_overview.md §2·§4·§7`. 별도 승인 라벨링의 의사결정 배경은 `cafe24-restricted-scopes.md ## Rationale`." 단 한 줄로 외부 참조만 한다. 이는 Rationale 목적(결정 배경 보존) 취지에서 보면 편의상 위임이지 위반은 아니나, "폐기된 대안" 이나 본 파일 고유 결정이 있다면 로컬 기록이 부재하게 된다. 현재는 이 파일들이 카탈로그 enumeration 역할만 하고 별도 설계 결정이 없다고 볼 수 있으나, 구현 착수 후 파일 고유 결정이 생기면 참조 위임 단일 Rationale 로는 미추적 위험이 있다.
  - 제안: 현 상태는 INFO 수준으로 허용 가능하다. 구현 PR 에서 파일 고유 결정(예: 특정 operation 의 path 선택 이유, paginated 기준 등)이 생기면 해당 파일 Rationale 에 로컬로 기재하는 것을 권장한다.

- **[INFO]** `order.md` 에 `planned` row 의 `paginated` 컬럼이 `✓` 로 채워져 있음 — spec 허용 사항이나 인식 필요
  - target 위치: `order.md` 표 내 `orders_inflowgroups_list`, `orders_inflows_list`, `orders_saleschannels_list`, `cashreceipt_list`, `unpaidorders_list` 행
  - 과거 결정 출처: `_overview.md §3`: "`planned` 행의 `method`/`path`/`scope` 가 `?` 인 경우, 구현 시점에 공식 docs 를 다시 검증한 뒤 `supported` 로 승격시키며 정확한 값으로 갱신한다." / `_overview.md §2`: "`method`: planned 시 `?` 허용", "`path`: planned 시 `?` 허용", "`scope`: planned 시 `?` 허용"
  - 상세: `_overview.md` 는 `method`/`path`/`scope` 에 대해 "planned 시 `?` 허용" 을 명시하지만, `paginated` 컬럼에 대해서는 planned 시 `?` 허용 여부를 별도 언급하지 않는다. `order.md` 의 일부 `planned` row 는 `paginated: ✓` 로 채워져 있는데, 이는 공식 docs 에서 사전 확인한 값으로 볼 수 있으나 §3 의 "구현 시점에 공식 docs 재검증" 원칙 하에 구현 시 재확인이 필요하다. spec 위반은 아니지만, planned 상태에서 `paginated` 값의 신뢰도에 대한 명시가 없다.
  - 제안: `_overview.md §2` 또는 §3 에 "planned 행의 `paginated` 컬럼은 공식 docs 에서 사전 확인된 경우 `✓` 를 기재할 수 있으나, 구현 시점에 재검증 후 확정한다" 를 추가해 의도를 명문화한다.

---

### 요약

`spec/conventions/cafe24-api-catalog/` 대상 Rationale 연속성 검토 결과, **명시적으로 기각된 대안의 재도입이나 합의된 invariant 직접 위반은 발견되지 않았다.** 가장 주목할 사항은 `restricted` 컬럼의 헤더 포함 여부 불일치로, `_overview.md §2` 가 이를 공식 컬럼으로 정의하고 CHANGELOG drift fix 가 컬럼 순서를 표준화했음에도 대부분의 resource 파일이 헤더에 해당 컬럼을 생략하고 있다(WARNING). 이는 동기 테스트 규칙 8 의 파서 동작과 잠재적 충돌을 일으킬 수 있어 구현 착수 전 명문화가 필요하다. 나머지 사항은 참조 위임 형식의 Rationale(INFO) 과 planned 행의 paginated 값 명시 근거 부재(INFO) 로, 합의된 원칙과의 충돌 없이 보완 제안 수준이다.

---

### 위험도

LOW
