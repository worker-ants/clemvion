# Plan 정합성 검토 — spec-draft-ai-nodes-drift-disposition.md

## 발견사항

- **[WARNING]** `1-ai-agent.md` frontmatter `pending_plans` 참조가 항목 1 해소 후에도 stale 로 잔존
  - target 위치: 항목 1 — Edit 1a(`_product-overview.md:215`)·Edit 1b(`3-ai/_product-overview.md:84`)·Edit 1c(`1-ai-agent.md` §12.17 신설). frontmatter 는 세 Edit 어디에도 포함되지 않음.
  - 관련 plan: `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` Critical 1 (체크박스 미해결) — 이 plan 을 가리키는 참조가 이미 `spec/4-nodes/3-ai/1-ai-agent.md:22` frontmatter `pending_plans` 에 등재돼 있다 (`pending_plans: [ai-agent-tool-connection-rewrite.md, spec-drift-ai-agent-outport-countmax.md]`).
  - 상세: 항목 1 의 Edit 1a/1b/1c 는 `spec-drift-ai-agent-outport-countmax.md` Critical 1 이 지시한 두 처분안 중 (a)("코드 SoT 확정 후 기술 spec 이 맞으면 두 `_product-overview.md` 의 하위호환 문구 삭제")를 정확히 수행한다 — 즉 이 draft 는 그 plan 의 유일한 남은 Critical 을 실질적으로 종결시킨다(Critical 2 는 2026-07-17 자로 이미 `[x]` 완료). 그러나 target 은 (i) `spec-drift-ai-agent-outport-countmax.md` 의 체크박스/plan 상태를 갱신하지 않고, (ii) 그 plan 을 참조하는 `1-ai-agent.md` frontmatter `pending_plans` 항목도 제거하지 않는다. 결과적으로 draft 적용 후에도 spec frontmatter 는 이미 해소된 plan 을 "pending"으로 계속 가리키고, plan 문서는 이미 해소된 Critical 을 미해결로 계속 노출해 다음 consistency 라운드에서 다시 stale WARNING 을 유발할 소지가 있다(본 drift 는 이미 5회 연속 노출 이력 — 반복 재발 패턴과 동일 구조).
  - 제안: draft 의 Edit 목록에 (a) `spec-drift-ai-agent-outport-countmax.md` Critical 1 체크 + "본 disposition 으로 해소, 근거: Edit 1a/1b/1c" 주석 추가(Critical 2 도 이미 완료이므로 전 항목 종결 시 `plan/complete/` 이동 검토), (b) `1-ai-agent.md:22` frontmatter `pending_plans` 에서 `spec-drift-ai-agent-outport-countmax.md` 항목 제거를 함께 추가할 것.

- **[WARNING]** `ie-endmultiturn-errorpayload-contract.md` 의 "project-planner 후속" 4항목이 본 draft 로 전량 처분되지만 그 plan 자체는 갱신 대상에서 누락
  - target 위치: draft 전체(도입부가 `ie-endmultiturn-errorpayload-contract` 의 impl-prep/impl-done 결과를 근거로 인용하지만, 그 plan 문서로의 역참조 갱신은 Edit 목록·Rationale 어디에도 없음).
  - 관련 plan: `plan/in-progress/ie-endmultiturn-errorpayload-contract.md` "완료 상태"/"project-planner 후속" 절 — "plan 은 아래 project-planner 후속(선재 WARNING) 때문에 `in-progress/` 유지"라고 명시하며, 그 4항목이 정확히 본 draft 의 항목 1~4 와 1:1 대응한다(C1=항목1, C2=항목2, C3=항목3, WARNING=항목4).
  - 상세: 이 plan 문서는 자신이 `in-progress` 로 남아있는 유일한 이유로 "project-planner 후속 4건 미처분"을 명시했다. 본 draft 가 4건을 전부 처분(spec 정정 또는 캐비어/pending_plans 명시)하면 그 "머무를 이유"가 소멸하는데, target 어디에도 이 plan 문서를 갱신(각주 추가 또는 재평가)하는 절차가 없다. 특히 항목 2·3 은 "완전 종결"이 아니라 "미구현을 문서화"하는 처분이므로, `ie-endmultiturn-errorpayload-contract.md` 는 완전히 close 되기보다 "project-planner 후속 완료, 잔여는 각 node-output-redesign plan 이 승계"로 상태 갱신이 필요하다.
  - 제안: draft 적용 후 `ie-endmultiturn-errorpayload-contract.md` "완료 상태" 절에 "project-planner 후속 4건은 `spec-draft-ai-nodes-drift-disposition.md` 로 처분 완료(2026-07-18)" 각주를 추가하고, 남은 재작업 없음을 확인해 plan 을 `plan/complete/` 이동 대상으로 재평가할 것.

- **[WARNING]** 항목 4 앵커 mechanical 갱신 목록에서 `plan/in-progress/node-output-redesign/*` 의 교차링크 2건 누락
  - target 위치: Edit 4d~4m — "0-common:144(위 4c 포함) · 2-text-classifier:132,385 · 3-information-extractor:15,183,266,597,721 · 1-ai-agent:461,979" (4개 spec 파일, 10개 링크만 열거).
  - 관련 plan: `plan/in-progress/node-output-redesign/ai-agent.md:198`, `plan/in-progress/node-output-redesign/information-extractor.md:190` — 둘 다 `spec/4-nodes/3-ai/0-common.md#5-응답-형식-규약-principle-11` 앵커를 포함한 markdown 링크(`[common.md §5](...)`)를 보유. repo 전체 grep 결과 이 앵커를 참조하는 파일은 target 이 열거한 4개 spec 파일 + 이 2개 plan 파일뿐(review 산출물 제외).
  - 상세: Edit 4a 가 헤더에서 "(Principle 11)"을 제거하면 앵커 slug 가 `#5-응답-형식-규약-principle-11` → `#5-응답-형식-규약` 로 바뀐다. Rationale 의 검증 커맨드(`grep -c '응답-형식-규약-principle-11'` == 0)는 스코프를 명시하지 않아 repo 전체로 실행하면 이 2개 plan 파일 때문에 카운트가 0 이 되지 않고(검증 실패로 누락 발견 가능), spec/ 로만 스코프하면 이 2개 링크가 조용히 dangling anchor 로 남는다(둘 다 문서 링크라 클릭 시 앵커 미스매치). 어느 경우든 target 의 "4개 파일 10개 링크"라는 완결 선언과 실제 참조 범위(6개 파일 12개 링크) 사이에 괴리가 있다.
  - 제안: Edit 4d~4m 목록에 두 plan 파일의 앵커 갱신을 추가하거나(mechanical 동반 갱신, 표시 텍스트 무영향이므로 위험 없음), Rationale 의 검증 커맨드 스코프를 `spec/` 로 명시하고 "plan/in-progress 교차링크 2건은 별도 정리(추후 해당 plan 터치 시)"라는 각주를 남길 것.

## 요약

target draft 는 `ie-endmultiturn-errorpayload-contract` 가 위임한 project-planner 후속 4항목을 코드 SoT 근거로 정확히 처분하는 순수 spec 정정 작업으로, 미해결 결정을 일방적으로 번복하거나 선행 plan 의 전제를 무시하는 CRITICAL 성격의 충돌은 없다 — 항목 1 은 `spec-drift-ai-agent-outport-countmax.md` Critical 1 이 제시한 처분안 (a) 를 그대로 따르고, 항목 2·3 은 각 `node-output-redesign/*` plan 이 이미 추적 중인 미구현 갭에 caveat·pending_plans 를 정직하게 추가한다. 다만 이 draft 가 여러 plan 문서의 "열려 있던 이유"를 소멸시키는데도 그 역참조(다른 plan 의 체크박스 갱신, spec frontmatter `pending_plans` 정리, plan 간 교차링크 앵커 동반 갱신)를 빠짐없이 반영하지 않아 3건의 후속 항목 누락(WARNING)이 확인된다 — 전부 "target 실행 → 다른 plan/frontmatter 갱신 필요"라는 동일 패턴이며, 실행 시 Edit 목록에 추가하면 해소 가능한 수준이다.

## 위험도

MEDIUM
