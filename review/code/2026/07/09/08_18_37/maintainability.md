# 유지보수성(Maintainability) 리뷰

대상 커밋: `62484807` (refactor(navigation): 슬러그 라우팅 round-2 ai-review/impl-done Warning 조치)

## 발견사항

- **[INFO]** `href.ts` 의 정규화 로직이 두 번의 `.replace()` 체이닝으로 구성
  - 위치: `codebase/frontend/src/lib/workspace/href.ts:717-719` (`buildWorkspaceHref`)
  - 상세: 제어문자 제거(`/[\t\r\n]/g`)와 선행 슬래시/백슬래시 축약(`/^[/\\]+/`)이 별개 `.replace()` 호출로 체이닝되어 있다. 각 단계는 위 주석으로 잘 설명돼 있어 의도 파악은 어렵지 않으나, 두 정규식을 하나로 합치거나 각 단계에 인라인 이름(중간 변수)을 부여하면 "무엇을, 왜" 가 더 명확해진다. 함수 자체가 3줄이라 현재도 크게 읽기 어렵지 않은 수준.
  - 제안: 필요 시 `const withoutControlChars = ...; const clean = ...;` 형태로 단계를 분리해 각 정규식의 책임을 변수명으로 드러내는 정도의 저비용 개선. 현재 상태로도 차단 사유는 아님.

- **[INFO]** `/w/` 라우트 prefix 리터럴 — 본 diff 범위에서는 이슈 아님, 기존 추적 항목 재확인
  - 위치: `codebase/frontend/src/lib/workspace/href.ts:24` (`` `/w/${slug}${clean}` ``)
  - 상세: 이 커밋(round 2) 기준으로는 `/w/` 리터럴이 `href.ts` 한 곳에만 존재해(grep 확인) DRY 위반은 아니다. 직전 라운드 RESOLUTION(`review/code/2026/07/08/18_24_41/RESOLUTION.md`)이 이미 `WORKSPACE_ROUTE_PREFIX` 상수화를 INFO-defer 항목(#8)으로 추적 중이므로 본 라운드에서 별도 조치가 필요한 신규 발견은 아니다. `[slug]/layout.tsx` 등 다른 소비처가 늘어나면 상수화 임계점을 넘을 수 있다는 점만 참고.
  - 제안: 별도 조치 불필요(이미 백로그에 등재됨). 소비처가 3곳 이상으로 늘면 재고.

## 긍정 관찰 (참고)

- **DRY 개선**: `workspace-store.setWorkspaces` 의 인라인 폴백 로직(`stillExists ? current : list[0]?.id`)을 `resolveFallbackWorkspace()` 위임으로 교체 — `[slug]` layout·`(main)/[...rest]` catch-all 과 함께 3개 소비처가 단일 순수 함수를 공유하게 됐다. JSDoc 이 "세 소비처가 모두 이 함수에 위임한다" 로 갱신돼 단일 진실 공급원임이 코드 밖에서도 명확하다.
- **네이밍**: `buildWorkspaceHref`, `resolveFallbackWorkspace`, `isSelfConnection` 류와 일관된 동사+명사 패턴, 목적이 이름에서 바로 드러난다.
- **주석 품질**: `href.ts` 상단 JSDoc과 인라인 주석이 "무엇을 막는지"(WHATWG URL 특수스킴 우회 클래스) 뿐 아니라 "왜 지금 이 코드에서 문제인지"(slug 폴백 분기가 caller path 를 그대로 반환)까지 설명해 향후 유지보수자가 정규식을 함부로 단순화하지 않도록 돕는다.
- **함수 길이/복잡도/중첩**: 이번 diff의 모든 변경 함수(`buildWorkspaceHref`, `resolveFallbackWorkspace`, `setWorkspaces`)는 순환 복잡도 1~2, 중첩 깊이 0~1 수준으로 단순하다.
- **테스트**: `href.test.ts` 에 추가된 케이스명(`neutralizes backslash and control-char open-redirect bypasses`)이 검증 의도를 명확히 서술하고, 기존 테스트 스타일(설명 주석 + `expect` 나열)과 일관된다.
- **일관성**: 변경 파일 전반이 기존 코드베이스의 Korean 주석 + JSDoc 컨벤션, `__tests__` 콜로케이션 패턴을 그대로 따른다.

## 요약

이번 커밋은 직전 라운드 ai-review Warning(보안 정규화 강화, DRY 위임, 문서 동기화)에 대한 후속 조치로, 변경 범위가 4개 소규모 TS 파일(스토어 1곳 위임 전환, 순수 함수 2곳, 테스트 1곳)에 한정된 매우 낮은 복잡도의 리팩터다. 함수 길이·중첩·순환 복잡도 모두 문제 없는 수준이며, 오히려 인라인 중복 폴백 로직을 단일 순수 함수(`resolveFallbackWorkspace`)로 통합해 유지보수성을 개선했다. 주석은 "왜" 를 충실히 설명하고 테스트 네이밍도 명확해 향후 회귀 발생 시 원인 추적이 쉽다. 발견된 사항은 정규식 체이닝 가독성 정도의 저비용 INFO 뿐이며 차단 사유가 되는 항목은 없다.

## 위험도

LOW
