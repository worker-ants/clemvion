# Consistency Check 통합 보고서

**BLOCK: YES** — Cross-Spec checker에서 CRITICAL 2건 발견. 해소 전 spec write 차단.

---

## 전체 위험도
**CRITICAL** — `oauth/begin` mode 파라미터 누락(런타임 분기 오류 직결) + `0-common.md` scope note가 Cafe24 추가 즉시 허위 문서가 되는 구조적 불완전성.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|------------|-----------|------|
| 1 | Cross-Spec | `POST /api/integrations/oauth/begin` body에 `mode: 'new' \| 'reauthorize'` 파라미터 누락 — callback handler가 분기 불가 | draft §2·§3.2 Cafe24 OAuth begin body 예시 | `spec/2-navigation/4-integration.md §9.2` (mode 필수 파라미터) + `§10.2` (mode 기반 callback 분기) | draft §2·§3.2 begin body에 `mode` 필드 추가. §9.2 Cafe24 확장 표기 시 mode 포함 필수 명시 |
| 2 | Cross-Spec | `0-common.md` scope note가 "HTTP Request, Database Query, Send Email" 3개 노드만 열거 + "mcp만 비-캔버스"로 서술 → Cafe24 노드 추가 시 즉시 허위 | draft §4 갱신 범위 (§7 출력 색인만 명시됨) | `spec/4-nodes/4-integration/0-common.md` lines 7–11 scope note, 도입부 링크 목록 | draft §4 갱신 범위에 ① scope note 노드 목록 Cafe24 추가, ② "cafe24는 캔버스 노드, service_type='cafe24'" 명시, ③ 도입부 링크에 `[Cafe24](./4-cafe24.md)` 추가를 명시 |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|------------|-----------|------|
| 1 | Cross-Spec | `0-common.md §5` 캔버스 요약 표에 Cafe24 행 누락 | draft §4 갱신 범위 | `spec/4-nodes/4-integration/0-common.md §5` (3행 요약 표) | CRITICAL-2 조치와 함께 §5 표에 Cafe24 행 추가 |
| 2 | Cross-Spec | `11-mcp-client.md §1` "Streamable HTTP 단일 transport" 서술이 Internal Bridge 도입 후 허위가 됨 | draft §6 갱신 범위 | `spec/5-system/11-mcp-client.md §1` | draft §6에 §1 서술 갱신 명시("Streamable HTTP + Internal Bridge 지원"으로 수정) |
| 3 | Cross-Spec | `4-integration.md §14.1` usage 기록 표에 cafe24 핸들러 행 누락 | draft §2 갱신 범위 | `spec/2-navigation/4-integration.md §14.1` | draft §2에 §14.1 Cafe24 행 추가 명시 |
| 4 | Cross-Spec | `4-integration.md §10.1` callback `:provider` 허용값 목록에 `cafe24` 누락 | draft §2 갱신 범위 | `spec/2-navigation/4-integration.md §10.1` | draft §2에 §10.1 cafe24 추가 명시 |
| 5 | Cross-Spec | `4-integration.md §9.2` oauth/begin 표에 Cafe24 전용 body 필드(`mall_id`, `app_type`, `client_id?`, `client_secret?`) 미반영 | draft §2 갱신 범위 | `spec/2-navigation/4-integration.md §9.2` | CRITICAL-1 조치(mode 추가)와 병합하여 §9.2 Cafe24 조건부 필드 전체 명시 |
| 6 | Cross-Spec | AI Agent `mcpServers` 설정 UI "Add MCP Server" 라벨·필터 정책이 Cafe24 포함 여부 미정의 | draft §7 갱신 범위 | `spec/4-nodes/3-ai/1-ai-agent.md §2` 설정 UI | draft §7에 §2 라벨/필터 정책 갱신 명시 (예: "Add AI Tool Provider" 또는 service_type 화이트리스트 명시) |
| 7 | Cross-Spec | AI Agent 캔버스 요약 `{N} MCP` 카운트 정책이 Cafe24 Internal Bridge 포함 여부 미정의 | draft §9 갱신 범위 | `spec/4-nodes/3-ai/0-common.md §8` 캔버스 요약 | draft §9에 카운트 정책 명시 (합산 or 별도 표기) |
| 8 | Convention Compliance | §4.1 Rate Limit 표의 헤더명 `X-Cafe24-Call-Limit` — 실제 API는 `X-Api-Call-Limit`이며 §4·§5.1·§5.8과 불일치. 구현 시 wrong 헤더 파싱 버그로 직결 | draft §5 (`4-cafe24.md §4.1`) | draft §4 intro / §5.1 / §5.8 (모두 `X-Api-Call-Limit` 사용) | `4-cafe24.md §4.1` 표 첫 행 `X-Cafe24-Call-Limit` → `X-Api-Call-Limit` 수정 |
| 9 | Convention Compliance | `## Overview` 섹션 누락 — 단일 spec 파일 영역은 본문 상단에 Overview 섹션 필수 (CLAUDE.md 규약) | draft `4-cafe24.md` 최상단 | CLAUDE.md 권장 3섹션 구성 | `## 1. 설정` 앞에 `## Overview` 섹션 추가 (사용자 가치·지원 범위·이중 활용 목적 2~4문장) |
| 10 | Rationale Continuity | ED-AI-39(`collectPendingUserConfig`) 서버 측 `mcpServers` 위젯의 `integrationRepo` 쿼리 필터가 `service_type='mcp'`에 고정되어 있을 가능성 — Cafe24 Integration이 후보로 표시 안 될 위험. draft 변경 목록에 누락 | draft §2 §14.2 또는 별도 §10 | `spec/3-workflow-editor/4-ai-assistant.md` §4.3.1 Rationale ED-AI-39 | draft에 변경 항목 추가: "spec/3-workflow-editor/4-ai-assistant.md §4.3.1 — mcpServers 위젯 candidate 쿼리 service_type 필터를 `['mcp', 'cafe24']`로 갱신" |
| 11 | Naming Collision | `cafe24` Node.type 값이 `spec/1-data-model.md §2.6` Node.type 열거형 테이블에 미등록 | draft 변경 파일 목록 (현재 9개) | `spec/1-data-model.md §2.6` Node.type 열거형 | 변경 파일 목록에 10번째로 `spec/1-data-model.md §2.6` 추가 — `cafe24` (integration 카테고리) 행 삽입 |
| 12 | Naming Collision | `INTEGRATION_INCOMPLETE` 에러 코드가 `spec/4-nodes/4-integration/0-common.md §4.2` 공통 에러 코드 표에 없을 가능성 — 타 핸들러가 동일 상황에서 다른 코드 발명 위험 | draft §4 step 4, §5 §5.8 | `spec/4-nodes/4-integration/0-common.md §4.2` | `0-common.md §4.2` 확인 후 부재 시 추가. `4-cafe24.md §4·§5.8`에서 `(공통 §4.2)` 출처 표기 통일 |
| 13 | Plan Coherence | `cafe24-integration.md` Phase 1 체크박스 미체크 — draft 문서가 실재하므로 완료됐으나 plan에 미반영, checker 오인 유발 | `plan/in-progress/cafe24-integration.md` Phase 1 | draft 문서 실재 상태 | spec write 전 `cafe24-integration.md` Phase 1 체크박스를 `[x]`로 갱신 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/0-overview.md §6.3` 로드맵에 Cafe24 미언급 | draft 전반 (0-overview.md 갱신 없음) | 필수 아님. 신규 Integration 추가 관례상 로드맵 또는 Integration 항목에 Cafe24 언급 권장 |
| 2 | Cross-Spec | `4-cafe24.md §4` item 11의 "0-common.md §4.1.6" anchor가 존재하지 않음 | draft §5 (`4-cafe24.md §4` item 11) | "§4.1 Usage 로깅 단계" 또는 "§4.1 표의 6번째 행(Usage 로깅)"으로 참조 방식 조정 |
| 3 | Naming Collision | `resource='application'`이 OAuth "앱" 개념과 단어 중첩 — 직접 충돌 아닌 독자 혼선 | draft §1·§3.2 (`resource` 필드), `4-cafe24.md §1` | `resource='application'`에 한 줄 설명 추가 ("Cafe24 앱 관리 API — OAuth 앱 등록과 무관") |
| 4 | Naming Collision | `POST /api/integrations/oauth/begin` body 방식이 기존 Google/GitHub OAuth begin 경로 패턴과 다를 가능성 (corpus 미확인) | draft §2·§3.2 | `spec/2-navigation/4-integration.md` §3.2의 현행 Google/GitHub begin endpoint 패턴 확인 후 필요 시 통일 |
| 5 | Convention Compliance | §5.3.2·§5.3.3 에러 케이스 예시에서 `config.fields` 생략 이유 불명확 | draft §5 (`4-cafe24.md §5.3.2·§5.3.3`) | 인라인 주석으로 생략 이유 명시 또는 `"fields": {}` 명시적 포함 |
| 6 | Plan Coherence | `spec/4-nodes/3-ai/1-ai-agent.md §1` — cafe24 spec과 ai-agent-tool-connection-rewrite plan이 같은 파일의 다른 구역 수정 예고. 현재 경합 없음 | `plan/in-progress/ai-agent-tool-connection-rewrite.md` Phase 3 | rewrite plan 착수 시 mcpServers 확장 내용을 인지하도록 메모 추가 권장 |
| 7 | Plan Coherence | `node-output-redesign` plan의 27개 노드 진단 목록에 cafe24 신규 노드 미포함 — 충돌 없음. 출력 구조가 기준에 부합 | `plan/in-progress/node-output-redesign/README.md` | node-output-redesign 완료 시점에 cafe24 노드 포함 여부를 그 시점에 결정 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | **CRITICAL** | `oauth/begin` mode 누락(런타임 충돌) + 0-common.md scope note 즉시 허위화 |
| Rationale Continuity | **LOW** | ED-AI-39 Candidate Picker 쿼리 스코프 누락(spec 한 줄 추가로 해소 가능) |
| Convention Compliance | **LOW** | `X-Api-Call-Limit` 헤더명 오기(구현 버그 직결) + Overview 섹션 누락 |
| Plan Coherence | **LOW** | Critical 0건. Phase 1 체크박스 미갱신 및 동일 파일 편집 예고(비경합) |
| Naming Collision | **LOW** | Node.type 열거형 미등록 + INTEGRATION_INCOMPLETE 공통 표 등록 미확인 |

---

## 권장 조치사항

1. **[BLOCK 해소 필수 — spec write 전]** `draft §2·§3.2`: Cafe24 `oauth/begin` body에 `mode: 'new' | 'reauthorize'` 필드 추가. 동시에 `4-integration.md §9.2` 갱신 범위에 Cafe24 조건부 필드(`mall_id`, `app_type`, `client_id?`, `client_secret?`) 전체를 명시
2. **[BLOCK 해소 필수 — spec write 전]** `draft §4` 갱신 범위 확장: `0-common.md` scope note 3항목(노드 목록 + cafe24 캔버스 노드 명시 + 도입부 링크) + §5 캔버스 요약 표 Cafe24 행 추가를 명시
3. **[spec write 전 수정 강력 권장]** `4-cafe24.md §4.1` 표: `X-Cafe24-Call-Limit` → `X-Api-Call-Limit` 오기 수정
4. **[spec write 전 수정 강력 권장]** `4-cafe24.md` 최상단에 `## Overview` 섹션 추가 (CLAUDE.md 규약)
5. **[spec write 전]** `plan/in-progress/cafe24-integration.md` Phase 1 체크박스 `[x]`로 갱신
6. **[draft 변경 파일 목록 확장]** 10번째: `spec/1-data-model.md §2.6` cafe24 Node.type 추가 / 11번째: `0-common.md §4.2` INTEGRATION_INCOMPLETE 등록 확인 및 추가
7. **[draft 변경 항목 추가]** `spec/3-workflow-editor/4-ai-assistant.md §4.3.1` — `mcpServers` candidate 쿼리 service_type 필터 `['mcp', 'cafe24']`로 갱신 명시
8. **[draft §6·§7·§9 갱신 범위 보완]** `11-mcp-client.md §1` transport 서술 수정 / `1-ai-agent.md §2` UI 라벨·필터 정책 / `0-common.md §8` 캔버스 카운트 정책 각각 명시
9. **[draft §2 갱신 범위 보완]** `4-integration.md §14.1` cafe24 usage 기록 행 + `§10.1` callback provider 목록 cafe24 추가