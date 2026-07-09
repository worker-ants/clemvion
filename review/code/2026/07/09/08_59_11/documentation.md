# 문서화(Documentation) 리뷰 — 미니맵/토글 버튼 겹침 수정

리뷰 대상: `canvas-minimap.tsx`, `canvas-minimap.test.tsx`, `canvas-basics.mdx`, `canvas-basics.en.mdx`
(커밋 `607bba715 fix(editor): 미니맵이 맵 토글 버튼을 가리지 않도록 위로 띄움`)

## 발견사항

- **[INFO]** CHANGELOG.md 에 이 수정에 대한 엔트리가 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/focused-borg-fd463a/CHANGELOG.md`
  - 상세: 저장소 관행상 `CHANGELOG.md` 의 `## Unreleased — ...` 섹션은 신규 기능뿐 아니라 사용자 체감 버그 수정도 기록해왔다(예: 기존 엔트리 `## Unreleased — 웹채팅 로더 arguments-replay 버그 수정`, `## Unreleased — 인증 webhook 1MB body 게이트 (옵션 C) + 공개 webhook 보호 우회 fix`). 이번 변경은 "미니맵이 토글 버튼을 가리는" 실제 UX 버그를 고치는 사용자 체감 수정이지만 CHANGELOG 갱신이 diff 에 포함되어 있지 않다. 다만 `developer` SKILL.md·conventions 어디에도 CHANGELOG 갱신을 형식 의무로 명시한 조항은 없어 필수 위반은 아니다.
  - 제안: 관행 일관성을 위해 `## Unreleased — 미니맵이 토글 버튼을 가리지 않도록 위치 조정` 같은 1~2문장 엔트리 추가를 검토. 이미 별도 plan 문서 없이 소규모 fix 로 처리된 점을 볼 때, 생략도 크게 문제는 아니라고 판단되어 등급은 INFO 로 둔다.

- **[INFO]** 새 회귀 테스트는 `>=` 부등식만 검증하지만 주석/커밋 메시지는 "정확한(exact) 8px 갭"을 주장
  - 위치: `codebase/frontend/src/components/editor/canvas/canvas-minimap.tsx` L311-315 (`// Float the minimap ... the 8px gap is exact.`), `codebase/frontend/src/components/editor/canvas/__tests__/canvas-minimap.test.tsx` L111-129 (`expect(minimapBottomPx).toBeGreaterThanOrEqual(...)`), 커밋 메시지("갭이 정확함")
  - 상세: 코드 주석과 커밋 메시지는 "margin 이 상쇄되어 8px 갭이 정확하다"고 단정적으로 서술하지만, 실제 추가된 회귀 테스트는 겹침 방지만 보장하는 `toBeGreaterThanOrEqual` 부등식이라 "정확히 8px" 라는 주장 자체는 테스트로 검증되지 않는다(회귀 방지 목적상 부등식이 더 안전한 선택이긴 하다). 향후 `@xyflow/react` 내부 `MiniMap` 의 기본 margin 구현이 바뀌면 겹침은 여전히 안 나더라도 "정확히 8px" 라는 주석의 설명은 조용히 틀려질 수 있다.
  - 제안: 주석의 표현을 "현재 가정하에 정확함(미검증)" 정도로 완화하거나, 정말 정확성이 중요하다면 테스트를 `toBe`(등식)로 강화. 사소하며 기능에는 영향 없음.

- **[INFO]** `<MiniMap>` 내부가 `<Panel>` 과 동일 기본 margin 을 공유한다는 전제가 파일 내부적으로 검증 불가능한 서드파티 구현 세부사항에 의존
  - 위치: `codebase/frontend/src/components/editor/canvas/canvas-minimap.tsx` L313-315 (`Both live in a \`<Panel>\` with the same default margin, so that margin cancels out...`)
  - 상세: 이 파일의 JSX 상으로는 토글 버튼만 명시적으로 `<Panel>` 로 감싸져 있고 `<MiniMap>` 은 독립 컴포넌트다. 주석이 말하는 "Both live in a `<Panel>`" 은 `@xyflow/react` 라이브러리 내부에서 `MiniMap` 이 `Panel` 프리미티브로 구현되어 있다는 가정을 가리키는데, 이 파일만 읽는 유지보수자에게는 오독 소지가 있다(마치 이 파일에서 두 요소가 모두 `<Panel>` 로 명시적으로 감싸진 것처럼 읽힐 수 있음). 라이브러리 버전이 바뀌면 이 가정이 깨질 수 있는데 이를 검증하는 참조(버전 고정, 링크, 또는 소스 인용)가 없다.
  - 제안: "라이브러리 내부 구현" 임을 명시하는 한 문장(예: "@xyflow/react 의 MiniMap 컴포넌트는 내부적으로 Panel 을 사용함 — vX.Y.Z 기준")을 덧붙이면 향후 라이브러리 업그레이드 시 가정 재검증 포인트가 명확해진다. 매우 사소함.

## 검증 완료 (문제 없음, 참고용)

- JSDoc(`CanvasMinimap` 상단 블록 주석)이 새 레이아웃(토글 코너 고정 + 미니맵이 그 위로 뜸)을 정확히 반영하도록 갱신됨 — spec §7 상태(구현됨)와도 일치.
- `canvas-basics.mdx`/`canvas-basics.en.mdx` 두 로케일 모두 "토글 버튼 위" → "토글 버튼 아래" 로 일관되게 수정되어 실제 레이아웃(미니맵 `!bottom-12`, 토글 `!bottom-2`)과 정합.
- 같은 미니맵을 언급하는 다른 문서(`ui-tour.mdx`/`.en.mdx`, `03-workflow-editor/overview.mdx`/`.en.mdx`)는 "미니맵 옆(next to it)" 처럼 방향 중립적 표현을 쓰고 있어 이번 fix 로 인한 불일치가 발생하지 않음 — 추가 수정 불필요함을 확인.
- `spec/3-workflow-editor/0-canvas.md §7` 은 버튼-미니맵 상대 위치를 규정하지 않으므로 spec 본문 갱신 불필요.
- 테스트 파일 내 새 mock/헬퍼(`twSpacingPx`)에 대한 주석이 Tailwind spacing 스케일(N×4px)과 `!important` 접두사 처리 로직을 정확하고 명료하게 설명함.
- 새로 추가된 두 테스트(`floats the minimap above...`, `keeps the toggle pinned...`)에 붙은 인라인 주석이 회귀 목적(맵-버튼 겹침 방지, 표시 여부에 따른 버튼 위치 흔들림 방지)을 명확히 설명하며 실제 assertion 과 일치.
- API 변경 없음(클라이언트 전용 CSS 포지셔닝 수정), 신규 환경변수·설정 없음, 신규 i18n 키 없음(`common.aria.minimap`/`toggleMinimap` 은 기존 키 재사용 확인) — 해당 항목들은 리뷰 대상 아님.
- README 갱신 불필요 — 신규 기능/설정 추가가 아닌 기존 구현 완료 기능의 시각적 버그 수정.

## 요약

이번 변경은 문서화 관점에서 전반적으로 모범적이다: 컴포넌트 JSDoc·인라인 주석·회귀 테스트 주석·양 언어(KO/EN) 사용자 문서가 새 레이아웃과 정확히 동기화되어 있고, spec 및 다른 연관 문서와도 충돌이 없음을 확인했다. 발견된 사항은 모두 INFO 등급의 사소한 개선 여지(CHANGELOG 엔트리 부재, "정확한 8px" 주장과 부등식 테스트 간의 미묘한 표현 차이, 서드파티 내부 구현 가정의 출처 미표기)이며 병합을 막을 사유는 없다.

## 위험도

LOW
