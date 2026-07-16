# 신규 식별자 충돌 검토 결과

## 검토 대상 정정 안내

`prompt_file` 의 "Target 문서 경로" 필드가 orchestrator 작성 오류로 손상되어 있다(설명 문자열 전체가
파일 경로 자리에 그대로 삽입됨, `구현 대상 영역` 블록은 `(없음)`). 또한 첨부된 "검색 대상 코퍼스"
에는 정작 target 이 참조하는 `spec/2-navigation/_layout.md` · `spec/2-navigation/9-user-profile.md`
실제 본문이 포함되지 않았다.

이에 따라 프롬프트에 기술된 scope 설명과 실제 저장소 상태(다음 파일들)를 직접 대조해 분석했다:
- `plan/in-progress/user-guide-routing-loop-fix.md` (실질적 target 문서)
- `spec/2-navigation/_layout.md` (§2.2, L85 부근)
- `spec/2-navigation/9-user-profile.md` (§3, L155-158 부근)
- `codebase/frontend/src/components/layout/sidebar.tsx`
- `codebase/frontend/src/app/(main)/[...rest]/page.tsx`
- `codebase/frontend/src/lib/workspace/href.ts`

target 은 **순수 버그 수정**이다 — plan 문서가 명시하듯 "spec 변경 불요, 구현만 spec 에 맞춘다"
(`plan/in-progress/user-guide-routing-loop-fix.md:34`). 신규 요구사항 ID, 신규 엔티티/DTO, 신규 API
endpoint, 신규 이벤트/메시지, 신규 ENV/config key, 신규 spec 파일은 전혀 도입되지 않는다. 유일한
신규 식별자는 코드 레벨 플래그 `workspaceScoped` (navItems 배열의 새 필드) 하나다.

## 점검 관점별 결과

### 1. 요구사항 ID 충돌 — 해당 없음
target 은 신규 요구사항 ID(`NAV-*` 등)를 부여하지 않는다. 기존 `_layout.md:85` / `9-user-profile.md:158`
의 "User Guide(`/docs`)는 워크스페이스 무관 콘텐츠라 slug 밖으로 유지" 규정을 그대로 구현에 반영할 뿐이다.

### 2. 엔티티/타입명 충돌 — 없음 (신규 식별자 `workspaceScoped` 검증 완료)
- target 신규 식별자: `workspaceScoped` (boolean 플래그, `sidebar.tsx` 의 `navItems` 배열 각 항목에 추가 예정)
- 검증: `grep -rn "workspaceScoped|workspace_scoped|WorkspaceScoped" codebase spec plan` 결과 plan 문서 자신(1건) 외 매치 없음. `codebase/frontend/src` 전체에서 유사 개념으로 이미 쓰이는 이름(`bare`, `unscoped`, `exempt` 계열)을 확인했으나 전부 다른 도메인(`ExpressionInput` 의 `bare` prop 은 UI 테두리 유무, 무관)이라 문자열 자체의 충돌은 없음.
- 결론: 신규 도입 이름이며 기존 사용처와 겹치지 않는다. 충돌 없음.

### 3. API endpoint 충돌 — 해당 없음
target 은 프론트엔드 라우팅(사이드바 href 생성, Next.js catch-all `page.tsx`)만 변경한다. 신규
REST endpoint 를 추가/재정의하지 않는다.

### 4. 이벤트/메시지명 충돌 — 해당 없음
webhook·queue·SSE 이벤트를 다루지 않는 변경이다.

### 5. 환경변수·설정키 충돌 — 해당 없음
신규 ENV var / config key 없음.

### 6. 파일 경로 충돌 — 해당 없음
- 신규 spec 파일 없음(plan 이 명시적으로 spec 변경 불필요라 판단).
- 신규 코드 파일도 없음 — 기존 `codebase/frontend/src/components/layout/sidebar.tsx` 와
  `codebase/frontend/src/app/(main)/[...rest]/page.tsx` 두 파일만 수정 대상이다.
- 부수적으로 검토한 "`/w/<slug>` 단독 접근 시 dashboard forward" 항목도 신규 `page.tsx` 파일을
  추가하는 것이 아니라 기존 catch-all 내부 로직으로 처리하는 설계라 파일 경로 신규 도입이 없다
  (`(main)/w/[slug]/page.tsx` 는 현재도 존재하지 않고, 이번 target 에서도 생성 계획이 없음 — 이는
  identifier 충돌이 아닌 별도 완결성 이슈이므로 본 리뷰 범위 밖으로 별도 언급만 한다).

## 발견사항

없음 — CRITICAL/WARNING/INFO 등급에 해당하는 신규 식별자 충돌을 발견하지 못했다.

## 요약

target 은 사용자 가이드(`/docs`) 진입 시 발생하는 `/w/<slug>` 무한 중첩 라우팅 버그를 기존 spec
규정(`_layout.md §2.2`, `9-user-profile.md §3`)에 맞춰 구현만 정렬하는 순수 버그 픽스다. 신규
요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV/config key·spec 파일 경로가 전혀 도입되지 않으며,
유일한 신규 식별자인 코드 레벨 플래그 `workspaceScoped` 는 저장소 전체(`codebase/`, `spec/`, `plan/`)
검색 결과 기존 사용처와 겹치지 않는 고유한 이름임을 확인했다. 다만 orchestrator 가 전달한
`prompt_file` 의 target 경로 필드가 손상돼 있고 참조 corpus 에 실제 대상 spec 파일 본문이 누락돼
있었다는 점은 이 checker 실행의 입력 품질 이슈로 별도 보고할 가치가 있다(분석 결과 자체에는 영향 없음
— 저장소를 직접 조회해 보완했다).

## 위험도

NONE
