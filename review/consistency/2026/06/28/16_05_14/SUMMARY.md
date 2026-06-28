# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음, 차단 불필요

## 전체 위험도
**LOW** — WARNING 2건(의미론적 개선 권고), Critical 없음

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `PAYLOAD_TOO_LARGE`(413)가 §1.3 섹션 제목 "유효성 검증 에러"와 의미 레이어 불일치 (인프라/파서 레이어 vs 사용자 입력 검증) | `spec/5-system/3-error-handling.md §1.3` | `spec/5-system/2-api-convention.md §6` (413을 별도 행으로 등재) | (1) `PAYLOAD_TOO_LARGE` 행을 별도 소절(`### 1.3a 본문 크기 에러`)로 분리, 또는 (2) §1.3 제목을 "유효성 검증·입력 에러 (400·413)"으로 확장. invariant 미위반이므로 차단 아님 |
| 2 | Naming Collision | `document:graph_error` 이벤트 — `10-graph-rag.md §6`은 dead-declared/미emit 명시, 그러나 `5-knowledge-base.md:182`와 `6-websocket-protocol.md:739`는 유효 이벤트로 열거, spec 간 상충 | `spec/5-system/10-graph-rag.md §6` 주석 | `spec/2-navigation/5-knowledge-base.md:182`, `spec/5-system/6-websocket-protocol.md:739` | `5-knowledge-base.md`와 `6-websocket-protocol.md`의 이벤트 목록에서 `_error`를 제거하거나 `(dead-declared, 미emit)` 주석 추가. 또는 `graph-extraction.service.ts`에서 실제 emit 구현으로 통일. `plan/in-progress/spec-sync-structural-followups.md:224-226`에 이미 추적 중 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `PAYLOAD_TOO_LARGE`(413)가 §1.3의 기존 혼재 분류표(400 외 404·409·422 포함) 패턴과 일치 | `spec/5-system/3-error-handling.md §1.3` | 현행 유지 가능. §1.3이 "요청-수준 클라이언트 에러 카탈로그"로 묵시적 확장된 상태 |
| 2 | Cross-Spec | `PUBLIC_WEBHOOK_BODY_TOO_LARGE`(413)와 `PAYLOAD_TOO_LARGE`(413) 이중 구조 — 발행 경로·임계 다름 (공개 32KB vs 인증 1MB) | `spec/5-system/3-error-handling.md §1.3, §1.7` | 현행 유지. 의미 분리가 spec 여러 위치에 명시적으로 문서화됨 |
| 3 | Cross-Spec | `spec/7-channel-web-chat/4-security.md §4` 주석의 SoT 포인터 방향 정합 — webhook↔channel-web-chat 상호 참조가 각각 담당 SoT를 올바르게 지정 | `spec/7-channel-web-chat/4-security.md L143` | 현행 유지 |
| 4 | Rationale Continuity | WH-NF-02 구현 완료 전환 — 옵션 A/B 기각·옵션 C 채택 근거 Rationale 신규 추가, 기존 결정 번복 없음 | `spec/5-system/12-webhook.md ## Rationale` | 적절히 처리됨. `plan/complete/spec-sync-webhook-gaps.md` 이동 완료 확인됨 |
| 5 | Rationale Continuity | `PAYLOAD_TOO_LARGE` §1.3 등재 — origin/main에 관련 기각 결정 없고, 구현 완료에 따른 정합화 | `spec/5-system/3-error-handling.md §1.3` | 적절히 처리됨 |
| 6 | Convention Compliance | `12-webhook.md` frontmatter `status: partial → implemented` 전이 — `pending_plans` 정리, `plan/complete/` 이동, 신규 코드 파일 등록 모두 정합 | `spec/5-system/12-webhook.md` frontmatter | 이상 없음. spec-status-lifecycle.test.ts 가드 통과 요건 충족 |
| 7 | Convention Compliance | `PAYLOAD_TOO_LARGE` 명명 — `UPPER_SNAKE_CASE` 준수, 의미 기반 명명 원칙 충족, 시스템 전역 공용 코드 배치 일관 | `spec/5-system/3-error-handling.md §1.3` | 이상 없음 |
| 8 | Convention Compliance | `2-api-convention.md §6` 413 항목 삽입 위치·형식 — 숫자 오름차순 삽입, `code` 기본값 목록 동기 추가, 형식 규칙 준수 | `spec/5-system/2-api-convention.md §5.3, §6` | 이상 없음 |
| 9 | Convention Compliance | `12-webhook.md ## Rationale` 소절 추가 — CLAUDE.md 3섹션 규약 배치 일치 | `spec/5-system/12-webhook.md ## Rationale` | 이상 없음 |
| 10 | Convention Compliance | `plan/in-progress/spec-sync-webhook-gaps.md` 링크 제거 — `plan/complete/`로 이동된 파일 참조 제거로 `spec-link-integrity.test.ts` 가드 통과 | `spec/5-system/12-webhook.md §4` | 이상 없음 |
| 11 | Plan Coherence | `plan/complete/spec-sync-webhook-gaps.md`의 WH-NF-02 결정(옵션 C)이 이미 확정 기록됨 — 이번 target 변경과 일관 | `plan/complete/spec-sync-webhook-gaps.md` | 조치 불필요 |
| 12 | Naming Collision | `GraphTraversalSummary` vs `GraphTraversalService` — 동일 "graph traversal" 어휘 영역 공유, 코드 동작 충돌 없음, spec 내 disambiguation 주석 부재 | `spec/5-system/10-graph-rag.md §3.4` | `10-graph-rag.md §3.4` 또는 `§4.3`에 "execution-engine의 `GraphTraversalService`(워크플로 노드 그래프)와 무관한 KB RAG 전용 출력 타입" disambiguation 1줄 추가 |
| 13 | Naming Collision | `KB-GR-*` 요구사항 ID — `5-knowledge-base.md`·`0-overview.md`가 동일 기능 기술하나 역참조 없어 추적성 단절 | `spec/2-navigation/5-knowledge-base.md`, `spec/0-overview.md` | `5-knowledge-base.md` 정비 시 `(KB-GR-EX-05)` 등 역참조 추가 권고 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | cross-spec 충돌 없음. `PAYLOAD_TOO_LARGE` 이중 413 구조·SoT 포인터 모두 정합 |
| Rationale Continuity | NONE | WH-NF-02 Rationale 신규 추가 적절. 기존 결정(옵션 C) 번복 없음 |
| Convention Compliance | LOW | WARNING 1건 — `PAYLOAD_TOO_LARGE`의 §1.3 섹션 의미론적 위치 불일치. invariant 미위반 |
| Plan Coherence | NONE | plan/complete 이동·완료 표기 모두 정합. 후속 plan 항목 식별 없음 |
| Naming Collision | LOW | WARNING 1건 — `document:graph_error` spec 간 상충(dead-declared vs 유효 이벤트 혼재). `plan/in-progress/spec-sync-structural-followups.md`에 이미 추적 중 |

## 권장 조치사항

1. **(WARNING W-2, Naming Collision) `document:graph_error` 정합화** — `spec/2-navigation/5-knowledge-base.md:182`와 `spec/5-system/6-websocket-protocol.md:739`의 이벤트 목록에서 `document:graph_error`(`_error`)를 제거하거나 `(dead-declared, 미emit)` 주석 추가. 또는 `plan/in-progress/spec-sync-structural-followups.md` 항목(3)을 통해 실제 emit 구현으로 통일. 이미 추적 중인 plan 항목이 있으므로 해당 plan의 우선순위 확인.
2. **(WARNING W-1, Convention Compliance) `3-error-handling.md §1.3` 제목·구조 개선** — `PAYLOAD_TOO_LARGE` 행을 별도 소절로 분리하거나 §1.3 제목을 "유효성 검증·입력 에러 (400·413)"으로 확장. invariant 미위반이므로 다음 spec 편집 시 함께 처리 가능.
3. **(INFO, Naming Collision) `GraphTraversalSummary` disambiguation** — `10-graph-rag.md §3.4`에 `GraphTraversalService`와의 의미 분리 1줄 주석 추가. 낮은 우선순위.
4. **(INFO, Naming Collision) `KB-GR-*` 역참조** — `5-knowledge-base.md` 정비 시 관련 기능 설명에 요구사항 ID 역참조 추가. 낮은 우선순위.