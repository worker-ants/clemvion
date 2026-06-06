# Rationale 연속성 검토 결과

검토 범위: `spec/5-system/` (구현 착수 전 검토, --impl-prep)
검토 대상 문서: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md`
관련 Rationale 참조: `spec/5-system/4-execution-engine.md ## Rationale`, `spec/0-overview.md ## Rationale`, `spec/1-data-model.md ## Rationale`, `spec/2-navigation/*.md ## Rationale`

---

## 발견사항

### 발견사항 없음 — 정합 양호

검토 결과 `spec/5-system/` 의 세 문서에서 기존 Rationale 의 명시적 기각 대안 재도입, 합의된 invariant 위반, 무근거 번복, 암묵적 가정 충돌은 발견되지 않았다.

주요 검토 항목 및 결과:

**1-auth.md**
- `1.4.D — TOTP 자동 fallback 금지` 원칙: WebAuthn 등록 사용자에게 TOTP 입력란을 숨기는 설계가 문서 본문 §1.4.2 에 그대로 유지됨. 기각된 대안("양쪽 동시 노출")이 재도입되지 않음.
- `1.4.E — counter 역행 시 credential 강제 삭제 (vs suspend)`: suspend 컬럼·재활성화 UI 없이 즉시 삭제 정책이 §1.4.4 에서 일관 유지됨.
- `1.4.B — 복구 코드 풀 분리`: TOTP/WebAuthn 풀 분리 설계 (`user.totp_recovery_codes` / `user.webauthn_recovery_codes`) 가 §1.4.1 에서 그대로 유지됨.
- `1.4.C — WebAuthn challenge: stateless JWT`: 별도 DB 테이블 없이 `optionsToken` JWT 로 처리하는 결정이 §1.4.4 에서 일관 유지됨.
- `1.4.F — WebAuthn 환경변수 미설정 시 기능 비활성`: 부팅 거부 대신 `enabled=false` + 503 정책이 §1.4.3 에서 유지됨.
- `1.5.B — 초대 메일 SMTP: 시스템 전역 사용`: 워크스페이스 SMTP Integration 사용 금지 결정이 §1.5.1 에서 유지됨.

**10-graph-rag.md**
- `mode 2종 (vector/graph) — 3종 분리 기각`: §2 Rationale 에 명시된 "graph 안에 vector seed 포함, 3종 불요" 결정이 §3.1 및 §2.1 에서 일관 유지됨.
- `사후 변경 불가`: KB 모드 생성 후 불변 정책이 §3.1 KB-GR-MD-02, §2.1, §4.1 데이터 모델에서 일관 유지됨. Apache AGE/Neo4j 도입 기각, 룰 기반 entity 추출 기각 등 기각 대안 모두 §8 비-목표/§2.2 범위 밖에서 재확인됨.
- `추출 LLM 분리 (KB 단위 extractionLlmConfigId)`: §2.1, §3.2, §4 기술 결정에서 일관 유지됨.
- `PostgreSQL 관계형 테이블 — Neo4j 미채택`: §4 기술 결정에서 유지됨.

**11-mcp-client.md**
- `stdio 미지원`: §2.2 에서 명시적으로 재확인. 기각 이유(멀티테넌트 보안 부담)가 Rationale 과 일관됨.
- `Streamable HTTP 전용 (외부 서버)`: §2.1 에서 유지됨.
- `Internal Bridge — 외부 HTTP 아님`: §2.3 에서 service_type 별 Internal Bridge 패턴이 별도 transport 로 명확 분리됨.
- `MCP 능력을 LLM 도구 호출로 평탄화 (systemPrompt 정적 pin 기각)`: §5 에서 유지. "MVP 미포함" 에 `MCP prompts/get 결과를 systemPrompt 슬롯에 정적으로 핀하는 UX` 가 명시됨.
- `per-node task queue 기각` (exec-engine Rationale): MCP 도구 호출이 §5.7 에서 AI Agent 의 `maxToolCalls` 카운트에 포함되어 in-process execution 모델을 따름. per-node 분산 기각 결정과 정합됨.
- `노드 실행 1회 = MCP 세션 1회, 노드 간 세션 공유 없음 (§4.3)`: exec-engine Rationale 의 "execution-level intake 큐" 결정과 정합 — 한 세그먼트가 한 프로세스 in-process 실행이므로 세션 공유 없음이 일관.

---

## 요약

`spec/5-system/` 의 세 문서(1-auth.md, 10-graph-rag.md, 11-mcp-client.md)는 관련 spec 의 `## Rationale` 에 기록된 기각 대안·합의 원칙·시스템 invariant 와 모두 정합한다. 명시적으로 기각된 대안(WebAuthn suspend, TOTP 자동 fallback, 초대 워크스페이스 SMTP, KB 모드 3종, Neo4j 도입, MCP stdio, systemPrompt 정적 pin 등)이 재도입된 사례가 없고, 결정 번복 시 새 Rationale 없이 뒤집히는 패턴도 없다. exec-engine Rationale 의 핵심 invariant(in-process dispatch loop, bounded 메모리, durable park)와 mcp-client 설계도 정합하다.

---

## 위험도

NONE
