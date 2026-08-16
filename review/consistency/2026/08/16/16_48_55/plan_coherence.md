# Plan 정합성 검토 — `eia-internal-rest-error-masking.md`

## 조사 방법

- target(`plan/in-progress/eia-internal-rest-error-masking.md`)과 그 정본 트래커
  (`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)를 디스크에서 직접 열어
  대조. 둘 다 이 worktree 에 **같은 커밋되지 않은 diff**로 함께 수정돼 있음을
  `git status`/`git diff` 로 확인(트래커의 I1·D 항목에 "결정됨" 캐비엇 + 신규 잔여
  항목 재구성이 target 의 체크리스트와 짝을 이룸).
- `plan/in-progress/**` 전체(35개 파일 + `node-output-redesign/` 서브트리)에서
  `Execution.error` · `redactStoredError` · `triggerToken` · `NodeExecution.error` ·
  `execution.node.*` · `execution.snapshot` · `secret-store.md` · `R-5` · `14-execution-history.md`
  등 target 이 건드리는 키워드로 grep, 교차 참조 여부 확인.
- `spec/1-data-model.md` §2.14, `spec/5-system/14-external-interaction-api.md:1484`·`:910`,
  `spec/2-navigation/14-execution-history.md` frontmatter 를 직접 읽어 target 이 인용한
  현재 spec 상태와 대조.

## 발견사항

- **[INFO]** frontmatter `spec_impact` 가 planner 턴 ⓑ 의 대상 문서를 아직 포함하지 않음
  - target 위치: frontmatter `spec_impact:` (2건 — `14-external-interaction-api.md`,
    `secret-store.md`) vs 체크리스트 `- [ ] planner 턴 ⓑ — 14-execution-history.md 에
    Execution.error 마스킹 정책 별도 명시`
  - 관련 plan: target 자신의 body(ⓑ)와 frontmatter 간 불일치. 외부 plan 충돌은 아님
  - 상세: target 은 `spec/2-navigation/14-execution-history.md` 를 편집하겠다고 스스로
    약속했지만(R-5 오독 경계를 그 문서 안에 못박는 작업) frontmatter `spec_impact` 목록엔
    없다. `.claude/docs/plan-lifecycle.md §Gate C` 상 in-progress 단계에서는 의무가 아니라
    지금 당장 게이트를 막지는 않지만, `complete/` 이동 시점에 `spec-plan-completion.test.ts`
    가 실제 diff 와 frontmatter 목록을 대조해 강제한다 — 지금 추가해 두지 않으면 완료
    이동 직전에 또 손볼 항목이 된다.
  - 제안: planner 턴에서 ⓑ 를 실제로 적용할 때 frontmatter `spec_impact` 에
    `spec/2-navigation/14-execution-history.md` 추가.

- **[INFO]** planner 턴 ⓓ 의 `code:` 갱신 범위가 관련 문서 하나를 덜 다룸
  - target 위치: 체크리스트 `planner 턴 ⓓ — 14-external-interaction-api.md frontmatter
    code: 에 redact-stored-error.ts · executions.service.ts 추가`
  - 관련 spec: `spec/2-navigation/14-execution-history.md` frontmatter `code:` (이미
    `executions.service.ts` 를 보유 — `GET /executions/:id` 등 target 이 마스킹을 적용하는
    바로 그 엔드포인트의 정본 문서)
  - 상세: 신규 파일 `shared/utils/redact-stored-error.ts` 는 `ExecutionsService` 의 내부
    REST 응답(주로 `14-execution-history.md` 가 다스리는 표면)에 적용된다. ⓓ 는 이 파일을
    `14-external-interaction-api.md` 의 `code:` 에만 추가하고 `14-execution-history.md` 의
    `code:` 에는 추가 언급이 없다. 두 문서 모두 같은 서비스를 참조하므로 정본 트래킹 관점에서
    한쪽만 갱신하면 나중에 "이 파일이 어느 spec 소속인가"를 다시 조사해야 할 수 있음.
  - 제안: planner 턴에서 ⓑ(정책 명시)와 ⓓ(code: 갱신)를 같은 편집에서 처리한다면
    `14-execution-history.md` 의 `code:` 목록에도 `redact-stored-error.ts` 등재를 검토.

## 정합성 확인된 항목 (참고용 — 발견사항 아님)

- **I1·D 결정**: 트래커의 두 미결 항목(I1, D)은 target 이 주장하는 "2026-08-16 사용자 택일"
  캐비엇을 이미 함께 반영한 상태로 같은 diff 안에 있다 — 트래커가 아직 target 을 모르는
  상태로 남아 있는 stale drift 는 없음.
- **NodeExecution.error 재분류**: target 의 `16_32_42 BLOCK: YES` (C2) 조치로 트래커의 해당
  항목이 "같은 클래스의 유출 가능성" → "동일 값의 복사 원본(해소)"로 격상 정정됐고, 이는
  `spec/1-data-model.md` §2.14 의 "복사" 정의와 실측이 일치함.
  `WS execution.node.* emit` 잔여 항목도 트래커·target 양쪽에 동일하게 신규 등재돼 있음.
- **`14-external-interaction-api.md:1484`/`:910`**: 아직 구 텍스트("미결이다"/"향후 검토")
  그대로이며, 이는 target 의 체크리스트가 planner 턴 미완료로 정확히 표시한 상태와 일치.
  다른 어떤 in-progress plan 도 이 두 위치의 구 텍스트를 전제로 참조하지 않음(grep 전수
  확인) — target 의 spec 교체가 다른 plan 의 후속 항목을 무효화할 위험 없음.
- **`interaction.triggerToken`**: `secret-store.md`/`triggerToken` 을 참조하는 다른
  in-progress plan 은 없음. `AuthConfig.config` 예외 문구를 다루는
  `backend-lint-gate-broken-on-main.md` 의 secret-store.md 편집은 §2.1(`deleteByPrefix`
  invariant)로 target 이 신설하는 §1 블록과 섹션이 달라 충돌 없음.
- **R-5 인용**: `14-execution-history.md` R-5 를 참조하는 다른 in-progress plan 없음 —
  target 의 "R-5 과대인용 방지" 캐비엇을 무효화하거나 재작업을 요구할 자매 plan 없음.
- **eia-terminal-payload.md / spec-draft-eia-62-waiting-payload.md**: `Execution.error` 의
  객체화·nullable `nodeId`·§6.4 wire 형태 관련 항목은 전부 이미 완료(체크됨) 상태이고,
  target 이 "재사용하지 않는다"고 명시한 `toTerminalErrorPayload` 와 값 마스킹(내부 REST)을
  구분하는 설계와 어긋나지 않음.
- **pending_plans 관행**: target frontmatter 의 `pending_plans:
  [spec-sync-external-interaction-api-gaps.md]` 는 plan-lifecycle §4 정의(선행/의존)와
  엄밀히는 방향이 반대(트래커가 target 의 선행 조건이 아니라 target 이 트래커의 항목을
  집행)이지만, 같은 패턴을 `spec-draft-eia-notification-payload-contract.md` 등 기존
  plan 들도 동일하게 써 온 확립된 관행이라 target 이 새로 만든 문제가 아님(보고 대상 제외).

## 요약

target 은 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)의 I1·D 미결 항목을
집행하며, 두 문서가 같은 미커밋 diff 안에서 서로 짝을 맞춰 갱신돼 있어 "plan 이 아직 모르는
target 의 결정"이나 "target 이 무시한 plan 의 미결 항목" 같은 CRITICAL 급 불일치는 발견되지
않았다. `plan/in-progress/**` 전체를 키워드로 훑어도 target 이 건드리는 표면
(`Execution.error`, `NodeExecution.error`, `triggerToken`, R-5, §R17)을 다른 관점에서
동시에 다루는 자매 plan은 없어 후속 항목 무효화 위험도 낮다. 유일한 잔여는 target 자신의
frontmatter `spec_impact`/`code:` 완결성이 체크리스트가 스스로 약속한 planner 턴 범위(ⓑ)를
아직 다 반영하지 못한 INFO 수준 갭 2건으로, 지금 당장 게이트를 막지는 않으나 planner 턴
집행 시점에 함께 정리하는 것이 좋다.

## 위험도

LOW
