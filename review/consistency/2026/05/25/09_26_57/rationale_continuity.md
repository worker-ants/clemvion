# Rationale 연속성 검토 결과

- 검토 모드: `--impl-prep`
- 대상 scope: `spec/5-system/` (1-auth.md · 10-graph-rag.md · 11-mcp-client.md)
- 검토 일시: 2026-05-25
- 검토 worktree: `workflow-resumable-execution-phase2-cont-64f537`

---

## 발견사항

### 발견 없음

세 대상 파일 모두 기존 `## Rationale` 절과의 충돌이 확인되지 않았다.

**검토 항목별 결과**

| 관점 | `1-auth.md` | `10-graph-rag.md` | `11-mcp-client.md` |
|------|-------------|-------------------|--------------------|
| 1. 기각된 대안의 재도입 | 없음 | 없음 | 없음 |
| 2. 합의된 원칙 위반 | 없음 | 없음 | 없음 |
| 3. 결정의 무근거 번복 | 없음 | 없음 | 없음 |
| 4. 암묵적 가정 충돌 | 없음 | 없음 | 없음 |

---

**`spec/5-system/1-auth.md` 점검 결과**

- Rationale 1.4.A (WebAuthn 라이브러리) — `@simplewebauthn/*` 채택, `fido2-lib` / 직접 구현 기각. 본문의 `@Processor`, `verifyAuthenticationResponse` 호출이 해당 결정과 정합.
- Rationale 1.4.B (복구 코드 풀 분리) — `totp_recovery_codes` / `webauthn_recovery_codes` 별도 컬럼. 본문 §1.4.1 표의 두 풀 독립 구조가 동일.
- Rationale 1.4.C (stateless JWT challenge) — `webauthn_challenge` 테이블 기각, JWT `optionsToken` 채택. §1.4.4 흐름의 `optionsToken` 발급·소비가 동일.
- Rationale 1.4.D (TOTP 자동 fallback 금지) — §1.4.2 표의 `methods=['webauthn']` 단독 노출 규칙이 원칙과 일치.
- Rationale 1.4.E (counter 역행 시 삭제 vs suspend) — suspend 컬럼 기각, 즉시 삭제 채택. §1.4.4 "credential row 를 즉시 삭제 (suspend 컬럼 없음)" 주석이 동일.
- Rationale 1.4.F (env 미설정 시 부팅 거부 기각) — §1.4.3 비활성 동작 표가 "부팅 정상 + 엔드포인트 503" 을 유지.
- Rationale 1.4.G (V058 단일 statement 예외) — 본문에서 2-step 분리를 강제하지 않으며 Rationale 에서 조건 명시됨. 충돌 없음.
- Rationale 1.4.H (WebAuthnModule 단방향 의존성) — §1.4.4 "AuthModule → WebAuthnModule 단방향" 원칙 유지. controller 는 AuthModule 에 등록.
- Rationale 1.4.I (`requiresTotp` 제거) — §5 API 표와 §1.4.2 에 `requiresTotp` 필드가 나타나지 않음. 제거 조건(두 마이너 버전 경과 + `methods` 기반 프론트엔드) 충족 근거도 Rationale 에 명시됨.
- Rationale 1.5.A (이메일 일치 강제) — §1.5.2 단계 3b "불일치 → 400 + 가입 자체 거부" 가 정책과 정합.
- Rationale 1.5.B (시스템 SMTP 한정) — §1.5.1 "워크스페이스 SMTP Integration 사용하지 않음" 유지.
- Rationale 1.5.C (7일 만료) — §1.5.1 표 "발급 시점 + 7일" 유지.

**`spec/5-system/10-graph-rag.md` 점검 결과**

- "비-목표" 항목 (Apache AGE / Neo4j, spaCy 룰 기반 추출, community detection, KB 모드 사후 변경) 이 §2.2 범위 밖으로 명시되며, 본문 어디서도 재도입 없음.
- KB 모드 불변 원칙 ("생성 시에만 결정, 사후 변경 불가") — §2.1 KnowledgeBase `rag_mode` 컬럼 정의, §3.1 큐 라우팅, KB-GR-MD-02 요구사항 모두 동일 원칙 유지.
- LLM 추출 단일 경로 원칙 — §3.2 GraphExtractionProcessor 가 LLM 호출만 기술. 룰 기반 추출 재도입 없음.
- Graph 검색 파라미터를 KB 단위에만 노출 (AI Agent 노드는 `ragTopK` / `ragThreshold` 유지) — §3.5 / KB-GR-PA-03 에서 동일 결정 유지.
- Rationale 역사 기록 (2026-05-02 결정 스냅샷) — 결정 7종이 본문 구조와 일치. 경로 참조가 구형 `prd/*.md` 를 유지하되 역사 기록 주석이 명시됨 (허용된 패턴).

**`spec/5-system/11-mcp-client.md` 점검 결과**

- stdio 미지원 원칙 — §2.2 에 사유 명시. §12 확장 포인트에서 stdio 를 "향후 데스크톱 bridge 한정" 으로만 언급. 현 구현 범위로 stdio 도입 없음.
- WebSocket transport 미지원 — §10에서 `stdio·websocket 모듈은 import 하지 않는다` 유지.
- Integration 모델 (신규 테이블·컬럼 없음) — §11 "신규 컬럼 / 신규 엔티티 없음" 유지.
- `error → connected` 자동 복구 금지 — §8.4 에서 race-of-clock 근거와 함께 명시. Internal Bridge (cafe24 refresh_token) 예외도 별도 단락으로 근거 기술됨.
- 메타도구 usage 로그 제외 — §8.3 에서 discovery 흐름 성격으로 기각 이유 명시.
- `skipReason` vs `code` 표기 분리 (lower_snake_case vs UPPER_SNAKE_CASE) — §6.2 명명 규칙 분리 단락이 근거 유지.

---

## 요약

검토 대상인 `spec/5-system/` 세 파일(1-auth.md, 10-graph-rag.md, 11-mcp-client.md)은 각자의 `## Rationale` 절에서 명시적으로 기각된 대안(suspend 컬럼, 공통 복구 코드 풀, webauthn_challenge 테이블, DB 마이그레이션 도구 Prisma, Neo4j·AGE·spaCy, stdio transport, MCP 신규 테이블 등)을 어디서도 재도입하지 않는다. 합의된 설계 원칙(WebAuthn 우선 / TOTP fallback 자동 금지, KB 모드 불변, MCP 단방향 의존성, 시스템 SMTP 한정, `error → connected` 자동 복구 금지 등)은 본문과 정합하게 유지되고 있다. 번복이 의도된 결정(Rationale 1.4.F의 부팅 거부→기능 비활성 전환, Rationale 1.4.I의 `requiresTotp` 제거)은 새 Rationale 절을 통해 근거가 함께 기술되어 있어 무근거 번복이 아니다. 구현 착수 관점에서 Rationale 연속성 차단 사항 없음.

---

## 위험도

NONE
