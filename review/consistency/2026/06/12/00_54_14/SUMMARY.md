# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다

## 전체 위험도
**MEDIUM** — Critical 1건(ragSources 필드명 충돌)과 다수 Warning 이 발견됨. spec 간 런타임 파싱 오류 가능성 존재

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Naming Collision | `ragSources[]` 텍스트 필드명 `"chunk"` vs canonical `"content"` — 동일 JSON 구조를 참조하는 클라이언트/서버가 다른 필드명을 기대하면 런타임 파싱 오류 또는 References UI 텍스트 미표시 발생 | `spec/5-system/10-graph-rag.md §4.3` 출력 메타데이터 예시 | `spec/5-system/9-rag-search.md §4.1` (canonical SoT), `spec/4-nodes/3-ai/1-ai-agent.md` — 모두 `"content"` 사용 | `10-graph-rag.md §4.3` 의 `"chunk"` → `"content"` 로 수정. `ragSources` 스키마의 단일 SoT 는 `9-rag-search.md §4.1` 유지, graph 전용 확장 필드는 cross-reference 로 처리 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `spec/5-system/1-auth.md §5` API 표에서 `GET /api/auth/2fa/webauthn/availability` 응답이 `{ enabled: boolean }` — `data` 봉투 누락 | `spec/5-system/1-auth.md §5` 해당 행 | `spec/5-system/2-api-convention.md §5.1` (TransformInterceptor `{data:…}` 래핑), 동문서 §1.4.3 (`{ data: { enabled: boolean } }` 로 정확히 기술됨) | §5 표의 해당 행을 `{ data: { enabled: boolean } }` 으로 수정 |
| 2 | Convention Compliance | `spec/5-system/1-auth.md §4.1` Planned 감사 액션 `password_change`, `2fa_enable/disable` 이 `<resource>.<verb>` dot-prefix 미준수 — 구현 시 규약 위반 액션이 코드베이스에 진입 위험 | `spec/5-system/1-auth.md §4.1` "Planned" 표 | 동문서 §4.1 자체의 Action naming 규약 (`<resource>.<verb>` 필수) | `password_change` → `auth.password_changed`, `2fa_enable/disable` → `auth.2fa_enabled/2fa_disabled` 로 spec 선행 수정 |
| 3 | Naming Collision | `document:graph_error` 이벤트가 `10-graph-rag.md §6` 에서 dead-declared(미emit)임에도 `5-knowledge-base.md` 182행 · `6-websocket-protocol.md` 723행에 여전히 유효 이벤트로 열거됨 — 클라이언트 데드 핸들러 부착 위험 | `spec/2-navigation/5-knowledge-base.md §182`, `spec/5-system/6-websocket-protocol.md §723` | `spec/5-system/10-graph-rag.md §6` (dead-declared 명시), `spec/data-flow/6-knowledge-base.md §289` (이미 제거 반영) | 두 문서의 `_error` 를 목록에서 제거하거나 "(dead-declared, 미emit)" 주석 추가 |
| 4 | Plan Coherence | `spec/5-system/1-auth.md §5` API 표에 `POST /api/auth-configs/:id/reveal` 행 누락 — 구현(PR #547 merged) 완료 후에도 spec 미반영 | `spec/5-system/1-auth.md §5` | `plan/in-progress/auth-config-webhook-followups.md §3` (project-planner 위임 목록에 이미 열거) | `auth-config-webhook-followups.md §3` 의 project-planner 위임 항목으로 해당 행 추가 처리 |
| 5 | Plan Coherence | `spec/5-system/1-auth.md §Rationale "Production fail-closed 가드"` 대상 목록에 `OAUTH_STUB_MODE` · `LLM_STUB_MODE` 불릿 누락 — 구현 PR #539 MERGED 후 spec 산문 미반영 | `spec/5-system/1-auth.md §Rationale "Production fail-closed 가드"` bullet 목록 | `plan/in-progress/spec-fix-prod-guards-prose.md §SPEC-DRIFT` (두 불릿 추가 요구 명시) | 신규 worktree 에서 해당 두 불릿을 spec 에 추가; plan 의 `worktree:` 필드도 갱신 |
| 6 | Plan Coherence | `spec/5-system/12-webhook.md` 에 IP 추출 정책(CF-Connecting-IP → X-Forwarded-For → req.ip) 및 ip_whitelist fail-closed 동작 미명시 — 구현 완료 후 spec 누락 | `spec/5-system/12-webhook.md` | `plan/in-progress/auth-config-webhook-followups.md §3` (project-planner 위임 목록) | `12-webhook.md` 에 IP 추출 정책 명시 또는 `1-auth.md §2.3` cross-reference 추가 |
| 7 | Cross-Spec | `spec/5-system/1-auth.md §3.2` Integration (Org) 권한 매트릭스가 `spec/0-overview.md §6.1` "라우트 가드 floor vs 도메인 RBAC 2-layer" 설명 없이 기재 — Editor=R 이지만 "Editor+ 라우트 가드 floor" 설명과 표면적 긴장 유발 | `spec/5-system/1-auth.md §3.2` Integration (Org) 행 | `spec/0-overview.md §6.1`, `spec/2-navigation/4-integration.md §8` (Admin+ 제약 SoT) | §3.2 해당 행 하단에 "Editor 는 라우트 가드 floor이지만 Organization scope 생성·수정·삭제는 Admin+ 필요 — `4-integration.md §8` 참조" 각주 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/5-system/1-auth.md §1.1` `POST /auth/resend-verification` — `/api/` prefix 누락 오기 (다른 모든 엔드포인트 및 타 spec 문서는 `/api/` 포함), §5 엔드포인트 표에 해당 행 자체 누락 | `spec/5-system/1-auth.md §1.1`, §5 | `POST /api/auth/resend-verification` 으로 수정, §5 표에 행 추가 |
| 2 | Cross-Spec | MCP Integration 기본 scope `organization` 이 `spec/5-system/11-mcp-client.md §3.1` 에만 명시 — UI 구현의 기본 선택 동작 기술 누락 | `spec/2-navigation/4-integration.md §5.6` MCP Server 등록 UI 폼 설명 | §5.6 에 "scope 는 기본 `organization` (Personal 선택 불가)" 한 줄 추가 |
| 3 | Cross-Spec | `spec/5-system/10-graph-rag.md §2.2` 의 `graph_extraction_status` 5종 enum 값 재기재 — `spec/1-data-model.md §2.12` canonical SoT 와 현재 일치하나 향후 drift 위험 | `spec/5-system/10-graph-rag.md §2.2` | 값 열거 제거, "canonical 정의는 `spec/1-data-model.md §2.12` 참조" 만 유지 |
| 4 | Cross-Spec | `document:graph_error` dead-declared 사실이 `10-graph-rag.md §6` 과 `8-embedding-pipeline.md §8` 양쪽에 기술 — 동기화 부담 | `spec/5-system/8-embedding-pipeline.md §8` | `8-embedding-pipeline.md §8` 에서 `10-graph-rag.md §6` 참조 링크로 대체 |
| 5 | Rationale Continuity | `spec/5-system/11-mcp-client.md §3.2` 에 `auth_type='none'` 이 SSRF 면제를 의미하지 않음을 미명시 — `http-request §8.2` "전 인증 방식 공통 SSRF 가드" 원칙의 MCP 도메인 문서화 갭 | `spec/5-system/11-mcp-client.md §3.2` SSRF 정책 callout | callout 에 "`auth_type` 값과 무관하게 SSRF 가드 적용 — `auth_type='none'` 은 자격증명 불요이며 SSRF 면제 아님" 한 줄 추가 |
| 6 | Convention Compliance | `spec/5-system/1-auth.md` 에 `## Overview` 섹션 부재 — 문서 구조 규약(Overview / 본문 / Rationale 3섹션) 미준수 | `spec/5-system/1-auth.md` 전체 구조 | 문서 상단에 `## Overview` 섹션 추가 또는 규약에 "cross-reference blockquote 로 대체 가능" 예외 명시 |
| 7 | Convention Compliance | `spec/5-system/10-graph-rag.md` 에 `## Overview (제품 정의)` 와 `## 1. 개요` 이중 정의 — 3섹션 경계 모호 | `spec/5-system/10-graph-rag.md` 상단 두 섹션 | `## Overview` 를 제품 요약만 담도록 축소, 기술 결정·요구사항·Phase Plan 은 본문으로 이동 |
| 8 | Convention Compliance | `spec/5-system/11-mcp-client.md §6.2` `meta.mcpDiagnostics` 가 `spec/conventions/node-output.md Principle 2` 허용 필드 열거에 미포함 | `spec/conventions/node-output.md Principle 2` LLM 계열 허용 필드 목록 | `meta.mcpDiagnostics?` 를 허용 필드로 명시 추가 |
| 9 | Plan Coherence | `spec-errcode-catalog-a09758` 워크트리가 `spec/5-system/3-error-handling.md` 를 ACTIVE 수정 중 (PR 미오픈) — 동일 파일 편집 직렬화 필요 | `spec/5-system/3-error-handling.md §1.4`, `§3.2` | 이 워크트리 PR 먼저 머지 후 동일 파일 추가 편집 착수 |
| 10 | Plan Coherence | `plan/in-progress/spec-sync-mcp-client-gaps.md` 의 `worktree: spec-sync-audit` 가 PR #440/#443 MERGED 후 stale 참조 | `plan/in-progress/spec-sync-mcp-client-gaps.md` `worktree:` 필드 | `worktree:` 필드를 실제 착수 worktree 또는 `(unstarted)` 로 정정 |
| 11 | Plan Coherence | `plan/in-progress/security-backlog-invitation-token-hash.md` 의 "결정 여부 명시" 태스크가 이미 `spec §1.5.D` 에 "raw 저장 유지" 로 명시돼 있어 사실상 완료 상태 — 의도 불명확 | `plan/in-progress/security-backlog-invitation-token-hash.md` | "§1.5.D 결정 이미 spec 에 명시됨 — 착수는 해시 저장 전환 결정 시에만 필요" 주석 추가 |
| 12 | Naming Collision | `10-graph-rag.md §6` WebSocket 채널 표기 `kb:{documentId}` vs `8-embedding-pipeline.md §8` `` `kb:${documentId}` `` (템플릿 리터럴 스타일 혼용) | `spec/5-system/8-embedding-pipeline.md §8` | `kb:{documentId}` plain placeholder 표기로 통일, 템플릿 리터럴은 코드 예시 전용 제한 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | CRITICAL 없음. WARNING 1건(Integration Org RBAC 2-layer 미기술). INFO 3건(API prefix 오기, MCP scope 누락, enum 재기재 drift) |
| Rationale Continuity | LOW | CRITICAL 없음. INFO 1건(`auth_type='none'` SSRF 면제 오해 방지 문서화 갭) |
| Convention Compliance | MEDIUM | CRITICAL 없음. WARNING 3건(API 응답 봉투 불일치, Planned 감사 액션 dot-prefix 미준수, Overview 섹션 부재). INFO 2건 |
| Plan Coherence | LOW | CRITICAL 없음. WARNING 3건(reveal 엔드포인트 누락, prod-guards SPEC-DRIFT 미반영, IP 정책 누락). INFO 4건. stale worktree 5건 정리 권장 |
| Naming Collision | MEDIUM | **CRITICAL 1건** (`ragSources "chunk"` vs `"content"` 런타임 충돌). WARNING 2건(`graph_error` dead-declared 불일치, resend-verification prefix 혼용). INFO 2건 |

## 권장 조치사항

1. **(BLOCK 해소 즉시)** `spec/5-system/10-graph-rag.md §4.3` 의 `ragSources[]` 텍스트 필드 `"chunk"` → `"content"` 로 수정 — canonical SoT `9-rag-search.md §4.1` 과 일치시킴
2. `spec/5-system/1-auth.md §5` API 표의 `/api/auth/2fa/webauthn/availability` 응답 봉투를 `{ data: { enabled: boolean } }` 으로 수정
3. `spec/5-system/1-auth.md §4.1` Planned 감사 액션 `password_change` → `auth.password_changed`, `2fa_enable/disable` → `auth.2fa_enabled/2fa_disabled` 로 dot-prefix 규약 준수 수정
4. `spec/2-navigation/5-knowledge-base.md §182` 및 `spec/5-system/6-websocket-protocol.md §723` 에서 `document:graph_error` 를 제거하거나 "(dead-declared, 미emit)" 주석 추가
5. `plan/in-progress/auth-config-webhook-followups.md §3` project-planner 위임 항목 처리: (a) `spec/5-system/1-auth.md §5` 에 reveal 엔드포인트 행 추가, (b) `spec/5-system/12-webhook.md` IP 추출 정책 명시
6. `spec/5-system/1-auth.md §Rationale "Production fail-closed 가드"` 목록에 `OAUTH_STUB_MODE` · `LLM_STUB_MODE` 불릿 추가 (신규 worktree 필요, `spec-fix-prod-guards-prose.md` plan 의 `worktree:` 필드도 갱신)
7. `spec/5-system/1-auth.md §3.2` Integration (Org) 행 하단에 "라우트 가드 floor vs 도메인 RBAC 2-layer" 설명 각주 추가
8. `spec/5-system/11-mcp-client.md §3.2` SSRF callout 에 `auth_type='none'` 이 SSRF 면제가 아님 명시
9. `spec/5-system/1-auth.md §1.1` `POST /auth/resend-verification` → `POST /api/auth/resend-verification` 수정, §5 에 행 추가
10. stale worktree 5건(`pr4b-kb-embedding-retire`, `spec-sync-audit`, `prod-fail-closed-guards`, `auth-config-audit`, `audit-coverage-naming`) 정리: `./cleanup-worktree-all.sh --yes --force` 실행 권장