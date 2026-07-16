# Cross-Spec 일관성 검토 — cross_spec

## 발견사항

- **[WARNING]** payload 자체가 손상되어 있음 (target 문서 미특정)
  - target 위치: prompt_file `## Target 문서` 섹션 전체 (`경로:` 필드 및 코드블록)
  - 충돌 대상: 없음 (payload 구조 문제)
  - 상세: `경로:` 값이 실제 spec 파일 경로가 아니라 `--impl-prep` 의 `scope=` 파라미터 값과 버그 설명·수정 계획 전체 텍스트("사용자 가이드(/docs) 사이드바 링크가 buildWorkspaceHref 로... 관련 spec: spec/2-navigation/_layout.md:85, spec/2-navigation/9-user-profile.md:155-158")가 통째로 이어붙여져 있다. `## 구현 대상 영역` 코드블록도 동일하게 오염되어 있고, 실제 target 본문은 `(없음)` 으로 비어 있다. 즉 orchestrator 가 "scope 설명" 을 "target 문서 경로" 필드에 잘못 주입한 것으로 보인다 — 이 항목은 spec 간 모순이 아니라 **호출 규약 위반**(prompt 구성 버그)이다.
  - 제안: orchestrator(호출자) 측에서 `scope=` 값과 target 문서 경로를 분리해 재생성 후 재호출 권장. 본 세션에서는 payload 안에 명시된 두 참조 위치(`spec/2-navigation/_layout.md:85`, `spec/2-navigation/9-user-profile.md:155-158`)를 target 후보로 간주해 best-effort 로 대체 분석함 (아래 항목).

- **[INFO]** best-effort 분석: 기술된 라우팅 수정 계획은 기존 spec 과 상충하지 않음
  - target 위치: (추정) `spec/2-navigation/_layout.md:85`, `spec/2-navigation/9-user-profile.md:155-158` — 실제로는 spec 변경이 아니라 `codebase/frontend` 라우팅 버그 수정 계획으로 보임(sidebar.tsx, `(main)/[...rest]/page.tsx`)
  - 충돌 대상: `spec/2-navigation/_layout.md` §2.2 각주(85행), `spec/2-navigation/9-user-profile.md` §3(155~158행), `spec/data-flow/12-workspace.md` "URL slug = FE 라우팅 SoT" 절
  - 상세: 세 문서 모두 "User Guide(`/docs`)는 워크스페이스 무관 콘텐츠라 slug 밖으로 유지한다" / "slug 없는 라우트(docs·catch-all)에서는 종전대로 localStorage 힌트 기준" 이라고 이미 명시하고 있다. 즉 계획 (1) "`/docs` 는 `buildWorkspaceHref` 대신 bare href 사용" 은 **기존 spec 이 이미 요구하는 동작과 일치**하며, 현재 구현(사이드바가 모든 링크에 `buildWorkspaceHref` 적용)이 spec 을 어긴 버그였던 것으로 보인다 — 이번 수정은 spec 신설이 아니라 기존 spec 준수로의 정합화다. 계획 (2) "`(main)/[...rest]` catch-all 을 terminal 화(`rest[0]=='w'` 시 재-prefix 금지, bare `/w/<slug>` 는 dashboard forward, 그 외 `notFound()`)" 역시 spec 이 문서화한 catch-all 의 역할("구 무-slug 경로를 활성 slug 로 흡수")과 겹치지 않는 새로운 케이스(이미 `w/` prefix 가 붙은 경로)만 다루므로 기존 문서화된 흡수 동작(예: `/integrations`, `/profile`, `/workflows/<id>`, `10-auth-flow.md:443` 의 `/dashboard` 기본 리다이렉트, `href.ts` deep-link 등 — 모두 `rest[0] != 'w'`)과 모순되지 않는다. `/w/<slug>` 단독 경로에 대한 명시적 스펙(무엇으로 forward 해야 하는가)은 존재하지 않아 이번 계획이 사실상 그 공백을 채우는 것으로 보이며, dashboard forward 는 spec 상 상충되는 대안 규정이 없다.
  - 제안: 계획대로 구현 시 spec 본문 수정은 불필요해 보이나(이미 일치), `(main)/[...rest]` 의 "terminal" 동작(특히 `rest[0]=='w'` 이고 `/w/<slug>` 단독이 아닌 경우 `notFound()`)은 현재 `spec/2-navigation/_layout.md:85` / `9-user-profile.md:155-158` / `data-flow/12-workspace.md` 어디에도 명시돼 있지 않다. `developer` 가 구현 완료 후, 이 신규 terminal 규칙을 한 문장으로 위 spec 중 한 곳(예: `_layout.md §2.2` 각주 또는 `data-flow/12-workspace.md` "URL slug = FE 라우팅 SoT" 절)에 반영해 두면 향후 동일 회귀(사이드바가 다시 `buildWorkspaceHref` 로 `/docs` 를 감싸는 등)를 spec 레벨에서도 방지할 수 있다. 이는 CRITICAL/WARNING 이 아니라 문서 동기화 권장 수준.

## 요약

이번 호출의 payload 는 target 문서 경로 필드에 orchestrator scope 설명 전체가 잘못 이어붙여져 있어 정상적인 "target 문서 vs 다른 spec 영역" 비교가 불가능했다(WARNING, 호출 규약 위반). Best-effort 로 payload 안에 언급된 실제 참조 위치(`spec/2-navigation/_layout.md:85`, `spec/2-navigation/9-user-profile.md:155-158`)와 관련 `data-flow/12-workspace.md` 를 대조한 결과, 설명된 라우팅 버그 수정 계획(사이드바 `/docs` bare href화 + `[...rest]` catch-all terminal화)은 기존 spec 문구와 상충하지 않으며 오히려 기존에 이미 명시된 "docs 는 slug 밖 유지" 요구사항을 구현이 위반했던 것을 바로잡는 방향이다. Cross-spec 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 직접 모순은 발견되지 않았다.

## 위험도
LOW
