# 변경 범위(Scope) Review — rebase 후 재검토

대상 PR: 사용자 가이드(`/docs`) 사이드바 진입 시 `/w/<slug>` 무한 중첩 라우팅 fix
(`plan/complete/user-guide-routing-loop-fix.md`, worktree `manual-trigger-default-param-e0d395`)

**컨텍스트**: `_prompts/scope.md` payload 는 `review/consistency/2026/07/17/01_25_26/**` ·
`07_03_34/**` 산출물 13개 + `spec/2-navigation/*.md` 4개 + `spec/data-flow/12-workspace.md` 등
18개 파일만 담고 있어(전체 diff 68개 파일 중 payload 크기 상한으로 잘린 것으로 보임), 실제
스코프 판단은 `git log`/`git show --stat`/`git diff origin/main..HEAD` 로 8개 커밋 전체를
직접 실측해 보강했다.

## 직전 WARNING 재확인 (01_07_43 세션)

직전 scope 리뷰(`review/code/2026/07/17/01_07_43/scope.md`)는 다음 1건을 WARNING 으로 냈다:

> 이번 라우팅 버그 fix 와 무관한 파일(`plan/complete/ai-agent-tool-payload-budget-followups.md`)의
> frontmatter 수정(커밋 `89c4b1f6b`)이 같은 브랜치에 포함됨.

실측 결과 — **이 WARNING 은 rebase 로 자연 해소됨을 확인**:

- 현재 8개 커밋(`git log origin/main..HEAD`) 어디에도 `89c4b1f6b` 는 없다.
- `git cat-file -t 89c4b1f6b` 로 커밋 객체 자체는 여전히 존재하나, `git merge-base --is-ancestor
  89c4b1f6b origin/main`/`HEAD` 둘 다 `false` — 즉 dangling 상태로, 현재 브랜치·main 어느 쪽
  히스토리에도 reachable 하지 않다(원격 구 브랜치 ref 에만 잔존).
- `plan/complete/ai-agent-tool-payload-budget-followups.md` 파일 내용을 `git show
  origin/main:...`/`git show HEAD:...` 로 대조한 결과 **완전히 동일**(diff 없음) — 이 파일은
  이제 이번 브랜치의 diff 대상이 아니다.
- origin/main 쪽 이력(`git log origin/main -- plan/complete/ai-agent-tool-payload-budget-followups.md`)
  을 보면 `f8c334947`(#957, "in-progress grooming — 완료 3건 종결 + ... spec drift 정정")이
  동일한 Gate C 보정을 main 에서 독립적으로 수행했다. rebase 시 내용이 이미 main 에 존재하므로
  git 이 자동으로 중복 커밋(`89c4b1f6b`)을 drop 한 것이다.

즉 developer 가 이 파일을 별도로 되돌리거나 조치한 것이 아니라, rebase 메커니즘 자체가 "이미
동일 내용이 main 에 있으면 재적용하지 않는다"는 원리로 무관 변경을 걷어냈다 — 의도치 않은
부작용이 아니라 정확히 기대한 대로의 동작이다.

## Rebase 가 의도치 않은 변경을 끌어들였는지 점검

- **선형 히스토리 확인**: `git log --graph --oneline origin/main..HEAD` 결과 merge 커밋 없이
  8개가 순수 선형으로 얹혀 있다(`git log --merges origin/main..HEAD` 결과 없음).
- **충돌 잔재 없음**: `git status --short` 는 이번 리뷰 산출물 디렉터리(`review/code/.../08_17_35/`)
  외 아무것도 보고하지 않는다. `.orig`/`.rej` 등 충돌 마커 파일도 diff stat 에 없다.
- **main 신규 커밋과의 중복/충돌 없음**: `f8c334947`(#957) 이 건드린 파일(`.claude/test-stages.sh`,
  `PROJECT.md` 는 아님 — 이 두 파일은 본 브랜치의 `879393b27` 이 별도로 건드림)과 본 브랜치 8개
  커밋이 건드리는 파일 사이에 겹침이 없어 semantic 충돌 가능성도 없다.
- **필요한 것이 사라지지 않았는지**: 8개 커밋 각각을 `git show --stat` 로 실측한 결과, 라우팅
  fix 본체(`f066fead0`)·ai-review 반영(`18f821e3c`)·재리뷰(`a41929632`)·impl-done 검토
  (`593ff1cf2`)·plan complete 이동(`dcaa16f04`)·plan frontmatter 보정(`fee2d3934`)·spec 반영
  (`aa01cf4f0`) 모두 온전히 남아 있고 각 커밋의 diff 내용도 커밋 메시지가 서술하는 것과 정확히
  일치한다. 유실된 항목 없음.

## 새로 확인된 관찰 사항 (직전 세션 이후 추가된 커밋)

- **[INFO]** `879393b27`(e2e wrapper fix)이 공유 테스트 인프라 파일(`.claude/test-stages.sh`,
  `PROJECT.md`)을 변경 — 라우팅/네비게이션 도메인 밖이지만 인과관계가 명확
  - 위치: `.claude/test-stages.sh`(`cmd_e2e()` → `make e2e-test-full`), `PROJECT.md`(명령
    매트릭스·체크리스트 갱신)
  - 상세: 이 커밋은 01_07_43 scope 리뷰(01:07 시각) **이후**(07:03 시각) 추가된 것으로, 직전
    scope 리뷰 대상에 없었다. 내용은 "로컬 `run-test.sh e2e` 가 playwright 를 건너뛰어 본
    PR 의 회귀(사이드바 `/docs` 무한 중첩)가 로컬에서 검출되지 못했다"는 근본원인을 커밋
    메시지에서 직접 지목하고, 그 갭을 closing 하는 것이 목적이다. 즉 "이번 작업과 무관한
    drive-by 수정"이 아니라 **이번 PR 의 회귀가 실제로 발생한 원인(테스트 커버리지 갭) 자체를
    조치**한 것으로, 직전 세션이 WARNING 을 준 `ai-agent-tool-payload-budget-followups.md`
    케이스(완전히 다른 도메인, 인과관계 없음)와는 성격이 다르다.
  - 다만 여전히 "변경 범위" 관점에서는 파일 영역이 프로젝트 전역 테스트 wrapper·문서로,
    라우팅 버그 수정이라는 PR 표제와는 별개 관심사다. 별도 원자적 커밋으로 분리되어 있고
    diff 도 21줄(16+10, 일부 컨텍스트 겹침 라인 제외)로 작아 리뷰 난이도는 낮다.
  - 제안: 등급 상향 불요(WARNING 아님) — 인과관계가 커밋 메시지에 명시적으로 근거돼 있고
    CLAUDE.md 상 "기존 이슈 발견 시 조치" 관행에 부합한다. 다만 PR 설명/머지 노트에서 이
    변경이 "라우팅 fix 자체"가 아니라 "그 fix 로 드러난 테스트 커버리지 gap 의 조치"임을
    한 줄 언급해두면 향후 diff 스캔 시 혼동을 줄일 수 있다.

- 나머지 신규/기존 커밋(`fee2d3934`·`dcaa16f04`·`aa01cf4f0`)은 모두 이번 PR 자신이 생성한
  plan(`user-guide-routing-loop-fix.md`)·spec 위임 draft(`spec-update-catch-all-terminal-contract.md`)·
  review 산출물의 라이프사이클 처리(완료 표시·frontmatter 보정·project-planner 반영)로,
  전부 이번 작업 범위 내부다. 무관 파일 수정 없음.

## 관점별 점검 결과 (8개 커밋 전체 기준)

1. **의도 이상의 변경**: 직전 WARNING(무관 plan 파일)은 rebase 로 해소. 신규로는 e2e wrapper
   기반 확장(INFO, 위 상세)뿐 — 인과관계 있는 조치라 "의도 이상"으로 보기 어렵다.
2. **불필요한 리팩토링**: 없음. `sidebar.tsx` 재포맷은 필드 추가의 자연스러운 결과, `href.ts`
   상수화(`WORKSPACE_ROUTE_SEGMENT`)는 ai-review W#3 대응으로 정당화됨.
3. **기능 확장(over-engineering)**: 없음. `workspaceRootSlug` 처리·`notFound()` 종결 모두
   동일 결함 클래스 내 필수 대응.
4. **무관한 수정**: 이전 WARNING 대상 파일은 diff 에서 완전히 사라짐(rebase 로 자연 제거).
   e2e wrapper 변경은 무관하지 않고 인과관계가 명시됨(INFO 로만 기록).
5. **포맷팅 변경**: 실질 변경과 뒤섞인 무의미한 포맷팅 변경 없음.
6. **주석 변경**: `page.tsx`/`href.ts`/`test-stages.sh` 의 주석 보강 모두 설계 근거 기록 목적으로
   변경 의도와 직접 연관.
7. **임포트 변경**: 불필요한 임포트 추가/정리 없음(이전 세션과 동일 결론, 이번 라운드에 새
   코드 파일 변경 없음).
8. **설정 변경**: `PROJECT.md`(문서)·`.claude/test-stages.sh`(wrapper 스크립트) 변경은 위
   INFO 항목과 동일 — CI 설정(`.github/workflows/e2e.yml`) 자체는 변경 없음, 로컬 wrapper 를
   CI 커버리지에 맞춘 것뿐이다.

## 요약

직전 scope 리뷰(01_07_43)가 지적한 유일한 WARNING(무관 plan 파일 `ai-agent-tool-payload-
budget-followups.md` 의 Gate C frontmatter 보정이 섞임)은 rebase 로 자연 해소됨을 실측
확인했다 — main 이 `#957`(`f8c334947`)에서 동일 보정을 독립 수행했기 때문에 rebase 가 중복
커밋(`89c4b1f6b`)을 자동으로 drop 했고, 해당 파일은 이제 origin/main 과 HEAD 사이에서 완전히
동일해 diff 대상에서 빠졌다. rebase 히스토리 자체는 merge 커밋·충돌 잔재 없이 선형이며, 8개
커밋 각각을 재확인한 결과 유실되거나 의도치 않게 끌려온 것은 없다. 직전 세션 이후 새로 추가된
커밋 중 `879393b27`(e2e wrapper 가 로컬에서 playwright 를 건너뛰던 갭 해소)이 라우팅 도메인
밖(`​.claude/test-stages.sh`, `PROJECT.md`)을 건드리지만, 이는 본 PR 의 회귀가 실제로 그 갭
때문에 로컬에서 검출되지 못했다는 인과관계가 커밋 메시지에 명시돼 있어 무관한 drive-by 수정과는
성격이 다르다(INFO 로만 기록, WARNING 아님). 그 외 신규 커밋은 모두 본 PR 자신의 plan/spec
라이프사이클 처리 범위 내부다. 전체적으로 병합을 막을 CRITICAL/WARNING 급 범위(scope) 이탈은
없다.

## 위험도

LOW
