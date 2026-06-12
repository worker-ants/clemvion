# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done`, scope=`spec/5-system/`
검토 대상: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md`
기준 비교 영역: `spec/1-data-model.md`, `spec/conventions/`, `spec/4-nodes/`, `spec/0-overview.md`, `spec/5-system/3-error-handling.md`

---

## 발견사항

### [INFO] `spec/5-system/1-auth.md` §5 API 엔드포인트 표 — `resend-verification` 유효기간 표기 비일치
- **target 위치**: `spec/5-system/1-auth.md` §5, `POST /api/auth/resend-verification` 설명란: "(24h 유효)"
- **충돌 대상**: 같은 문서 §1.1 표 `인증 메일 재발송` 행 설명 (유효기간 언급 없음, throttle 5/min 만 명시)
- **상세**: §5 엔드포인트 표의 `resend-verification` 설명에 "(24h 유효)" 가 추가되어 있으나, §1.1 표에는 해당 유효기간 언급이 없다. `email_verify_expires_at` 의 실제 유효기간이 24h 인지 여부는 `spec/1-data-model.md §2.1 User` 행 설명("이메일 인증 토큰 (24h 유효)")에서 확인된다. 단일 문서 내 섹션 간 정합 문제이며 다른 spec 과 직접 모순은 없다.
- **제안**: §5 엔드포인트 설명의 "24h 유효"가 정확하므로 §1.1 표에도 "24h 유효" 를 동기화하거나, §1.1 이 SoT 라면 §5 에서 해당 언급을 제거하여 일관성 확보.

---

### [INFO] `spec/5-system/1-auth.md` §4.1 Planned 감사 액션 — `model_config.*` 는 `spec/5-system/1-auth.md` 가 아닌 AI 플랫폼 영역 소속
- **target 위치**: `spec/5-system/1-auth.md` §4.1 Planned 표의 `model_config.*` 행
- **충돌 대상**: `spec/1-data-model.md §2.16 ModelConfig`; `spec/0-overview.md §6.1` AI 플랫폼 영역
- **상세**: `model_config.*` 감사 액션은 ModelConfig(chat/embedding/rerank 통합 설정) CRUD 에 대한 감사로, auth_config 와 달리 별도 AI 플랫폼 영역 리소스다. auth.md §4.1 에서 이를 Planned 행으로 정의하는 것은 책임 위치가 적합한지 의문이나, 현재 `spec/data-flow/1-audit.md` 가 ground truth 로 지목되어 있으므로 직접 모순은 아니다. 명명 정합화는 이미 §Rationale 4.1.A 에서 처리됨.
- **제안**: 향후 `model_config.*` 구현 시 해당 감사 액션 정의의 SoT 가 `1-auth.md` 인지 `data-flow/1-audit.md` 인지 명확히 할 것. 현재는 cross-reference 만 추가되어 있어 INFO 수준.

---

### [INFO] `spec/5-system/10-graph-rag.md` §4.3 출력 메타데이터 — `ragSources[]` 의 단일 SoT 크로스 참조 일관성
- **target 위치**: `spec/5-system/10-graph-rag.md` §4.3, `ragSources[]` 항목 스키마 설명
- **충돌 대상**: `spec/5-system/9-rag-search.md §4.1` (SoT 로 명시됨)
- **상세**: graph-rag 문서는 "`ragSources[]` 항목 스키마의 단일 SoT 는 `9-rag-search.md §4.1`" 이라 명시하고 있으며 두 문서가 같은 shape(`documentId`/`documentName`/`chunkId`/`content`/`score`/`origin`)을 기술한다. 본 검토 범위에서 `9-rag-search.md` 가 제공되지 않았으나, graph-rag 내 `content` 필드명(이전 `chunk` 로 혼재 시 수정됨, commit 6757e4d1)이 SoT 와 정합되었음을 확인. 직접 모순 없음.
- **제안**: 이미 정합화 완료. 추가 조치 불필요.

---

### [INFO] `spec/5-system/11-mcp-client.md` §3.1 Internal Bridge 테이블 — `makeshop` 누락
- **target 위치**: `spec/5-system/11-mcp-client.md` §3.1 "Internal Bridge 적용 service_type" 표
- **충돌 대상**: `spec/5-system/11-mcp-client.md` §2.3 본문 ("현재 `cafe24`, `makeshop`"), `spec/1-data-model.md §2.10 Integration` service_type 목록, `spec/0-overview.md §6.1`
- **상세**: §2.3 본문 "적용 service_type: 현재 `cafe24`, `makeshop`" 이라고 언급하나, §3.1 의 "Internal Bridge 적용 service_type" 테이블에는 `cafe24` 행만 있고 `makeshop` 행이 없다. §2.3 내 다른 참조("[Spec MakeShop 노드 §8]")와 spec/0-overview.md §6.1 의 MakeShop 구현 완료 상태도 makeshop Internal Bridge 가 존재함을 확인한다.
- **제안**: `spec/5-system/11-mcp-client.md §3.1` 표에 `makeshop` / `MakeshopMcpToolProvider` / `[Spec MakeShop 노드 §8]` 행 추가로 §2.3 본문·data-model·overview 와 정합 필요. 현재는 INFO 등급이나 불일치가 독자 혼란을 유발할 수 있음.

---

### [INFO] `spec/5-system/1-auth.md` Production fail-closed 가드 — `OAUTH_STUB_MODE`·`LLM_STUB_MODE` 나열, `INTERACTION_JWT_SECRET` 예외 처리
- **target 위치**: `spec/5-system/1-auth.md` Rationale "Production fail-closed 가드" 절
- **충돌 대상**: `spec/5-system/11-mcp-client.md §3.2 MCP_ALLOW_INSECURE_URL` Production fail-closed, `spec/5-system/14-external-interaction-api.md`(범위 밖이나 `INTERACTION_JWT_SECRET` 언급)
- **상세**: auth.md Rationale 가드 설명에 "DI·요청 컨텍스트가 필요하거나(예: `INTERACTION_JWT_SECRET` 생성자 throw)" 로 분리 기준이 기술되어 있고 mcp-client §3.2 에도 동일 패턴(`MCP_ALLOW_INSECURE_URL`) 이 정합 기술됨. `assertProductionConfig` 단일 함수에 응집된다는 설명도 일치. 모순 없음.
- **제안**: 추가 조치 불필요.

---

## 요약

`spec/5-system/` 의 세 주요 문서(`1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`)를 다른 spec 영역 전반과 교차 검토한 결과, 서로 직접 모순되거나 운영을 불가능하게 만드는 CRITICAL·WARNING 수준의 충돌은 발견되지 않았다. 유일하게 주목할 만한 비일치는 `spec/5-system/11-mcp-client.md §3.1` 의 Internal Bridge 테이블에서 `makeshop`(`MakeshopMcpToolProvider`) 행이 누락된 것으로, §2.3 본문·`spec/1-data-model.md §2.10`·`spec/0-overview.md §6.1` 모두 makeshop 구현 완료를 기술하고 있어 명백한 문서 동기화 갭이다. 그 외 발견사항은 모두 단일 문서 내 섹션 간 표기 비일치 또는 크로스 참조 명확화 수준(INFO)이며, 즉각 수정이 필요한 충돌이 아니다. 데이터 모델, API 계약, 요구사항 ID, 상태 머신, RBAC 권한 매트릭스 어느 관점에서도 영역 간 직접 모순은 없다.

---

## 위험도

LOW
