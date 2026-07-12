# 유지보수성(Maintainability) 리뷰

대상: `codebase/channel-web-chat/src/lib/widget-state.test.ts`, `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`, `plan/in-progress/webchat-multiturn-restore-test.md` (test-only 추가, 제품 코드 무변경)

### 발견사항

- **[INFO]** 신규 통합 테스트가 인접 테스트("race fix: getStatus 가 buttons waiting 표면을 주면…")와 거의 동일한 `fetchMock` 골격(embed-config reject → GET status endswith 분기 → webhook POST 폴백)을 재복제
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:1108-1144` (신규 "복원 통합" 테스트), 비교 대상 `:1050-1087` (기존 "race fix" 테스트)
  - 상세: 파일에는 이미 `installFetch()` / `installControllableSse()` 라는 공용 mock 빌더가 있어 DRY 방향을 보여주지만, GET status(`/api/external/executions/e1`) 분기가 필요한 테스트들(신규 포함 4곳 이상)은 매번 ~30줄 인라인 `vi.fn` 을 새로 작성한다. 이번 변경은 그 기존 패턴을 그대로 답습해 중복을 한 곳 더 늘렸다.
  - 제안: `installFetchWithStatusContext(contextOverrides)` 류의 공용 헬퍼를 추출해 GET status 분기를 재사용하면 이후 유사 테스트 추가 시 보일러플레이트가 줄어든다. 다만 기존 파일 전반의 확립된 관례(테스트별 독립 mock)를 이번 diff 단독으로 바꾸는 것은 과도하므로, 후속 리팩터로 남겨도 무방.

- **[INFO]** `widget-state.test.ts` 신규 `describe` 블록의 로컬 헬퍼(`user`/`bot`/`waiting`)가 파일 스코프가 아닌 `describe` 내부 스코프로 한정
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.test.ts:318-321`
  - 상세: 문제는 아니며 오히려 스코프를 좁게 유지한 점은 가독성에 긍정적. 다만 `DisplayMessage` 리터럴 생성 패턴(`{ role, text, source }`)이 파일 상단의 다른 `describe` 블록들에는 없어, 향후 유사 블록이 늘어나면 파일 전역 공용 헬퍼로 승격할지 판단이 필요할 수 있음(현재는 1곳뿐이라 이르다).
  - 제안: 조치 불필요, 참고만.

### 요약
두 테스트 파일 모두 순수 테스트 전용 추가(제품 코드 변경 없음)로, 기존 코드베이스의 확립된 컨벤션(§ 참조 주석, 한국어 서술형 테스트명, `installFetch`/`installControllableSse` 류 헬퍼, `NINETY_MIN_MS` 등 매직넘버 상수화)을 충실히 따른다. 함수 길이·중첩 깊이·순환 복잡도 모두 낮고, `widget-state.test.ts` 의 새 `describe` 블록은 로컬 헬퍼(`user`/`bot`/`waiting`)로 5개 케이스 간 중복을 잘 억제했다. `use-widget-eager-start.test.ts` 의 신규 통합 테스트는 기존 파일에 이미 존재하는 "테스트별 인라인 fetchMock 재작성" 패턴을 답습해 경미한 중복을 한 건 추가했지만, 이는 이번 diff 가 새로 만든 문제가 아니라 파일 전반의 기존 관례를 그대로 따른 것이라 severity 는 낮다. `plan/in-progress/webchat-multiturn-restore-test.md` 는 frontmatter·구조 모두 프로젝트 관례에 부합한다. 전반적으로 유지보수성 리스크는 무시할 만한 수준이다.

### 위험도
LOW
