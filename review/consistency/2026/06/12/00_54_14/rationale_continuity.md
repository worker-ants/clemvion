## 발견사항

### INFO — `spec/5-system/11-mcp-client.md` §3.1 `auth_type='none'` 과 SSRF 가드의 관계 명시 보완 권고
- target 위치: `spec/5-system/11-mcp-client.md` §3.1 Integration 모델 표 (`auth_type` 목록에 `none` 포함)
- 과거 결정 출처: `spec/4-nodes/4-integration/1-http-request.md` §8.2 Rationale — "`none`/`custom` 무가드 폐지 (2026-06-11)" + §4 SSRF opt-out callout "기본은 차단(secure-by-default) … 이 플래그는 통합 노드 전반의 SSRF 가드를 공통 제어한다"
- 상세: http-request Rationale §8.2 에서 "`none` 인증 = SSRF 무가드" 개념이 명시적으로 기각됐다. MCP Client spec §3.1 은 `auth_type='none'` 을 MCP 서버의 자격증명 불요 설정으로 적법하게 사용하고 있으나, §3.2 의 SSRF 가드 조항("URL 은 HTTPS 강제 … 호스트가 다음 중 하나에 해당하면 차단")이 `auth_type` 과 무관하게 적용됨을 본문에서 명시하지 않는다. http-request §8.2 를 모르는 독자는 `auth_type='none'` MCP 서버가 SSRF 무가드 상태라고 오해할 수 있다.
- 제안: §3.2 의 SSRF 정책 callout 에 "본 SSRF 가드는 `auth_type` 값과 무관하게(`bearer_token`·`api_key`·`none` 모두) 적용된다 — `auth_type='none'` 은 자격증명 불요를 의미할 뿐, SSRF 방어를 면제하지 않는다" 한 줄 추가. (http-request Rationale §8.2 의 "전 인증 방식 공통" 원칙의 MCP 도메인 반영.)

---

## 요약

`spec/5-system` 영역의 target 문서들(`1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`)은 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 위반하는 내용을 포함하지 않는다. `1-auth.md` 는 WebAuthn credential 즉시 삭제(suspend 금지, Rationale 1.4.E), 복구 코드 풀 분리(Rationale 1.4.B), stateless JWT challenge(Rationale 1.4.C), TOTP 자동 fallback 금지(Rationale 1.4.D), 초대 토큰 raw 저장(Rationale 1.5.D) 등 핵심 보안 결정을 모두 준수한다. `auth_config.create/update/delete/regenerate` 감사 액션도 commit `debc90ee` 이후 "현재 구현된 액션" 표로 정상 반영됐다. `10-graph-rag.md` 는 PostgreSQL 관계형 테이블 선택(Apache AGE/Neo4j 기각), LLM 단일 추출 경로(rule-based 기각), 모드 불변(사후 변경 금지) 등 기획 결정 근거와 완전히 정합한다. `11-mcp-client.md` 는 Integration 기존 테이블 재사용(신규 별도 테이블 금지), Internal Bridge 의 SSRF 면제(외부 fetch 없음 — 논리적으로 일관), stdio 미지원(멀티테넌트 보안 근거 기록) 등을 일관되게 유지한다. 다만 `11-mcp-client.md` §3.2 에서 `auth_type='none'` 이 SSRF 면제를 의미하지 않는다는 점이 명시되지 않아, http-request Rationale §8.2 의 "전 인증 방식 공통 SSRF 가드" 원칙이 MCP 도메인에서는 문서화 갭으로 남아 있다. 기능 위반은 아니지만 독자 오해 방지를 위해 해당 callout 보완을 권고한다.

## 위험도

LOW
