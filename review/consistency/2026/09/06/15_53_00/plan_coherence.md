# Plan 정합성 검토 — target: `spec/2-navigation/`

## 조사 방법

- `git diff origin/main...HEAD --stat` 로 target scope(`spec/2-navigation/**`) 델타를 재확인:
  **0개 파일**. 이 브랜치("user-entity-column-defense")의 실제 변경은 `User` 엔티티 컬럼
  노출 방어(`user-entity-exposure-guard` 등)·에러 처리 일반화가 주제이고, `spec/2-navigation/`
  본문은 이번 PR 에서 건드리지 않았다.
- target 영역과 접점을 가진 유일한 코드 변경은 `codebase/backend/src/modules/triggers/triggers.service.ts`
  의 `rethrowEndpointPathConflict` / `isEndpointPathUniqueViolation` 신설이다 —
  `2-trigger-list.md §3`·PATCH 상세 블록이 이미 문서화해 둔 *"`(workspace_id,
  endpoint_path)` UNIQUE 위반 시 409 `RESOURCE_CONFLICT` (세부 코드
  `TRIGGER_ENDPOINT_PATH_CONFLICT`, `details.field='endpoint_path'`)"* 계약을 구현이
  뒤늦게 실현한 것이다 (`git log -S` 로 그 문구가 이미 `origin/main` 에 있던 spec 임을
  재확인). **새 결정을 내린 것이 아니라 기존 spec 문구를 실현한 것 — 충돌 아님.**
- 세션 히스토리 재구성: 이 세션은 같은 날 `10:13`~`15:53` 사이 13라운드의
  code-review/consistency-check 를 반복했고, 직전 라운드(`review/consistency/2026/09/06/15_31_00/plan_coherence.md`)
  가 발견한 항목(WARNING 1 + INFO 2)은 **바로 다음 커밋 `fc6208adb`**
  (`plan/in-progress/spec-draft-nullable-notation-followups.md` +71줄)에서 전부
  planner 백로그로 등재됐음을 diff 로 직접 확인했다:
  - R-2(hmacSecret v1.1 rotate 예고)가 §3 각주의 "폐기됐다" 서술과 자기모순 → 등재 완료
    (`review/consistency/.../15_31_00` W1).
  - frontmatter `status: implemented` vs 본문 §3 "sort/order 미구현" 자백 모순 → 등재 완료
    (동 W3).
  - Auth Config "새 인증 설정 만들기" 링크가 editor 에게 dead-end → 등재 완료(동 W2).
  - `WorkflowVersionDetail` 동명 손-미러 → 등재 완료(동 W4).
  - 도메인 세부 에러 코드 표현 방식(top-level `code` 교체 vs `details.code`) 미정식화 →
    등재 완료(`14_59_49` W1, 이 PR 의 `TRIGGER_ENDPOINT_PATH_CONFLICT` 구현이 계기이나
    구현 자체는 spec 문구를 그대로 따른 것이라 이 PR 과 충돌 없음).
  - `2-trigger-list.md:106` botToken 자기모순(`hasBotToken: boolean` 만 노출 vs
    `last4` 마스킹 placeholder 동시 주장) → `14_59_49` W2 로 기존 등재 확인, 이 PR 이
    만든 결함 아님.
  즉 이번 라운드 시점에는 앞선 발견이 **모두 이미 plan 에 반영된 상태**다.

## 발견사항

- **[INFO]** target(`2-trigger-list.md`)에 여전히 남아 있는 자기모순 4건은 이미 plan 에
  등재돼 있어 재등재 불요
  - target 위치: `spec/2-navigation/2-trigger-list.md` §2.3.1 `botToken` 행(106행 부근),
    Rationale R-2(226행 부근) vs §3 각주, frontmatter `status` vs §3 sort/order 서술,
    §2.3.1 Auth Config "새 인증 설정 만들기" 링크
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의
    `## 후속` 섹션 — 위 4항목 전부 `- [ ]` 로 planner 담당 등재 (2026-09-06,
    출처 `review/consistency/2026/09/06/15_31_00`·`14_59_49`)
  - 상세: 넷 다 이번 PR 이 만든 결함이 아니고(spec delta 0), plan 이 이미 실측·근거·제안까지
    적어 다음 planner 턴을 기다리는 상태다. impl-done 검토 시점의 target 문서 자체는 여전히
    그 모순을 안고 있으므로, 다음 구현자가 이 문서를 근거로 코드를 짤 때(특히 botToken
    행을 근거로 실제 last4 노출 필드를 신설하면 `secret-store.md §1.1` 위반) 오도될
    위험은 남아 있다.
  - 제안: 이번 PR 범위 밖. 추가 등재 불필요(이미 정확한 인용·제안과 함께 등재됨) —
    다음 planner 턴에서 우선순위만 확인하면 된다.

- **[INFO]** `2-trigger-list.md §2.3.1` External Interaction 행이 가리키는 plan
  `eia-trigger-edit-ui` 가 트래커에 없음 (재확인, 변동 없음)
  - target 위치: `spec/2-navigation/2-trigger-list.md` §2.3.1, `External Interaction
    (Notification)` 행 — *"별 plan `eia-trigger-edit-ui` 가 구현"*
  - 관련 plan: `plan/in-progress/**`, `plan/complete/**` 전체에 해당 이름 파일 0건
    (전수 검색 재확인)
  - 상세: 오래된(이 세션 이전) dangling 참조이며 이번 PR 의 diff·다른 어떤 in-progress
    plan 과도 무관하다. `notification`/`interaction` DTO 는 이미 구현돼 있어(§3 PATCH
    문서 참조) 남은 실체가 frontend edit UI 뿐일 가능성이 있으나 추적 파일이 안 보인다.
  - 제안: 이번 PR 범위 밖. 다음 spec 정비 턴에서 참조를 실제 plan 이름으로 갱신하거나
    (이미 완료됐다면) 제거.

- **[INFO]** `workflow-versions.service.ts` / `workspace-response.dto.ts` 변경은
  `spec/2-navigation/` 관련 문서 어디에서도 참조되지 않음 — 정합성 문제 없음(확인용 기록)
  - target 위치: 해당 없음
  - 관련 plan: 없음
  - 상세: `WorkspaceMemberDto.joinedAt` 필드 추가(`workspace-response.dto.ts`)와
    `workflow-versions.service.ts` 의 select 축소는 `spec/2-navigation/*.md` 어디에도
    `joinedAt`/`WorkspaceMemberDto`/`listMembers` 로 인용되지 않는다(grep 0건). 두 변경
    모두 이 target 의 frontmatter `code:` 목록 밖이며, `WorkflowVersionDetail` 동명 미러
    이슈는 이미 위 백로그에 별도 등재돼 있다.
  - 제안: 조치 불필요.

## 요약

target(`spec/2-navigation/`)은 이번 PR 에서 델타 0으로 변경되지 않았고, 유일한 접점인
`triggers.service.ts` 의 `TRIGGER_ENDPOINT_PATH_CONFLICT` 구현은 이미 `origin/main` 에
있던 spec 계약을 뒤늦게 실현한 것이라 새 결정 충돌이 아니다. 직전 라운드(`15_31_00`)가
찾아낸 target 자기모순 4건(R-2/§3 각주, frontmatter status, dead-end 링크, botToken
행)은 바로 다음 커밋(`fc6208adb`)에서 `plan/in-progress/spec-draft-nullable-notation-followups.md`
에 정확한 인용·근거·제안과 함께 전부 등재됐음을 diff 로 직접 확인했다 — "후속 항목 누락"은
없다. 남은 것은 이미 등재된 항목이 아직 planner 턴을 기다리는 상태라는 사실 자체와, 이
세션과 무관한 오래된 `eia-trigger-edit-ui` dangling 참조뿐이며 둘 다 이번 PR 의 책임
범위 밖이다.

## 위험도

LOW
