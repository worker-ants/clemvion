# 변경 범위(Scope) 리뷰 — Gate C / plan-scan 추출

## 조사 방법

프롬프트가 세 파일을 "전체 파일 컨텍스트"로만 제공해 diff 경계가 불명확했다. `git diff
origin/main -- <파일>` 로 실제 변경분을 직접 대조했고, `plan/in-progress/docs-guard-walker-dedup.md`
(이 PR 이 스코프 밖으로 분리한 후속 작업 plan)를 읽어 "어디까지가 이 PR 의 의도된 범위인가"의
1차 증거로 삼았다.

## 발견사항

- **[INFO]** `plan-scan.ts` 추출이 Gate C(spec_impact) 좁은 의미를 넘어 `checkPlanFrontmatter`/
  `findFrontmatterViolations`/`TERMINAL_PLAN_STATUSES`/`WORKTREE_SENTINEL` 등 살아있는
  plan 의 frontmatter 검사·완료 plan 의 status 검사까지 포함한다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:130-322` (함수: `findNonTerminalCompletedPlans`, `checkPlanFrontmatter`, `findFrontmatterViolations`)
  - 상세: 이 로직은 원래 `plan-frontmatter.test.ts` 인라인 코드였다(리뷰 대상 3파일에는
    포함되지 않은 4번째 파일). 좁게 보면 "Gate C(spec_impact) PR" 범위를 넘는 리팩터로 보일
    수 있으나, 워크트리/작업명이 `plan-lifecycle-gates`(복수 "gates")이고 `git diff origin/main`
    으로 확인한 `plan-frontmatter.test.ts` 변경분이 실제로 `plan-scan.ts` 의 동일 함수를
    소비하도록 갱신돼 있어 — 즉 이 추출은 그 파일의 리팩터와 짝을 이루는 동일 PR 내 작업이다.
    또한 `docs-guard-walker-dedup.md`(같은 세션이 스코프 밖 항목을 분리해 적어둔 후속 plan)가
    "`plan-lifecycle-gates` 가 합친 것은 plan 계열 둘(live/complete)" 이라고 명시하며, 건드리지
    않은 나머지 두 walker(`spec-links.ts`)는 의도적으로 분리했다고 밝힌다. 스코프 경계를
    실측하고 문서화한 흔적이 뚜렷해 의도 이상의 변경으로 보기 어렵다.
  - 제안: 조치 불필요. 다만 이 리뷰 배치가 `plan-frontmatter.test.ts` 를 누락해 소비 측 변경을
    직접 볼 수 없었다는 점은 다음 라운드에서 함께 라우팅하는 편이 더 정확한 판정에 도움된다.

- **[INFO]** 코드 주석 안에서 이 PR 밖 파일(`.claude/docs/plan-lifecycle.md`)의 서술 정정을
  언급한다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:200-203` (`WORKTREE_PLACEHOLDER` 상수 JSDoc)
  - 상세: "SoT 본문에도 같은 낡은 근거가 남아 있어 함께 정정했다"는 문구가 있다. 즉 코드
    주석의 낡은 rationale(`plan_coherence` cross-worktree 충돌 검출, `#576`에서 이미 제거됨)을
    바로잡으며 SoT 문서도 같이 고쳤다고 명시한다. 이 문서 자체는 이번 리뷰 3파일에 없어
    직접 검증하지 못했지만, 코드 주석이 스스로 밝히고 있어 은폐된 의도 이상 변경은 아니다 —
    자신이 지금 고치는 함수의 근거가 이미 폐기된 사실을 발견해 정정한, 정합성 유지 목적의
    부수 수정으로 보인다.
  - 제안: 조치 불필요. 해당 문서 diff 가 실제로 근거 폐기 사실만 정정했는지(범위를 넘는
    서술 변경이 없는지)는 별도 라운드에서 `plan-lifecycle.md` 자체를 리뷰 대상에 포함하면
    확인 가능하다.

- **[INFO]** 세 파일 모두 실질 로직 변경마다 "실측"·"뮤테이션 실측"·"ai-review WARNING" 근거를
  단 JSDoc/인라인 주석이 매우 길다(예: `spec-plan-completion.test.ts:73-95`, `plan-scan.ts:104-120`).
  - 상세: 분량은 상당하지만 각 문단이 구체적 결함(예: `path.join(root, "")` → root 로 정규화,
    js-yaml 무효 날짜 롤오버, gray-matter 캐시 오염)과 그 결함을 찾은 방법(뮤테이션 생존)을
    설명하는 실질 rationale이며, 무관한 배경 설명이나 장식적 코멘트는 아니다. 이 저장소가
    최근 반복적으로 "판정 이중화"·"무관측 분기"에 데인 이력이 있어(git log 상 동일 세션에서
    10건 이상의 후속 fix 커밋) 그 맥락을 감안하면 과잉이라 보기 어렵다.
  - 제안: 조치 불필요.

## 요약

리뷰 대상 3파일(`spec-plan-completion.test.ts` 재작성, `plan-scan.ts`/`plan-scan.test.ts` 신설)은
전부 Gate C(`spec_impact`) 강제 로직의 fail-open 버그 수정과, 그 버그의 근본 원인이었던
"판정/수집 로직 중복(4벌 walker)" 해소에 집중돼 있다. `git diff origin/main` 대조 결과 포맷팅만
바뀐 hunk, 미사용 임포트, 설정 파일 변경, 목적 불명 리팩터는 발견되지 않았다. 추출 범위가
`plan-frontmatter.test.ts`(리뷰 밖 4번째 파일)까지 걸쳐 있으나 워크트리 이름·병행 diff·별도로
분리해 남긴 후속 plan 문서(`docs-guard-walker-dedup.md`)가 그 경계를 의도적으로 실측·문서화한
증거이며, 명시적으로 스코프 밖으로 판단한 부분(spec-links.ts 의 나머지 두 walker)은 실제로
건드리지 않고 별도 plan 으로 넘겼다. 스코프 관점에서 문제적 패턴은 확인되지 않았다.

## 위험도

NONE
