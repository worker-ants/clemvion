# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — Critical 위배 0건. WARNING 2건(동일 spec 문서 내 본문 표 vs Rationale 불일치, §5 진입 기준 완화 미문서화). 나머지 INFO 수준.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Rationale Continuity | `spec/5-system/15-chat-channel.md` §5.4 에러 응답 표가 R-CC-18 Rationale 선언(`400 WORKSPACE_ID_REQUIRED`)을 반영하지 않고 구 `401 WORKSPACE_REQUIRED`를 유지 — 같은 spec 문서 내 본문·Rationale 충돌 | `spec/5-system/15-chat-channel.md` §5.4 에러 응답 표 (line 340) | 동 파일 신설 Rationale `R-CC-18` | §5.4 해당 row를 `| 400 | WORKSPACE_ID_REQUIRED | X-Workspace-Id 헤더 누락 또는 JWT workspaceId 미포함 (@WorkspaceId() 데코레이터) |`로 갱신하고 `→ error-codes.md §5 Rename 이력` 주석 추가 |
| W-2 | Rationale Continuity | `spec/conventions/error-codes.md` §5 진입 조건을 "외부 client 코드 분기 미존재"로 묵시적 확대했으나 `## Rationale`에 별도 항 미신설 — 정책 변경 근거 미문서화 | `spec/conventions/error-codes.md` §5 intro 문구 | 동 파일 기존 `## Rationale` ("왜 rename 대신 신설인가") 및 §5 기존 intro | `## Rationale`에 `### §5 진입 기준 완화 — client 분기 기준 채택` 항 신설. "문서 목록 노출만으로는 client 분기가 생기지 않으므로 breaking impact 0" 논거 명문화 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `webhooks-setting.md` 파일명이 index 표 `webhooks_list` (path=`webhooks`)와 혼동 가능 — 실제 커버 대상은 `webhooks/setting` entity | `spec/conventions/cafe24-api-catalog/application/webhooks-setting.md` | `application.md` index ⚠ 주석 또는 `webhooks-setting.md` 서문에 대응 entity path 명시 |
| I-2 | Cross-Spec | `_overview.md §7.1`의 "(근거 §Rationale R-7)" self-ref 오해 가능 — 실제 R-7은 `spec-impl-evidence.md`에 있음 | `spec/conventions/cafe24-api-catalog/_overview.md` §7.1 | `[(근거 spec-impl-evidence §Rationale R-7)](../spec-impl-evidence.md#r-7--api-레퍼런스-카탈로그-필드-파일-제외-name-api-catalogresource)`로 앵커 링크화 |
| I-3 | Cross-Spec | `_overview.md §4` 검증규칙 8 vs `catalog-sync.spec.ts` 주석 "규칙7" 번호 1칸 어긋남 — 기존 acknowledged 비일관성 | `spec/conventions/cafe24-api-catalog/_overview.md` §4 규칙8 | 현상 유지 가능. 후속 정정 시 양쪽 동시 갱신 |
| I-4 | Cross-Spec | cafe24 `_overview.md §7` field-level 레이어 신설이 MakeShop catalog와 구조 차이 미명시 | `spec/conventions/cafe24-api-catalog/_overview.md` §7 | `makeshop-api-catalog/_overview.md`에 "field-level 상세 레이어 미제공, 필드 SoT = `openapi/<section>.openapi.json`" 한 줄 추가 권장 |
| I-5 | Rationale Continuity | `spec/conventions/error-codes.md` §5 HTTP 컬럼이 대체 코드 기준인지 구 코드 기준인지 미명시 — HTTP status 변경 동반 케이스에서 모호성 첫 노출 | `spec/conventions/error-codes.md` §5 표 헤더 | §5 Rationale 또는 intro에 "HTTP status 변경을 수반하는 경우 비고에 명기한다" 한 줄 추가 (선택적) |
| I-6 | Convention Compliance | `spec/conventions/error-codes.md` §5 서두 문구가 두 케이스(완전 제거 / user-docs만 노출)를 하나 문장으로 혼재 | `spec/conventions/error-codes.md` §5 intro | 두 케이스를 (a)/(b) 형태로 명시적으로 나열 (필수 아님) |
| I-7 | Convention Compliance | `application/appstore-orders.md` 응답 래퍼 `order` 설명이 §7.2 규약의 `(응답 객체)` 대신 정렬 파라미터 설명으로 오기재 — pre-existing 파일, 본 PR 변경 아님 | `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` | `| \`order\` |  | (응답 객체) |`로 수정 (생성기 산출물이지만 수동 정정 필요) |
| I-8 | Convention Compliance | `category.md` `[^seed]` 각주 포함 status 값 vs `_overview.md §3` status enum 각주 허용 여부 미명시 | `spec/conventions/cafe24-api-catalog/category.md` | `_overview.md §3` status enum 정의에 각주 허용 여부 명시 또는 파서 주석으로 의도 확인 |
| I-9 | Plan Coherence | `fix-spec-frontmatter-catalog.md` 플랜 — 모든 체크박스 완료 상태로 `in-progress/` 잔류 | `plan/in-progress/fix-spec-frontmatter-catalog.md` | `plan/complete/`로 이동 (본 PR 범위 밖, 차단 아님) |
| I-10 | Plan Coherence | `cafe24-backlog-residual.md` G-1-remaining / G-3 잔여 항목 — active worktree 없음, 본 PR와 경합 없음 | `plan/in-progress/cafe24-backlog-residual.md` | G-1-remaining 착수 시 별도 worktree 배정 확인 |
| I-11 | Plan Coherence | `exec-park-durable-resume.md` W3(`error-codes.md §3` polish) — 본 PR 변경 섹션(`§5`)과 직교, 경합 없음 | `plan/in-progress/exec-park-durable-resume.md` | W3 후속 PR에서 `§3`만 수정하면 됨 |
| I-12 | Naming Collision | `WORKSPACE_ID_REQUIRED` 신규 식별자 충돌 없음 — `spec/5-system/3-error-handling.md`, `15-chat-channel.md`, codebase 구현·i18n 모두 정합 | `spec/conventions/error-codes.md` §5 신규 row | 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | INFO 4건 — 명명 혼동 가능성, 앵커 링크 누락, acknowledged 번호 어긋남, MakeShop 구조 차이 미명시. 직접 모순 없음 |
| Rationale Continuity | LOW | WARNING 2건 — §5.4 본문 표가 R-CC-18 Rationale 미반영(스펙 내부 불일치), §5 진입 기준 완화 Rationale 미문서화 |
| Convention Compliance | LOW | INFO 3건 — §5 서두 케이스 혼재, `appstore-orders.md` 응답 래퍼 오기재(pre-existing), `[^seed]` 각주 허용 미명시. 규약 직접 위반 없음 |
| Plan Coherence | NONE | INFO 3건 — 플랜 미이동 1건, active worktree 경합 0건. 차단 항목 없음 |
| Naming Collision | NONE | 충돌 식별자 0건. `WORKSPACE_ID_REQUIRED` canonical 정의 정합, 은퇴 코드 소스에서 완전 제거 확인 |

## 권장 조치사항

1. **(W-1 해소 — 스펙 내부 불일치)** `spec/5-system/15-chat-channel.md` §5.4 에러 응답 표의 `WORKSPACE_REQUIRED / 401` row를 `WORKSPACE_ID_REQUIRED / 400`으로 갱신하고 `→ error-codes.md §5` 주석 추가.
2. **(W-2 해소 — Rationale 미문서화)** `spec/conventions/error-codes.md` `## Rationale`에 `### §5 진입 기준 완화 — client 분기 기준 채택` 항 신설, "문서 목록 노출만으로는 client 분기가 생기지 않으므로 breaking impact 0" 논거 명문화.
3. **(I-9 정리)** `plan/in-progress/fix-spec-frontmatter-catalog.md` → `plan/complete/`로 이동 (별도 커밋 가능).
4. **(I-7 선택적)** `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` 응답 래퍼 `order` 설명 `(응답 객체)`로 수정 — pre-existing 오기재, 별도 트랙.
5. **(I-2 선택적)** `_overview.md §7.1` R-7 참조를 `spec-impl-evidence.md` 앵커 링크로 명시.