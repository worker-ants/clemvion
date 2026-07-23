# 문서화(Documentation) 리뷰 — presentation `previousOutput` 폐기 서술 정정 (2차 게이트)

## 검토 방법

이 diff 는 1차 `/ai-review`(`review/code/2026/07/23/16_18_02/`)에서 발견된 CRITICAL 2건·WARNING 2건이
전량 반영된 **이후** 상태다. 각 대상 파일을 저장소에서 직접 `Read`/`grep -n` 으로 열어, 1차 리뷰가 지적한
잔여 결함이 실제로 해소됐는지, 그리고 그 fix 과정에서 새 문서화 결함이 생기지 않았는지를 line-level 로
재검증했다. 코드 변경은 0줄(spec 3 파일 + sibling plan 3 파일 + 신규 plan draft + review 산출물)이다.

## 1차 리뷰 잔여사항 재검증 결과

- **README.md:263 자기모순(1차 WARNING) — 해소 확인**. `plan/in-progress/node-output-redesign/README.md:263`
  현재 텍스트를 직접 열어 확인: `"...output.previousOutput 폐기, ... 등 1차 초안의 핵심 정리 항목은 모두
  spec 본문에 반영 완료. **단 output.previousOutput 은 예외 — ButtonInteractionService 재개 경로
  (carousel/chart/table/template)가 지금도 주입하며 node-output.md §4.2 의 과도기 예외로 Phase 3 까지
  보존된다(신규 소비 금지). Form 은 해당 없음.**"` — 1차 지적이었던 한 절 안 인라인 병치("폐기(단 미완…)")
  는 사라지고, "모두 반영 완료" 뒤에 "단, ~은 예외" 로 별도 문장 분리돼 더 이상 문법적으로 자기모순은 아니다.
- **plan draft 상대경로 오류(1차 INFO) — 해소 확인**. `plan/in-progress/presentation-previousoutput-spec-drift.md`
  §동반 정정 C 의 예시가 `../../../spec/conventions/node-output.md#42-폐기할-필드--구조` (3단계)로 정정되고
  `"(경로는 3단계 — plan/in-progress/node-output-redesign/ 기준)"` 단서까지 붙었다.
- **Continuation Bus "5종→6종"(동반 정정 A) — 전수 검증 통과**. `grep -rln "button_click / ai_message /
  ai_end_conversation" spec/` 결과 `0-common.md` 단 1개 파일만 매치 — 다른 spec 문서에 동일 5-type
  enumeration 의 stale 사본이 없다. `execution-engine.md:1162` 는 이미 "메시지 타입 6종"으로 명시돼 있어
  대조 SoT 와 정합. `0-common.md:14` 의 무관 앵커("Presentation 노드 5종")는 미변경 — blind 치환 피해 확인.
- **`processAiResumeTurn` 함수명 정정(동반 정정 B) — 정확성 확인**. `grep -rn processAiResumeTurn
  codebase/backend/src` 로 실제 존재 확인, `execution-engine.md:1636`/`:1523` 의 `AiTurnOrchestrator`
  서술("waitForAiConversation('release') + processAiResumeTurn(재개)")과 일치.
- **Form CRITICAL 2건(1차) — 코드 실측 재확인**. `grep -c previousOutput
  codebase/backend/.../form-interaction.service.ts` → 0, `button-interaction.service.ts` 는
  `previousOutput` 을 실제로 주입(라인 269-294, "legacy transitional field" 주석 포함). `4-form.md:260-264`
  ·sibling `form.md:77-79` 모두 "Form 은 해당 없음 — FormInteractionService 가 주입하지 않으므로 완전한
  금지 필드" 로 정확히 원복돼 있다.
- **frontend consumer 인용(Rationale) — 정확성 확인**. `codebase/frontend/src/components/editor/
  run-results/renderers/presentation-renderers.tsx:543-546` 를 직접 열어 `raw.previousOutput` 을
  data fallback 으로 읽는 코드를 확인 — plan Rationale 의 인용과 라인 번호까지 일치.

## 발견사항

- **[INFO]** `README.md:263` 은 `previousOutput` 을 여전히 "폐기" 열거 목록 **안에** 남겨 둔 채 뒤에서
  별도 문장으로 뒤집는 구조 — sibling `chart.md`/`form.md` 는 목록에서 **완전히 분리**해 별도 각주로
  뺀 것과 구조가 다르다
  - 위치: `plan/in-progress/node-output-redesign/README.md:263`
  - 상세: 1차 WARNING 의 문법적 자기모순(같은 절 안 "폐기(단 미완…)")은 해소됐으나, 여전히
    `"...output.previousOutput 폐기, ... 모두 spec 본문에 반영 완료."` 라는 열거+단정 문장이 먼저 오고,
    그 다음 문장에서 `"단 output.previousOutput 은 예외 — ... 지금도 주입"` 로 방금 열거한 항목 하나를
    번복한다. "단" 으로 명시적 역접을 표시해 논리적으로는 더 이상 모순이 아니지만, 열거 목록을 빠르게
    훑는 독자는 첫 문장만 보고 "previousOutput 폐기 완료"로 오인할 여지가 여전히 남는다. `chart.md:46-49`
    ·`form.md:77-79` 는 애초에 목록에서 `previousOutput` 항목 자체를 제거하고 별도 문단으로 뺐기 때문에
    이 위험이 구조적으로 없다 — 동일 "동반 정정 C" 배치 안에서 세 파일이 서로 다른 해법을 택한 셈이다.
    1차 리뷰의 제안 문구 자체가 "목록에서 분리하거나, **최소한** 문장 결론부를 고쳐" 두 옵션을 열어뒀고
    이번 fix 는 후자(최소 옵션)를 택했으므로 규약 위반은 아니다.
  - 제안: 필수 아님(1차 지적의 핵심 결함은 해소됨). 완전히 통일하려면 `README.md:263` 도 `previousOutput`
    을 열거 목록에서 제거하고 chart.md/form.md 와 동일하게 별도 각주 문단으로 옮기는 것을 고려.

- **[INFO]** (1차 리뷰에서 이미 "불요"로 판정됨, 재확인만) 동일 개념("전환기 보존 필드")에 대한 표현이
  코드 주석("legacy transitional field")·`node-output.md`("transitional legacy 필드")·`3-chart.md`
  ("과도기 legacy")에서 여전히 조금씩 다름 — 이번 배치에서 통일되지 않았다. SoT anchor 로 값 도메인이
  일원화돼 실질 혼선 위험은 낮음(1차 판정 유지).
  - 위치: `codebase/backend/src/modules/execution-engine/button-interaction.service.ts:287`,
    `spec/conventions/node-output.md:194`, `spec/4-nodes/6-presentation/3-chart.md:275`
  - 제안: 조치 불요(1차 리뷰와 동일 결론).

## 각 항목별 점검 요약

1. **독스트링/JSDoc** — 코드 변경 없음. 해당 없음.
2. **README 업데이트** — `node-output-redesign/README.md` 자체가 정정 대상. 1차 WARNING 은 해소, 잔여
   구조적 비일관성은 INFO 로 하향(위 참조).
3. **API 문서** — API/엔드포인트 변경 없음. 해당 없음.
4. **주석 정확성** — 이번 diff 의 본질. `0-common.md`/`3-chart.md`/`4-form.md` 3파일 모두 실측 코드
   (`button-interaction.service.ts`, `form-interaction.service.ts`, `presentation-renderers.tsx`)와
   line-level 로 대조해 정확함을 재확인. Form 배제 문구는 1차 CRITICAL 을 정확히 되돌리고 근거까지
   보강(§적용 범위 단락을 `0-common.md` 공통 캐비어에 신설 — 재발 방지 지점을 공통 문서로 이동한 설계는
   타당).
5. **인라인 주석** — 신설 blockquote 각주(`0-common.md:138-149`)는 여러 줄 `>` 를 blank `>` 로 문단
   분리하는 기존 관례와 markdown 문법상 정확히 정렬됨(렌더링 문제 없음 확인).
6. **변경 이력(CHANGELOG)** — 순수 spec/plan 서술 정정(동작 변경 없음)이므로 엔트리 불필요 — 기존 관례와
   정합.
7. **설정 문서** — 신규 ENV/설정 옵션 없음. 해당 없음.
8. **예제 코드** — `1-carousel.md`/`2-table.md`/`5-template.md` 에 `previousOutput` 언급이 실제로 0건임을
   `grep` 으로 재확인 — plan 의 "비목표" 서술과 실측이 일치.

## 요약

1차 `/ai-review` 가 지적한 CRITICAL 2건(Form 신규 사실 오류)·WARNING 2건(README 자기모순, 0-common 스코프
미명시)은 이번 상태에서 모두 코드·spec 실측과 line-level 로 대조해 정확하게 해소됐음을 확인했다. Form 관련
서술은 원래의 "완전한 금지 필드"로 정확히 원복됐고, `0-common.md` 공통 캐비어에 "적용 범위 — config.buttons
노드 전용, Form 은 해당 없음" 단락을 신설해 재발 방지 지점을 하위 문서가 아닌 공통 문서에 둔 설계도 타당하다.
남은 것은 `README.md:263` 가 `previousOutput` 을 여전히 "폐기" 열거 목록 안에 두고 뒤에서 별도 문장으로
번복하는 구조적 비일관성(sibling chart.md/form.md 는 목록에서 완전히 분리) 뿐이며, 이는 1차 리뷰가 명시적으로
허용한 대안(문장 결론부만 정정) 범위 안이라 결함이라기보다 스타일 잔차다. CHANGELOG·README·API 문서·설정
문서 관점에서 추가로 필요한 항목은 없다.

## 위험도
LOW
