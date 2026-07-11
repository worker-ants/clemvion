# 유지보수성(Maintainability) 리뷰

## 리뷰 범위

실제 코드 변경(4개 파일):
- `codebase/channel-web-chat/src/lib/presentation.ts` — `TableData.totalCount?: number` 필드 추가, `toTable()` 이 `output.rowsTotalCount` 를 투영
- `codebase/channel-web-chat/src/lib/presentation.test.ts` — 투영 로직 단위 테스트 3건 추가
- `codebase/channel-web-chat/src/widget/components/presentations.tsx` — `TableView` 가 `totalCount` 를 소비해 잘림 배너 문구를 확장, 톤(`됩니다`→`돼요`) 정규화
- `codebase/channel-web-chat/src/widget/components/presentations.test.tsx` — 배너 렌더 회귀 테스트 갱신/추가

나머지 대상 파일(`plan/in-progress/*.md`, `review/consistency/**`, `spec/7-channel-web-chat/1-widget-app.md`)은 spec/plan 문서 및 자동 산출 리뷰 아티팩트로, 함수 길이·중첩·매직넘버 등 코드 유지보수성 지표의 대상이 아니라 본 리뷰에서는 실질 코드 변경분만 분석한다.

## 발견사항

- **[INFO]** `totalCount` 의 "truncated=true 일 때만 의미 있음" 불변식이 타입으로 강제되지 않음
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts:39-46` (`TableData` 인터페이스), `presentation.ts:229-233`(`toTable()`)
  - 상세: JSDoc 은 "`truncated=true` 일 때만 의미 있다" 고 명시하지만, `totalCount` 는 `truncated` 와 무관하게 `typeof output.rowsTotalCount === "number"` 만으로 독립 계산된다. 백엔드가 이론상 `rowsTruncated:false` 와 `rowsTotalCount` 를 동시에 보내는 조합이 오면 `totalCount` 는 채워지는데 `truncated` 는 false 인 상태가 생긴다. 현재 유일한 소비처인 `TableView`(`presentations.tsx:198`, `{truncated && (...)}` 가드)는 안전하게 사용하지만, 타입 자체는 두 필드의 결합 관계를 표현하지 않으므로 향후 다른 소비 지점이 늘어나면 `truncated` 체크 없이 `totalCount` 만 읽는 실수가 재발할 여지가 있다.
  - 제안: 현재 스코프(단일 소비처)에서는 과잉설계가 될 수 있어 즉시 수정을 요구할 정도는 아니다. 소비처가 늘어나면 `totalCount` 접근을 캡슐화한 selector(`getTruncationBanner(table): string | null`)로 옮겨 이 불변식을 한 곳에서 강제하는 편이 낫다.

- **[INFO]** 동일 사실에 대한 3중 문서화(인터페이스 JSDoc·구현부 인라인 주석·plan 문서)
  - 위치: `presentation.ts:40-45`(인터페이스 JSDoc), `presentation.ts:230-232`(구현부 주석), `plan/in-progress/spec-draft-webchat-truncation-total-count.md`
  - 상세: "잘리기 전 총 행 개수를 `output.rowsTotalCount` 에서 투영, number 아니면 undefined" 라는 동일 설명이 인터페이스 필드 doc 과 구현 직전 주석 두 곳에 거의 같은 문장으로 반복된다. 코드 변경 이력·근거를 추적 가능하게 하는 이 프로젝트의 관례(SDD, verbose Korean rationale 주석)와 일치하므로 결함으로 보긴 어렵지만, 두 주석이 향후 드리프트(한쪽만 갱신)될 여지가 있다.
  - 제안: 낮은 우선순위. 굳이 통합할 필요는 없으나, 필드 doc 에서 구현부 주석으로 "위 필드 설명 참고"식 교차 참조를 남기면 드리프트 위험을 낮출 수 있다.

## 일관성 확인 (문제 없음, 참고용)

- `totalCount` 계산부 `typeof output.rowsTotalCount === "number" ? ... : undefined` 는 파일 내 기존 패턴(`truncated: output.rowsTruncated === true`, `asButtons` 의 `typeof b?.id === "string"` 등)과 동일한 "narrow-and-fallback" 스타일을 그대로 따른다. 새 유틸을 만들지 않고 기존 관용구를 재사용해 일관성이 높다.
- 배너 문구 톤 변경(`표시됩니다` → `표시돼요`)은 `plan/in-progress/spec-draft-webchat-truncation-total-count.md` 에 근거가 명시돼 있고, 코드베이스 전체 grep 결과 다른 위치에 남아있는 `됩니다` 톤의 잔존 문구가 없어 일관성 회귀는 없다.
- 신규 테스트 3건(`presentation.test.ts`)은 기존 `describe`/`it` 네이밍 컨벤션(`toTable — ...`)과 §참조 주석 스타일(`// §2/R8 — ...`)을 그대로 따르며, 각 테스트가 단일 경계 조건(top-level 경로, node envelope 경로, 부재/비-number)만 검증해 응집도가 좋다.
- `presentations.tsx` 의 JSX 삼항 렌더 확장은 중첩 깊이·조건 분기 수를 늘리지 않는 선형적 변경이며, 함수(`TableView`) 길이도 여전히 짧다(20줄 내외).
- 변경 범위가 작고(±10줄 수준의 실질 diff) 단일 책임(테이블 잘림 배너에 총 개수 노출)에 집중돼 있어 순환 복잡도 증가는 무시할 수준이다.

## 요약

이번 변경은 `TableData.totalCount` 필드 하나를 기존 흡수 파이프라인(`truncationMeta`)에 이미 도달해 있던 `rowsTotalCount` 를 소비하도록 연결하고, 위젯 배너 문구를 확장하는 좁고 응집된 diff다. 기존 파일의 네이밍·타입가드·주석 컨벤션을 그대로 재사용해 가독성과 일관성이 높고, 함수 길이·중첩·복잡도 증가가 사실상 없으며 매직 넘버나 유의미한 중복도 없다. 유일하게 짚을 점은 `totalCount` 가 `truncated` 와의 결합 불변식을 타입 수준에서 강제하지 않는다는 것인데, 현재 단일 소비처가 안전하게 가드하고 있어 실질 리스크는 낮다.

## 위험도

LOW
