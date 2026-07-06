# 정식 규약 준수 검토 — spec/2-navigation/1-workflow-list.md (태그 필터 하향 + drift 현행화)

- 대상: `spec/2-navigation/1-workflow-list.md` (worktree `fe-tag-filter-283723`, `git diff spec/` 기준)
- 검토 규약: `spec/conventions/spec-impl-evidence.md`(frontmatter/status/pending_plans/링크 무결성 SoT), `.claude/skills/project-planner/SKILL.md`(3섹션 구조), `spec-link-integrity.test.ts` 실행 결과

## 발견사항

- **[CRITICAL] 태그 필터를 "구현 완료"로 서술했으나 frontend 코드에 해당 UI 가 없음 (spec-impl-evidence 위반)**
  - target 위치: §2.3 필터 표 "태그" 행 (`| 태그 | 단일 태그 필터 (텍스트 입력) | 입력한 태그 1개를 서버 \`?tag=\` 로 전달 — ... 검색과 동일하게 debounce 적용, page 리셋. ... |`)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` Overview("spec 가 약속한 surface 가 *지금* 구현됐는가") 및 §3 `status: partial` 정의("일부 구현됨", `code:` 매치 의무 — 즉 본문이 "구현됨"이라 서술하는 surface 는 실제 code 로 뒷받침돼야 함)
  - 상세: `codebase/frontend/src/app/(main)/workflows/page.tsx` 에는 `folderId`/`folderFilter` state·UI(456~464줄)는 존재하지만, 태그 필터에 해당하는 state(`tagFilter`/`debouncedTag` 등)·입력 UI·i18n 키(`workflows.tagFilter.*`) 가 전혀 없다 (`grep -rn tag` 결과 §2.1 테이블의 태그 **뱃지 표시** 코드(539/596~598줄)뿐). 반면 target 문서 §2.3 은 "입력한 태그 1개를 서버 `?tag=` 로 전달", "검색과 동일하게 debounce 적용, page 리셋" 이라고 **이미 동작하는 것처럼** 서술한다. 같은 diff hunk 안의 `pending_plans` 대상 문서 `plan/in-progress/spec-sync-workflow-list-gaps.md` 도 "태그 필터 UI 부재 (§2.3): 서버 `?tag=` 지원, **frontend 잔여**(태그 멀티 선택 UI). 별도 PR." 을 `[ ]`(미체크) 로 명시해, spec 본문과 정면 모순한다.
  - 제안: (a) 태그 필터 프론트엔드 구현이 실제로 이 세션에서 함께 들어가는 것이 맞다면(다른 worktree/PR 에서 진행 중이라면) `git diff` 범위에 해당 코드 변경도 포함시켜 spec 과 함께 반영하거나, (b) 코드가 아직 없다면 §2.3 문구를 "**미구현 (Planned)**: 단일 태그 free-text 필터로 설계 확정([Rationale §4](#4-태그-필터는-단일-free-text-로-하향-2026-07-06)), 구현은 `pending_plans` 트랙" 형태로 되돌리고 `pending_plans` 체크박스 상태와 일치시킬 것. 코드가 이미 별도로 머지돼 있다면 이 worktree 의 `git diff` 범위·checker 대상 선정 문제이니 재확인 필요.

- **[WARNING] `pending_plans` 문서와 spec 본문의 "다음 잔여" 서술 불일치**
  - target 위치: frontmatter `pending_plans: [plan/in-progress/spec-sync-workflow-list-gaps.md]` (유효 — plan 파일 실존, `spec-pending-plan-existence.test.ts` 통과) / §2.3 태그 행
  - 위반 규약: `spec-impl-evidence.md` §3 `partial` 행 — "`pending_plans` 소진 시 `implemented` 로 승격 의무" 취지상, spec 본문과 pending_plans 문서는 "무엇이 남았는가"에 대해 정합해야 함
  - 상세: plan 문서는 2026-07-06 갱신 노트에서 "남은 잔여 = 태그 필터 UI(§2.3, spec 멀티선택 vs 서버 단일 `?tag=` 결정 필요)·빈 상태 마켓플레이스 링크(§2.7)"라고 명시했는데, target spec diff 는 이 "결정 필요" 상태를 해소(멀티→단일 하향, Rationale §4 로 문서화)한 것까지는 정합적이나, 그 **후속 구현**이 코드에 반영되지 않은 채 spec 만 "구현 완료"로 앞서갔다. 결정(spec 하향)과 구현 완료(코드 반영)를 혼동한 것으로 보인다.
  - 제안: 위 CRITICAL 과 동일 조치로 함께 해소됨. 만약 태그 필터 결정만 이번 스코프이고 구현은 후속이라면, plan 체크박스는 `[ ]` 유지하되 노트에 "결정 확정(free-text 단일), 구현 대기"를 추가해 두 문서가 같은 상태를 가리키게 할 것.

- **[INFO] Rationale §4 앵커·번호·문서 구조는 규약 정합 (결함 아님, 확인 완료)**
  - target 위치: §2.3 태그 행 링크 `[Rationale §4](#4-태그-필터는-단일-free-text-로-하향-2026-07-06)` ↔ `## Rationale` 하위 `### 4. 태그 필터는 단일 free-text 로 하향 (2026-07-06)`
  - 확인 근거: `spec-link-integrity.test.ts` 를 이 worktree 코드베이스에서 직접 실행 — 11 tests 전부 pass (앵커 불일치 0건). github-slugger 파이프라인으로 대조한 결과 heading 텍스트("4. 태그 필터는 단일 free-text 로 하향 (2026-07-06)")가 링크의 `4-태그-필터는-단일-free-text-로-하향-2026-07-06` 과 정확히 일치한다.
  - 문서 구조(`## Overview` 대응 도입부 → 본문(§1~§3) → `## Rationale`(§1~§4 하위 세션 번호 연속))도 project-planner SKILL 의 3섹션 권장 및 기존 §1~§3 Rationale 넘버링 관례와 일치한다. `spec-frontmatter.test.ts`/`spec-code-paths.test.ts`/`spec-status-lifecycle.test.ts`/`spec-pending-plan-existence.test.ts`/`spec-area-index.test.ts` 전부(982 tests) 이 worktree 에서 pass — frontmatter(`id`/`status: partial`/`code:`/`pending_plans:`) 자체의 스키마·TTL·존재성 위반은 없음.
  - 별도 조치 불요 — 참고용 기록.

- **[INFO] §2.3 "폴더" 행 및 §3.1 안내문 현행화는 정합**
  - target 위치: §2.3 폴더 행, §3.1 도입부 문장("프론트엔드는 목록의 **폴더 필터**(§2.3)가 `GET /api/folders` 를 소비한다...")
  - 확인 근거: `page.tsx` 에 `folderId` state·`GET /api/folders` 소비·`workflows.folderFilter.*` i18n 키가 실제로 존재(456~464줄 등) — 이 부분은 "미구현(Planned)" 마커를 정확히 제거하고 실제 구현 상태를 반영한 올바른 현행화다. pending_plans 문서의 "폴더 필터 UI 부재 (§2.3): ... [x] 폴더 필터 UI 부재" 완료 체크와도 정합.
  - 별도 조치 불요.

## 요약

신설 Rationale §4 의 번호·제목·앵커는 §2.3 링크와 정확히 일치하며(`spec-link-integrity.test.ts` 실행 검증 완료), frontmatter 스키마·TTL·pending_plans 실존성 등 5개 build-time 가드 전부 pass, 3섹션 문서 구조·명명 컨벤션도 규약과 어긋나지 않는다. 폴더 필터 관련 "미구현(Planned)" 제거는 실제 코드(`folderId` state, `GET /api/folders` 소비, i18n 키)와 정합해 올바른 현행화다. 다만 **태그 필터**는 §2.3 표·Rationale §4 모두 "단일 free-text 필터로 이미 동작"하는 것처럼 서술하지만, `page.tsx`/i18n 에 해당 프론트엔드 코드가 전혀 없고 같은 diff 의 `pending_plans` 대상 plan 문서도 이를 미체크 잔여 항목으로 유지하고 있어 spec-impl-evidence 컨벤션의 핵심 invariant("spec 약속 vs 구현 부재 갭 차단")를 정면으로 위반한다. 이는 설계 결정(멀티→단일 하향, Rationale §4)과 그 결정의 실제 구현 완료를 혼동한 결과로 보이며, 코드 반영 전까지 이 서술을 "미구현(Planned)"으로 되돌리거나 실제 구현을 함께 반영해야 한다.

## 위험도

**HIGH** — Critical 1건 발견. **BLOCK.**
