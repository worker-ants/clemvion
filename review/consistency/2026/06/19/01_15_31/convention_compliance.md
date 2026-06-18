# 정식 규약 준수 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
대상: `spec/5-system/4-execution-engine.md`

---

## 발견사항

- **[WARNING]** `pending_plans` 에 이미 `complete/` 로 이동한 plan 경로가 잔류
  - target 위치: `spec/5-system/4-execution-engine.md` frontmatter line 11 — `plan/in-progress/spec-sync-execution-engine-gaps.md`
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §4` `spec-pending-plan-existence.test.ts` — "`pending_plans:` 의 모든 path 가 `plan/in-progress/` 또는 `plan/complete/`(in-progress→complete 치환) 에 실존" + `spec-status-lifecycle.test.ts` 가드 (c) "`partial` 의 `pending_plans` 모두 complete 인데 status 미승격"
  - 상세: `plan/complete/spec-sync-execution-engine-gaps.md` 가 실존하므로 이 plan 은 완료됐다. `spec-pending-plan-existence.test.ts` 는 경로를 in-progress→complete 치환하여 통과 판정하므로 build 차단까지는 되지 않지만, `status: partial` 유지의 근거 plan 중 하나가 사실상 완료됨을 의미한다. 나머지 3개(`execution-engine-residual-gaps.md`, `exec-intake-queue-impl.md`, `exec-park-durable-resume.md`)는 `plan/in-progress/` 에 실존하므로 `status: partial` 자체는 적법하다. 하지만 완료된 plan 이 `pending_plans` 목록에 남아 있으면 status 승격 가드의 트리거 상태가 혼재되어 추적 신뢰성이 떨어진다.
  - 제안: `pending_plans` 에서 `plan/in-progress/spec-sync-execution-engine-gaps.md` 항목을 제거한다. 나머지 3개 in-progress plan 이 잔류하므로 `status: partial` 은 그대로 유지된다.

- **[INFO]** `id` 값이 파일 basename 과 일치하여 규약을 준수하나, frontmatter `id: execution-engine` 이 `spec/5-system/4-execution-engine.md` basename `4-execution-engine` 과 불일치
  - target 위치: `spec/5-system/4-execution-engine.md` frontmatter line 2
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — "파일 basename(확장자 제외) 기반 권장. 같은 basename 이 영역을 달리해 중복될 때는 후발 문서가 영역 prefix 로 충돌을 회피" (권장 사항)
  - 상세: 규약은 `id` 를 "파일 basename 기반 **권장**" 으로 규정하며 **의무가 아니다**. `4-execution-engine` 대신 `execution-engine` 을 선택한 것은 숫자 prefix(`4-`)를 제거해 의미 중심 id 를 부여한 것으로, 다른 spec 에서도 광범위하게 쓰이는 패턴(예: `error-codes`, `execution-context`)과 일관된다. 기존 conventions 문서들 자체(예: `id: error-codes`, `id: audit-actions`)도 동일 패턴을 따른다. 엄밀 위반이 아닌 INFO 수준의 형식 관찰이다.
  - 제안: 현행 유지. 수정 불요. 규약 갱신도 불요 — 기존 선례가 충분히 많다.

- **[INFO]** 문서 구조 3섹션(Overview / 본문 / Rationale) 은 완비되어 있음. 추가 관찰 없음.

---

## 요약

`spec/5-system/4-execution-engine.md` 는 정식 규약(`spec/conventions/spec-impl-evidence.md`)을 전반적으로 준수한다. frontmatter 의 `id`/`status`/`code:`/`pending_plans:` 필드가 모두 존재하고, 3섹션(Overview/본문/Rationale) 구조가 갖춰져 있으며, 에러 코드·노드 출력·실행 컨텍스트 등 conventions 의 명명 규칙도 spec 본문에서 올바르게 참조된다. 다만 `pending_plans` 에 이미 `plan/complete/` 로 이동 완료된 `spec-sync-execution-engine-gaps.md` 가 잔류하고 있어 plan 추적 신뢰성의 경미한 결함이 존재한다. build 차단 가드는 in-progress→complete 치환 경로로 통과하므로 CI 를 막지 않지만, 이 항목을 제거하는 것이 spec-impl-evidence 규약의 의도에 부합한다.

---

## 위험도

LOW

STATUS: DONE
