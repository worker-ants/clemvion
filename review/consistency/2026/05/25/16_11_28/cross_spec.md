# Cross-Spec 일관성 검토 결과

**검토 대상**: `plan/in-progress/spec-fix-presentation-common-frontmatter.md`
**검토 모드**: `--spec` (spec draft 검토)
**검토 일시**: 2026-05-25

---

## 발견사항

### [WARNING] `spec-only` → `implemented` 직접 전이 — `partial` 단계 건너뜀

- **target 위치**: 제안 변경 "W6 — frontmatter 갱신" 항, 제안 frontmatter `status: implemented`
- **충돌 대상**: `spec/conventions/spec-impl-evidence.md §3.1 전이 규칙`
- **상세**: `spec-impl-evidence §3.1` 은 정규 전이 경로를 `spec-only → partial (최초 코드 머지) → implemented (마지막 pending_plans complete/)` 로 명시한다. target draft 는 현재 `spec-only` 인 `spec/4-nodes/6-presentation/0-common.md` 를 `partial` 를 거치지 않고 곧바로 `implemented` 로 올린다. draft 자체도 이 규칙을 "§3.1 '최초 코드 머지 → partial, 모든 약속 구현 → implemented' 전이 규칙" 으로 인용하지만, 적용 방법은 단계를 생략한 채 결론만 채택한다. 현재 현재 구현의 완전성을 주장하는 근거(§10.9 line 407 invariant 처리 등)가 충분히 기술되어 있어 `implemented` 주장 자체가 사실적으로 그릇된 것은 아니나, 컨벤션이 규정한 전이 절차(중간 `partial` 상태 경유)를 문서 이력에 남기지 않는 것은 형식적 위반이다.
- **제안**: (A) `status: implemented` 를 그대로 채택하되, 이 spec 이 `partial` 단계를 경유하지 않고 바로 `implemented` 로 전이하는 이유 — "최초 코드 머지 시점에 이미 모든 약속이 구현 완료되어 있었고, spec frontmatter 만 지연됐던 경우" — 를 `spec-impl-evidence §3.1` 또는 해당 spec 의 `## Rationale` 에 예외 근거로 한 줄 명시한다. (B) 또는 `status: partial` → `status: implemented` 두 커밋으로 분리한다. (A) 가 실용적이다.

---

### [INFO] `id: common` → `id: presentation-common` 변경이 다른 6개 카테고리 `0-common.md` 와의 불일치를 부분적으로만 해소

- **target 위치**: 제안 변경 "W6 — frontmatter 갱신" 항, `id: common → id: presentation-common`
- **충돌 대상**: `spec/4-nodes/1-logic/0-common.md`, `spec/4-nodes/2-flow/0-common.md`, `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/4-integration/0-common.md`, `spec/4-nodes/5-data/0-common.md`, `spec/4-nodes/7-trigger/0-common.md` — 모두 `id: common`
- **상세**: draft 가 `id: common` 중복 해소 이유로 언급한 "convention-compliance-checker INFO #I2" 는 7개 카테고리 공통 문서 전체에 동일하게 적용된다. `presentation/0-common.md` 만 `id: presentation-common` 으로 바꾸면 6개 파일은 여전히 `id: common` 으로 남아 중복 문제가 잔존한다. `spec-frontmatter.test.ts` 가 `id` 유일성을 검증하지 않음이 확인되어 빌드 실패는 없지만, ID 공간의 의미론적 일관성 면에서 6개 파일도 각자 카테고리 prefix 를 붙이는 것이 자연스럽다(예: `logic-common`, `ai-common`).
- **제안**: 본 PR 범위에서 6개를 일괄 수정하거나, "presentation-common 전환이 다른 카테고리의 동명 ID 이슈를 분리 plan 으로 추적" 임을 plan/CHANGELOG 에 명시한다. 어느 쪽이든 현재 draft 가 이 전환을 단독으로 처리한다고 기술하는 것은 오해를 낳을 수 있다.

---

### [INFO] `spec-drift-ws-button-config.md` (BLOCK:YES CRITICAL 미해결) 상태에서 `implemented` 승격 — 연관 surface 의 완전성 논란 가능성

- **target 위치**: "Side-effect 점검" 항 — "consistency-check W1/W2 는 별도 plan `spec-drift-ws-button-config.md` 가 추적 중 — 본 PR 변경과 직교"
- **충돌 대상**: `plan/in-progress/spec-drift-ws-button-config.md` (BLOCK:YES, C2 + C3), `spec/5-system/6-websocket-protocol.md §4.4` ↔ `spec/4-nodes/6-presentation/0-common.md §3·§4·§6.1`
- **상세**: `spec-drift-ws-button-config.md` 는 `spec/5-system/6-websocket-protocol.md §4.4` 의 `buttonConfig.timeout` / `nodeOutput.type` 판별자가 `spec/4-nodes/6-presentation/0-common.md §3·§4` 와 직접 모순(CRITICAL C2, C3)임을 기록한다. 이 모순은 `presentation/0-common.md` 본문 자체가 다른 spec 과 충돌하는 상태이며, 아직 미해결이다. target draft 는 이를 "직교" 로 처리하는데, `0-common.md` 의 `implemented` 승격은 "모든 약속 구현 완료"를 선언하므로 해당 spec 이 다른 영역과 모순 상태인 채 `implemented` 가 되면 모순 상태 자체가 "구현 완료"로 굳어지는 효과가 있다. 본 draft 의 scope(frontmatter/CHANGELOG 메타 변경)와 직교하다는 주장은 논리적으로 타당하나, 외부에서 볼 때 `implemented` spec 과 CRITICAL 미해결 모순이 동시에 존재한다는 인상을 줄 수 있다.
- **제안**: `pending_plans:` 에 `plan/in-progress/spec-drift-ws-button-config.md` 를 추가해 해당 drift 가 해소될 때까지 `partial` 를 유지하거나, 또는 `implemented` 로 올리더라도 spec 본문 내 `## Rationale` 에 "WS protocol §4.4 와의 C2/C3 모순은 `spec-drift-ws-button-config.md` 해소 대기" 라고 명시한다. 후자(명시 후 `implemented`)가 이미 채택된 방향이라면 INFO 수준에서 주석을 남기는 것으로 충분하다.

---

### [INFO] `code:` glob 중 `execution-engine.service.ts` 단일 파일 경로 — spec §1~§10 전체 surface 증거로서의 좁은 커버리지

- **target 위치**: 제안 frontmatter `code:` 두 번째 항목 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- **충돌 대상**: `spec/conventions/spec-impl-evidence.md §2.1` ("본 spec 이 약속한 surface 의 구현 경로")
- **상세**: `spec-impl-evidence §4` 의 `spec-code-paths.test.ts` 가드는 `≥1 매치` 만 요구하므로 기술적으로 통과한다. 그러나 `presentation/0-common.md §1~§10` 은 ButtonDef, 포트 토폴로지, Blocking Mode, 출력 포맷, 5필드 공통, AI Tool 모드, render_* 클릭 user-message 합성, §10.9 dispatch 표 등 광범위한 surface 를 정의한다. 단일 서비스 파일과 `_shared/**` glob 이 이 surface 전체를 대표하기 충분한지는 검증되지 않았다. 다른 spec 과의 직접 충돌은 없으나 evidence 의 신뢰도가 낮을 수 있다.
- **제안**: `codebase/backend/src/nodes/presentation/**` glob 을 추가하면 프레젠테이션 노드 핸들러 전체를 포괄해 §1~§10 surface 의 증거 폭이 넓어진다. 필수는 아님.

---

## 요약

target draft 는 `spec/4-nodes/6-presentation/0-common.md` 의 frontmatter(`status`, `id`, `code:`)와 §9 CHANGELOG 만 수정하는 메타 레이어 변경으로, spec 본문 내용 자체를 바꾸지 않는다. 다른 영역과의 데이터 모델·API 계약·RBAC·계층 책임 관점에서의 직접 충돌은 발견되지 않았다. 핵심 주의 사항은 두 가지다. 첫째, `spec-impl-evidence §3.1` 의 전이 규칙이 `spec-only → partial → implemented` 순서를 명시하는데 `partial` 단계를 건너뛰는 것에 대한 예외 근거가 spec 또는 plan 안에 명시적으로 기록되어 있지 않다(WARNING). 둘째, `spec-drift-ws-button-config.md` 의 CRITICAL 미해결 모순(WS spec §4.4 vs presentation §3·§4)이 남아 있는 상태에서 이 spec 이 `implemented` 로 승격되면 모순 해소 이전에 "완료" 상태가 굳어지는 외형이 형성된다(INFO). 나머지 발견사항(다른 카테고리 `id: common` 6개 잔존, `code:` glob 커버리지)은 동기화 권장 수준이다.

---

## 위험도

**LOW**

(CRITICAL 충돌 없음. WARNING 1건은 라이프사이클 절차의 형식적 위반으로 실제 동작 불가 상황을 초래하지 않음. 미해결 CRITICAL drift 는 본 draft 의 scope 밖에 있으며 별도 plan 이 추적 중임.)
