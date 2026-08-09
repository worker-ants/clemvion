# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — target(`spec/7-channel-web-chat/`)에 대한 실 diff 는 `dompurify` 보안 패치 버전 범프(3.4.12→3.4.13) 두 줄뿐이며 spec 충돌·명명 충돌·규약 위반·Rationale 번복 없음. 다만 plan_coherence checker 가 diff 와 무관한 기존(pre-existing) plan 미해결 항목 2건을 WARNING 으로 발견했고, 세션 번들링 자체의 메타 결함(plan/in-progress 우선순위 미적용)도 함께 관측됨.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — Critical 자체가 없으므로 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | `2-sdk.md`/`3-auth-session.md` frontmatter `code:` 증거 포인터가 옛 구현 위치(`use-widget.ts`)를 가리키며, 실제 §3 재전송 계약 정본은 `use-session-generations.ts` 로 이관됨(2026-07-24 slice 완료 후 미갱신) | `spec/7-channel-web-chat/2-sdk.md` frontmatter `code:`, `3-auth-session.md` frontmatter `code:` | `plan/in-progress/spec-update-webchat-evidence-pointers.md`(project-planner, 미착수), `plan/in-progress/webchat-usewidget-extraction.md` §"spec 증거 포인터 drift" | project-planner 가 (a) 지금 `code:` 갱신 vs (b) 남은 slice 완료까지 대기 중 택1 결정. 신규 plan 불요 — 기존 `spec-update-webchat-evidence-pointers.md` 해소로 충분 |
| 2 | plan_coherence | 위젯이 비-410 명령 실패(5xx/409 STATE_MISMATCH/form 4xx/네트워크 순단) 시 `ERROR`→`phase: "ended"` 로 전이해, target 이 약속한 "재제출/복원"이 실제로 깨짐. 과거 반대 방향 시도(모든 에러=종료)가 대화 영구 유실 CRITICAL 로 되돌려진 이력 있음 | `spec/7-channel-web-chat/1-widget-app.md` §2 Form 행("재제출"), `3-auth-session.md` §3.1-3 storage 정리 조건(비-410 명령 실패 미열거) | `plan/in-progress/webchat-command-failure-is-not-termination.md`(project-planner, 미착수 — 제품 결정 A/B/C 필요) | 신규 결정 요구 아님 — 이미 티켓화됨. project-planner/사용자 턴에서 A(일시적 실패)/B(종료조건 명문화)/C(오류별 분기) 택1 후 두 spec 문서 반영 확인 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance, plan_coherence, naming_collision (공통) | `--impl-done` 세션의 diff-base(`origin/main`) 기준 실제 변경분이 `spec/7-channel-web-chat/` 를 전혀 포함하지 않음(dompurify patch bump 2줄뿐) — 이번 워크트리의 실 작업은 CI required-check skip-jobs 이며, target 지정은 code_areas 필터가 `dompurify` 의존성 교집합으로 매칭시킨 결과로 추정 | 세션 전체 | SUMMARY 집계 시 본 세션 발견을 "이번 PR 이 도입한 위반"으로 세지 말 것(이미 본 보고서 반영). 오케스트레이터의 target-bundle 산출 로직이 diff 무관 영역을 반복 매칭하는 경우 `.claude/skills/consistency-checker/` 산출 스크립트 재검토 필요(harness 이슈, 별도 트랙) |
| 2 | plan_coherence | `plan/in-progress` 전체 번들 섹션에서 target(`webchat`)과 밀접한 plan 5개가 예산 초과로 전부 누락됨(checker 가 직접 Read 로 우회 확보) — `prioritize_bundle_files` 계층 0~3 로직이 target-bundle 에는 적용됐으나 "진행 중 plan 문서 모음" 섹션에는 미적용으로 보임 | harness/orchestrator (target 무관) | `plan/in-progress/harness-consistency-summary-downgrade-rule.md` 다음 라운드에서 plan/in-progress 번들에도 동일 우선순위 계층 적용 여부 확인 요청(신규 plan 생성 불필요, 기존 트랙에 인계) |
| 3 | plan_coherence | P3 후속 2건(`webchat-boot-apibase-scheme-validation.md`, `webchat-spec-rationale-followup.md`)도 예산 초과로 번들 누락. 둘 다 원 티켓 스스로 "비차단"·"활성 결함 아님" 으로 명시, 오늘 diff 와 무관 | `spec/7-channel-web-chat/2-sdk.md` §boot, `4-security.md` §1 위협 표 | 조치 불요, 다음 관련 PR 에서 정상 처리 |
| 4 | plan_coherence | `ci-required-check-skip-jobs.md` §Rationale 이 `--frozen-lockfile` required-check 요구를 `deps-peer-gating-and-eslint10`(무관, grep 0건)로 오귀속 — 실제는 `deps-guard-hardening.md` §"남은 수동 조치" | `plan/in-progress/ci-required-check-skip-jobs.md` §Rationale (target 과 직접 무관, plan-간 상호참조 오류) | Rationale 한 줄만 `deps-peer-gating-and-eslint10` → `deps-guard-hardening` 로 정정. 동작 영향 없음, 후속 PR 에 포함 가능 |
| 5 | convention_compliance | `codebase/packages/web-chat-sdk` 디렉토리명과 npm 패키지명(`@workflow/web-chat`) 불일치 — spec 은 이미 구분 서술 중 | `spec/7-channel-web-chat/2-sdk.md` frontmatter `code:`, `_product-overview.md §4` 표 B행 | 조치 불요(정보 제공 목적) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 실 diff = dompurify patch bump 뿐, 데이터모델/API/요구사항ID/상태전이/RBAC/계층책임 어느 것도 미접촉, `4-security.md` exact-pin 정책과 정합 |
| rationale_continuity | NONE | spec 본문·Rationale 변경 없음, R4(sanitize allowlist) 결정과 무충돌, 기각된 대안 재도입 없음 |
| convention_compliance | NONE | 명명/출력포맷/문서구조/API문서/금지항목 5관점 모두 정합, diff 자체가 target spec 을 포함하지 않음(INFO 로 기록) |
| plan_coherence | LOW | diff 자체는 무해하나, 세션 번들 누락분을 직접 확보해 기존 미해결 WARNING 2건(spec 증거 포인터 drift, 비-410 실패 재제출 gap) 발견 — 둘 다 이미 티켓화된 pre-existing 이슈 |
| naming_collision | NONE | 신규 식별자(요구사항ID/엔티티/API/이벤트/ENV/경로) 도입 없음, 충돌 점검 대상 없음 |

## 권장 조치사항
1. (BLOCK 없음 — 즉시 조치 불요) 이번 PR(dompurify patch bump)은 push 가능. 아래는 별도 트랙에서 처리.
2. WARNING #1: `project-planner` 가 `plan/in-progress/spec-update-webchat-evidence-pointers.md` 를 통해 `2-sdk.md`/`3-auth-session.md` 의 `code:` 포인터 갱신 시점(즉시 vs slice 완료 후) 결정.
3. WARNING #2: `project-planner`/사용자 턴에서 `plan/in-progress/webchat-command-failure-is-not-termination.md` 의 A/B/C 결정을 내리고 `1-widget-app.md` §2·`3-auth-session.md` §3.1-3 반영.
4. INFO #2: `harness-consistency-summary-downgrade-rule.md` 후속 라운드에서 plan/in-progress 번들 우선순위 로직 확인.
5. INFO #4: `ci-required-check-skip-jobs.md` Rationale 의 plan 이름 오기재 한 줄 정정(저비용, 후속 PR 가능).