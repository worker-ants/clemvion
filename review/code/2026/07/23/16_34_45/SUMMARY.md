# Code Review 통합 보고서

## 전체 위험도
**LOW** — 순수 문서(spec/plan) 정정 diff. 1차 리뷰(16_18_02) 지적 CRITICAL 2건은 코드 실측으로 완전 해소 확인. 다만 `RESOLUTION.md` 가 "반영 완료"로 표기한 WARNING 1건이 실제로는 형태만 바뀐 채 미해결로 남아 있어 별도 WARNING 으로 재기재함(강제 화이트리스트 미이행은 아니며, forced reviewer 2명(documentation, requirement) 모두 결과 확보됨 — 결과 누락 없음).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `README.md:263` 자기모순이 `RESOLUTION.md` 상 "반영 완료"로 표기됐으나 실제로는 미해결. `chart.md`/`form.md` 는 `previousOutput` 을 "폐기" 열거 목록에서 **완전히 제거**했지만, `README.md:263` 은 "`output.previousOutput` 폐기 ... 모두 spec 본문에 반영 완료" 문구를 목록에 그대로 둔 채 뒤에 "단, 지금도 주입된다"는 예외 문장만 별도로 덧붙였다 — 인라인 병치(1차 지적)가 별도 문장 형태로 바뀌었을 뿐 동일 유형의 논리적 역전이 남아 있고, plan 체크리스트는 이미 `[x]` 로 표기돼 있어 육안 검수 없이는 미해결 상태로 머지될 위험 | `plan/in-progress/node-output-redesign/README.md:263` | `previousOutput` 관련 문구를 "폐기" 열거 목록에서 실제로 제거하고, `chart.md`/`form.md` 와 동일하게 별도 각주 블록으로 완전히 분리. `RESOLUTION.md` 의 "반영" 표기도 재검증 필요 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | 위 WARNING 과 동일 지점에 대한 완화된 관측: "단" 으로 명시적 역접 표시가 돼 문법적 자기모순 자체는 해소됐으나, 열거 목록을 빠르게 훑는 독자는 첫 문장만 보고 오인할 여지가 구조적으로 남음. 1차 리뷰가 제시한 두 옵션(목록 분리 vs 결론부만 정정) 중 "최소 옵션"을 택한 것이라 규약 위반은 아님 | `plan/in-progress/node-output-redesign/README.md:263` | 위 WARNING 제안과 동일(선택 사항) |
| 2 | documentation | "전환기 보존 필드" 개념의 표현이 코드 주석("legacy transitional field")·`node-output.md`("transitional legacy 필드")·`3-chart.md`("과도기 legacy")에서 여전히 조금씩 다름 — 1차 리뷰에서 이미 "조치 불요"로 판정된 사항, SoT anchor 로 값 도메인이 일원화돼 실질 혼선 위험 낮음 | `button-interaction.service.ts:287`, `node-output.md:194`, `3-chart.md:275` | 조치 불요 |

## 확인된 항목 (해당 없음 / 문제 없음)

- 1차 리뷰 CRITICAL 2건(Form 에 `previousOutput` 이 지금도 주입된다는 오기재)은 이번 커밋(`df8325862`)에서 정확히 원복 — `4-form.md:260-264`, `form.md:77-79` 모두 "완전한 금지 필드" 로 정정, `form-interaction.service.ts` 실측(`previousOutput` grep 0건)과 일치.
- `0-common.md:138-149` 신설 "적용 범위 — config.buttons 노드 전용, Form 은 해당 없음" 캐비어가 `button-interaction.service.ts`(`buildResumedStructuredOutput`, carousel/chart/table/template 전용)와 실측 일치.
- Continuation Bus 메시지 타입 "5종→6종" 정정 — `grep -rln` 결과 stale 사본 없음, `execution-engine.md:1162` 와 대조 정합.
- `processAiResumeTurn` 함수명 정정 — `codebase/backend/src` 실제 존재 확인, `execution-engine.md:1636/1523` 서술과 일치.
- plan draft 상대경로 오류(1차 INFO) — 3단계로 정정 확인.
- frontend consumer 인용(Rationale) — `presentation-renderers.tsx:543-546` 라인 번호까지 일치.
- `1-carousel.md`/`2-table.md`/`5-template.md` 에 `previousOutput` 언급 없음(비목표 전제) — grep 0건으로 실측 확인.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| documentation | LOW | 1차 CRITICAL 2건·WARNING 2건 해소 재검증 완료. README.md:263 잔여 구조적 비일관성은 INFO 로 하향(1차 리뷰가 허용한 대안 범위 내) |
| requirement | LOW | 1차 CRITICAL 2건은 완전 해소 확인. 단 `RESOLUTION.md` 가 "반영"으로 표기한 README.md:263 WARNING 은 실제로는 형태만 바뀐 채 미해결 — WARNING 유지 필요 |

## 발견 없는 에이전트

없음 (실행된 2개 에이전트 모두 발견사항 보고).

## 권장 조치사항
1. `plan/in-progress/node-output-redesign/README.md:263` — `previousOutput` 관련 문구를 "폐기" 열거 목록에서 실제로 제거하고 `chart.md`/`form.md` 와 동일한 "목록 분리 + 별도 각주" 패턴으로 통일한다 (WARNING #1).
2. 위 수정 후 `RESOLUTION.md` 의 "반영 완료" 표기가 실제 상태와 일치하는지 재검증한다.
3. (선택) 코드 주석·`node-output.md`·`3-chart.md` 간 "전환기 보존 필드" 표현 용어를 통일하면 가독성 개선(강제 아님).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `documentation`, `requirement` (2명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: `documentation`, `requirement` — 둘 다 forced 이며 결과 정상 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | scope | 라우터 판단 — 사유 상세 미제공(prompt 에 개별 사유 미포함) |
  | architecture | 라우터 판단 — 사유 상세 미제공(prompt 에 개별 사유 미포함) |
  | maintainability | 라우터 판단 — 사유 상세 미제공(prompt 에 개별 사유 미포함) |
  | side_effect | 라우터 판단 — 사유 상세 미제공(prompt 에 개별 사유 미포함) |