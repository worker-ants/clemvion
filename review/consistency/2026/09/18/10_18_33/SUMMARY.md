# Consistency Check 통합 보고서

**BLOCK: YES** — convention_compliance 가 CRITICAL 1건(깨진 자기참조 앵커, build 차단)을 발견

## 전체 위험도
**MEDIUM** — Critical 은 1건이며 target draft 안에서 문자열 한 곳만 고치면 해소되는 국소 결함(placeholder 앵커). 나머지는 WARNING 2건(실측 오차/구조적 선례 우려)과 다수의 INFO.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | C10 이 `spec/conventions/spec-impl-evidence.md §3.1` 에 신규 삽입할 문장의 자기참조 앵커가 `([R-5](#r-5-…))` 로 placeholder 상태(미완성 `…`)로 남아 있음. 이 문서 자신이 규정한 `spec-link-integrity.test.ts`(§4.2, in-repo 앵커는 실제 `github-slugger` 슬러그와 일치해야 함)를 어겨 그대로 반영 시 build 차단 | `plan/in-progress/spec-draft-deletion-release-current-tense.md` §"변경안 > C10", `spec/conventions/spec-impl-evidence.md §3.1` 하위 불릿 마지막 줄 | `spec/conventions/spec-impl-evidence.md §4.2` (`spec-link-integrity.test.ts`) | `([R-5](#r-5-…))` 를 실제 슬러그 `([R-5](#r-5-status-partial-의-pending_plans-의무화--plan-라이프사이클-역방향-강제))` 로 교체 (다른 "…" 는 기존 인용 축약이라 그대로 두어도 무방 — 이 한 곳만 신규 삽입 콘텐츠) |

## planner 인계 (권한 밖 Critical)

(없음) — 위 Critical 은 검토 대상 draft 자신(`spec-draft-deletion-release-current-tense.md`) 안의 신규 삽입 문구 오류이며, 이 draft 를 작성 중인 바로 그 턴(project-planner, `spec/` 쓰기 권한 보유)이 직접 정정 가능하다. 권한 밖 원인이 아니므로 인계 불필요.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity (중복 지적, 상위 등급 채택) | C10 Rationale(R-5) 추가 문단의 "2026-09-18 기준 spec 3개 문서가 같은 트래커(`spec-draft-nullable-notation-followups.md`)를 `pending_plans` 로 가리켰다" 는 실측 수치가 실제보다 1개 적음 — 전수 확인 결과 `1-workflow-list.md`·`2-trigger-list.md`·`secret-store.md` 외 `chat-channel-adapter.md` 도 같은 트래커를 실제 리스트 엔트리로 가짐(YAML 주석 3줄 뒤라 얕은 grep 으론 누락되기 쉬움) | draft `### C10` 아래 `## Rationale` → R-5 추가 문단 | `spec/2-navigation/1-workflow-list.md`, `2-trigger-list.md`, `spec/conventions/secret-store.md`, `spec/conventions/chat-channel-adapter.md` 의 각 `pending_plans:` | R-5 문장을 "4개 문서(`secret-store.md` 포함)" 로 정정하거나 "이 문서를 제외한 다른 3개 문서"처럼 모집단(적용 전 vs 적용 후 잔여)을 명시. 새 규약(C10)의 동기 서술 오류는 향후 `chat-channel-adapter.md` 등 승격 판단 시 재인용될 수 있어 지금 정정이 저렴 |
| 2 | rationale_continuity | C10(공유 트래커 조기 승격 규약)이 신설되는 시점과 그 규약이 적용되는 시점이 같은 PR — `spec-status-lifecycle.test.ts` (c) 가 기계적으로 강제하던 "승격 = pending_plans 전부 complete/ 이동" 원칙(§3.1, R-5)을, 그 가드가 보지 않는 방향(조기 승격)에 한해 **문서화된 수기 판정**으로 대체하며, 그 판정의 첫 수혜자가 판정을 신설한 문서(`secret-store.md`) 자신 | `### C10. spec/conventions/spec-impl-evidence.md §3.1` + `## Rationale` ↔ `### C7. spec/conventions/secret-store.md frontmatter` | 기존 §3.1 문언("마지막 `pending_plans` 가 `complete/` 로 이동한 commit 안에서 승격") 및 R-5 취지("가드가 자연스럽게 발견") | (a) C10 의 일반 규칙 신설과 C7 의 첫 적용을 커밋 상 논리적으로 분리하거나, (b) 최소한 C10 Rationale 에 "이 규칙의 첫 적용 대상이 이 규칙을 신설한 문서 자신" 이라는 이해상충 성격을 한 문장으로 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | §3.1 신규 하위 불릿의 중첩 레벨 표기가 모호(들여쓰기 없는 예시 블록 vs "하위 불릿" 지시문) | C10 지시문 + 예시 코드블록 | 실제 반영 시 2-space 들여쓰기로 자식 불릿 명시하거나 지시문을 "별도 최상위 불릿"으로 명확화 |
| 2 | convention_compliance | 신규 결정(공유 트래커 승격 판정 시점)을 기존 R-5 말미에 덧붙이고 신규 R 번호(R-11 등)를 부여하지 않음 | C10 — `## Rationale` R-5 끝 | 필수는 아니나 검색성을 위해 별도 번호 분리 고려 |
| 3 | rationale_continuity | 트리거 정리의 `ModuleRef.get(strict:false)` 채택 사유가 `execution-engine.md §4.4` 표의 두 기준(모듈 순환 vs 인스턴스화-순서 함정) 중 어느 쪽인지 draft 가 직접 확인하지 않고 "비대상" 판정 | `## 비대상` 표 1행 | `TriggersModule`/`WorkflowsModule`/`WorkspacesModule` `imports` 그래프를 실측해 표에 근거 한 문장 보강, 또는 비대상 판정이 이 구분에 의존함을 명시 |
| 4 | plan_coherence | 트래커 row 6(`ModuleRef` 지연 해석 표 추가 지시)을 draft 가 "비대상" 사유로 사후에 미실행 처리 — 원 review round 의 등재 지시를 뒤집는 결정이나 투명하게 문서화됨 | draft `## 비대상 — 트래커 6행을 하지 않는 이유` 표 | 현재 처리도 수용 가능. 선택적으로 `plan/complete/trigger-deletion-release.md` INFO 2 처분 기록에 "미실행 확정" 각주 보강 |
| 5 | naming_collision | 신규 코드/e2e 경로 4건, 섹션 번호, "공유 트래커" 신조어, plan 파일 경로 전수 확인 — 충돌 없음(관찰 사항, 조치 불요) | 각 해당 파일 frontmatter/본문 | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 8개 spec 문서 간 사실관계(잠금 순서·5초 상한·권한 선검사·unregister 단일화) 전부 코드와 일치. R-5 실측 수치 1개 누락(WARNING) |
| rationale_continuity | LOW | D1~D7 계약 무변경, C1/C2/C6 실측 정확. C10 조기 승격 규약의 자기적용 구조(WARNING) + INFO 2건 |
| convention_compliance | MEDIUM | frontmatter·상태전이·앵커 대부분 준수하나 C10 신규 삽입 앵커가 placeholder 상태로 CRITICAL 1건 |
| plan_coherence | LOW | 트래커 7개 지시 정확히 실행, 형제 항목·타 in-progress plan 과 충돌 없음. row 6 미실행 처리(INFO) |
| naming_collision | NONE | 신규 식별자 도입 없음, 기존 항목 재사용/공유 등재 패턴과 일치 |

## 권장 조치사항
1. **(BLOCK 해소)** C10 텍스트의 `([R-5](#r-5-…))` 를 실제 슬러그 `([R-5](#r-5-status-partial-의-pending_plans-의무화--plan-라이프사이클-역방향-강제))` 로 교체한 뒤 `spec/conventions/spec-impl-evidence.md` 에 반영.
2. C10 Rationale(R-5) 의 "공유 트래커 3개 문서" 를 4개(`chat-channel-adapter.md` 포함)로 정정하거나 모집단을 명확히 표기.
3. C10 이 신설하는 조기 승격 규칙과 그 규칙의 자기 자신(`secret-store.md`)에 대한 즉시 적용 사이의 이해상충 성격을 Rationale 에 한 문장으로 명시.
4. (선택) §3.1 하위 불릿 들여쓰기 명확화, R-5 확장 대신 R-11 신설 검토, `ModuleRef.get` 비대상 판정 근거를 모듈 그래프 실측으로 보강.
