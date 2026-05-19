### 발견사항

- **[WARNING]** 버튼 cap 10 → 5 번복에 대한 새 Rationale 예고만 있고 실제 Rationale 미작성
  - target 위치: `plan/in-progress/button-cap-spec-validator.md` §결정 + §작업 항목 `spec/4-nodes/6-presentation/0-common.md §Rationale 신설`
  - 과거 결정 출처: `spec/4-nodes/6-presentation/0-common.md §1.1` — "노드당 최대 10개" (기존 합의값). 해당 spec 의 Rationale 발췌가 prompt_file 에 포함되어 있지 않아 원문 확인 불가. plan 본문 "§Rationale 신설" 예고 자체는 새 Rationale 작성 의도를 담고 있다.
  - 상세: plan 이 cap 10 → 5 번복의 근거로 "사용자 가시 모델 item 5 + global 5 = 10" 을 기재했으나, 이는 plan 문서 안 "결정" 섹션에만 있고 spec Rationale 에는 아직 작성되지 않은 상태다. CLAUDE.md 규약에 따르면 "아키텍처 결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale` 섹션" 이 SoT다. plan 이 spec Rationale 신설 체크박스를 포함하고 있으므로 의도 자체는 올바르나, 체크박스가 완료 표시([x])로 되어 있어 Rationale 가 이미 기재된 것처럼 보이지만 검증 불가 (prompt_file 에 해당 spec Rationale 발췌가 없음).
  - 제안: 작업 항목 완료 전 `spec/4-nodes/6-presentation/0-common.md § Rationale` 에 (a) 기존 10개 cap 의 원 근거, (b) 5로 하향 조정 이유 ("item 5 + global 5 = 10" 가시 모델, 사용자 결정 날짜 2026-05-19), (c) 검토된 대안(10 유지, 다른 값)을 명시. plan 은 이미 신설 예고를 담고 있으므로 해당 체크박스가 실제로 완료됐는지 재확인.

- **[WARNING]** carousel itemButtons cap 4 폐기에 대한 Rationale 교체 필요
  - target 위치: `plan/in-progress/button-cap-spec-validator.md` §현 cap 인벤토리 + §작업 항목 `backend carousel.schema.ts` 항
  - 과거 결정 출처: `spec/4-nodes/6-presentation/1-carousel.md` (추정) — `validateCarouselItemButtons` cap 4가 설정된 원 결정. prompt_file 에 carousel spec Rationale 발췌가 없어 원문 확인 불가.
  - 상세: cap 4는 이전 어느 시점에 의식적으로 결정된 값으로 추정된다 (코드에 validator가 이미 존재함이 plan에서 확인됨). plan이 이를 5로 상향하면서 "cap < 5면 5로 상향" 결정을 사용자 권위로 부여하지만, cap 4 원결정의 Rationale (예: 렌더링 제약, UX 이유 등)이 왜 무효화되는지에 대한 서술이 plan 어디에도 없다. `spec/4-nodes/6-presentation/1-carousel.md` 의 관련 Rationale가 있다면 해당 항의 명시적 폐기·대체가 필요하다.
  - 제안: `spec/4-nodes/6-presentation/1-carousel.md Rationale` 에 "cap 4 → 5 변경 이유: `MAX_BUTTONS_PER_NODE` 상수 통일 + 사용자 결정 2026-05-19, 원 cap 4 결정은 [원 근거]로 폐기" 를 추가. plan 작업 항목에 carousel spec Rationale 갱신 체크박스를 추가하는 것을 권장.

- **[WARNING]** `_product-overview.md ND-CL-08` "최대 4개" → "최대 5개" 번복 — 원 결정 근거 미언급
  - target 위치: `plan/in-progress/button-cap-spec-validator.md` §consistency-check BLOCK 해소 항목 중 `spec/4-nodes/_product-overview.md ND-CL-08` 수정
  - 과거 결정 출처: `spec/4-nodes/_product-overview.md` ND-CL-08 — "최대 4개" (기존 합의값). prompt_file 에 해당 문서 Rationale 발췌 없음.
  - 상세: ND-CL-08 의 "최대 4개" 값이 어떤 근거로 결정됐는지 알 수 없으나, 이를 5개로 변경하는 것은 product overview 레벨의 요구사항 번복이다. plan 은 이를 "consistency-check BLOCK 해소" 맥락에서 처리하고 있어, cap 통일의 파생 결과로 자동 포함되는 형태다. 그러나 ND-CL-08 이 독립적인 product 요구사항이었다면, cap 정책 통일이 product 요구사항 자체의 번복을 정당화하는지에 대한 서술이 필요하다.
  - 제안: `spec/4-nodes/_product-overview.md` 또는 해당 spec Rationale 에 "ND-CL-08 cap 4 → 5: 2026-05-19 사용자 결정 + `MAX_BUTTONS_PER_NODE` 통일에 따른 갱신" 한 줄 추가. plan 작업 항목에 명시적 체크박스가 없으므로 추가 권장.

- **[INFO]** 제공된 관련 Rationale 발췌가 target 영역(presentation 노드 버튼 cap)과 무관한 영역 중심
  - target 위치: prompt_file `## 관련 Rationale 발췌` 섹션
  - 과거 결정 출처: `spec/1-data-model.md`, `spec/2-navigation/1-workflow-list.md`, `spec/2-navigation/10-auth-flow.md`, `spec/2-navigation/4-integration.md` 의 Rationale
  - 상세: 제공된 Rationale 발췌는 모두 통합(Integration) 도메인과 auth flow 관련이며, `spec/4-nodes/6-presentation/0-common.md`, `spec/4-nodes/6-presentation/1-carousel.md`, `spec/4-nodes/_product-overview.md` 의 Rationale 는 발췌되지 않았다. 이로 인해 "기각된 대안의 재도입" 여부를 본 검토에서 완전히 판정하기 어렵다.
  - 제안: orchestrator가 다음 Rationale 발췌를 추가 제공하면 검토 정확도가 높아진다: `spec/4-nodes/6-presentation/0-common.md § Rationale`, `spec/4-nodes/6-presentation/1-carousel.md § Rationale`, `spec/4-nodes/_product-overview.md` 의 ND-CL-08 관련 근거. 현재 제공된 Rationale 들과 target 간에는 직접 충돌이 없다.

- **[INFO]** 단일 commit 정책과 체크리스트 완료 상태 불일치
  - target 위치: `plan/in-progress/button-cap-spec-validator.md` §작업 항목 — `[x]` 완료 항목들과 `[ ]` 미완료 항목 혼재
  - 과거 결정 출처: CLAUDE.md §PLAN 문서 라이프사이클 — "미체크 체크박스(`[ ]`), 미해결 follow-up 항목이 하나라도 있으면 `in-progress/` 다"
  - 상세: `consistency-check 재실행`, `tests + lint + typecheck`, `/ai-review`, `PR + merge`, `git mv` 등 후반 항목이 `[ ]` 상태로 남아있다. 이는 plan 이 진행 중임을 올바르게 나타낸다. 단일 commit 정책("모든 변경은 단일 commit")이 선언되어 있으나, plan 자체가 여러 단계를 거쳐 완성되므로 commit 정책과 plan 라이프사이클이 충돌할 수 있다. Rationale 연속성 관점에서는 직접 문제가 없으나, plan 완료 후 `git mv` 시점에 chore commit이 추가됨을 명시한 것은 CLAUDE.md 규약과 일치한다.
  - 제안: 현행 plan 구성은 규약에 부합. 특이사항 없음.

### 요약

target plan 문서(button-cap-spec-validator.md)는 버튼 cap 10 → 5 번복과 carousel itemButtons cap 4 → 5 변경을 선언하고 있으며, 각각에 대해 spec Rationale 신설·갱신을 작업 항목으로 포함한다는 점에서 Rationale 연속성 원칙을 지키려는 의도가 명확하다. 그러나 검토 시점에서 실제 spec Rationale 가 어떻게 기재됐는지 확인할 Rationale 발췌가 제공되지 않아, 번복 정당성의 완전한 검증이 불가능하다. 제공된 관련 Rationale 발췌는 모두 통합(Integration) 도메인에 집중되어 있어 presentation 노드 영역과의 직접 충돌은 발견되지 않았다. carousel cap 4의 원 결정 근거 미언급과 `_product-overview.md ND-CL-08` 번복 근거 미서술이 Rationale 공백으로 남아 있어 WARNING 등급으로 분류한다. 전반적으로 plan이 Rationale 갱신을 작업 항목에 포함하고 있으므로 이행 완료 시 연속성이 회복될 수 있는 구조다.

### 위험도

MEDIUM
