# 유지보수성(Maintainability) 리뷰 결과

## 리뷰 대상
- `codebase/frontend/src/components/editor/canvas/canvas-minimap.tsx`
- `codebase/frontend/src/components/editor/canvas/__tests__/canvas-minimap.test.tsx`
- `codebase/frontend/src/content/docs/03-workflow-editor/canvas-basics.en.mdx`
- `codebase/frontend/src/content/docs/03-workflow-editor/canvas-basics.mdx`

### 발견사항

- **[INFO]** `MiniMap` bottom offset(`!bottom-12` = 48px)이 `Button`의 `h-8`(32px) + 코너 오프셋(8px) + 간격(8px)의 합으로 산출되지만, 이 관계가 코드로 강제되지 않고 주석으로만 문서화됨
  - 위치: `codebase/frontend/src/components/editor/canvas/canvas-minimap.tsx:311-318` (MiniMap `className="!bottom-12 ..."` 주석), `canvas-minimap.tsx:389` (`Button className="h-8 w-8"`)
  - 상세: 이후 누군가 버튼 크기(`h-8` → `h-10` 등)나 코너 오프셋만 변경하고 `!bottom-12` 값을 함께 갱신하지 않으면 다시 겹침 회귀가 발생할 수 있다. 두 클래스 리터럴이 물리적으로 떨어진 두 JSX 엘리먼트에 중복 인코딩되어 있어 값들 간의 의존관계가 코드만 보고는 드러나지 않는다.
  - 참고(완화 요인): `canvas-minimap.test.tsx`의 신규 테스트("floats the minimap above the toggle button so they never overlap")가 렌더링된 className에서 실제 픽셀 값을 파싱해 `minimapBottomPx >= toggleBottomPx + toggleHeightPx`를 단언하므로, 위 값들이 어긋나면 테스트가 즉시 실패해 회귀를 막아준다. 다만 이는 사후 안전망일 뿐 근본적으로 값 자체를 한 곳에서 관리하지는 않는다.
  - 제안: 값이 셋 이상 더 늘어나거나 재사용되는 시점이 오면 (예: 다른 오버레이도 같은 코너를 공유) 공통 상수(`TOGGLE_SIZE_PX`, `CORNER_GAP_PX` 등)로 추출하는 것을 고려. 현재 2개 요소·1개 관계 수준에서는 과설계 소지가 있어 필수는 아님.

- **[INFO]** MiniMap과 Panel(토글 버튼)의 JSX 렌더링 순서가 이번 diff에서 바뀌었는데(버튼이 먼저 → 미니맵이 먼저), 이 순서가 스태킹/오버레이 관계에 왜 중요한지 컴포넌트 주석에 명시되어 있지 않음
  - 위치: `codebase/frontend/src/components/editor/canvas/canvas-minimap.tsx:369-397`
  - 상세: React Flow의 `Panel`은 절대 위치 오버레이이므로 나중에 렌더링되는 엘리먼트가 자연스러운 문서 순서상 위에 쌓인다. 버튼을 미니맵보다 뒤에 두어 시각적으로 위에 오도록 한 것으로 보이나, 파일 상단 JSDoc(`canvas-minimap.tsx:12-19`)은 오프셋 수치 근거만 설명하고 렌더링 순서의 의도는 설명하지 않는다.
  - 제안: 순서를 뒤바꾸면 안 되는 이유(버튼이 항상 클릭 가능하도록 위에 쌓여야 함)를 한 줄 주석으로 남기면, 추후 리팩터링 시 실수로 순서를 되돌리는 것을 방지할 수 있다.

- **[INFO]** 신규 테스트 헬퍼 `twSpacingPx`가 정규식으로 Tailwind 클래스 문자열을 파싱해 픽셀 값을 역산하는 방식은 다소 "영리한(clever)" 접근이라 진입장벽이 있음
  - 위치: `codebase/frontend/src/components/editor/canvas/__tests__/canvas-minimap.test.tsx:184-193`
  - 상세: `Tailwind spacing scale: N * 4px`라는 도메인 지식을 정규식 기반으로 런타임에 추출하는 방식은, 스타일이 `bottom-[52px]` 같은 임의값(arbitrary value) 문법으로 바뀌면 정규식이 매치하지 못해 `no "prefix-<n>" class found` 에러로 실패한다(암묵적 전제). 다만 주석이 이 전제를 명확히 밝히고 있고, 하드코딩된 기대값을 복제하는 것보다 실제 렌더링된 className을 추적하는 편이 테스트-구현 간 드리프트를 줄여 오히려 유지보수성을 높이는 트레이드오프로 판단됨.
  - 제안: 별도 조치 불필요. 향후 임의값 문법으로 전환할 경우 이 헬퍼도 함께 갱신 필요하다는 점만 인지하고 있으면 됨.

- **[INFO]** 두 언어(en/ko) MDX 문서에서 동일한 문구("above" → "below", "위" → "아래")를 각각 별도 파일에서 수정 — 구조적 중복이지만 i18n 콘텐츠 페어 구조상 기존 컨벤션과 일치
  - 위치: `canvas-basics.en.mdx:28`, `canvas-basics.mdx:39`
  - 상세: 문제라기보다 기존 패턴(언어별 병렬 mdx 파일) 준수 확인 차원의 기록. 별도 조치 불필요.

### 요약
이번 변경은 미니맵/토글 버튼 겹침 버그를 고치면서 이전의 가시성-의존적 마진(`mb-[168px]`, 매직 넘버이자 조건부 클래스)을 두 개의 고정 오프셋(`!bottom-2`, `!bottom-12`)으로 단순화해 가독성을 개선했고, 회귀를 막는 테스트(오프셋 관계 검증 + 토글 위치 고정 검증)를 함께 추가해 유지보수성 측면에서 긍정적이다. 다만 오프셋 48px가 버튼 높이(`h-8`)·코너 여백(8px)·간격(8px)의 합이라는 관계는 여전히 두 JSX 리터럴에 암묵적으로 인코딩되어 있어 향후 버튼 크기 변경 시 함께 갱신해야 함을 사람이 기억해야 한다(테스트가 이를 감지는 하지만 값 자체를 중앙화하진 않음). 함수 길이·중첩 깊이·네이밍·기존 스타일 일관성 등 다른 항목에서는 문제 발견되지 않았다.

### 위험도
LOW
