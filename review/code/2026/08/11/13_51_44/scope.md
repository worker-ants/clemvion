# 변경 범위(Scope) Review

## 검증 방법

`plan/in-progress/docs-guard-walker-dedup.md` 의 13개 체크 항목을 diff 와 대조하고, 두 개의
"실측" 주장(walker 6벌 정정, Gate C 함수 외부 소비처 0건)은 프롬프트 텍스트만으로 판단하지
않고 직접 재현했다:

- `git diff da078a63f..bf0dfc98c --stat` 로 변경 파일 목록이 프롬프트가 제시한 11개와 정확히
  일치함을 확인(그 외 파일 변경 없음 — da078a63f 는 이 PR 브랜치의 부모 커밋).
- base 커밋(`da078a63f`)에서 `codebase/frontend/src/lib/docs/__tests__/*.ts` 전체를
  `grep -n readdirSync` 로 재현.
- `isGateCEnforced`/`hasMalformedStarted`/`hasValidSpecImpact`/`findDanglingSpecImpact`/
  `makeSpecExists`/`GATE_C_CUTOFF`/`NONE_VALUES` 를 `codebase/`·`.claude/` 전역에서
  `grep -rl` 로 소비처 재현.
- `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts` 전문을 직접 `Read`(프롬프트에는
  용량 제한으로 미포함).

## 발견사항

- **[WARNING]** 13/13 체크 완료 선언에도 plan 이 `plan/complete/` 로 이동되지 않았고
  frontmatter `status` 도 종료 어휘로 갱신되지 않음
  - 위치: `plan/in-progress/docs-guard-walker-dedup.md:6` (frontmatter `status: in-progress`),
    `plan/in-progress/docs-guard-walker-dedup.md:143` (`## 완료 (2026-08-11, ...)` 절 시작)
  - 상세: `grep -c '\- \[x\]'` 로 13, 잔여 `- [ ]` 는 0건임을 직접 확인했다 — "13개 항목 전부
    처리" 선언은 사실이다. 그런데 `.claude/docs/plan-lifecycle.md §3` 은 "이동은 마지막 작업
    PR 안에서: 모든 체크박스 `[x]` + 미해결 follow-up 0건이 되는 PR 안에
    `chore(plan): mark <name> complete` 형태의 별 commit 으로. **plan 이동만 담은 별 PR 분리
    금지 (PR 증식 + 이동 누락 패턴 차단)**" 라고 명시한다. 이 PR 은 정확히 그 조건(전항목
    `[x]`, plan 본문에 새 follow-up 미기재)을 만족하는데도 `git mv` 이동 커밋이 없다.
    push gate(`guard_review_before_push.py`)는 "연결 plan 이 **같은 경로로 수정**됐으면" 통과
    조건을 만족하므로(이 PR 은 실제로 방대히 수정했다) 이 누락을 막지 못했고, Stop 훅
    nudge 는 비차단이라 그대로 커밋된 것으로 보인다. `spec_impact: none` 은 이미 선언돼 있어
    Gate C 자체는 통과하지만, "이동" 이라는 별도 행위가 빠졌다.
  - 제안: 같은 PR 에 `git mv plan/in-progress/docs-guard-walker-dedup.md
    plan/complete/docs-guard-walker-dedup.md` + `status` 를 종료 어휘(`complete` 등)로 갱신하는
    커밋을 추가하거나, 의도적으로 이번 PR 에서 미룬다면 그 사유를 plan 본문에 명시할 것.

- **[INFO]** plan 제목이 정정 전 "3벌" 표현을 그대로 유지
  - 위치: `plan/in-progress/docs-guard-walker-dedup.md:2`
  - 상세: 본문 §"대상"(`:23`)은 "walker 3벌 → **실측 6벌** (2026-08-11 정정)" 으로 스스로
    교정했지만, frontmatter `title` 은 "...walker **3벌** 통합 판정..." 그대로다. 실질 영향은
    없으나 정정 취지와 표면적으로 어긋난다.
  - 제안: 제목도 "6벌"로 맞추거나 원제를 역사적 표기로 남긴다는 각주를 단다(선택 사항).

- **[INFO]** `.claude/docs/plan-lifecycle.md` 수정은 범위 내로 확인됨 — 무관한 규칙 변경 없음
  - 위치: `.claude/docs/plan-lifecycle.md:131-132`
  - 상세: diff 는 Gate C 판정 함수 소재지 서술 1문장 교정 + 이력 각주 1줄 추가뿐이다
    (`git diff --stat` 상 `+2/-1`). `isGateCEnforced`·`hasMalformedStarted`·
    `hasValidSpecImpact`·`findDanglingSpecImpact`·`makeSpecExists`·`GATE_C_CUTOFF`·
    `NONE_VALUES` 를 `codebase/` 전역에서 `grep -rl` 했을 때 `plan-scan.ts`/
    `spec-plan-completion.test.ts` 밖의 실제 소비처는 0건(주석 1건 제외, `plan-scan.test.ts:289`
    는 단순 주석 언급)이었다 — "외부 소비처 0건" 근거가 실측과 일치하고, 문서 갱신 범위가
    항목 12(Gate C 함수 이동)와 정확히 대응한다. 게이트(`describe`)·SoT 표 대상이 안 바뀐다는
    서술도 코드(게이트는 여전히 `spec-plan-completion.test.ts` 에 있음)와 일치한다.

- **[INFO]** "walker 3벌 → 6벌" 전제 정정을 직접 재현 — 정확함을 확인
  - 위치: `plan/in-progress/docs-guard-walker-dedup.md:23-30`
  - 상세: base 커밋(`da078a63f`, 이 PR 브랜치의 부모)에서
    `codebase/frontend/src/lib/docs/__tests__/*.ts` 를 `readdirSync(..., { withFileTypes: true })`
    로 grep 하면 정확히 6곳이다 — `plan-scan.ts:70`(`walkPlanMarkdown`),
    `spec-links.ts:139`(`collectSpecMarkdown`), `spec-links.ts:327`(`collectCodebaseSources`),
    `spec-frontmatter-parse.ts:92`(`collectApplicableSpecs`),
    `spec-frontmatter-parse.ts:156`(`globMatchesAny`), `impl-anchor-parse.ts:114`
    (`collectMdxFiles`). plan 원표의 3개에 정확히 신규 3개(`collectApplicableSpecs`·
    `globMatchesAny`·`collectMdxFiles`)가 더해진다 — 정정이 정확하다. 같은 base 커밋에서
    `spec-plan-completion.test.ts` 는 `readdirSync` 0건이라 "Gate C `collectCompletePlans` 는
    이미 위임 중(선행 PR 에서 해소)" 서술도 실측과 일치한다.

- **[INFO]** "판정이 선행돼야 하는 것" 2건은 추측이 아니라 실측 근거 위에 있음
  - 위치: `plan/in-progress/docs-guard-walker-dedup.md:110-121` (원 항목), `:167-179` (판정 결과)
  - 상세: (a) `spec-links.ts` dedup 판정 — `tree-walk.test.ts` 의 "수집기 필터 배선 — 합성
    트리" describe 블록이 `collectSpecMarkdown`/`collectApplicableSpecs` 의 실제 산출 차이를
    합성 픽스처로 고정하는 형태로 뒷받침된다(추측이 아니라 실행 가능한 테스트 결과 — 판정:
    "합치지 않고 차이를 고정"). (b) Gate C 함수 이동의 "외부 소비처 0건" 판정은 위 항목에서
    독립 재현한 grep 결과와 일치한다. 둘 다 검증 가능한 근거 위에 있다.

- **[INFO]** 13개 체크 항목 전부 diff 근거로 개별 대응 확인 — 허위 체크 없음
  - 위치: `plan-scan.ts`, `spec-links.ts`, `spec-frontmatter-parse.ts`, `impl-anchor-parse.ts`,
    `tree-walk.ts`/`tree-walk.test.ts`(신규), `plan-scan.test.ts`, `spec-plan-completion.test.ts`,
    `spec-links.test.ts`
  - 상세: `git diff da078a63f..bf0dfc98c --stat` 로 변경 파일이 프롬프트가 제시한 11개와
    정확히 일치함을 확인(그 외 파일 변경 0) — plan 밖 코드 영역을 건드린 흔적이 없다. 13개
    체크 항목을 개별 대조한 결과:
    1. walker 필터 표 실측 — `tree-walk.test.ts` 의 합성 트리 테스트로 뒷받침 확인
    2. 의도/사고 판정 — "전부 의도" 로 판정, `walkTree({skipDir, includeFile, recurse})`
       로 파라미터화된 코드로 확인
    3. 통합 구현 + 집합 불변 테스트 — `tree-walk.ts` 신설, 5개 수집기가 `walkTree` 로 전환,
       `tree-walk.test.ts` 가 원소 단위로 고정
    4. `collectCompletePlanMarkdown` 재사용 판정 — base 커밋에 이미 위임 중임을 실측 확인
       (선행 `plan-lifecycle-gates` PR 에서 해소, 이 PR 은 판정만)
    5. `matterNoCache` 단일 창구 — `spec-frontmatter-parse.ts` 가 `plan-scan.ts` 의
       `matterNoCache` import 로 전환 확인
    6. `extractLinks` 사전 필터 — `cannotContainLink` 함수 추가 확인
    7. `collectCompletePlans` negative fixture 갭 — `plan-scan.test.ts:194-199` 에 이미
       `collectCompletePlanMarkdown` 대상 fixture 존재함을 직접 Read 로 확인(선행 커밋 #1123
       위임 축소로 이미 닫힘)
    8. `NONE_VALUES` 정규화 관측 — `spec-plan-completion.test.ts` 신규 `it` 블록 확인
    9. `danglingSpecImpact` → `findDanglingSpecImpact` 개명 — `plan-scan.ts`/
       `spec-plan-completion.test.ts` 양쪽 반영 확인
    10. `plan-scan.test.ts` fixture 빌더 통합 — 직접 Read 로 `frontmatter` 단일 정의 +
        하단 중복 제거(주석으로 대체) 확인
    11. `spec-links.ts` 내부 DFS 중복 — `collectSpecMarkdown`/`collectCodebaseSources` 모두
        `walkTree` 위임 확인
    12. Gate C 판정 함수 `plan-scan.ts` 이동 — 함수 6개(+상수 2개) 이동 확인,
        `spec-plan-completion.test.ts` import 변경과 `plan-lifecycle.md` 미러 갱신 대응 확인
    13. `SpecMdFile` → `MdFileRef` — `tree-walk.ts` 에 `MdFileRef` 신설, `spec-links.ts` 의
        `SpecMdFile` 이 `@deprecated` 별칭으로 전환됨을 확인

## 요약

이 PR 의 코드 변경 자체는 plan 이 정의한 범위(6벌 DFS → `walkTree` 통합, Gate C 판정 함수
`plan-scan.ts` 이동, gray-matter 캐시 우회 단일화, `extractLinks` 성능 사전필터, 개명, fixture
빌더 통합, `SpecMdFile`/`MdFileRef` 분리)를 벗어나지 않는다. `git diff --stat` 로 변경 파일이
plan 관련 11개 파일 + `plan/` 자기 자신으로 정확히 국한됨을 확인했고, `.claude/docs/
plan-lifecycle.md` 수정도 항목 12(Gate C 함수 이동)에 정확히 대응하는 최소 미러 갱신이라 범위
내다. 13개 체크 항목은 diff·직접 Read·grep 재현으로 전수 대조한 결과 전부 실제로 수행됐다 —
허위 체크(안 된 것을 체크)는 발견되지 않았다. "walker 3벌→6벌" 전제 정정과 "판정 선행" 2건의
근거도 base 커밋에서 직접 재현해 정확함을 확인했다. 다만 이 PR 이 스스로 "13개 항목 전부
처리"를 선언하면서도 plan 을 `plan/complete/` 로 이동하지 않았고 frontmatter `status` 도
갱신하지 않았다 — `plan-lifecycle.md §3` 이 "같은 PR 안에서" 하라고 명시한 절차이며, 그 존재
이유가 정확히 "이동 누락 방지" 다. 코드 스코프는 클린하지만 plan 라이프사이클 절차가 이 PR
안에서 완결되지 않았다.

**머지 가능 여부**: 코드 변경 범위 자체를 막을 CRITICAL 급 스코프 위반은 없다. 다만 WARNING
(plan 이동 누락)을 같은 PR 에 추가 커밋(`git mv` + `status` 갱신)으로 해소한 뒤 머지할 것을
권장한다 — 이 프로젝트 컨벤션이 "이동만 담은 별 PR" 을 명시적으로 금지하므로, 지금 병합하면
그 별도 PR 이 필요해지는 정확히 그 상황을 만든다.

## 위험도

LOW
