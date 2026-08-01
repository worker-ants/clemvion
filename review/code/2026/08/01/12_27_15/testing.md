### 발견사항

- **[WARNING]** `#1047`(typescript) 사고 때 만든 자동 회귀 가드(`typescript-toolchain.test.ts` + `typescript-toolchain-guard.ts`) 패턴이 있는데, "정확히 같은 클래스"라고 plan 이 스스로 명시한 이번 `eslint-plugin-unicorn` peer 사고에는 동일 패턴이 적용되지 않았다. 재발 방지가 (a) dependabot `ignore`(dependabot 자체의 재-bump만 막음) (b) 사람이 읽는 comment(그 comment 자체가 "dependabot 은 이 주석을 볼 수 없다"고 명시) (c) plan 문서에 prose 로 기록된 1회성 수동 mutation 테스트, 세 가지뿐이며 셋 다 **커밋된 자동 테스트가 아니다**. 사람이 (또는 다른 자동화가) `package.json` 의 `eslint-plugin-unicorn`/`eslint` 버전을 직접 올리면 아무 CI 게이트도 이를 잡지 못한다 — plan 자신의 "후속 검토" 절이 "미충족 peer 가 CI 에서 실패로 취급되지 않는다"(`pnpm install` 경고만, non-blocking)고 명시하고 있어 이 경로가 실제로 열려 있음을 인정한다.
  - 위치: `codebase/backend/eslint.config.mjs:17` (pin 근거 comment 블록), `.github/dependabot.yml:75`(unicorn ignore 항목), `plan/in-progress/eslint-unicorn-peer-restore.md`의 "후속 검토" 절(약 106~110행 부근, 파일 내 검색: "미충족 peer 가 CI 에서 실패로 취급되지 않는다")
  - 상세: 참고 대상인 `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain.test.ts` 헤더는 "GitHub Actions 가 repo 레벨에서 꺼져 있어 CI job 은 inert 다. 실제로 도는 유일한 게이트는 `.claude/tools/run-test.sh` → `cmd_unit`"이라고 스스로 근거를 밝히는데, 이 근거는 eslint-plugin-unicorn 케이스에도 토씨 하나 안 바꾸고 그대로 적용된다. `.claude/tests/test_dependabot_npm_coverage.py` 는 dependabot 의 npm `directory:` 커버리지만 검사하고 `ignore:` 목록 내용은 검사하지 않으므로, 이번에 추가된 unicorn ignore 항목이 나중에 실수로 삭제/수정돼도 감지할 방법이 없다. 결과적으로 이 PR 이 고친 것과 **동일한 사고 클래스가 재발해도 unit 테스트 레이어에서 아무 신호가 없다** — 오직 사람이 다음 `pnpm install` 로그를 읽거나 e2e 인프라 기동 로그를 유심히 봐야 발견된다(정확히 이번에 발견된 방식).
  - 제안: `typescript-toolchain-guard.ts`/`.test.ts` 와 동일한 순수-코어 + 실측-대조 패턴으로, backend `eslint-plugin-unicorn` 선언 range 의 major 가 특정 상한(예: `<=56` 또는 "peer eslint range 가 backend 의 선언 floor `^9.18` 을 만족하는가")을 검사하는 가드를 frontend vitest(또는 동등하게 항상 도는 게이트) 에 추가할 것. 최소한으로는, `ESLint.lintText`(또는 `require('eslint-plugin-unicorn').peerDependencies`)로 설치된 unicorn 버전의 peer eslint range 를 읽어 backend 의 선언 eslint range 와 비교하는 단일 assertion 만으로도 이번과 같은 silent breakage 를 잡을 수 있다.

- **[INFO]** plan 문서에 기록된 "`unicorn/catch-error-name` mutation 검증"(`catch (err)` → `catch (error)` 로 바꿔 위반 발화 확인 후 원복)은 방법론적으로 타당한 회귀 검증이지만, **수동 1회성**이며 코드로 커밋되지 않았다. 향후 이 룰이 config 변경(예: `off`로 실수 전환, `ignore` 패턴 오타 등)으로 조용히 죽어도 잡을 자동 테스트가 없다.
  - 위치: `plan/in-progress/eslint-unicorn-peer-restore.md` 체크리스트 항목("`unicorn/catch-error-name` mutation 검증", 약 83~89행)
  - 상세: 이 저장소는 이미 "설정이 의도대로 동작하는지"를 코드로 고정하는 관례(repo-guards)를 갖고 있다. 이번 mutation 검증은 그 관례를 따르지 않고 리뷰 시점에만 유효한 prose 증거로 남았다.
  - 제안: 작은 fixture(`catch (error) {}` 를 담은 스니펫)에 `ESLint.lintText` 를 돌려 `unicorn/catch-error-name` 위반이 정확히 1건 나오는지 assert 하는 unit 테스트를 backend 또는 repo-guards 쪽에 추가하면, 이번에 손으로 한 검증이 CI 에서 상시 반복된다. 비용 대비 가치가 커서 우선순위 있게 권장.

- **[INFO]** 이번 변경분 자체(5개 파일: dependabot.yml, eslint.config.mjs, package.json, plan md, pnpm-lock.yaml)에는 신규/수정 애플리케이션 코드가 없어 Mock 적절성·테스트 격리·테스트 가독성·테스트 용이성(DI) 관점은 해당 없음(N/A). 회귀 테스트 관점은 plan 문서가 기록한 TEST WORKFLOW(lint/unit/build/e2e 전부 PASS, 실 인프라 Healthy 확인, "failed" 매칭 오탐을 직접 열어 배제)로 충분히 커버됐다 — 기존 테스트 스위트가 이번 변경 후에도 유효함을 실측으로 확인한 점은 양호하다.

### 요약

이번 PR 은 순수 의존성/설정 복원(`eslint-plugin-unicorn` `^72`→`^56.0.1` 되돌림 + dependabot major ignore 추가 + comment 최신화)이라 새 애플리케이션 로직이 없고, 전체 테스트 스위트(lint/unit/build/e2e)가 통과했다는 근거도 plan 문서에 구체적으로 남아 있어 회귀 위험은 낮다. 다만 이 PR 이 고치는 사고 클래스(dependabot 이 comment 를 못 읽고 peer 제약을 깨는 major bump 를 올림)는 바로 직전 사고(#1047, typescript)에서 이미 한 번 발생했고, 그때는 저장소가 `typescript-toolchain-guard.ts`/`.test.ts` 형태의 **자동 회귀 가드**를 만들어 넣었다. 이번 unicorn 케이스에는 그 패턴이 적용되지 않아 dependabot ignore + comment + 수동 mutation 검증(비-CI, prose 증거)만 남았고, plan 문서 스스로 "미충족 peer 가 CI 에서 실패로 취급되지 않는다"고 인정하고 있어 사람이 직접 버전을 올리는 경로로는 여전히 무방비다. 기능적으로는 문제없지만 테스트 커버리지 관점에서는 "고친 버그와 동일한 클래스의 재발을 잡을 자동 테스트 부재"가 핵심 갭이다.

### 위험도
LOW
