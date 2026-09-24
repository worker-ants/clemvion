# 요구사항(Requirement) 리뷰 — jest ESM 네이티브 로드 전환 + NestJS v12 후속 stub

## 발견사항

- **[CRITICAL]** `nestjs-v12-coordinated-upgrade.md` 의 `worktree:` 값이 레거시 placeholder 라 실제 build guard(`plan-frontmatter.test.ts`)를 깬다 — 실측 확인
  - 위치: `plan/in-progress/nestjs-v12-coordinated-upgrade.md:5` (`worktree: (미정 — 착수 시 생성)`)
  - 상세: `.claude/docs/plan-lifecycle.md §4` 및 `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` 의 `WORKTREE_PLACEHOLDER` 정규식(`/\bTBD\b|assigned at impl|미정|착수\s*시|^pending$/i`)은 "미정"·"착수 시" 패턴을 명시적으로 거부하고, 미착수 plan 은 반드시 sentinel `(unstarted)` 를 쓰도록 강제한다. 이 값(`(미정 — 착수 시 생성)`)은 그 정규식에 정확히 매치된다(직접 테스트: `regex.test(val) === true`). 실제로 `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` 를 로컬에서 돌려 재현했다:
    ```
    FAIL plan-frontmatter.test.ts > ... > plan/in-progress/nestjs-v12-coordinated-upgrade.md > `worktree` is set and not a legacy placeholder
    AssertionError: expected [ Array(1) ] to deeply equal []
    + ["worktree \"(미정 — 착수 시 생성)\" 는 placeholder — 실제 이름이나 \"(unstarted)\" 을 쓸 것"]
    ```
    (157 tests 중 1 failed, 나머지 156 통과 — 이 파일 하나만의 문제임을 확인.) 저장소 안의 다른 미착수 stub plan 14개(`ai-agent-tool-connection-rewrite.md`, `deps-guard-hardening.md`, `self-hosting-deployment.md` 등)는 전부 `worktree: (unstarted)` 를 정확히 쓰고 있어, 이번 파일만 유일한 이탈이다 — 실수이지 의도된 변형이 아니다.
  - 부가 관찰(참고용, 이 CRITICAL 의 등급을 낮추는 근거는 아님): `.github/workflows/frontend-checks.yml` 의 `changes` 잡 pathspec 목록에 `plan/**` 가 없다. 이번 PR 처럼 `codebase/backend/**`+`plan/**` 만 건드리는 diff 는 `relevant=false` 로 판정돼 `pnpm --filter frontend test`(=이 guard 가 포함된 스위트) 자체가 no-op 통과로 skip 된다 — 즉 이 CRITICAL 결함은 **이 PR 의 CI 에서 저절로 잡히지 않는다.** 별도 후속 사항으로 보고할 가치가 있으나(plan-lifecycle 불변식을 검사하는 guard 가 frontend 전용 path-filter 에 갇혀 있는 구조적 갭), 이번 리뷰의 스코프는 아니다.
  - 제안: `worktree: (미정 — 착수 시 생성)` → `worktree: (unstarted)` 로 정정. 다른 14개 stub 과 동일한 관용구를 그대로 쓰면 된다.

- **[WARNING]** 커밋되는 plan 문서가 커밋되지 않은 review 디렉터리를 근거로 인용한다
  - 위치: `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §C ("`--impl-prep` `review/consistency/2026/09/24/12_57_36` `plan_coherence` W3 이 짚은 것이고 **받아들인다**")
  - 상세: `git log --oneline -- review/consistency/2026/09/24/12_57_36` 는 빈 결과다 — 이 디렉터리는 이번 커밋(또는 그 어떤 커밋)에도 포함되지 않고 현재 워크트리에만 남아 있는 untracked 산출물이다(`git status --short` 에도 잡히지 않는 걸 보아 세션 로컬 잔여물). 반면 같은 plan 이 참조하는 `jest-esm-native-load.md` 의 impl-prep 근거(`review/consistency/2026/09/24/13_55_20`)는 같은 커밋(`d08c8a067`)에 실제로 포함돼 있다. 즉 한쪽 근거는 저장소에 영구히 남고 다른 쪽은 이 워크트리가 사라지면 함께 사라진다 — 나중에 `#1382`/`@nestjs/common` 업그레이드를 맡는 세션이 "받아들인다" 고 적힌 W3 의 원문을 확인하려 해도 clone 된 저장소에서는 찾을 수 없다.
  - 제안: 이 세션이 실제로 참고한 `12_57_36` 산출물도 함께 커밋하거나(정보 저장 위치 표의 "일관성 검토 산출물" 규약과 일치시킴), 커밋하지 않을 거라면 §C 본문에 그 판단(W3 의 핵심 요지: reflection 캐너리가 부분 파손을 못 잡는다)을 문장으로 인라인해 두어 참조가 끊겨도 내용이 보존되게 할 것.

- **[INFO]** `ExperimentalWarning` 실측 줄 수가 plan 서술과 다르다 (사소, 코드 결함 아님)
  - 위치: `plan/in-progress/jest-esm-native-load.md` §C ("**비용**: … 가 **jest 워커당 1줄**(실측 10줄) 찍힌다") 및 §D 체크리스트 두 번째 항목(동일하게 "실측 10줄")
  - 상세: 첨부된 실측 로그 `_test_logs/unit-20260924-140803.log` 를 직접 세어 보면 `ExperimentalWarning: VM Modules …` 는 9줄이다(9개의 고유 워커 PID). "잡 워커당 1줄"이라는 메커니즘 설명 자체는 맞고 재현도 되지만, 적힌 숫자(10)와 첨부 증거 로그의 실제 값(9)이 다르다 — jest 기본 워커 수가 실행 환경(CPU 코어 수)에 따라 달라질 수 있어 다른 실행에서 10이 나왔을 가능성은 있지만, 이 PR 에 첨부된 그 로그 파일 자체와는 불일치한다.
  - 제안: 문서화 정확도 문제일 뿐 코드 동작에는 영향 없음 — "실측 10줄"을 "실측 9~10줄(워커 수에 따라 변동)"처럼 환경 의존성을 명시하거나, 첨부 로그 값(9)으로 정정.

## 검증한 것 (문제 없음 확인)

- `codebase/backend/jest.config.ts`·`package.json`·`test/jest-e2e.json` 세 파일의 diff 는 서로 정합적이다 — `transformIgnorePatterns` 를 기본값(`['/node_modules/']`)으로 되돌린 unit/e2e 설정과, `test`/`test:watch`/`test:cov`/`test:debug`/`test:e2e` 5개 스크립트 전부에 `node --experimental-vm-modules` 를 추가한 package.json 변경이 쌍으로 맞다(plan 이 스스로 "2번이 없으면 1번이 깨진다"고 명시한 그 쌍).
- 저장소 전역에서 `transformIgnorePatterns` 잔존 참조 0건(주석 제외), backend 밖의 다른 패키지에는 애초에 이 패턴이 없었다 — 변경 누락 없음.
- CI 진입점(`pnpm --filter backend test`, `docker-compose.e2e.yml` 의 `pnpm run test:e2e`)은 전부 package.json 스크립트를 경유하므로 새 플래그가 자동으로 전파된다 — CI yml 자체를 고칠 필요가 없다는 plan 의 판단과 일치.
- 첨부 로그 4종(`lint`·`unit`·`build`·`e2e`)이 실제로 디스크에 존재하고, 각 로그 tail 을 직접 열어 plan 이 인용한 숫자(**472 스위트/9946**, `1 skipped, 9945 passed`; e2e **380 passed**)와 정확히 일치함을 확인했다 — 측정값 조작·과장 없음.
- `codebase/backend/package.json` 의 `@nestjs/typeorm` 버전은 diff 에서 변경되지 않았다(`^11.0.3` 그대로) — plan 이 "이 PR 은 jest 인프라만 고치고 실제 의존성 범프(#1339)는 별개"라고 서술한 것과 코드가 정확히 일치한다.
- TODO/FIXME/HACK/XXX 주석 없음. spec fidelity: `spec/` 전역에 jest/CI 설정을 규정하는 문서가 없어(grep 0건) 9번 관점은 "관련 spec 없음"(INFO 수준 결론, `spec_impact: none` 선언과 일치) — 이 변경 자체가 spec 위반을 일으키지 않는다.
- `nestjs-v12-coordinated-upgrade.md` §C 의 "reflection 보안 회귀 검증" 조건은 선행 impl-prep 라운드(`12_57_36`)의 W3 지적을 구체적 체크리스트(부트 캐너리 소비 라우트 수 비교, `workspace.decorator.spec.ts`/`roles.guard.spec.ts` 통과 확인)로 정확히 흡수했다 — 논리적 공백 없음.

## 요약

핵심 인프라 변경(jest.config.ts / package.json / test/jest-e2e.json 의 ESM 네이티브 로드 전환)은 자체적으로 정합적이고 실측 로그로 뒷받침되며 스코프 밖 파일 누락도 없다. 그러나 같은 커밋에 새로 추가된 `plan/in-progress/nestjs-v12-coordinated-upgrade.md` 의 `worktree:` frontmatter 값이 저장소가 명문화한 sentinel 관용구(`(unstarted)`)를 어기고 레거시 placeholder 패턴("미정"·"착수 시")을 그대로 써서, 로컬 재현으로 확인한 실제 vitest guard(`plan-frontmatter.test.ts`) 실패를 유발한다 — 다른 14개 미착수 stub 전부가 정확한 관용구를 쓰고 있어 이번 건만의 단순 실수다. 다만 이 guard 를 포함한 frontend 테스트 잡은 `plan/**` 를 변경-경로 필터에 포함하지 않아 이번 PR 의 CI 에서는 자동으로 드러나지 않을 가능성이 높다 — merge 전 직접 고쳐야 한다. 그 외에는 근거 자료 하나가 커밋에 포함되지 않아 추적성이 약해지는 WARNING 과, 실측 수치 하나의 사소한 오차(INFO)뿐이다.

## 위험도

HIGH — CRITICAL 1건은 실측 재현된 실제 테스트 실패이고 원인·수정 방법이 명확하지만, 병합 전 반드시 고쳐야 한다(고치지 않으면 이번 PR 의 CI 경로에서는 드러나지 않고 잠복할 수 있다).
