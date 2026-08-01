### 발견사항

- **[INFO]** `eslint-plugin-unicorn` 는 정확한 버전 고정(exact pin)이 아니라 caret range(`^56.0.1`)로 되돌아갔다 — 56.x 대역 내 minor/patch 자동 갱신은 여전히 열려 있다.
  - 위치: `codebase/backend/package.json:119` (`"eslint-plugin-unicorn": "^56.0.1"`), `.github/dependabot.yml:90-91` (major 만 ignore)
  - 상세: `eslint.config.mjs`·plan 문서 모두 "고정(pin)"이라는 표현을 쓰지만 실제로는 `^56` 대역 전체가 허용된다. 의도가 "v57+ 의 eslint peer floor 상향을 피하는 것"이라면 이 설계(“major 만 ignore, minor/patch 는 dependabot 자동 반영”)는 합리적이고 일관적이다 — `typescript` ignore 항목과 동일 패턴을 그대로 재사용했다. 다만 표현("고정")과 실제 동작(범위 허용) 사이 미세한 어휘 차이가 있어, 향후 이 주석만 보고 "정확히 56.0.1로 고정됐다"고 오해할 소지는 있다.
  - 제안: 특별한 조치 불필요. 원하면 주석에 "^56 **대역** 고정(범위 내 minor/patch 는 허용)"처럼 한 단어만 보강하면 오해 여지가 줄어든다.

- **[INFO]** 16-major 다운그레이드로 `pnpm-lock.yaml` 의 `eslint-plugin-unicorn` transitive 트리 전체가 옛 버전 조합(예: `regexp-tree@0.1.27`, `semver@7.8.5`, `resolve@1.22.12`, `is-builtin-module@3.2.1`, `regjsparser@0.10.0`+`jsesc@0.5.0` 등)으로 교체됐다.
  - 위치: `pnpm-lock.yaml` (unified diff 게이트 `16159-16179`: `eslint-plugin-unicorn@56.0.1(eslint@9.39.4(jiti@2.7.0))` snapshot 블록)
  - 상세: 이 트리는 `#1049` 이전에 실제로 lockfile 에 있던(=이미 운영 검증된) 조합으로 정확히 되돌아가는 것이라 신규 취약점을 새로 끌어들일 위험은 낮다. 다만 devDependency(lint 전용, 런타임 비노출)라 해도 CI/빌드 환경 공급망 표면이므로, 다운그레이드 후 `pnpm audit`(또는 기존 `deps-security-checks.yml`) 로 재확인해두면 확실하다.
  - 제안: 별도 조치 없이도 무방(이미 알려진 이전 상태로의 복귀). 원한다면 TEST WORKFLOW 체크리스트에 `pnpm audit` 1줄 추가.

- **[INFO]** `.github/dependabot.yml` 의 `eslint-plugin-unicorn` major ignore 항목은 기존 `typescript` ignore 항목과 동일한 서술 패턴(근거·실측 표·해제 조건)을 따르고 있어 일관성이 좋다.
  - 위치: `.github/dependabot.yml:75-91`
  - 상세: "66+ 는 eslint 9 자체를 배제하므로 eslint 10 상향이 전제" 라는 해제 조건이 명시되어 있고, `codebase/backend/eslint.config.mjs:16-27` 의 주석과 내용이 정확히 미러링된다 — 이번에 `#1049` 가 만든 "값은 바뀌었는데 주석은 그대로"인 코드-문서 drift 문제를 재현하지 않도록 두 곳 모두 갱신됐다.
  - 제안: 없음(양호).

- **[INFO]** 이번 변경은 `codebase/backend` 워크스페이스에만 영향을 준다 — `eslint-plugin-unicorn` 은 다른 9개 워크스페이스(frontend, channel-web-chat, packages/*)의 devDependency 목록에 없다(`pnpm-lock.yaml` importers 섹션 확인).
  - 위치: `pnpm-lock.yaml:43-345` (backend importer 블록에만 `eslint-plugin-unicorn` 항목 존재)
  - 상세: 워크스페이스 간 eslint peer floor 가 이미 갈려 있다는 사실(`^9.18` vs `^9`)은 plan 문서(`plan/in-progress/eslint-unicorn-peer-restore.md:59-60`)가 스스로 인지하고 있고, 이번 PR 범위를 backend 단일 workspace 로 의도적으로 좁혔다. 교차 워크스페이스 충돌 없음.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/eslint-unicorn-peer-restore.md` 의 "후속 검토" 섹션이 이 클래스의 근본 문제(`pnpm install` 이 unmet peer 를 경고만 내고 CI 를 통과시킴)를 이번 PR 범위 밖으로 명시적으로 defer 했다.
  - 위치: `plan/in-progress/eslint-unicorn-peer-restore.md:105-112`
  - 상세: `--strict-peer-dependencies` 를 켜면 기존에 존재하던 `nunjucks → chokidar` unmet peer 에 즉시 걸린다는 이유로 별도 처분이 필요하다고 정확히 진단했다. 이번 diff 는 그 게이팅 메커니즘 자체를 고치지 않으므로, 향후 다른 패키지에서 동일 실패 모드(자동 major bump가 peer 계약을 조용히 깸)가 재발할 수 있다는 잔여 리스크는 유효하다 — 다만 이는 이번 변경이 새로 만든 문제가 아니라 기존에 알려져 문서화된 갭이다.
  - 제안: 별도 조치 불필요(이미 plan 에 후속 항목으로 정확히 기록됨).

### 요약

이 변경은 새 외부 의존성을 추가하지 않고, `#1049`(dependabot)가 깬 `eslint-plugin-unicorn` 의 eslint peer 계약을 `#1049` 이전의 검증된 상태(`^72.0.0` → `^56.0.1`)로 정확히 되돌리는 리버트다. `package.json`·`eslint.config.mjs` 주석·`dependabot.yml` ignore·`pnpm-lock.yaml` 네 파일이 서로 일관되게 갱신되었고("고정을 풀려면 dependabot ignore 항목도 함께 지워야 한다"는 결속까지 주석으로 명시), 영향 범위도 backend 워크스페이스 단일로 정확히 국한된다. 라이선스·번들 크기·불필요한 의존성 관점에서 새로 발생하는 문제는 없으며, 다운그레이드로 재도입되는 transitive 트리는 이전에 이미 운영 검증됐던 조합과 동일하다. Critical/Warning 급 결함은 발견되지 않았고, 발견사항은 모두 어휘상 미세한 표현(“고정” vs range) 및 이미 plan 문서에 defer 된 후속 검토 항목에 대한 참고성 INFO 뿐이다.

### 위험도

LOW
