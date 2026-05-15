# Consistency Check 통합 보고서

**BLOCK: YES** — Convention Compliance에서 CRITICAL 1건 발견 (send_email 성공 포트명 불일치, 구현 오류 직결)

---

## 전체 위험도
**MEDIUM** — CRITICAL 1건(send_email 포트명)이 구현에 직접 영향. WARNING 5건은 착수 전 또는 해당 Phase 착수 전 정리 권장.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|------------|-----------|------|
| 1 | Convention Compliance · Cross-Spec · Rationale Continuity (통합) | `send_email` 성공 포트명이 `0-common.md §7` 색인(`'success'`)과 `3-send-email.md §3.2·§5.1`(`'out'`) 간 불일치. HTTP Request · Database Query · Cafe24 는 모두 `success`; Send Email 만 `out`. 구현자가 공통 색인 기준으로 코딩하면 즉시 버그 발생 | `spec/4-nodes/4-integration/3-send-email.md` §3.2, §5.1 | `spec/4-nodes/4-integration/0-common.md` §6·§7 | 두 옵션 중 하나를 선택하여 spec 고정: **(A)** `3-send-email.md §3.2·§5.1·§9 Rationale` 을 `success`로 통일하고 `0-common.md §6` 면제 괄호 문구 제거. **(B)** `0-common.md §7` 색인을 `§5.1 ('out')`으로 정정하고 `3-send-email.md §9 Rationale`에 `out` 유지 근거 명시. 선택 후 해당 spec 을 수정하고 본 BLOCK 을 해제한다. |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|------------|-----------|------|
| 1 | Convention Compliance · Rationale Continuity (통합) | `database_query.meta.rowCount` 방침이 세 문서 간 삼중 불일치. `node-output.md` Principle 2는 `meta.rowCount` 열거, `0-common.md §6`는 중복 허용, `2-database-query.md §5.1`은 "복제 금지" 명시 | `spec/conventions/node-output.md` Principle 2, `spec/4-nodes/4-integration/0-common.md §6`, `spec/4-nodes/4-integration/2-database-query.md §5.1` | 세 문서 상호 | `node-output.md` Principle 2 DB 행에서 `meta.rowCount` 를 제거 또는 "database_query 는 `output.rowCount` 만 사용" 각주 추가. `0-common.md §6` DB 행도 동일하게 정정. `2-database-query.md §5.1`의 결정이 가장 근거 있으므로 이를 단일 진실로 채택. |
| 2 | Plan Coherence | `node-output-redesign` plan 의 Integration 노드 완료 여부 불명확. `0-common.md §8` CHANGELOG 는 "완료"로 보이나, plan 목록 잘림으로 직접 확인 불가 | `spec/4-nodes/4-integration/0-common.md §8` CHANGELOG | `plan/in-progress/node-output-redesign/README.md` | Phase 0 컨텍스트 로드 시 `node-output-redesign` plan 에서 Integration 노드 파일의 완료 여부를 명시적으로 확인하고 기록. 이미 완료됐다면 plan 해당 항목에 `[x]` 표기. |
| 3 | Plan Coherence | `ai-agent-tool-connection-rewrite` plan 의 §1 도구 등록 모델 결정이 전부 TBD인 상태에서 cafe24 구현 Phase 10(AI Agent mcpServers grouping UI)에 진입 시 양방향 깨짐 위험 | `plan/in-progress/cafe24-implementation.md` Phase 10 | `plan/in-progress/ai-agent-tool-connection-rewrite.md §1` | Phase 10 착수 전 `ai-agent-tool-connection-rewrite` §1 결정 상태를 재확인. 여전히 TBD라면 cafe24 구현의 mcpServers UI 변경이 먼저 머지됨을 양쪽 plan 에 설계 기준점으로 명시. |
| 4 | Naming Collision | `config.fields` 속성명을 cafe24(`Record<string, unknown>`)와 form 노드(`FormField[]`)가 공유하나 타입·의미 상이 | `spec/4-nodes/4-integration/4-cafe24.md §1` config 스키마 | form 노드 `config.fields: FormField[]` | Frontend 설정 패널 구현 시 `nodeType === 'cafe24'` / `nodeType === 'form'` 분기를 명시적으로 처리하고, TypeScript 인터페이스를 각각 독립 선언. Runtime 충돌은 없으므로 spec 변경 불필요. |
| 5 | Naming Collision | `resource = 'application'` 열거값이 프로젝트 내 "Application(앱 자체)" 개념과 의미 혼동 가능 | `spec/4-nodes/4-integration/4-cafe24.md §1`, `spec/conventions/cafe24-api-metadata.md §1` | 프로젝트 아키텍처 전반의 "Application" 개념 | spec 내 ⚠ 주석으로 이미 처리됨. 구현 시 `application.ts` 메타데이터 파일 최상단에 동일 경고 JSDoc 주석 복사하여 IDE 레벨에서도 가시화. |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | 외부 참조 문서 3종 정합성 미확인 (`spec/2-navigation/4-integration.md#58-cafe24`, `spec/5-system/11-mcp-client.md`, `spec/conventions/cafe24-api-metadata.md`) | `spec/4-nodes/4-integration/4-cafe24.md` 헤더·§4·§8~§9 | 구현 착수 전 해당 섹션 앵커 존재 여부·`app_type` enum 정합성 직접 확인 |
| 2 | Cross-Spec | `spec/0-overview.md §6.3` Cafe24 ❌ 미구현 표시 — 의도적, 일관적 | `spec/0-overview.md §6.3` | 구현 완료 후 `spec/0-overview.md §6.1`에 `cafe24` 추가, §6.3 항목 제거. plan 에 후속 spec 갱신 단계로 명시. |
| 3 | Cross-Spec | `meta.callUsage` 단위(%) — Cafe24 실제 헤더 값 형식 미검증 | `spec/4-nodes/4-integration/4-cafe24.md §4.1, §5.1` | 구현 시 실측 후 spec 예시 값·단위 설명 보정 필요 시 `4-cafe24.md §4.1` 표 수정 |
| 4 | Rationale Continuity | `output.response.error` legacy 잔재 보존 결정 근거 미기록 | `spec/4-nodes/4-integration/1-http-request.md §5.3.2` | `1-http-request.md §9 Rationale` 또는 CHANGELOG에 "backwards-compatibility 목적, 폐기 시점 미정" 한 줄 추가 |
| 5 | Convention Compliance | `node-output.md` Principle 10/11 파일 내 미노출 (truncation 추정) — target 문서들이 Principle 11 인용 | `spec/conventions/node-output.md` | 컨벤션 파일에서 Principle 10/11 존재 여부 확인 |
| 6 | Convention Compliance | `HTTP_4XX` 코드가 3xx(manual redirect 한도 초과)도 포함 — 코드명과 실제 조건 불일치 | `spec/4-nodes/4-integration/1-http-request.md §6` | §6 표에 "(non-integration auth의 3xx 한도 케이스)" 부연 추가, 또는 `HTTP_REDIRECT_LIMIT` 코드 신설 검토 |
| 7 | Plan Coherence | Phase 1 consistency-check 체크박스 갱신 필요 | `plan/in-progress/cafe24-implementation.md` Phase 1 | 본 검토 완료 후 `[ ] /consistency-check --impl-prep` → `[x]` 갱신, `review/consistency/` 산출물 경로 plan에 기록 |
| 8 | Naming Collision | `scopeType` 명명으로 `Node.category`와의 충돌 선제 회피 — 현행 유지 | `spec/conventions/cafe24-api-metadata.md §2` | 현행 유지 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Convention Compliance | **MEDIUM** | CRITICAL: send_email 포트명 `out`/`success` 불일치 (공통 색인 vs 노드 spec); WARNING: `meta.rowCount` 삼중 불일치 |
| Cross-Spec | **LOW** | WARNING: send_email 포트명 불일치(CRITICAL로 통합됨); INFO: 외부 참조 3종 미확인 |
| Rationale Continuity | **LOW** | WARNING: `meta.rowCount` 불일치(W1로 통합됨); INFO: 2건 Rationale 미기록 |
| Plan Coherence | **LOW** | WARNING: node-output-redesign Integration 완료 여부 불명, ai-agent-tool-connection Phase 10 순서 위험 |
| Naming Collision | **LOW** | WARNING: `config.fields` 다중 노드 공유(타입 상이), `application` 열거값 혼동 가능성 |

---

## 권장 조치사항

1. **(BLOCK 해소 — 즉시 필수)** `send_email` 성공 포트명을 `success`로 통일하거나 `out`으로 명시적 확정. 두 옵션 중 하나를 선택하여 `3-send-email.md §3.2·§5.1·§9`와 `0-common.md §6·§7`을 동시 수정. `project-planner`에 위임하거나 현재 worktree에서 직접 수정 후 BLOCK 해제.

2. **(구현 착수 전 — 강력 권장)** `meta.rowCount` 단일 진실 확정: `2-database-query.md §5.1`의 "복제 금지" 결정을 채택하여 `node-output.md` Principle 2와 `0-common.md §6` DB 행을 정정.

3. **(Phase 0 컨텍스트 로드 시)** `plan/in-progress/node-output-redesign/` Integration 노드 완료 여부를 명시적으로 확인·기록.

4. **(Phase 10 착수 직전)** `ai-agent-tool-connection-rewrite` §1 TBD 상태 재확인 후 plan 양쪽에 머지 순서 기준점 명시.

5. **(구현 진행 중)** 외부 참조 3종(`spec/2-navigation/4-integration.md#58-cafe24` 등) 정합성 교차 확인, `config.fields` 타입 가드 분기 구현, `application` 메타 파일 JSDoc 경고 주석 추가.

6. **(완료 후)** `cafe24-implementation.md` Phase 1 체크박스 갱신 및 `spec/0-overview.md §6.1·§6.3` 업데이트를 plan에 후속 항목으로 포함.