현행 spec 파일의 `last_error.code` 값 형식과 경로 파라미터 표기 패턴을 확인했습니다. 결과를 종합하여 점검 보고서를 작성합니다.

---

## Convention Compliance 점검 결과

### 발견사항

---

**[WARNING] W1 — `last_error.code` 저장값 케이싱이 기존 관례와 충돌**

- **target 위치:** DRAFT 2G §10.4, DRAFT 3C §1.2.1 시퀀스 다이어그램, DRAFT 2I Rationale
- **위반 규약:** node-output.md Principle 3.2 (`code` 는 `UPPER_SNAKE_CASE`) + 현행 데이터 모델 관례
- **상세:**
  현행 `spec/data-flow/integration.md` §2.1 및 `spec/1-data-model.md` §2.10 의 `last_error` 예시가 보여주는 `code` 값은 `INTEGRATION_NOT_FOUND`, `CAFE24_AUTH_FAILED` 등 **UPPER_SNAKE_CASE** 다. Explore 결과도 이를 확인한다.

  그런데 DRAFT 2G 와 DRAFT 3C 는 동일한 `last_error.code` 필드에 `oauth_token_exchange_failed`, `oauth_state_mismatch` 등 **snake_case** 값을 기록하도록 명시한다:

  > `last_error.code='oauth_token_exchange_failed'` 기록

  Rationale(DRAFT 2I)은 이 값이 `status_reason` 과 동일하며 snake_case 라고 설명하지만, API 응답으로 `last_error` 가 그대로 노출되면 기존 `last_error.code` 소비자(프론트엔드·로그 파이프라인)가 UPPER_SNAKE_CASE 를 기대하는 코드를 깨트린다.

- **제안:**
  `last_error.code` 는 기존 관례를 따라 **UPPER_SNAKE_CASE** (`OAUTH_TOKEN_EXCHANGE_FAILED`, `OAUTH_STATE_MISMATCH` 등)로 저장한다. `status_reason` 은 그대로 snake_case 유지. 두 필드는 "같은 의미의 다른 케이싱"이 아니라 역할이 다르다(`status_reason` = DB 진단 코드, `last_error.code` = API 에러 코드). DRAFT 1C·2G·2I·3B·3C 전반에서 `last_error.code` 값만 UPPER_SNAKE_CASE 로 교정하면 충돌이 해소된다.

---

**[WARNING] W2 — `<install_token>` 표기가 기존 spec 경로 파라미터 표기 패턴과 불일치**

- **target 위치:** DRAFT 2J-1 §9.4 step 3, DRAFT 3C §1.2.1 mermaid 시퀀스, DRAFT 2C §3.2 응답 예시
- **위반 규약:** spec 내부 일관성 (현행 `spec/2-navigation/4-integration.md §9.2` 는 경로 파라미터를 전부 NestJS 콜론-prefix 스타일 `:id`, `:provider` 로 표기 — angle-bracket 표기 없음)
- **상세:**
  현행 spec §9.2 API 표의 모든 경로 파라미터는 `:id`, `:provider` 형식이다. DRAFT 2E 는 이를 올바르게 따라 `:installToken` 을 사용하지만, 같은 draft 내 다른 위치에서 표기가 세 가지로 분열된다:

  | 위치 | 표기 |
  |------|------|
  | DRAFT 2E §9.2 API 표 | `:installToken` ✓ (camelCase, NestJS 스타일) |
  | DRAFT 2C §3.2 응답 예시 | `<installToken>` (camelCase, 각괄호) |
  | DRAFT 2J-1 §9.4 step 3 | `<install_token>` (snake_case, 각괄호) |
  | DRAFT 3C mermaid | `<install_token>` (snake_case, 각괄호) |

  각괄호 표기(`< >`)는 현행 spec 어디에도 경로 파라미터 표기로 사용하지 않는다. 산문·시퀀스 다이어그램에서도 기존 spec 은 `:provider` 형식을 그대로 유지한다.

- **제안:**
  산문과 다이어그램을 포함한 모든 위치에서 `:installToken` (camelCase, 콜론-prefix) 로 통일. 또는 실제 토큰값 자리를 나타내는 플레이스홀더가 필요하면 `{installToken}` (camelCase, curly-bracket — REST/OpenAPI 관례)로 통일한다. snake_case 형식(`install_token`)은 DB 컬럼 명칭으로만 사용한다.

---

**[INFO] I1 — `spec/4-nodes/4-integration/4-cafe24.md` 기존 `## Rationale` §9 에 신규 설계 결정 미추가**

- **target 위치:** DRAFT 2J 전체
- **위반 규약:** CLAUDE.md 권장 3섹션 구성 (Rationale 섹션)
- **상세:**
  cafe24.md 에는 `## Rationale §9` (§9.1~§9.8) 가 이미 존재한다. DRAFT 2J 는 App URL path 에 `install_token` 을 도입하고 식별 전략을 in-memory 스캔에서 단일 row 조회로 전환하는 중요한 설계 결정을 담는데, 이 Rationale 를 cafe24.md §9 에 추가하지 않고 CHANGELOG 만 갱신한다. 동일 결정의 배경은 `spec/2-navigation/4-integration.md` Rationale (DRAFT 2I) 에만 있다.
- **제안:** cafe24.md §9 에 `§9.9 install_token 기반 App URL 식별 전략` 을 1문단으로 추가하거나, "설계 배경은 [Spec 통합 화면 §Rationale] 참고" 포인터 1줄을 §9.8 끝에 추가한다.

---

**[INFO] I2 — TypeScript 예시 주석이 WHAT 설명 위주**

- **target 위치:** DRAFT 2J-2 `verifyHmac` 예시
- **위반 규약:** CLAUDE.md "Don't explain WHAT the code does"
- **상세:** 추가 주석 `// clientSecret 은 path 의 install_token 으로 조회한 row 의 credentials.client_secret. 단일 호출.` 은 파라미터 출처(WHAT)를 설명한다. 이미 §9.8 본문 "단일 row 조회" 재서술이 동일 내용을 담으므로 중복이다.
- **제안:** spec 예시 코드이므로 채택 여부는 재량이나, production 코드로 옮길 때는 삭제한다. spec 문서에 남기려면 WHY("trial HMAC 방식 폐기 이유: W3 비결정 시나리오")로 교체하는 것이 낫다.

---

### 요약

정식 규약(`cafe24-api-metadata.md`, `migrations.md`, `node-output.md`)의 직접 위반은 없다. 두 개의 WARNING 은 모두 spec 초안 내부의 표기 불일치·관례 충돌로, **채택 전 DRAFT 본문 수정**으로 해소 가능하다.

- **W1 (`last_error.code` 케이싱)** 이 실질 위험이 높다. 현행 코드베이스와 API 소비자가 `last_error.code` 를 UPPER_SNAKE_CASE 로 다루고 있을 가능성이 크므로, 새 값만 snake_case 로 저장하면 런타임 불일치가 생긴다.
- **W2 (경로 파라미터 표기)** 는 구현자 혼동 위험이 있으나 사소한 편집 교정으로 해결된다.

### 위험도

**MEDIUM** — CRITICAL 없음. W1 은 API 계약 일관성에 영향을 주는 실질 위반이며, spec 적용 전 정정을 강력히 권장한다.