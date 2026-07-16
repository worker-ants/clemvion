# Rationale 연속성 검토 결과

> **입력 노트**: `prompt_file` 의 "target 문서" / "구현 대상 영역" 필드에 실제 파일 경로 대신 버그
> 설명·수정 계획 원문이 그대로 들어가 있고(오케스트레이터 템플릿 치환 오류로 추정), 본문 코드블록은
> `(없음)` 이라 실제 diff 는 제공되지 않았다. 아래는 그 수정 계획 텍스트를 target 으로 간주하고,
> 명시된 관련 spec(`spec/2-navigation/_layout.md:85`, `spec/2-navigation/9-user-profile.md:155-158`)과
> 실제 코드(`codebase/frontend/src/app/(main)/[...rest]/page.tsx`, `codebase/frontend/src/lib/workspace/href.ts`)를
> 대조해 분석한 결과다.

## 수정 계획 요약 (target)

1. `sidebar.tsx` navItems 에 `workspaceScoped` 플래그 도입 — `/docs` 는 bare href 사용.
2. `(main)/[...rest]/page.tsx` catch-all 을 terminal 로: `rest[0]=='w'` 이면 prefix 재부착 금지 / `/w/<slug>` 단독은 dashboard forward / 그 외는 `notFound()`.
3. `buildWorkspaceHref` idempotent 화는 미채택.

## 발견사항

- **[INFO]** 계획 (1)은 기존 spec 을 위반하는 새 결정이 아니라 code-vs-spec drift 를 바로잡는 조치
  - target 위치: 수정 계획 항목 (1)
  - 과거 결정 출처: `spec/2-navigation/_layout.md:85` ("예외 — User Guide(`/docs`)는 워크스페이스 무관 콘텐츠라 slug 밖으로 유지"), `spec/2-navigation/9-user-profile.md:158` ("slug 밖 유지... 유저 가이드(`/docs`)"), `spec/data-flow/12-workspace.md` Rationale "URL slug = FE 라우팅 SoT" 항의 "slug 없는 라우트(docs·catch-all)에서는 종전대로 localStorage 힌트 기준"
  - 상세: 세 spec 위치 모두 `/docs` 가 워크스페이스 slug 스코프 밖에 있어야 한다고 이미 명시적으로 합의돼 있다. 현재 `sidebar.tsx` 가 모든 nav item 에 `buildWorkspaceHref` 를 무조건 적용해 `/w/<slug>/docs` 를 만드는 것이 오히려 이 기존 spec 을 위반한 버그였다. `workspaceScoped` 플래그로 `/docs` 를 bare href 처리하는 것은 결정의 재도입/번복이 아니라 이미 합의된 결정을 코드에 되살리는 정합화다.
  - 제안: 그대로 진행. 다만 `(main)/[...rest]/page.tsx` 상단 docstring 의 "specific route 가 우선하므로 `/w/[slug]/...`·`/docs/...` 는 여기 오지 않는다" 라는 서술이 이번 버그로 반증됐으므로, 같은 PR 에서 그 코드 주석도 정정(반례 케이스 명시)해 향후 동일 오해로 인한 재발을 막을 것을 권장.

- **[WARNING]** catch-all 을 "redirect-only" 에서 "redirect ∪ notFound() 이원화"로 확장하면서 그 성격 변화를 반영하는 새 Rationale/spec 문구가 계획에 없음
  - target 위치: 수정 계획 항목 (2) ("그 외는 notFound()")
  - 과거 결정 출처: `spec/2-navigation/10-auth-flow.md:443` ("...redirect-only 중간 경로라 flash 허용"), `codebase/frontend/src/app/(main)/[...rest]/page.tsx` 상단 docstring ("`(main)` 그룹의 slug 없는 경로를 활성 워크스페이스 slug 로 흡수하는 catch-all **리다이렉트**")
  - 상세: 현재 spec 본문·코드 docstring 모두 이 catch-all 컴포넌트를 "무조건 redirect 하는 흡수 경로"로만 규정한다. 계획 (2)는 이 컴포넌트에 `notFound()` 종료 분기를 추가해 역할을 확장하는데, 이는 `spec/2-navigation/11-error-empty-states.md:56` 의 일반 "페이지 없음 → 404 → 대시보드 CTA" 정책과는 **결과적으로 정합**하지만(따라서 CRITICAL 은 아님), catch-all 컴포넌트 자체의 책임 범위가 바뀌는 것을 설명하는 spec 문구/Rationale 갱신이 계획에 포함돼 있지 않다. 이 상태로 머지되면 `10-auth-flow.md:443`·코드 docstring 은 "redirect-only" 라고 계속 서술하는데 실제로는 terminal 404 분기가 생기는 spec-vs-code 재drift 가 즉시 발생한다.
  - 제안: `_layout.md §2.2` 의 slug 각주(85행) 또는 `data-flow/12-workspace.md` Rationale "URL slug = FE 라우팅 SoT" 항에 짧은 sub-Rationale 을 추가 — "catch-all 은 이미 `/w/`-prefixed 이나 어떤 라우트에도 매치되지 않는 경로(`rest[0]==='w'`)에 대해서는 재-prefix 대신 (a) `/w/<slug>` 단독이면 대시보드 forward (b) 그 외는 `notFound()` 로 종결한다 — 11-error-empty-states §1.2 의 일반 404 정책과 동일 계열"; 동시에 `10-auth-flow.md:443`/코드 docstring 의 "redirect-only" 서술도 이원화를 반영하도록 정정.

- **[WARNING]** `buildWorkspaceHref` idempotent 화 미채택 결정에 근거(Rationale)가 계획 텍스트에 없고, 저장소의 기존 "구조적 버그클래스 제거" 관행과 결이 다름
  - target 위치: 수정 계획 항목 (3)
  - 과거 결정 출처: `codebase/frontend/src/lib/workspace/href.ts` 의 `buildExecutionHref`/`buildEditorHref` 문서 주석 — "리터럴이 여러 소비처에 흩어져 한 곳이 slug 를 빠뜨리는 회귀가 있었다(PR #865)... 경로 조립을 단일화해 그 클래스를 구조적으로 제거한다" + `__tests__/no-raw-execution-href.test.ts`/`no-raw-editor-href.test.ts` guard 로 강제
  - 상세: 이번 버그(`/w/<slug>` 가 이미 붙은 경로에 `buildWorkspaceHref` 가 다시 prefix 를 덧붙여 무한 중첩)는 정확히 저장소가 이미 한 번 겪고 "구조적으로 제거"하기로 결정한 것과 같은 계열(경로 조립 헬퍼의 호출부 산재 → 회귀)의 버그다. 그런데 계획 (3)은 헬퍼 자체를 방어적(이미 `/w/`-prefixed 인 입력을 감지해 무시)으로 만드는 대신 알려진 호출부(sidebar) 하나만 고치는 쪽을 택하면서, 왜 이번만 call-site 패치로 충분한지 근거를 남기지 않는다. 향후 다른 호출부가 이미 slug-prefixed 된 경로를 실수로 `buildWorkspaceHref` 에 넘기면 같은 버그 클래스가 재발할 수 있다.
  - 제안: `href.ts` 의 `buildWorkspaceHref` 문서 주석(또는 `_layout.md`/`data-flow/12-workspace.md` Rationale)에 "왜 idempotent 가드를 택하지 않았는지"(예: 호출부가 sidebar 1곳뿐이라 구조적 가드의 한계효용이 낮다는 판단 등) 한두 문장을 명시하거나, 저장소 관행과의 일관성을 위해 `buildWorkspaceHref` 에 `path.startsWith('/w/')` 방어 분기를 추가하는 재검토를 권장.

## 요약

가장 핵심적인 축 — "URL slug = FE 라우팅 SoT ≠ backend 인가 SoT" 계층 분리 및 `/docs`·`(auth)` 의 slug-밖 예외 — 는 이번 수정 계획이 그대로 존중하고 있으며, 명시적으로 기각된 대안(예: 과거 §859 에서 기각된 token-first 모델)을 재도입하는 부분은 없다(CRITICAL 없음). 다만 (a) catch-all 컴포넌트의 성격을 "redirect-only" 에서 "redirect ∪ notFound 종결"로 확장하면서 그 변화를 반영하는 Rationale/spec 갱신이 계획에 빠져 있고, (b) 저장소가 이미 한 번 "호출부 산재 → 구조적 제거" 패턴으로 처리한 것과 같은 계열의 버그임에도 `buildWorkspaceHref` 를 비-idempotent 상태로 남겨두는 결정에 근거가 기록돼 있지 않다. 두 항목 모두 기존 합의를 뒤집는 CRITICAL 위반이라기보다는, 새 결정에 대한 Rationale 문서화 누락(WARNING)에 해당한다.

## 위험도

LOW
