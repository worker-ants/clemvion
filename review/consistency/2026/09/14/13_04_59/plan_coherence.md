# Plan 정합성 검토 — plan_coherence

## 검토 범위 메모

- target scope(`spec/conventions/`) 델타: **0개 파일** (이 PR 은 `spec/conventions/` 를 바꾸지 않는다 — 정상, 이 자체는 결함이 아니다).
- 실제 구현 diff: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-{guard.ts,spec.ts}` 신설 + `trigger-workflow-ref.spec.ts`·`schedule-trigger.e2e-spec.ts`·`trigger-workflow-ref.e2e-spec.ts`·`chat-channel-trigger-create.e2e-spec.ts` 편집.
- plan 변경: `plan/in-progress/trigger-canary-hardening.md` 신설(357줄) + `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에 4건 해소(`[x]`) + 신규 발견 6건 등재(203줄 diff).
- 신설 plan(`trigger-canary-hardening.md`)의 실측 주장(가드 5뮤턴트·「14 중 5 등재」·spec-impl-evidence.md 55행 인용·migrations.md 체크섬 근거) 을 원문 대조로 검증했고 전부 일치했다 — 이 세션이 스스로 정정한 이력(9자리→13, INFO#3 반증, false positive 철회)도 두 문서 모두 갱신됐음을 확인했다.

## 발견사항

### [INFO] 신규 harness 결함 관측이 소유 트래커(`harness-review-gate-followups.md`)에 반영되지 않음

- target 위치: 없음 (target=`spec/conventions/`, 이 항목은 harness 트래커 간 정합성)
- 관련 plan:
  - `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목 "`--impl-prep`/`--spec` 번들이 `spec/` 코퍼스를 통째로 절단한다"
  - `plan/in-progress/harness-review-gate-followups.md` §"승격은 됐는데 굶는다 — tier 안의 거대 파일 하나가 corpus 몫을 다 먹는다 (2026-09-10 실측)"
- 상세: 이번 세션의 `--impl-prep`(`10_44_37`)이 `spec/` 트리 전체(387개 중 380개 절단)에서 같은 근본원인(corpus 예산 소진)의 두 번째 확증 사례를 관측했다. 새 항목은 "선행 진단이 이미 있다"·"owner 를 harness 로 통일해 한 세션에서 볼 것" 이라고 정확히 교차 인용했지만, 인용의 화살표가 한 방향뿐이다 — `harness-review-gate-followups.md`(그 결함의 지정 소유 문서) 쪽에는 이 두 번째 사례(모드=`--impl-prep`, 대상=`spec/` 전체, 분자=387개 중 380개)가 아직 등재돼 있지 않다. `harness-review-gate-followups.md` 만 열어보는 사람은 이 새 사례를 놓친다.
- 제안: 새 plan 이 명시적으로 "합치기 전에 두 모드가 같은 `prioritize_bundle_files` 경로를 타는지 먼저 확인" 이라는 조건을 달아 **의도적으로 미병합** 상태로 남겨둔 것이므로 CRITICAL/WARNING 은 아니다. 다음 harness 세션이 `harness-review-gate-followups.md` 를 열 때 이 포인터를 놓치지 않도록, 그 문서의 "미해결" 절 말미에 짧은 교차참조 한 줄(→ `spec-draft-nullable-notation-followups.md` 신규 항목, 2026-09-14)을 추가할 것을 권장한다.

### [INFO] 인접 plan 의 repo-guard 개수 서술이 이번 실측으로 갱신 대상이 됨

- target 위치: 없음 (target=`spec/conventions/`, repo-guard 등재 관례는 아직 어느 spec 에도 없음 — 정상)
- 관련 plan:
  - `plan/in-progress/spec-conventions-engine-error-code-surface.md` §"관련" 말미 — "**수치 갱신 (2026-09-04 실측)**: … 지금은 `*-guard.ts` **7** · `*.spec.ts` **8**"
  - `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목 "신규 repo-guard 가 spec `code:` 에 미등재" — "대상 가드(이 배치의 신규 1개 포함) **14** / `code:` 등재 **5** / 미등재 **9**"
- 상세: 두 수치 모두 실측 대조(전자는 2026-09-04, 후자는 2026-09-14) 결과 그 시점 기준으로는 정확하다(직접 `find`/`git log` 로 확인: 2026-09-04~09-14 사이 `param-uuid-pipe-guard`·`dto-class-name-collision-guard`·`trigger-secret-columns-guard` 3개가 새로 생겨 7→14 로 거의 두 배가 됐다 — 실제로는 그 사이 이름이 바뀐/삭제된 guard 도 있어 순증가는 이보다 작지만 현재 14는 정확하다). `spec-conventions-engine-error-code-surface.md` 는 이 항목을 "(b) repo-guard 등재를 규약으로 세울 것인가" 결정이 열리는 자리로 명시적으로 지목받았는데(`spec-draft-nullable-notation-followups.md` "인접 항목" 각주), 그 결정 세션이 열릴 때 참조할 숫자가 두 문서에서 다르다(7 vs 14). 실질적 오해로 이어질 위험은 낮다(둘 다 "실측 날짜" 를 명시해 두었다) — 하지만 두 plan 이 "한 턴에 함께 볼 것" 이라고 스스로 약속한 만큼, 그 턴에서 구값(7·8)을 신값(14·5·9)으로 교체하는 것을 체크리스트에 남겨두는 편이 안전하다.
- 제안: planner 가 (b) 결정을 위해 `spec-conventions-engine-error-code-surface.md` 를 열 때, 그 문서의 2026-09-04 수치를 `spec-draft-nullable-notation-followups.md` 의 2026-09-14 전수 실측(14/5/9)으로 교체하도록 그 문서에 짧은 포인터를 남길 것.

## 그 외 확인했으나 문제없음으로 판정한 항목 (기록용)

- `spec/conventions/secret-store.md:428`(§R4) · `spec/1-data-model.md:791` 의 `TriggersService.delete()`(실제는 `remove()`) 오기 — 이미 `spec-draft-nullable-notation-followups.md` 에 planner 소유로 정확히 등재됨. developer 자기-반증형 소정정 5조건 중 "그 문장을 developer 자신이 썼다" 가 성립하지 않는 것도 올바르게 판별(작성자 커밋이 2026-05-29 로 이 세션과 무관 — `git blame` 대신 diff 스코프/게이트/owner 3신호로 판별한 것도 기록된 교훈과 일치).
- `codebase/backend/migrations/V063__secret_store.sql:20` 의 같은 오기를 "고치지 않는다" 로 결정한 것은 `spec/conventions/migrations.md`("이미 운영에 적용된 마이그레이션을 수정해 Flyway checksum 불일치로 부팅이 실패하는 일을 막는다")와 정합 — 기존 규약과 충돌 없음.
- `cafe24-api-catalog/_overview.md §7.1` 상호참조 누락, `__` 표기 미정의, `2-trigger-list.md code:` 누락 — 전부 이미 `spec-draft-nullable-notation-followups.md` 에 planner/developer 소유로 정확히 등재돼 있어 "후속 항목 누락" 에 해당하지 않음.
- e2e teardown 관례(`secret_store` 고아 row) 결정은 `secret-store.md §R4`(프로덕션 삭제 경로 규율)와 스코프가 다름을 plan 이 스스로 명시해 충돌 없음.
- `trigger-secret-columns-guard.ts` 는 secret-store.md/EIA §7.1 이 추적하는 "단언 자리"(런타임 e2e 캐너리, 응답 바디 검증)와는 축이 다른 정적 드리프트 가드(세 리터럴 목록의 상호 일치)라 그 두 spec 문단의 "단언 자리는 이제 둘" 서술을 갱신해야 할 의무로 보지 않음.

## 요약

이번 PR 은 spec/conventions 델타가 0 인 코드 전용 변경이며, 관련 plan(`trigger-canary-hardening.md`, `spec-draft-nullable-notation-followups.md`)은 5라운드의 `/ai-review`+`--impl-done` 을 거치며 스스로 여러 차례 실측을 재검증하고 정정한 매우 높은 밀도의 자기 감사 기록을 갖고 있다. 미해결 결정을 일방적으로 우회하는 곳, 선행 plan 의 전제가 깨진 채 진행된 곳은 발견되지 않았다. 유일한 잔여는 이번 세션이 새로 만든 두 건의 실측(harness corpus 굶주림의 두 번째 사례, repo-guard 14개 전수 카운트)이 그 각각의 "소유" 트래커 문서(`harness-review-gate-followups.md`, `spec-conventions-engine-error-code-surface.md`)에는 아직 반영되지 않아 교차참조가 한 방향뿐이라는 것이며, 둘 다 이미 명시적으로 "다음 턴에 함께 볼 것" 이라고 스스로 예고해 두었으므로 즉시 조치가 필요한 결함이 아니라 INFO 로 남긴다.

## 위험도

LOW
