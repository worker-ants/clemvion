# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**MEDIUM** — 규약 직접 위반(frontmatter 누락) 1건 Critical, 캔버스 요약 포맷 inter-spec 불일치 및 Rationale 누락 복수 건 WARNING, 식별자·다이어그램·scope 미반영은 INFO 수준.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `spec/4-nodes/0-overview.md` 에 `spec-impl-evidence` 의무 frontmatter 전체 누락. `spec/4-nodes/**` 패턴 적용 대상이나 YAML frontmatter(`id:`, `status:`, `code:`, `pending_plans:`) 없음. `§4 플러그인 SDK` 미구현 surface 가 plan orphan 상태 | `spec/4-nodes/0-overview.md` 파일 상단 | `spec/conventions/spec-impl-evidence.md §1` 적용 대상 규정 | 파일 상단에 `id: nodes-overview`, `status: partial`, `code: [codebase/backend/src/nodes/**, codebase/packages/node-summary/**]`, `pending_plans: [plan/in-progress/<노드-플러그인-SDK-plan>.md]` frontmatter 추가 |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | Template 캔버스 요약 포맷 불일치 — `0-common.md` 는 단일 행 `{{outputFormat}} · {{buttons.length}} buttons`, `5-template.md §9` 는 구 두-변형(버튼 없음 `{N} lines` / 버튼 있음 `{N} buttons`) 유지 | `spec/4-nodes/6-presentation/0-common.md §5` | `spec/4-nodes/6-presentation/5-template.md §9` (lines 297-300) | `5-template.md §9` 캔버스 요약을 `0-common.md` 의 단일-행 `summaryTemplate` 기술에 맞춰 동기화 |
| 2 | Cross-Spec | Send Email 캔버스 요약 포맷 불일치 — `0-common.md` 는 `{{to.length}} recipients · {{subject}}`, `3-send-email.md §7` 은 구 포맷 `to: {수신자} +N` 유지 | `spec/4-nodes/4-integration/0-common.md §5` (line 99) | `spec/4-nodes/4-integration/3-send-email.md §7` (line 328) | `3-send-email.md §7` 캔버스 요약을 `{{to.length}} recipients · {{subject}}` 로 동기화 |
| 3 | Cross-Spec | Database Query 캔버스 요약 포맷 불일치 — `0-common.md` 는 `{{queryType|upper}} · {{query}}` (구현됨), `2-database-query.md §7` 은 `{queryType} · {쿼리 첫 줄}` 유지 | `spec/4-nodes/4-integration/0-common.md §5` (line 98) | `spec/4-nodes/4-integration/2-database-query.md §7` (lines 353-355) | `2-database-query.md §7` 을 `{{queryType|upper}} · {{query}}` (구현됨)으로 동기화 |
| 4 | Rationale Continuity | ForEach `$itemIsFirst`/`$itemIsLast` 노출 승격 — 원본 spec 에서 "내부 상태이며 expression 으로 노출되지 않는다"는 설계 결정을 Rationale 없이 번복 | `spec/4-nodes/1-logic/9-foreach.md §3.3`, `spec/5-system/5-expression-language.md §표` | `spec/4-nodes/1-logic/9-foreach.md` (origin/main) §3.3 원문 | `9-foreach.md` 에 `## Rationale` 섹션 추가 — "왜 내부 상태에서 expression 노출 변수로 승격했는가" + `$item` 이 raw 값이라 속성 부착 불가한 제약 명시 |
| 5 | Rationale Continuity | node-common `§2.5.2` 타입별 기본값 테이블 — 요구사항으로 기술된 정책을 Rationale 없이 "미구현 (Planned)" 으로 강등하고 `null` 단일 폴백으로 축소 | `spec/3-workflow-editor/1-node-common.md §2.5.2` | `spec/3-workflow-editor/1-node-common.md` (origin/main) §2.5.2 타입별 기본값 테이블 | `1-node-common.md` 에 `## Rationale` 섹션(또는 inline note) 추가 — "타입별 기본값 추론이 Planned 로 연기된 이유 + 현재 `null` 단일 폴백 운영 근거" 기록 |
| 6 | Convention Compliance | `spec/conventions/` 내 `## Overview` 헤딩 형식 혼용 — `spec-impl-evidence.md` 는 `## Overview (제품 정의)`, `migrations.md`·`swagger.md`·`error-codes.md` 는 `## Overview`(괄호 없음) | `spec/conventions/migrations.md` (line 15), `spec/conventions/swagger.md` (line 10), `spec/conventions/error-codes.md` (line 10) | `spec/conventions/spec-impl-evidence.md` (line 19) | `## Overview (제품 정의)` 형식으로 통일하거나, conventions 파일은 괄호 없음 허용 예외를 CLAUDE.md 에 명문화 |
| 7 | Plan Coherence | `spec-sync-foreach-gaps`, `spec-sync-node-common-gaps`, `spec-sync-data-common-gaps`, `spec-sync-template-gaps` 4개 plan — "결정 필요" 섹션을 보유한 채 `complete/` 로 이동됐고, 각 결정의 선택 근거가 plan 에 미기록 | `plan/complete/spec-sync-foreach-gaps.md`, `plan/complete/spec-sync-node-common-gaps.md`, `plan/complete/spec-sync-data-common-gaps.md`, `plan/complete/spec-sync-template-gaps.md` | `plan/complete/spec-sync-embedding-pipeline-gaps.md` (결정 기록 섹션 있음, 비교 기준) | 각 plan 파일 끝에 "결정 (2026-06-03): 선택지·근거" 섹션 추가 (foreach: (a) top-level 변수 채택, node-common: nested errorHandling, data/template: DSL 확장 대신 downscope) |
| 8 | Plan Coherence | integration-common spec — `to.length recipients` downscope 결정이 plan 에는 기록됐으나 spec 본문(`0-common.md`)에 downscope 근거가 없어 spec 독립 가독성 저하 | `spec/4-nodes/4-integration/0-common.md` summaryTemplate 표 | `plan/in-progress/spec-sync-integration-common-gaps.md` (plan 에는 downscope 기록됨) | `0-common.md` 의 summaryTemplate 표 하단 또는 Rationale 절에 downscope 근거 1줄 추가 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | 실행 엔진 context 변수 테이블에 `$itemIsFirst`/`$itemIsLast` 미등재 | `spec/5-system/4-execution-engine.md §Expression Context` (line 544) | `$item`, `$itemIndex` 행에 `$itemIsFirst`, `$itemIsLast` 추가 |
| 2 | Cross-Spec | `data-flow/6-knowledge-base.md` 시퀀스 다이어그램 INSERT 컬럼에 `metadata` 생략 | `spec/data-flow/6-knowledge-base.md` 시퀀스 다이어그램 line 74 | INSERT 컬럼 목록에 `metadata` 추가 |
| 3 | Cross-Spec | `config.errorHandling` nested 경로가 `spec/5-system/3-error-handling.md §3.3` 에 미반영 | `spec/5-system/3-error-handling.md §3.3` | "`config.errorHandling.retryConfig.*` 경로 저장. SoT: `1-node-common.md §2.4`" 참조 추가 |
| 4 | Rationale Continuity | node-common `§2.5.1` 버튼 레이블 "Reset to Type Default" → "Reset to Default" 변경 — §2.5.2 Rationale 와 연계 서술 가능 | `spec/3-workflow-editor/1-node-common.md §2.5.1` | §2.5.2 Rationale 작성 시 레이블 변경도 같이 설명 |
| 5 | Rationale Continuity | Code 노드 캔버스 요약 `{{language|upper}}` — `{N} lines` 포기가 permanent 결정인지 DSL 확장 후 revisit 대상인지 미명시 | `spec/4-nodes/5-data/0-common.md §5` | summaryTemplate DSL 한계 섹션 또는 inline 에 "개행 카운트 미지원 → Code 노드 줄 수 표시 불가 (final/revisit 분류)" 명시 |
| 6 | Rationale Continuity | Template 노드 캔버스 요약 단일화 — 버튼 0개 시 표시 동작 미명시 | `spec/4-nodes/6-presentation/0-common.md §Rationale` | 기존 Rationale 에 "`{N} lines` 변형 포기 이유 + 버튼 0개 시 표시 동작(`0 buttons` 또는 빈 값)" 추가 |
| 7 | Rationale Continuity | embedding-pipeline `Document.metadata` 구현 완료 처리 — 기존 Rationale 에 완료 내역 미기록 | `spec/5-system/8-embedding-pipeline.md §Rationale` | 기존 "결정: spec 정합성 정비" 항목에 metadata 채우기 구현 완료 내역 한 줄 추가 (선택) |
| 8 | Convention Compliance | `spec/2-navigation/` 파일 번호 12번 gap (11, 13 연속) | `spec/2-navigation/` 폴더 | 의도적 gap 이면 무시. 삭제 흔적이면 주변 문서 링크 검사 권장 |
| 9 | Naming Collision | `$itemIsFirst`/`$itemIsLast` — `spec/3-workflow-editor/1-node-common.md §3.3` 컨테이너 스코프 목록에 미반영 | `spec/3-workflow-editor/1-node-common.md §3.3` | 컨테이너 스코프 행을 `$loop` / `$item` / `$itemIndex` / `$itemIsFirst` / `$itemIsLast` 로 확장 |
| 10 | Naming Collision | `$itemIsFirst`/`$itemIsLast` — Map 노드 적용 범위 미명시 (ForEach 전용으로만 기술, Map 도 동일 `itemContext` 구조 사용) | `spec/4-nodes/1-logic/7-map.md`, `spec/5-system/5-expression-language.md` | `7-map.md` 의 `$item`/`$itemIndex` 바인딩 설명에 `$itemIsFirst`/`$itemIsLast` 노출 여부 명시 또는 `expression-language.md` 행 설명을 "ForEach / Map" 으로 확장 |
| 11 | Naming Collision | summaryTemplate DSL 에서 `to.length` 프로퍼티 접근 사용 — `spec/4-nodes/0-overview.md §1.4.1` DSL 문서에 배열 프로퍼티 접근 지원 여부 미기술 | `spec/4-nodes/0-overview.md §1.4.1` | DSL 설명에 `array.length` 접근 지원 여부 명시 또는 send-email 요약 예시 추가 |
| 12 | Plan Coherence | `spec-sync-structural-followups.md §스펙 승격 위임` — `spec-update-c-sync-promotions.md` 미생성 (target 이 직접 처리) | `plan/in-progress/spec-sync-structural-followups.md` | "→ spec-inprogress-impl2 에서 직접 처리 완료 (2026-06-03). spec-update-c-sync-promotions.md 미생성." 비고 한 줄 추가 |
| 13 | Plan Coherence | `spec-sync-expression-language-gaps.md` — `$itemIsFirst`/`$itemIsLast` 추가가 plan 에 미언급 | `plan/in-progress/spec-sync-expression-language-gaps.md` | "처리 결과" 섹션에 `$itemIsFirst`/`$itemIsLast` 추가 (foreach-gaps 결정 (a) 파생) 한 줄 추가 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | 캔버스 요약 포맷 3건 WARNING (0-common ↔ 노드별 상세 spec 미동기화), 실행 엔진 context 변수 테이블 / data-flow 다이어그램 INFO 2건 |
| Rationale Continuity | MEDIUM | ForEach 내부상태→노출 번복 Rationale 부재 (WARNING), node-common 타입별 기본값 정책 축소 Rationale 부재 (WARNING), INFO 4건 |
| Convention Compliance | MEDIUM | `spec/4-nodes/0-overview.md` frontmatter 전체 누락 (CRITICAL), conventions 헤딩 형식 혼용 (WARNING), 번호 gap (INFO) |
| Plan Coherence | LOW | 4개 plan 결정 기록 누락 (WARNING × 4 — 기술적 결정은 올바름, 추적성 결함), INFO 2건 |
| Naming Collision | LOW | 의미 충돌 0건. 신규 식별자 scope/DSL 문서 미반영 INFO 3건 |

---

## 권장 조치사항

1. **(BLOCK 해소 우선)** `spec/4-nodes/0-overview.md` 파일 상단에 `spec-impl-evidence` 규약 준수 frontmatter 추가 (`id: nodes-overview`, `status: partial`, `code:`, `pending_plans:`).
2. `spec/4-nodes/6-presentation/5-template.md §9`, `spec/4-nodes/4-integration/3-send-email.md §7`, `spec/4-nodes/4-integration/2-database-query.md §7` 캔버스 요약 포맷을 `0-common.md` 기준으로 동기화 (WARNING 1~3).
3. `spec/4-nodes/1-logic/9-foreach.md` 에 `## Rationale` 섹션 추가 — `$itemIsFirst`/`$itemIsLast` 내부상태→노출 승격 근거 (WARNING 4).
4. `spec/3-workflow-editor/1-node-common.md` 에 `## Rationale` 섹션(또는 inline note) 추가 — 타입별 기본값 정책 축소 근거 (WARNING 5).
5. `plan/complete/spec-sync-foreach-gaps.md`, `spec-sync-node-common-gaps.md`, `spec-sync-data-common-gaps.md`, `spec-sync-template-gaps.md` 각각에 결정 기록 섹션 추가 (WARNING 7).
6. `spec/conventions/` 헤딩 형식 통일 — `## Overview (제품 정의)` 또는 CLAUDE.md 예외 명문화 (WARNING 6).
7. INFO 항목은 BLOCK 해소 후 순차 처리 권장: 실행 엔진 context 변수 테이블, node-common §3.3 컨테이너 스코프 목록, Map 노드 `$itemIsFirst`/`$itemIsLast` 적용 범위, DSL 문서 `array.length` 지원 명시 등.