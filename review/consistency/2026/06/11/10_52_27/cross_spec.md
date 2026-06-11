## 발견사항

### [INFO] `spec/2-navigation/10-auth-flow.md` 의 `OAUTH_STUB_MODE` — production fail-closed 미기술
- target 위치: `spec/5-system/1-auth.md` §Rationale "Production fail-closed 가드" (신규 추가) — "`OAUTH_STUB_MODE`/`LLM_STUB_MODE` 에 production throw 표준을 명문화했다"고 언급하며, 두 stub 모드를 기존 선례(prior art)로 참조함
- 충돌 대상: `spec/2-navigation/10-auth-flow.md` §5 (line 333) — "`OAUTH_STUB_MODE=true` (개발) 또는 `{PROVIDER}_CLIENT_ID` 환경변수가 설정된 경우" 라고만 기술하며 production fail-closed 동작을 전혀 언급하지 않음
- 상세: `spec/5-system/7-llm-client.md` §7.1 은 `assertProductionConfig`(`common/config/production-guards.ts`) 가 `OAUTH_STUB·LLM_STUB` 를 응집했다고 명시하는데, `10-auth-flow.md` 는 `OAUTH_STUB_MODE` 의 production throw 보증을 기술하지 않아 동일 env 변수에 대한 설명이 비대칭이다. `10-auth-flow.md` 독자는 `OAUTH_STUB_MODE` 가 production 에서 차단되는 사실을 해당 문서에서 확인할 수 없다.
- 제안: `spec/2-navigation/10-auth-flow.md` §5 의 `OAUTH_STUB_MODE` 설명 뒤에 "production(`NODE_ENV=production`)에서는 `assertProductionConfig` 가 `OAUTH_STUB_MODE=true` 를 throw 해 활성화를 차단한다" 한 줄을 추가하거나, `spec/5-system/1-auth.md` §Rationale 의 "단일 블록 응집 이유" 에서 `10-auth-flow.md` 를 교차 참조 링크로 추가한다. 기능 충돌은 아니므로 동기화 권장 수준.

---

### [INFO] `spec/5-system/14-external-interaction-api.md` 의 `INTERACTION_JWT_SECRET` — `assertProductionConfig` 블록 외부 별도 경로 명시됨, 목록 불완전성 잠재
- target 위치: `spec/5-system/1-auth.md` §2.1 주석 (신규) 및 §Rationale "Production fail-closed 가드" — `JWT_SECRET·ENCRYPTION_KEY·MCP_ALLOW_INSECURE_URL` 을 `assertProductionConfig` 단일 블록 항목으로 나열
- 충돌 대상: `spec/5-system/14-external-interaction-api.md` §7.2 (line 651) — `INTERACTION_JWT_SECRET` 은 `InteractionTokenService` 생성자 throw 로 **별도 유지**한다고 명시하며, `assertProductionConfig` 항목에 포함되지 않음을 설명
- 상세: 두 문서의 기술은 상호 모순이 아니다. EIA spec 이 `INTERACTION_JWT_SECRET` 이 `assertProductionConfig` 밖에 있다는 점을 명시적으로 설명하고 있어 직접 충돌은 없다. 그러나 `spec/5-system/1-auth.md` §Rationale 의 production fail-closed 가드 설명(항목 목록: `JWT_SECRET`, `ENCRYPTION_KEY`, `MCP_ALLOW_INSECURE_URL`)이 `INTERACTION_JWT_SECRET` 의 별도 경로를 언급하지 않아, `1-auth.md` 를 단독으로 읽는 독자는 production 전체 fail-closed 방어가 세 항목으로 완결된다고 오해할 수 있다.
- 제안: `spec/5-system/1-auth.md` §Rationale "Production fail-closed 가드" 끝에 "본 블록에 포함되지 않으나 동형 패턴인 guard: `INTERACTION_JWT_SECRET` — `InteractionTokenService` 생성자 throw ([Spec EIA §7.2](./14-external-interaction-api.md))" 를 한 줄 주석으로 추가하면 독자의 오해 방지. 단, 현재 EIA spec 이 명시하고 있으므로 cross-reference 없이도 기능 충돌 아님 — 동기화 권장 수준.

---

### [INFO] `spec/data-flow/7-llm-usage.md` 의 production guard 설명 미동기화
- target 위치: `spec/5-system/7-llm-client.md` §7.1 — 프로덕션 차단 가드가 `assertProductionConfig`(`common/config/production-guards.ts`)에 있다고 갱신됨
- 충돌 대상: `spec/data-flow/7-llm-usage.md` 26행 — "프로덕션은 main.ts 부팅 가드로 차단 — [Spec LLM Client §7.1]" 이라고만 기술하며 `production-guards.ts` 파일명을 참조하지 않음
- 상세: `data-flow/7-llm-usage.md` 는 `[Spec LLM Client §7.1]` 링크를 통해 간접 참조가 유지되므로 기능적으로 틀리지 않는다. 그러나 직접 기술 수준에서 `7-llm-client.md` 와 비대칭이 생겼다.
- 제안: `data-flow/7-llm-usage.md` 의 해당 행에서 `[Spec LLM Client §7.1]` 링크가 이미 있으므로 현재로서 동기화 우선순위가 낮다. 향후 data-flow 문서 일괄 갱신 시 포함 권장.

---

## 요약

이번 변경(`spec/5-system/1-auth.md`, `spec/5-system/11-mcp-client.md`, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/7-llm-client.md`, `spec/conventions/secret-store.md`)은 production fail-closed 가드(JWT_SECRET·ENCRYPTION_KEY·MCP_ALLOW_INSECURE_URL·OAUTH_STUB·LLM_STUB 를 `assertProductionConfig` 단일 블록으로 응집)의 설계 근거를 spec 에 명문화한 내용이다. 검토된 cross-spec 범위에서 데이터 모델 충돌, API 계약 충돌, 요구사항 ID 충돌, 상태 전이 충돌, RBAC 모순, 계층 책임 충돌은 발견되지 않았다. `spec/conventions/secret-store.md` 와 `spec/5-system/14-external-interaction-api.md` 는 각각 `assertProductionConfig` 를 일관되게 참조하며 `ALLOW_PRIVATE_HOST_TARGETS` 의 warn-only 구분도 일치한다. 발견된 세 항목은 모두 INFO 수준의 문서 동기화 권장으로, `spec/2-navigation/10-auth-flow.md` 의 `OAUTH_STUB_MODE` 설명에 production throw 사실이 누락된 비대칭이 가장 두드러진다.

## 위험도

LOW

STATUS: SUCCESS
