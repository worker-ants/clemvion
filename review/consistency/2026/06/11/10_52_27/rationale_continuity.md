# Rationale 연속성 검토 결과

검토 범위: `spec/5-system/` diff (origin/main → claude/prod-fail-closed-guards)  
변경 파일: `spec/5-system/1-auth.md`, `spec/5-system/11-mcp-client.md`,  
`spec/5-system/7-llm-client.md`, `spec/5-system/14-external-interaction-api.md`,  
`spec/conventions/secret-store.md`

---

## 발견사항

### INFO-1: `ALLOW_PRIVATE_HOST_TARGETS` production warn 정책 — http-request spec 에 미반영
- **target 위치**: `spec/5-system/11-mcp-client.md` §3.2 추가 블록, `spec/5-system/1-auth.md` §Rationale "Production fail-closed 가드"
- **과거 결정 출처**: `spec/4-nodes/4-integration/1-http-request.md` §4 — `ALLOW_PRIVATE_HOST_TARGETS` 는 "정당한 self-host 용도(내부 DB·on-prem API·내부 SMTP relay)"에 사용하는 플래그로 기술되어 있으며, 이 파일에는 production 환경에서의 warn/throw 분류가 명시되어 있지 않다.
- **상세**: 신규 Rationale("절대 금지 플래그는 throw, 정당 용도 있는 플래그는 warn 이 분류 기준")이 `spec/5-system/11-mcp-client.md`와 `spec/5-system/1-auth.md`에 추가됐는데, `ALLOW_PRIVATE_HOST_TARGETS` production 동작(warn 로그)은 해당 플래그의 1차 출처인 `spec/4-nodes/4-integration/1-http-request.md`에는 기술되지 않았다. 동일 플래그 정책이 두 곳에만 쓰이고 본 정의 위치는 갱신되지 않은 상태다.
- **제안**: `spec/4-nodes/4-integration/1-http-request.md` §4 의 `ALLOW_PRIVATE_HOST_TARGETS` 설명에 "production 에서 켜져 있으면 부팅은 하되 warn 로그(`assertProductionConfig`)" 한 줄을 추가해 분류 기준이 플래그 1차 출처에서도 확인되도록 한다.

---

### INFO-2: `LLM_STUB_MODE` production 가드 설명 — 가드 위치 표현이 이전과 상이
- **target 위치**: `spec/5-system/7-llm-client.md` §7.1 "프로덕션 차단" 항목 (변경 후)
- **과거 결정 출처**: `spec/5-system/7-llm-client.md` §7.1 원문 — "`main.ts` 부팅 가드가 … throw 한다 ("not allowed when NODE_ENV=production")"
- **상세**: 기존 문장은 가드 위치를 `main.ts` 로 단정했고 오류 메시지를 직접 인용했다. 변경 후 문장은 가드를 `assertProductionConfig`(`common/config/production-guards.ts`)로 재표현해 구현 사실에 더 정확히 맞췄다. 이는 기각된 대안의 재도입이나 원칙 위반이 아닌 사실 정정이지만, 구 인용 문자열("not allowed when NODE_ENV=production")이 폐기됐음을 spec 어디서도 명시하지 않는다. 다른 곳에서 그 문자열에 의존하는 코드·테스트가 있다면 silent 미스매치가 발생할 수 있다.
- **제안**: 변경은 적절하다. 단, `production-guards.ts` 의 실제 throw 메시지가 무엇인지 spec 에 별도 인용하거나, 인용 자체를 spec 에서 제거하면 단일 진실이 유지된다 (현재는 인용이 삭제됐으므로 문제는 없으나, 주석 차원에서만 기록).

---

### INFO-3: `INTERACTION_JWT_SECRET` 가드 분리 이유 — EIA 설명 갱신 정합 확인
- **target 위치**: `spec/5-system/14-external-interaction-api.md` §8.3 `iext_*` 문단 (변경 후)
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md` 동일 문단 원문 — "`OAUTH_STUB_MODE`/`LLM_STUB_MODE` 부팅 가드와 동형" 이라는 표현으로 단일 그룹으로 처리했다.
- **상세**: 변경 후 문장은 "`JWT_SECRET`/`ENCRYPTION_KEY` 부팅 가드와 동형. 후자들은 `assertProductionConfig` 에 응집되어 있으나, 본 `INTERACTION_JWT_SECRET` 만은 `InteractionTokenService` 생성자 throw 로 별도 유지"라고 명확화했다. 이 분리 이유(DI 생성자 맥락)는 `spec/5-system/1-auth.md` §Rationale에서 "DI·요청 컨텍스트가 필요한 항목(예: `INTERACTION_JWT_SECRET` 생성자 throw)은 의도적으로 분리한다"로도 일치하게 기록됐다. 내부 충돌 없음. 다만 EIA spec의 설명이 본문 인라인에 괄호로만 있어 Rationale 절에 별도 항목이 없다는 점은 미래 독자에게 찾기 어려울 수 있다.
- **제안**: 특별한 조치 불필요. 원하면 EIA spec 의 `## Rationale` 에 "`INTERACTION_JWT_SECRET` 가드 분리" 항목을 짧게 추가하면 일관성이 더 높아진다.

---

## 요약

본 diff 는 `spec/5-system/1-auth.md`, `spec/5-system/11-mcp-client.md`, `spec/5-system/7-llm-client.md`, `spec/5-system/14-external-interaction-api.md`, `spec/conventions/secret-store.md` 에 production fail-closed 가드(`JWT_SECRET`·`ENCRYPTION_KEY`·`MCP_ALLOW_INSECURE_URL`·stub 모드)를 단일 `assertProductionConfig` 블록으로 응집한 내용을 spec 에 반영한 것이다. 기각된 대안의 재도입이나 합의된 invariant 위반은 발견되지 않았다. 기존 Rationale(`OAUTH_STUB_MODE`/`LLM_STUB_MODE` 부팅 가드 동형, `InteractionTokenService` 생성자 throw 별도 유지, `MCP_ALLOW_INSECURE_URL` 운영 절대 금지)와 모두 일관되며 새 Rationale 이 함께 작성됐다. 발견된 세 항목은 모두 INFO 수준으로, `ALLOW_PRIVATE_HOST_TARGETS` 의 production warn 동작이 해당 플래그의 1차 출처 파일에 미기술된 것이 가장 유의미한 보완 포인트다.

---

## 위험도

LOW
