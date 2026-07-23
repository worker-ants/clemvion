# 문서화(Documentation) 리뷰 — presentation `previousOutput` 폐기 서술 정정

## 검토 방법

diff 는 순수 문서 정정(spec 3파일 + sibling plan 3파일 + 신규 plan draft + consistency-check 산출물 8파일)이며 코드 변경은 없다. 각 대상 파일을 저장소에서 직접 열어(`Read`/`grep -n`) 다이제스트가 아니라 실제 커밋된 내용 기준으로 위치·문구·상호 일관성을 확인했다.

## 발견사항

- **[WARNING]** `README.md:263` 의 정정 문구가 문장 내부에서 자기모순
  - 위치: `plan/in-progress/node-output-redesign/README.md:263`
  - 상세: 이번 diff 로 문장이 다음과 같이 바뀌었다 —
    `"... output.view 래퍼 폐기, output.previousOutput 폐기(**단 미완 — resume 경로가 지금도 주입, node-output.md §4.2 과도기 예외. 신규 소비 금지**), Switch meta.value ... 등 1차 초안의 핵심 정리 항목은 모두 spec 본문에 반영 완료."`
    열거 항목 하나에 "단 미완"(아직 완료되지 않았다)이라는 인라인 캐비어를 붙였는데, 같은 문장의 결론부는 그대로 "핵심 정리 항목은 **모두** spec 본문에 **반영 완료**"라고 단정한다. "폐기(단 미완 …)"라는 표현 자체도 "폐기"(이미 끝난 일)와 "미완"(아직 안 끝난 일)이 두 단어 사이에서 바로 충돌한다. 이 문장을 처음 읽는 사람은 previousOutput 이 완료됐는지 아닌지 문장 안에서 바로 판단할 수 없다 — 정확히 이번 plan(`presentation-previousoutput-spec-drift.md`)이 없애려는 "이미 제거된 것처럼 읽히는 문서"라는 문제의 축소판이 같은 정정 안에서 재생산됐다.
    같은 배치의 `chart.md:47`/`form.md:77` 는 `previousOutput` 을 열거 목록에서 완전히 **분리**해 별도 각주 단락으로 뺐고(그래서 자기모순이 없다), `README.md` 만 열거 목록 안에 인라인 괄호로 남겨 상충 문구가 생겼다 — 같은 "동반 정정 C" 작업 안에서 세 파일이 구조적으로 다르게 처리된 결과이기도 하다.
    plan 자체의 체크리스트(`presentation-previousoutput-spec-drift.md:111`)는 이 항목을 이미 `[x]` 완료로 표기하고 있어, 육안 검수 없이는 이 잔여 결함이 그대로 머지될 위험이 있다.
  - 제안: `previousOutput` 도 `chart.md`/`form.md` 와 동일하게 열거 목록에서 분리하거나, 최소한 문장 결론부를 "…등 1차 초안의 핵심 정리 항목은 (`previousOutput` 예외 제외) spec 본문에 반영 완료" 식으로 고쳐 "모두 완료"라는 단정과 "미완" 캐비어가 한 문장 안에서 충돌하지 않게 한다.

- **[INFO]** plan draft 본문의 예시 상대경로 깊이 오류 (실제 적용본에는 반영되지 않음)
  - 위치: `plan/in-progress/presentation-previousoutput-spec-drift.md:92` (`### 동반 정정 C` 절)
  - 상세: `"([node-output §4.2](../../spec/conventions/node-output.md))"` 로 `../../` (2단계) 를 예시로 제시한다. 그러나 이 문구가 삽입될 대상(`plan/in-progress/node-output-redesign/{chart,form,README}.md`)의 디렉터리에서 저장소 루트까지는 3단계(`node-output-redesign/ → in-progress/ → plan/ → root`)이므로 올바른 상대경로는 `../../../spec/conventions/node-output.md` 다. 다행히 **실제 적용된 diff**(`chart.md:48`, `form.md:78`)는 `../../../spec/conventions/node-output.md#42-폐기할-필드--구조` 로 정확한 3단계 경로 + anchor 를 썼다 — 즉 이 plan 문서 자체의 서술 예시만 얕은 경로를 쓰고 있고, 실제 커밋된 spec/plan 파일에는 전파되지 않았다.
  - 제안: plan draft 의 예시 문구도 실제 적용본과 동일하게 `../../../spec/conventions/node-output.md#42-폐기할-필드--구조` 로 맞춰 두면, 이후 이 plan 문서를 근거로 재작업하는 사람이 잘못된 경로를 그대로 복사하는 실수를 예방할 수 있다.

- **[INFO]** 동일 개념에 대한 표현이 3곳에서 조금씩 다름 (검색성 저하, 강제 규약 위반 아님)
  - 위치: `codebase/backend/.../button-interaction.service.ts` 주석 "legacy transitional field" · `spec/conventions/node-output.md:194` "transitional legacy 필드" · `spec/4-nodes/6-presentation/3-chart.md:275` "과도기 legacy"
  - 상세: 세 곳 모두 같은 개념(폐기 예정이나 아직 보존되는 필드)을 가리키지만 어순·용어가 조금씩 다르다. 의미는 동일하고 이번 diff 가 모든 spec 지점에 `node-output.md §4.2` 링크를 명시해 SoT 로 수렴시켰으므로 실질적 혼선 위험은 낮지만, `grep "transitional legacy"` 로는 `3-chart.md` 가, `grep "과도기 legacy"` 로는 코드 주석과 `node-output.md` 가 잡히지 않는다.
  - 제안: 필수는 아님. 이미 SoT 링크로 값 도메인을 일원화했으므로 조치 불요 — 참고용으로만 남김.

## 각 항목별 점검 요약

1. **독스트링/JSDoc** — 코드 변경 없음(순수 spec/plan 문서 정정). 해당 없음.
2. **README 업데이트** — `plan/in-progress/node-output-redesign/README.md` 자체가 이번 정정 대상. 위 WARNING 참조.
3. **API 문서** — API/엔드포인트 변경 없음. 해당 없음.
4. **주석 정확성** — 이번 diff 의 본질이 바로 "오래된 주석/서술을 코드 실태에 맞게 정정"하는 작업이다. `spec/4-nodes/6-presentation/{0-common,3-chart,4-form}.md` 3파일은 `button-interaction.service.ts`/`node-output.md §4.2` 실측과 정확히 대조해 반영됐고(직접 `grep`/`Read` 로 재검증 완료), sibling plan 3파일(`chart.md`/`form.md`/`README.md`) 중 `chart.md`·`form.md` 는 깨끗이 정정됐으나 `README.md` 는 위 WARNING 의 잔여 결함이 있다.
5. **인라인 주석** — spec 문서의 각주(`> ⚠️ ...`) 스타일은 기존 관례(예: Carousel/Table 의 cap 각주)와 일관되게 사용됐고, `node-output.md §4.2` anchor 재사용도 기존 `1-ai-agent.md:757` 패턴과 일치함을 실측 확인.
6. **변경 이력(CHANGELOG)** — 저장소 루트 `CHANGELOG.md` 는 사용자 가시 동작 변경(버그 수정·신규 기능)만 기록하는 관례이고 이번 변경은 순수 spec/plan 서술 정정(동작 변경 없음)이므로 엔트리 불필요 — 기존 관례와 정합.
7. **설정 문서** — 신규 ENV/설정 옵션 없음. 해당 없음.
8. **예제 코드** — `1-carousel.md`/`2-table.md`/`5-template.md` §5.5 JSON 예시에 `previousOutput` 을 신규로 추가하지 않기로 한 결정은 plan `## 비목표`/`## Rationale` 에 근거가 명시돼 있어(신규 소비 금지 신호와 상충 회피) 문서화 관점에서 결함이 아니다.

## 요약

이번 diff 는 코드가 아닌 spec·plan 문서 정정이며, 핵심 목적(과거 "previousOutput 완전 폐기"라는 부정확한 서술을 코드 실태·SoT 와 맞춰 "신규 소비 금지 — 과도기 보존"으로 정정) 자체는 `spec/4-nodes/6-presentation/{0-common,3-chart,4-form}.md` 3파일에서 정확하고 깔끔하게(목록에서 분리 + 별도 각주 + SoT anchor 재사용) 반영됐다. 다만 같은 배치로 함께 정정된 sibling plan `plan/in-progress/node-output-redesign/README.md:263` 는 인라인 괄호 캐비어("단 미완")를 문장 결론("모두 … 반영 완료")과 나란히 남겨 두어 정정 후에도 문장 자체가 자기모순을 갖는다 — plan 체크리스트는 이 항목을 이미 완료(`[x]`)로 표기했으나 실제로는 후속 정정이 한 곳 더 필요하다. 그 외에는 plan draft 본문의 상대경로 예시 오류(실제 반영본엔 전파 안 됨)와 용어 표현 drift 정도의 경미한 INFO 뿐이며, CHANGELOG·README·API 문서·설정 문서 관점에서 추가로 필요한 항목은 없다.

## 위험도
LOW
