# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**CRITICAL** — `spec/conventions/spec-impl-evidence.md` §1 제외 섹션에서 PR #453(OPEN)과 직접 라인 충돌 존재. 머지 순서 조율 또는 통합 없이는 선행 변경이 롤백되거나 conflict 발생 불가피.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | `spec/conventions/spec-impl-evidence.md` §1 제외 섹션을 target branch 와 fix-spec-frontmatter-catalog(PR #453 OPEN)가 동일 라인 범위(40-45)에서 각각 수정 — 병합 시 conflict 불가피 | `spec/conventions/spec-impl-evidence.md` 라인 40-43 | PR #453 `fix-spec-frontmatter-catalog` branch (OPEN) | target branch 머지 전 PR #453을 먼저 머지하거나, target branch가 §1 제외 섹션 재작성 시 `R-7` cafe24-api-catalog 제외 불릿도 함께 통합. 어느 한쪽이 main 반영 후 다른 쪽이 rebase 해야 함 |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | PRD(`_product-overview.md`) NAV-WF-02에서 "마지막 실행 시간"을 `✅`(구현 완료)로 표시하나 상세 spec(`1-workflow-list.md §2.1`)은 `updatedAt`(수정 시각) 구현, `lastRunAt` 미구현(Planned)으로 선언 — 직접 모순 | `spec/2-navigation/1-workflow-list.md §2.1` | `spec/2-navigation/_product-overview.md §3.1 NAV-WF-02` | `_product-overview.md` NAV-WF-02 상태를 `🚧`로 수정하거나, 요구사항 원문 "마지막 실행 시간"을 "마지막 수정 시간"으로 정정하고 마지막 실행 시각을 별도 항목으로 분리 |
| 2 | Cross-Spec | `Notification.type` 7종 중 `background_failed`·`integration_action_required` 2종이 user-profile 알림 설정 표(§5.1)에 누락 | `spec/1-data-model.md §2.19 Notification.type` | `spec/2-navigation/9-user-profile.md §5.1` | `9-user-profile.md §5.1` 표에 누락 2행 추가하여 data model SoT와 동기화 |
| 3 | Plan Coherence | `spec/4-nodes/4-integration/0-common.md` 캔버스 요약 표의 Database Query·Send Email 행을 target branch와 makeshop-api-catalog branch(fallback ACTIVE)가 서로 다른 값으로 병렬 수정 중 — 나중 머지 시 선행 변경 롤백 위험 | `spec/4-nodes/4-integration/0-common.md §5` | `makeshop-api-catalog` branch (PR 없음, fallback ACTIVE) | target branch → main 먼저 반영 후 makeshop branch rebase. 또는 makeshop branch가 Database Query·Send Email 행도 최신화 |
| 4 | Naming Collision | `$item.index`(Split 출력 객체 속성)와 `$itemIndex`·`$itemIsFirst`·`$itemIsLast`(ForEach top-level 변수)가 `execution-engine.md §3.4.2` 다이어그램과 변수 표에 인접 배치 — 독자 혼동 가능 | `spec/5-system/4-execution-engine.md §3.4.2` | `spec/4-nodes/1-logic/9-foreach.md §3`, `spec/5-system/5-expression-language.md` | `execution-engine.md §3.4.2` 다이어그램 `$item.index = 1` 에 `-- $item is a Split output object { index, value }` 주석 추가, 또는 ForEach top-level 변수 표에 "`$item.index`는 `$item` 객체의 속성 — `$itemIndex`와 무관" 한 줄 노트 추가 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `0-dashboard.md §5` 트리거 출처 5종에 chat_channel 변형 라벨 처리 방침 미기술 | `spec/2-navigation/0-dashboard.md §5`, `spec/2-navigation/14-execution-history.md §2.4` | `14-execution-history.md §2.4` 출처 분류 표에 `Trigger.config.chatChannel` 존재 시 보조 라벨 처리 방침 INFO 수준 명시 |
| 2 | Cross-Spec | `spec/0-overview.md §6.2` 임베드형 웹채팅 위젯 `🚧` 분류 — `spec/7-channel-web-chat/_product-overview.md` status 필드와 참조 동기화 필요 | `spec/0-overview.md §6.1, §6.2` | 보안 후속 완료 시 §6.1 이동 시점에 두 위치 동시 갱신 |
| 3 | Rationale Continuity | `canvas.md §5.3.4` summaryTemplate 포맷 변경 근거가 각 노드 spec에 위임됐으나 canvas.md 자체에 안내 노트 없음 | `spec/3-workflow-editor/0-canvas.md §5.3.4` | "포맷 변경 근거는 해당 노드 Rationale 참조" 한 줄 안내 노트 추가 |
| 4 | Rationale Continuity | `spec-impl-evidence.md §1` 제외 범위를 basename 매칭으로 확장한 근거에 대한 `## Rationale R-7` 항목 미추가 | `spec/conventions/spec-impl-evidence.md §Rationale` | R-7 항목 추가 — basename 기반 이유 및 영역 진입 문서 일괄 면제 원칙 명시 |
| 5 | Rationale Continuity | `presentation/0-common.md §5` Template 요약 포맷 통합 근거가 `5-template.md Rationale R-1`에만 있고 `0-common.md` 자체에 참조 노트 없음 | `spec/4-nodes/6-presentation/0-common.md §5` | `0-common.md §5` 표 아래에 "Template 포맷 통합 근거는 `5-template.md Rationale R-1` 참조" 한 줄 노트 추가 |
| 6 | Plan Coherence | `spec-sync-integration-common-gaps` plan의 `⚠ Missing integration` 배지 항목이 "티어3 보류"로 spec에 명시됨 — warningRule DSL 아키텍처 결정 선행 필요 | `spec/4-nodes/4-integration/0-common.md §5`, `plan/in-progress/spec-sync-integration-common-gaps.md` | 현 상태(spec에 Planned 명시 + plan in-progress 유지) 적절. 아키텍처 결정 시 재활성화 |
| 7 | Plan Coherence | `$trigger`/`$env` 런타임 주입이 plan에 "tier3 보류"로 남아있으며 target branch는 미접촉 | `spec/5-system/5-expression-language.md §4`, `plan/in-progress/spec-sync-expression-language-gaps.md` | 별도 planner 결정 시점에 처리 |
| 8 | Naming Collision | `retryDelay`(execution-engine §9 Integration 재시도)와 `retryInterval`(node-common errorHandling 스키마) 병용 — 기존 불일치, 본 diff 신규 악화 없음 | `spec/5-system/4-execution-engine.md:579`, `spec/3-workflow-editor/1-node-common.md:169` | 향후 `execution-engine.md §9` 표의 `retryDelay`를 `retryInterval`로 통일하거나 각 레이어 차이를 inline 주석으로 구분 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | PRD ↔ 상세 spec 간 `lastRunAt` 구현 완료/미구현 모순(WARNING 1), Notification.type 2종 user-profile 누락(WARNING 2) |
| Rationale Continuity | LOW | 주요 번복 결정 2건(`$itemIsFirst/$itemIsLast`, `null` 폴백)은 Rationale 완비. 문서화 보완 제안 3건(INFO) |
| Convention Compliance | 재시도 필요 | `convention_compliance.md` 파일 미존재 — checker 결과 없음, 재실행 필요 |
| Plan Coherence | CRITICAL | `spec-impl-evidence.md` §1 제외 섹션에서 PR #453(OPEN)과 직접 라인 충돌(CRITICAL 1). makeshop-api-catalog 인접 행 경합(WARNING 3) |
| Naming Collision | LOW | `$item.index` vs `$itemIndex`/`$itemIsFirst`/`$itemIsLast` 독자 혼동 가능성(WARNING 4). `retryDelay`/`retryInterval` 기존 불일치(INFO) |

---

## 권장 조치사항

1. **(BLOCK 해소 — 필수)** `spec/conventions/spec-impl-evidence.md` §1 제외 섹션 충돌 해소: PR #453(`fix-spec-frontmatter-catalog`)을 먼저 main에 머지하거나, target branch가 §1 제외 섹션 재작성 시 R-7 cafe24-api-catalog 불릿을 함께 통합. 어느 한쪽이 main 반영 후 다른 쪽 rebase.
2. **(WARNING — 머지 전 권장)** `spec/2-navigation/_product-overview.md` NAV-WF-02 상태를 `🚧`로 수정하거나 요구사항 원문 "마지막 실행 시간"을 "마지막 수정 시간"으로 정정.
3. **(WARNING — 머지 전 권장)** `spec/2-navigation/9-user-profile.md §5.1` 표에 `background_failed`·`integration_action_required` 2행 추가.
4. **(WARNING — 머지 순서 조율)** target branch → main 먼저 반영 후 makeshop-api-catalog branch rebase, 또는 makeshop branch가 Database Query·Send Email 행 최신화.
5. **(WARNING — 문서 명확성)** `spec/5-system/4-execution-engine.md §3.4.2` 다이어그램에 `$item.index` 설명 주석 또는 ForEach 변수 표에 혼동 방지 노트 추가.
6. **(INFO — 후속 보완)** `spec/conventions/spec-impl-evidence.md §Rationale` 에 R-7 항목 추가(basename 매칭 확장 근거).
7. **(INFO — 후속 보완)** `canvas.md §5.3.4` 및 `presentation/0-common.md §5` 에 노드별 Rationale 위임 안내 노트 추가.
8. **(재시도 필요)** Convention Compliance checker 결과 파일(`convention_compliance.md`) 미존재 — 해당 checker 재실행 후 결과 통합.