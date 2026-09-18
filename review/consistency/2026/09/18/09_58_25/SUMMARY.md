# Consistency Check 통합 보고서

**BLOCK: YES** — rationale_continuity checker 가 제기한 CRITICAL 1건 때문 (secret-store.md 승격이 R-5 "빈 약속" 방지 취지를 위반할 위험)

> **파일 복구 메모**: `convention_compliance` 는 status=`no_status` 였고 디스크에 `convention_compliance.md` 가 없었으나, 인라인 전문이 완전하게 제공되어 이번 턴에 그 경로로 그대로 영속화했다(Write 성공). 5개 checker 모두 전문 확보 완료 — 재시도 필요 항목 없음.

## 전체 위험도
**HIGH** — CRITICAL 1건은 권한 내(이 draft 자체를 쓰는 세션이 직접 수정 가능)이며 범위가 좁아 즉시 해소 가능. 나머지 4개 checker 는 LOW/NONE.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | `secret-store.md` 를 `status: implemented` 로 승격하며 `pending_plans` 를 통째로 비우는데, 같은 트래커 안에 이 문서를 명시 지목하는 **아직 미해소인** 별개 항목(2026-09-05 등재, `plan/in-progress/spec-draft-nullable-notation-followups.md:1099` — "열린 `config` 맵 안의 신규 비밀은 e2e `not.toHaveProperty` 를 동반해야 한다… `secret-store.md` 또는 `2-api-convention.md` 에 한 문장으로 못 박는다")를 감사하지 않음. `spec-impl-evidence.md` R-5 가 명시적으로 막으려던 "어떤 plan 도 책임지지 않는 빈 약속" 실패 모드를 재현할 위험. 같은 target 문서의 `### C8` 은 동일 상황에서 남은 항목을 확인하고 `status: partial` 을 올바르게 유지하는 대조 사례가 있음(C7 에는 이 대조 감사가 빠짐) | `plan/in-progress/spec-draft-deletion-release-current-tense.md` `### C7. spec/conventions/secret-store.md frontmatter` (118~126행) | `spec/conventions/spec-impl-evidence.md` `## Rationale` R-5 + `plan/in-progress/spec-draft-nullable-notation-followups.md:1099` | C7 을 (a) line-1099 항목의 착지점이 `secret-store.md` 인지 `2-api-convention.md` 인지 먼저 판정 → `secret-store.md` 가 배제됨을 확인한 뒤에만 `status: implemented` + `pending_plans` 삭제 적용하고 판정 근거를 draft 의 "실측"/Rationale 에 한 문장 기록, 또는 (b) C8 과 동일하게 `pending_plans` 참조 유지 + `status: partial` 로 두고 "남은 이유는 §1.1 인접 문장 미기입 하나" 라고 명시 |

## planner 인계 (권한 밖 Critical)

> `(없음)` — 이 CRITICAL 의 근본 원인은 이 draft(target) 자체의 내용(C7 절)이며, target 을 쓰는 세션(project-planner, `--spec` 사전 체크 단계)이 spec 확정 전에 직접 수정할 수 있는 범위 안에 있다. `developer` 권한 밖 spec drift 유형이 아니므로 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `secret-store.md` 의 `partial → implemented` 승격이 `spec-impl-evidence.md §3.1` 이 명시한 유일한 트리거("마지막 `pending_plans` 가 `complete/` 로 이동하는 commit 안에서 승격")를 거치지 않고 일어남 — 그 pending_plan 트래커 파일 자체는 다른 미해결 항목(성능 인덱스 등) 때문에 이번 PR 에서도 `plan/in-progress/` 에 남는다. 가드(`spec-status-lifecycle.test.ts`)는 이 방향의 조기 승격을 검출하지 못함. 선례(`aecf877c1`)는 있으나 예외 경로가 규약 문서에 명문화돼 있지 않음 | C7 (target 118~126행) | `spec/conventions/spec-impl-evidence.md` §3.1 | (a) C7 Rationale/secret-store.md 정정 각주에 "공유 트래커의 자기 몫만 끝나 승격" 취지 한 줄 추가, 또는 (b) `spec-impl-evidence.md §3.1` 에 여러 spec 이 같은 tracker plan 을 공유할 때의 독립 승격 예외 조항 명문화 |
| 2 | plan_coherence | `### C3` 이 편집하는 `2-trigger-list.md` frontmatter `code:` 리스트가, 같은 파일·같은 필드를 겨냥한 별도의 미해소 후속 항목(스케줄 타입 §3 `TriggerDto.workflow` 계약 시행 파일 `schedule-trigger.e2e-spec.ts` 누락 — `spec-draft-nullable-notation-followups.md:3974`, 2026-09-14 등재, requirement WARNING#1)과 조율되지 않은 채 커밋됨 | C3 (`spec/2-navigation/2-trigger-list.md` frontmatter `code:`) | `plan/in-progress/spec-draft-nullable-notation-followups.md:3974` | target PR 에 `schedule-trigger.e2e-spec.ts` 등재를 함께 묶거나, 최소한 draft 의 "비대상" 섹션에 "같은 frontmatter 를 겨냥하는 미해소 항목 존재, 별도 처리" 한 줄 남기기 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 트리거 자원 정리의 `resolveTriggerResourceReleaser`(throw 변형)가 `execution-engine.md §4.4` DI 순환 카탈로그 표에는 없고 코드 JSDoc 에만 있어, 같은 기법이 spec 레벨에서 두 곳(엔진 축 no-op / 트리거 축 throw)으로 분산 기록됨. draft 의 "비대상" 판단 자체는 표 스코프 선언과 부합해 타당 | draft "비대상 — 트래커 6행을 하지 않는 이유" 표 | `execution-engine.md §4.4` 표 상단에 "실행 엔진 모듈 축 한정" 각주 추가 검토(선택, 이번 범위 밖 가능) |
| 2 | cross_spec | 새로 문서화되는 "권한 선검사-재검사 창"이 #1345 의 `D7-N` 라벨 체계(D7-1~D7-3) 밖에 있음 — #1345 결정 당시엔 없던 창으로, 구현이 권한 검사를 외부 해제 앞으로 당기며 새로 생김 | C1 변경안 §4.3 다음 문단 | `plan/complete/spec-draft-deletion-releases-trigger-resources.md` §D7 완료 메모(트래커 쪽)에 "새 창은 D7 계열이 아니다" 한 줄 추가(선택, spec 본문 수정 불요) |
| 3 | rationale_continuity | 잠금 순서(워크스페이스→멤버십) 재작성의 교착 회피 근거가 표 셀 본문에만 있고 `12-workspace.md` `## Rationale` 절에는 등재되지 않음 | C6 (`12-workspace.md §1.10` 동작 칸) | `12-workspace.md` `## Rationale` 에 "§1.10 삭제 잠금 순서 = 소유권 이전과 동일(교착 회피)" 항목 추가 |
| 4 | rationale_continuity | checker 입력 번들에서 `10-triggers.md`/`11-workflow.md`/`12-workspace.md`/`15-chat-channel.md`/`secret-store.md` 의 `## Rationale` 이 예산 초과로 절단됨(방법론 메모, target 결함 아님) | 없음 | `--spec` 번들 예산에서 `spec_impact` 나열 파일 우선순위 상향 검토 |
| 5 | convention_compliance | draft 의 "실측 — 머지된 코드와 대조" 표가 `1-workflow-list.md §2.6`(L109, 이미 현재형·정확) 동종 사례를 다루지 않아 스스로 표방하는 전수 감사 범위와 어긋남 | draft 실측 표 | 표에 해당 행 추가(수정 불필요로 판정) 또는 검토 흔적 남기기(선택) |
| 6 | plan_coherence | `secret-store.md` 를 `implemented` 로 올리는 시점에 같은 문서의 `code:` 등재 여부를 묻는 별개의 미해결 질문(`followups.md:1921`)이 병존 — CRITICAL#1 과는 별개 질문(문서 위생 vs 미구현 surface) | C7 | 트래커 각주 유지로 충분, target 수정 불요 |
| 7 | plan_coherence | `1-workflow-list.md` frontmatter `pending_plans` 에 이미 `complete/` 로 이동한 `workflow-duplicate-nodes-edges.md` 가 잔존 — 결론(`status: partial` 유지)에는 영향 없음 | C8 | 이 PR 이 이 frontmatter 를 여는 김에 함께 제거(선택, 범위 밖 허용) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 모든 실측 주장(잠금 순서·5초 상한·롤백·권한 선검사 위치·`unregister` 단일화)이 코드와 일치. INFO 2건(카탈로그 분산, D7 라벨 밖 창) |
| rationale_continuity | MEDIUM | CRITICAL 1건(secret-store.md 승격이 미해소 항목 미감사) + INFO 2건(Rationale 미등재, 입력 절단) |
| convention_compliance | LOW | WARNING 1건(§3.1 승격 트리거 불일치, 선례 있으나 미명문화) + INFO 1건(실측표 누락 사례) |
| plan_coherence | LOW | WARNING 1건(C3 frontmatter code: 조율 공백) + INFO 2건(secret-store.md 질문 병존, stale pending_plans) |
| naming_collision | NONE | 신규 식별자 없음 — frontmatter 등재 3파일 모두 이미 머지된 기존 구현체, 절 번호·앵커 전부 실측 일치 |

## 권장 조치사항
1. (BLOCK 해소 우선) `### C7` 정정 — `plan/in-progress/spec-draft-nullable-notation-followups.md:1099` 항목의 착지점이 `secret-store.md` 인지 판정하고, 배제 확인 시에만 승격+삭제 적용(근거 기록), 아니면 C8 방식으로 `pending_plans` 유지 + `status: partial` 유지.
2. `### C3` — `schedule-trigger.e2e-spec.ts` 를 `2-trigger-list.md` frontmatter `code:` 에 함께 등재하거나, 비대상 섹션에 조율 필요 사실을 한 줄 남긴다.
3. (선택, 범위 밖 허용) `12-workspace.md` `## Rationale` 에 잠금 순서 교착 회피 근거 추가, `execution-engine.md §4.4` 표 스코프 각주, `spec-impl-evidence.md §3.1` 공유 트래커 예외 조항 명문화, `1-workflow-list.md` stale pending_plans 정리, 실측표 `1-workflow-list.md §2.6` 행 보완.
