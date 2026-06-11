### 발견사항

- **[INFO]** `INTERACTION_JWT_SECRET` fail-closed 메커니즘: 통합 함수 vs 생성자 throw
  - target 위치: plan `## 변경` 항목 "기존 `OAUTH_STUB_MODE`/`LLM_STUB_MODE` 인라인 가드도 본 함수로 응집"
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §8.3 — "`NODE_ENV=production` 에서는 `InteractionTokenService` **생성자가** throw 해 서버 부팅을 차단한다"
  - 상세: plan 은 `OAUTH_STUB_MODE`/`LLM_STUB_MODE` 두 가드를 `assertProductionConfig` 로 응집한다고 명시하고 있으며, `INTERACTION_JWT_SECRET` 가드는 언급하지 않는다. 그러나 EIA spec 은 `INTERACTION_JWT_SECRET` fail-closed 가 `InteractionTokenService` 생성자 내부에서 throw 된다고 명시해 두었고, 이것이 `assertProductionConfig` 경로와는 별개임을 암시한다. plan 이 `INTERACTION_JWT_SECRET` 를 흡수하지 않는 것 자체는 모순이 아니나, 두 경로(생성자 throw vs `assertProductionConfig`)가 동시에 존재하는 구조를 spec 이 명확히 허용하고 있는지 불분명하다. 향후 유지보수에서 혼란 원인이 될 수 있다.
  - 제안: `spec/5-system/14-external-interaction-api.md` §8.3 노트에 "이 생성자 throw 는 `assertProductionConfig` 통합 이후에도 별도로 유지된다 (INTERACTION_JWT_SECRET 는 assertProductionConfig 범위 밖)" 를 1행 명시해 두면 명확성이 높아진다. 또는 plan 의 `## Spec` 섹션에 EIA 항목도 참조로 추가.

- **[INFO]** `OAUTH_STUB_MODE` production fail-closed 의 spec SoT 불분명
  - target 위치: plan `## 변경` 항목 "기존 `OAUTH_STUB_MODE`/`LLM_STUB_MODE` 인라인 가드도 본 함수로 응집"
  - 충돌 대상: `spec/5-system/7-llm-client.md` §7.1 에는 `LLM_STUB_MODE` production throw 가 명확히 기술되어 있으나, `OAUTH_STUB_MODE` 에 대해서는 "main.ts 부팅 가드" 라는 표현이 `spec/5-system/11-mcp-client.md` §3.2 등에서 간접 언급 수준으로만 존재한다. `spec/5-system/1-auth.md` §2.1 노트와 `spec/2-navigation/10-auth-flow.md` §5.1 에서 `OAUTH_STUB_MODE` 는 정의만 되어 있고 "production 에서 throw" 규칙이 SoT 문서에 명시되어 있지 않다.
  - 상세: `OAUTH_STUB_MODE` 의 production fail-closed 가드가 실제로 기존 `main.ts` 어딘가에 인라인으로 구현되어 있다면, plan 이 이를 `assertProductionConfig` 로 응집하는 것이 일관성에 부합한다. 그러나 `LLM_STUB_MODE` 는 `spec/5-system/7-llm-client.md §7.1` 이 SoT 인 데 비해 `OAUTH_STUB_MODE` 대응 spec 섹션이 없다. 구현 후 spec 동기화 누락 가능성.
  - 제안: 구현 완료 후 `spec/5-system/1-auth.md §2.1` (또는 `spec/2-navigation/10-auth-flow.md`) 에 `OAUTH_STUB_MODE` production fail-closed 노트를 `LLM_STUB_MODE §7.1` 과 동형으로 명시하거나, plan `## Spec` 섹션에 해당 spec 참조를 추가.

- **[INFO]** `ALLOW_PRIVATE_HOST_TARGETS` warn 정책이 cross-node 공유 플래그임을 plan 이 언급하지 않음
  - target 위치: plan `## 변경` "ALLOW_PRIVATE_HOST_TARGETS production warn(throw 아님 — 정당 self-host 용도, M-7 정책 분리)"
  - 충돌 대상: `spec/4-nodes/4-integration/1-http-request.md` §4, `spec/4-nodes/4-integration/2-database-query.md` §4, `spec/4-nodes/4-integration/3-send-email.md` §4, `spec/2-navigation/4-integration.md` §5.5
  - 상세: plan 이 production 에서 `ALLOW_PRIVATE_HOST_TARGETS` 를 warn-only 로 분류하는 것은 `spec/5-system/11-mcp-client.md §3.2` 의 "정당 용도 있는 플래그는 warn" 분류와 완전히 일치한다. 다만 이 플래그가 HTTP Request·Database Query·Send Email·SMTP 노드 전반에 걸쳐 **공유 SSRF opt-out 플래그**임을 plan 이 언급하지 않아, 어느 코드 위치에서 warn 을 발생시킬지 (main.ts 단독 vs 각 노드 실행 시점) 명확하지 않다. main.ts 의 warn 만으로 충분한지, 또는 각 노드 실행 시마다 별도 warn 이 필요한지는 spec 에 정의되어 있지 않다.
  - 제안: INFO 수준이며 plan 의 핵심 보안 목표와 무관. 구현 시 warn 발생 위치를 README 나 코드 주석에 명확히 남기는 것으로 충분.

### 요약

target plan(`prod-fail-closed-guards.md`)이 기술하는 세 개의 production fail-closed 가드(C-1 `JWT_SECRET`, M-4 `ENCRYPTION_KEY`, M-7 `MCP_ALLOW_INSECURE_URL`) 및 `OAUTH_STUB_MODE`/`LLM_STUB_MODE` 응집은 `spec/5-system/1-auth.md §2.1`, `spec/conventions/secret-store.md §3.3`, `spec/5-system/11-mcp-client.md §3.2`, `spec/5-system/7-llm-client.md §7.1` 이 이미 명문화한 내용과 직접 모순 없이 일치한다. 단, `INTERACTION_JWT_SECRET` fail-closed 가 `InteractionTokenService` 생성자 throw(`spec/5-system/14-external-interaction-api.md §8.3`) 로 구현되어 있어 `assertProductionConfig` 와는 별도 경로임이 spec 상 명확하지 않으며, `OAUTH_STUB_MODE` production throw 의 spec SoT 문서가 `LLM_STUB_MODE` 와 달리 부재하다. 두 사항 모두 INFO 수준이며 구현 착수를 차단하지 않는다.

### 위험도

LOW
