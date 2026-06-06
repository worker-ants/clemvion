# Cross-Spec 일관성 검토 결과

**검토 대상**: `spec/5-system/14-external-interaction-api.md`
**검토 모드**: `--impl-prep` (구현 착수 전)
**검토 일시**: 2026-06-06

---

## 발견사항

### 1. **[WARNING]** `notification_secret_v2` 컬럼 설명 불일치 — 데이터 모델 vs EIA

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §7.1 DDL 주석 + 본문 주석
- **충돌 대상**: `spec/1-data-model.md` §2.8 Trigger 표 `notification_secret_v2` 행
- **상세**:
  - EIA §7.1 의 DDL 코드 블록 주석: `-- rotation 기간 (24h) 동안 사용되는 신규 secret`
  - EIA §7.1 산문 주석: `notification_secret_v2` 컬럼도 동일하게 **ref 만 보관** (rotation grace 기간)
  - 데이터 모델 §2.8 설명: `Secret rotation 기간 (24h grace) 동안 사용되는 신규 secret (NOT NULL 이면 config.notification.signing.secret 와 둘 다 검증)`
  - 데이터 모델이 `config.notification.signing.secret`(plaintext 값)을 기준으로 검증한다고 기술하지만, EIA §7.1 은 `config JSONB 에는 ref 만` 보관하고 `notification_secret_v2` 도 ref 만 담는다고 명시한다. 두 기술이 동일 컬럼의 저장 내용과 검증 방식에 대해 서로 다른 모델을 암시한다.
  - 또한 EIA §7.1 에서 `secret_store.md` 의 `secret://` URI scheme 으로 완전 이관된 구조를 기술하는 반면, 데이터 모델은 `config.notification.signing.secret` 라는 config JSONB 의 inline plaintext 필드명을 참조해 EIA 이전 구조를 반영하고 있다.
- **제안**: 데이터 모델 §2.8 의 `notification_secret_v2` 설명을 EIA §7.1 의 최신 기술(ref 만 보관, `secret://triggers/{triggerId}/notification-signing.v2` URI)에 맞게 동기화. `config.notification.signing.secret` 참조를 `secretRef` URI scheme 참조로 교체. 단, EIA 의 DDL 코드 블록 주석("`-- 신규 secret`")도 ref-only 임을 명시하도록 보완 권장.

---

### 2. **[WARNING]** EIA §8.3 JWT 시크릿 "trigger 별 분리" 주장 vs 실제 구현 글로벌 시크릿

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §8.3 Token 일반 규약, §10.1 Swagger 주석
- **충돌 대상**: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` (구현 SoT)
- **상세**:
  - EIA §8.3: `JWT HS256, secret 은 trigger 별 분리 (서로 다른 trigger 의 토큰을 cross-validate 불가)`
  - EIA §10.1: `main.ts 에 신규 Bearer scheme 등록: interaction-token (= JWT HS256, secret 은 trigger 별 분리)`
  - 실제 구현(`interaction-token.service.ts:88-99`): `iext_*` (per_execution) 토큰은 `INTERACTION_JWT_SECRET` 환경변수 → `JWT_SECRET` fallback의 **단일 글로벌 시크릿**으로 서명. trigger 별 분리 시크릿이 아니다.
  - "trigger 별 분리"는 `itk_*`(per_trigger opaque token — 랜덤 hex, JWT 아님)에만 실질적으로 해당하며, JWT(`iext_*`)는 글로벌 시크릿을 사용한다.
  - 이미 plan `exec-park-b2a-followup.md` §② 에서 인식된 SPEC-DRIFT 항목이다. 단, spec 조항이 수정되기 전까지 "trigger 별 분리" 표현은 두 토큰 family 를 모두 포괄하는 것으로 읽혀 구현과 모순된다.
- **제안**: EIA §8.3 을 `iext_*`(글로벌 `INTERACTION_JWT_SECRET`, execution-scoped payload)와 `itk_*`(trigger 별 opaque token)로 분리 기술하도록 갱신. `spec/5-system/14-external-interaction-api.md` 수정 권한은 project-planner. 구현 착수 전 spec 을 먼저 정정할 것.

---

### 3. **[INFO]** `interact` 202 응답 body 형식 — EIA §5.1 vs API 규약 §5 래핑 컨벤션

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §5.1, §5 서두 주석
- **충돌 대상**: `spec/5-system/2-api-convention.md` §5 응답 형식
- **상세**:
  - EIA §5 서두 주석: `§5.1(interact)는 성공 시 202 Accepted + body 없음(no-content path) — 클라이언트는 body 를 소비하지 않으므로 봉투 언랩 해당 없음`
  - EIA §5.1 본문: 성공 응답 예시에 `{ "executionId": "...", "accepted": true, "currentStatus": "running" }` body 가 있음 (논리 payload)
  - 두 설명이 서로 상충된다 — "body 없음(no-content path)" 과 실제 응답 body 예시가 공존. API 규약 §5 는 전역 `TransformInterceptor` 가 `{ data: ... }` 로 래핑한다고 정의하는데, "no-content path" 라면 래핑 없이 빈 body 여야 하고, body 예시가 있다면 `{ data: { executionId, accepted, currentStatus } }` 형식이어야 한다.
  - 실제 구현 코드 확인이 필요하나, spec 내부 모순이 cross-spec 불명확성을 유발한다.
- **제안**: EIA §5.1 에서 "no-content path" 언급을 제거하거나, 실제 구현과 맞춰 body 없음(204/body-empty 202)인지 응답 body 있는 202인지를 명확히 단일화. API 규약 §5 의 래핑 정책 적용 여부도 명기.

---

### 4. **[INFO]** `data-flow/3-execution.md` 의 `resume_call_stack` (V087) 누락

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §7.1, §7.2 (Execution 엔티티 확장)
- **충돌 대상**: `spec/data-flow/3-execution.md` L51(park), L112(rehydration) 기술
- **상세**:
  - EIA §7.2: "신규 컬럼 없음. seq 는 실행 엔진 §1.1 의 monotonic counter 재사용" — Execution 엔티티 확장 없음으로 기술.
  - PR-B2b(#501, 2026-06-06)에서 `Execution.resume_call_stack` (V087) 이 추가됐다. EIA §7.2 자체는 이 컬럼을 추가하지 않으므로 EIA-내부 모순은 없으나, `data-flow/3-execution.md` 의 park/rehydration 시퀀스가 V087 을 아직 반영하지 않은 것이 `plan/in-progress/exec-park-b2a-followup.md` §③ 으로 추적 중이다.
  - EIA spec 은 execution durable park 컬럼(`conversation_thread`/`user_variables`/`resume_call_stack`)을 직접 기술하지 않고 실행 엔진 spec 에 위임하므로 EIA 자체의 충돌은 아니다. 그러나 EIA §9.1 처리 흐름이 park/rehydration 상세를 참조하는 문서들과 정합을 유지해야 한다.
- **제안**: 이미 plan §③ 으로 추적됨 — 별도 spec 수정(project-planner)에서 처리. EIA spec 자체는 변경 불필요.

---

## 요약

`spec/5-system/14-external-interaction-api.md` 는 Webhook spec, 실행 엔진 spec, 데이터 모델, API 규약, WebSocket 프로토콜 spec 과 전반적으로 정합한다. CRITICAL 수준의 직접 모순은 없다. 주요 위험은 두 가지다: (1) `notification_secret_v2` 컬럼의 저장 내용(plaintext secret vs secret store ref)에 대해 EIA §7.1 과 데이터 모델 §2.8 이 서로 다른 모델을 기술하는 WARNING 수준 불일치, (2) EIA §8.3·§10.1 의 "`iext_*` JWT secret 은 trigger 별 분리" 주장이 실제 구현(글로벌 `INTERACTION_JWT_SECRET`)과 상충하는 WARNING 수준 SPEC-DRIFT — 두 항목 모두 구현 착수 전 spec 정정이 권장된다. 특히 ②는 이미 `exec-park-b2a-followup.md` §②에서 인식된 항목으로 project-planner 경로를 통해 spec 갱신이 선행돼야 한다.

---

## 위험도

**MEDIUM**

STATUS: OK
