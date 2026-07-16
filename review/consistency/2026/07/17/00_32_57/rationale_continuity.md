# Rationale 연속성 검토 결과

> **범위 노트**: 본 세션의 `prompt_file` "target 문서"는 `spec/2-navigation/` 하위 8개 파일 원문
> (`0-dashboard.md`/`1-workflow-list.md`/`10-auth-flow.md`/`11-error-empty-states.md`/
> `13-user-guide.md`/`14-execution-history.md`/`15-system-status.md`/`16-agent-memory.md`)만
> 포함하고, 실제 이번 작업의 핵심 근거 문서인 `_layout.md`·`9-user-profile.md`는 페이로드에서
> 누락되어 있었다(파일시스템에는 존재). 이전 세션(00_21_55)의 "payload 조립 오류" 재발로 보인다.
> 실제 변경 대상인 `plan/in-progress/user-guide-routing-loop-fix.md`(developer 작성, 구현 미착수)를
> target 결정으로 간주하고, 누락된 `_layout.md`·`9-user-profile.md`·`spec/data-flow/12-workspace.md`
> 를 직접 Read 하여 대조했다. 이하 분석은 그 plan 의 결정 사항 대상이다.

## 검토 대상 결정 요약 (plan)

1. `sidebar.tsx`에 `workspaceScoped` 플래그 도입 — `/docs`는 bare href.
2. `(main)/[...rest]/page.tsx` catch-all을 terminal화: `rest[0]==='w'`이면 재-prefix 금지.
   `/w/<slug>` 단독(length 2)은 `/w/<slug>/dashboard`로 forward, 그 외(`/w`, `/w/<slug>/<미지경로>`)는 `notFound()`.
3. `buildWorkspaceHref` idempotent화는 미채택(call-site 패치로 한정).
4. 이전 세션(00_21_55) WARNING #2·#3에 대한 재검토·대응을 plan 본문에 명시적으로 기록.

## 발견사항

- **[INFO]** `workspaceScoped`(`/docs` bare href) 도입은 기존 spec 재확인 — 위반 아님
  - target 위치: plan "① 진입점" / 결정 항목 1
  - 과거 결정 출처: `spec/2-navigation/_layout.md:85`("예외 — User Guide(`/docs`)는 워크스페이스 무관 콘텐츠라 slug 밖으로 유지"), `spec/2-navigation/9-user-profile.md:158`("slug 밖 유지... 유저 가이드(`/docs`)"), `spec/data-flow/12-workspace.md` Rationale "URL slug = FE 라우팅 SoT" 항의 "slug 없는 라우트(docs·catch-all)에서는 종전대로 localStorage 힌트 기준"
  - 상세: 세 위치 모두 `/docs`가 워크스페이스 slug 스코프 밖에 있어야 한다고 이미 명시적으로 합의돼 있다. 실측 코드(`sidebar.tsx:441-442`)는 이 합의를 어기고 모든 `navItems`에 무조건 `buildWorkspaceHref`를 적용해 `/w/<slug>/docs`를 생성하는 버그 상태였다(`441: const href = buildWorkspaceHref(slug, item.href)` — 예외 분기 없음, 442 주석만 "slug 밖 라우트(docs 등)"를 언급하고 `isActive` 판정에만 반영). `workspaceScoped` 플래그로 `/docs`를 bare href 처리하는 것은 결정의 재도입/번복이 아니라 이미 합의된 결정을 코드에 되살리는 정합화다.
  - 제안: 그대로 진행. 체크리스트 항목 I#5(`(main)/[...rest]/page.tsx:15` docstring "specific route 가 우선하므로 `/w/[slug]/...`는 여기 오지 않는다" 정정)를 실제 구현 커밋에 반드시 포함할 것 — plan에 이미 반영돼 있음.

- **[INFO]** catch-all terminal화(notFound 이원화)는 재검토 결과 기존 정책과 정합 — 이전 WARNING 하향
  - target 위치: plan "결정" §2 / "consistency-check WARNING 대응" W#2
  - 과거 결정 출처: `spec/2-navigation/11-error-empty-states.md` §1.3("404 감지 = 존재하지 않는 라우트 접근 시 표시", "사이드바 표시: 404 표시") 및 `## Rationale`("에러 페이지 감지 메커니즘 — Next.js 에러 바운더리"); 대비: `10-auth-flow.md:848`("...redirect-only 중간 경로라 flash 허용", 본문 서술, `## Rationale` 아님)
  - 상세: 이전 세션(00_21_55)은 이 변경을 "새 Rationale 없는 catch-all 성격 확장"으로 WARNING 처리했다. plan은 이를 재검토해 "404 정책은 이미 `11-error-empty-states.md`가 규정한 기존 합의이고, 현재의 무한 리다이렉트가 오히려 그 정책 위반"이라고 결론지었다 — 타당하다. `10-auth-flow.md:848`의 "redirect-only"는 로그인 후 `/dashboard` 이동 경로에 한정된 괄호 설명이며, 그 경로(rest[0]≠'w')는 이번 수정 후에도 여전히 redirect-only로 남아 반증되지 않는다. 다만 catch-all 컴포넌트 자체의 책임 범위(`/w/`-prefixed 미매치 경로에 대한 notFound 분기)가 넓어지는 것은 사실이며, plan은 이를 `plan/in-progress/spec-update-catch-all-terminal-contract.md`(project-planner 위임)로 별도 추적하기로 결정했다 — "결정의 무근거 번복" 우려에 대한 정석적 대응(새 spec 갱신을 정식 후속 항목으로 명시)이다.
  - 상태: 해당 draft plan 파일은 아직 생성되지 않았고(파일시스템 미확인), 체크리스트 항목 10도 미완료 상태 — 구현 단계 전이므로 정상. BLOCK 사유 아님.
  - 제안: 본 PR(구현) 병합 전 또는 직후, checklist 항목 10(spec 보강 draft → project-planner 위임)을 실제로 수행해 `_layout.md §2.2` 각주 또는 `data-flow/12-workspace.md` Rationale에 새 sub-Rationale을 추가할 것. 그 전까지는 `10-auth-flow.md`의 "redirect-only" 서술이 catch-all 전체를 설명하는 문구가 아니라 특정 흐름 한정임을 명확히 하는 각주를 구현 커밋에 남기면 spec-vs-code drift 재발을 막을 수 있다.

- **[INFO]** `buildWorkspaceHref` 비-idempotent 유지 — 근거가 plan에 기록되어 저장소 관행과의 긴장 해소
  - target 위치: plan "consistency-check WARNING 대응" W#3
  - 과거 결정 출처: `codebase/frontend/src/lib/workspace/href.ts`의 `buildExecutionHref`/`buildEditorHref` 문서 주석("리터럴이 여러 소비처에 흩어져 한 곳이 slug 를 빠뜨리는 회귀가 있었다(PR #865)... 경로 조립을 단일화해 그 클래스를 구조적으로 제거한다") + `no-raw-execution-href.test.ts`/`no-raw-editor-href.test.ts` guard
  - 상세: 이전 세션은 "이번 버그가 저장소가 이미 '호출부 산재 → 구조적 제거'로 처리한 것과 같은 계열인데, 헬퍼 자체를 idempotent하게 만들지 않는 이유가 기록되지 않았다"고 WARNING 처리했다. plan은 이제 "기존 관행(`no-raw-*-href` guard)은 호출부가 리터럴을 직접 조립하는 것을 막는 가드지 헬퍼의 idempotency를 요구하는 관행이 아니며, 본 건은 호출부가 헬퍼를 쓰되 대상이 slug 밖 라우트인 경우"라고 구분해 근거를 남겼다 — 타당한 구분이며, `team-a`/`team-b` 같은 모호한 idempotent 시맨틱 문제도 함께 지적해 견고하다. 이 근거는 실제 코드 docstring(`href.ts`)에 아직 반영되지 않았으나, 이는 구현 단계(checklist #6) 소관이라 impl-prep 시점 정상.
  - 제안: 구현 시 `href.ts`의 `buildWorkspaceHref` 문서 주석에 plan의 이 구분 근거를 그대로 옮겨 남길 것(현재 docstring은 `/w/`-prefixed 입력에 대한 동작을 언급하지 않음 — 실측 확인).

- **[INFO]** 신규 terminal 분기의 query/hash 보존 여부가 plan에 명시되지 않음
  - target 위치: plan "결정" §2 (catch-all `rest[0]==='w'` 분기 상세)
  - 과거 결정 출처: `spec/2-navigation/9-user-profile.md:155`("구 무-slug 경로·알림 딥링크·`/`는 `(main)/[...rest]` catch-all 이 활성 slug 로 흡수한다(**query/hash 보존**)") — 본문 서술이나 FE 라우팅 SoT 원칙에 직결
  - 상세: 실측 `(main)/[...rest]/page.tsx:36-38`은 현재 이미 `window.location.search`/`hash`를 보존해 `router.replace`한다. plan의 신규 분기(`rest.length===2` → `/w/<slug>/dashboard` forward, 그 외 → `notFound()`)가 이 기존 query/hash 보존 패턴을 그대로 재사용하는지 plan 문서에 명시가 없다 — `notFound()` 분기는 애초에 query/hash 개념이 무의미하지만, `/w/<slug>` → `/w/<slug>/dashboard` forward 분기는 기존 패턴(예: `?foo=bar` 보존)을 깨뜨리면 암묵적 invariant 위반이 된다.
  - 제안: 구현 시 `/w/<slug>` → `/w/<slug>/dashboard` forward에도 기존 query/hash 보존 로직을 재사용할 것을 테스트 케이스(checklist #5)에 명시적으로 포함.

## 요약

plan의 핵심 축 — `/docs`·`(auth)`의 slug-밖 예외, "URL slug = FE 라우팅 SoT ≠ backend 인가 SoT" 계층 분리, token-first 모델의 기각 상태 — 는 그대로 존중되고 있으며, 명시적으로 기각된 대안을 이유 없이 재도입하는 부분은 없다. 이전 세션(00_21_55)이 지적한 두 WARNING(catch-all 성격 확장의 Rationale 부재, `buildWorkspaceHref` 비-idempotent 근거 부재)은 이번 plan 개정에서 재검토·근거 기록·후속 spec 갱신 추적(`spec-update-catch-all-terminal-contract.md` 위임)으로 적절히 대응되어 CRITICAL/WARNING 없이 INFO로 하향된다. 다만 (a) 그 spec 보강 draft가 아직 실제로 작성되지 않았으므로 구현 완료 전후로 반드시 project-planner 위임을 실행해야 하고, (b) 신규 catch-all forward 분기가 기존 query/hash 보존 invariant를 유지하는지 테스트로 확인할 것을 권고한다. 구현 착수를 막을 사유는 없다(BLOCK: NO에 부합).

## 위험도

LOW
