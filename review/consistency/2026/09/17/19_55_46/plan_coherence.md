# Plan 정합성 검토 — spec/2-navigation/ (--impl-done, trigger-deletion-release)

## 발견사항

- **[WARNING]** §4.3 "과도기 문구"가 이 PR 병합 즉시 거짓이 되는데, 그 후속을 반영할 "살아 있는 트래커" 항목이 아직 신설되지 않았다
  - target 위치: `spec/2-navigation/2-trigger-list.md` §4.3, 표 다음 문단 — *"구현은 frontmatter `pending_plans` 에서 추적 — **그 전까지는** 트리거 화면 삭제만 네 자원을 모두 정리하고(스케줄 화면 삭제는 schedule job 만), 비밀을 행 삭제 **전에** 지운다"* (및 §4.4 «락 대기 상한 5초» 불릿의 "정리 3종" 서술)
  - 관련 plan: `plan/in-progress/trigger-deletion-release.md` 체크리스트 마지막 두 항목 `[ ] --impl-done` / `[ ] 트래커 반영`(*"planner 후속 신설(Planned 태그·§4.3 과도기 문구 제거 · `secret-store.md` `partial`→`implemented` · `15-chat-channel.md` R8 괄호 · `4-execution-engine.md §4.4` throw 사례 · §4.4 «락 대기 상한 5초» 를 워크플로·워크스페이스 부모 잠금까지)"*) — 둘 다 아직 미체크. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 DRT-2 항목(라인 4522)도 아직 미체크 상태로, 이 후속을 담을 자리로 지정돼 있을 뿐 아직 항목이 실제로 신설되지 않았다.
  - 상세: `--impl-prep` 1라운드 W5(plan 본문에 처분 기록됨)가 이미 정확히 이 문제를 지적했다 — 이 PR이 구현을 끝내면(실제로 ai-review 3라운드가 `codebase/**` 수정 0 으로 수렴했으므로 구현은 끝났다) §4.3 의 "그 전까지는…" 절과 §4.4 의 "정리 3종" 서술은 더 이상 참이 아니다(비밀은 이제 행 삭제 **후**에 지우고, 스케줄/워크플로/워크스페이스 삭제도 넷 다 정리한다). developer 는 `spec_impact: none` 원칙에 따라 spec 을 직접 고치지 않고 "체크리스트에 planner 후속 등재"로 처분했는데, 그 등재는 지금 `trigger-deletion-release.md` **자기 자신의 체크리스트 한 줄**로만 존재한다. 이 plan 은 종결되면 `plan/complete/` 로 옮겨질 예정이고, 같은 트래커 파일(`spec-draft-nullable-notation-followups.md`) 자신이 두 번(라인 4484-4487, 4517-4519) 명시적으로 남긴 교훈 — *"조건부·후속 처분은 봉인되는 `complete/` 말고 살아 있는 트래커에 적는다"* — 이 지금 이 항목에도 그대로 적용된다. 즉 "트래커 반영" 체크박스가 실행되지 않은 채 plan 이 `complete/` 로 넘어가면, §4.3/§4.4/`secret-store.md`/`15-chat-channel.md`/`4-execution-engine.md` 다섯 자리의 spec drift 를 추적할 살아있는 소유자가 없어진다.
  - 제안: target(spec) 을 지금 고치라는 뜻이 아니다(`spec_impact: none` 결정은 유효). 다만 이 plan 을 `complete/` 로 옮기기 **전에** 반드시 `spec-draft-nullable-notation-followups.md`(또는 신규 planner draft)에 위 다섯 자리를 실제 항목으로 신설해야 한다 — 그래야 `--impl-done` 통과 후 "트래커 반영" 체크박스가 이름뿐인 완료로 끝나지 않는다.

- **[INFO]** `deleteByPrefix` "호출부 한 곳" 이라는 과거 실측 서술이 이 PR로 무효화됨(안전 결함은 아님)
  - target 위치: (간접) `spec/conventions/secret-store.md` §2.1 의 `deleteByPrefix` prefix 불변식 — 이번 target 번들에서는 본문이 예산 절단으로 생략됨
  - 관련 plan: `plan/in-progress/backend-lint-gate-broken-on-main.md` 라인 211-213 — *"프로덕션 호출부는 `triggers.service.ts:875` 한 곳이고 `secret://triggers/${trigger.id}/` 다. `trigger.id` 는 `@PrimaryGeneratedColumn('uuid')` 라 `%`·`_` 가 들어갈 수 없다(실측)"* (이 항목 자체는 `[x]` 로 이미 완료 처리됨)
  - 상세: `trigger-deletion-release.md` 는 `SchedulesService.remove()` · `WorkflowsService.remove()` · `WorkspacesService.deleteWorkspace()` · 신규 `TriggerResourceReleaserService` 에 `deleteByPrefix` 호출부를 여러 곳 추가한다("새 `deleteByPrefix` 호출부도 prefix 를 UUID 로 조립한다" — 부수 주의로 스스로 명시). 따라서 위 "한 곳" 이라는 2026-08-09 시점 실측 서술은 이제 사실이 아니다. 다만 그 서술은 메타문자 거부 가드(throw) 도입을 정당화하기 위한 **시점 스냅샷**이었고, 가드 자체는 호출부 개수와 무관하게 항상 작동하며 developer 가 신규 호출부에도 UUID-only prefix 불변식을 유지했다고 명시했으므로 실질적인 과다삭제 위험은 없다.
  - 제안: 낮은 우선순위. 위 WARNING 처리(트래커 반영) 시 곁들여 `backend-lint-gate-broken-on-main.md` 의 해당 문장에 "(2026-08-09 시점)" 한정어를 붙이거나 각주로 갱신을 권장 — 강제 사항은 아니다.

## 검토 확인 사항 (문제 없음, 참고용)

- `spec/2-navigation/2-trigger-list.md` frontmatter `pending_plans: [spec-draft-nullable-notation-followups.md]` 는 `plan/complete/spec-draft-deletion-releases-trigger-resources.md` 의 D1 결정과 일치하며, 이 draft 는 `status: complete` 로 이미 결정 확정 상태다 — target 이 미해결 결정을 우회하는 정황은 없다.
- `plan/complete/spec-draft-deletion-releases-trigger-resources.md` D7(외부 자원 쪽 두 창 + 커밋-정리 사이 프로세스 종료 창)은 명시적으로 "이 draft/이 PR 이 닫지 않는다"로 못박혀 있고, `trigger-deletion-release.md` 도 동일하게 "남는 창 셋은 draft D7 — 이 항목이 닫지 않는다"로 일치시켰다 — target §4.3 의 "남는 창" 서술과도 그대로 부합한다.
- D2(개별 트리거 삭제 호출 대신 FK CASCADE 유지)와 이 plan 의 설계("워크플로: … 트랜잭션(`workflow` 행 잠금 → 트리거 열거 → 삭제) … ")는 상충하지 않는다.
- 다른 `plan/in-progress/**` 전수 keyword grep(`deleteByPrefix`/`WorkspacesService.deleteWorkspace`/`WorkflowsService.remove`/`teardownChatChannel` 등) 결과, 이 코드 변경으로 전제가 깨지는 제3의 진행 중 plan은 위 두 건 외에 발견되지 않았다.

## 요약

이 PR 은 `plan/complete/spec-draft-deletion-releases-trigger-resources.md` 의 D1·D3~D6 결정을 그대로 구현하고, D7 로 명시적으로 유예된 잔여 창을 건드리지 않았으며, `--impl-prep` 6개 WARNING 과 `/ai-review` 3라운드 지적을 모두 처분(또는 정지 규칙에 따라 문서·트래커 등재로 갈음)했다 — 미해결 결정을 우회하거나 선행 plan 을 무시한 정황은 없다. 다만 이 PR 의 구현 완료로 target spec(§4.3/§4.4)의 "과도기" 서술과 `secret-store.md`/`15-chat-channel.md`/`4-execution-engine.md`의 관련 문구가 즉시 stale 해지는데, 그 후속을 반영할 planner 항목이 아직 **developer plan 자신의 미체크 체크리스트**로만 존재하고 살아 있는 트래커(`spec-draft-nullable-notation-followups.md`)에는 신설되지 않았다 — 이는 이 저장소가 같은 트래커 문서 안에서 두 번 명시적으로 남긴 "조건부 후속은 봉인되는 `complete/` 가 아니라 살아 있는 트래커에 적는다"는 교훈과 정확히 같은 위험 패턴이다. plan 을 `complete/` 로 옮기기 전에 그 신설을 실행하면 해소된다.

## 위험도

LOW
