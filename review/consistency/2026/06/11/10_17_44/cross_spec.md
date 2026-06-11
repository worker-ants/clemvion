# Cross-Spec 일관성 검토 결과

검토 범위: `spec/5-system/` (diff-base: `origin/main`)
검토 모드: 구현 완료 후 검토 (--impl-done)

---

## 발견사항

### **[WARNING]** `TOKEN_INVALID` 설명 축소 — `spec/data-flow/2-auth.md` 와 불일치

- **target 위치**: `spec/5-system/3-error-handling.md` §1.2 — `TOKEN_INVALID` 행 설명을 "변조/형식 오류, refresh 토큰 미존재/소유자 부재, 또는 refresh 회전 시 조건부 revoke 매칭 0건(동일 토큰 동시 회전 경합)" → **"변조/형식 오류"** 로 축소.
- **충돌 대상**: `spec/data-flow/2-auth.md` §1.4 Refresh token 회전 시퀀스 다이어그램. 해당 파일(동일 브랜치에서 수정됨)의 `is_revoked=true` 재사용(reuse 탐지) 분기가 여전히 `401 TOKEN_INVALID` 를 반환한다고 기술한다.
- **상세**: 조건부 UPDATE `affected=0` 케이스(동시 회전 경합)는 data-flow/2-auth.md 에서도 제거됐으므로 중복은 해소됐다. 그러나 **토큰 reuse 탐지(is_revoked=true 재사용)** 시 `TOKEN_INVALID` 반환 케이스는 data-flow/2-auth.md §1.4 시퀀스에 여전히 남아 있다. error-handling SoT(`3-error-handling.md`)의 `TOKEN_INVALID` 설명이 "변조/형식 오류" 만 언급하면, 이 케이스가 `TOKEN_INVALID` 로 분류되는 근거가 SoT 에서 사라진다. 클라이언트 개발자가 에러 코드 표만 보면 refresh reuse 탐지 응답이 어느 코드인지 알 수 없다.
- **제안**: `3-error-handling.md` 의 `TOKEN_INVALID` 설명을 "변조/형식 오류 또는 reuse 탐지(is_revoked 토큰 재사용)" 수준으로 복원하거나, data-flow/2-auth.md §1.4 의 reuse 분기 응답 코드를 별도 코드로 변경. 두 문서 중 어느 쪽도 대응 기술 없이 방치하면 구현과 SoT 간 명세 공백이 생긴다.

---

### **[INFO]** `assertProductionConfig` 응집 설명에서 `INTERACTION_JWT_SECRET` 위치 일관성

- **target 위치**: `spec/5-system/1-auth.md` §2.1 신규 note — "전부 `common/config/production-guards.ts` 의 `assertProductionConfig` 로 응집, 단 `INTERACTION_JWT_SECRET` 은 별도 서비스 생성자 throw 로 유지".
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md` §8.3 — 동일 내용("본 `INTERACTION_JWT_SECRET` 만은 `InteractionTokenService` 생성자 throw 로 별도 유지")을 동일 표현으로 기술.
- **상세**: 두 문서가 같은 사실을 별개로 기술하나 내용은 일치한다. 모순 없음. 다만 `1-auth.md` 가 `OAUTH_STUB_MODE`/`LLM_STUB_MODE` 만 언급하고 `ENCRYPTION_KEY` 를 빠트린 반면, `7-llm-client.md` 와 `14-external-interaction-api.md` 는 `ENCRYPTION_KEY` 를 포함해 나열한다. `1-auth.md` 의 열거가 불완전하다.
- **제안**: `1-auth.md` §2.1 note 의 가드 목록에 `ENCRYPTION_KEY` 를 추가하거나, "등" 으로 완전 열거 회피. 기능 충돌은 아니나 독자 오해 여지.

---

### **[INFO]** `ALLOW_PRIVATE_HOST_TARGETS` production warn 정책 — 타 spec 문서 미반영

- **target 위치**: `spec/5-system/11-mcp-client.md` §3.2 신규 note — "`ALLOW_PRIVATE_HOST_TARGETS`(http-request §4)는 정책이 달라 **throw 가 아닌 warn** 으로 분리한다 — production 에서 켜져 있으면 부팅은 하되 경고 로그를 남긴다."
- **충돌 대상**: `spec/4-nodes/4-integration/1-http-request.md` §4 (`ALLOW_PRIVATE_HOST_TARGETS` SoT 문서), `spec/2-navigation/4-integration.md` §5.5·§SMTP-SSRF-Rationale, `spec/4-nodes/4-integration/3-send-email.md` §4, `spec/4-nodes/4-integration/2-database-query.md` §SSRF 가드.
- **상세**: 이 플래그가 production 에서 경고만 남기고 부팅을 차단하지 않는 새 정책이 11-mcp-client.md 에 추가됐으나, 이 플래그의 정의가 있는 `1-http-request.md` 와 `integration.md`, `send-email.md`, `database-query.md` 에는 이 production behavior 가 언급되지 않는다. `1-http-request.md` 의 설명은 "기본은 차단, self-host 는 opt-out" 이라는 취지만 있고 production warn 정책은 없다. 모순은 아니나(정책 자체가 이 문서들 범위 밖) 완전성이 부족하다.
- **제안**: `spec/4-nodes/4-integration/1-http-request.md` §4 또는 SoT 위치에 "production 에서 `ALLOW_PRIVATE_HOST_TARGETS=true` 는 부팅을 막지 않고 경고 로그만 남긴다 (`assertProductionConfig` warn 분기)" 를 추가해 플래그의 production 동작을 한 곳에서 확인 가능하게 한다.

---

### **[INFO]** `spec/2-navigation/14-execution-history.md` 내 API 샘플 vs. 본문 불일치 (scope 외 참고)

- **target 위치**: `spec/2-navigation/14-execution-history.md` §5 API 샘플 JSON (동 브랜치 변경, `spec/5-system/` scope 외).
- **충돌 대상**: 동 파일 §2.4 본문 note — "`ExecutionDto` 는 배치 집계 컬럼 `totalNodeCount` / `completedNodeCount` / `failedNodeCount` 를 응답한다"고 기술 (line 162).
- **상세**: 브랜치 변경으로 샘플 JSON 에서 세 필드가 제거됐으나 본문 설명 note 는 그대로 남아 있다. 단일 파일 내부 불일치. 본 검토 scope(`spec/5-system/`) 밖이나 기록해 둔다.
- **제안**: `14-execution-history.md` §2.4 note (line 162)에서 세 카운트 언급을 삭제하거나, 샘플 JSON 에 필드를 복원.

---

## 요약

`spec/5-system/` 의 4개 파일 변경(1-auth, 3-error-handling, 7-llm-client, 11-mcp-client, 14-external-interaction-api)은 production fail-closed guard 를 `common/config/production-guards.ts` 의 `assertProductionConfig` 로 응집하는 구조를 spec 에 반영한 작업이다. 주요 cross-spec 충돌은 하나다: `3-error-handling.md` 의 `TOKEN_INVALID` 설명이 "변조/형식 오류" 로만 축소됐으나, `data-flow/2-auth.md` §1.4 는 여전히 reuse 탐지(`is_revoked=true` 재사용) 케이스에서 `TOKEN_INVALID` 를 반환한다고 기술하므로, 에러 코드 SoT 와 data-flow 간 명세 공백이 생긴다. 나머지는 INFO 수준 — `1-auth.md` 의 가드 목록 불완전 열거, `ALLOW_PRIVATE_HOST_TARGETS` production warn 정책이 플래그 SoT(`http-request.md`) 에 미반영된 점, scope 외 파일 내부 불일치이며 직접 작동 불가를 유발하지는 않는다.

---

## 위험도

LOW
