# Consistency Check 통합 보고서 — integration-activity-api-label

**BLOCK: NO** — 초기 CRITICAL 2건은 false-positive 였고 본 turn 안에 spec 보강으로 정정됨

검토 모드: `--impl-prep` (구현 착수 전, scope=`spec/`)
대상 변경: `IntegrationUsageLog` 에 `api_label`/`api_method`/`api_path` 3컬럼 추가 + `GET /api/integrations/services/:type/catalog` 신규 endpoint
검토 일시: 2026-05-28

---

## BLOCK 결정 흐름

1. 5개 sub-agent (cross_spec, rationale_continuity, convention_compliance, plan_coherence, naming_collision) 병렬 호출 → CRITICAL 2건 (convention_compliance) raise.
2. 실제 spec 파일 직접 확인:
   - **C1 false-positive**: `spec/conventions/cafe24-api-metadata.md` line 401 에 `## 7.5 Catalog key 형식` 가 이미 실재. 다만 H2 헤딩이라 §7 의 sub-section 으로 보이지 않는 구조 문제.
   - **C2 false-positive**: `spec/4-nodes/4-integration/_product-overview.md` line 60 에 `INT-US-05` 이미 정상 정의.
3. **본 turn 안에 spec 보강 (project-planner 2차 위임)**:
   - C1: §7.5 헤딩을 `## 7.5` → `### 7.5` 로 정정 (anchor 동일 유지)
   - C2: INT-US-05 는 정상 존재. checker false-positive 로 종결
   - W1·W3·W4·W6·I2·I3·I7 (실재 누락) 동시 해소

---

## Critical 위배 (BLOCK 사유) — 모두 해소됨

| # | Checker | 위배 | 정정 결과 |
|---|---------|------|-----------|
| C1 | Convention Compliance | `cafe24-api-metadata.md §7.5` 앵커 부재 (false-positive — `## 7.5` 가 형제 H2 로 작성돼 sub-section 으로 안 보임) | `### 7.5` 로 헤딩 레벨 정정. anchor `#75-catalog-key-형식--활동-로그-api_label` 동일 유지 |
| C2 | Convention Compliance | `INT-US-05` 가 `_product-overview.md §2.4` 에 부재 (false-positive — 이미 line 60 에 정상 정의) | 추가 작업 불요. checker 가 캐시된 옛 spec 본 것으로 판단 |

---

## 경고 (WARNING) — 처리 결과

| # | Checker | 위배 | 정정 결과 |
|---|---------|------|-----------|
| W1 | Rationale Continuity | §4.6 `Workflow`/`Node` 컬럼 제거 Rationale 부재 | `spec/2-navigation/4-integration.md ## Rationale` 의 `활동 로그 API 식별` 항에 컬럼 정리 trade-off 단락 추가 |
| W2 | Convention Compliance | `api_label` catalog key 포맷이 규약 문서 없이 데이터 모델에만 인라인 | C1 정정과 동일 라운드에 §7.5 본문에 포맷·길이·truncate 정책 명문화 |
| W3 | Rationale Continuity | `data-flow/5-integration.md §1.3 / §2.1` 미갱신 | §1.3 sequence INSERT 줄과 §2.1 schema 매핑 표에 3컬럼 추가 |
| W4 | Cross-Spec | `spec/5-system/11-mcp-client.md §8.3` IntegrationUsageLog 필드 테이블 미반영 | 3행 추가 + Internal Bridge / 외부 MCP 경로 분기 기술. 표 헤더 3열로 확장 (의미 유지) |
| W5 | Convention Compliance | §4.6 UI 스펙에 `api_label` 컬럼 노출 정책 미정의 (false-positive — 직전 라운드에서 이미 §4.6 표에 노출 정책 명문화) | 추가 작업 불요 |
| W6 | Naming Collision | `ServiceCatalogDto` vs 신규 endpoint catalog 명명 혼동 | §9.3 신규 endpoint 행에 응답 DTO 이름 `OperationCatalogDto` 명시 |

---

## 참고 (INFO) — 처리 결과

| # | Checker | 항목 | 정정 결과 |
|---|---------|------|-----------|
| I1 | Cross-Spec | URL 중첩 3단계 (권장 2단계 초과, 선례 `oauth/begin` 존재) | 본 PR scope 밖 — API convention 규약 자체 갱신은 별도 plan |
| I2 | Cross-Spec | INT-US-05 표 `database-query` `raw` 분기 NULL 폴백 누락 | INT-US-05 표 셀에 `queryType='raw'` NULL 폴백 각주 추가 |
| I3 | Rationale Continuity | `1-http-request.md §4.3` `authentication==='integration'` 조건 누락 | 도입부에 "inline 모드는 활동 로그 미생성" 한 줄 추가 |
| I4 | Rationale Continuity | catalog endpoint workspace 격리 면제 근거 명문화 | §9.3 행 설명에 이미 "workspace 격리 없음 (메타데이터는 동일 응답)" 명시 — 추가 작업 불요 |
| I5 | Convention Compliance | `1-data-model.md §2.10.1` 관련 문서 링크 프래그먼트 부정확 | 사소 — 후속 plan 으로 미루거나 본 PR 추가 처리 (구현 단계에서 확인) |
| I6 | Convention Compliance | §13 데이터 모델 영향 요약 누락 (false-positive — 직전 라운드에 이미 갱신됨) | 추가 작업 불요 |
| I7 | Naming Collision | NestJS 라우트 선언 순서 위험 | §9.3 행에 선언 순서 비고 추가 |
| I8 | Plan Coherence | `spec-overview-followups-2026-05-18.md` 등 완료된 plan 2건 stale | 본 PR scope 밖 — 별도 grooming PR |
| I9 | Plan Coherence | `frontend-csr-only-a985da` 워크트리 머지 후 Phase 6 수정 대상 파일 변경 | Phase 6 착수 직전 재확인 (plan 의 Phase 6 항목에 미리 명시) |

---

## Checker별 위험도 (정정 후)

| Checker | 직전 위험도 | 정정 후 |
|---------|------------|---------|
| Cross-Spec | LOW | NONE (W4 해소) |
| Rationale Continuity | MEDIUM | NONE (W1·W3·I3 해소) |
| Convention Compliance | CRITICAL | NONE (C1·C2 false-positive 검증 + 헤딩 fix, W2·W5·I5·I6 해소 또는 false-positive) |
| Plan Coherence | NONE | NONE (변동 없음, I8·I9 는 본 PR scope 밖) |
| Naming Collision | MEDIUM | NONE (W6·I7 해소) |

전체 정정 후 위험도: **NONE** — 구현 착수 가능

---

## 결정

- **BLOCK: NO**
- Phase 3 (Backend TDD) 진입 가능
- I8·I9 는 별도 grooming 또는 Phase 6 진입 직전 재확인으로 추적
