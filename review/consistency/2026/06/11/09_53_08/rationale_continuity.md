# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/prod-fail-closed-guards.md`

---

## 발견사항

### 1. [WARNING] `jwt.config.ts` fallback 유지 — C-1 권장 결정(옵션 A)과의 미묘한 불일치

- **target 위치**: `## 변경` 항목 끝줄: "`jwt.config.ts` 의 `|| 'dev-jwt-secret'` fallback 은 **유지** — dev/test 편의(prod 는 가드가 거부)."
- **과거 결정 출처**: `plan/in-progress/refactor/04-security.md` § C-1 개선 방안 1항 및 옵션 A
  - 개선 방안 1: "`|| 'dev-jwt-secret'` 제거 + `main.ts` 부팅 가드에 `production && !JWT_SECRET → throw`"
  - 옵션 A 이름: "fallback 제거 + C-1·M-4·M-7 단일 … 블록으로 일괄 처리"
  - 권장 결정: "A"
- **상세**: refactor/04-security.md C-1 은 두 축을 묶어 권장 A 로 선택했다 — (a) `|| 'dev-jwt-secret'` fallback 제거, (b) `main.ts` 가드 추가. target 은 (b)만 구현하고 (a)를 의도적으로 생략한 뒤 Rationale 에 "production 은 가드가 sentinel 을 거부하므로 보안 목표(기본 secret 미사용) 달성"이라는 새 근거를 제시한다. 보안 달성 주장 자체는 기술적으로 성립하나(production 에서 가드가 sentinel 을 throw), refactor 계획 문서에 기록된 선택(옵션 A = fallback 제거)을 부분 번복하면서 새 Rationale 을 별도 spec `## Rationale` 로 공식화하지 않고 plan 문서 내부에만 적시했다.
- **제안**:
  1. (권장) target 의 현재 접근을 그대로 유지하되, refactor/04-security.md C-1 의 "옵션 A" 설명란(또는 추적 plan)에 "fallback 제거 생략 — 가드가 sentinel 을 거부하므로 보안 동등; dev/test 편의를 위해 fallback 유지"를 명기해 번복 근거를 추적 문서 내에 공식 기록한다.
  2. 또는 `spec/5-system/1-auth.md §2.1` 의 `assertProductionConfig` 노트에 "jwt.config 의 dev fallback 은 의도적으로 보존 — production 가드가 sentinel 을 거부하므로 보안 목표 충족" 한 줄을 추가해 spec Rationale 수준에서 명문화한다.

---

### 2. [INFO] OAUTH_STUB/LLM_STUB 인라인 가드 응집 — 기존 가드 위치·패턴과의 정합성 확인 필요

- **target 위치**: `## 변경` 항목: "기존 `OAUTH_STUB_MODE`/`LLM_STUB_MODE` 인라인 가드도 본 함수로 응집."
- **과거 결정 출처**: `spec/5-system/1-auth.md §2.1` 노트 및 `refactor/04-security.md` C-1 — 기존 OAUTH_STUB/LLM_STUB 가드는 `main.ts` 인라인에 있으며 동형으로 언급됨. 새 단일 함수로 응집하는 것은 refactor 계획의 권장 A 방향과 정합.
- **상세**: 이 응집 자체는 기각된 대안의 재도입이 아니며 합의된 원칙(단일 위치 응집)과 부합한다. 다만 `assertProductionConfig` 가 기존 인라인 가드를 **대체**할 때 기존 가드의 throw 동작(OAUTH_STUB/LLM_STUB 은 이미 production throw 표준)을 그대로 유지하는지 체크리스트에 명시되어 있지 않다. 행동 변경 없는 리팩터이므로 낮은 위험이나, 단위 테스트 항목(`assertProductionConfig 전 분기`)에 "기존 STUB 가드 동작 동등성" 검증이 포함되면 좋다.
- **제안**: 체크리스트의 단위 테스트 항목에 "OAUTH_STUB/LLM_STUB 분기 — 기존 인라인 동작 동등" 명시.

---

### 3. [INFO] `ALLOW_PRIVATE_HOST_TARGETS` warn 처리 — 기각된 warn 대안(M-7 옵션 B)과의 표면적 유사성

- **target 위치**: `## 변경`: "`ALLOW_PRIVATE_HOST_TARGETS` production warn(throw 아님 — 정당 self-host 용도, M-7 정책 분리)."
- **과거 결정 출처**: `refactor/04-security.md` § M-7 — 옵션 B("throw 대신 warn 로그")는 `MCP_ALLOW_INSECURE_URL` 에 대해 기각됨. 그러나 동시에 M-7 옵션 A 권장 텍스트 자체에 "`ALLOW_PRIVATE_HOST_TARGETS` 는 warn 으로 분리" 가 명기되어 있고, `spec/5-system/11-mcp-client.md §132` 에 "정당 self-host 용도(`ALLOW_PRIVATE_HOST_TARGETS`)는 throw 가 아닌 warn" 이 명문화되어 있다.
- **상세**: `ALLOW_PRIVATE_HOST_TARGETS` warn 처리는 기각된 대안의 재도입이 아니다. M-7 에서 기각된 옵션 B 는 `MCP_ALLOW_INSECURE_URL` 에만 적용되며, `ALLOW_PRIVATE_HOST_TARGETS` 는 M-7 권장 A 의 **일부**로 warn 으로 분리하도록 명시 결정된 것이다. target 은 spec 및 refactor 계획 모두와 정합하며 위반 없음.
- **제안**: 현행 유지. 다만 검토자나 후속 기여자가 "왜 같은 파일에 throw 와 warn 이 혼재하는가"를 혼동할 수 있으니, `production-guards.ts` 의 `ALLOW_PRIVATE_HOST_TARGETS` 처리 주석에 "M-7 분리 결정 — spec 11-mcp-client.md §132" 출처를 남기면 좋다.

---

## 요약

target 문서(`prod-fail-closed-guards.md`)는 전반적으로 기존 spec Rationale 및 refactor/04-security.md 의 결정 방향과 정합한다. 핵심 설계(단일 가드 함수 응집, MCP throw / ALLOW_PRIVATE_HOST_TARGETS warn 분리, ENCRYPTION_KEY placeholder + production 거부)는 모두 사전 기록된 결정과 일치한다. 유일한 주의점은 `jwt.config.ts` 의 `|| 'dev-jwt-secret'` fallback 유지인데, 이는 refactor 계획의 권장 옵션 A("fallback 제거")를 부분 번복한 것이다. target 의 Rationale 에 기술적 근거(production 가드가 sentinel 을 거부하므로 보안 목표 달성)가 명시되어 있어 무근거 번복은 아니지만, 이 근거가 추적 문서(refactor/04-security.md) 또는 spec Rationale 에 공식 반영되지 않아 후속 검토자가 C-1 결정 이력과 실제 구현 간 차이를 오해할 여지가 남는다.

## 위험도

LOW
