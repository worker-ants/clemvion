# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

- **검토 모드**: 구현 완료 후 (`--impl-done`, scope=`spec/5-system`, diff-base=`origin/main`)
- **Target**: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md`
- **검토 일시**: 2026-06-05

## 전체 위험도
**LOW** — Critical 0건, Warning 1건(비차단 markdown 구조 결함), Info 8건. 차단 사유 없음.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Convention Compliance | `$4` 행과 `$5` 행 사이 빈 줄 + blockquote 삽입으로 `$5` 행이 표 밖으로 분절 — 렌더링 시 `$5`(workspace ID 멀티테넌시 바인딩 파라미터)가 깨진 pipe 텍스트 한 줄로 노출됨 | `spec/5-system/9-rag-search.md §3.1` (142~150행) | 정식 conventions 의 문서 구조 규약(가독성·정합성 손실) | blockquote 를 표 아래(`$5` 행 다음)로 옮기거나, `$5` 행을 `$4` 바로 다음으로 이동해 표를 연속시킴 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `graph-rag.md §2.1` KnowledgeBase 컬럼 표가 `rerank_*` 컬럼을 나열하지 않음 — 의도된 범위 한정(rerank 는 `9-rag-search.md` 위임), 모순 아님 | `spec/5-system/10-graph-rag.md §2.1` | 현행 유지 (의도적 범위 분리) |
| I-2 | Cross-Spec | target 3개 문서 모두 미구현 surface 를 "Planned" 마커 + plan 추적 링크로 정직하게 표기 — 정합성 양호 신호 | `1-auth.md §1.3`, `10-graph-rag.md §3.7`, `11-mcp-client.md §3.3/§6.2/§8.2` | 현행 유지 |
| I-3 | Rationale Continuity | `graph-rag §4.2` SQL 이 `centrality_weight(ec.chunk_id)` 개념 함수 참조 — 본문이 "개념 정의이며 실제 구현은 V022/V023 cast 표현식을 따른다"고 명시 | `spec/5-system/10-graph-rag.md §4.2` | 정확한 SQL 함수 정의 일치 여부는 코드 레이어 검토 시 확인 권장 |
| I-4 | Rationale Continuity | `mcp-client §3.3/§6.2/§8.2` 미구현 항목(Planned) 이 `plan/in-progress/spec-sync-mcp-client-gaps.md` 로 추적 — 결정 번복·invariant 위반 아님 | `spec/5-system/11-mcp-client.md` | 구현 완료 시 spec 마커 제거와 plan 체크박스 마감 동시 처리 권장 |
| I-5 | Convention Compliance | `1-auth.md §1.4.G` V058 마이그레이션이 NOT VALID+VALIDATE 2-step 분리 미적용 — 조건(append-only enum 확장·소규모 테이블) + 향후 1M row 승격 권고를 Rationale 에 명문화한 의식적 예외 | `spec/5-system/1-auth.md §1.4.G` | 모범 사례로 현행 유지 |
| I-6 | Convention Compliance | `7-llm-client.md §6` `apiKey` 필드의 `writeOnly: true` DTO 동반 여부는 구현 레이어 검토 소관 | `spec/5-system/7-llm-client.md §6` | `/ai-review` 시 DTO 확인 권장 |
| I-7 | Plan Coherence | `1-auth.md §5` API 엔드포인트 표에 `POST /api/auth-configs/:id/reveal` 행 누락 + webhook 측 IP-추출 cross-ref 미기재 — `auth-config-webhook-followups.md §3` 가 이미 추적 중 | `spec/5-system/1-auth.md §5` | `auth-config-webhook-followups.md §3` 항목 처리 시 함께 보강 |
| I-8 | Plan Coherence | `auth-config-webhook-followups.md §3` 의 "IP 추출 정책 명시" 항목이 `1-auth.md §2.3`(라인 268) 에 이미 반영 — plan 체크박스가 webhook cross-ref 잔여만 남은 상태 | `plan/in-progress/auth-config-webhook-followups.md §3` | 해당 체크박스를 webhook cross-ref 잔여만 남도록 갱신하면 추적 정확도 향상 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | target 3개 문서가 데이터 모델·API 계약·요구사항 ID·상태 머신·RBAC·계층 책임 6개 관점 전부에서 충돌 없음. canonical SoT(data-model) 로의 위임 구조 일관 유지 |
| Rationale Continuity | NONE | 기각 대안 재도입·합의 원칙 위반·무근거 결정 번복·invariant 우회 전부 미발견. reranking 직교성·단방향 의존성·Internal Bridge 패턴 원칙 정합 |
| Convention Compliance | LOW | Critical 없음. `9-rag-search.md §3.1` markdown 표 분절(W-1) 1건만 존재 — 비차단 |
| Plan Coherence | NONE | 미해결 결정 충돌·중복 작업·선행 미해소·후속 누락·worktree 경합 전부 미발견. spec status·pending_plans·Planned 마커가 in-progress plan 과 1:1 정합 |
| Naming Collision | NONE | 요구사항 ID·엔티티명·API endpoint·이벤트/큐명·환경변수·파일 경로 전 영역에서 충돌 없음. data-model 이 SoT 로 이미 흡수·정렬한 구조라 신규 충돌 발생 불가 |

## 권장 조치사항

1. **[W-1 해소 권장]** `spec/5-system/9-rag-search.md §3.1` 142~150행의 표 분절 수정 — blockquote 를 `$5` 행 다음으로 이동하거나 `$5` 행을 `$4` 바로 다음으로 올려 표를 연속시킴. 차단 아니므로 다음 해당 파일 편집 시 같이 처리 가능.
2. **[I-7 추적]** `1-auth.md §5` 엔드포인트 표에 `reveal` 행 추가 및 webhook IP-추출 cross-ref 보강은 `auth-config-webhook-followups.md §3` 처리 시 함께 수행.
3. **[I-8 추적 정확도]** `auth-config-webhook-followups.md §3` IP-추출 정책 체크박스를 "webhook cross-ref 잔여" 상태로 갱신.
4. **[I-6 예방적]** `/ai-review` 또는 구현 검토 시 `7-llm-client.md §5.5 preview-models` DTO 의 `apiKey` 필드 `writeOnly: true` 적용 여부 확인.

---
*본 보고서는 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 결과를 통합한 것입니다.*