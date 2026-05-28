# 신규 식별자 충돌 검토 보고서

> target: `plan/in-progress/spec-draft-auth-config-webhook-wiring.md`
> 검토 모드: spec draft (--spec)
> 검토 일시: 2026-05-28

---

## 발견사항

### 1. [WARNING] `AuthConfig.type` 열거값 `api_key` — Integration.auth_type 동명 혼동 가능

- **target 신규 식별자**: `AuthConfig.type = api_key` (spec/1-data-model.md §2.17.1 신규 JSONB 스키마 표)
- **기존 사용처**: `spec/1-data-model.md §2.10` Integration.auth_type 열거값 목록 (`oauth2 / api_key / bearer_token / basic / ...`). `LLMConfig` 엔티티(§2.16)에도 컬럼명 `api_key String (encrypted)` 존재.
- **상세**: 세 곳에서 `api_key`라는 이름이 각기 다른 의미로 쓰인다. Integration.auth_type.`api_key`는 "외부 서비스에 대한 API Key 인증 방식", LLMConfig.`api_key`는 "컬럼 이름(LLM 제공자 API Key 저장)", AuthConfig.type.`api_key`는 "본 제품이 발급하는 인바운드 webhook API Key". 같은 열거값명을 두 별개 도메인(Integration vs AuthConfig) 의 type enum 에서 공유하므로, 코드·문서·i18n 레이어에서 `type === 'api_key'`만으로 문맥 없이 판별 시 혼동 가능. 단, 두 enum 은 서로 다른 컬럼(`Integration.auth_type` vs `AuthConfig.type`)에 속하므로 DB 레벨 충돌은 아님.
- **제안**: 현행 이름 유지는 허용 가능하되, spec 본문 및 구현 코드에서 "AuthConfig.type" 전치사를 명시하고, TypeScript 유니온 타입명을 `AuthConfigType` vs `IntegrationAuthType` 으로 분리해 컴파일러 레벨 혼동을 방지한다.

---

### 2. [WARNING] `AuthConfig.type` 열거값 `basic_auth` — Integration.auth_type `basic` 과 표기 불일치

- **target 신규 식별자**: `AuthConfig.type = basic_auth`
- **기존 사용처**: `spec/1-data-model.md §2.10` Integration.auth_type 열거값 `basic` (밑줄 없는 단축형).
- **상세**: 동일 "Basic 인증" 개념을 같은 spec 파일 안에서 두 이름(`basic` / `basic_auth`)으로 표현한다. 개발자가 두 도메인에 걸쳐 작업할 때 혼동 가능하고, i18n 레이블·코드 검색 시 누락 위험이 있다. 의미적으로 다른 도메인이므로 강요할 필요는 없으나 표기 원칙을 문서화할 필요가 있다.
- **제안**: target spec 의 §2.17 Rationale 또는 `spec/0-overview.md §7` 용어 정의에 "AuthConfig.type = `basic_auth` (밑줄 포함, webhook 인바운드용) vs Integration.auth_type = `basic` (밑줄 없음, 외부 서비스 연동용) — 의도적 분리" 를 명시한다.

---

### 3. [WARNING] `AuthConfig.type` 열거값 `bearer_token` — Integration.auth_type 동명 혼동 가능

- **target 신규 식별자**: `AuthConfig.type = bearer_token`
- **기존 사용처**: `spec/1-data-model.md §2.10` Integration.auth_type 열거값 `bearer_token`.
- **상세**: `api_key` 와 동일 구조의 문제. Integration.auth_type.`bearer_token`은 외부 서비스 연동 bearer, AuthConfig.type.`bearer_token`은 본 제품이 발급하는 인바운드 webhook bearer token. 값 문자열이 완전히 같으므로 TypeScript 유니온 공유 시 타입 오염 위험.
- **제안**: 발견사항 1 과 동일 — TypeScript 타입명 분리 원칙을 spec 에 명시. 구현 레벨에서 `AuthConfigType` / `IntegrationAuthType` 별도 유니온으로 선언.

---

### 4. [INFO] Rationale ID `R-A` — 기존 숫자 시리즈(`R-1`, `R-2`, ...) 와 naming scheme 혼재

- **target 신규 식별자**: `R-A. inline auth path 폐지 (2026-05-28)` (`spec/5-system/12-webhook.md` Rationale 신규 항목, target §2.8)
- **기존 사용처**: `spec/2-navigation/2-trigger-list.md` Rationale 에 `R-2` 등 숫자 기반 ID 사용. target 자체도 `R-14` (§5.4) 는 숫자 사용.
- **상세**: 동일 spec 파일(`12-webhook.md`) 안에서 숫자 시리즈(기존 R-1~Rn)와 알파벳(`R-A`)이 혼용될 경우 참조 시 검색 패턴이 나뉘고, 나중에 추가되는 Rationale 항목이 R-A 다음에 R-B 로 가야 하는지 숫자로 가야 하는지 불명확해진다.
- **제안**: `12-webhook.md` 의 기존 Rationale 번호 체계를 확인하고, 신규 항목도 숫자 연번으로 통일하거나(예: 기존 최대 번호 + 1), 알파벳 방식으로 전환 시 해당 파일 내 전체 ID 일괄 변경 및 cross-ref 갱신.

---

### 5. [INFO] Rationale ID `R-14` — 기존 R-1~R-13 범위 확인 필요

- **target 신규 식별자**: `R-14. authConfigId v1 격상 (2026-05-28)` (`spec/2-navigation/2-trigger-list.md` Rationale, target §5.4)
- **기존 사용처**: 검색된 corpus 에서 `R-2` 만 명시적으로 언급됨. R-3~R-13 의 존재 여부는 corpus 발췌 범위 안에서 미확인.
- **상세**: target 은 `R-2` TBD 를 번복한다고 명시하므로 R-1, R-2 는 이미 존재한다. R-14 배정이 기존 최대 번호 + 1 과 일치하는지 spec 파일 전문 확인이 필요. 만약 R-14 이전에 R-3~R-13 이 없다면 연번에 공백이 생겨 참조 혼란이 발생할 수 있다.
- **제안**: `spec/2-navigation/2-trigger-list.md` 의 Rationale 섹션 전문을 확인해 R-14 가 실제로 연번 다음인지 검증. 공백이 있다면 실제 다음 번호(예: R-3)로 수정.

---

### 6. [INFO] `POST /api/auth-configs/:id/reveal` — 기존 `/regenerate` endpoint 명명 일관성

- **target 신규 식별자**: `POST /api/auth-configs/:id/reveal`
- **기존 사용처**: `POST /api/auth-configs/:id/regenerate` (기존 endpoint, target §1 에서 세 공개 경로 중 하나로 언급). 동일 리소스 경로 아래에 `reveal`(평문 재확인)과 `regenerate`(자격증명 재발급) 두 action endpoint 가 공존.
- **상세**: 두 endpoint 의 의미가 다르고 충돌은 없으나, `reveal` 이 `/api/auth-configs/:id/reveal` 이고 `regenerate` 가 `/api/auth-configs/:id/regenerate` 인데, 두 동사의 의미 차이(읽기 only vs 새 값 생성)가 이름만으로는 바로 명확하지 않을 수 있다. RESTful 관점에서는 side-effect 유발 action 이 POST 로 통일되어 있어 위험도는 낮다.
- **제안**: swagger `@ApiOperation` summary 에 "1회 평문 조회 (새 값 생성 없음)" vs "새 자격증명 발급" 를 명시해 두 endpoint 의 차이를 문서화.

---

### 7. [INFO] 토큰 prefix `wfk_`, `wft_`, `whs_` — 기존 prefix 체계와 충돌 여부

- **target 신규 식별자**: `wfk_<hex24>` (api_key), `wft_<hex32>` (bearer_token), `whs_<hex32>` (hmac secret)
- **기존 사용처**: `secret://triggers/{id}/bot-token` 패턴 (SecretStore) 은 prefix 없는 raw 토큰 저장. 기존 corpus 에서 `wfk_`/`wft_`/`whs_` prefix 를 가진 다른 토큰은 발견되지 않음.
- **상세**: 세 prefix 모두 신규이며 기존 토큰 prefix 와 중복이 없다. 단, prefix 규칙(`wf*`로 시작하는 제품 접두사 관행)이 spec 어디에도 명시되어 있지 않아 향후 토큰 추가 시 일관성이 흔들릴 수 있다.
- **제안**: `spec/conventions/secret-store.md` 또는 `spec/1-data-model.md §2.17.1` 아래에 "제품 발급 자격증명 prefix 표" (`wfk_` = webhook api key, `wft_` = webhook bearer token, `whs_` = webhook hmac secret) 를 한 줄로 문서화.

---

### 8. [INFO] `auth_config.reveal` audit action — 기존 action 네임스페이스 확인

- **target 신규 식별자**: `auth_config.reveal` (audit_log action)
- **기존 사용처**: target §3.3 에서 기존 목록 `auth_config.create, auth_config.update, auth_config.delete, auth_config.regenerate` 에 추가. corpus `spec/data-flow/1-audit.md` 의 실제 기존 목록은 corpus 발췌 범위 안에서 직접 확인 불가.
- **상세**: 동일 네임스페이스(`auth_config.*`) 안의 신규 action 이며, 같은 패턴을 따른다. W-2 이슈로 `spec/data-flow/1-audit.md` 와의 cross-check 갱신 필요성을 target 이 이미 인지하고 있다.
- **제안**: target 이 이미 W-2 를 인지했으므로 추가 조치 불요. developer 단계에서 `spec/data-flow/1-audit.md` 동시 갱신 확인만 필요.

---

## 요약

target 이 도입하는 신규 식별자 중 진짜 의미 충돌(CRITICAL 수준)은 발견되지 않았다. 가장 주목할 이슈는 `AuthConfig.type` 열거값(`api_key`, `bearer_token`, `basic_auth`)과 `Integration.auth_type` 열거값(`api_key`, `bearer_token`, `basic`) 이 같은 문자열을 공유하는 점이다. DB 레벨 충돌은 없으나, 두 도메인이 같은 spec 파일(`spec/1-data-model.md`)에 나란히 존재하고 구현 레이어에서 TypeScript 유니온 타입이 혼용될 위험이 있어 WARNING 으로 분류한다. `basic` vs `basic_auth` 표기 불일치도 동일 맥락이다. Rationale ID 체계(`R-A` vs 숫자) 의 혼재는 INFO 수준이며 해당 spec 파일 내 기존 번호 체계 확인 후 통일이 권장된다.

---

## 위험도

MEDIUM
