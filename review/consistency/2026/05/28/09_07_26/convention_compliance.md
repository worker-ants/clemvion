# 정식 규약 준수 검토 결과

- 검토 모드: `--impl-prep` (구현 착수 전 검토, scope=`spec/`)
- 검토 대상: `spec/` (주요 변경 식별 문서: `spec/1-data-model.md §2.10.1 IntegrationUsageLog`, `spec/4-nodes/4-integration/_product-overview.md §2.4`)
- 검토 기준: `spec/conventions/` 전체 (주로 `cafe24-api-metadata.md`, `swagger.md`, `node-output.md`)
- 검토 일시: 2026-05-28

---

## 발견사항

### [CRITICAL] `cafe24-api-metadata §7.5` 앵커가 실재하지 않는다

- **target 위치**: `spec/1-data-model.md §2.10.1 IntegrationUsageLog` 테이블, `api_label` 필드 설명
  - 정확히: `[cafe24-api-metadata §7.5](./conventions/cafe24-api-metadata.md#75-catalog-key-형식--활동-로그-api_label)`
- **위반 규약**: `spec/conventions/cafe24-api-metadata.md` — 해당 절이 존재하지 않음
- **상세**: `cafe24-api-metadata.md` 의 최상위 섹션은 현재 §1(디렉토리 구조)·§2(Operation 메타데이터 형식)·§3(예시)·§4(Wire-format)·§5(Timezone Semantics)·§6(신규 endpoint 추가 절차)·§7(MCP Bridge 와의 매핑)·§8(allowlist 와의 관계)·§9(CHANGELOG) 로 구성되어 있고, §7 에는 `7.5` 라는 하위 절이 전혀 없다. 링크 앵커 `#75-catalog-key-형식--활동-로그-api_label` 에 해당하는 제목도 존재하지 않는다. 따라서 `api_label` 의 catalog key 형식 정의(`cafe24.<resource>.<operation>`)가 규약 문서 내 공식화된 SoT 없이 데이터 모델에만 인라인으로 기술된 상태다.
  - 이 invariant(`api_label` 의 포맷)는 backend `IntegrationsService.logUsage()`, frontend 활동 탭 UI, 향후 API label 기반 필터 등이 동일하게 가정해야 하는 것으로, 규약 미존재 시 구현자마다 다른 포맷을 채택할 위험이 있다.
- **제안**: `spec/conventions/cafe24-api-metadata.md §7` 에 `### 7.5 catalog key 형식 — 활동 로그 api_label` 소절을 신설해 `cafe24.<resource>.<operation>` 포맷·길이 제한(128자)·truncate 정책을 명문화한다. 또는 `§6 신규 endpoint 추가 절차` 안에 별도 항으로 포함해 추가 절차 step 에 통합할 수 있다. 어느 방식이든 `spec/1-data-model.md §2.10.1` 의 링크 앵커를 실제 존재하는 절로 교정해야 한다.

---

### [CRITICAL] `INT-US-05` 요구사항 ID가 `_product-overview.md` 에 없다

- **target 위치**: `spec/1-data-model.md §2.10.1 IntegrationUsageLog`, `api_method` 필드 설명
  - 정확히: `[spec/4-nodes/4-integration/_product-overview.md INT-US-05](./4-nodes/4-integration/_product-overview.md#24-사용처-추적-및-라이프사이클)`
- **위반 규약**: 단일 진실 원칙 (CLAUDE.md §정보 저장 위치) — 데이터 모델이 존재하지 않는 요구사항 ID를 참조
- **상세**: `spec/4-nodes/4-integration/_product-overview.md §2.4 사용처 추적 및 라이프사이클` 에는 `INT-US-01` ~ `INT-US-04` 까지만 존재한다. `INT-US-05` 는 정의된 바 없다. 데이터 모델의 `api_method` / `api_path` 필드 설명이 `INT-US-05` 의 "통합별 의미" 표를 SoT 로 가리키고 있으나, 그 표가 현재 spec 어디에도 없다. 이는 구현자가 각 통합 유형별 `api_method` / `api_path` 의미를 파악할 방법이 없다는 뜻이다.
- **제안**: `spec/4-nodes/4-integration/_product-overview.md §2.4` 에 `INT-US-05` 를 신설하고, `http_request` / `database_query` / `send_email` / `cafe24` 각각의 `api_method` (HTTP method / SQL 동사 / `SEND` / Cafe24 HTTP method)·`api_path` (endpoint path / driver token / SMTP host / Cafe24 path) 의미 표를 포함한다. `spec/1-data-model.md` 의 링크 앵커는 실제 절이 생성된 이후 유효해진다.

---

### [WARNING] `api_label` catalog key 포맷이 `spec/1-data-model.md` 에만 인라인으로 정의되어 있다

- **target 위치**: `spec/1-data-model.md §2.10.1`, `api_label` 필드 설명: `cafe24 = cafe24.<resource>.<operation>`
- **위반 규약**: `spec/conventions/cafe24-api-metadata.md` 의 SoT 원칙 — 위 CRITICAL 발견사항의 연장선. 규약 문서 없이 데이터 모델 설명에만 포맷 정의가 있다.
- **상세**: `api_label` 의 포맷 `cafe24.<resource>.<operation>` 이 오직 데이터 모델 테이블 셀에만 정의되어 있다. 향후 다른 service_type(예: http_request, mcp) 에 `api_label` 이 추가될 경우 어떤 포맷을 따라야 하는지 규약 문서에 지침이 없다. `cafe24-api-metadata §7.5` 가 신설되면 본 WARNING 은 자동으로 해소된다.
- **제안**: CRITICAL §1 조치와 병행. cafe24-api-metadata 규약의 §7.5 에 포맷 문법(`<service_type>.<resource>.<operation>` 일반화 또는 `cafe24` 전용 고정 포맷 명시)과 길이 제한 근거를 기술한다.

---

### [WARNING] `api_label` / `api_method` / `api_path` 컬럼이 `spec/2-navigation/4-integration.md §4.6 Recent activity 탭` UI 스펙과 연결되지 않는다

- **target 위치**: `spec/1-data-model.md §2.10.1` 신규 세 컬럼 vs `spec/2-navigation/4-integration.md §4.6`
- **위반 규약**: 단일 진실 원칙 — UI 스펙이 데이터 모델 변경을 인지하지 못함
- **상세**: `spec/2-navigation/4-integration.md §4.6 Recent activity 탭` 는 현재 `At` / `Workflow` / `Node` / `✓/✗` / `ms` 5개 열만 명시하고 있다. 신규 `api_label` / `api_method` / `api_path` 컬럼이 추가되면 "Recent calls" 테이블에 API 레벨 정보(Cafe24 의 경우 `cafe24.product.product_list` 같은 label)를 노출할 여지가 생기는데, UI 스펙이 이를 반영하지 않았다. 구현자가 신규 컬럼을 UI 에 포함해야 하는지 판단할 근거가 없다.
- **제안**: `spec/2-navigation/4-integration.md §4.6` 에 `api_label` 컬럼의 노출 정책(Cafe24 경우 label 표시, NULL인 경우 열 미노출 또는 `-` 표시)을 명시하거나, "현재 UI 에 미노출, 향후 endpoint 필터 기능 도입 시 추가" 라는 의도를 명기한다.

---

### [WARNING] `spec/1-data-model.md §3 인덱스 전략` 이 신규 컬럼을 반영하지 않았다

- **target 위치**: `spec/1-data-model.md §3 인덱스 전략` — `IntegrationUsageLog` 항목
- **위반 규약**: 단일 진실 원칙 (데이터 모델 내 일관성)
- **상세**: 인덱스 전략 테이블에서 `IntegrationUsageLog` 항목은 `(integration_id, at DESC)` 와 `(at)` 두 인덱스만 나열하고 있다. `api_label` 필드 설명에는 "추후 method/path 별 필터가 필요할 때 추가" 라는 의도가 명시되어 있으므로 현 시점에서 인덱스가 없는 것은 의도적이다. 그러나 `spec/2-navigation/4-integration.md §13 데이터 모델 영향 요약` 이 신규 컬럼을 언급하지 않는 점은 별개의 누락이다.
- **제안**: `spec/2-navigation/4-integration.md §13 데이터 모델 영향 요약` 에 `IntegrationUsageLog.api_label` / `api_method` / `api_path` 컬럼 추가를 기재하여 추적 가능성을 확보한다. 인덱스 전략 테이블의 주석은 현 상태(미인덱스·의도적) 로 유지해도 무방하다.

---

### [INFO] `spec/1-data-model.md §2.10.1` 관련 문서 링크에서 `§Recent activity` 앵커가 부정확할 수 있다

- **target 위치**: `spec/1-data-model.md §2.10.1`, 상단 관련 문서 라인
  - `[Spec 통합 화면 §Recent activity](./2-navigation/4-integration.md)`
- **위반 규약**: 문서 구조 규약 — 관련 문서 링크의 앵커 정확성
- **상세**: `spec/2-navigation/4-integration.md §4.6 Recent activity 탭` 가 정확한 앵커인데 링크에는 `#recent-activity` 앵커가 없다(프래그먼트 없이 파일만 가리킴). 규약 문서 간 상호 참조 링크가 깨져 있으면 독자가 관련 절을 탐색하기 어렵다.
- **제안**: `[Spec 통합 화면 §Recent activity](./2-navigation/4-integration.md#46-recent-activity-탭)` 으로 프래그먼트를 명시한다.

---

## 요약

정식 규약 준수 관점에서 가장 심각한 문제는 `api_label` 필드가 참조하는 `spec/conventions/cafe24-api-metadata.md §7.5` 가 현재 실재하지 않는다는 점이다. 이 절이 없으면 catalog key 포맷 `cafe24.<resource>.<operation>` 이 규약 문서가 아닌 데이터 모델 셀에만 존재하게 되어, 구현자가 포맷을 변형하거나 다른 service_type 에 확장할 때 invariant 를 보장할 수단이 없다. 두 번째로 `INT-US-05` 요구사항 ID가 `_product-overview.md §2.4` 에 부재해 `api_method` / `api_path` 의 통합별 의미 표의 SoT 가 존재하지 않는다. 이 두 CRITICAL 은 spec 가 완전히 채워지기 전까지 구현 착수를 차단해야 한다. WARNING 3건은 UI 스펙·데이터 모델 영향 요약·링크 앵커 관련 추적 가능성 문제로, CRITICAL 해소 작업 내에서 함께 처리하는 것이 효율적이다.

---

## 위험도

**CRITICAL**

---

## 이슈 카운트

| 등급 | 건수 |
|------|------|
| CRITICAL | 2 |
| WARNING | 3 |
| INFO | 1 |
| **합계** | **6** |
