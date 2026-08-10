# Rationale 연속성 검토 — plan-lifecycle-gates (impl-done, spec/conventions/)

## 조사 방법 메모

prompt_file 번들에 diff 섹션이 없어(알려진 결함), 워킹트리
`/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates` 를 직접 조사했다.
`git log origin/main..HEAD` 로 이 PR 의 실제 커밋 19건을 확인하고, 6차 orchestrator 지시가
지목한 두 항목(①`plan-frontmatter.test.ts` 헤더 주석 38→22줄 축약, ②신규 plan
`docs-guard-legacy-fixture-coverage.md` 등재)을 커밋별 diff·RESOLUTION.md·SUMMARY.md·
`.claude/docs/plan-lifecycle.md`·`plan/complete/**` 원문 대조로 실측했다.

---

## 발견사항

### [INFO] ① 헤더 주석 축약 — 근거 소실 아님, 3중 보존 확인됨

- target 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:10`~`25`
  (커밋 `f09b21893`, "헤더 주석 축약 + describe 스코프 정정, 선재 검사 커버리지는 등재")
- 과거 결정 출처: `.claude/docs/plan-lifecycle.md §4`(줄 84~91) 및 커밋 `9e880e908`
  ("feat(harness): plan 이동이 남기던 두 갭에 게이트")
- 상세: 걷어낸 서사(①`complete/` 인데 `status: in-progress` 를 **두 번**(`#1108` 3차 리뷰
  INFO 18 · `#1117`) 놓친 이력, "문서 가드 18파일 / 2821 tests 가 전부 GREEN" 이었다는
  뮤테이션 실증, ②살아있는 plan 상대링크 무결성 게이트 부재의 스코프 판단 근거)는 코드
  주석에서만 빠졌을 뿐 다음 세 곳에 **이미 그대로** 남아 있음을 실측으로 확인했다.
  1. `.claude/docs/plan-lifecycle.md:84`~`91` — 이 서사의 **원 SoT**. 이 절이 이미
     "2026-08-09 신설. 이 저장소가 두 번 놓친 실패다(`#1108`·`#1117`) — … (문서 가드 18파일 /
     2821 tests 를 뮤테이션으로 돌려 확인)" 를 담고 있으며, 축약된 새 주석은 정확히 이 절을
     "SoT" 로 명시 위임한다.
  2. 커밋 메시지 `9e880e908`(원 도입 커밋)과 `69f4307dd`(`#1117` 정정 커밋) — PR 번호·라운드
     내러티브 원문 그대로 보존.
  3. `plan/complete/spec-draft-secret-store-verification-footnote.md` §"후속 (이 PR 밖)" —
     "여기 적어 둔 '기존 위반 21건' 은 옳았다 … 262건 … 22건 … 23번째 …" 등 원 코드 주석보다
     더 상세한 형태로 이미 기록돼 있음(이 plan 이 실제로 두 갭 게이트의 "출처 plan").
  즉 이번 편집은 **CLAUDE.md "결정의 배경·근거 → 해당 문서의 `## Rationale`"** 원칙에 오히려
  부합한다 — 코드 주석에 산문을 누적시키는 대신 이미 존재하는 규약 SoT(`plan-lifecycle.md §4`)
  로 위임했다. 이 disposition 자체도 무근거가 아니라 직전 라운드(02_33_44) ai-review 의 명시
  WARNING(W3: "새 리더가 현재 불변식을 알기 전에 과거 리뷰 이력부터 읽어야 하는 상태")을
  근거로 한 조치임을 `review/code/2026/08/10/02_33_44/RESOLUTION.md` 에서 확인했다.
- 제안: 조치 불필요. (참고: 향후 유사 축약 시 "SoT 위임 문구가 실제로 그 SoT 문서에 해당
  내용을 담고 있는지"를 매번 실측하는 습관을 권장 — 이번엔 우연이 아니라 사전에 `plan-scan.ts`
  분리·`plan-lifecycle.md §4` 갱신이 같은 PR 초반(`9e880e908`)에 이미 끝나 있어 위임이
  유효했다.)

### [WARNING] ② 신규 plan `docs-guard-legacy-fixture-coverage.md` 의 "선재 코드라 PR 밖" 근거가 `developer/SKILL.md §ISSUE FIX 정책` 문언과 정면으로 부딪힌다 (3회 반복 패턴)

- target 위치: `plan/in-progress/docs-guard-legacy-fixture-coverage.md`(신설, 커밋
  `f09b21893`) + `review/code/2026/08/10/02_33_44/RESOLUTION.md` §"W1 — 선재 3필드 검사가
  positive-only … → 등재"
- 과거 결정 출처: `.claude/skills/developer/SKILL.md` §ISSUE FIX 정책(줄 133):
  > "Warning 이상·테스트 누락은 지시 범위 밖이라도 해결. **TEST·REVIEW WORKFLOW 에서 발견된
  > 사항은 기존부터 있던 것이라도 조치.** spec 자체 문제는 멈추고 `project-planner` 위임."

  및 CLAUDE.md §외부 LLM 호출 정책 인접 문단: "구현(`developer`) 완료 후의 `/ai-review` +
  critical/warning fix 는 그 가드의 예외 — 본 프로젝트가 상시 사전 승인한 강제 단계다 …
  마찬가지로 SUMMARY 의 Critical/Warning 에 대한 `resolution-applier` fix 도 같은 턴의 강제
  의무다."
- 상세: RESOLUTION.md 는 W1(`worktree`/`started`/`owner` 세 검사가 positive-only vacuous —
  카테고리는 "testing / 테스트 누락")을 스스로 "인접 코드로의 범위 확대다. 이 PR 에서 같은
  클래스를 이미 **두 번** 사양했고(`docs-guard-walker-dedup.md` 의 walker 3벌 통합·
  `SpecMdFile` 타입명 — 두 항목 모두 실측 확인, 4라운드 ai-review 기원) 같은 근거가 그대로
  적용된다"고 명시하며 **fix 대신 신규 backlog plan 등재**로 disposition 했다. 그러나
  `developer/SKILL.md` 줄 133 은 정확히 이 상황(리뷰 워크플로에서 발견된, 이 PR 이 만들지
  않은 기존 결함)을 겨냥해 "기존부터 있던 것이라도 조치" 를 명문화하고 있어, "선재 코드라
  이 PR 의 diff 밖" 이라는 근거는 이 문서가 이미 배제한 변명이다. `resolution-applier.md` 의
  공식 disposition 3분류(SPEC-DRIFT / spec 결함 / 코드 관련→§2 fix)에도 "PR 스코프 밖 →
  backlog 등재" 는 존재하지 않는다 — 유일하게 자동 수정을 건너뛰는 예외는 §2-3 "민감 변경
  가드"(DB 마이그레이션·외부 API 계약·인증 흐름·결제/webhook·package.json 메이저 버전)뿐이고
  vacuous test coverage 는 이 목록에 없다. 즉 이 disposition 은 **문서화된 규칙을 뒤집는
  결정이면서, 그 규칙(줄 133) 자체를 개정하거나 새 예외 조항으로 명문화하지 않은 채** 같은
  PR 안에서 세 번 반복 적용됐다.

  한편 완전한 무근거는 아니다 — 사용자 자신의 과거 회고(이 세션의 auto-memory
  `feedback_review_fix_stale_loop.md`: "fix→리뷰 stale 루프(7라운드)와 백로그 유실 … fix 는
  모아서 하고 리뷰. `review/**` 는 SoT 아님 — 미룬 항목은 **그 턴에 `plan/` 에 적어라**")가
  "라운드마다 인접 스코프를 흡수하면 PR 이 수렴하지 않는다"는 정확히 같은 위험을 이미 실증해
  뒀고, 이번 disposition 은 그 교훈(같은 턴에 `plan/` 등재)을 충실히 따른 형태다. 다만 이
  운영 교훈은 `developer/SKILL.md` §ISSUE FIX 정책 본문에 예외 조항으로 반영돼 있지 않다 —
  두 소스가 서로 다른 답을 준다.
- 제안: (a) `developer/SKILL.md` §ISSUE FIX 정책 줄 133 에 "단, 같은 PR 이 반복적으로
  인접·선재 스코프를 흡수해 수렴을 못 하는 경우, `RESOLUTION.md`§보류·후속 항목 에 근거를
  명시하고 `plan/in-progress/` 에 즉시 등재하는 것으로 갈음할 수 있다" 류의 명시적 예외
  문구를 추가해 이번 disposition 을 정식 Rationale 로 승격하거나, (b) 문구를 바꾸지 않을
  것이라면 W1 을 실제로 fix(순수 함수 추출 + synthetic fixture, `docs-guard-walker-dedup.md`
  의 나머지 두 항목도 함께)해 규칙 문언과 실제 행동을 일치시킬 것. 둘 중 하나를 다음 라운드
  전에 결정해 명문화하지 않으면, 향후 세션이 "3번 반복됐으니 관례"로 오인하고 Warning 즉시
  fix 원칙 전반을 잠식할 위험이 있다.

### [INFO] ③ (참고, 비차단) `spec-impl-evidence.md` 자기 정정 커밋(`dd7da2d1b`)의 역할 경계 우회

- target 위치: `spec/conventions/spec-impl-evidence.md`(커밋 `dd7da2d1b`)
- 과거 결정 출처: CLAUDE.md §Skill 체계 "`spec/` 변경 → `project-planner`. … 구현 중 spec
  변경 필요 시 `developer` 는 멈추고 `project-planner` 위임." / `developer/SKILL.md:28`
  "`spec/` — Read only — 수정 시 `project-planner` 위임."
- 상세: 이 커밋은 developer 역할 세션이 `spec/conventions/spec-impl-evidence.md` 를 직접
  Edit 했다. 다만 커밋 메시지가 스스로 권한 경계를 인지·정당화한다 — (a) 새 결정 0건, 이미
  `plan-lifecycle.md §4` 로 확정된 SoT 를 spec 본문이 뒤따라가는 순수 사실 정정, (b)
  `--impl-done` BYPASS 근거를 실측 기록(`review/consistency/.../BYPASS.md`, "diff 섹션 헤딩
  0건" 실측). BYPASS 패턴 자체는 이 프로젝트가 이미 승인해 둔 선례(`feedback_impl_done_spec_
  bundle_bug` 류)와 형태가 같아 새로운 위반이라기보다 "결정 없는 spec 자기 동기화" 범주에
  가깝다. Rationale 위반이라기보다 역할-경계(convention_compliance) checker 소관에 더 가까워
  본 항목은 정보 제공 목적으로만 남긴다 — 조치 요구 아님.

---

## 요약

이번 라운드에서 orchestrator 가 지목한 두 항목 중 헤더 주석 축약(①)은 실측 결과 근거
소실이 아니다 — 걷어낸 서사가 `plan-lifecycle.md §4`(원 SoT)·두 커밋 메시지·
`plan/complete/spec-draft-secret-store-verification-footnote.md` 세 곳에 이미 보존돼
있고, 축약 자체가 직전 라운드 ai-review WARNING 을 근거로 한 정당한 조치였다. 반면 신규
plan `docs-guard-legacy-fixture-coverage.md`(②)의 "선재 코드라 이 PR 밖" 근거는
`developer/SKILL.md §ISSUE FIX 정책`("기존부터 있던 것이라도 조치")이 명시적으로 배제한
바로 그 변명과 문언상 충돌하며, 같은 PR 안에서 동일 패턴이 3회 반복됐다. 이 disposition
은 사용자 자신의 과거 stale-loop 교훈과는 실질적으로 부합하지만, 그 교훈이 `developer/
SKILL.md` 규칙 본문에 예외로 명문화되지 않은 채 반복 적용되고 있어 — 결정을 뒤집으면서
새 Rationale(예외 조항)을 함께 쓰지 않은 전형적인 WARNING 사례다. 부수적으로 발견한
`spec-impl-evidence.md` 자기 정정(③)은 역할 경계를 스스로 인지·정당화한 저위험 사례라
정보 제공 수준으로만 기록한다.

## 위험도

MEDIUM (Critical 0 · WARNING 1 · INFO 2 — WARNING 은 spec `## Rationale` 자체가 아니라
공정(process) 규칙과의 문언 충돌이라 상한을 MEDIUM 으로 잡았다. 동일 패턴이 향후에도
계속 등재-only 로 반복되면 HIGH 로 재평가 권고)

STATUS=success
