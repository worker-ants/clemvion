# 정식 규약 준수 검토 — `spec/2-navigation/4-integration.md`

검토 모드: `--impl-prep` (구현 착수 전)

---

## 발견사항

### 1. [WARNING] Rationale 내 리뷰 경로 참조가 옛 flat 형식 사용
- **target 위치**: `## Rationale` 섹션, "Cafe24 Private 앱의 callback 실패는 왜 status 를 보존하나" 항 말미 — `(참고: review/consistency/2026-05-14_18-23-55)`
- **위반 규약**: `CLAUDE.md` "명명 컨벤션" 표 — review 경로 형식은 `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` (nested ISO). 구 flat 형식(`review/consistency/<timestamp>/`)은 "이미 누적된 데이터는 사용자가 이동 예정, 새 세션부터 위 형식 강제" 로 명시.
- **상세**: 참조된 경로 `review/consistency/2026-05-14_18-23-55`는 `review/<timestamp>/` 패턴의 flat 형식이다. 새 규약의 nested ISO 경로(`review/consistency/2026/05/14/18_23_55/`)와 다르다. spec 본문이 구 경로를 인용하면 독자가 옛 경로와 새 경로를 혼용하는 선례가 생길 수 있다.
- **제안**: Rationale 참조를 `(참고: review/consistency/2026/05/14/18_23_55/)` 형식으로 교정하거나, 경로 참조 없이 일자만 기재(`2026-05-14 consistency 검토 결과`)하도록 수정. 다만 해당 세션 파일이 아직 flat 경로에 실존한다면 이동 완료 후 경로를 갱신하는 순서가 적합하다. 구현 착수 직전이므로 블로킹 요인은 아니나 향후 spec 정합성 유지를 위해 교정 권장.

---

### 2. [INFO] error code 표기 혼용 — `status_reason` snake_case vs API code UPPER_SNAKE_CASE 맥락이 한 표에서 섞임
- **target 위치**: §9.4 "공통 응답 포맷" — `INTEGRATION_IN_USE`, `INTEGRATION_TEST_FAILED`, `OAUTH_STATE_MISMATCH` 등 API error code 목록, 그리고 §10.4 "에러 매핑" 표의 `status_reason` 컬럼 값(`oauth_token_exchange_failed`, `oauth_state_mismatch`)
- **위반 규약**: `spec/conventions/node-output.md` Principle 3.2 — `"code" 는 UPPER_SNAKE_CASE`. 또한 §10.4 표에서 `status_reason` 값은 `snake_case` 라 명시하고 있음 (Rationale §"status_reason `oauth_token_exchange_failed`…" 참조).
- **상세**: 규약 및 문서 자체가 두 가지 케이스를 도메인별로 의도적으로 분리(`status_reason` = snake_case DB 컬럼, API code = UPPER_SNAKE_CASE)한다고 Rationale 에 명확히 서술되어 있다. 실제로 문서 내에서도 도메인을 분리해 올바르게 기술하고 있다. 그러나 §10.4 표의 "Integration 상태" 컬럼이 `status_reason='oauth_token_exchange_failed'` 같은 DB 컬럼 표현과 `error(auth_failed)` 같은 상태 레이블을 함께 쓰면서, 표 헤더만으로는 어느 것이 API 응답 code 고 어느 것이 DB 저장 값인지 구분이 어렵다. node-output 규약의 `UPPER_SNAKE_CASE` code 규칙은 API output의 `output.error.code`에 적용되는 것이고, `Integration.status_reason` 컬럼은 DB 도메인이라 별도 컨벤션을 따르므로 규약 위반은 아니다. 다만 독자 혼동을 줄이기 위해 §10.4 표의 컬럼 표기를 명확히 구분하면 좋다.
- **제안**: §10.4 표에서 "Integration 상태" 컬럼을 "DB status / status_reason" 으로 구체화하거나, 표 하단에 "표기 구분: API 응답 code = UPPER_SNAKE_CASE, DB status_reason = snake_case" 주석을 한 줄 추가. 규약 위반 자체는 없으므로 우선도 낮음.

---

### 3. [INFO] `## Overview` 섹션 부재 — 단일 파일 영역 판단 여부 확인
- **target 위치**: 문서 전체 구조 — Overview / 본문 / Rationale 3섹션 권장 중 Overview 없음
- **위반 규약**: `CLAUDE.md` "프로젝트 스펙 문서" — "각 spec 문서는 권장 3섹션 구성을 따른다: 1. Overview (제품 정의), 2. 본문 (스펙), 3. Rationale". 단, `_product-overview.md` 가 별도로 존재하는 다중 spec 파일 영역에서는 Overview 섹션을 해당 파일에 위임하는 것이 정상.
- **상세**: `spec/2-navigation/` 디렉토리는 `_product-overview.md` 를 보유한 다중 파일 영역(`spec/<영역>/_product-overview.md` 패턴)이고, 본 파일 상단에 `[PRD 내비게이션](./_product-overview.md#34-integration-통합)` 링크로 제품 정의를 명시적으로 참조하고 있다. CLAUDE.md 의 예외 규정과 정합한다. 위반이 아님.
- **제안**: 현재 구조는 규약에 맞음. 추가 조치 불필요. 참고용 INFO로만 기록.

---

### 4. [INFO] 금지 경로(`prd/`, `memory/`) 참조 없음 — 적정
- **target 위치**: 전체 문서
- **위반 규약**: `CLAUDE.md` — "옛 `prd/`, `memory/`, `user_memo/` 폴더 … 신규 문서를 옛 경로 컨벤션으로 만들지 않는다."
- **상세**: 문서 내 어디에도 `prd/`, `memory/`, `user_memo/` 경로 참조 없음. 금지 항목 준수 확인됨.
- **제안**: 없음.

---

### 5. [INFO] API 엔드포인트 명명 — REST 패턴 전반적으로 규약 준수
- **target 위치**: §9 전체 API 표
- **위반 규약**: `spec/conventions/swagger.md` §2-4 상태 코드 응답 규칙
- **상세**: §9.4에 나열된 error code (`INTEGRATION_IN_USE` 409, `OAUTH_STATE_MISMATCH` 400, `CAFE24_INSTALL_INVALID_TOKEN` 404 등)는 모두 UPPER_SNAKE_CASE + HTTP 상태 코드 매핑이 swagger 규약 §2-4 의 표와 일치한다. `{ code, message, details? }` 실패 포맷은 node-output.md Principle 3.2 의 `output.error` 형식과 유사한 패턴을 API 응답에서도 일관되게 사용하고 있다.
- **제안**: 없음.

---

## 요약

`spec/2-navigation/4-integration.md` 는 전체적으로 정식 규약 준수 수준이 높다. 파일명(`4-integration.md`, 숫자 prefix + kebab-case)과 위치(`spec/2-navigation/`)는 CLAUDE.md 명명 컨벤션과 정확히 일치한다. `_product-overview.md` 가 별도 존재하는 다중 파일 영역이므로 `## Overview` 섹션 부재는 규약 예외에 해당하며 적법하다. 문서 말미에 `## Rationale` 섹션이 있고 내용도 풍부하다. API error code 는 UPPER_SNAKE_CASE, DB status_reason 은 snake_case 로 도메인별 분리 표기가 Rationale 에서 명시적으로 근거를 밝히고 있어 node-output 규약과 충돌하지 않는다. 금지된 옛 경로(`prd/`, `memory/`)의 신규 사용은 없다. 유일한 개선 포인트는 Rationale 내 옛 flat 리뷰 경로 참조로, 현재 세션 이후의 정책을 소급 인용하는 형태여서 WARNING 수준으로 기록한다. 구현 착수를 차단하는 CRITICAL 사항은 없다.

## 위험도

LOW
