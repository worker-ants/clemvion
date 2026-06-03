### 발견사항

- **[WARNING]** `shop_uid` vs `mall_id` 컬럼명 불일치 — Rationale 표기와 실제 데이터 모델 컬럼명 괴리
  - target 위치: `spec/4-nodes/4-integration/5-makeshop.md` §9.3 "단일 호스트 + shop_uid path segment"
  - 과거 결정 출처: `spec/1-data-model.md` §2.10 Integration 테이블 `mall_id` 컬럼 정의 및 부분 UNIQUE 인덱스 표
  - 상세: MakeShop §9.3 은 "data-model `Integration` 의 평탄 컬럼으로 투영하고 `(workspace_id, shop_uid)` UNIQUE 로 중복 연결을 차단한다"라고 기술한다. 그러나 data-model §2.10 의 실제 컬럼명은 `mall_id` (Cafe24 와 공유, MakeShop `credentials.shop_uid` 를 재사용)이며, 인덱스도 `(workspace_id, mall_id) WHERE service_type='makeshop'`이다. target 의 `(workspace_id, shop_uid)` 표기는 실제 컬럼명 `mall_id` 와 괴리된다. data-model 은 "MakeShop 은 `credentials.shop_uid` 를 `mall_id` 컬럼에 복제"라고 설명하므로 결정이 번복된 것은 아니지만, Rationale 내 표기가 실제 data-model 컬럼명을 가리지 않아 독자가 혼동하기 쉽다.
  - 제안: §9.3 의 "data-model `Integration` 의 평탄 컬럼으로 투영하고 `(workspace_id, shop_uid)` UNIQUE" 표현을 "`mall_id` 컬럼(`credentials.shop_uid` 재사용)으로 투영하고 `(workspace_id, mall_id) WHERE service_type='makeshop'` partial UNIQUE" 로 보정하거나, data-model §2.10 링크 옆에 "실제 컬럼명은 `mall_id`" 주석을 추가한다.

- **[INFO]** `INTEGRATION_SERVICE_UNAVAILABLE` 에러 코드 — Cafe24 §6 에 있으나 MakeShop §6 에 미수록
  - target 위치: `spec/4-nodes/4-integration/5-makeshop.md` §6 에러 코드 표
  - 과거 결정 출처: `spec/4-nodes/4-integration/4-cafe24.md` §6 에러 코드 표 — `INTEGRATION_SERVICE_UNAVAILABLE` (`__workspaceId` 컨텍스트 누락 / `Cafe24ApiClient` 미주입, deployment 오류)
  - 상세: Cafe24 §6 은 `INTEGRATION_SERVICE_UNAVAILABLE` 을 명시적으로 열거한다. MakeShop §6 에러 코드 표에는 이 코드가 없고 `INTEGRATION_*` 를 공통 §4.2 포괄 항목으로만 지시한다. `INTEGRATION_SERVICE_UNAVAILABLE` 이 공통 §4.2 의 범주에 명시적으로 포함되는지 공통 규약을 보면 (`0-common.md §4.2`) 해당 코드는 나열되지 않아 — Cafe24 고유 항목일 수 있다 — MakeShop 에도 같은 deployment 오류 분기가 예상되나 미수록 상태다. 결정의 번복은 아니나 Cafe24 §6 의 "동형" 원칙 대비 누락이다.
  - 제안: MakeShop §6 에 `MAKESHOP_SERVICE_UNAVAILABLE (D4)` 행을 추가하거나, §6 첫머리에 "Cafe24 §6 의 `INTEGRATION_SERVICE_UNAVAILABLE` 에 해당하는 코드는 `MAKESHOP_SERVICE_UNAVAILABLE` (동일 조건)" 메모를 추가한다. 또는 공통 §4.2 에 해당 코드를 이동시켜 공유한다.

- **[INFO]** `meta.callUsage`/`meta.callRemain` 미노출 — Cafe24 §9.5 의 5필드 invariant 상 정합이나 MakeShop §5.1 출력 예시에 설명 부재
  - target 위치: `spec/4-nodes/4-integration/5-makeshop.md` §5.1 출력 구조 테이블
  - 과거 결정 출처: `spec/4-nodes/4-integration/4-cafe24.md` §5.1 출력 구조 — `meta.callUsage`, `meta.callRemain`, `meta.callLimit` 가 Cafe24 전용 rate-limit 헤더 필드로 명시됨
  - 상세: MakeShop §5 는 "Cafe24 §5 와 동일한 5필드 envelope" 라고 선언하나, §5.1 출력 예시 테이블에 Cafe24 `meta.callUsage`/`meta.callRemain` 에 대응하는 MakeShop 전용 rate-limit 메타 필드 유무를 명시하지 않는다. §9.7 미확인 항목에 rate limit 정책이 미확인임을 기술하여 최종 결정이 유보 상태임은 명확하다. 그러나 "5필드 동일" 선언과 실제 `meta.*` 필드 셋의 차이가 설명 없이 남아있어, 구현자가 Cafe24 `meta.callUsage` 와의 동형성 여부를 오해할 수 있다.
  - 제안: §5.1 테이블에 `meta.callUsage?` / `meta.callRemain?` 항목을 추가하고 "MakeShop rate-limit 헤더 미공개 — §9.7 구현 시 확정, Cafe24 의 `X-Cafe24-Call-Usage`·`X-Cafe24-Call-Remain` 에 해당하는 헤더가 확인되면 추가" 라는 주석을 달거나, 현재 `meta` 가 `statusCode`/`durationMs` 2개만임을 표에서 명시한다.

- **[INFO]** `cursor` 기반 페이지네이션 폐기 결정 참조 누락
  - target 위치: `spec/4-nodes/4-integration/5-makeshop.md` §1 config `pagination` 필드
  - 과거 결정 출처: `spec/4-nodes/4-integration/4-cafe24.md` §1 `pagination` 필드 — "`cursor` 는 Cafe24 Admin API 가 일관 지원하지 않아 폐기됨 (B-3-7, Rationale 참조)"
  - 상세: Cafe24 §1 은 `cursor` 폐기 결정을 명시적으로 기록하여 역사적 선택의 흔적을 남긴다. MakeShop §1 은 `{ limit?: number, offset?: number }` 만 기술하지만 `cursor` 폐기 이유(MakeShop API 가 cursor 를 일관 지원하는지 여부)는 언급이 없다. MakeShop catalog 에 cursor 지원 여부를 확인하지 않은 상태에서 묵시적으로 offset/limit 만 채택했다면, 추후 cursor 지원 operation 이 발견될 때 재결정이 필요하다.
  - 제안: §9.7 미확인 항목에 "cursor-based pagination 지원 operation 유무 — catalog 에서 확인 후 필요 시 `pagination.cursor` 추가" 를 추가하거나, §1 주석에 "cursor 미지원(현재 확인 범위 내) — 추후 확인 필요" 를 달아 Rationale 공백을 메운다.

### 요약

`spec/4-nodes/4-integration/5-makeshop.md` (target) 는 전반적으로 Cafe24 노드 Rationale 와의 연속성을 잘 유지한다. 명시적으로 기각된 대안(Client-Credentials 흐름, `{request:{...}}` envelope, `restrictedApproval` 라벨, 콤마 구분 scope) 을 재도입하는 항목은 없으며, 각 채택·기각 근거가 §9.1~§9.8 에 고유 Rationale 로 문서화되어 있다. 합의된 5필드 invariant·Internal MCP Bridge·메타데이터 기반 동적 폼 원칙도 모두 준수한다. 다만 데이터 모델 컬럼명 `mall_id`를 Rationale 에서 `shop_uid`라고 표기한 불일치(WARNING), `INTEGRATION_SERVICE_UNAVAILABLE` 코드 미수록(INFO), rate-limit meta 필드 미명시(INFO), cursor pagination 폐기 근거 부재(INFO) 가 보완 대상으로 발견됐다. 이 중 WARNING 1건은 컬럼명 혼동을 유발할 수 있어 구현 착수 전 수정이 권고된다.

### 위험도

LOW

STATUS: SUCCESS
