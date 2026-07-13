# 유지보수성(Maintainability) Review

대상: review/code/2026/07/13/15_01_46/{security,side_effect,testing}.md(신규 산출물 3건) +
spec/3-workflow-editor/2-edge.md(§3.2 상태 동기화 diff)

이번 라운드 diff에는 실행 코드(.ts/.tsx/.css) 변경이 포함되어 있지 않다 — §3.2 구현
소스(`use-edge-execution-state.ts`, `edge-utils.ts`, `custom-edge.tsx`, `globals.css`,
테스트 2편)는 이전 라운드(14_20_12/14_42_20)에서 이미 리뷰·수정·커밋된 상태이며, 이번
diff는 (a) 3회차 ai-review 산출물 markdown 신규 커밋과 (b) 그 결과를 반영한 spec 문서
동기화(`Planned`→`구현됨`)로만 구성된다. 함수 길이/중첩 깊이/매직 넘버/순환 복잡도 등
코드 품질 지표는 이번 diff 자체에는 적용 대상이 없어, 문서(prose) 가독성·네이밍·일관성
관점으로 범위를 좁혀 분석했다.

## 발견사항

- **[INFO]** 리뷰 산출물 3건은 코드가 아닌 자동 생성 문서 — 코드 스타일 지표 비적용, 기존 라운드 템플릿과 일치
  - 위치: `review/code/2026/07/13/15_01_46/security.md`, `side_effect.md`, `testing.md`
  - 상세: `security.md`/`side_effect.md`는 `# X(Y) Review` H1 제목 + `## 발견사항/요약/위험도` H2 섹션 구조를 쓰고, `testing.md`는 H1 제목 없이 `### 발견사항/요약/위험도` H3 구조를 쓴다 — 언뜻 같은 라운드 내 형식 불일치로 보이나, 이전 두 라운드(`14_20_12/testing.md`, `14_42_20/testing.md`)도 동일하게 H1 없이 H3만 사용해왔음을 확인했다. 즉 이는 이번 diff가 새로 만든 불일치가 아니라 testing/dependency 리뷰어 템플릿의 기존 관례이며, 회귀가 아니다.
  - 제안: 조치 불요(확인용 기재). 다만 향후 리뷰 산출물 포맷을 표준화할 계획이 있다면 sub-agent 템플릿(H1 제목 유무) 통일을 별도 항목으로 고려할 것.

- **[INFO]** spec 문서 추가 산문은 기존 `2-edge.md` 컨벤션(§1.2/§1.3/§2.2/§2.3 "구현:" 콜아웃)과 서식·구조가 일관됨
  - 위치: `spec/3-workflow-editor/2-edge.md` §3.2 (`> **현재 구현**:` 블록, 라인 470-475)
  - 상세: 표(우선순위: 데이터 흐름 → 실행 완료 → 비활성 순)와 콜아웃 불릿 순서가 1:1로 대응하고, 상호배타 우선순위(`inactive > flowing/completed`)를 산문 도입부에 먼저 명시한 뒤 각 상태를 근거 파일·조건·렌더 결과 순으로 서술한다 — 파일 내 다른 절(§1.2 자동 연결, §1.3 재연결, §2.3 순환)이 이미 쓰는 "판정 조건 → 구현 위치 → 부수 조건" 서술 패턴과 동일해 신규 독자가 절 간 서술 방식 차이로 혼란을 겪을 위험이 낮다.
  - 제안: 조치 불요.

- **[INFO]** §3.2 표의 "구현" 열 귀속(attribution)이 세 행 사이에서 미묘하게 비대칭
  - 위치: `spec/3-workflow-editor/2-edge.md` §3.2 표 (라인 466-468)
  - 상세: "데이터 흐름"·"실행 완료" 행은 `구현됨 (use-edge-execution-state.ts + globals.css)`로 상태 판정 훅과 렌더링 CSS를 모두 명시하는 반면, "비활성 노드 연결" 행은 `구현됨 (custom-edge.tsx)`만 표기한다. 그러나 바로 아래 산문이 설명하듯 `edge.data.edgeInactive` 값 자체는 세 상태와 동일하게 `use-edge-execution-state.ts`(`resolveEdgeExecutionState`)가 계산하고, `custom-edge.tsx`는 그 결과를 opacity로 렌더링만 한다 — 세 행이 사실상 같은 계산 위치(동일 훅)를 공유하는데 표기만 다르다. 코드 동작에는 영향 없는 순수 문서 서술 비일관성이지만, 향후 "비활성 상태가 왜 안 바뀌지?"를 디버깅하는 개발자가 표만 보고 `custom-edge.tsx`만 확인하다 실제 원인(훅의 `disabledKey`/우선순위 로직)을 놓칠 수 있다.
  - 제안: "비활성 노드 연결" 행도 다른 두 행과 동일하게 `구현됨 (use-edge-execution-state.ts + custom-edge.tsx)`로 정렬해 계산 위치를 함께 표기.

## 요약

이번 diff는 실질적으로 실행 코드 변경이 없는 문서/산출물 커밋 라운드다 — 3건의 ai-review markdown 산출물(security/side_effect/testing)은 자동 생성 리포트로, 코드 유지보수성 지표(함수 길이·중첩·매직넘버·중복·순환복잡도)가 적용될 대상이 아니며, 겉보기 형식 차이(H1 유무)도 이전 라운드부터 이어진 리뷰어별 기존 템플릿이라 신규 불일치가 아니다. `spec/3-workflow-editor/2-edge.md` 갱신은 파일 기존 컨벤션("구현:" 콜아웃, 표-산문 순서 일치)을 잘 따르는 가독성 높은 문서 변경이며, 유일한 지적사항은 §3.2 표의 "구현" 열 귀속이 세 상태 행 사이에서 비대칭(비활성 행만 훅 파일명을 생략)하다는 사소한 서술 비일관성으로, 코드 동작에는 영향이 없는 선택적 정정 사항이다. 유지보수성 관점에서 차단·경고 사유는 없다.

## 위험도

NONE

STATUS=success ISSUES=3
