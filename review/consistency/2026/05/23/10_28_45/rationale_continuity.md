# Rationale 연속성 검토 결과

검토 대상: `spec/4-nodes/` 전체 (구현 착수 전 --impl-prep 모드)
검토 범위: 현재 작업 계획 `plan/in-progress/render-presentation-button-click-fix.md` 및 그 배경이 되는 spec `spec/4-nodes/6-presentation/0-common.md`, `spec/4-nodes/3-ai/1-ai-agent.md`

---

## 발견사항

### 발견사항 1

- **[WARNING]** `ButtonDef.id` "자동 생성" 원칙의 LLM tool 모드 확장에 대한 Rationale 미기재
  - target 위치: `plan/in-progress/render-presentation-button-click-fix.md` §C (Backend root-cause 정규화) — `normalizeButtonIds` helper 추가, "zod validate → defaults overlay → 1MB cap **이후** 단계에서 누락 `button.id` 를 `crypto.randomUUID()` 로 채움"
  - 과거 결정 출처: `spec/4-nodes/6-presentation/0-common.md §1` `ButtonDef` 표 — `id` 필드: "String (UUID v4) | 자동 생성 | 불변 버튼 식별자". §10.1 "zod schema 로 validate → defaults overlay 적용 → 1MB cap 적용" 의 세 단계 처리 순서.
  - 상세: spec §1은 "자동 생성"을 워크플로 에디터 UI 에서 버튼 추가 시점으로 암묵적으로 가정한다. `buttonDefSchema.id` 가 optional 이어서 LLM 이 id 를 빠뜨려도 zod validate 를 통과하므로, spec §10.5 의 "schema 위반 처리" 흐름이 발동되지 않는다. plan 은 validate/overlay/cap 이후 4번째 단계로 `normalizeButtonIds` 를 삽입하는 방식을 제안하는데, 이 단계 순서가 spec §10.5 의 처리 파이프라인을 확장하는 것인지, 아니면 별도 경로를 추가하는 것인지 Rationale 에 명시되어 있지 않다.
  - 제안: `spec/4-nodes/6-presentation/0-common.md §10.5` 의 처리 파이프라인 설명에 "단계 3.5: `button.id` 미설정 시 UUID v4 자동 보완 (`normalizeButtonIds`)" 을 추가하고, 이것이 "선행 validate 통과 후 적용" 임을 명시한다. 또는 plan Closeout 에 이 확장의 근거 (LLM 이 optional id 를 빠뜨리는 것은 spec 의 "자동 생성" 원칙의 LLM 모드 적용) 를 기록하고 추후 spec 을 갱신하도록 추적한다.

---

### 발견사항 2

- **[INFO]** `render_*` 버튼 클릭이 "다음 LLM turn 의 user 메시지로 흡수" 되는 합의된 원칙이 frontend fix 설계와 충분히 정합됨을 plan 에서 명시적으로 연결하지 않음
  - target 위치: `plan/in-progress/render-presentation-button-click-fix.md` §A (Frontend defense-in-depth 가드) — `isSelected` 가드 수정 + §스펙 정합에서 "버튼 클릭은 graph routing 흉내 X — 다음 LLM turn 의 user 메시지로 흡수"라고 올바르게 인용
  - 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md §12.4` 기각 결정 (D) — "Render 결과의 워크플로 분기 흉내 (버튼 클릭 → 다른 출력 포트)" 를 명시 기각. 동 spec §4.1 (259번 줄) — "사용자가 `presentationTools[].defaults` 에 `buttons` 를 넣더라도 그 클릭은 다음 LLM turn 의 user 메시지로 흡수"
  - 상세: plan 이 spec 을 올바르게 인용하고 있으며 Rationale 위반은 없다. 다만 fix 의도가 "클릭이 user 메시지로 흡수되어야 하는데 isSelected 버그로 인해 onClick 자체가 단락됨" 을 fix 하는 것임을 plan §스펙 정합에서 더 명시적으로 연결하면 리뷰어가 합의된 원칙과의 정합을 즉시 확인할 수 있다.
  - 제안: plan §스펙 정합에 "따라서 onClick 이 실제로 호출되어 `onPortButtonClick?.(btn.id)` 를 통해 user 메시지로 흡수되는 경로가 열려야 한다" 를 한 줄 추가. spec 변경 불필요.

---

### 발견사항 3

- **[INFO]** `normalizeButtonIds` 적용 시점이 "cap 이후"임을 spec §10.4 의 cap 정책 및 §10.5 파이프라인과 명시적으로 연결하지 않음
  - target 위치: `plan/in-progress/render-presentation-button-click-fix.md` §C — "zod validate → defaults overlay → 1MB cap **이후** 단계에서 누락 `button.id` 를 ... 로 채움"
  - 과거 결정 출처: `spec/4-nodes/6-presentation/0-common.md §10.4` — "1MB cap 을 초과하는 페이로드 emit 시 §10.5 의 schema 위반 흐름 따름" + "Carousel/Table 의 tail truncate 정책은 LLM tool 모드에서도 그대로 적용". §10.5 파이프라인: validate → defaults overlay → 1MB cap.
  - 상세: plan TDD 체크리스트에 "정규화는 cap 이후에 일어나 truncate 된 아이템 안의 버튼은 처리 안 함 (불필요한 work 제거)" 라고 명시하고 있어 의도는 올바르다. 그러나 cap 이후 truncate 된 item 의 button id 가 normalize 되지 않는 것이 의도된 정책인지, 아니면 허용 가능한 생략인지 spec 에는 명시되지 않았다. truncate 된 item 은 frontend 에 도달하지 않으므로 실질 영향은 없지만, 정책 일관성을 위해 spec §10 파이프라인에 명기할 필요가 있다.
  - 제안: spec 변경 없이 plan TDD 체크리스트의 해당 항목에 "truncate 된 item 의 button id 는 frontend 에 노출되지 않으므로 normalize 생략은 의도된 최적화" 한 줄 주석 추가로 충분.

---

## 요약

`plan/in-progress/render-presentation-button-click-fix.md` 가 제안하는 설계 (frontend `isSelected` 가드 + backend `normalizeButtonIds`) 는 `spec/4-nodes/6-presentation/0-common.md` 및 `spec/4-nodes/3-ai/1-ai-agent.md §12.4` 에서 합의된 결정들을 직접 위반하거나 명시적으로 기각된 대안을 재도입하는 항목이 없다. `render_*` 버튼 클릭을 그래프 포트 분기가 아닌 user 메시지로 흡수하는 원칙 (§12.4 D 기각 결정) 을 plan 이 올바르게 준수하며, `ButtonDef.id` 불변 원칙을 LLM tool 모드까지 backend 정규화로 확장하는 방식도 합의된 UUID v4 자동 생성 원칙의 자연스러운 연장이다. 다만 backend 정규화 단계를 spec §10.5 파이프라인에 반영하지 않아 두 문서 사이에 암묵적 gap 이 생기는 부분에 WARNING 1건이 발생한다. 구현 착수를 차단할 CRITICAL 발견사항은 없다.

---

## 위험도

LOW
