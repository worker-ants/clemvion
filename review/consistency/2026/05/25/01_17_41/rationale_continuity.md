# Rationale 연속성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep)
검토 대상: `spec/5-system/` 전체 (1-auth.md / 10-graph-rag.md / 11-mcp-client.md 포함)

---

## 발견사항

### [INFO] 1-auth.md — 1.4.H 컨트롤러 host 위치와 단방향 의존성 원칙

- **target 위치**: `spec/5-system/1-auth.md §1.4.H`, 본문 §5 엔드포인트 표
- **과거 결정 출처**: `spec/5-system/1-auth.md ## Rationale §1.4.H`
- **상세**: Rationale 1.4.H 는 `WebAuthnController` 파일을 `webauthn/` 폴더에 두되 module 등록은 AuthModule 의 `controllers` 배열로 한다고 명시한다. 이 결정은 `WebAuthnModule → AuthModule` 역방향 의존성 차단을 위한 것이다. 본문 §5 엔드포인트 표는 WebAuthn 엔드포인트들을 정상 열거하고 있지만, AuthModule controller 배열 등록이라는 모듈 설계 선택이 §5 표 어디에도 cross-reference 되지 않아, 구현자가 §5 만 보면 어느 module 의 controller 배열에 등록해야 하는지 알기 어렵다.
- **제안**: §5 하단 주석 또는 §1.4.4 설명에 "WebAuthnController 는 파일 위치와 무관하게 AuthModule 의 controllers 에 등록 (Rationale 1.4.H)" 한 줄을 추가해 구현 진입점에서 모듈 위치 결정이 보이도록 한다.

---

### [INFO] 1-auth.md — 1.4.3 `WEBAUTHN_ALLOW_FALLBACK` 운영 사용 금지 invariant

- **target 위치**: `spec/5-system/1-auth.md §1.4.3` 환경변수 표
- **과거 결정 출처**: `spec/5-system/1-auth.md ## Rationale §1.4.F`
- **상세**: Rationale 1.4.F 에서 "부팅 거부(A)" 가 명시적으로 기각되고 "기능 비활성(B)" 가 채택됐다. `WEBAUTHN_ALLOW_FALLBACK=1` 의 "운영 사용 금지" 경고는 §1.4.3 표에 "개발·로컬·시연 한정, 운영 사용 금지" 로 명시되어 있다. 기각 이유(잘못된 폴백으로 등록된 데이터가 향후 도메인 결정 시 모두 무효화)가 §1.4.3 본문에는 없고 Rationale 에만 있다. 구현자가 §1.4.3 을 읽으면서 "왜 운영에서 금지인가" 의 이유를 찾으려면 Rationale 를 명시적으로 참조해야 한다.
- **제안**: §1.4.3 의 `WEBAUTHN_ALLOW_FALLBACK` 행 비고에 "(Rationale 1.4.F 참고 — 잘못된 폴백으로 등록된 credential 이 운영 도메인 설정 시 모두 무효화됨)" 한 줄을 추가한다.

---

### [INFO] 11-mcp-client.md — §8.4 단일 실패 status 격하와 integration spec 임계값 논의

- **target 위치**: `spec/5-system/11-mcp-client.md §8.4` 마지막 단락
- **과거 결정 출처**: `spec/2-navigation/4-integration.md §6 상태 전이 표` + Rationale (`call()` 의 401 자동 회복 (2026-05-17))
- **상세**: `spec/2-navigation/4-integration.md` 의 상태 전이는 Cafe24 (refresh_token 보유 provider) 에 대해 "401 → refresh + 1회 재시도 후에도 401 → error(auth_failed)" 라는 단일 실패 정책을 명시한다. `spec/5-system/11-mcp-client.md §8.4` 는 외부 MCP 서버에 대해 단일 401/403 만으로 즉시 status 전환하는 정책을 채택하고 있으며, "임계값(예: 3회 연속) 도입은 반복 실패 비용 증가 vs status 가시성 trade-off 분석 후 별도로 결정" 이라고 명시한다. 이는 기각된 것이 아니라 "현재는 단일 실패 정책, 임계값 도입은 미결" 로 서술되어 있다. 외부 MCP 서버는 refresh_token 이 없어 Cafe24 의 자동 회복 경로가 적용되지 않으며, 이는 integration spec 의 4-integration.md §11 에도 "MCP 는 refresh token 흐름이 없어 임계치 알림 흐름 미적용" 으로 명시되어 있다. 따라서 충돌이 아닌 서로 다른 provider 정책의 적용이지만, 미결 결정이 본문 안에 "별도로 결정" 이라는 형태로 남아있어 향후 혼란 가능성이 있다.
- **제안**: §8.4 의 "임계값 도입은 별도로 결정" 문장을 plan/in-progress 항목으로 명시적으로 추출하거나, 현재 단일 실패 정책의 근거("MCP 는 refresh token 자가 회복 경로가 없어 단일 실패가 토큰 만료·갱신 필요의 즉각 신호")를 한 줄 추가해 미결 결정으로 오독되지 않도록 한다.

---

### [INFO] 10-graph-rag.md — KB 모드 불변 원칙과 재추출 API 간 관계

- **target 위치**: `spec/5-system/10-graph-rag.md §3.1 KB-GR-MD-02`, `§3.4`
- **과거 결정 출처**: `spec/5-system/10-graph-rag.md ## Rationale §사용자 결정 (2026-05-02) 결정 6`
- **상세**: Rationale 에서 "KB 모드 사후 변경 불가" 결정은 vector→graph 전환의 마이그레이션 비용과 graph→vector 의 entity/relation 폐기를 근거로 한다. §3.4 의 `re-extract` API (`POST /api/knowledge-bases/:kbId/re-extract`) 는 "KB 의 모든 entity/relation/chunk_entity 를 삭제 후 모든 문서에 대해 재추출" 한다. 이는 rag_mode 가 이미 `graph` 인 상태에서 그래프 데이터만 재구성하는 것이므로 "모드 사후 변경" 과는 다른 조작이다. 충돌이 아니나, KB 전체 재추출이 rag_mode 를 변경하는 것처럼 오독될 수 있다.
- **제안**: `§3.4` 또는 `§7 에러 처리` 의 `re-extract` 설명에 "본 API 는 rag_mode 가 `graph` 인 KB 에서만 유효하며, rag_mode 자체는 변경하지 않는다 (§3.1 KB-GR-MD-02)" 한 줄을 추가한다.

---

### [INFO] 10-graph-rag.md — 룰 기반 entity 추출 기각과 비-목표 일관성

- **target 위치**: `spec/5-system/10-graph-rag.md §8 비-목표`
- **과거 결정 출처**: `spec/5-system/10-graph-rag.md ## Rationale 비-목표 (이번 PRD 범위 밖)`
- **상세**: Rationale 비-목표에서 "룰 기반 entity 추출 (spaCy 등) — LLM 추출 단일 경로로 시작. 도메인 적응 비용 회피" 가 명시적으로 현재 범위 밖으로 결정됐다. 그러나 §8 비-목표 목록에는 이 항목이 없다. §2.2 의 "범위 밖" 표에도 없다. Rationale 안의 "PRD 범위 밖" 절이 본문의 §8 비-목표와 불완전하게 동기화되어 있다.
- **제안**: §8 비-목표 또는 §2.2 범위 밖 표에 "룰 기반 entity 추출 (spaCy 등) — LLM 추출 단일 경로 유지, 도메인 적응 비용 회피 (Rationale §사용자 결정 6 후속)" 행을 추가한다.

---

## 요약

`spec/5-system/` 내 세 문서(1-auth.md, 10-graph-rag.md, 11-mcp-client.md)에 대한 Rationale 연속성 검토 결과, **명시적으로 기각된 대안이 재도입되거나 합의된 invariant 가 위반되는 CRITICAL 또는 WARNING 수준의 충돌은 발견되지 않았다**. Rationale 1.4.E(credential 삭제 vs suspend), 1.4.D(TOTP 자동 fallback 금지), 1.4.F(부팅 거부 기각), Durable Continuation(Redis pub/sub 폐기, Temporal 이전 기각), Graph RAG(Neo4j·community detection 기각), MCP stdio 미지원 등 주요 기각 결정들은 모두 target 문서에서 그대로 준수되고 있다. 다만 구현자가 spec 본문만 읽을 때 Rationale 의 맥락이 누락되어 혼란을 일으킬 수 있는 INFO 수준의 cross-reference 누락 4건을 발견했으며, 이는 강제 차단 사유가 아닌 보완 제안이다.

---

## 위험도

NONE
