# 테스트(Testing) 리뷰 — rerun-modal slug 네비게이션 fix (round-3, 08_39_36)

## 발견사항

- **[INFO]** 이전 라운드까지 slug-present 분기가 테스트되지 않아 real bug 가 은폐되어 있었음(이번 커밋으로 해소)
  - 위치: `codebase/frontend/src/components/executions/__tests__/rerun-modal.test.tsx` (신규 테스트, "re-run 성공 후 활성 워크스페이스가 있으면 slug 경로로 라우팅한다")
  - 상세: 기존 "Re-run 버튼 → reRun API 호출 후 새 실행 상세로 라우팅" 테스트는 `beforeEach` 에서 워크스페이스 스토어를 항상 리셋(활성 워크스페이스 없음)한 상태로만 검증했기 때문에, `router.push` 에 `buildWorkspaceHref` 를 씌우지 않는 버그가 있어도 bare-path 결과가 우연히 일치해 테스트가 계속 통과했다. slug 가 존재하는 분기(활성 워크스페이스 있음)를 다루는 테스트가 이번에 처음 추가되어, 두 분기(slug 있음/없음) 모두 회귀 테스트로 고정됐다. 현재는 해소됐지만, "라우팅 목적지 문자열"을 검증하는 테스트를 작성할 때 store/컨텍스트의 default 상태만으로 커버하면 실제 조건 분기가 은폐될 수 있다는 패턴은 다른 slug 관련 컴포넌트(예: 유사한 `router.push`/`buildWorkspaceHref` 호출부)에도 적용해 볼 가치가 있다.
  - 제안: 신규 코드 없음(이미 반영됨). 향후 유사 네비게이션 fix 시 "활성 워크스페이스 있음/없음" 두 분기를 기본 테스트 매트릭스로 삼을 것을 권장.

- **[INFO]** href.test.ts 의 `it.each` 매트릭스에 slug 조합 케이스가 backslash/CR 2개뿐, LF+slug·이중 backslash+slug 조합은 미포함
  - 위치: `codebase/frontend/src/lib/workspace/__tests__/href.test.ts:1353-1368`
  - 상세: `buildWorkspaceHref` 의 정규화 로직(`replace(/[\t\r\n]/g, "")` + `replace(/^[/\\]+/, "")`)은 tab/CR/LF 를 동일하게 취급하므로 실질적 위험은 낮지만, "slug 있음 + LF" 조합은 여전히 미검증이다.
  - 제안: 우선순위 낮음(low-risk, defer 가능). 필요 시 `["LF with slug", "team-a", "\n/evil.com", "/w/team-a/evil.com"]` 한 줄 추가로 매트릭스 대칭성을 완성할 수 있다.

- **[INFO]** RESOLUTION.md 두 파일(`review/code/2026/07/08/18_24_41/RESOLUTION.md`, `review/code/2026/07/09/08_18_37/RESOLUTION.md`)에 기록된 documentation·user_guide_sync·requirement·testing reviewer 미산출(disk-write 갭)이 라운드마다 반복 발생
  - 위치: 두 RESOLUTION.md 파일의 "리뷰 커버리지 갭" / "미산출 reviewer" 절
  - 상세: 코드 자체의 테스트 이슈는 아니지만, ai-review 파이프라인(Workflow tool)의 반복적 disk-write 갭은 "테스트 커버리지가 실제로 검증됐는지"를 재확인하는 메타 신뢰도에 영향을 준다. 이번 라운드는 fallback Agent fan-out 경로로 우회했다고 보이며 unit 테스트 자체(vitest)는 정상 실행·통과(5114 pass)로 별도 확인됨.
  - 제안: 코드 변경 범위 밖. 참고용 기록.

## 커버리지 확인 (문제 없음)

- `rerun-modal.tsx` 의 두 `buildWorkspaceHref` 호출부(원본 실행 링크 `<a href>` — 기존 커버, 재실행 성공 네비게이션 `router.push` — 이번에 신규 커버) 모두 slug 있음/없음 케이스가 테스트로 존재한다.
- `workspace-store.test.ts` 신규 `setWorkspaces` 블록 4케이스(유지/폴백/최초선택/빈 목록)는 `resolveFallbackWorkspace` 위임 + `loaded` 플래그 갱신을 스토어 레벨에서 검증 — 순수 함수 단위 테스트(`resolve-fallback.test.ts`, 기존)와 상호보완적이며 중복이 아니다(스토어 액션의 `set` 부수효과까지 검증).
- `href.test.ts` 의 `it.each` 리팩터는 기존 4개 단정 전부를 보존하며 CR/LF/slug+control-char 3개 케이스를 추가 — 회귀 없이 가독성만 개선(라벨링된 테이블 테스트로 각 케이스 의도가 명확).
- Mock 사용은 적절함: `useWorkspaceSlug()` 를 shallow mock 하지 않고 실제 zustand 스토어(`useWorkspaceStore.setState`)를 조작해 검증 — 구현 세부(hook 내부 selector 로직)에 결합되지 않으면서도 실제 동작과 괴리가 없다. `next/navigation` mock(`useParams: () => ({})`)도 slug-fallback 경로(URL 파라미터 없음 → store 파생)와 일치해 테스트 의도와 실제 훅 우선순위가 맞아떨어진다.
- 테스트 격리: `beforeEach` 에서 `useWorkspaceStore.getState().reset()` 을 추가해 slug 상태 누수를 명시적으로 차단 — 새 테스트가 이후 테스트에 영향을 주지 않도록 처리됨.

## 요약

이번 diff 는 실제 네비게이션 버그(재실행 성공 시 slug 미부착)를 고정하는 회귀 테스트를 정확한 지점(활성 워크스페이스 있음 분기)에 추가했고, 기존 "워크스페이스 없음" 테스트와 합쳐 두 분기 모두 커버한다. `workspace-store.test.ts`·`href.test.ts` 추가분도 각각 스토어 위임 로직과 open-redirect 방어 매트릭스를 대칭적으로 보강해 회귀 방지 효과가 있으며 기존 테스트와 중복되지 않는다. Mock 사용(zustand 실 스토어 조작, `next/navigation` 파라미터 mock)이 구현 세부에 과결합되지 않고 실동작과 일치한다. 남은 갭은 전부 저위험 INFO 성격(슬러그+LF 조합 미검증, 반복되는 ai-review 파이프라인 disk-write 갭)으로 코드 변경 자체를 막을 사유는 없다.

## 위험도

LOW
