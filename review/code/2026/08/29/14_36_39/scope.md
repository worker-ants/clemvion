# 변경 범위(Scope) 리뷰 — spec-link 멀티라인 매칭 수정

대상 diff: `origin/main...HEAD` (branch `claude/spec-link-multiline`, commit `cb3a45ac0`) —
`codebase/frontend/src/lib/docs/__tests__/spec-links.ts`,
`codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts`,
`plan/in-progress/harness-review-gate-followups.md`. `git diff --stat origin/main...HEAD` 로
프롬프트에 실린 3파일·198(+)/16(-) 과 정확히 일치함을 확인(추가/누락 파일 없음).

## 발견사항

- **[INFO]** 워크트리 이름과 실제 작업 주제 불일치
  - 위치: 워크트리 경로 `.claude/worktrees/eslint10-upgrade-5e3cf9/` (파일 아님, 인프라 메타데이터)
  - 상세: 워크트리 슬러그는 `eslint10-upgrade` 지만 실제 커밋은 spec-link-integrity 가드의
    멀티라인 매칭 버그 수정(`claude/spec-link-multiline` 브랜치, plan 항목
    "`spec-link-integrity` 가 멀티라인 마크다운 링크를 통째로 못 본다")이다. 코드 diff 자체에는
    eslint10 관련 변경이 전혀 없다(설정 파일 변경 0건, `package.json`/`eslint.config.*` 미포함).
  - 제안: 코드 범위 자체는 결함이 아니므로 조치 불요. 다만 이 워크트리가 이후에도 재사용된다면
    다음 세션이 워크트리 이름만 보고 작업 내용을 오판하지 않도록 plan frontmatter 의 `worktree`
    필드(현재 `harness-review-ci-backstop-91f379`, 이 또한 stale)와의 정합을 점검할 가치는 있음.
    Scope 위반은 아니라 정보성으로만 남김.

## 항목별 점검

1. **의도 이상의 변경** — 없음. 세 파일 모두 "멀티라인 링크 미탐지" 단일 결함 수정에 직결됨:
   구현(`spec-links.ts`) · 회귀 테스트(`spec-links.test.ts`) · 완료 기록(plan 체크박스+해소 서술).
2. **불필요한 리팩토링** — `extractLinks()` 내부를 줄 단위 루프에서 마스킹-전문 매칭으로 바꾼 것은
   리팩토링이 아니라 결함 수정의 필수 구조 변경이다(줄 경계에서 끊기는 것 자체가 버그 원인).
   `cannotContainLink` 사전 필터, `LINK_RE` 선언 등 다른 함수는 로직이 그대로이고 인접 주석만
   갱신됨(아래 §5 참조).
3. **기능 확장(over-engineering)** — 없음. 추가된 이진탐색(`startOf`/`lo`/`hi`)은 "마스킹 줄 →
   원본 줄 번호" 역매핑이라는, 이번 수정이 반드시 지켜야 하는 요구사항(plan 의 "구현이 지켜야
   했던 세 가지" 항목 2)을 만족시키기 위한 수단이지 별도 기능 추가가 아니다.
4. **무관한 수정** — 없음. `git diff --stat` 상 3파일 외 변경 없음, 세 파일 모두 이 결함과
   직접 관련.
5. **포맷팅 변경** — 실질 변경과 섞인 무의미한 포맷팅 diff는 없음. `extractLinks` 위 주석이
   "라인 루프 전체가 낭비다" → "스캔 전체가 낭비다" 로 문구가 바뀐 것은 포맷팅이 아니라 구현이
   더 이상 순수 라인 루프가 아니게 된 사실을 반영한 의미 있는 수정.
6. **주석 변경** — 신규/변경 주석 다수(파일당 하나씩 긴 JSDoc/블록 주석)이지만 전부 "왜 이렇게
   고쳤는가"·"무엇을 지켜야 깨지는가"를 설명하며 이 저장소가 반복 채택해 온 근거-중심 주석
   컨벤션(MEMORY 의 "실측/뮤테이션 근거를 코드 옆에 남긴다" 패턴)과 일치한다. 불필요하거나
   무관한 주석 추가/삭제는 없음. 동일 근거가 구현·테스트·plan 세 곳에 거의 같은 문장으로
   반복되는 점은 다소 장황하나, 이 프로젝트가 요구하는 "plan 에 실측을 남긴다" 규약과 코드
   자체의 자기설명 규약이 겹친 결과이지 무관한 삽입이 아니다.
7. **임포트 변경** — 없음. 두 `.ts` 파일 모두 기존 import 문 변경 없음(테스트 파일도 동일 심볼만
   사용).
8. **설정 변경** — 없음. eslint/tsconfig/package.json 등 설정 파일은 diff 에 전혀 포함되지 않음.

## 요약

세 파일(구현·테스트·plan) 모두 "`extractLinks()` 가 멀티라인 마크다운 링크를 놓친다"는 단일
결함의 수정·검증·완료기록에 정확히 대응하며, 무관한 리팩토링·기능 확장·포맷팅·임포트·설정
변경은 발견되지 않았다. 유일한 특이사항은 워크트리 이름(`eslint10-upgrade`)과 실제 작업 주제의
불일치인데 이는 코드 diff 의 범위 문제가 아니라 인프라 메타데이터 수준의 관찰이라 INFO 로만
남긴다.

## 위험도

NONE
