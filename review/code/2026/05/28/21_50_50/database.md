# Database Review — auth-config-webhook-wiring

## 발견사항

### **[INFO]** V065 cleanup migration — JSONB 키 제거 안전성

- 위치: `spec/5-system/12-webhook.md` §2.2, Rationale "inline auth path 폐지"
- 상세: `V065__trigger_config_strip_inline_auth.sql` 은 `trigger.config` JSONB 에서 `authType`, `secret`, `bearerToken`, `hmacHeader`, `hmacAlgorithm` 키를 제거한다. JSONB 부분 키 삭제는 PostgreSQL에서 `UPDATE trigger SET config = config - '{authType,secret,bearerToken,hmacHeader,hmacAlgorithm}'::text[]` 형태로 실행된다. 대용량 테이블이면 전체 row를 갱신하므로 테이블 수준 블로킹이 발생할 수 있다. Spec은 migration 파일의 실제 내용을 보여주지 않고 "코드는 무시한다"는 안전망만 언급한다.
- 제안: migration SQL에서 batch UPDATE(`LIMIT`·`WHERE id > $cursor` 루프) 또는 `pg_sleep` 간격 분산을 통해 락 영향을 최소화하는 것을 권장한다. 또한 `auth_config_id IS NULL`인 기존 트리거는 cleanup 후 "인증 없음(none)"으로 동작한다고 명시되어 있는데, 이 행동 변경이 의도된 것임을 migration comment에 명시해두어야 한다.

---

### **[INFO]** `auth_config.last_used_at` — fire-and-forget UPDATE 경합

- 위치: `spec/5-system/12-webhook.md` WH-SC-08, §7 처리흐름 step 6f, `spec/data-flow/10-triggers.md` §2.1
- 상세: 인증 성공 시 `last_used_at = NOW()`를 트랜잭션 외에서 fire-and-forget으로 UPDATE한다. Spec에서 "race 시 last-write-wins, 실패 시 미갱신"으로 명시하고 있어 설계 의도는 분명하다. 그러나 고빈도 webhook 호출 환경에서 같은 `auth_config_id`를 가리키는 동시 webhook이 다수 발생하면 동일 row에 대한 UPDATE 경합이 발생한다. PostgreSQL 행 수준 잠금 특성상 UPDATE 경합은 대기를 유발한다. fire-and-forget이라도 awaiting 없이 던지는 방식(예: `.catch(noop)`)이 아니라면 응답 지연에 영향을 줄 수 있다.
- 제안: 구현 시 `last_used_at` UPDATE는 완전한 non-blocking(`void promise.catch(() => {})`) 으로 처리해야 하며, `statement_timeout`을 짧게 설정하거나 별도 큐/이벤트 에밋으로 비동기 분리하는 것을 고려한다.

---

### **[INFO]** AuthConfig 조회 시 인덱스 확인 필요

- 위치: `spec/data-flow/10-triggers.md` §1.2, §2.1 — `SELECT auth_config WHERE id=:authConfigId AND workspace_id=:wsId`
- 상세: webhook 수신 흐름에서 `auth_config`를 `id`와 `workspace_id` 두 컬럼으로 조회한다. `id`가 PK(UUID)라면 `workspace_id` 조건 추가는 인덱스 추가 없이도 PK lookup 후 필터 방식으로 동작한다. 그러나 workspace 단위로 auth_config를 나열하거나 `workspace_id` 단독 조건 쿼리(예: 워크스페이스 삭제 시 관련 auth_config cascade 조회)에 대한 인덱스가 명시되어 있지 않다.
- 제안: 데이터 모델 spec(`spec/1-data-model.md §2.17`)에서 `auth_config(workspace_id)` 인덱스 정의를 확인하고, 없다면 migration에 추가를 권장한다.

---

### **[INFO]** Auth Config Reveal — 감사 로그 트랜잭션 범위 미명시

- 위치: `spec/5-system/1-auth.md` §4.1 — `auth_config.reveal` 감사 이벤트 추가, §3.2 Reveal 권한 분리 설명
- 상세: Reveal(`POST /api/auth-configs/:id/reveal`)은 "현재 로그인 비밀번호 재확인 + audit 기록"이 필요하다고 명시되어 있다. audit 기록이 reveal 작업과 동일 트랜잭션 안에 있어야 하는지, 아니면 WebAuthn 인증 흐름(§1.4.4)과 유사하게 트랜잭션 외에서 처리해도 되는지 spec에서 명확하지 않다. 평문 노출이라는 민감 동작의 audit 누락은 보안 감사 측면에서 문제가 된다.
- 제안: Reveal 처리 흐름에서 `audit_log INSERT`를 reveal 응답 반환 전에 동일 트랜잭션(또는 순서가 보장된 호출)으로 완료하도록 spec에 명시하기를 권장한다.

---

## 요약

이번 변경은 spec 문서 4개만 수정하며 실제 DB 마이그레이션 SQL이나 ORM 코드는 포함되어 있지 않다. DB 설계 관점의 핵심 변경은 (1) webhook 인증을 `trigger.config` inline에서 `trigger.auth_config_id` FK 단일 경로로 격상, (2) `trigger.config` JSONB의 inline 인증 키를 V065 cleanup migration으로 제거, (3) `auth_config.last_used_at`을 fire-and-forget으로 갱신하는 패턴 도입, (4) `auth_config.reveal` 감사 이벤트 추가이다. 전반적으로 FK 기반 단일 진입 설계는 정규화 측면에서 올바르고, AES-256-GCM 암호화 저장과 마스킹 정책은 적절하다. V065 migration의 JSONB 키 제거가 대용량 테이블에서 블로킹을 유발할 수 있다는 점과, `last_used_at` fire-and-forget UPDATE의 경합 처리 방식을 구현 단계에서 명확히 해야 한다는 점, Reveal 감사 로그의 트랜잭션 보장 여부가 미명시된 점이 보완이 필요한 부분이다. 이 모두 설계 수준 INFO 사항으로, 현재 단계에서 차단 이슈는 없다.

## 위험도

LOW
