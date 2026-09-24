# Cross-Spec 일관성 검토 — spec-draft-frontmatter-pending-plans

## 발견사항

- **[WARNING]** 같은 공유 트래커의 R-11 판정이 4번째 문서(`spec/conventions/node-cancellation.md`)에는 적용되지 않는다
  - target 위치: `## B. R-11 전수 판정 — 공유 트래커를 뺄 수 있는가` 전문, `## C. 적용` 표
  - 충돌 대상: `spec/conventions/node-cancellation.md` frontmatter (`status: partial`, `pending_plans:` 에 `plan/in-progress/update-returning-tuple-shape.md` 포함) + `plan/in-progress/update-returning-tuple-shape.md` 자신의 `spec_impact:` (5개 경로: `4-execution-engine.md`·`8-embedding-pipeline.md`·`10-graph-rag.md`·`data-flow/2-auth.md`·`conventions/node-cancellation.md`)
  - 상세: target 은 §B 에서 "`update-returning-tuple-shape.md` 는 공유 트래커다(`spec_impact` 에 네 문서)" 라고 스스로 명시한다. `spec_impact` 5개 경로 중 frontmatter 추적 대상(`spec/conventions/spec-impl-evidence.md` §1 inclusive list)은 정확히 4개 — `spec/data-flow/2-auth.md` 는 frontmatter 자체가 없어 제외되고, 남는 넷이 `4-execution-engine.md`·`8-embedding-pipeline.md`·`10-graph-rag.md`·**`spec/conventions/node-cancellation.md`** 다. 그런데 target 의 §C 적용표·체크리스트는 앞의 셋만 고치고 네 번째는 언급조차 하지 않는다.
    실측: `spec/conventions/node-cancellation.md` 는 현재 `status: partial` 이고 `pending_plans:` 에 `node-cancellation-residual-signal-propagation.md` 와 `update-returning-tuple-shape.md` 두 항목을 담고 있다. `update-returning-tuple-shape.md` 의 "후속" 섹션(`:407`~`:468`)을 보면 이 문서에 관계된 모든 planner-위임 항목(raw SQL shape 규약 승격, `node-cancellation.md` §2.4 소급 각주 등재)이 이미 `[x] 완료 (2026-08-30)` 로 체크돼 있고, 남은 미체크 6항목(배포 후 관측·리뷰 중 뮤테이션 금지·`ALLOWED` 설명 중복·`ALLOWED` 5번째 트리거·자매 가드 정규식 복제·harness stale 워크트리)은 target §B 가 이미 "전수 판정 — 미구현 surface 0건" 으로 결론 낸 바로 그 6건과 완전히 동일하다.
    즉 target 자신의 R-11 논증을 그대로 적용하면 `node-cancellation.md` 의 `pending_plans` 에서도 이 트래커를 빼야 하는데, target 은 그 판정을 3개 문서에만 적용하고 커밋에 남기는 "판정 근거" 도 그 3개 문서 한정이 된다. 결과적으로 병합 후에는 **같은 트래커·같은 6개 잔여 항목에 대해 한쪽(3문서)은 "소진됨"으로, 다른 쪽(`node-cancellation.md`)은 "여전히 pending"으로 다르게 기술**되는 상태가 spec 전역에 남는다. `node-cancellation.md` 는 다른 pending plan(`node-cancellation-residual-signal-propagation.md`)이 남아 `partial` 상태 자체는 깨지지 않으므로 즉시 빌드가 깨지진 않지만(`spec-status-lifecycle.test.ts` (b)(c) 는 여전히 통과), target 이 명시적으로 "네 문서" 라 말해 놓고 스코프를 셋으로 좁힌 것은 근거 없는 비대칭이다.
  - 제안: `spec/conventions/node-cancellation.md` 의 `pending_plans:` 에서도 `update-returning-tuple-shape.md` 를 제거하고(§B 의 R-11 판정 근거를 그 문서에도 동일하게 커밋에 남긴다), target 의 §C 표·체크리스트에 4번째 행을 추가하거나, 의도적으로 제외한다면 §D("하지 않는 것")에 그 이유를 명시한다. 후자를 택할 경우 "왜 같은 판정을 3문서에만 적용하는가" 에 대한 답이 있어야 한다 — 현재는 그 답이 없다.

- **[INFO]** `10-graph-rag.md` Overview 배너가 V037 마이그레이션을 언급하지 않는다
  - target 위치: 해당 없음 (target 자체가 손대지 않는 영역, §C 표의 `10-graph-rag.md` 행과 인접)
  - 충돌 대상: `spec/5-system/10-graph-rag.md` `## Overview (제품 정의)` 배너 (`> **구현 상태**: ... 마이그레이션 `V025__graph_rag.sql` ~ `V027__relation_head_tail_index.sql` 적용.`) vs 같은 문서 §KB-GR-EX-08·§KB-GR-DM-02 요구사항 표가 `V037`·`V027` 을 구현 근거로 인용
  - 상세: target 이 A-1 을 고치면서 `V026`·`V027`·`V037` 세 줄을 `code:` 리스트 끝으로 되돌리는데, Overview 배너 텍스트는 이미 오래전부터 "V025~V027" 까지만 언급하고 V037 은 빠져 있다. 셋을 `code:` 로 복귀시키는 김에 배너도 동기화하면 "마이그레이션 목록이 code: 에는 있는데 서술에는 없는" 잔여 편차를 같이 없앨 수 있다.
  - 제안: 필수는 아니나, target 이 이 문서를 어차피 편집하므로 배너 문구에 `V037` 을 추가해 표와 맞추는 것을 권장(선택 사항, target 의 Critical 수정과는 무관).

## 요약

target 의 핵심 3자리 진단(A-1 YAML 삽입 오염, A-2 `implemented`+`pending_plans` 모순, A-3 완료 plan 참조)과 §C 적용 계획은 실측(frontmatter·가드 소스·plan 상태 전수 확인)과 정확히 일치하고 내적으로 견고하다. 다만 target 이 스스로 근거로 세운 R-11 판정("공유 트래커 `update-returning-tuple-shape.md` 의 남은 6개 항목엔 미구현 surface 가 없다")은 그 트래커의 `spec_impact` 가 지목하는 프론트매터-추적 문서 4개 중 3개에만 적용되고, 네 번째인 `spec/conventions/node-cancellation.md` 는 스코프 밖에 남는다 — 같은 판정 논리가 문서마다 다르게 기록되는 비일관성을 새로 만든다. 즉시 빌드를 깨뜨리는 CRITICAL 은 아니지만(해당 문서는 다른 pending plan 으로 `partial` 상태 자체는 유효), target 의 제목·동기("세 문서의 pending_plans frontmatter 정정")와 본문의 "네 문서" 진술 사이의 스코프 불일치를 해소하지 않으면 다음 사람이 같은 트래커를 다시 감사할 때 왜 한 문서만 빠졌는지 재구성해야 하는 부담이 남는다.

## 위험도

MEDIUM
