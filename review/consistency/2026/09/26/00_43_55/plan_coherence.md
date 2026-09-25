# Plan 정합성 검토 — Personal 통합 소유자 강제 (integration-personal-owner)

## 발견사항

- **[WARNING]** `integration-personal-owner-followup.md` 의 `worktree:` sentinel 이 규약과 다른 값
  - target 위치: `plan/in-progress/integration-personal-owner-followup.md` frontmatter 5행 — `worktree: (미착수)`
  - 관련 plan: `.claude/docs/plan-lifecycle.md §4`(`아직 worktree 가 없는 미착수 plan 은 placeholder … 대신 명시 sentinel (unstarted) 를 쓴다`), 구현체 `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` 의 `WORKTREE_SENTINEL = "(unstarted)"`
  - 상세: 이 PR 이 "동반 산출물"로 새로 만든 `integration-personal-owner-followup.md` 가 미착수 상태를 `(unstarted)` 대신 한국어 `(미착수)` 로 적었다. 저장소의 다른 미착수 plan 10건 이상(`ai-agent-tool-connection-rewrite.md`, `deps-guard-hardening.md`, `nestjs-v12-coordinated-upgrade.md` 등)은 전부 정확히 `(unstarted)` 를 쓴다 — 이 문서만 유일하게 다르다.
    - 자동 가드(`plan-frontmatter.test.ts`)의 `WORKTREE_PLACEHOLDER` 정규식(`/\bTBD\b|assigned at impl|미정|착수\s*시|^pending$/i`)은 `착수시` 형태만 매치하고 `미착수` 는 매치하지 않아, 이 값은 **placeholder 위반으로도 잡히지 않는다** — 즉 CI 가드를 조용히 통과하는 silent violation 이다(실측: 정규식 각 분기 대조 완료).
    - `plan-stale-audit.sh` 는 `wt_value` 가 정확히 `(unstarted)`/`pending`/빈 값일 때만 `wt_status="(none)"` 으로 두고, 그 외 값은 `.claude/worktrees/$wt_value` 디렉터리 존재 여부로 `exists`/`MISSING` 을 가른다. `(미착수)` 라는 디렉터리는 존재하지 않으므로 이 plan 은 향후 audit 에서 "정상적으로 미착수" 가 아니라 **`wt_status=MISSING`**(마치 worktree 가 있다가 사라진 것처럼) 으로 오분류된다.
  - 제안: `plan/in-progress/integration-personal-owner-followup.md` frontmatter 의 `worktree: (미착수)` 를 `worktree: (unstarted)` 로 정정. (부수적으로, 이 값이 가드 정규식을 우회한다는 사실은 harness 쪽(`WORKTREE_PLACEHOLDER`)에 `미착수` 분기를 추가할지 별도로 검토할 만하지만, 이는 plan 정합성 검토 범위를 벗어난 harness 보강이라 developer 판단에 맡긴다.)

## 그 외 확인한 항목 (문제 없음 — 근거 포함)

아래는 세 관점(미해결 결정 충돌 / 선행 plan 미해소 / 후속 항목 누락)으로 실측 대조했고 전부 정합했다:

- **spec ↔ plan 프런트매터 상호 링크**: 실제 `spec/2-navigation/4-integration.md` frontmatter 를 직접 Read 하여 `status: partial` + `pending_plans: [plan/in-progress/integration-personal-owner-followup.md]` 가 draft(`spec-draft-integration-personal-owner.md`)의 제안과 정확히 일치함을 확인. `spec-pending-plan-existence.test.ts` 가 요구하는 경로 실존도 만족.
- **"아직 강제되지 않는 것" 4항목 ↔ followup.md 4항목**: spec Rationale 의 목록(①노드 실행 시점 ②Viewer 자기 personal 생성/수정/rotate/삭제 ③cafe24/MakeShop pending_install 재사용 ④상세 화면 버튼 미차단)과 `integration-personal-owner-followup.md` 의 4개 체크박스가 1:1로 대응 — 누락·중복 없음.
- **`--spec`/`--impl-prep` 처리 반영 여부 실측**: `spec/5-system/3-error-handling.md`(`ADMIN_REQUIRED` 발행처에 `IntegrationsService` 추가), `spec/4-nodes/4-integration/_product-overview.md`(INT-MG-07 소유자 제약 구), `spec/3-workflow-editor/4-ai-assistant.md`(§4.1·§4.3.1·Rationale ED-AI-39 세 자리 "남의 personal 제외" 문구) 모두 실제 spec 파일에 Grep 으로 존재 확인 — draft 가 약속한 변경안이 전부 착지했다.
- **followup 항목이 이번 diff 로 조용히 해소/무효화되지 않았는가**: `git diff origin/main...HEAD -- codebase` 실측 — `modules/workflows`·`modules/nodes`(노드 설정 저장 검증), `@Roles('editor')` 데코레이터(Viewer 가드), `createPrivatePendingIntegration`/`createMakeshopPendingIntegration`(pending_install 재사용) 어디에도 변경이 없다. 새로 추가된 `assertRequesterStillAllowed`(콜백 재판정)는 명시적으로 `pending_install` 행을 건너뛴다(주석 + 뮤턴트 R4 KILLED) — followup 항목 ②③이 여전히 유효하다는 plan 의 주장과 diff 실측이 일치한다.
- **4라운드 `/ai-review` 잔여 항목의 트래커 등재 여부**: 라운드 3·4 WARNING(매니저 분기 unit·조건부 쓰기 헬퍼·Organization rotate e2e·역할 이중 조회 갱신·`handleCallback` 비대)이 "트래커 신설"이라고만 적혀 있어 실종 여부를 grep 으로 추적 — `plan/in-progress/spec-draft-nullable-notation-followups.md` 5765~5794행에 전부 실재하며 세션 경로·근거까지 정확히 인용됨을 확인. 누락 없음.
- **원 트래커 항목 종결 준비**: `spec-draft-nullable-notation-followups.md:5760` 의 원 항목("personal-scope 통합의 «본인 것만» 소유자 검증이 코드에 없다")은 아직 `[ ]`(미체크)이나, 이는 main plan 체크리스트의 "[ ] 트래커 항목 닫기"(착지 시 수행 예정)와 정확히 대응 — 이번 리뷰 시점(impl-done, 착지 전)에 열려 있는 것이 정상이며 불일치가 아니다.
- **동시성/우선순위 상호배제**: followup 항목 ①(노드 실행 시점)의 "착수 전 실측"(기존 워크플로우 중 타인 personal 참조 노드 수)은 followup 착수 조건이지 본 PR 의 선행조건이 아니다 — 본 PR 범위(설계 §"완결성 안전망")가 실행 엔진(`getForExecution`)을 명시적으로 제외하므로 정합.

## 요약

Personal 통합 소유자 강제 PR 은 planner draft·developer plan·follow-up plan·spec 변경 네 문서가 서로 정확히 교차 참조하고, 4라운드 `/ai-review` 와 `--impl-prep`/`--spec` 처리 결과까지 전부 트래커에 반영된 매우 높은 수준의 plan 정합성을 보인다. `git diff` 실측으로 대조한 결과 followup 으로 미룬 4개 항목(노드 실행 시점 강제·Viewer 자기 personal 관리·pending_install 재사용·상세 화면 버튼) 중 어느 것도 이번 diff 로 조용히 해소되거나 무효화되지 않았고, spec frontmatter 의 `pending_plans` 역방향 링크도 실재 확인했다. 유일하게 발견한 결함은 이 PR 이 새로 만든 `integration-personal-owner-followup.md` 의 `worktree:` sentinel 표기가 저장소 관례(`(unstarted)`)와 달리 한국어 `(미착수)` 를 써서 자동 placeholder 가드를 우회하고 `plan-stale-audit.sh` 를 오분류시키는 plan 위생 문제다 — 미해결 결정 충돌이나 후속 항목 누락은 아니며, 한 줄 정정으로 해소된다.

## 위험도
LOW
