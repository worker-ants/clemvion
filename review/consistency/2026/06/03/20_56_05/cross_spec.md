# Cross-Spec 일관성 검토 결과

**검토 대상**: `spec/4-nodes/4-integration/` (전체 Integration 노드 영역)
**검토 모드**: 구현 착수 전 검토 (--impl-prep)
**검토 범위**: `0-common.md`, `1-http-request.md`, `2-database-query.md`, `3-send-email.md`, `4-cafe24.md`, `5-makeshop.md`

---

## 발견사항

### [WARNING] `MAKESHOP_INVALID_SHOP_UID` 에러 코드가 실행 로직에서 트리거 조건 미정의

- **target 위치**: `spec/4-nodes/4-integration/5-makeshop.md` §6 에러 코드 표 — `MAKESHOP_INVALID_SHOP_UID (D4) | shop_uid 형식 위반`
- **충돌 대상**: 동일 문서 §4 실행 로직 (step 1~12 어디에도 shop_uid 형식 검증 단계 없음), `spec/4-nodes/4-integration/0-common.md` §4.2 공통 에러 코드 표 (INTEGRATION_INCOMPLETE 가 credentials 필드 누락을 처리)
- **상세**: §6 에러 코드 표에 `MAKESHOP_INVALID_SHOP_UID` 가 `shop_uid 형식 위반` 조건으로 등재되어 있으나, §4 실행 로직(step 1~12)에 shop_uid 형식 검증 단계가 명시되어 있지 않다. step 4 credentials 충족 검증은 `shop_uid` 의 **존재 여부**를 확인하지만, 형식 검증(예: 빈 문자열, 특수문자 등)은 별도 검증 단계로 정의되어야 한다. Cafe24 노드(`spec/4-nodes/4-integration/4-cafe24.md`)에는 이에 대응하는 `CAFE24_INVALID_MALL_ID` 에러 코드가 없으며, 동일 공통 규약(`0-common.md`)에도 shop_uid 형식 위반에 대한 공통 에러 코드 언급이 없다. 에러 코드가 존재하되 트리거 조건이 실행 로직에 기술되지 않은 상태.
- **제안**: `5-makeshop.md` §4 실행 로직에 shop_uid 형식 검증 단계를 명시 (step 4 이후 또는 step 3 Integration 조회 직후에 shop_uid 형식 검증 → 실패 시 `MAKESHOP_INVALID_SHOP_UID` 로 §5.3 라우팅)하거나, 해당 에러 코드가 INTEGRATION_INCOMPLETE 로 흡수될 경우 §6 에서 제거.

---

### [WARNING] `0-common.md` §4.2 공통 에러 코드 표가 MakeShop 을 포함하지 않은 채 "Integration 4종" 으로 고정

- **target 위치**: `spec/4-nodes/4-integration/0-common.md` §4.2 D4 결정 주석 — "Integration 4종 (HTTP / Database Query / Send Email / Cafe24) 모두 send-email 의 catch 패턴으로 통일한다"
- **충돌 대상**: `spec/4-nodes/4-integration/0-common.md` §7 출력 구조 색인 — "Integration 노드(구현 4종 + MakeShop Planned)는 단일 에러 경로만 사용한다"
- **상세**: §4.2 D4 결정 주석은 "4종" 고정으로 기술하나, §7 출력 색인은 "+ MakeShop Planned" 를 명시하여 같은 문서 내에서 두 표현이 비일관적이다. MakeShop 이 Planned 상태임은 알지만, §4.2 주석이 MakeShop 을 누락하면 향후 구현자가 D4 결정이 MakeShop 에도 적용되는지 판단하기 어렵다. `5-makeshop.md` §4 step 12 는 D4 를 명시적으로 따르지만, 공통 규약 쪽 서술이 불일치한다.
- **제안**: `0-common.md` §4.2 D4 결정 주석을 "Integration 4종 (HTTP / Database Query / Send Email / Cafe24) + MakeShop (Planned)" 으로 갱신하거나 "구현된 모든 Integration 노드" 로 일반화.

---

### [WARNING] Send Email 노드의 성공 포트명 `'out'` 이 공통 규약 §3 의 기본 포트 예시(`'success'`)와 불일치

- **target 위치**: `spec/4-nodes/4-integration/3-send-email.md` §3.2 출력 포트 표 — port `out`, §5.1 성공 케이스 `"port": "out"`
- **충돌 대상**: `spec/4-nodes/4-integration/0-common.md` §3 공통 출력 구조 예시 — `"port": "success"`, §7 출력 구조 색인에서 `[send_email](./3-send-email.md#5-출력-구조) | §5.1 | §5.3 ('error')` 라고만 기술하고 포트명 불일치를 설명하지 않음
- **상세**: 공통 규약 §3 의 JSON 예시는 `"port": "success"` 를 기본으로 보여주며, §7 색인의 정상 케이스 열도 "§5.1 (`success`)" 라고 다른 노드들에 대해 명시한다. Send Email 만 성공 포트가 `'out'` 이고 에러 포트가 `'error'` 인데, §7 색인에서 Send Email 행의 정상 케이스가 "§5.1" 로만 기술되어 포트명 차이를 명확히 드러내지 않는다. 이는 워크플로 작성자가 `send_email` 이후 포트 연결 시 혼란을 줄 수 있고, 코드 리뷰어가 패턴 불일치를 발견하기 어렵다. (실제 충돌이 아니라 설계상 의도적 차이이나, 공통 규약 문서가 이 차이를 명시적으로 설명하지 않아 모순처럼 읽힌다.)
- **제안**: `0-common.md` §7 의 Send Email 행에 "(port `out`)" 명시 추가 및 §3 공통 출력 구조 설명에 "단, Send Email 은 성공 포트명이 `'out'`" 임을 brief 하게 언급. 또는 Send Email 의 성공 포트를 다른 노드와 통일하여 `'success'` 로 변경하는 방향 검토.

---

### [INFO] `spec/conventions/makeshop-api-metadata.md` method 타입 선언이 `GET`/`POST` 2종만 정의하나, 카탈로그 확인 결과 일치

- **target 위치**: `spec/conventions/makeshop-api-metadata.md` §2 `MakeshopOperationMetadata.method: 'GET' | 'POST'`
- **충돌 대상**: `spec/conventions/makeshop-api-catalog/` 각 섹션 카탈로그 표 및 openapi JSON
- **상세**: `makeshop-api-metadata.md` 는 MakeShop API 가 GET/POST 2종만 사용한다고 명시한다. 카탈로그 openapi JSON 파일들을 확인한 결과, `"delete"` 문자열이 나타나는 사례들은 모두 HTTP 메서드가 아닌 **경로 path segment** (`brand/delete`, `plan/delete`, `product/delete` 등 POST 메서드로 호출되는 엔드포인트 경로)로 확인되었다. 실제 충돌은 아니며 메타데이터 정의가 카탈로그와 일치한다.
- **제안**: 향후 혼란 방지를 위해 `makeshop-api-metadata.md` §4 Wire format 에 "(delete 등은 경로 segment 로 표현되며 HTTP 메서드로 사용되지 않는다)" 주석 1줄 추가 검토.

---

### [INFO] `spec/4-nodes/4-integration/5-makeshop.md` §4.2 에 해당 섹션 부재

- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md` §4.2 — "Request body envelope (POST/PUT 전용)" 절 정의
- **충돌 대상**: `spec/4-nodes/4-integration/5-makeshop.md` §4 실행 로직 — "§4 step 8" 에서 body 구성을 "flat JSON" 으로 처리하나 Cafe24 §4.2 에 대응하는 별도 절 없음
- **상세**: Cafe24 spec 은 §4.2 에 request body envelope 규칙을 별도 절로 분리했으나, MakeShop spec 은 §9.4 Rationale 에 "flat JSON body" 적용 근거를 서술하고, §4 step 8 에서 구현 지시를 인라인으로 기술하는 방식으로 다르다. 이는 구조적 차이일 뿐 내용상 충돌은 없다. 단, `makeshop-api-metadata.md` §4 에서 `"POST/PUT body"` 라고 언급되어 있으나 MakeShop 은 PUT 을 사용하지 않으므로 Wire format 절의 `POST/PUT` 표현이 오해를 유발할 수 있다.
- **제안**: `makeshop-api-metadata.md` §4 Wire format 에서 "POST/PUT body" → "POST body" 로 수정 (MakeShop 은 GET/POST 2종만 사용하므로 PUT 언급 불필요).

---

### [INFO] `spec/1-data-model.md` Integration 엔티티의 `mall_id` 컬럼 설명이 MakeShop 투영 방식을 명시하나 비즈니스 규칙(중복 통합 금지)은 Cafe24 에만 명시

- **target 위치**: `spec/1-data-model.md` §2.10 Integration `mall_id` 필드 설명
- **충돌 대상**: `spec/4-nodes/4-integration/5-makeshop.md` §9.3, `spec/2-navigation/4-integration.md` §5.9
- **상세**: `1-data-model.md` §2.10 `mall_id` 설명에서 "비즈니스 규칙: 같은 workspace 내 같은 `mall_id` 의 cafe24 통합은 `app_type` 무관 최대 1행" 규칙이 **Cafe24 에만** 명시되어 있다. MakeShop 도 동일한 partial UNIQUE 인덱스로 shop_uid 중복을 차단하지만 (§3 인덱스 전략 표에 Planned 로 언급), 동일한 "같은 workspace 내 같은 `mall_id`(= `shop_uid`) 의 makeshop 통합은 최대 1행" 비즈니스 규칙이 `mall_id` 필드 설명 본문에 명시되지 않았다. 완전한 충돌은 아니나 단일 진실 원칙상 동일 컬럼 설명에서 두 service_type 의 동일 규칙이 대칭적으로 기술되어야 한다.
- **제안**: `1-data-model.md` §2.10 `mall_id` 비즈니스 규칙 항목을 "Cafe24 는 ..., **MakeShop(Planned) 도 같은 workspace 내 같은 `shop_uid` 의 makeshop 통합은 최대 1행**" 으로 확장 기술.

---

## 요약

`spec/4-nodes/4-integration/` 전체 영역에서 기존 `spec/**` 와의 직접 모순은 발견되지 않았다. 주요 위험은 두 가지 WARNING 수준 이슈다: (1) `5-makeshop.md` §6 에서 정의된 `MAKESHOP_INVALID_SHOP_UID` 에러 코드의 트리거 조건이 §4 실행 로직에 기술되지 않아 구현자가 해당 검증 단계를 누락할 가능성이 있다. (2) `0-common.md` §4.2 D4 결정 주석이 "4종" 으로 고정된 채 MakeShop Planned 를 누락하여 같은 문서 내 §7 색인과 비일관적이다. Send Email 의 성공 포트명 `'out'` 이 공통 규약 예시 `'success'` 와 다른 점도 명시적 설명이 부족하다. INFO 수준으로는 `makeshop-api-metadata.md` 의 `POST/PUT body` 표현이 실제로 PUT 을 사용하지 않는 MakeShop API 특성과 맞지 않아 오해를 유발할 수 있다. 구현 착수를 막을 CRITICAL 이슈는 없다.

---

## 위험도

LOW
