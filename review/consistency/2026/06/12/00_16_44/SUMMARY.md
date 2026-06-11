# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능.

## 전체 위험도
**LOW** — 5개 checker 모두 LOW 판정. Critical 위배 없음. WARNING 7건, INFO 12건.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec | `POST /auth/resend-verification` — `/api` prefix 누락 + §5 엔드포인트 목록 미등재 | `spec/5-system/1-auth.md §1.1` (line 35), `§5` (line 400–427) | `spec/2-navigation/10-auth-flow.md:139,460`, `spec/data-flow/2-auth.md:228,274` | §1.1 경로를 `/api/auth/resend-verification`으로 수정; §5 표에 해당 행 추가 |
| W-2 | Rationale Continuity | Rationale 1.4.D 에서 WebAuthn 복구 코드 사용을 TOTP 전환 경로 대안으로 병기하나, 복구 코드는 해당 세션만 통과시키고 credential 을 삭제하지 않아 실질적 전환 경로가 아님 | `spec/5-system/1-auth.md §1.4.2` (line 108), `## Rationale §1.4.D` (line 495) | (내부 불일치) | Rationale 1.4.D 의 "(혹은 webauthn 복구 코드 사용)" 문구를 "복구 코드는 해당 세션 로그인만 허용, TOTP 영구 전환은 credential 삭제 후 재설정 필요"로 명확화하거나 삭제 |
| W-3 | Convention Compliance | Planned 감사 액션(`workspace.create`, `member.invite` 등)이 integration 과거분사 패턴 vs auth_config 현재형 패턴 중 어느 것을 따르는지 미명시 | `spec/5-system/1-auth.md §4.1` Planned 액션 표 | (내부 규약 선언과의 불명확성) | Planned 액션의 동사 패턴을 명시 선언하거나 현재형 허용 카테고리를 일반화 |
| W-4 | Convention Compliance | `forbidden`/`rate_limited` historical-artifact 의 "초대 API 한정" 범위 제한이 `1-auth.md §1.5.4` 인라인 주석에 불충분하게 기술됨 | `spec/5-system/1-auth.md §1.5.4` | `spec/conventions/error-codes.md §3` | §1.5.4 주석에 "이 예외는 초대 흐름 전용이며 신규 코드에 적용하지 않는다" 명시 추가 |
| W-5 | Plan Coherence | `plan/in-progress/auth-config-webhook-followups.md §3` 의 `POST /api/auth-configs/:id/reveal` 엔드포인트 행이 `1-auth.md §5` 에 미등재 | `spec/5-system/1-auth.md §5 API 엔드포인트` 표 | `plan/in-progress/auth-config-webhook-followups.md §3` | 구현 착수 전 §3 "reveal 행 추가" 완료 여부 확인; 현 scope 에 포함되면 함께 처리 |
| W-6 | Plan Coherence | `spec-fix-prod-guards-prose.md` 추적 항목인 `OAUTH_STUB_MODE`·`LLM_STUB_MODE` 가 `1-auth.md §Rationale "Production fail-closed 가드"` 에 미열거 | `spec/5-system/1-auth.md §Rationale "Production fail-closed 가드"` | `plan/in-progress/spec-fix-prod-guards-prose.md` | 해당 §Rationale 수정 scope 포함 시 두 stub 플래그 추가 및 동기화 의무 1줄 명시 |
| W-7 | Naming Collision | `document:graph_error` 이벤트가 `10-graph-rag.md`·`data-flow/6-knowledge-base.md` 에서 dead-declared 로 명시됐으나 `spec/2-navigation/5-knowledge-base.md:182` 에 여전히 활성 이벤트로 나열 | `spec/2-navigation/5-knowledge-base.md:182` | `spec/5-system/10-graph-rag.md §6`, `spec/data-flow/6-knowledge-base.md:289` | `5-knowledge-base.md:182` 에서 `/ _error` 제거, `data-flow/6-knowledge-base.md` #443 주석 참조 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | 감사 액션 verb 규약 설명이 `1-auth.md §4.1`·`data-flow/1-audit.md` 두 파일에 분산 — 내용 충돌 없으나 drift 위험 | `spec/5-system/1-auth.md §4.1`, `spec/data-flow/1-audit.md` | canonical SoT 1곳 지정, 나머지는 참조 형태로 정리 권장 |
| I-2 | Cross-Spec | `extractionLlmConfigId`(camelCase) vs `extraction_llm_config_id`(snake_case) 혼용 — context 미명시 | `spec/5-system/10-graph-rag.md §2.1, §3.2, 요구사항 표` | 데이터 모델 절에서는 snake_case, API/DTO 맥락에서는 camelCase 로 명시; 병기 표시 권장 |
| I-3 | Cross-Spec | `kb:{documentId}` WebSocket 채널명 — 현재 SoT 정렬 확인 (히스토리 주석 참고 사항) | `spec/5-system/10-graph-rag.md §6` | 현행 유지. 구현 시 `kb:{documentId}` 채널 기준 사용 |
| I-4 | Cross-Spec | `Integration.auth_type='none'` 사용이 data-model 과 일치 — 충돌 없음 확인 | `spec/5-system/11-mcp-client.md §3.1` | 불필요. 현행 일관성 유지 |
| I-5 | Rationale Continuity | `10-graph-rag.md` react-flow 대신 3D 렌더러 채택 — 코드 주석에만 기재, Rationale 미수록 | `spec/5-system/10-graph-rag.md §3.6 KB-GR-UI-07` | `## Rationale` 에 시각화 라이브러리 결정 근거 1항목 짧게 추가 |
| I-6 | Rationale Continuity | `11-mcp-client.md` `## Rationale` 섹션 자체 부재 — 주요 결정(stdio 미지원·세션 단위·자동 복구 금지·기존 Integration 재사용)이 인라인에만 존재 | `spec/5-system/11-mcp-client.md` 전체 | 파일 끝에 `## Rationale` 섹션 추가, 결정 항목 이관 |
| I-7 | Rationale Continuity | `requiresTotp` 제거 Rationale(1.4.I) — spec body 와 정합 확인 완료 | `spec/5-system/1-auth.md §5, §1.4.2` | 현상 유지 |
| I-8 | Convention Compliance | `10-graph-rag.md` — `## Overview (제품 정의)` H2 블록과 `## 1. 개요` H2 본문이 이중 구조로 중복 | `spec/5-system/10-graph-rag.md` 상단 및 `## 1. 개요` | Overview 1~2단락 요약으로 압축하거나 본문과 역할 명확 분리 |
| I-9 | Convention Compliance | `10-graph-rag.md §Rationale` 가 기술 결정 근거보다 기획 요약에 가까운 구조 — 위치 규약은 준수 | `spec/5-system/10-graph-rag.md ## Rationale` | 기술 결정별 근거 anchor 형식으로 보강 권장 |
| I-10 | Convention Compliance | `spec/5-system/11-mcp-client.md` frontmatter `pending_plans` 경로 실존 확인 필요 | `spec/5-system/11-mcp-client.md` frontmatter | CI 가드(`spec-pending-plan-existence.test.ts`) 통과로 자동 검증 |
| I-11 | Convention Compliance | `spec/5-system/1-auth.md` frontmatter `pending_plans` 2경로 실존 확인 | `spec/5-system/1-auth.md` frontmatter | 테스트 통과로 자동 검증. 별도 조치 불필요 |
| I-12 | Convention Compliance | `document:graph_error` dead-declared — spec 이 명시적으로 선언하고 활성 이벤트에서 제외, 처리 적절 | `spec/5-system/10-graph-rag.md §6` | 추가 조치 불필요. 타입 union 제거는 별도 plan 검토 가능 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `resend-verification` prefix 누락·§5 미등재 (W-1); camelCase/snake_case 혼용 컨텍스트 미명시 (I-2) |
| Rationale Continuity | LOW | Rationale 1.4.D TOTP 전환 경로 서술 뉘앙스 불일치 (W-2); `11-mcp-client.md` Rationale 섹션 부재 (I-6) |
| Convention Compliance | LOW | Planned 감사 액션 동사 패턴 미명시 (W-3); historical-artifact 범위 표현 불충분 (W-4) |
| Plan Coherence | LOW | reveal 엔드포인트 §5 미등재 (W-5); prod-guards prose 개선 미반영 (W-6); LDAP/SAML·invitation 토큰·webhook 갭은 scope 교차 시 인지 필요 |
| Naming Collision | LOW | `document:graph_error` dead-declared vs `5-knowledge-base.md` 활성 나열 불일치 (W-7) |

## 권장 조치사항

1. **[W-7 우선]** `spec/2-navigation/5-knowledge-base.md:182` 에서 `document:graph_error` 제거 — 구현자 오인 방지 (project-planner 영역, 1줄 수정).
2. **[W-1]** `spec/5-system/1-auth.md §1.1` line 35 경로를 `/api/auth/resend-verification`으로 수정, §5 표에 해당 행 추가 (project-planner 영역).
3. **[W-5]** `plan/in-progress/auth-config-webhook-followups.md §3` 완료 여부 확인 후, 현 구현 scope 에서 `1-auth.md §5` 수정 시 reveal 행 함께 추가.
4. **[W-2]** `spec/5-system/1-auth.md §Rationale 1.4.D` 복구 코드 언급을 실제 동작에 맞게 명확화.
5. **[W-6]** `spec/5-system/1-auth.md §Rationale "Production fail-closed 가드"` 수정 시 `OAUTH_STUB_MODE`·`LLM_STUB_MODE` 추가.
6. **[W-3, W-4]** `1-auth.md §4.1` Planned 액션 패턴 명시 선언; `§1.5.4` 주석에 "초대 흐름 전용" 범위 제한 추가.
7. **[I-6]** `spec/5-system/11-mcp-client.md` 끝에 `## Rationale` 섹션 신설 (규약 준수).
