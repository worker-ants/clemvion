## 발견사항

- **[WARNING]** `spec/4-nodes/0-overview.md §1.3` "(UUID v4 는 사용하지 않는다.)" — 기각 근거 기록 없이 번복
  - target 위치: `plan/in-progress/spec-draft-port-id-uuid-slug.md` 변경안 #1 (`4-nodes/0-overview.md §1.3` line 123 삭제 및 모델 교정)
  - 과거 결정 출처: `spec/4-nodes/0-overview.md §1.3`(line 121) — "(UUID v4 는 사용하지 않는다.)" 는 현재 본문에 명시된 서술로, Rationale 섹션(해당 파일에 ## Rationale 미존재)에서 기각 근거가 정식으로 등재된 적이 없다. 즉 이 서술은 Rationale-backed 결정이 아니라 본문 사실 기술이었다.
  - 상세: 번복 대상 서술("UUID v4 는 사용하지 않는다.")이 Rationale 에 등재된 결정이 아니라 본문 사실 기술이므로 엄밀한 "Rationale 기각 대안 재도입"에는 해당하지 않는다. 그러나 `spec/4-nodes/0-overview.md` 에 ## Rationale 가 부재해 이 서술이 어떤 의도로 작성됐는지 추적 불가능하다. target 은 변경안 #6 으로 ## Rationale 신설을 함께 제안해 서술 번복의 근거를 남긴다 — 이 점은 올바른 방향이다. 단, 번복의 근거 기록(## Rationale)이 동일 PR에 포함돼야 하며, plan 문서에만 존재하고 spec 파일에 미등재되면 번복 근거가 열람 불가능한 상태로 남는다.
  - 제안: 변경안 #1 의 본문 교정과 변경안 #6 의 ## Rationale 신설을 **동일 커밋**에 포함시켜, 번복 근거가 spec 파일 자체에 잔존하도록 보장할 것. plan 문서 Rationale 절의 "옛 서술 정정" 항목이 그대로 `4-nodes/0-overview.md ## Rationale` 에 등재되면 충분.

- **[INFO]** `spec/3-workflow-editor/1-node-common.md §1.5` 및 `spec/4-nodes/1-logic/0-common.md §7` 서술 교정 — 새 Rationale 연계 필요
  - target 위치: 변경안 #2 (`1-logic/0-common.md §7`) 및 변경안 #3 (`3-workflow-editor/1-node-common.md §1.5`)
  - 과거 결정 출처: 두 파일 모두 현재 "UUID v4 를 할당" 을 본문 사실로 기술하고 있으나 해당 파일에 ## Rationale 이 없어 의도의 출처가 없다. `3-workflow-editor/1-node-common.md` 의 기존 ## Rationale 은 R-1(Use Default Output) / R-2(2-트랙 전략) / R-3(auto-form 이행) 만 다루며 포트 ID 결정과 무관하다.
  - 상세: target 은 두 파일 모두 "SoT 노드 §1.3 / `port-id.util.ts`" 를 참조하도록 교정 제안하는데, 교정 후 두 파일의 §1.5 / §7 이 "slug-regex 유효 stable id" 로 바뀌어도 기존 ## Rationale 에 포트 ID 모델 변경 근거가 없어 이후 독자가 이유를 추적할 수 없다. `4-nodes/0-overview.md ## Rationale` 신설 후 두 파일은 거기를 단순 참조하는 구조라면 별도 Rationale 항 추가 없이 충분하다 — target 의 교정안이 "SoT 노드 §1.3" 참조를 명시하고 있어 이 구조가 이미 의도된 것으로 보인다. 문제는 없으나, 두 파일에 참조 문구가 명시되는지 검토 권장.
  - 제안: 변경안 #2·#3 에 "SoT 노드 §1.3 / `port-id.util.ts`" 참조가 명시되는지 확인. 참조 문구가 포함되면 별도 Rationale 항은 불필요.

- **[INFO]** `spec/4-nodes/3-ai/1-ai-agent.md §2 ConditionDef.id` — UUID v4 유지 근거 확인
  - target 위치: 변경안 #5 ("UUID v4 할당" 유지 + slug-regex 통과 사실 명료화만)
  - 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md §2`(line 79) "생성 시 UUID v4 할당, 이후 불변" — 본문 사실 기술로 ## Rationale 미등재.
  - 상세: ConditionDef.id 는 UUID v4 를 유지하며 변경하지 않는다는 target 의 판단은 코드 사실과 정합한다. 서술 번복 없이 명료화만 추가하는 것이므로 Rationale 충돌은 없다. 다만 `spec/4-nodes/3-ai/_product-overview.md ND-AG-17`(line 77) 의 "정제된 UUID" — LLM 도구명(`cond_` 접두사) — 가 포트 ID 와 무관한 도구 이름 생성 규칙임을 target 이 명시 제외(## 제외 절)하고 있어 올바르게 처리된다.
  - 제안: 명료화 추가로 충분. 추가 조치 불필요.

- **[INFO]** slug-regex 혼합 생성 모델 — 엣지 보존·통일 검증·직렬화 안정성 합의 원칙 신설
  - target 위치: plan 문서 ## Rationale 절 (변경안 #6 `4-nodes/0-overview.md ## Rationale` 등재)
  - 과거 결정 출처: 해당 없음 (신규 Rationale 신설이므로 기존 충돌 없음)
  - 상세: target 이 제안하는 세 원칙 — (1) 엣지 보존, (2) 통일 검증, (3) 직렬화 안정성 — 은 기존 spec 의 어느 Rationale 에서도 명시적으로 기각된 바 없다. 신규 합의 원칙 등재로, Rationale 연속성 관점의 충돌은 없다.
  - 제안: 신설 Rationale 에 "spec/4-nodes/0-overview.md §1.3 에서 정정 전 서술이 이 spec 과 자기모순이었다는 사실"(presentation button 을 slug 예시로 들면서 UUID 라 서술한 점)을 명시하면 향후 독자에게 정정 계기를 더 명확히 전달할 수 있다.

## 요약

target 문서(`plan/in-progress/spec-draft-port-id-uuid-slug.md`)는 기존 spec Rationale 에서 명시적으로 기각된 결정을 재도입하지 않는다. 변경 대상 서술("UUID v4 는 사용하지 않는다." 등)은 Rationale-backed 결정이 아니라 본문 사실 기술이었으며, target 은 코드 검증 결과를 근거로 이를 교정하면서 변경안 #6 으로 ## Rationale 신설을 함께 제안한다. 주요 관찰은 WARNING 1건: 서술 번복 근거(## Rationale)가 plan 문서에만 있고 spec 파일에 동시 등재되지 않으면 추적 불가능한 상태로 남으므로, 변경안 #1 과 변경안 #6 을 동일 커밋에 포함해야 한다. 나머지는 INFO 등급 — 참조 경로 명시 확인·신설 Rationale 표현 보완 수준이며 차단 사유는 없다.

## 위험도

LOW
