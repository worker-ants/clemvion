# Plan 정합성 검토 — `spec-draft-api-convention-verifier-registration.md`

## 발견사항

- **[WARNING]** `## Overview` 유무 불일치 처분이 parent plan 의 "단독 결정 금지" 프레이밍과 다른 제3의 해법을 택했는데, parent 체크박스 갱신 경로가 target 안에 없다
  - target 위치: `## ④ 부수 — '## Overview' 유무 불일치(항목 ⑧)의 전제가 틀렸다`, `### '## Overview' 를 6개에 일괄 추가하지 않는 이유`
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` §후속 — `- [ ] **spec/5-system/ 의 ## Overview 유무 불일치** (planner, --impl-prep 12_48_13 W1 등재 2026-09-05)`
  - 상세: parent 항목은 "12개 중 6개(`2-api-convention`·`5-expression-language`·`6-websocket-protocol`·`7-llm-client`·`11-mcp-client`·`16-system-status-api`)에 로컬 Overview 없음" 을 전제로 **(a) 6개 전부에 추가 / (b) SKILL.md 에 현 상태를 규약으로 인정** 둘 중 하나를 "**한 PR 이 단독으로 정할 일이 아니라 등재한다**" 고 명시했다. target 은 실측으로 그 전제를 반증한다(6개 중 4개는 실제로는 도입 산문을 갖고 있고 표제 형태만 다르며, 진짜 결여는 `2-api-convention.md`·`6-websocket-protocol.md` 2건뿐). 그리고 (a)/(b) 어느 쪽도 명시적으로 채택하지 않은 채 **제3의 처분**(`2-api-convention.md` 에만 추가, `6-websocket-protocol.md` 는 "잔여로 트래커에 남긴다")을 내린다. 이 처분 자체는 근거(SKILL.md "권장" 문구 + 저장소 전역 실태 표)가 탄탄하지만, target 문서 어디에도 **parent plan 의 해당 체크박스를 어떻게 갱신할지**(텍스트를 새 실측치로 교체할지, `[x]` 로 닫고 링크만 남길지, `6-websocket-protocol.md` 잔여를 별도 항목으로 재등재할지)가 적혀 있지 않다. 이 draft 가 merge 돼도 parent plan 은 반증된 전제("6개 대칭적으로 없음")를 그대로 문면에 남긴 채 열려 있을 위험이 있다 — 이 저장소가 반복 지적해 온 "plan 서술은 철회로 거짓이 될 수 있다" 패턴과 같은 축이다.
  - 제안: target 적용 시 `spec-draft-nullable-notation-followups.md` 의 해당 체크박스를 `[x]` 로 닫으면서, (1) 원 전제가 반증됐다는 것(4/6 은 형태차이일 뿐), (2) 실제 처분은 (a)도 (b)도 아닌 부분 적용(`2-api-convention.md` 만) + `6-websocket-protocol.md` 잔여 추적이라는 것을 명시하는 갱신 문구를 함께 넣을 것. `6-websocket-protocol.md` 건은 별도 열린 항목으로 명시적으로 재등재해 "잔여로 트래커에 남긴다"는 서술이 실제로 추적 가능한 위치를 갖게 할 것.

- **[WARNING]** `code:` 에 검증자(테스트/헬퍼) 파일을 등재하는 근거("40건 선례")가, 같은 정의 문장을 인용하며 반대 결론을 낸 최근 판정을 다루지 않는다
  - target 위치: `## ① 왜 등재해야 하나` `### code: 정의에 맞나 — 맞는다, 선례가 40건이다`
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — `- [x] **conversation-thread.md frontmatter code: 에 websocket.service.ts 누락**` 항목의 **won't-do 판정 (2026-08-24)**
  - 상세: target 은 `spec-impl-evidence.md §2.1` 의 `code:` 정의(*"본 spec 이 약속한 surface 의 구현 경로"*)를 인용하며 "검증자·가드를 `code:` 에 등재하는 것은 이미 저장소의 관행 — 40건" 이라 주장하고, `swagger.md` 의 기존 `swagger-dto-contract*.ts` 등재를 유일한 근거 선례로 든다. 그런데 같은 정의 문장(*"인용 추적성이 아니다"*)을 인용해 **정반대 결론**을 낸 판정이 12일 전(2026-08-24) 다른 in-progress plan 에 이미 존재한다 — `websocket.service.ts` 를 `conversation-thread.md` 의 `code:` 에 추가하자는 제안을 "그 문서 기존 `code:` 16항목이 전부 도메인 파일이라 넣으면 `spec-code-paths.test.ts` 가드 신호가 흐려진다" 는 이유로 won't-do 처리했다. `2-api-convention.md` 의 현재 `code:` 목록도 정확히 같은 상태다(http-exception.filter.ts·validation.pipe.ts·dto·transform.interceptor.ts·guards·hooks — **전부 도메인 구현 파일**, 실측 확인) — 즉 "16개 전부 도메인 파일" 우려가 문면 그대로 적용되는 대상이다. target 이 드는 유일한 선례(`swagger.md`)는 애초부터 `swagger-dto-contract*.ts` 를 이미 갖고 있어 "첫 혼입" 이 아니지만, `2-api-convention.md` 는 이번이 첫 non-도메인(`shared/testing/*`) 등재라 두 판정 사이의 긴장이 더 크다. target 의 실제 논거(검증자가 §5.4 를 **시행**하는 코드라 "구현 경로" 에 해당한다는 것)는 `websocket.service.ts` 케이스(그 파일은 대상 surface 를 구현하지 않고 순수 인용용)와 구별 가능하지만, target 문서는 이 구별을 명시하지 않은 채 "40건 선례" 만으로 정당화한다.
  - 제안: target 의 Rationale 에 `spec-sync-external-interaction-api-gaps.md` 의 2026-08-24 won't-do 판정을 인용하고, "시행 코드 등재"(이번 건)와 "인용 추적용 도메인 파일 등재"(반려된 건)를 구분하는 문장을 추가할 것 — `spec-code-paths.test.ts` 가드 신호 희석 우려에 대해 `2-api-convention.md` 의 `code:` 가 이번에 처음으로 순수 도메인 파일 집합을 벗어난다는 사실도 함께 밝힐 것.

## 요약

Target 은 `spec-draft-nullable-notation-followups.md` 의 미체크 planner 항목(§5.4 검증자 역할 경계, `code:` 등재)을 정확히 그 항목이 요구한 형태로 집행하고 있어 그 축은 정합적이다. 다만 두 지점에서 plan 레이어의 정합성 위험이 남는다 — (1) 부수로 처리한 `## Overview` 유무 불일치 항목은 parent plan 이 명시적으로 "단독 결정 금지" 로 못박은 사안인데, target 은 새 실측으로 전제를 반증하며 제3의 처분(부분 적용 + 잔여 추적)을 내리면서도 parent 체크박스를 어떻게 갱신할지 문서화하지 않았다. (2) `code:` 확장의 핵심 근거("40건 선례")가 같은 정의 조항을 인용해 반대 결론을 낸 최근(2026-08-24) 판정을 다루지 않아, 두 in-progress plan 이 같은 조항으로 서로 다른 결론에 도달한 상태가 설명 없이 공존한다. 둘 다 target 의 실질 결론을 뒤집을 만한 반증은 아니지만(오히려 근거를 보강하면 해소된다), plan 갱신·설명 보강 없이 merge 되면 후속 독자가 모순으로 오인할 소지가 있다.

## 위험도
MEDIUM
