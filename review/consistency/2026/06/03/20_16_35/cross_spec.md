# Cross-Spec 일관성 검토 결과

**대상 문서**: `spec/4-nodes/4-integration/5-makeshop.md`
**검토 일시**: 2026-06-03
**검토 모드**: `--spec` (spec draft 검토)

---

## 발견사항

### [INFO] 0-common.md 범위 서술과 target 노드의 위치 불일치
- **target 위치**: `spec/4-nodes/4-integration/5-makeshop.md` 전체 (target 문서가 `[Integration 공통 §4](./0-common.md)` 를 따른다고 선언)
- **충돌 대상**: `spec/4-nodes/4-integration/0-common.md` 문서 상단 범위 서술 — "본 문서의 범위: 워크플로 캔버스에 직접 배치되는 Integration 노드(HTTP Request, Database Query, Send Email)의 공통 규약을 다룬다."
- **상세**: 0-common.md 의 범위 서술은 HTTP Request / Database Query / Send Email 세 노드만 열거하며, cafe24 / makeshop 같은 서비스 특화 노드를 포함하지 않는다. Cafe24 노드 spec(`spec/4-nodes/4-integration/4-cafe24.md`)도 동일하게 공통 §4 를 참조하지만, 0-common.md 의 범위 서술이 cafe24·makeshop 을 명시하지 않아 공통 규약의 적용 대상이 불분명하다.
- **제안**: `spec/4-nodes/4-integration/0-common.md` 의 "본 문서의 범위" 문단에 `cafe24`, `makeshop` (및 향후 서비스 특화 노드) 도 공통 규약 적용 대상임을 명시하거나, 범위 서술을 "통합 카테고리 노드 전반" 으로 일반화한다.

---

### [INFO] 0-common.md 캔버스 요약 색인 테이블에 MakeShop 미등재
- **target 위치**: `spec/4-nodes/4-integration/5-makeshop.md §7` — 캔버스 요약 포맷 `{resource} · {operation}` 정의
- **충돌 대상**: `spec/4-nodes/4-integration/0-common.md §5 캔버스 요약` — Integration 노드별 요약 포맷 색인 테이블 (HTTP Request / Cafe24 / Database Query / Send Email 만 등재)
- **상세**: Cafe24 노드 spec 에 대응하는 `cafe24` 행이 이미 0-common.md 색인에 존재하는데, MakeShop 은 누락되어 있다. target 이 채택될 때 0-common.md 색인도 동기화해야 한다.
- **제안**: target 채택 시 `spec/4-nodes/4-integration/0-common.md §5` 의 캔버스 요약 색인 테이블에 `makeshop | {{resource}} · {{operation}} | 미구현 (Planned)` 행을 추가한다.

---

### [INFO] IntegrationUsageLog api_label 서술 — MakeShop 미언급
- **target 위치**: `spec/4-nodes/4-integration/5-makeshop.md §4 step 11` — `api_label = catalog key 'makeshop.<resource>.<operation>'` 정의
- **충돌 대상**: `spec/1-data-model.md §2.10.1 IntegrationUsageLog` — `api_label` 설명: "cafe24 = `cafe24.<resource>.<operation>`. http-request / database-query / send-email = NULL."
- **상세**: 데이터 모델의 `api_label` 설명이 cafe24 만 non-NULL 예시로 언급하고 makeshop 을 포함하지 않는다. target 이 채택되면 makeshop 도 `makeshop.<resource>.<operation>` 형식의 비-NULL `api_label` 을 기록하므로 데이터 모델 서술이 구식이 된다. 동일 패턴이 `spec/2-navigation/4-integration.md §9.3` 의 `ActivityItem.apiLabel` 설명에도 반복된다.
- **제안**: `spec/1-data-model.md §2.10.1` 의 `api_label` 설명에 `makeshop = 'makeshop.<resource>.<operation>'` 를 추가한다. `spec/2-navigation/4-integration.md §9.3` `ActivityItem.apiLabel` 설명, `spec/4-nodes/4-integration/_product-overview.md §2.4 INT-US-05` 표도 동기 갱신 대상이다.

---

### [INFO] 통합 목록 페이지 서비스 유형 칩 및 Add Integration 모달에 MakeShop 미반영
- **target 위치**: `spec/4-nodes/4-integration/5-makeshop.md §1` — `service_type='makeshop'` Integration 정의
- **충돌 대상**: `spec/2-navigation/4-integration.md §2.3` 서비스 유형 칩 목록, `§2.5 Add Integration 모달` 카드 레이아웃 목업
- **상세**: §2.3 의 서비스 유형 칩 목록과 §2.5 의 모달 카드 목업이 MakeShop 을 포함하지 않는다. `spec/0-overview.md §6.3` 의 로드맵 행이 MakeShop 을 언급하지만 통합 화면 spec 은 업데이트되지 않았다. target 이 Planned 상태이므로 즉각 충돌은 아니지만, 구현 착수 전 해당 spec 을 정렬해야 한다.
- **제안**: target status 가 `implemented` 로 승격될 때 `spec/2-navigation/4-integration.md §2.3`, `§2.5` 에 MakeShop 서비스 유형 칩/카드를 추가하고, §5 에 `5.9 MakeShop` credentials JSONB 스키마 섹션을 추가한다. 현재 Planned 단계에서는 링크 참조(§5.9 예정)로 명시하는 수준이면 충분하다.

---

### [INFO] 통합 화면 §10.3 provider별 설정 표에 MakeShop OAuth 미등재
- **target 위치**: `spec/4-nodes/4-integration/5-makeshop.md §9.1` — OAuth 흐름 Authorization-Code + refresh 채택, `auth.makeshop.com` 토큰 endpoint
- **충돌 대상**: `spec/2-navigation/4-integration.md §10.3` — provider별 설정 표 (Google / GitHub / Cafe24 만 열거)
- **상세**: `§10.3` 표는 OAuth refresh 지원 provider 를 나열하는데 MakeShop 이 누락되어 있다. target 이 `auth.makeshop.com/oauth/token` 을 token endpoint 로 정의하므로 해당 표에 MakeShop 행이 필요하다.
- **제안**: target status 가 `implemented` 로 승격될 때 `spec/2-navigation/4-integration.md §10.3` 에 MakeShop provider 행을 추가한다. 현 Planned 단계에서는 미루어도 무방하나, token endpoint URL 은 target §9.1 이 단일 진실로 보유한다.

---

### [INFO] `spec/0-overview.md §6.3` 로드맵 항목과 target 선언 일치 — 동기화 확인
- **target 위치**: `spec/4-nodes/4-integration/5-makeshop.md` 전체, `status: planned`
- **충돌 대상**: `spec/0-overview.md §6.3` — "MakeShop 은 spec 작성 완료(Planned) — 노드+MCP 161 REST operation, OAuth 2.1 auth-code+refresh."
- **상세**: target 문서의 지원 범위는 "7 섹션, 161 REST operation" 이고 0-overview.md §6.3 도 동일하게 "161 REST operation" 을 언급한다. 불일치 없음. 참조 경로(`spec/4-nodes/4-integration/5-makeshop.md`, `spec/2-navigation/4-integration.md#59-makeshop`, `spec/conventions/makeshop-api-catalog/_overview.md`) 도 target 의 선언과 일치한다. 단, `spec/2-navigation/4-integration.md#59-makeshop` 앵커가 현재 해당 파일에 존재하지 않아(실제 파일에서 MakeShop 섹션 미확인) 0-overview.md 의 참조가 깨진 링크가 될 수 있다.
- **제안**: `spec/2-navigation/4-integration.md` 에 `§5.9 MakeShop` 섹션이 추가되기 전까지 0-overview.md 의 링크를 "(Planned, 추가 예정)" 으로 표기하거나 링크를 제거한다.

---

### [WARNING] Node.type Enum에 `makeshop` 미등재 — 데이터 모델 갭
- **target 위치**: `spec/4-nodes/4-integration/5-makeshop.md §1` — `service_type='makeshop'` 통합을 참조하는 노드 정의
- **충돌 대상**: `spec/1-data-model.md §2.6 Node` — `Node.type` 전체 목록 표 — `integration` 카테고리 항목에 `cafe24` 는 있지만 `makeshop` 이 없음
- **상세**: 데이터 모델 §2.6 의 `Node.type` 전체 목록은 `cafe24` 를 "워크플로 캔버스에 배치 가능한 통합 노드" 로 명시한다. target 이 MakeShop 노드를 동등한 통합 노드로 정의하지만 해당 표에 `makeshop` type 이 없다. 구현 시 `Node.type = 'makeshop'` 이 DB Enum 에 추가돼야 하는데, 데이터 모델 spec 이 이를 선언하지 않으면 마이그레이션 범위가 불명확해진다.
- **제안**: `spec/1-data-model.md §2.6` `Node.type` 전체 목록의 integration 카테고리에 `makeshop | MakeShop Shop API (Resource × Operation 동적 폼). 같은 Integration 이 AI Agent MCP 도구로도 사용` 행을 추가한다. 마이그레이션 파일(`V05X__node_type_makeshop.sql`) 도 동반 추가 대상이다.

---

### [WARNING] `spec/2-navigation/4-integration.md §13 데이터 모델 영향 요약`에 MakeShop 인덱스 미언급
- **target 위치**: `spec/4-nodes/4-integration/5-makeshop.md §9.3` — `(workspace_id, mall_id) WHERE service_type='makeshop' UNIQUE` 인덱스 필요성 언급
- **충돌 대상**: `spec/2-navigation/4-integration.md §13` — Integration 관련 데이터 모델 영향 요약, `spec/1-data-model.md §3 인덱스 전략`
- **상세**: 데이터 모델 `§3` 인덱스 전략 표에는 MakeShop 전용 partial UNIQUE 인덱스 `(workspace_id, mall_id) WHERE service_type='makeshop' AND mall_id IS NOT NULL UNIQUE` 가 이미 "(Planned)" 주석과 함께 등재되어 있다. 그러나 `spec/2-navigation/4-integration.md §13` 의 "데이터 모델 영향 요약" 에는 이 인덱스가 언급되지 않아 완전한 이력이 한 곳에만 집중된다. 충돌은 아니지만 §13 이 cafe24 인덱스(V046)를 명시한 것과 대조해 MakeShop 인덱스가 누락된 비대칭이다.
- **제안**: target status 가 `implemented` 로 승격될 때 `spec/2-navigation/4-integration.md §13` 에 MakeShop 인덱스 항목(마이그레이션 번호 포함)을 추가한다.

---

### [WARNING] `spec/4-nodes/4-integration/0-common.md §7 출력 구조 색인`에 MakeShop 미등재 — 구조 불완전
- **target 위치**: `spec/4-nodes/4-integration/5-makeshop.md §5` — 5필드 envelope 출력 구조
- **충돌 대상**: `spec/4-nodes/4-integration/0-common.md §7 출력 구조 색인` — Integration 4종(http_request / database_query / send_email / cafe24) 만 열거
- **상세**: 0-common.md §7 은 "Integration 4종" 이라고 명시하며 cafe24 를 포함해 출력 구조를 색인한다. target 이 채택되면 5종이 되어 §7 의 서술("4종")과 불일치하고 색인이 불완전해진다. 현재 Planned 상태이므로 즉각 오류는 아니지만, 독자에게 혼란을 준다.
- **제안**: `spec/4-nodes/4-integration/0-common.md §7` 의 "Integration 4종" 표현을 "Integration 노드" 로 일반화하고, MakeShop 행을 `Planned` 상태로 추가한다.

---

### [WARNING] OAuth 토큰 갱신 엔드포인트 충돌 가능성 — `auth.makeshop.com` vs `connect.makeshop.co.kr`
- **target 위치**: `spec/4-nodes/4-integration/5-makeshop.md §4 step 6` — "갱신 endpoint = `https://auth.makeshop.com/oauth/token` (`grant_type=refresh_token`)"
- **충돌 대상**: `spec/4-nodes/4-integration/5-makeshop.md §4 step 7` — "URL 구성: `https://connect.makeshop.co.kr/api/v1/{shop_uid}/...`"
- **상세**: target 자체 내의 일관성 검토에서 발견. token endpoint 는 `auth.makeshop.com`, 데이터 API 는 `connect.makeshop.co.kr` 로 두 개의 서로 다른 호스트를 사용한다. 이는 target §9.1 에서 "(a) Authorization-Code 흐름: `auth.makeshop.com`" 으로 명시하여 의도적 구분임이 확인된다. 그러나 `spec/2-navigation/4-integration.md §10.3` provider별 설정 표(Cafe24 의 경우 Token URL 이 `https://{mall_id}.cafe24api.com/api/v2/oauth/token` 으로 단일 호스트)와 패턴이 다르며, 향후 §10.3 에 MakeShop 이 추가될 때 "auth.makeshop.com" 을 명시해야 한다. 추가로, target 이 `refresh_token` 갱신 endpoint 를 `auth.makeshop.com` 으로만 특정했는데, MakeShop 공식 문서에서 이를 검증하기 전까지 미확인 항목(§9.7 과 유사한 open question)으로 다루어야 한다.
- **제안**: target §9.7 미확인 항목 목록에 "token refresh endpoint 호스트(`auth.makeshop.com`) 구현 전 재확인" 을 추가한다. `spec/2-navigation/4-integration.md §10.3` 추가 시 해당 URL 을 명시하는 요건을 plan 에 포함한다.

---

### [WARNING] `spec/2-navigation/4-integration.md §9.3 catalog API` — MakeShop catalog endpoint 미선언
- **target 위치**: `spec/4-nodes/4-integration/5-makeshop.md §4 step 11` — `GET /api/integrations/services/makeshop/catalog` 응답 `labelKey` 참조 암시
- **충돌 대상**: `spec/2-navigation/4-integration.md §9.3` — `GET /api/integrations/services/:type/catalog` 초기 응답 정책: ":type='cafe24' 만 backend 메타데이터에서 추출한 `operations[]` 를 채워 반환하고, 그 외는 빈 배열"
- **상세**: target §4 step 11 의 `api_label` 서술은 "frontend 가 `GET /api/integrations/services/makeshop/catalog` 응답 `labelKey` + i18n dict 로 렌더" 라고 암시한다. 그런데 통합 화면 spec §9.3 은 "`:type='cafe24'` 만 operations[] 를 채워 반환" 하고 `makeshop` 을 명시적으로 빈 배열 반환 대상으로 처리하지 않는다. makeshop catalog 가 실제로 non-empty operations[] 를 반환하려면 §9.3 의 초기 응답 정책이 갱신되어야 한다. 현재 Planned 상태이므로 즉각 충돌은 아니지만, 구현 PR 에서 §9.3 갱신 없이 catalog endpoint 를 makeshop 지원으로 확장하면 spec 과 코드가 어긋난다.
- **제안**: target status 가 `implemented` 로 승격될 때 `spec/2-navigation/4-integration.md §9.3` 의 "초기 응답 정책" 문단에 `makeshop` 을 non-empty 반환 대상으로 추가한다. plan 에 이 갱신을 체크리스트 항목으로 포함한다.

---

### [WARNING] `spec/1-data-model.md §2.10 응답 DTO 전용 derived 필드` — `autoRefresh` 서술 정합성
- **target 위치**: `spec/4-nodes/4-integration/5-makeshop.md §9.8` — "`makeshop` 은 `autoRefresh=true` (auth-code+refresh)"
- **충돌 대상**: `spec/1-data-model.md §2.10` 응답 DTO 전용 derived 필드 설명 — "현재 `cafe24` / `google` 가 true, **`makeshop` 추가 예정 — Planned, auth-code+refresh**"
- **상세**: 데이터 모델 spec 이 이미 makeshop 의 `autoRefresh=true` 예정을 "(Planned)" 로 명시하고 있으므로 target 과 일치한다. 충돌 없음. 그러나 `spec/2-navigation/4-integration.md §9.1` 의 `GET /api/integrations/:id` 응답 설명에서 "현재 `service_type='cafe24'`, `service_type='google'` 이 `true`, 그 외(`github` 포함)는 `false`" 라고 명시하는데 MakeShop 이 언급되지 않는다. 구현 완료 후 이 문장도 갱신해야 한다.
- **제안**: target status 가 `implemented` 로 승격될 때 `spec/2-navigation/4-integration.md §9.1` 의 `autoRefresh` 설명에 `makeshop` 을 추가한다.

---

### [CRITICAL] `spec/4-nodes/4-integration/5-makeshop.md §3` 포트 정의 — Cafe24 §3 구조와 미세 차이
- **target 위치**: `spec/4-nodes/4-integration/5-makeshop.md §3 포트` — 포트 테이블에 `dynamic` 컬럼 없음
- **충돌 대상**: `spec/4-nodes/4-integration/4-cafe24.md §3 포트` — `in` / `success` / `error` 포트 테이블에 `dynamic` 컬럼 포함 (`false` 값)
- **상세**: Cafe24 §3 포트 테이블은 `id | label | type | dynamic | 설명` 의 5컬럼 형식이지만, target §3 은 `id | label | type | 설명` 의 4컬럼으로 `dynamic` 컬럼이 누락되어 있다. target 이 "Cafe24 §3 과 동일" 이라고 선언하면서 실제 테이블 구조가 다르다. 노드 포트 스키마의 `dynamic` 속성은 실행 엔진이 포트를 해석하는 데 쓰는 메타데이터이므로, spec 의 불일치가 그대로 구현에 전달될 경우 포트 등록 schema 가 틀려질 수 있다.
- **제안**: target `spec/4-nodes/4-integration/5-makeshop.md §3` 의 포트 테이블에 `dynamic` 컬럼을 추가하여 Cafe24 §3 와 동일하게 `false` 값을 명시한다.

---

## 요약

`spec/4-nodes/4-integration/5-makeshop.md` (target)는 Cafe24 노드와 동형(isomorphic) 설계를 명시적으로 선언하며, 데이터 모델(`spec/1-data-model.md §2.10`)·통합 화면(`spec/2-navigation/4-integration.md`)·0-overview.md 의 MakeShop 관련 기존 선언과 전반적으로 일치한다. 직접적 의미 충돌은 발견되지 않았다. 다만 CRITICAL 1건(§3 포트 테이블 `dynamic` 컬럼 누락)과 WARNING 5건(Node.type Enum 미등재, 인덱스 요약 누락, 0-common.md 색인 불완전, catalog API 정책 불일치, refresh endpoint 미확인)이 구현 착수 전 해소되어야 한다. INFO 5건은 target 채택 시 연동 문서들의 동기화 갱신이 필요한 항목이다. 현재 `status: planned` 상태이므로 즉각적인 운영 차단 리스크는 없으나, 구현 PR 에서 위 항목들이 동반 처리되지 않으면 spec 과 코드 사이 갭이 발생한다.

---

## 위험도

MEDIUM

STATUS: SUCCESS
