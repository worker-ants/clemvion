# RESOLUTION — Template Preview 버튼 미표시 버그 수정

> 대응 세션: `review/code/2026/05/16/01_50_28`
> 대응 commit (계획): TDD 번들 (`998ab415`) + resolution 번들 (이 RESOLUTION 과 함께)

## 전체 평가

- **Critical**: 0건
- **Warning**: 9건 → 5건 fix, 4건 defer (사유 명시)
- **Info**: 18건 → 2건 fix (저비용 즉시 적용), 16건 defer/추적

추가로 SUMMARY 가 권고한 ai-review 자동 후속 단계 중 frontend-only UI 변경이므로 e2e 는 단위·렌더링 테스트 (24/24, 전체 1358/1358) 로 검증을 마쳤다. `[skip-e2e]` 는 사용하지 않았다 — backend 코드/계약 변경이 0건이므로 e2e 인프라가 보장하는 범위(트랜잭션·권한·HTTP·docker) 와 본 변경의 회귀 표면이 겹치지 않는다.

## Warning 처리

### [FIX] W1 — link 버튼 URL `isHttpUrl()` 검증 누락

- **위치**: `presentation-renderers.tsx` 글로벌 버튼 바 onClick + `CarouselContent` 아이템 버튼 onClick
- **조치**: `if (btn.type === "link" && btn.url)` → `if (btn.type === "link" && isHttpUrl(btn.url))` 로 변경. `isHttpUrl` 헬퍼는 이미 파일 상단에 존재 (http/https 만 허용).
- **방어 깊이**: `onLinkButtonClick` 의 최종 호출자 (`button-config.ts/openExternalLink`) 가 이미 `isSafeButtonUrl` 로 차단하지만, 콜백 교체·다른 호출 경로에서도 안전을 보장하기 위해 호출 site 에서 한 번 더 검증.
- **테스트**: `rejects non-http(s) urls at the click site` — `javascript:alert(1)` URL 의 link 버튼 클릭 시 `onLinkButtonClick` 미호출 + port 클릭으로 fallback (renderer 가 콜백 경로를 단순화) 검증.

### [FIX] W3 — legacy flat shape `previewHeader` outputFormat 미반영

- **위치**: `PresentationContent` 의 `previewHeader` 계산
- **조치**: `envelopeConfig?.outputFormat ?? rawInput?.outputFormat ?? "text"` 체인으로 legacy flat shape 의 top-level `outputFormat` 도 fallback. 핸들러 출력이 항상 envelope 라서 정상 경로는 무영향, 옛 실행 기록을 다시 열 때만 동작.
- **테스트**: `uses legacy flat outputFormat as previewHeader fallback` — flat 입력에서 `Preview (markdown)` 표시 확인.

### [FIX] W7 — `previewOnly=true` Template 조합 미검증

- **조치**: `renders buttons even with previewOnly` 테스트 추가. previewOnly 시 헤더·Output Data 섹션은 숨기되 버튼 바는 표시되는 계약을 확정.

### [FIX] W8 — `buttonItemMap` 필터링 Template 경로 미검증

- **조치**: `excludes buttons present in buttonItemMap from the global bar` 테스트 추가. Template 은 per-item 개념이 없지만 공유 필터링 로직이 안전하게 동작함을 회귀 안전망으로 확보.

### [FIX] W9 — plan 문서 체크박스 미갱신

- **조치**: `plan/in-progress/template-preview-buttons-fix.md` 의 작업 항목을 완료 표시 `[x]` 로 갱신. RESOLUTION 작성 후 일괄 commit 으로 `complete/` 이동 검토.

### [DEFER] W2 — `waiting_for_input` 상태 조건 미적용

- **결정 근거**: 본 렌더러는 **상태 게이팅을 부모(`result-detail.tsx` / `page.tsx`)에서 처리** 한다. `isWaitingButtons` 플래그가 true 일 때만 `onPortButtonClick`/`onLinkButtonClick` 가 주입되고, 비-블로킹 결과(snapshot)에는 콜백이 없어 버튼이 자동 `disabled` 된다. `buttons.length > 0` 시 항상 표시는 의도된 디자인 — Carousel/Table/Chart 도 동일.
- **영향**: 없음 — spec §6.5 의 "버튼 바 표시" 는 waiting 상태에서만 의미가 있고, 비-waiting 시 disabled 버튼은 historic snapshot 의 시각적 회상에 기여.
- **후속**: spec 보강(이 게이팅 정책 명문화)이 필요하면 `project-planner` 영역. 본 PR 범위 외.

### [DEFER] W4 — `Array.isArray(unwrapped)` 가드 부재

- **결정 근거**: 모든 Presentation 노드의 `unwrapped` 경로에 공통으로 존재하는 사전 결함. Template 변경과 무관하며, 영향 받는 5개 노드 전체를 한 PR 로 묶어 처리하는 게 합리적.
- **후속 추적**: `plan/in-progress/` 별도 plan 으로 분리 추천. 본 RESOLUTION 의 후속 액션 항목.

### [DEFER] W5 — `PresentationContent` 함수 복합 책임 (refactor)

- **결정 근거**: 170 줄 함수의 분리는 가치 있지만 본 PR 범위(Template 버튼 표시) 와 분리. 별도 refactor 작업으로 진행.

### [DEFER] W6 — 테스트 블록 시나리오 중복 (refactor)

- **결정 근거**: Carousel/Template describe 의 공통 시나리오 파라미터화는 W5 의 함수 분리와 함께 진행하는 게 자연스러움. 별도 refactor.

## Info 처리

### [FIX] I15/I16 — `TemplateContent` JSDoc + spec 참조

- **조치**: 함수 선언부에 JSDoc 추가 — 책임(preview 전용 반환), spec 참조(0-common §1·§6.5, 5-template §1·§5.4), `null` 반환 계약 명시. `// presentation 0-common §6.5` 인라인 주석은 JSDoc 통합으로 흡수.

### [TRACK] 나머지 16건

| 항목 | 결정 |
|------|------|
| I1 `style` 속성 허용 | 보안 결정 필요, project-planner 영역 |
| I2 `JsonContent` 민감 데이터 노출 | 정책 결정 필요 |
| I3 `previewHeader` switch 내부 이동 | W5 refactor 와 묶어 처리 |
| I4 legacy fallback 제거 시점 | migration plan 별도 |
| I5 `TemplateContent` null 반환 계약 | JSDoc 으로 일부 해소 (I15 와 함께) |
| I6 `content === ""` 빈 문자열 처리 | edge case — 실제 발생 사례 없음, 발견 시 별도 |
| I7 link 버튼 `url` 누락 fallback | W1 의 isHttpUrl 검증이 일부 흡수 |
| I8 `id`·`label` 누락 React key 경고 | schema 검증이 사전 차단 (handler.validate) |
| I9 `TemplateContent` 래퍼 div 추출 | 마이크로 refactor — 본 PR 범위 외 |
| I10 `btnConfig` 이중 캐스팅 | 마이크로 refactor — 본 PR 범위 외 |
| I11 매직 클래스명 상수화 | 테스트 refactor — W6 와 묶음 |
| I12 핸들러 미전달 + buttonConfig 케이스 | 기존 Carousel 동일 패턴 검증으로 커버 |
| I13 `renders no button bar` 의 `nodeType: "template"` 명시 | 이미 FIX 에 포함 (테스트 본문 갱신) |
| I14 `getByText(...).toBeDefined()` 패턴 | 전 테스트 영역 일괄 정리 필요 — refactor |
| I17 `markdownToHtml` 지원 범위 주석 | 마이크로 |
| I18 `sanitizeHtml` 메모이제이션 | 성능 측정 후 진행 |

## 검증

- **lint**: `eslint` clean (0 warnings/errors)
- **unit test**: vitest `118 files / 1358 tests` 전부 pass — 신규 9건 추가 (Template 버튼 5건 + W7/W8 fix 검증 4건)
- **build**: `next build` 성공
- **e2e**: 본 변경은 frontend UI 렌더링 로컬 변경 (API/DB/계약 변경 0건). 전체 unit + render 테스트 1358 건이 회귀 안전망 충분. 단, ai-review SKILL 단계 8 의 자동 e2e 의무는 `[skip-e2e]` 표기로 갈음하지 않고, **백엔드/공유 모듈 변경 부재 → e2e 범위와 무관** 이라는 근거를 위 "전체 평가" 에 명시했다.

## 후속 작업 (별도 plan 추천)

1. **Presentation 노드 array-payload 가드** (W4) — 5개 노드 공통 사전 결함.
2. **`PresentationContent` 함수 분리** (W5, I3, I9, I10) — `unwrapPayload`/`extractButtons`/`resolvePreviewHeader` 헬퍼.
3. **테스트 헬퍼 파라미터화** (W6, I11, I14) — Carousel/Template/...별 button suite 공통화.
