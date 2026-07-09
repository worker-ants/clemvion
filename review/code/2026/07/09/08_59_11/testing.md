# 테스트(Testing) 리뷰 — canvas-minimap 오버랩 수정

## 발견사항

- **[INFO]** 회귀 테스트는 mock 경계까지만 검증, 실 라이브러리 내부 가정은 미검증
  - 위치: `codebase/frontend/src/components/editor/canvas/__tests__/canvas-minimap.test.tsx:111-129` (`floats the minimap above the toggle button...`), `codebase/frontend/src/components/editor/canvas/canvas-minimap.tsx:296-320` 주석 ("Both live in a `<Panel>` with the same default margin, so it cancels out")
  - 상세: `twSpacingPx` 기반 산술 검증(`minimapBottomPx >= toggleBottomPx + toggleHeightPx`)은 컴포넌트가 올바른 Tailwind 클래스를 렌더링하는지만 확인한다. 이 계산이 실제로 겹침을 막는다는 보장은 "MiniMap 과 Panel 이 동일한 기본 margin 을 가진 `<Panel>` 안에 있다"는 가정에 의존하는데, `@xyflow/react` 는 이 테스트에서 완전히 mock 되어 있어 그 가정 자체는 어떤 테스트로도 검증되지 않는다. (실측: `@xyflow/react@12.10.2` 번들 내부에서 `MiniMap` 이 실제로 `Panel`(`.react-flow__panel`, 기본 margin 15px)을 통해 렌더링되므로 현재는 가정이 유효하지만, 향후 라이브러리 업그레이드로 이 내부 구현이 바뀌면 — 즉 원래 버그와 같은 종류의 시각적 겹침 회귀가 재발해도 — 이 테스트는 mock 경계 안에서 계속 그린으로 통과한다.
  - 제안: 조치 불요에 가깝다 — 프로젝트 e2e 컨벤션(`PROJECT.md` §e2e 테스트 작성 가이드)은 e2e 를 multi-actor/인프라/RBAC 흐름에 한정하고 픽셀 단위 시각 회귀는 범위 밖으로 명시하므로, 현재 unit 레벨 클래스 검증이 이 프로젝트의 테스트 레이어 정책에는 맞다. 다만 `@xyflow/react` 업그레이드 PR 리뷰 시 이 가정이 재확인 대상이라는 점을 인지해두면 좋다 (별도 액션 불필요, 참고용).

- **[INFO]** `twSpacingPx` 헬퍼는 Tailwind arbitrary-value 문법(`bottom-[48px]`)으로 전환되면 무음으로 실패
  - 위치: `codebase/frontend/src/components/editor/canvas/__tests__/canvas-minimap.test.tsx:77-83`
  - 상세: 정규식이 `!?prefix-(\d+)` 형태(스케일 기반)만 매칭한다. 현재 코드가 `!bottom-12` 처럼 스케일 값만 쓰므로 문제 없고, 매칭 실패 시 명시적으로 `throw` 하므로 "무음 실패"는 아니고 테스트가 명확히 fail 한다 — 오히려 fail-fast 설계로 좋은 패턴이다. 향후 arbitrary value 로 바뀌면 헬퍼도 같이 갱신이 필요하다는 점만 기록.
  - 제안: 액션 불필요. 참고로만 남김.

- **[INFO]** 수평축(`right-2`) 정합성은 검증 대상에서 제외
  - 위치: `codebase/frontend/src/components/editor/canvas/__tests__/canvas-minimap.test.tsx:111-129`
  - 상세: 새 회귀 테스트는 `bottom` 축(세로 오프셋)만 산술 검증한다. `right-2` 는 두 요소 모두 하드코딩 값이 동일해 리스크가 낮지만, minimap/panel 우측 정렬이 어긋나 대각선으로 스치는 경우까지는 커버하지 않는다.
  - 제안: 현재 버그(세로 겹침)에 정확히 대응하는 회귀 테스트라 우선순위는 낮음. 필요시 `data-position="bottom-right"` 어서션(이미 존재)이 최소한의 정렬 보증 역할을 한다.

## 요약

`canvas-minimap.test.tsx` 는 이번 PR의 핵심 — 미니맵이 토글 버튼을 가리는 시각적 버그의 재발 방지 — 를 산술 기반 회귀 테스트로 잘 포착했다. 하드코딩된 매직넘버 대신 렌더된 className 에서 직접 오프셋을 파싱(`twSpacingPx`)해 "테스트가 실제 클래스를 추적"하도록 설계한 점, `visible=true/false` 양쪽 상태에서 토글 버튼 위치가 고정됨을 별도로 검증한 점(과거 `mb-[168px]` 조건부 lift 로직의 재도입을 막는 회귀 가드)이 특히 견고하다. `Button` 컴포넌트가 mock 되지 않고 실제로 렌더링되어 `cn`/`tailwind-merge` 를 거친 최종 className(`h-8`)을 읽는 부분도 실측 검증했으며 twMerge 의 충돌 해소 동작과 정합됨을 확인했다. 유일한 잔여 갭은 mock 경계 밖 — 즉 `@xyflow/react` 내부에서 `MiniMap`/`Panel` 이 동일 기본 margin 을 공유한다는 가정 — 을 검증할 방법이 unit 레벨엔 없다는 점인데, 이는 프로젝트의 e2e 범위 정책(픽셀 단위 시각 회귀는 e2e 대상 아님)과 일치하므로 블로킹 사유는 아니다. lint/tsc/vitest 모두 로컬에서 재실행해 통과를 확인했다.

## 위험도
LOW
