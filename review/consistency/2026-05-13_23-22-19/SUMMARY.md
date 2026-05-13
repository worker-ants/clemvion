# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 위배 없음. 모든 checker에서 spec write 진입 가능 판정.

---

## 전체 위험도
**LOW** — Critical 0건, Warning 8건(일부 중복 제거 후), Info 9건. 모두 spec write 전 문서 보강 또는 표현 수정으로 해소 가능한 수준.

---

## Critical 위배 (BLOCK 사유)

없음

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|------------|-----------|------|
| W1 | Cross-Spec | `Node.type` 컬럼 타입(`Enum`)과 `cafe24` 추가의 마이그레이션 전제가 spec 본문에 미기록 | Draft §1b — `spec/1-data-model.md §2.6` | `Integration.service_type | String`과 타입 일관성 불명확 | `spec/1-data-model.md §2.6` Node.type 컬럼을 `String (개념적 열거)`으로 수정하거나, Rationale에 "backend schema 확인 후 ALTER TYPE 여부 결정" 한 줄 추가 |
| W2 | Cross-Spec | `§4.3.1` `integrationServiceType` hint 단일값 명세와 Draft §10 다중값(`mcp`, `cafe24`) 필터 요구 사이 갭 | Draft §10 — `4-ai-assistant.md §4.3.1` 직후 노트 | `spec/3-workflow-editor/4-ai-assistant.md §4.3.1` 단수 표현 | `§4.3.1`을 "hint가 배열이면 `IN (...)` 쿼리"로 확장하고, AI Agent 노드 meta의 `mcpServers.integrationServiceType`을 `['mcp', 'cafe24']`로 명시. 또는 `mcpServiceTypes` 별도 속성 도입 |
| W3 | Rationale Continuity | `process-level mutex` 서술이 멀티 인스턴스 아키텍처 invariant와 표현 충돌 | `4-cafe24.md` §4.1 Rate Limit 처리, §8.4 Rate Limit 공유 | `spec/1-data-model.md ## Rationale` — 멀티 인스턴스 전제 명시 | "동일 **프로세스 인스턴스 내** Integration 호출 직렬화"로 범위 한정. 분산 보장이 필요하면 Redis 기반 조율 방안을 Rationale에 명기 |
| W4 | Convention Compliance | `spec/conventions/node-output.md` Principle 3.3 의무 에러 포트 노드 목록에 `cafe24` 추가 누락 | Draft 변경 범위 — `node-output.md` 갱신안 없음 | `spec/conventions/node-output.md` Principle 3.3 목록 | Draft에 §11 신규 추가: Principle 3.3 목록에 `` `cafe24` `` 삽입 |
| W5 | Convention Compliance | `cafe24-api-metadata.md §5` `callTool(name, args)`의 `name`이 bare id인지 prefixed id인지 미명시 | `cafe24-api-metadata.md §5` MCP Bridge 매핑 서술 | `4-cafe24.md §8.1` MCP 도구 이름 표 (`mcp_<sid>__product_list`) | `callTool` 주석에 "name은 bare id (`product_list`). MCP Client 레이어가 prefix를 붙임" 한 줄 추가. `enabledTools` 배열 동일 형식 참조 명시 |
| W6 | Naming Collision | `credentials.user_id`가 내부 `User.id`(UUID)와 혼동 유발 | Cafe24 credentials JSONB `user_id: string` | `IntegrationUsageLog` 등 서비스 레이어의 `userId` (내부 UUID) 관용 표현 | `credentials.user_id` → `credentials.cafe24_operator_id` 또는 `credentials.mall_user_id`로 개명. Cafe24 API 응답 `user_id` key와는 매핑 레이어에서 명시 변환 |
| W7 | Naming Collision | `resource='application'`이 OAuth `app_type` 개념과 혼동 위험 | Cafe24 노드 config `resource` enum 중 `application` 값 | credentials `app_type: 'public' \| 'private'` 및 시스템 전반 "application" 관용 의미 | 식별자 변경 불가(공식 API 카테고리명). 초안 주석("※ Cafe24 앱 관리 API — OAuth 앱 등록과 무관")을 `spec/conventions/cafe24-api-metadata.md §1` `application.ts` 행에도 동일 명시 |
| W8 | Plan Coherence | `ai-agent-tool-connection-rewrite` plan과 동일 spec 파일 2종(`1-ai-agent.md`, `0-common.md`) 미래 편집 충돌 가능성 | Draft §8·§9 — MCP 관련 절 수정 | `plan/in-progress/ai-agent-tool-connection-rewrite.md` §3 | 현재 차단 없음. `ai-agent-tool-connection-rewrite` spec 착수 시 MCP·Tool Area 섹션이 이미 분리 편집된 상태임을 인지 후 진행 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | `spec/0-overview.md §6.3` 로드맵에 Cafe24 미등재 | spec write 후 overview 미반영 | spec write 시 §6.3에 `Cafe24 통합 — 워크플로 노드 + AI Agent Internal MCP Bridge` 항목 추가 |
| I2 | Cross-Spec | Internal Bridge와 `credentials.cached_capabilities` 관계 미명시 | Draft §7 `11-mcp-client.md §2.3` | §2.3 또는 §3.1에 "cached_capabilities는 외부 HTTP transport 전용, Internal Bridge 미적용" 한 줄 추가 |
| I3 | Rationale Continuity | `IMcpClient` 인터페이스 spec 정의 위치 미참조 | `4-cafe24.md §8` 및 Rationale §9.2 | `spec/5-system/11-mcp-client.md §2.3`에 `IMcpClient` 최소 시그니처 표 추가하거나 backend 코드 경로를 source-of-truth로 명시 |
| I4 | Rationale Continuity | `mall_id` SSRF 위임의 구체적 validation 규칙 미명시 | `spec/2-navigation/4-integration.md §5.8` credentials JSONB, `4-cafe24.md §5.8` pre-flight | `mall_id` 행에 validation rule 추가 (예: 소문자 영숫자·하이픈, 3~50자). pre-flight throw 표에 형식 검증 실패 케이스 추가 |
| I5 | Convention Compliance | `4-cafe24.md §5` 케이스 헤딩 형식 (`5.1 Case:`) — 기존 노드 spec과 일치 여부 미확인 | `4-cafe24.md §5.1, §5.3, §5.8` | `1-http-request.md`, `2-database-query.md`, `3-send-email.md` §5 헤딩 형식 확인 후 통일 |
| I6 | Convention Compliance | `cafe24-api-metadata.md §5` MCP prefix 레이어 경계 아키텍처 메모 권장 | `cafe24-api-metadata.md §5` 도입부 | §5 진입부에 "본 함수 반환 name은 bare tool id, MCP Client가 `mcp_<sid>__` prefix 부여" 한 문장 추가 |
| I7 | Naming Collision | `Cafe24OperationMetadata.category: 'read' \| 'write'`와 `Node.category: Enum` 필드명 중복 | `Cafe24OperationMetadata.category` | `Cafe24OperationMetadata.category` → `scopeType: 'read' \| 'write'`로 변경 검토 (Cafe24 scope `mall.read_*`/`mall.write_*`와 의미 연결 명확) |
| I8 | Naming Collision | `credentials.expires_at`와 `Integration.token_expires_at` 동기화 방향 미명시 | Cafe24 credentials JSONB `expires_at` | `spec/2-navigation/4-integration.md §10.5`에 "토큰 갱신 성공 시 두 필드를 동일 트랜잭션 내 원자 갱신" 명시 추가 |
| I9 | Plan Coherence | `0-unimplemented-overview.md` Cafe24 구현 항목 미반영 | spec write 완료 후 생성될 implementation plan | Phase 3 spec write + plan complete 이동 후 implementation plan 생성 시 §A 표와 plan 목록 함께 갱신 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | Node.type Enum 마이그레이션 전제 미기록(W1), integrationServiceType 다중값 갭(W2) |
| Rationale Continuity | LOW | process-level mutex 멀티 인스턴스 표현 충돌(W3) — 표현 수정으로 해소 가능 |
| Convention Compliance | LOW | Principle 3.3 목록 `cafe24` 누락(W4), callTool name 경계 미명시(W5) |
| Plan Coherence | LOW | ai-agent-tool-connection-rewrite·node-output-redesign 미래 편집 충돌 가능성 — 즉각 차단 사유 없음 |
| Naming Collision | LOW | `credentials.user_id` 혼동(W6) — 개명 권장, `resource='application'` 혼동(W7) — 주석 보강 |

---

## 권장 조치사항

> BLOCK 없음. 아래 순서대로 spec draft를 보강한 뒤 Phase 3 spec write 진입을 권장.

**즉시 반영 권장 (spec write 전)**

1. **[W6] `credentials.user_id` 개명** — `credentials.cafe24_operator_id`로 변경. 구현 단계 버그 예방 효과가 가장 크다.
2. **[W4] Draft §11 추가** — `spec/conventions/node-output.md` Principle 3.3 목록에 `cafe24` 삽입하는 변경 섹션 신설.
3. **[W2] `integrationServiceType` 다중값 지원 명세** — `spec/3-workflow-editor/4-ai-assistant.md §4.3.1` 확장 또는 `mcpServiceTypes` 속성 도입 중 하나를 선택해 draft §10에 명시.
4. **[W3] process-level mutex 표현 수정** — `4-cafe24.md §4.1·§8.4`에서 "동일 프로세스 인스턴스 내"로 범위 한정.
5. **[W5] callTool bare name 명시** — `cafe24-api-metadata.md §5` 주석에 name 파라미터 형식 한 줄 추가.
6. **[W1] Node.type 마이그레이션 전제 기록** — `spec/1-data-model.md §2.6` 본문 또는 Rationale에 "backend schema 확인 후 ALTER TYPE 여부 결정" 추가.

**spec write 시 함께 처리**

7. **[I1]** `spec/0-overview.md §6.3` 로드맵에 Cafe24 항목 추가.
8. **[I4]** `mall_id` validation rule을 `spec/2-navigation/4-integration.md §5.8`과 `4-cafe24.md §5.8`에 추가.
9. **[W7]** `spec/conventions/cafe24-api-metadata.md §1` `application.ts` 행에 혼동 방지 주석 명시.

**구현 착수 전 처리 가능 (INFO)**

10. **[I7]** `Cafe24OperationMetadata.category` → `scopeType` 개명 검토.
11. **[I8]** `§10.5` 원자 갱신 명세 추가.
12. **[I3]** `IMcpClient` 정의 위치 명시 (spec 또는 backend 경로 참조).