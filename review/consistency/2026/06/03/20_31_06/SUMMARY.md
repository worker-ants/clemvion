# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

target: `spec/4-nodes/4-integration/5-makeshop.md`
검토일: 2026-06-03

---

## 전체 위험도

**HIGH** — target 자체 설계 모순은 없으나, 4개 핵심 cross-cutting spec 의 동반 갱신 누락 + 참조 plan 파일 미존재로 spec 체인이 끊기고 dead reference 상태.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `spec/1-data-model.md` main 미갱신 — `service_type`, `mall_id`, Node.type 목록, 인덱스, `IntegrationUsageLog.api_label` 에 makeshop 누락 | §3, §9.3 | `spec/1-data-model.md` §2.6, §2.10 | worktree 버전 `spec/1-data-model.md` 를 이 PR 에 포함시키거나 선행 merge |
| 2 | Cross-Spec | `spec/0-overview.md` main 미갱신 — §6.3 로드맵에 MakeShop 항목 없음 | §Overview 전체 | `spec/0-overview.md` §6.1, §6.3 | §6.3 "Internal MCP Bridge 패턴 확장" 행에 MakeShop 항목 추가 (worktree 버전 참조) |
| 3 | Cross-Spec | `spec/2-navigation/4-integration.md` main 미갱신 — §5.9 MakeShop 절 부재, target 에서 `#59-makeshop` 참조가 dead link | §1, §4 step 3 | `spec/2-navigation/4-integration.md` §5, §9 | §5.9 MakeShop 절 추가, §9.3 catalog endpoint 설명에 makeshop 추가, `IntegrationDto` derived 필드 갱신 |
| 4 | Plan Coherence | `plan/in-progress/makeshop-integration.md` 파일 미존재 — `pending_plans` frontmatter 및 §9.6, §9.8 cross-reference 가 모두 dead reference | frontmatter, §9.6, §9.8 | `plan/in-progress/makeshop-integration.md` (파일 없음) | plan 파일 신설: 구현 단계 목록·C-6 분해·§9.6 webhook 후속·worktree frontmatter 포함 |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `spec/conventions/makeshop-api-metadata.md` main 부재 — target SoT 참조가 끊김 | §1, §2, §4 step 1/5/7 | `spec/conventions/makeshop-api-metadata.md` (main 에 없음) | worktree 의 해당 파일을 이 PR 에 포함 |
| 2 | Cross-Spec | `spec/conventions/makeshop-api-catalog/` main 부재 — 161 operation SoT 참조 끊김 | §Overview, §2, §5.1 | `spec/conventions/makeshop-api-catalog/` 디렉토리 (main 에 없음) | worktree 의 해당 디렉토리 전체를 이 PR 에 포함 |
| 3 | Cross-Spec | `spec/5-system/11-mcp-client.md` §2.3 에 `MakeshopMcpToolProvider` 언급 없음 — 단방향 참조 불일치 | §Overview, §8 | `spec/5-system/11-mcp-client.md` §2.3 | §2.3 에 MakeShop 두 번째 구현체 추가 (Planned 표기) |
| 4 | Cross-Spec | `spec/4-nodes/4-integration/_product-overview.md` INT-US-05 표에 makeshop 행 없음 | §4 step 11 | `_product-overview.md` §2.4 | INT-US-05 api_label 표에 `makeshop.<resource>.<operation>` 행 추가 |
| 5 | Rationale Continuity | `MAKESHOP_SERVICE_UNAVAILABLE` 신설 — 동일 조건에 기합의된 `INTEGRATION_SERVICE_UNAVAILABLE` 을 이유 없이 이탈, Rationale 미제공 | §6 에러 코드 표 | `spec/4-nodes/4-integration/4-cafe24.md` §6, `spec/conventions/error-codes.md` §1 | `INTEGRATION_SERVICE_UNAVAILABLE` 로 교체하거나 별도 코드 필요 이유를 §9 Rationale 에 명시 |
| 6 | Convention Compliance | `output.error` Case §5.3 에 JSON 예시 없음 — `node-output.md` Principle 11 미충족 | §5.3 | `spec/conventions/node-output.md` Principle 11 | Cafe24 §5.3 형식 참조해 예시 JSON + 필드 표 추가 |
| 7 | Convention Compliance | `3xx` 포트 설명과 에러 코드 표 불일치 — §3 포트에 "3xx" 포함, §6 에 `MAKESHOP_3XX` 코드 없음 | §3, §4 step 12, §6 | `spec/conventions/node-output.md` Principle 3 | §6 에 `MAKESHOP_3XX` 추가하거나 포트 설명에서 "3xx" 제거 및 redirect 정책 명시 |
| 8 | Convention Compliance | `MAKESHOP_AUTH_FAILED` 가 401/403 두 의미 조건을 단일 코드로 통합 — `error-codes.md` 의미 기반 원칙과 긴장 | §6 에러 코드 표, §6.1 | `spec/conventions/error-codes.md` §1 | Cafe24 패턴 유지 시 `error-codes.md §3` historical-artifact 레지스트리에 401+403 통합 코드 패턴 명시 등록 |
| 9 | Naming Collision | `MAKESHOP_SERVICE_UNAVAILABLE` 도입으로 클라이언트가 동일 조건을 두 코드로 처리해야 하는 불일치 생성 | §6 에러 코드 표 | `spec/4-nodes/4-integration/4-cafe24.md` §6 `INTEGRATION_SERVICE_UNAVAILABLE` | `INTEGRATION_SERVICE_UNAVAILABLE` 로 통일 |
| 10 | Plan Coherence | `cafe24-backlog-residual.md` C-6 항목 미갱신 — spec §9.8 이 편입 결정을 선언했으나 원본 plan 이 `[ ]` 미착수 상태로 남음 | §9.8 | `plan/in-progress/cafe24-backlog-residual.md` C-6 | C-6 항목에 "⏩ TRIGGERED (2026-06-03): makeshop-integration.md 로 편입" 주석 추가 |
| 11 | Plan Coherence | `spec/4-nodes/0-overview.md` 를 active worktree `spec-inprogress-groom-c7568b` 와 병렬 편집 — 머지 충돌 위험 | branch `claude/makeshop-api-catalog-730deb` | branch `claude/spec-inprogress-groom-c7568b` | 머지 순서 조율, 먼저 머지된 변경을 다른 브랜치가 rebase |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | MCP 도구 이름 sanitize 규칙 — 하이픈 포함 operationId 예시 `spec/5-system/11-mcp-client.md` §5.2 에 미명시 | §8.1 | §5.2 에 하이픈 → underscore 예시 추가 (선택) |
| 2 | Cross-Spec | `auth.makeshop.com` OAuth 호스트 — open question 으로 명시, 외부 확인 필요 | §4 step 6, §9.7 | 구현 착수 전 공식 문서 확인 task 트래킹 |
| 3 | Rationale Continuity | §9.1 Client-Credentials 기각 후 "재평가 가능" 단서 — 재평가 조건 미명시 | §9.1 | 재평가 트리거 조건(토큰 TTL 완화 등) 구체화 |
| 4 | Rationale Continuity | §4.1 timezone open question — 해소 시 `makeshop-api-metadata.md §5` 갱신 의무 미추적 | §4.1 | plan 체크리스트에 "timezone 확인 후 metadata §5 갱신" 항목 추가 |
| 5 | Rationale Continuity | §9.8 `buildIntegrationMeta` C-6 일반화 — 기존 Rationale 과 정합, 위반 없음 | §9.8 | (확인 기록) |
| 6 | Convention Compliance | 섹션 번호 5.1 → 5.3 점프 (5.2 없음) — Cafe24 §5 구조와 불일치 | §5 | 5.3 → 5.2 로 번호 변경 또는 인라인 참조 정리 |
| 7 | Convention Compliance | `output.error.details.retryable` 컬럼 에러 코드 표에 없음 — Cafe24 와 동일 생략 패턴이므로 규약 위반 아님 | §5.3, §6 | `MAKESHOP_RATE_LIMITED` / `MAKESHOP_TRANSPORT_FAILED` 에 retryable 명시 고려 |
| 8 | Convention Compliance | §8.1 도구 이름 매핑 표에 resource 간 동일 operationId 충돌 가능성 주석 없음 | §8.1 | "현재 catalog 상 충돌 없음" 주석 추가 권장 |
| 9 | Convention Compliance | `makeshop-api-metadata.md` `pending_plans` 이중 등록 — plan 이동 시 두 spec 파일 모두 갱신 필요 | frontmatter | plan 라이프사이클 이동 시 두 파일 동기 갱신 인식 |
| 10 | Convention Compliance | `spec-only` TTL 90일 카운터 시작 — 현재 위반 아님, 90일 내 착수 계획 있음 | frontmatter | `pending_plans` 등록으로 가드 대비 충분 |
| 11 | Naming Collision | `MakeshopOperationMetadata`, `MakeshopApiClient`, `MakeshopMcpToolProvider` — 모두 `Cafe24*` 패턴 일관 확장, 충돌 없음 | §4, §6, §8 | (확인 기록) |
| 12 | Naming Collision | `GET /api/integrations/services/makeshop/catalog` — 기존 spec 에서 Planned 케이스로 예약됨, 충돌 없음 | §4 step 11 | (확인 기록) |
| 13 | Plan Coherence | catalog-sync 테스트 미보호 상태 — plan 신설 시 체크리스트 항목으로 등재 필요 | §Overview 구현상태 블록 | `makeshop-integration.md` 에 "catalog-sync test 도입" 항목 추가 |
| 14 | Plan Coherence | §9.7 open question 4건 — plan 신설 시 구현 착수 체크리스트에 §9.7 항목 확정 단계 포함 필요 | §9.7 | `makeshop-integration.md` 구현 전 단계에 open question 확인 체크리스트 추가 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | HIGH | 4개 핵심 spec 파일 main 미갱신 (Critical 3건) + 2개 convention 파일 main 부재 (Warning 2건) |
| Plan Coherence | HIGH | `plan/in-progress/makeshop-integration.md` 미존재 (Critical 1건) + C-6 plan 상태 불일치 + 병렬 편집 위험 |
| Rationale Continuity | LOW | `MAKESHOP_SERVICE_UNAVAILABLE` 코드 발산 (Warning 1건), 나머지 Rationale 정합 |
| Convention Compliance | LOW | §5.3 JSON 예시 누락 + 3xx 불일치 (Warning 2건), 기본 규약 준수 |
| Naming Collision | LOW | `MAKESHOP_SERVICE_UNAVAILABLE` 일관성 불일치 (Warning 1건), 나머지 식별자 충돌 없음 |

---

## 권장 조치사항

1. **(BLOCK 해소 최우선)** 이 PR 에 포함되어야 할 파일 확인: worktree 내 이미 수정/추가된 `spec/1-data-model.md`, `spec/0-overview.md`, `spec/2-navigation/4-integration.md`, `spec/conventions/makeshop-api-metadata.md`, `spec/conventions/makeshop-api-catalog/` 전체가 PR 커밋에 포함되어 있는지 확인하고, 누락 시 추가 커밋.
2. **(BLOCK 해소)** `plan/in-progress/makeshop-integration.md` 신설: 구현 단계 목록·C-6 분해·§9.6 webhook 후속·§9.7 open question 확인·catalog-sync test 항목·`worktree:` frontmatter 포함.
3. **(BLOCK 해소)** `spec/2-navigation/4-integration.md` §5.9 MakeShop 절 추가 (dead link `#59-makeshop` 해소).
4. **(WARNING 해소)** `cafe24-backlog-residual.md` C-6 항목에 "⏩ TRIGGERED (2026-06-03): makeshop-integration.md 로 편입" 주석 추가.
5. **(WARNING 해소)** `5-makeshop.md` §6 에서 `MAKESHOP_SERVICE_UNAVAILABLE` 을 `INTEGRATION_SERVICE_UNAVAILABLE` 로 교체하거나 §9 Rationale 에 별도 코드 신설 근거 명시.
6. **(WARNING 해소)** `5-makeshop.md` §5.3 에 에러 출력 JSON 예시 + 필드 표 추가 (`node-output.md` Principle 11).
7. **(WARNING 해소)** §3 포트 설명과 §6 에러 코드 표의 3xx 불일치 해소: `MAKESHOP_3XX` 추가 또는 포트 설명에서 "3xx" 제거.
8. `spec/5-system/11-mcp-client.md` §2.3 에 MakeShop 두 번째 구현체 추가, `_product-overview.md` INT-US-05 표에 makeshop 행 추가 (이 PR 또는 후속 PR).
9. 병렬 편집 중인 `spec-inprogress-groom-c7568b` worktree 와 머지 순서 조율.