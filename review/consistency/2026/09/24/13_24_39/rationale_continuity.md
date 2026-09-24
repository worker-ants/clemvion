# Rationale 연속성 검토 — spec-draft-frontmatter-pending-plans

## 발견사항

- **[INFO]** 동일 트래커·동일 위반 클래스가 draft 스코프 밖 두 자매 파일에 그대로 남는다
  - target 위치: `plan/in-progress/spec-draft-frontmatter-pending-plans.md` §B·§C·§D (스코프를 `spec/5-system` 세 문서로 한정)
  - 과거 결정 출처: `spec/conventions/spec-impl-evidence.md` §3 표(`implemented` 의 `pending_plans` 는 "없음") 및 `## Rationale` R-11(`update-returning-tuple-shape.md` 공유 트래커의 승격 시점 판정 — "열린 항목을 전수로 열어" 판정)
  - 상세: target 이 스스로 진단한 A-2 위반 클래스("`implemented` 인데 `pending_plans` 가 있다")와 B 절의 R-11 전수 판정(6개 열린 항목 중 미구현 surface 0)은 이 저장소 안에서 **동일한 트래커**(`plan/in-progress/update-returning-tuple-shape.md`)를 가리키는 다른 두 파일에도 글자 그대로 적용된다 — 실측 확인: `spec/conventions/raw-query-results.md` 는 `status: implemented` 이면서 `pending_plans: [update-returning-tuple-shape.md]` 를 그대로 갖고 있어(A-2 와 완전히 같은 위반 형태) target 이 고치는 `8-embedding-pipeline.md`/`10-graph-rag.md` 와 같은 결함이다. `spec/conventions/node-cancellation.md`(`status: partial`)도 같은 트래커를 `pending_plans` 에 걸고 있다(다른 자매 plan 과 함께). 두 파일 모두 target 의 `spec_impact`(`spec/5-system` 세 문서) 밖이라 이번 draft 가 손대지 않기로 한 것은 트리거(`--impl-prep spec/5-system` BLOCK)의 스코프상 합리적이지만, §D("하지 않는 것")에 이 두 자매 파일이 **동일 위반 클래스로 남아 있음**이 명시되어 있지 않다 — R-11 이 요구하는 "판정 근거를 커밋에 남긴다"는 정신에 비춰, 이번에 이미 수행한 6개 항목 전수 판정을 재사용할 수 있는 채로 방치되는 셈이다. Rationale 위반은 아니지만(트래커·판정 자체가 R-11 이 사전 승인한 메커니즘이고 draft 가 이를 정확히 따르고 있음), 다음 `--impl-prep spec/conventions` 스코프 실행이 이 두 파일을 새 Critical 로 다시 발견할 개연성이 높다.
  - 제안: §D "하지 않는 것"에 "`raw-query-results.md`(implemented+pending_plans, A-2 동형) · `node-cancellation.md`(partial, 동일 트래커 참조)는 `spec/5-system` 밖이라 이번 스코프에 포함하지 않음 — 후속 항목으로 등재" 한 줄을 추가하거나, 이미 수행한 R-11 6항목 전수 판정을 그대로 재사용해 두 파일도 같은 커밋/PR 에서 정리한다.

## 요약

target 문서(`spec-draft-frontmatter-pending-plans.md`)는 세 spec 문서의 `pending_plans` frontmatter 오염을 다루면서 기존 Rationale·규약과 정면으로 배치되는 결정을 내리지 않는다. 오히려 A-2(`implemented`+`pending_plans` 공존)를 `spec/conventions/spec-impl-evidence.md §3` 원칙(“`implemented` 의 `pending_plans` 는 없음”)에 맞춰 바로잡고, B 절의 공유 트래커 제거는 같은 문서의 `## Rationale` R-11이 정확히 이 상황(여러 spec 이 걸린 공유 트래커, 열린 항목 전수 판정, 판정 근거를 커밋에 남기는 절차)을 위해 사전 승인해 둔 메커니즘을 문자 그대로 따른다 — 지어낸 근거가 아니라 실제 이력(`git show 5fbcd20b8`)과 실재 파일 존재 여부를 직접 확인해 A-1 근본 원인(YAML 키 삽입으로 인한 항목 재소속)을 바이트 단위로 재현했다. `4-execution-engine.md`의 잔존 `pending_plans`(`execution-engine-residual-gaps.md`, `retry-turn-terminal-guard.md`) 도 해당 문서 Rationale 이 여전히 열어 둔 항목(`#15`·`#17`·G2)과 정확히 일치해 임의로 건드리지 않는다. 유일한 보완 여지는 동일 트래커·동일 위반 클래스를 공유하는 스코프 밖 두 자매 파일(`raw-query-results.md`, `node-cancellation.md`)에 대한 처분을 명시적으로 언급하지 않은 점으로, 이는 Rationale 충돌이 아니라 후속 추적 누락에 가깝다.

## 위험도
LOW
