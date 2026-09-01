# Plan 정합성 검토 — `spec-draft-error-code-two-surfaces.md`

## 발견사항

- **[WARNING]** 착수 근거 plan 이 명시한 "실제 무게" 결정(판단 기준 문서화 여부)이 draft 에서 다뤄지지 않음
  - target 위치: `plan/in-progress/spec-draft-error-code-two-surfaces.md` §변경 제안(53~63행), §Rationale "왜 자매 const 인가"(71~73행)
  - 관련 plan: `plan/in-progress/spec-conventions-engine-error-code-surface.md` §함께 볼 것 (착수 전 읽기) — "규약 문서에 한 줄을 쓰면 그 형태가 규약으로 굳는다. 그래서 병기만 하지 말고, '언제 central enum 을 확장하고 언제 자매 const 를 만드는가' 의 판단 기준을 함께 적을지를 planner 가 결정해야 한다 — **그게 이 항목의 실제 무게다**." / 그리고 그 문단이 직접 지목하는 `plan/complete/exec-intake-followups.md` ARCH#5 ⑤(59~96행)
  - 상세:
    1. 착수 근거 plan(`spec-conventions-engine-error-code-surface.md`)은 이 draft 가 "병기 1줄"에서 멈추지 말고 **"판단 기준을 함께 적을지"를 planner 가 결정**해야 한다고 명시적으로 요구했고, 스스로 그것을 "이 항목의 실제 무게"라 불렀다. 그런데 target 의 §변경 제안은 두 surface 를 나열하고 "같은 파일의 자매 const" 라는 사실만 적을 뿐, "언제 central enum 을 확장하고 언제 자매 const 를 만드는가"에 대한 일반 판단 기준은 추가하지도, 추가하지 않기로 결정했다는 진술도 남기지 않았다. §Rationale "무엇을 안 하나" 단락은 "§3·§4 의 정규화 파이프라인 서술"만 범위 밖으로 명시하는데, §3(Historical-artifact 예외 레지스트리)·§4(내부 분류 코드)는 애초에 "판단 기준" 논의가 들어갈 자리가 아니다(`spec/conventions/error-codes.md:75-93` 확인) — 그 논의가 들어갈 자리는 target 이 실제로 편집하는 §Overview 자체다. 즉 "무엇을 안 하나" 서술이 다른 두 절을 가리키는 사이에, 정작 요구받은 결정은 조용히 빠졌다.
    2. target 의 "이 draft 는 그 결정을 재확인할 뿐 번복하지 않는다"는 표현은 ARCH#5 ⑤ 원문이 스스로 남긴 유보를 옮기지 않는다. ARCH#5 ⑤(`plan/complete/exec-intake-followups.md:82-92`)는 "이 논리는 `RETRY_*` 에도 똑같이 적용될 수 있었고 그때는 채택되지 않았다 — 즉 중립적 선택이 아니라 형태의 의식적 이탈"이며 "해석의 여지가 있다는 사실 자체를 여기 남긴다"고 명시적으로 적어 두었다(완화 요인: 그 2026-06-14 결정 표제가 WS ack 경계 코드에 한정된 맥락일 수 있음). target 은 이 유보를 인용하지 않고 "노출 경계가 다르기 때문" 한 문장으로 단순화해 마치 깔끔히 정착된 선례처럼 서술한다.
  - 제안: 아래 중 하나를 target 에 반영한 뒤 재검토를 받을 것.
    - (a) §변경 제안에 "언제 central enum 을 확장하고 언제 자매 const 를 만드는가"에 대한 짧은 판단 기준 한 문단을 추가하고, ARCH#5 ⑤ 의 유보("의식적 이탈"·"해석의 여지")를 그대로 인용해 규약 문서 독자가 이 형태를 무비판적 선례로 오독하지 않게 한다.
    - (b) 지금은 병기만 하기로 **명시적으로 결정**하고("판단 기준 문서화는 별도 planner 항목으로 분리한다"는 한 줄과 그 근거), `spec-conventions-engine-error-code-surface.md` 의 §함께 볼 것 질문에 대한 답을 이 draft 나 그 plan 체크리스트에 남겨 다음 사람이 같은 질문을 다시 열지 않게 한다.
    - 어느 쪽이든 현재처럼 질문 자체가 사라지는 상태로 두지 말 것.

- **[INFO]** 착수 근거 plan 의 체크리스트·frontmatter 가 draft 존재를 아직 반영하지 않음
  - target 위치: `plan/in-progress/spec-draft-error-code-two-surfaces.md` (신규 draft 파일 자체)
  - 관련 plan: `plan/in-progress/spec-conventions-engine-error-code-surface.md` frontmatter(`worktree: (unstarted)`) 및 §할 일 체크박스 2개(둘 다 미체크)
  - 상세: 이 draft 가 실제로 `spec/conventions/error-codes.md` 에 반영되고 나면 `spec-conventions-engine-error-code-surface.md` 의 두 체크박스("병기"·"착수 시 consistency-check")를 갱신하고 `worktree` 를 실제 값으로 바꾼 뒤 `plan/complete/` 로 옮기는 절차가 남는다. 지금은 draft 단계이므로 문제는 아니나, 적용 커밋에서 빠뜨리기 쉬운 자리라 표시해 둔다.
  - 제안: draft 적용 커밋에서 `spec-conventions-engine-error-code-surface.md` 체크리스트 동시 갱신 + `plan/complete/` 이동을 함께 수행할 것.

## 요약

target 은 `EngineErrorCode` 병기라는 좁은 사실 자체는 정확히 서술하지만(코드·테스트 실측 확인됨), 착수 근거 plan(`spec-conventions-engine-error-code-surface.md`)이 명시적으로 "이 항목의 실제 무게"라 부른 질문 — "언제 central enum 을 확장하고 언제 자매 const 를 만드는가"에 대한 판단 기준을 함께 적을지 — 를 다루지 않고 조용히 건너뛰었다. 그 상위 근거인 `exec-intake-followups.md` ARCH#5 ⑤ 역시 이 형태 선택이 선례("레이어가 달라도 한 enum")로부터의 "의식적 이탈"이며 해석의 여지가 있다고 스스로 유보를 남겼는데, target 의 Rationale 은 이를 "재확인할 뿐 번복하지 않는다"는 한 문장으로 단순화해 유보를 지운다. plan 이 다른 두 open decision(예: `spec-update-node-cancellation-shutdown-classification.md` 의 §3 `AbortError` (a)/(b) 택일)과는 직접 충돌하지 않으며 — `AbortError` 는 `EngineErrorCode` 밖의 별개 값이라 이 병기와 대상이 다르다 — 그 점은 문제 없다. 요컨대 미해결 결정과의 정면 충돌은 없으나, 착수 근거 plan 이 명시적으로 요구한 하위 결정 하나가 draft 에서 답해지지 않은 채 남아 있다.

## 위험도

MEDIUM
