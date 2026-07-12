# Consistency Check 통합 보고서

**BLOCK: NO** — 확보된 3/5 checker 결과에서 Critical 위배 없음. 단, 2개 checker(`convention_compliance`, `naming_collision`)는 manifest 상 `status=success` 로 보고됐으나 예상 출력 경로(`.../convention_compliance.md`, `.../naming_collision.md`)에 파일이 존재하지 않아 내용을 검증하지 못했다 (Workflow disk-write 갭 — 아래 §미수집 Checker 참조). 이 두 영역은 재실행 전까지 "정합" 여부가 확인되지 않은 상태이며, 재실행 결과에 따라 BLOCK 판정이 바뀔 수 있다.

## 전체 위험도
**MEDIUM (불완전 — 2/5 checker 미수집)** — 확보분 기준 실질 위험은 plan↔spec 추적성 갭(WARNING 2건) + SDK 재사용 서술 불일치(WARNING 1건)로 MEDIUM. `convention_compliance`/`naming_collision` 미확보로 그 영역의 Critical 잠재 위험은 아직 배제되지 않았다.

## 미수집 Checker — 재시도 필요 (Workflow disk-write 갭)

| Checker | manifest 보고 status | 기대 output_file | 실제 확인 결과 |
|---|---|---|---|
| convention_compliance | success | `review/consistency/2026/07/12/11_54_56/convention_compliance.md` | 파일 부재 (`ls` 확인) — 내용 유실, 재실행 필요 |
| naming_collision | success | `review/consistency/2026/07/12/11_54_56/naming_collision.md` | 파일 부재 (`ls` 확인) — 내용 유실, 재실행 필요 |

참고: `_prompts/convention_compliance.md`(157KB), `_prompts/naming_collision.md`(318KB) 는 해당 checker 에 **입력으로 전달된 프롬프트**이며 출력이 아니다 — 크기만 보고 "결과가 있다"고 오판하지 말 것. `cross_spec`/`plan_coherence`/`rationale_continuity` 는 세션 루트에 정상적으로 소형 출력 파일이 존재해 실제 읽었다.

## Critical 위배 (BLOCK 사유)

없음 (확보된 3개 checker 기준).

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | "EIA 호출은 `@workflow/sdk` 재사용" 서술이 실제 M1 위젯 SPA(component A) 의 독립 구현과 불일치 — 번복을 설명하는 Rationale 이 해당 컴포넌트에 없음 | `spec/7-channel-web-chat/_product-overview.md §4`, `2-sdk.md §2` | `codebase/channel-web-chat/src/lib/eia-client.ts`(`@workflow/sdk` import 없음), `codebase/channel-web-chat/package.json`(해당 의존성 없음) | §4 표·§2 첫 문장을 "component A(위젯 SPA)는 독자 `eia-client.ts`, `@workflow/sdk` 재사용은 M2 BYO-UI headless client 경로 한정"으로 정정하거나, 재구현 사유(번들 사이즈·CSR 제약 등)를 Rationale 에 명시 |
| 2 | plan_coherence | `3-auth-session.md §3.1` "후속 결정으로 남긴다"고 명시한 401 REST 오류 분기·낙관적 refresh 를 추적하는 plan 부재, frontmatter 도 `status: implemented` 유지(`partial`+`pending_plans:` 미반영) | `spec/7-channel-web-chat/3-auth-session.md §3.1` | `plan/in-progress/**` 매칭 없음. 대비 선례: `14-external-interaction-api.md`/`15-chat-channel.md` 의 `partial`+`pending_plans:` 패턴 | `project-planner` 가 후속 plan 신설 + frontmatter `status: partial`+`pending_plans:` 갱신, 또는 확정 비목표로 문구 재서술 |
| 3 | plan_coherence | carousel 잘림 배너 후속(`1-widget-app.md §2`/R8)을 추적하는 `webchat-widget-presentation-followups.md` 가 이미 존재하나 spec frontmatter `pending_plans:` 에 미등재 | `spec/7-channel-web-chat/1-widget-app.md` frontmatter | `plan/in-progress/webchat-widget-presentation-followups.md`(내용은 target 과 정합, 충돌 없음) | frontmatter 를 `status: partial` + `pending_plans: [plan/in-progress/webchat-widget-presentation-followups.md]` 로 갱신 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `0-architecture.md §R1` "완전 분리" 문구가 `4-security.md §R5` 의 same-origin 예외를 backlink 하지 않아 단방향 참조 | `spec/7-channel-web-chat/0-architecture.md §R1`/§2 | §2 말미에 "단, 동봉 미리보기 same-origin 경로는 [4-security §R5]" 1줄 backlink 추가해 양방향 참조로 드리프트 예방 |
| 2 | plan_coherence | `spec-draft-pr874-deferred-docs.md` 체크리스트의 "doc-guard 통과"/"commit+PR" 두 항목이 미체크지만 실제로는 PR #899(commit `52f46f95f`)로 이미 완료 | `plan/in-progress/spec-draft-pr874-deferred-docs.md` | 두 체크박스 사후 확인 후 체크, `plan/complete/` 로 이동 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 데이터모델·API계약·요구사항ID·상태전이·RBAC·계층책임 6관점 표본 검증에서 모순 없음. `conversation-thread.md §9` 위젯 carve-out 등 기존 확인 재확인 |
| rationale_continuity | LOW | SDK 재사용 서술 불일치(WARNING 1), R1↔R5 backlink 누락(INFO 1). 그 외 Rationale 연속성 관리는 전반적으로 양호 |
| convention_compliance | 재시도 필요 | 출력 파일이 디스크에 없음(Workflow disk-write 갭) — 결과 불명, 재실행 필요 |
| plan_coherence | MEDIUM | `3-auth-session` 401 후속 미추적, carousel 배너 plan cross-ref 누락(WARNING 2), stale plan 체크리스트(INFO 1). 기능적 충돌은 없고 plan↔spec 연결 누락 |
| naming_collision | 재시도 필요 | 출력 파일이 디스크에 없음(Workflow disk-write 갭) — 결과 불명, 재실행 필요 |

## 권장 조치사항

1. **(최우선, 신뢰도 확보 필수)** `convention_compliance`·`naming_collision` 두 checker 를 동일 target(`spec/7-channel-web-chat`)으로 재실행해 실제 출력을 확보한다. `status=success` 로 보고됐으나 출력 파일이 없는 것은 알려진 Workflow disk-write 갭 패턴(memory: `feedback_workflow_disk_write_gap_false_counts`)이며, 재실행 전까지 이 두 영역(컨벤션 준수·네이밍 충돌)에 Critical 이 없다고 단정할 수 없다.
2. `3-auth-session.md §3.1` 의 미구현 401 처리/낙관적 refresh 분기에 대해 `project-planner` 가 후속 plan 신설 + frontmatter `status: partial`/`pending_plans:` 갱신 (또는 명시적 비목표로 재서술).
3. `1-widget-app.md` frontmatter 에 `pending_plans: [plan/in-progress/webchat-widget-presentation-followups.md]` 추가해 carousel 배너 후속 plan 을 spec 과 연결.
4. `_product-overview.md §4`/`2-sdk.md §2` 의 "EIA 호출은 `@workflow/sdk` 재사용" 서술을 실제 구현(위젯 SPA 독립 `eia-client.ts`)에 맞게 정정하거나, 재구현 사유를 Rationale 에 명시.
5. (선택) `0-architecture.md §R1` 에 `4-security.md §R5` same-origin 예외로의 1줄 backlink 추가.
6. `spec-draft-pr874-deferred-docs.md` 의 잔여 체크박스 2건(`doc-guard 통과`, `commit+PR`)을 사후 확인 후 체크, `plan/complete/` 로 이동.

---

## 검증 노트 (main Claude, 후속)

`convention_compliance`·`naming_collision` 의 디스크 출력 부재(Workflow disk-write 갭)는 **재실행 없이 journal.jsonl 복구로 해소**했다 (`feedback_workflow_disk_write_gap_false_counts` 절차). 두 checker 반환 전문 확인 결과 **모두 위험도 NONE**:

- **convention_compliance**: "CRITICAL/WARNING 급 위반은 발견되지 않았다." — 이번 target(disclaimer 해요체 통일)이 i18n-userguide §적용 범위 carve-out + Principle 6 문체 규약에 부합함을 실물 코드까지 대조 확인. INFO 2건은 모두 orchestrator payload 빌더의 conventions 번들 선정 이슈(프로세스 관찰)이지 target 결함 아님.
- **naming_collision**: 3개 파일 diff 가 텍스트 전용(신규 식별자 0)이라 충돌 여지 없음 → NONE.

따라서 **5/5 checker 확보 완료**, 통합 판정 **BLOCK: NO** 는 신뢰 가능하다. 상단 표의 "2/5 미수집 / MEDIUM(불완전)" 서술은 이 복구로 갱신되며, WARNING 3건은 전부 **이번 diff 와 무관한 기존 spec 전역 이슈**(SDK 재사용 서술·auth 401 후속 plan·carousel 배너 pending_plans frontmatter)로, 본 disclaimer 톤 수정이 유발한 것이 아니다 → 별도 grooming 대상(이 작업 범위 밖).
