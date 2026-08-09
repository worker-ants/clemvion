# 문서화(Documentation) 코드 리뷰

## 검토 방법

이 세션(`15_20_33`)은 직전 라운드(`14_36_39`, Critical 0 · WARNING 6 · INFO 18)의
`RESOLUTION.md` 가 적용된 이후 상태를 재검토한다. 직전 문서화 리뷰가 낸 WARNING(1건)·INFO(2건)이
실제로 어떻게 처리됐는지 코드/plan을 직접 열어 대조했고, 이번 라운드에서 새로 추가된 diff
(가드 레벨 테스트 3건, `workspace-context.util.spec.ts` `it.each` 재작성 등)의 주석 정확성도
별도로 확인했다.

## 발견사항

- **[INFO]** `roles.guard.spec.ts` 의 신규 `expectValidationError` 헬퍼가, 같은 PR 이 다른 두
  파일에서 명시적으로 채택한 "캡처-재던지기" 컨벤션과 다른 이중 호출 패턴을 쓴다
  - 위치: `codebase/backend/src/common/guards/roles.guard.spec.ts:358-371`
    (`describe('형식이 깨진 X-Workspace-Id 는 가드에서 400 으로 전파된다', ...)` 블록의
    `expectValidationError` 함수)
  - 상세: 이번 PR 은 직전 라운드 maintainability WARNING("이중 호출 assert — 동일 인자로
    `toThrow` 1회 + 코드 확인 1회를 호출하면 첫 단언이 실패할 때 두 번째가 조용히
    건너뛰어진다")을 `workspace-context.util.spec.ts`(현재 88-118행 `it.each` 블록)와
    `workspace.decorator.spec.ts`(92-113행)에서 "캡처-재던지기"(`try { fn() } catch (err) {
    caught = err; throw err; }` 를 `expect(() => {...}).toThrow()` 로 감싸는 형태)로
    수정했고, `workspace-context.util.spec.ts` 는 그 이유를 테스트 안에 "`workspace.decorator.spec.ts`
    가 같은 이유로 기각해 둔 패턴이라 여기서도 같은 형태를 쓴다"고 명시했다. 그런데 같은
    PR 이 W5 fix 로 신설한 `roles.guard.spec.ts` 의 `expectValidationError` 는 `toThrow`
    단언과 `getResponse()` 단언을 위해 **동일 `ctx` 인자로 `canActivate` 를 별도 guard
    인스턴스에 대해 두 번 호출**한다(360행과 364행). 캡처-재던지기가 아니라 "두 번 실행"
    이라는 점에서, 다른 두 파일이 회피하려던 것과 근본적으로 같은 형태(동일 조건을 두 번
    실행해 각 단언이 서로 다른 실행 결과에 의존)다. `canActivate` 가 순수 판별(부작용 없음)이라
    실질적 flake 위험은 낮지만, 이 함수 위 JSDoc(351-356행)은 "왜 이 테스트가 필요한가"만
    설명하고 "왜 여기서는 캡처-재던지기 대신 이중 호출을 쓰는가"에 대한 근거가 없어, 이
    PR 이 정말 이중 호출 패턴을 전면 기각한 것인지 다음 독자가 혼동할 수 있다.
  - 제안: `workspace.decorator.spec.ts`/`workspace-context.util.spec.ts` 와 동일한
    캡처-재던지기로 통일하거나, 두 번 호출하는 이유(가드 인스턴스가 상태를 갖지 않아
    안전하다 등)를 한 줄 주석으로 남겨 다른 두 파일과의 불일치가 의도적임을 표시한다.

- **[INFO]** 신설 부팅 캐너리가 배포 문서(`README.md`)에 아직 반영되지 않음 — 그러나 이번
  라운드에서는 **명시적으로 계획·추적됨**을 확인 (직전 라운드 INFO 재확인, 회귀 아님)
  - 위치: `codebase/backend/README.md:37-42` (기존 "배포 주의" 섹션, 이번 diff 미포함) /
    `plan/in-progress/auth-guard-reflection-hardening.md` "## 후속 (이 PR 밖)" → "developer
    범위:" 첫 항목
  - 상세: 직전 라운드(`14_36_39/documentation.md`)가 지적한 "README 에 부팅 캐너리가
    기동을 멈출 수 있다는 사실이 없다"는 이번 diff 에서 README 자체는 손대지 않았지만,
    `RESOLUTION.md`(`review/code/2026/08/09/14_36_39/RESOLUTION.md:40-42`)와 plan 문서
    양쪽에 "이 PR 은 CHANGELOG·JSDoc·plan 세 곳에 적었으나 배포 담당자가 먼저 보는 곳은
    README 다. 그 절이 별도 구조 정리를 필요로 해 여기서 손대지 않았다"는 근거와 함께
    `developer 범위` 체크리스트 항목(`[ ]`)으로 명시 등재돼 있다. "미룬 항목은 그 턴에
    plan 에 적어라"는 이 저장소의 규칙을 정확히 따른 처리이므로 이번 라운드에서
    재차단할 사유는 아니다.
  - 제안: 조치 불요(이미 추적됨). 다음에 이 backlog 항목을 집행할 때 `README.md` "배포
    주의" 섹션이 현재 `NODE_ENV=production` 한정 env-값 기반 5개 항목만 나열하는 구조라는
    점을 감안해, 이 캐너리는 "환경 무관 구조 불변식"이라는 이질적 성격을 어떻게 표기할지
    (별도 문단 vs 같은 리스트에 편입) 함께 결정할 것.

- **[INFO]** `spec/5-system/1-auth.md §2.1` 과의 가시성 정합 여부에 대한 "명시적 결정" 이
  plan 체크리스트에 한 줄로 남지 않음 (직전 라운드 INFO 재확인, non-blocking)
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` JSDoc
    "`assertProductionConfig` 에 합치지 않고 별도 부트 단계로 둔 것도 의도다" 문단
    (40번째 줄 인근) / `plan/in-progress/auth-guard-reflection-hardening.md`
  - 상세: `--impl-prep` rationale_continuity 리뷰가 제안한 "boot fail-closed 가드
    문서화 관행(`1-auth.md §2.1`)과의 정합 여부를 명시적으로 결정할 것"이 코드 JSDoc
    수준에서는 근거가 있으나(환경 무관 구조 불변식이라는 이유), plan 체크리스트에는
    "spec/1-auth.md §2.1 에 캐너리 항목을 추가하지 않기로 결정했다"는 문장 자체가
    없다 — 이번 라운드에서도 추가되지 않았다. `spec_impact: none` 은 그대로 유지되고
    있어 결과적 일관성은 있다.
  - 제안: 직전 라운드에서도 "필수는 아니다"로 판단된 항목이라 이번에도 조치를 요구하지
    않는다. 여유가 있을 때 plan §1 에 한 줄만 추가하면 재조사 비용이 준다.

## 확인한 정합성 (직전 라운드 대비 회귀 없음)

- 직전 라운드 유일한 **WARNING** — `CHANGELOG.md` 의 plan 추적 링크가 이미 `plan/complete/`
  로 이동된 `auth-workspace-membership-guard.md` 를 `plan/in-progress/...` 로 잘못
  가리키던 문제 — 이번 diff(`CHANGELOG.md` 47행)에서 `plan/complete/auth-workspace-membership-guard.md`
  로 **정확히 수정**됐다. 두 추적 링크(`plan/complete/auth-workspace-membership-guard.md`,
  `plan/in-progress/auth-guard-reflection-hardening.md`) 모두 실제 파일 존재를 `ls` 로
  직접 확인했다.
- `workspace-context.util.spec.ts`(88-118행)·`workspace.decorator.spec.ts`(92-113행) 두
  파일 모두 캡처-재던지기 패턴으로 정정돼 RESOLUTION 의 "W4 수정" 주장과 코드가 일치한다.
- `roles.guard.spec.ts` 신규 3건(개별 `describe` 블록, "@WorkspaceId() 라우트"·"@Roles()
  라우트"·"403 이 아니라 400 임(+DB 미도달 단언)")이 RESOLUTION 의 W5 서술과 정확히
  일치하고, `getMemberRole` 미호출 단언이 실제로 22P02 마스킹 방지 지점을 검증한다.
  - `main.ts:164-168` 의 신규 인라인 주석("`assertProductionConfig` 와 별도 단계인 이유·
    근거 전문은 `workspace-reflection-canary.ts`")은 실제로 `assertProductionConfig` 가
    135행에서 먼저 별도 호출되는 것과 대조해 정확하다.
  - `CHANGELOG.md` 신규 문단의 "예외 필터가 23505 만 매핑" 서술은
    `common/filters/http-exception.filter.ts` (`isUniqueViolation`, `getCodeFromStatus`)
    를 직접 열어 대조 완료 — 정확하다.
- `plan/in-progress/auth-guard-reflection-hardening.md` 는 이번 라운드에서 다룬 모든
  결정(W1~W4, `/ai-review` 6건 수정, 뮤테이션 실증, 후속 backlog 2건)을 근거와 함께
  갱신했고, "push + PR" 체크박스만 미완으로 남아 라이프사이클 상태와 실제 진행도가
  일치한다.

## 요약

이번 라운드는 직전 라운드가 지적한 유일한 WARNING(CHANGELOG stale plan 링크)을 정확히
고쳤고, 나머지 2건의 INFO(README 배포 문서 갱신, spec §2.1 결정 명문화)는 코드를 손대지
않는 대신 plan 문서에 근거와 함께 backlog 로 명시적으로 남겨 두어 "미룬 항목을 잃지
않는다"는 프로젝트 규칙을 지켰다. 이번 라운드에서 새로 추가된 코드(가드 레벨 3개 테스트,
`workspace-context.util.spec.ts` 캡처-재던지기 재작성)의 주석은 실제 구현·인접 파일과
대조해 정확했다. 유일하게 새로 짚을 만한 것은 `roles.guard.spec.ts` 의 신규 헬퍼가 같은
PR 이 다른 두 파일에서 명시적으로 채택한 "캡처-재던지기" 컨벤션과 다른 이중 호출 패턴을
근거 없이 쓴다는 점(INFO)이며, 이는 실질 결함이 아니라 문서·주석 일관성 관점의 사소한
지적이다. Critical/Warning 급 문서화 결함은 발견되지 않았다.

## 위험도

LOW
