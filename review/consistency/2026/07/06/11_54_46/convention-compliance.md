# 정식 규약 준수 검토 — schedule spec 승격 + plan 완료 이동 + triggers 딥링크 노트

- 대상 커밋: `c75077ec5` (`feat(triggers): 스케줄→트리거 딥링크 소비(?triggerId=) + schedule spec 승격`)
- diff 범위: `git diff origin/main...HEAD`
  - `spec/2-navigation/3-schedule.md` (frontmatter status 승격 + §2.1/§2.2 본문 갱신)
  - `spec/2-navigation/2-trigger-list.md` (§2.3 인바운드 딥링크 노트 추가)
  - `plan/complete/spec-sync-schedule-gaps.md` (신규 — `git mv` rename, R079)
  - `codebase/frontend/src/app/(main)/triggers/page.tsx` + 관련 테스트

검토 규약: `spec/conventions/spec-impl-evidence.md` (§3 status lifecycle, §4/§4.2 가드), `.claude/docs/plan-lifecycle.md` (§3 이동 규칙, §5 Gate C), `spec-link-integrity` 가드 (`spec-frontmatter-parse.ts` 계열).

## 발견사항

없음 (CRITICAL/WARNING 없음). 아래는 INFO 수준 관찰뿐.

- **[INFO]** Rationale 섹션에 이번 status 승격 결정 미기록
  - target 위치: `spec/2-navigation/3-schedule.md` frontmatter (`status: partial → implemented`) + `## Rationale`
  - 위반 규약: 직접 위반 아님. CLAUDE.md 문서 구조 규약("결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`")과 결이 닿는 권장 사항
  - 상세: 같은 문서의 기존 Rationale 에는 "sort/order 쿼리 반영 — '미구현/Planned' 표기 해제 (2026-06-10)" 처럼, 이전 부분-구현 해제 사례가 already 기록돼 있다. 이번 PR 은 `status: partial → implemented` 전체 승격이라는 동일 성격의 결정이지만 Rationale 에 대응 절이 추가되지 않았다. `spec-impl-evidence.md` §3.1 가 이 전이를 규약으로 강제하긴 하나, "왜 이 시점에 승격됐는가"(마지막 pending_plans 완료)를 Rationale 에 한 줄 남기면 향후 유사 감사에서 근거 추적이 쉬워진다.
  - 제안: 필수는 아니나, 여유 있는 후속 커밋에서 Rationale 에 "§2.1/§2.2 frontend cluster(#827) 완료로 pending_plans 전량 소진 → implemented 승격 (2026-07-06)" 한 문단 추가를 권장. 규약 위반이 아니므로 차단 사유 아님.

- **[INFO]** `2-trigger-list.md` §3 API 표에 무관한 pre-existing "미구현/Planned" 문구 잔존 (target 범위 밖)
  - target 위치: `spec/2-navigation/2-trigger-list.md` §3 API 표 `GET /api/triggers` 행 — "sort/order 반영은 미구현/Planned"
  - 위반 규약: 이번 diff 가 만든 변경이 아니며(§2.3 인바운드 딥링크 노트만 수정), `trigger-list` spec 은 `status: implemented`·`pending_plans` 없이 이 문구를 유지 중 — `spec-impl-evidence.md` §3 lifecycle 표상 `implemented` 는 미구현 약속이 없어야 하는 상태와 결이 어긋나 보이나, 이는 이번 target 이전부터 존재하던 pre-existing 상태다
  - 상세: 검토 지시 범위("남은 Planned/미구현 마커가 schedule spec 에 stale 하게 남지 않았는지")는 `3-schedule.md` 한정으로 읽히며, 그 문서엔 Planned 마커가 완전히 제거됐다(§2.1/§2.2 모두 확인). `2-trigger-list.md` 의 이 잔존 마커는 별개 spec(trigger-list 자체의 sort/order API 갭)이라 이번 승격 작업의 스코프가 아니다
  - 제안: 이번 PR 에서 손댈 필요 없음. 별도 backlog/plan 대상으로 planner 가 추후 picking. (참고 기록 차원의 발견 — 차단 아님)

## 검증한 항목 (문제 없음)

1. **spec-status-lifecycle 규약 (`spec-impl-evidence.md` §3.1)** — `3-schedule.md` 의 `partial → implemented` 승격은 유일한 `pending_plans` 항목(`plan/in-progress/spec-sync-schedule-gaps.md`)이 이번 커밋 안에서 `plan/complete/spec-sync-schedule-gaps.md` 로 `git mv`(rename, diff `R079`)됨과 **동시에** 이뤄졌다 — §3.1 "마지막 `pending_plans` 가 `complete/` 로 이동한 commit 안에서 승격" 요건과 정확히 일치.
2. **§2.1/§2.2 Planned 마커 제거의 코드 정합성** — `3-schedule.md` §2.1 "더보기(⋮) 오버플로 메뉴" 및 워크플로 에디터 링크, §2.2 workspace timezone 설정 UI 서술은 선행 커밋 `003792a20`(`feat(schedules): 스케줄 ⋮ 메뉴·워크플로 링크 + workspace 기본 timezone UI (#827)`)의 실제 구현(`schedules/page.tsx` 의 `DropdownMenu`/`/workflows/${id}` Link, `workspace/settings/page.tsx` 의 `WorkspaceTimezoneCard`)과 대조 확인 — 서술과 코드가 일치.
3. **`pending_plans` 제거 규약** — 이동 방식은 `git mv` (history 보존, plan-lifecycle §3 준수), frontmatter 는 `worktree`/`started`/`owner`/`spec_impact`(리스트) 로 갱신됨.
4. **완료 plan frontmatter (Gate C)** — `plan/complete/spec-sync-schedule-gaps.md` frontmatter:
   ```yaml
   worktree: fe3-triggers-deeplink-0fdb24
   started: 2026-06-03
   owner: planner
   spec_impact:
     - spec/2-navigation/3-schedule.md
     - spec/2-navigation/2-trigger-list.md
   ```
   `spec_impact` 가 **리스트** 형식(bare string 아님)이며 두 경로 모두 실존 spec 파일 — Gate C 흔한 실패형(bare string, 빈 배열) 어느 것도 아니다. `started: 2026-06-03` 은 Gate C grandfather cutoff(`2026-06-04`) **이전**이라 애초 강제 대상도 아니지만, 그와 무관하게 이미 규약을 충족한 상태로 작성됐다.
5. **plan 완료 조건 (plan-lifecycle §2/§5)** — 본문 "잔여" 섹션의 두 체크박스 모두 `[x]` 로 완료 처리, 미해결 follow-up 없음(마지막 잔여 항목 "역방향 `/schedules?triggerId=` 갭"은 "별도 잠재 갭으로 남음(본 PR 범위 밖)"으로 명시적으로 scope-out 처리 — TODO/미결정 항목 아님). commit 메시지도 최종 PR 안에서 이동(별도 PR 아님) 요건 충족.
6. **spec-link-integrity (cross-doc 앵커)** — `2-trigger-list.md` §2.3 에 추가된 `[스케줄 목록](./3-schedule.md#21-스케줄-목록-항목)` 앵커는 `3-schedule.md` 의 실제 heading `### 2.1 스케줄 목록 항목` 의 GitHub-slugger 규칙 slug(`21-스케줄-목록-항목`)와 정확히 일치.
7. **build-time 가드 재확인** — `vitest run spec-status-lifecycle spec-plan-completion spec-link-integrity` (cwd=`codebase/frontend`) 실행 결과 `3 passed (3 files), 607 passed (607 tests)` — 전건 통과.
8. **코드-spec 정합** — `triggers/page.tsx` 의 `useSearchParams().get("triggerId")` 초기 selection 로직 및 주석(`[Spec §2.3]`)이 `2-trigger-list.md` §2.3 신설 서술("마운트 시 URL 파라미터를 1회 소비하며, 이후 사용자의 열기/닫기 조작은 URL 과 독립적으로 동작")과 정확히 대응. 신규 테스트 2건(딥링크 오픈/미오픈)도 이 서술을 커버.

## 요약

이번 diff (schedule spec `partial → implemented` 승격, `spec-sync-schedule-gaps.md` plan 완료 이동, `2-trigger-list.md` §2.3 인바운드 딥링크 노트, `triggers/page.tsx` 구현)는 `spec-impl-evidence.md` 의 status lifecycle 전이 규칙(§3.1)과 Gate C plan 완료 규약(plan-lifecycle §5)을 모두 정확히 충족한다. `pending_plans` 소진과 `implemented` 승격이 동일 커밋 안에서 함께 처리됐고, 완료 plan frontmatter 의 `spec_impact` 는 리스트 형식으로 올바르게 선언됐다. 신설 cross-doc 앵커(`./3-schedule.md#21-스케줄-목록-항목`)는 실제 heading 과 일치하며, `spec-status-lifecycle`/`spec-plan-completion`/`spec-link-integrity` 가드 3종이 전부 통과했다. `3-schedule.md` 자체에는 stale Planned 마커가 남아있지 않다(§2.1/§2.2 모두 실제 구현과 대조 확인). CRITICAL/WARNING 없음 — 발견된 두 건은 모두 INFO 수준(Rationale 미기록 권장, `2-trigger-list.md` 의 무관한 pre-existing sort/order Planned 문구는 이번 target 범위 밖).

## 위험도

NONE
