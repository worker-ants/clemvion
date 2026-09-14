# Plan 정합성 검토 — spec/conventions/ (impl-done, trigger-canary-hardening, 라운드 4)

## 전제 확인

- `spec/conventions/` 델타: **0개 파일** — 이번 브랜치는 그 영역을 전혀 바꾸지 않았다. `plan/in-progress/trigger-canary-hardening.md` frontmatter `spec_impact: none` 과 일치하며 CRITICAL 사유가 아니다.
- 실제 diff(`git -C <worktree> diff origin/main...HEAD -- codebase/`)로 직접 확인: `trigger-secret-columns-{guard.ts,spec.ts}` 신설 + `trigger-workflow-ref.spec.ts`/`chat-channel-trigger-create.e2e-spec.ts`/`schedule-trigger.e2e-spec.ts`/`trigger-workflow-ref.e2e-spec.ts` 수정. `plan/in-progress/{trigger-canary-hardening.md, spec-draft-nullable-notation-followups.md}` 도 함께 바뀌었다.
- HEAD 는 `1a99f07a4`(라운드 3 fix, 12:36:52 커밋)이며 이는 이전 plan_coherence 라운드(`review/consistency/2026/09/14/12_17_21`, 위험도 NONE)가 본 상태(`3f5e451b3`) 이후의 **자기완결적 라운드 3 수정**(가드의 괄호-언랩 분기 대조군 추가 + 트래커 수치 정정 1건)만 얹은 것이다 — `plan/` 외 신규 파일은 `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns*.ts` 뿐이고 새 spec/plan 항목 등재는 없었다.

## 신규/변경된 plan 서술의 target 대조 (독립 재실측)

이전 라운드가 대조한 6개 신규 트래커 항목을 이번에도 독립적으로 재확인했다 — 전부 실측과 일치했다.

| 항목 | 실측 |
|---|---|
| `secret-store.md §R4` 오기 (`TriggersService.delete()`) | **확인** — 428행 `delete()` vs 390행 `remove()`, 실제 코드도 `remove()` 만 존재(`triggers.service.ts:842`) |
| `2-trigger-list.md` `code:` 가 `schedule-trigger.e2e-spec.ts` 누락 | **확인** — frontmatter `code:` 목록에 `trigger-workflow-ref.e2e-spec.ts` 만 있고 신규 시행 파일 없음 |
| repo-guard `code:` 미등재 개수 (14개 중 5개 등재) | **확인** — `find .../repo-guards/__tests__ -name '*-guard.ts'` = 14, `dto-class-name-collision*`·`endpoint-path-conflict-wrap*`·`user-entity-exposure*`·`swagger-dto-contract*`·`dto-jsdoc-citation*` 5종만 spec `code:` glob 매칭 |
| `cafe24-api-catalog/_overview.md §7.1` 자기-예외 상호참조 누락 | **확인** — §7.1 은 "카탈로그 최상위 `<resource>.md` 인덱스는 정식 spec 으로 계속 검증된다" 까지만 서술 |
| `__` 표기 미정의 | **확인** — §7.1 은 kebab-case 예시(`appstore-orders`)만, `__` 구분자 서술 없음 |
| `--impl-prep`/`--spec` 번들 spec 코퍼스 절단 | 본 세션에서도 재현(`spec/conventions/*.md` 다수가 "본문 생략됨"으로 절단) — harness 트래커에 이미 등재된 사실의 재확인 |

`spec-conventions-engine-error-code-surface.md` L117-126 의 "repo-guard 소유 규약 문서(`spec/conventions/repo-guards.md`) 신설 검토" 인접 항목도 확인 — 신규 트래커 항목이 "같은 항목 아님, 단 한 턴에 함께 볼 것"으로 정확히 교차 인용하며 그 결정을 선점하지 않는다.

## 발견사항

없음 — 미해결 결정 우회(CRITICAL), 선행 plan 미해소(WARNING), 후속 항목 누락(WARNING) 어느 것도 발견되지 않았다. 라운드 3 의 자기완결적 수정(가드 테스트 대조군 보강 + 트래커 수치 정정)은 plan 서술과 diff 가 정확히 일치하며 다른 `plan/in-progress/**` 파일의 결정·전제를 건드리지 않는다.

참고(비발견사항, INFO 수준 재확인 — 이전 라운드가 이미 등재·처분함, 신규 조치 불요):
- repo-guard `code:` 등재 관례 결정이 `spec-draft-nullable-notation-followups.md`·`spec-conventions-engine-error-code-surface.md` 두 plan 에 분산돼 있으나, 양쪽 모두 상호 포인터를 남기고 결정을 선점하지 않아 모순 없음.
- `secret-store.md §R4` 오기는 처분(`delete()`→`remove()` 한 단어)이 이미 트래커에 명시돼 있어 별도 조치 불요.

## 요약

이번 브랜치는 `spec/conventions/` 를 변경하지 않는 code-only 배치(트리거 캐너리 하드닝 4건)이며, 라운드 3 수정은 가드 자체의 테스트 커버리지 보강과 트래커 수치 정정에 그쳐 plan 정합성에 영향을 주는 신규 서술이 없다. 이전 라운드가 대조했던 6개 신규 트래커 항목(secret-store.md §R4 오기·2-trigger-list.md code: 누락·repo-guard 미등재·cafe24-api-catalog §7.1 상호참조·`__` 표기·harness 번들 절단)을 독립적으로 재실측한 결과 전부 target 현재 상태와 정확히 일치했고, 어떤 plan 의 미해결 결정을 일방적으로 침해하거나 선행 조건을 건너뛰거나 후속 항목을 누락한 사례도 발견되지 않았다.

## 위험도

NONE
