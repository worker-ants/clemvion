# 아키텍처(Architecture) 리뷰

## 검토 범위 확인

`git diff origin/main...HEAD --stat -- codebase/ PROJECT.md` 로 실제 코드/설정 diff 를 직접
확인했다 — 5개 파일, 153 삽입/22 삭제뿐이다:

- `PROJECT.md` (정책 문서 1문장 보강)
- `codebase/backend/jest.config.ts` (`transformIgnorePatterns` 허용목록 제거 + 주석)
- `codebase/backend/package.json` (`scripts.test*` 5개, `--experimental-vm-modules` 도입)
- `codebase/backend/test/jest-e2e.json` (`transformIgnorePatterns` 를 기본값으로)
- `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (신규 repo-guard 스펙)

프롬프트에 나열된 나머지 약 70개 파일(`plan/in-progress/*.md`, `review/code/2026/09/24/{14_24_10,
15_26_17,16_02_28}/**`, `review/consistency/2026/09/24/{12_57_36,13_55_20}/**`)은 이전 3개
리뷰 라운드의 산출물을 저장소 규약(`CLAUDE.md` §정보 저장 위치)에 따라 커밋에 편입한 텍스트이거나
plan 문서다 — 코드가 아니며, 이번 4라운드가 그 결론을 다시 낼 이유가 없다. `HEAD`(`eeffa4963`)는
3라운드 RESOLUTION 커밋이고, 실제 코드 파일은 3라운드(`16_02_28`)가 확인한 상태와 diff 없이
동일함을 위 5개 파일을 직접 `Read` 하여 재확인했다.

직전 세 아키텍처 라운드의 판정을 다시 대조했다 — 전부 현재 상태와 일치한다:

- `codebase/backend/package.json` scripts 5개(`test`/`test:watch`/`test:cov`/`test:debug`/
  `test:e2e`) 전부 `node --experimental-vm-modules ./node_modules/jest/bin/jest.js` 로 통일
  (1라운드 WARNING 조치 유지).
- `codebase/backend/jest.config.ts:41`, `codebase/backend/test/jest-e2e.json:9` —
  `transformIgnorePatterns` 양쪽 다 `['/node_modules/']`.
- `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts:61-106` — script
  텍스트의 존재뿐 아니라 플래그-진입점 **순서**(`flagIdx < entryIdx`)까지 검증 (3라운드에서
  가드 자신의 "존재 검사 ≠ 정합 검사" 결함을 스스로 고친 결과, `a49b62108`).
- `plan/in-progress/nestjs-v12-coordinated-upgrade.md:5` — `worktree: (unstarted)` sentinel.

## 발견사항

- **[INFO]** 손-유지 ESM allowlist 제거는 OCP(개방-폐쇄) 관점 실질 개선 — 3라운드째 동일 결론, 변경 없음
  - 위치: `codebase/backend/jest.config.ts:19-41`, `codebase/backend/test/jest-e2e.json:9`
  - 상세: 신규 ESM-only 의존성(`@nestjs/typeorm@12` 의 `import.meta.url` 처럼 CJS 로 downlevel
    이 원리적으로 불가능한 것 포함)이 등장해도 설정 파일의 정규식을 다시 열어 패키지명을
    추가할 필요가 없다. 기존 방식은 `jest.config.ts`(6개 패키지)와 `test/jest-e2e.json`
    (3개 패키지)이 이미 서로 어긋나 있었다는 근본 결함을 안고 있었는데, 기본값 + 네이티브
    ESM 로딩 전환이 그 drift 자체를 원천 제거했다.
  - 제안: 없음.

- **[INFO]** 신규 repo-guard 가 애플리케이션 코드 트리(`src/`)에서 테스트/빌드 설정 파일의
  구체 경로에 의존하는 역방향 결합 — 기존 관례와 일치, 신규 리스크 아님
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts:61-67`
    (`path.resolve(__dirname, '../../../package.json')`), `:108-112`
    (`path.resolve(__dirname, '../../../test/jest-e2e.json')`)
  - 상세: `src/repo-guards` 는 애플리케이션 코드 경계 안이지만 프로젝트 루트의
    `package.json`·`test/jest-e2e.json` 상대 경로를 하드코딩해 읽는다. 통상적 레이어 분리
    기준으로는 "src 트리가 프로젝트 루트 설정을 아는" 역방향이지만, 이 디렉터리는 이미
    `production-build-devdep-guard.ts` 등으로 "빌드/툴체인 불변식을 `src/repo-guards`에서
    정적으로 검증"하는 관례를 다수 갖고 있다. 세 라운드 연속 같은 결론이며 이번 라운드에서
    그 판단을 뒤집을 새 근거는 없다.
  - 제안: 없음 — 기존 선례를 따르는 정상적 확장.

- **[INFO]** 새 repo-guard 스펙이 unit/e2e 두 설정 파일 간 drift 재발을 정적으로 봉인하는
  단일 진실 지점 역할
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts:108-117`
  - 상세: `fs.readFileSync` + `JSON.parse` 로 e2e 설정 파일을 직접 읽어 unit 쪽 기대값과
    대조하는 테스트를 둠으로써, "두 설정 파일이 각자 손으로 유지되며 갈라진다"는 이 PR 이
    고친 문제 클래스의 재발을 한 지점에서 구조적으로 막는다. 스펙 헤더 주석(`:41-45`)이
    "행동 검증이 아니라 설정 대조"라고 보증 범위를 스스로 좁혀 적어 둔 점도 문서한 보장이
    구현보다 넓어지는 것을 막는 방향으로 타당하다.
  - 제안: 없음 — 긍정적 관찰.

- **[INFO]** 두 plan 문서(`jest-esm-native-load.md` ↔ `nestjs-v12-coordinated-upgrade.md`)
  간 의존 방향이 단방향 — 순환 없음, 3라운드째 재확인
  - 위치: `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §B("선행 조건") ↔
    `plan/in-progress/jest-esm-native-load.md`
  - 상세: 후속 plan 이 선행 plan 을 참조하고 역참조는 없다. "부분 메이저 범프는 성립하지
    않는 중간 상태"라는 제약(§A 실측: `@nestjs/platform-express@12` 단독 범프는
    `ERR_MODULE_NOT_FOUND` 로 런타임 사망)을 계획 단계에서 스코프 경계로 명시해, 이번 PR
    의 책임(테스트 러너의 ESM 네이티브 로딩)과 다음 PR 의 책임(NestJS 12 동반 업그레이드)을
    분리했다. 모듈/작업 경계가 코드가 아닌 계획 수준에서부터 명확하다.
  - 제안: 없음.

- **[INFO]** 5개 npm 스크립트의 `node --experimental-vm-modules ./node_modules/jest/bin/jest.js`
  접두어 반복 — 세 라운드 연속 검토·보류된 저위험 트레이드오프
  - 위치: `codebase/backend/package.json:22-26`
  - 상세: 15단어 접두어가 5곳(사실상 전부, `test:debug` 포함)에 문자 그대로 반복된다.
    Node 가 이 플래그를 stable 로 승격하며 이름이 바뀌거나 제거되면 5곳을 동시에 고쳐야
    하는 단일 진실 지점 부재가 남는다. 다만 `esm-native-load.spec.ts:61-106` 의 신규
    텍스트-대조 가드가 최소한 "표기 드리프트"(5개 중 일부만 다른 형태)는 정적으로 막아
    주므로, 중복 자체가 유발하던 실제 위험(1라운드에서 발견된 `test:debug` 셸 shim 결함)
    의 재발 가능성은 완화됐다. 1~3라운드 모두 "현재 규모(5줄)에서 셸 스크립트로 뽑는 것은
    오히려 이 저장소에 선례 없는 새 간접층을 추가하는 비용이 더 크다"는 근거로 defer 했고,
    이 판단을 뒤집을 새 정보는 이번 라운드에도 없다.
  - 제안: 없음 — blocking 아님, 기존 판단 유지.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 새로 등재된
  "docs 가드 트리거 pathspec 갭" 항목은 이번 PR 자체의 아키텍처 결함이 아니라 별도
  트래킹 대상
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (라인 5080 부근,
    "docs 가드가 검사하는 데이터가 그 가드를 트리거하지 않는다" 항목)
  - 상세: `codebase/frontend/src/lib/docs/__tests__/` 의 plan/spec 프론트매터 가드가 스캔하는
    `plan/**`·`spec/**` 이 그 가드를 돌리는 `frontend-checks.yml` 의 pathspec 에는 없다는
    관찰이다. 이는 CI 트리거 스코프와 가드 스캔 대상 사이의 경계 불일치이며 module/workflow
    boundary 문제로 분류할 만하지만, 이번 diff 가 새로 만든 것이 아니라 기존에 있던 갭을
    발견해 백로그로 등재만 한 것이고 처방 (a)/(b) 비용 비교까지 문서화한 뒤 이번 PR
    스코프에서는 의도적으로 미루기로 명시했다. 이번 changeset 의 코드 아키텍처 판정에는
    영향이 없다.
  - 제안: 없음 — 별도 plan 항목으로 이미 적절히 분리됨.

## 요약

이번 changeset 의 실질 아키텍처 표면은 3라운드에 걸쳐 이미 확정된 것과 동일하게 backend
Jest 테스트 러너의 모듈 로딩 방식 전환(설정 파일 3개 + 신규 repo-guard 스펙 1개)에
국한되며, 프로덕션 런타임 레이어·API 계약·서비스 간 모듈 경계·레이어 책임 분리와는 무관하다.
`git diff origin/main...HEAD --stat` 으로 실제 코드 diff 가 3라운드(`16_02_28`) 확정 상태에서
한 줄도 바뀌지 않았음을 직접 확인했고, 1라운드 CRITICAL(plan `worktree` placeholder)·1·2·3
라운드 WARNING(스크립트 표기 드리프트, 가드의 존재-검사 vs 순서-검사 결함) 이 모두 조치돼
재발하지 않았음을 재확인했다. 손-유지 ESM allowlist 제거는 OCP 관점의 실질 개선이고, 그
불변식을 지키는 repo-guard 신설은 우연한 커버리지를 이름 있는 회귀 테스트로 격상한 설계상
타당한 선택이다. 신규 repo-guard 의 역방향 결합(`src/` → 루트 설정 파일 경로 하드코딩)과
5개 스크립트의 접두어 중복은 모두 기존 선례와 일치하거나 세 라운드에 걸쳐 검토·보류된
저위험 트레이드오프로, 판단이 안정적이다. 순환 의존·레이어 위반·과도한 추상화·안티패턴은
발견되지 않았다. 저장소 파일에 대한 뮤테이션은 수행하지 않았다(정적 리뷰 + `Read`/`Bash git
diff --stat` 확인만 사용) — `git status --short` 기준 이 세션이 만든 코드 변경 없음.

## 위험도

NONE
