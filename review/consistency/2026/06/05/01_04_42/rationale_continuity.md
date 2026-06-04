# Rationale 연속성 Check 결과

- **검토 모드**: 구현 완료 후 검토 (`--impl-done`, scope=`spec/5-system`, diff-base=origin/main)
- **Target**: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md`
- **판정**: **PASS (위배 없음)** — Critical 0 / Warning 0 / Info 3
- **diff 상태**: 본 worktree 의 HEAD == origin/main, 작업트리 clean. target spec 3건은 payload 에 inline 제공된 현재 상태 스냅샷이며, 그 본문·Rationale 이 기존 합의 Rationale 과 충돌하는지를 검토했다.

## 점검 관점별 결과

### 1. 기각된 대안의 재도입 — 위배 없음

과거 Rationale 에서 명시적으로 기각된 대안이 target 본문에 재도입된 사례 없음. 대표 확인:

- **graph-rag**: §2.2 / Rationale 의 "그래프 저장소 = PostgreSQL 관계형, Neo4j/Apache AGE 미도입", "LLM 추출 단일 경로(룰 기반 spaCy 제외)", "KB 모드 사후 변경 불가" 는 모두 §8 비-목표·기술결정표의 기각 결정과 일치. 재도입 없음.
- **mcp-client**: stdio/websocket transport 는 §2.2 에서 기각 사유와 함께 미지원 유지. §5.6 "메타도구는 allowlist 영향 없음(capability 단위 on/off)" 도 기각 대안(resource/prompt 별 allowlist) 을 재도입하지 않음.
- **auth**: §1.4.D "WebAuthn 등록 사용자에게 TOTP 자동 fallback 금지", §1.4.E "counter 역행 시 suspend 대신 즉시 삭제" 등 기각 대안이 본문에서 부활하지 않음.

### 2. 합의된 원칙 위반 — 위배 없음

- **reranking 직교성 원칙**: graph-rag §0/§4·KB-GR-SR-05 의 "centrality-weighted score blending = graph 내부 1차 정렬", "cross-encoder reranking 과 별개 단계" 가 sibling `9-rag-search.md §3.3` (line 166 의 "rag_mode 와 직교" 명시) 와 양방향 일치. 두 문서가 동일 원칙을 동일 용어로 기술 — 위반 아님.
- **단방향 의존성 원칙(auth 1.4.H)**: `AuthModule → WebAuthnModule` 단방향, `WebAuthnController` host 를 AuthModule 에 두는 결정이 본문(§5 API)·Rationale 에서 일관 유지.
- **Internal Bridge 패턴 원칙(mcp-client §2.3)**: cafe24 §8 / makeshop §8 가 mcp-client §2.3 을 SoT 로 참조하며 동형 기술. 401 자가 회복은 "cafe24 §6.1 refresh+1회 재시도 우선 → 재시도도 401 이면 §8.4 격하, 403 은 즉시 격하" 순서가 cafe24 §8.6·§6.1 과 일치.
- **단일 진실 원칙**: graph-rag §2.2 가 `graph_extraction_status` 5-enum 의 canonical 정의를 data-model §2.12 로 위임. data-model line 363 이 실제로 "의미는 embedding_status 와 동일" 로 동일 정의 보유 — 정의 중복·표류 없음.

### 3. 결정의 무근거 번복 — 위배 없음

- **auth §1.4.I `requiresTotp` 제거**: deprecated 필드 제거를 Rationale 1.4.I 가 새 근거(중복 표현 비용·정합성 규칙 유지부담)와 함께 명문화. 번복에 근거 동반.
- **graph-rag**: 본 스냅샷은 P0~P2 완료 상태 기술이며 과거 결정(자동 chained 트리거, 추출 LLM 분리, mode 2종)을 뒤집지 않고 그대로 구현완료(✅)로 반영. 근거 없는 reversal 없음.
- payload 의 cross-cutting Rationale 발췌(0-overview, 1-data-model, 2-navigation 등)와 target 3건 사이에 상충하는 결정 번복 없음.

### 4. 암묵적 가정/invariant 충돌 — 위배 없음

- **WebAuthn 복구코드 NULL 화 invariant**: auth §5 (DELETE credentials, "마지막 삭제 시 `WebAuthnService.deleteCredential` 가 NULL 화, DB 트리거 아님") 가 data-model line 66 ("애플리케이션 레이어 책임이며 DB 트리거가 아니다") 와 정확히 일치. 우회 설계 없음.
- **복구코드 풀 분리 invariant**: TOTP/WebAuthn 별도 SHA-256 해시 배열(auth §1.4.1, Rationale 1.4.B) 가 data-model line 65~66 의 두 컬럼 분리와 일치.
- **`Integration.status` enum 4값 invariant**: mcp-client §6.2 의 `skipReason`(lower_snake_case 운영 진단) vs error `code`(UPPER_SNAKE_CASE) 표기 분리가 node-output.md Principle 3.2 및 data-model status_reason snake_case 컨벤션과 정합. enum 확장 없이 가상 신호로 처리하는 통합 도메인 원칙과도 충돌 없음.
- **graph_extraction_status enum invariant**: graph-rag §7 처리흐름(error=in-flight 일시오류 / failed=최종실패)이 data-model line 363 의 동일 의미와 일치.

## Info (비차단 관찰 — 위배 아님)

1. **(graph-rag)** §4.2 SQL 의 recursive CTE `expanded_entities` 가 `centrality_weight(ec.chunk_id)` 함수를 참조하나 본문은 "개념 정의이며 실제 구현은 V022/V023 cast 표현식을 따른다"(line 1030)고 명시 — Rationale 연속성 관점에서 결정 충돌 아님(설계 의도 표현). 정확한 SQL 함수 정의 일치 여부는 cross-spec/coverage checker 소관.
2. **(mcp-client)** §3.3 `cached_capabilities`·§6.2 외부 MCP 진단 표면이 "Planned/미구현" 으로 명시되어 있고 `plan/in-progress/spec-sync-mcp-client-gaps.md` 로 추적 — 미구현을 명시적 Planned 로 둔 것이라 결정 번복·invariant 위반 아님.
3. **(auth)** Rationale 1.4.G(V058 단일 statement 마이그레이션)가 migrations/README.md §1 의 NOT VALID+VALIDATE 2-step 기본 컨벤션의 예외임을 4개 조건 충족 근거와 함께 명문화 — 컨벤션 예외를 근거 동반해 선언한 정상 패턴(무근거 우회 아님). 컨벤션 준수 자체의 형식 판정은 Convention Compliance checker 소관.

## 결론

3개 target spec(`1-auth`, `10-graph-rag`, `11-mcp-client`)의 본문·Rationale 은 자체 Rationale 및 cross-cutting Rationale(rag-search 리랭킹 직교성, cafe24/makeshop Internal Bridge, data-model WebAuthn 풀·status enum invariant)과 충돌 없이 일관된다. 기각 대안의 재도입, 합의 원칙 위반, 무근거 결정 번복, invariant 우회 어느 항목에서도 Critical/Warning 미발견. **구현 착수/spec write 차단 사유 없음.**
