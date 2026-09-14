# Plan 정합성 검토 — spec/conventions/ (impl-done, trigger-canary-hardening)

## 전제 확인

- `spec/conventions/` 델타: **0개 파일** — 이 브랜치(`efb0e4b36`·`4c1a49b30`·`3f5e451b3`)는 `codebase/backend` 테스트/가드 6파일과 `plan/in-progress/{trigger-canary-hardening.md, spec-draft-nullable-notation-followups.md}` 만 바꿨다. `spec/` 은 전혀 건드리지 않았다 — `spec_impact: none` (plan frontmatter) 과 일치.
- 실제 코드 diff(`git diff origin/main...HEAD --name-only -- codebase/`)로 직접 확인: `trigger-secret-columns-{guard.ts,spec.ts}` 신설, `trigger-workflow-ref.spec.ts`/`chat-channel-trigger-create.e2e-spec.ts`/`schedule-trigger.e2e-spec.ts`/`trigger-workflow-ref.e2e-spec.ts` 수정.
- 따라서 본 검토의 핵심 질문은 "target(spec/conventions/ 현재 상태)이 plan 의 미해결 결정을 침해하는가" 인데, target 자체가 이 배치에서 변경되지 않았으므로 **침해 가능성이 구조적으로 낮다.** 대신 plan(`spec-draft-nullable-notation-followups.md`)이 이번에 새로 등재한 6개 후속 항목이 target 의 현재 상태와 실제로 정합하는지를 실측으로 대조했다.

## 신규 등재 6항목 vs target 현재 상태 대조

| # | plan 항목 | target 관련 파일 | 실측 |
|---|---|---|---|
| 1 | `secret-store.md §R4` 오기 `delete()`→`remove()` | `spec/conventions/secret-store.md:428` | **확인** — 428행 `TriggersService.delete()` vs 390행 `TriggersService.remove()`. 문서 내부 불일치 실재, plan 이 정확히 짚음 |
| 3 | 신규 repo-guard `code:` 미등재, (b) 등재 관례 자체가 미정 | `spec/conventions/*` 전체 `code:` frontmatter | **확인** — `trigger-secret-columns-{guard,spec}.ts` 는 어느 spec 의 `code:` glob 에도 안 걸림. plan 이 인접 미결 항목(`spec-conventions-engine-error-code-surface.md` 의 "`spec/conventions/repo-guards.md` 신설 검토")을 정확히 교차 인용하며 "같은 항목 아님, 단 한 턴에 함께 볼 것"으로 **적절히 분리** — 결정을 선점하지 않음 |
| 6 | `cafe24-api-catalog/_overview.md §7.1` 에 "자신이 §1 예외" 상호참조 누락 | `spec/conventions/cafe24-api-catalog/_overview.md` §7.1 | **확인** — 현재 §7.1 은 "카탈로그 최상위 `<resource>.md` 인덱스는 정식 spec 으로 계속 검증된다" 까지만 적고, `_overview.md` 자신이 그 예외에 해당한다는 문장은 없음. plan 이 첫 등재(false positive)를 스스로 철회하고 실측으로 좁힌 이력도 기록에 포함 — 갱신 이력이 target 상태와 어긋나지 않음 |
| 7 | `__` 이중언더스코어 표기가 §7.1 에 미정의 | `spec/conventions/cafe24-api-catalog/_overview.md` §7.1, `store.md` | **확인** — §7.1 은 "kebab-case, 예: `appstore-orders`" 까지만 명시. 실제 `store/paymentgateway__paymentmethods.md`·`store/paymentmethods__paymentproviders.md` 등 `__` 파일이 존재(grep 확인)하지만 규약 문서에 부모-자식 구분자 서술 없음. plan 지적 정확 |
| 2 | `2-trigger-list.md` 의 `code:` 가 `schedule-trigger.e2e-spec.ts` 누락 | `spec/2-navigation/2-trigger-list.md` (target 범위 밖) | 실측상 정확하나 **target(spec/conventions/) 스코프 밖** — 별 영향 없음 |
| 5 | `--impl-prep`/`--spec` 번들이 `spec/` 전체를 절단 | harness (`plan/in-progress/harness-review-gate-followups.md` "굶는다" 항목과 병합 검토 대상) | **본 세션에서도 재현** — 이 프롬프트 번들에서 `spec/conventions/error-codes.md`·`secret-store.md`·`node-output.md`·`swagger.md`·`spec-impl-evidence.md`·`migrations.md` 등 다수와 diff 본문 자체가 "본문 생략됨(의도된 절단)" 으로 대체됨. 코드 확인은 `git diff`/`grep` 직접 조회로 우회했으나, **이 harness 항목의 스코프가 spec/conventions/ 트리에도 해당함을 실측으로 재확인** (이미 등재된 내용의 추가 증거, 새 결함 아님) |

## 발견사항

- **[INFO]** repo-guard `code:` 등재 관례 결정은 두 plan 에 분산 — 병합 시점 확인 필요
  - target 위치: `spec/conventions/` 전체 frontmatter `code:` (아직 관례 없음)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목 "신규 repo-guard 가 spec code: 에 미등재" (b) 및 `plan/in-progress/spec-conventions-engine-error-code-surface.md` L117-126 "`spec/conventions/repo-guards.md` 신설 검토"
  - 상세: 두 plan 모두 "같은 결정 자리가 될 수 있다"는 점을 스스로 이미 인지하고 상호 포인터를 남겼다(`spec-draft-nullable-notation-followups.md` 신규 항목의 "인접 항목" 문단). 실측(14개 repo-guard 중 5개만 등재, 관례라 부를 수 없음)도 두 plan 사이에 모순 없이 일치한다. target 이 아직 이 결정을 선점하지 않은 점도 확인 — 침해 없음
  - 제안: 이후 이 결정을 다루는 세션은 두 plan 을 한 턴에 열어 `spec/conventions/repo-guards.md` 신설 여부 + 기존 미등재 9건의 소급 등재 범위를 함께 확정할 것 (plan 자체가 이미 이렇게 요청하고 있음 — 새 조치 불요, 확인만)
- **[INFO]** `secret-store.md §R4` 오기가 이번 배치로 처음 가시화됨 — 처분은 이미 plan 에 등재
  - target 위치: `spec/conventions/secret-store.md:428` (`TriggersService.delete()` — 390행 `remove()` 와 불일치)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목 (owner: planner)
  - 상세: 실제 오기 존재를 확인했고, 처분(§R4 의 `delete()` → `remove()` 한 단어)도 plan 에 정확히 적혀 있어 별도 조치 불필요. `trigger-canary-hardening` 의 e2e 주석이 §R4 를 처음 명시 인용해 드러난 것이라는 plan 의 인과 서술도 diff(`trigger-workflow-ref.e2e-spec.ts` 등)와 부합
  - 제안: 다음 planner 턴에서 1줄 수정. 급하지 않음(문서 내 다른 부분은 정확해 기능적 혼선 위험 낮음)

## 요약

이번 브랜치는 `spec/conventions/` 를 전혀 변경하지 않는 code-only(테스트/가드) 배치이며, plan(`trigger-canary-hardening.md`)이 명시한 `spec_impact: none` 과 실제 diff 가 일치한다. `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 새로 등재된 6개 후속 항목 중 target(spec/conventions/) 범위에 해당하는 4건(secret-store.md §R4 오기·repo-guard 미등재·cafe24-api-catalog `_overview.md §7.1` 상호참조 누락·`__` 표기 미정의)을 모두 실측 대조했으며, 전부 plan 의 서술이 target 의 현재 상태와 정확히 일치했고 target 이 그 미해결 결정을 일방적으로 선점하거나 위반한 사례는 없었다. 인접한 두 plan(`spec-conventions-engine-error-code-surface.md`)의 repo-guard 등재 관례 미결 상태도 서로 모순 없이 교차 인용돼 있다. 미해결 결정 우회(CRITICAL)나 선행 plan 미해소·후속 항목 누락(WARNING) 은 발견되지 않았다.

## 위험도

NONE
