# Rationale 연속성 검토 결과

검토 범위: `spec/5-system/` (impl-prep 모드)
대상 파일: `1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`, `12-webhook.md`, `13-replay-rerun.md`

---

## 발견사항

### 1. INFO — 초대 토큰 저장 방식: Rationale 에 해시 저장 기각 기록 부재

- **target 위치**: `spec/5-system/1-auth.md` §1.5.1 "저장 형태" 행 — "DB 에는 토큰 자체를 저장 (`WorkspaceInvitation.token`, UNIQUE)"
- **과거 결정 출처**: `spec/5-system/1-auth.md` 의 `## Rationale` §1.5.A~C 는 (a) 이메일 일치 강제, (b) 시스템 SMTP 사용, (c) 7일 만료 세 가지 결정만 기록한다. 토큰을 해시 없이 평문(raw value)으로 DB에 저장하기로 한 결정에 대한 Rationale 항목이 없다.
- **상세**: 보안 민감 토큰(비밀번호 재설정, 초대 등)의 저장 방식은 "평문 저장 vs bcrypt/SHA-256 해시 저장" 두 대안이 공식적으로 검토되는 설계 결정점이다. 사양은 평문 저장을 선택했지만, 그 이유(예: URL lookup 성능, 토큰 길이가 48바이트 random 이라 노출 리스크를 허용 수준으로 판단)가 Rationale 에 기재되어 있지 않다. 나중에 "왜 bcrypt 를 쓰지 않았느냐"는 질문이 나올 때 대답을 추적할 수 없다.
- **제안**: `## Rationale §1.5.D — 초대 토큰 평문 저장` 항목 추가. 예: "48바이트 cryptographically random token 은 URL 직접 lookup 으로 O(1) 조회가 가능하고, bcrypt 해시 대비 DB UNIQUE 제약 적용이 간단하다. 토큰 자체의 엔트로피(384-bit)가 충분해 DB 침해 시의 추가 위협이 제한적이라고 판단했다."

---

### 2. INFO — Graph RAG: KB 모드 사후 변경 기각 이유가 두 곳에 분산 기재

- **target 위치**: `spec/5-system/10-graph-rag.md` §2.1 KnowledgeBase 추가 컬럼 표 (`rag_mode` 행, "생성 시에만 결정, 사후 변경 불가"), §4 기술 결정 사항 표 ("KB 모드 선택: 사후 변경의 마이그레이션·UX 부담이 점진 도입의 가치를 넘어섬"), `## Rationale §6 사후 결정 (2026-05-02)` 표 항목 6
- **과거 결정 출처**: `spec/5-system/10-graph-rag.md § Rationale` "사후 변경 불가" 근거
- **상세**: 기각 근거("vector→graph 전환 시 기존 chunk 에 대한 추출 트리거 필요, 마이그레이션 무거움; graph→vector 는 entity/relation 폐기; 새 KB 가 더 단순")가 기술 결정 표(§4), Overview §2.2 비목표 표, Rationale 메모 세 곳에 분산 서술되어 있다. 결정 자체는 일관되나 근거를 한 곳에서 찾기 어렵다.
- **제안**: `## Rationale` 의 해당 메모 항목(결정 근거 요약 표)에 §4 및 §2.2 를 교차 참조(cross-reference) 링크로 통합. 또는 §4 표의 "근거" 컬럼에서 Rationale 섹션으로 앵커 링크를 추가.

---

### 3. INFO — MCP Client: stdio 미지원 사유가 Rationale 섹션이 아닌 본문에만 기재

- **target 위치**: `spec/5-system/11-mcp-client.md` §2.2 "stdio 미지원 사유" (본문 섹션으로 기재됨)
- **과거 결정 출처**: `spec/5-system/11-mcp-client.md` 에는 `## Rationale` 섹션 자체가 없음
- **상세**: stdio 미지원("멀티테넌트 SaaS 프로세스·보안 격리 부담, 임의 명령 실행 권한 노출 위험, 워크스페이스 공용 모델 부정합")은 명시적으로 기각된 대안이다. 이 내용이 §2.2 에 본문 설명으로 들어가 있는데, spec 컨벤션("폐기된 대안은 `## Rationale` 에 기록")에 따르면 Rationale 섹션에 있어야 한다. 본 spec 에 Rationale 섹션 자체가 부재하다.
- **제안**: `spec/5-system/11-mcp-client.md` 끝에 `## Rationale` 섹션을 신설하고, (a) stdio 미지원 근거, (b) WebSocket transport 미포함 근거, (c) 도구 평탄화(세 capability 를 단일 LLM tool call 인터페이스로 통합) 선택 이유 를 이전. §2.2 본문은 "사유는 §Rationale 참조" 한 줄로 대체하거나 그대로 두되 Rationale 에 병행 기록.

---

### 4. INFO — Webhook: 향후 암호화 계획이 "TODO" 형태로 남아 있음

- **target 위치**: `spec/5-system/12-webhook.md` §8 보안 고려사항 표 — "비밀 키 저장: `config.secret`, `config.bearerToken`은 DB에 저장 (향후 암호화 적용)"
- **과거 결정 출처**: 없음 — Webhook spec 에는 `## Rationale` 섹션이 없다
- **상세**: `(향후 암호화 적용)` 표현은 현재 평문 저장을 인식하고 있지만 암호화 미구현 이유나 적용 시점이 기록되어 있지 않다. Integration credentials 의 AES-256-GCM 암호화 정책(`spec/5-system/11-mcp-client.md §3.2`, `spec/2-navigation/4-integration.md §5.6`)과 Webhook secret 의 미암호화 사이에 불일치가 존재하며, 그 결정 근거가 없다. 구현자가 "Integration 은 암호화하는데 Webhook secret 은 왜 안 하지?" 라고 물을 때 답이 없는 상태.
- **제안**: `## Rationale` 섹션 신설(또는 §8 에 각주) 로 "현재 평문 저장 이유 + 향후 암호화 전환 조건"을 기록. 또는 Integration credentials 암호화 정책을 Webhook 에도 즉시 확장하고 spec 에 반영.

---

### 5. WARNING — Re-run: `dry_run` 컬럼 추가를 "v2+ 검토"로 연기했으나 Rationale 미기재

- **target 위치**: `spec/5-system/13-replay-rerun.md` §9.2 "NodeExecution dry-run 표기" — "부모 Execution row 자체에 `dry_run: boolean` 컬럼을 추가하는 것은 v2+ 에서 검토 — v1 은 NodeExecution 마다의 `_dryRun` 만으로도 충분하고..."
- **과거 결정 출처**: `spec/5-system/13-replay-rerun.md` §5 "결정 사항 (사용자 확정)" 표, §Rationale(본문 참조 언급만 있고 Rationale 섹션이 존재하나 payload 에서 잘려 확인 불가)
- **상세**: `dry_run: boolean` 컬럼을 Execution 수준에 두지 않고 NodeExecution 의 `outputData._dryRun` 로 대신하는 결정은, Execution 단위 필터링(`WHERE dry_run = true`)이 불가능해지는 trade-off 를 수반한다. "v1 은 NodeExecution 집계로 도출 가능"이라는 근거가 §9.2 본문에 인라인으로만 적혀 있다. 이 결정이 spec 의 `## Rationale` 에 항목으로 올라가 있지 않으면, 향후 구현자가 "편의를 위해" 컬럼을 슬며시 추가할 때 이전 번복 근거를 찾을 수 없다.
- **제안**: `## Rationale` 에 "E3-variant — dry_run Execution 컬럼 v2+ 연기" 항목 추가. 내용: (a) v1 에서 단일 NodeExecution `_dryRun` 키로 식별하는 이유, (b) Execution 수준 컬럼 부재로 인한 쿼리 제약, (c) v2 에서 도입 조건. 이 결정이 이미 `§5 결정 사항` 표에 부분적으로 나타나 있다면 해당 표에서 Rationale 섹션으로 앵커 참조.

---

### 6. WARNING — Re-run: Multi-turn 입력 자동 재사용(D2) 기각 이유가 Rationale 섹션에 부재

- **target 위치**: `spec/5-system/13-replay-rerun.md` §RR-PL-04 끝 "이유는 §Rationale 참조 — multi-turn 입력 재사용 (D2) 은 별도 plan 으로 분리"
- **과거 결정 출처**: `spec/5-system/13-replay-rerun.md` `## Rationale` (payload 크기 제한으로 전체 내용 미확인)
- **상세**: §RR-PL-04 본문이 "이유는 §Rationale 참조"로 명시 위임하고 있다. 해당 Rationale 내용이 실제로 존재하고 D2 기각 이유(예: 사용자 응답 재현의 결정론적 보장 어려움, UX 오해 위험 등)를 설명하는지 확인이 필요하다. 만약 Rationale 섹션이 D2 를 언급하지 않는다면, 본문의 위임이 dangling reference 가 된다.
- **제안**: `spec/5-system/13-replay-rerun.md` 의 `## Rationale` 섹션에서 D2 항목("multi-turn 입력 자동 재사용 기각 이유")을 직접 확인한다. 없으면 "D2 기각 — multi-turn 사용자 응답 자동 재사용의 UX 결정론 문제" 항목을 명시 추가. 있으면 §RR-PL-04 에 해당 Rationale 앵커(`#d2-multi-turn-자동-재사용-기각` 등) 링크를 추가.

---

### 7. WARNING — MCP Client: Internal Bridge 서비스 확장 화이트리스트 정책이 Rationale 없이 암묵적으로 결정됨

- **target 위치**: `spec/5-system/11-mcp-client.md` §3.1 표 "Internal Bridge 적용 service_type (현재): cafe24"
- **과거 결정 출처**: MCP spec 에 Rationale 섹션 없음. 연관 spec `spec/4-nodes/4-integration/4-cafe24.md` 및 `spec/conventions/cafe24-api-metadata.md`
- **상세**: "현재 `cafe24` — 향후 first-party 통합(예: Shopify, Naver Smartstore)이 같은 패턴 사용 가능"이라고 기재되어 있으나, Internal Bridge 대상이 되는 service_type 을 누가 어떤 기준으로 결정하는지(whitelist 관리 주체, 기준, 승인 프로세스)가 정의되어 있지 않다. §12 확장 포인트에 "서비스 타입 화이트리스트(§3.1)에 추가"라고만 되어 있어, 구현자가 임의로 whitelist 를 확장할 수 있는 구조다.
- **제안**: Rationale 섹션에 "Internal Bridge 대상 service_type 결정 원칙" 항목 추가. 예: "first-party Integration 이 (a) 외부 HTTP fetch 없이 in-process 로 완결 가능하고, (b) 동일 Integration 이 workflow 노드와 AI Agent 양쪽에서 사용되며, (c) 도구 목록이 정적 메타데이터 테이블로 관리 가능한 경우 Internal Bridge 채택". 기준이 명문화되지 않으면 Shopify/Naver Smartstore 추가 시 동일한 아키텍처 논쟁이 반복된다.

---

## 요약

`spec/5-system/` 의 다섯 문서를 Rationale 연속성 관점에서 검토한 결과, **명시적으로 기각된 대안의 재도입이나 합의된 invariant 의 직접 위반은 발견되지 않았다**. 주요 설계 결정(KB 모드 불변, 이메일 일치 강제, 시스템 SMTP 단일 채널, stdio 미지원, Re-run 전체 워크플로 단위 등)은 모두 기존 Rationale 에 부합하거나 새 Rationale 를 동반하고 있다. 다만 **MCP Client spec 의 Rationale 섹션 부재**, **Webhook spec 의 Rationale 섹션 부재**, **Re-run spec 의 일부 결정이 Rationale 에 명시적으로 기록되지 않았거나 dangling reference 상태**, **Webhook secret 의 미암호화 결정이 Integration 암호화 정책과의 불일치를 설명하는 Rationale 가 없는 것** 이 WARNING 수준의 공백으로 남아 있다. INFO 항목들은 문서 정합성·추적 가능성 개선 제안으로, 구현 차단 수준은 아니다.

---

## 위험도

LOW
