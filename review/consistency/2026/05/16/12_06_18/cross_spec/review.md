# Cross-Spec 일관성 검토

**대상**: `plan/in-progress/spec-draft-cafe24-app-url-detail.md`
**검토 파일**: `spec/data-flow/integration.md`, `spec/2-navigation/4-integration.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/1-data-model.md`

---

### 발견사항

- **[CRITICAL]** 변경 1 — `spec/data-flow/integration.md` line 90 이 실제 채택된 정책과 모순
  - target 위치: `plan/in-progress/spec-draft-cafe24-app-url-detail.md` 변경 1 (`spec/data-flow/integration.md §1.2.1 line 90`)
  - 충돌 대상: `spec/2-navigation/4-integration.md` Rationale "Cafe24 App URL 재호출 흐름 — install_token persistent 격상 (2026-05-15)" / `spec/4-nodes/4-integration/4-cafe24.md` §9.4 step 5
  - 상세: `spec/data-flow/integration.md` line 90 의 시퀀스 다이어그램 토큰 교환 성공 분기는 현재 `UPDATE integration SET status=connected, install_token=NULL, ...` 으로 기술한다. 그러나 `spec/2-navigation/4-integration.md` Rationale(2026-05-15)은 "`pending_install → connected` 전이 시 token 보존 (옛: NULL 처리 → 새: 그대로)" 을 명시하고, Cafe24 노드 spec §9.4 step 5 도 "install_token 은 **보존**" 이라 기술한다. data-flow spec 만 옛 NULL 처리가 잔류하여 세 문서 중 하나가 직접 모순 — 코드 동작은 이미 보존 정책이므로 본 doc drift 는 CRITICAL 등급.
  - 제안: target 이 제시한 대로 line 90 을 `UPDATE integration SET status=connected, credentials ENC, token_expires_at, last_rotated_at` 으로 교체하고 괄호 주석으로 `(install_token 보존 — post-install navigation 식별 키)` 를 추가한다. 이 변경은 다른 두 spec 과 일치시키는 것이므로 추가 파급 없음.

- **[WARNING]** 변경 3 — `GET /api/integrations/:id` 응답 shape 에 `appUrl` 추가 시 `spec/data-flow/integration.md` §2 schema 매핑 미반영 가능성
  - target 위치: `plan/in-progress/spec-draft-cafe24-app-url-detail.md` 변경 3 (`spec/2-navigation/4-integration.md §9.1` 표 수정)
  - 충돌 대상: `spec/data-flow/integration.md` §2.1 Postgres 컬럼 매핑 표
  - 상세: 변경 3 은 `GET /api/integrations/:id` 응답에 `appUrl: string | null` 필드를 추가한다. 이 필드는 DB 컬럼이 아닌 `install_token` 으로부터 서버가 계산하는 computed DTO 필드다. `spec/data-flow/integration.md` §2.1 의 schema 매핑 표는 DB write/read 컬럼 목록만 다루며 API 응답 DTO shape 에 대한 별도 기술이 없다. 따라서 직접 모순이 아니라 변경 범위가 `spec/data-flow/integration.md` 에 누락될 수 있는 잠재 불일치다. 또한 `spec/2-navigation/4-integration.md` §9.1 표에서 GET 응답 envelope 규약(`{ data: ... }` 구조) 은 `spec/5-system/2-api-convention.md §5.1` 단건 응답 형식을 따를 것으로 기대되는데, target 에서 `appUrl` 가 `data` 래퍼 안에 있는지 아니면 최상위에 위치하는지 명시가 없다.
  - 제안: (a) 변경 3 의 새 텍스트에 `data` 래퍼 포함 여부를 명시하거나 API 규약 참조를 추가한다. (b) `spec/data-flow/integration.md` §2.1 또는 별도 주석 항에 `appUrl` 계산 필드를 INFO 수준으로 언급 추가 — "Cafe24 Private 통합의 `install_token` 으로부터 서버 계산 후 응답에 포함" 정도.

- **[WARNING]** 기존 spec 내부 — Rationale §"install_token TTL 24h" 의 `install_token_issued_at` NULL 처리 기술이 persistent 격상 결정과 미정합 (target draft 가 다루지 않는 잔존 충돌)
  - target 위치: target draft 에서 직접 다루지 않음 — 기존 spec 내 잔존 문제
  - 충돌 대상: `spec/2-navigation/4-integration.md` Rationale "install_token TTL 24h" (line 968) vs Rationale "Cafe24 App URL 재호출 흐름 — install_token persistent 격상 (2026-05-15)"
  - 상세: "install_token TTL 24h" Rationale 의 TTL 기준 갱신 부분(2026-05-15 추가)은 "callback 성공 시 `install_token` 과 함께 `install_token_issued_at` 도 NULL 로 비워진다" 라고 기술한다. 그러나 같은 파일의 persistent 격상 결정(2026-05-15)은 `install_token` 자체를 통합 lifetime 동안 보존으로 변경했으며, 이에 따라 `install_token_issued_at` 도 callback 성공 시 NULL 로 소거할 이유가 없어졌다. target draft 의 변경 1 은 `install_token` 보존만 다루고 `install_token_issued_at` 처리를 언급하지 않아, 구현 시 어느 spec 을 따라야 하는지 모호성이 남는다.
  - 제안: 변경 1 의 새 텍스트에 `install_token_issued_at` 처리를 함께 명시한다 — persistent 격상 결정을 따르면 "callback 성공 시 `install_token_issued_at` 는 NULL 처리하지 않고 보존" 이 의도된 동작. `spec/2-navigation/4-integration.md` Rationale "install_token TTL 24h" 의 해당 구절도 함께 정정한다.

- **[INFO]** 변경 4 Rationale 의 `SECRET_LEAK_PATTERNS` 참조 — 다른 spec 에 정식 정의 없음
  - target 위치: `plan/in-progress/spec-draft-cafe24-app-url-detail.md` 변경 4 (추가할 Rationale 본문)
  - 충돌 대상: `spec/conventions/`, `spec/5-system/` 내 보안·로깅 규약 문서
  - 상세: 변경 4 Rationale 초안이 "`client_secret` 자체는 절대 로그에 남기지 않는다 — `SECRET_LEAK_PATTERNS` 와 일관" 이라 기술한다. `SECRET_LEAK_PATTERNS` 는 코드 레벨 상수이며 spec 문서 어디에서도 이 패턴·적용 범위를 정식으로 정의한 항목을 찾을 수 없다. spec 이 코드 상수를 직접 참조하는 방식은 코드가 바뀌면 spec 설명이 drift 하는 구조다.
  - 제안: Rationale 에서 "`SECRET_LEAK_PATTERNS` 와 일관" 구절을 "보안 로깅 규약 — secret/token 류는 로그에 기록하지 않음" 과 같이 spec 레벨 추상으로 교체하거나, `spec/conventions/` 에 보안 로깅 규약 항목이 있다면 그 참조로 대체한다.

- **[INFO]** 변경 2·3 의 조건 표현 `credentials.app_type='private'` — `spec/1-data-model.md` §2.10 의 `credentials` 필드 스키마와 대조 필요
  - target 위치: 변경 2 표 새 행 및 변경 3 GET 응답 설명
  - 충돌 대상: `spec/1-data-model.md` §2.10 `Integration.credentials`
  - 상세: target draft 는 `credentials.app_type='private'` 를 조건으로 여러 차례 사용한다. `spec/1-data-model.md` §2.10 의 `Integration.credentials` 정의는 JSONB(encrypted) 로만 기술되며 내부 스키마(`app_type` 필드 등)를 명시하지 않는다. `spec/2-navigation/4-integration.md` §5.8 등 타 문서에서 `credentials.app_type` 이 이미 사용되므로 사실상 합의된 필드이나, 공식 data model spec 에 누락이다.
  - 제안: `spec/1-data-model.md` §2.10 `credentials` 설명 또는 `spec/2-navigation/4-integration.md` §5.8 스키마 항에 Cafe24 `credentials` 의 공통 필드(`app_type`, `mall_id`, `client_id`, `client_secret`, `scopes`) 를 INFO 레벨로 문서화한다 (별도 plan 으로 분리 권장).

---

### 요약

target draft 의 5개 변경 중 가장 중요한 것은 변경 1(CRITICAL) 이다. `spec/data-flow/integration.md` line 90 은 2026-05-15 의 `install_token` persistent 격상 결정 이후 갱신되지 않아 `spec/2-navigation/4-integration.md` 및 `spec/4-nodes/4-integration/4-cafe24.md` 와 직접 모순하며, 이를 정정하는 변경 1 은 doc drift 해소로 정당하다. WARNING 1건(appUrl DTO 래퍼 미명시 및 data-flow §2 누락 가능성)과 기존 spec 내부 잔존 모순(`install_token_issued_at` NULL 처리) 은 변경 1 에 한 줄 보완하면 동시 해소할 수 있다. INFO 2건(SECRET_LEAK_PATTERNS 코드 참조, credentials 내부 스키마 미문서화)은 채택을 막는 직접 충돌이 아니며 별도 plan 으로 해소 가능하다. 전체적으로 target draft 는 근거가 충분하고 기존 spec 의 일관성을 높이는 방향이며, CRITICAL 1건은 draft 자체가 올바르게 식별·교정하고 있다.

### 위험도

MEDIUM
