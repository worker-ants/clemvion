# 요구사항(Requirement) Review

## 발견사항

- **[WARNING] [SPEC-DRIFT] catch-all의 `/w/` 접두 terminal(404) 계약이 아직 spec 본문에 반영되지 않음**
  - 위치: `codebase/frontend/src/app/(main)/[...rest]/page.tsx` (신규 로직) vs `spec/2-navigation/_layout.md:85`, `spec/2-navigation/9-user-profile.md:155`
  - 상세: 두 spec 문장 모두 catch-all 을 "구 무-slug 경로를 활성 slug 로 흡수(redirect)"하는 존재로만 서술한다. 이번 구현은 `rest[0] === "w"` 인 경로에 대해 ① `/w/<slug>` 단독은 dashboard 로 forward, ② 그 외는 `notFound()` 로 종결 — 즉 "흡수만 한다"던 계약을 "흡수 ∪ terminal(404)" 로 실질적으로 확장한다. `11-error-empty-states.md §1.3`("존재하지 않는 라우트 접근 → 404")과는 모순되지 않고 오히려 그 정책을 준수하는 방향이라 코드가 옳다 — 다만 `_layout.md`/`9-user-profile.md` 본문이 이 확장을 아직 명시하지 않아 line-level 로는 불일치.
  - 근거: 무한 중첩 회귀(사용자 실보고)를 구조적으로 제거하기 위한 의도적·합리적 확장이며, 대안(strip 후 재-forward)은 ping-pong 무한루프를 유발한다는 근거가 plan 에 명시돼 있다. 코드가 틀린 게 아니라 spec 이 아직 못 따라간 케이스.
  - 조치 현황(참고): 이미 `plan/in-progress/spec-update-catch-all-terminal-contract.md` 에 project-planner 위임용 spec 보강 draft 가 작성돼 있고(제안 1·2·3, `_layout.md` §2.2 각주 및 `9-user-profile.md` §3 보정 문구까지 구체적으로 준비됨), `user-guide-routing-loop-fix.md` 체크리스트 항목 10 이 "project-planner 위임"으로 남아 대기 중이다. 즉 팀이 이미 인지하고 정식 경로로 처리 중인 drift.
  - 제안: 코드는 유지. `project-planner` 가 draft 의 제안 1(`_layout.md:85` 각주 보강)·제안 2(`9-user-profile.md:155` 문장 보정)를 spec 본문에 반영하고 `_layout.md` frontmatter `code:` 에 `(main)/[...rest]/page.tsx` 글로브 포함 여부를 확인해야 완결된다 (draft 자체는 이미 존재하므로 실행만 남음).

- **[INFO] `/w/<slug>` 단독 forward 시 slug 유효성(멤버십)을 검증하지 않음 — 의도된 설계**
  - 위치: `codebase/frontend/src/app/(main)/[...rest]/page.tsx:392-397` (`workspaceRootSlug` 분기)
  - 상세: URL 의 `rest[1]` 을 그대로 `buildWorkspaceHref(workspaceRootSlug, "/dashboard")` 에 전달하며, 그 slug 가 실제 워크스페이스 목록에 존재하는지 확인하지 않는다. 다만 이는 결함이 아니라 설계다 — forward 대상(`/w/<slug>/dashboard`)은 `(main)/w/[slug]/dashboard` 라는 구체 라우트로 매칭되므로 catch-all 재진입(무한루프)이 없고, slug 무효 시의 처리는 `[slug]` layout 의 `WorkspaceSlugGate`(spec `11-error-empty-states.md:70`, "무효/비멤버 slug → 404 아님, default 워크스페이스로 FE 레벨 편의 redirect")가 이미 담당하는 계층이다. 코드 주석("URL 의 slug 를 존중")과 실제 동작이 일치하며 spec 과도 모순 없음. 결함 아님 — 정보 제공 목적으로만 기록.

- **[INFO] TODO/FIXME/HACK/XXX 없음**
  - 위치: 변경된 6개 코드 파일 전체
  - 상세: 미완성 작업을 시사하는 주석이 없다. `plan/in-progress/user-guide-routing-loop-fix.md` 의 체크리스트 항목 9(REVIEW WORKFLOW)·10(spec 보강 위임)이 미체크 상태지만, 이는 정확히 본 리뷰가 수행 중인 절차와 project-planner 로 정식 위임된 후속 작업이라 "미완성 은폐"가 아니라 정직한 진행상태 표기다.

## 점검 관점별 요약

1. **기능 완전성**: 버그의 2단 근본원인(① 사이드바가 `/docs`에도 무조건 slug 부착, ② catch-all 이 이미 `/w/`인 경로에 slug 재부착) 모두 조치됨. `workspaceScoped` 플래그로 ①을, catch-all terminal 가드로 ②를 제거해 재발 방지 구조까지 마련(사이드바 외 다른 소비처가 같은 실수를 해도 catch-all 이 무한루프 대신 404로 종결).
2. **엣지 케이스**: `rest` 미배열(`Array.isArray` 가드)·`rest=[]`·`rest=["w"]`(길이 1)·`rest=["w","<slug>"]`(길이 2)·`rest=["w","<slug>","docs"]`(길이 3)·이중중첩(`["w","a","w","a","docs"]`)·`web-chat`(‘w’ 로 시작하지만 세그먼트 불일치) 전부 unit/e2e 로 커버됨. 세그먼트 단위 비교(`rest[0]==="w"`)라 prefix 매칭 오탐(`/web-chat`)이 없음을 실측 검증.
3. **TODO/FIXME**: 없음 (위 발견사항 참조).
4. **의도-구현 괴리**: 기존 docstring 의 반증된 전제("specific route 가 우선하므로 `/w/[slug]/...` 는 여기 오지 않는다")를 이번 diff 가 정확히 정정. 신규 주석(terminal 규칙·ping-pong 비채택 근거·notFound render-time 호출 이유)이 실제 구현과 라인 단위로 부합.
5. **에러 시나리오**: `notFound()` 를 훅 순서를 깨지 않도록 모든 훅 뒤·render 중(≠effect) 호출 — Next.js 요구사항과 일치하며 주석에도 명시. 단위테스트에서 `mockNotFound` 로 throw 를 재현해 render 자체가 throw 하는 것까지 검증.
6. **데이터 유효성**: `useParams` 결과의 `rest` 가 배열이 아닐 수 있는 경우를 `Array.isArray` 로 방어. slug 문자열 자체의 sanitize 는 `buildWorkspaceHref` 내부 `toSafeInternalPath` 가 처리(open-redirect 방어, 기존 로직 불변).
7. **비즈니스 로직**: `spec/2-navigation/_layout.md:83,85` 및 `9-user-profile.md:158` 의 "`/docs` 는 워크스페이스 무관 콘텐츠라 slug 밖 유지" 규칙이 `workspaceScoped: false` 로 정확히, 그리고 유일한 예외로 반영됨(다른 12개 항목은 전부 `true`).
8. **반환값**: `WorkspaceRedirect` 컴포넌트는 모든 렌더 경로에서 JSX(로딩 스피너) 반환 또는 `notFound()` throw 로 명확히 종결 — 반환값 누락 경로 없음.
9. **spec fidelity**: 핵심 예외 규칙(`/docs` slug 밖 유지)·URL=FE 라우팅 SoT·query/hash 보존 등은 spec 본문과 line-level 로 일치. 유일한 불일치는 위 SPEC-DRIFT 항목(terminal 404 계약의 spec 미반영)이며, 이는 코드 결함이 아니라 이미 project-planner 위임 draft 가 준비된 spec 갱신 대기 상태다.

## 요약

이번 diff 는 사용자가 보고한 "/docs 진입 시 `/w/<slug>` 무한 중첩" 버그의 두 근본 원인(사이드바의 무조건적 slug 부착, catch-all 의 재부착 가드 부재)을 정확히 겨냥해 조치했으며, `workspaceScoped` 데이터 플래그와 catch-all terminal 규칙이 서로 보완해 이 결함 클래스 자체를 구조적으로 제거한다. 단위테스트(17/17 실측 통과 확인)·신규 e2e 5건이 useParams mock 으로 증명 못하는 실제 Next 라우트 매칭·`notFound()` 실동작까지 커버하며, 관련 spec(`_layout.md` §2.2, `9-user-profile.md` §3, `11-error-empty-states.md` §1.3)과의 핵심 규칙 일치도 확인했다. 유일한 발견사항은 catch-all 의 확장된 terminal(404) 계약이 spec 본문에 아직 명문화되지 않은 SPEC-DRIFT 인데, 이는 코드가 아니라 spec 이 뒤처진 경우이고 이미 project-planner 위임용 구체적 draft(`spec-update-catch-all-terminal-contract.md`)가 준비돼 실행만 남아 있어 실질 리스크는 낮다. plan 내 무관 파일(`plan/complete/ai-agent-tool-payload-budget-followups.md`)의 Gate C frontmatter 보정도 `git show` 로 대조해 정확함을 확인했다.

## 위험도

LOW
