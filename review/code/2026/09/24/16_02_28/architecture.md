# 아키텍처(Architecture) 리뷰

## 검토 범위 확인

이번 changeset(57개 파일) 중 실제 실행 코드/설정 변경은 5개뿐이다 — `codebase/backend/jest.config.ts`,
`codebase/backend/package.json`(scripts), `codebase/backend/test/jest-e2e.json`,
`codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`(신규), `PROJECT.md`(정책 문서
1문장 추가). `plan/in-progress/*.md` 3건은 작업 계획 문서이고, 나머지 약 48개
(`review/code/2026/09/24/{14_24_10,15_26_17}/**`, `review/consistency/2026/09/24/{12_57_36,13_55_20}/**`)는
**1·2라운드 리뷰 산출물을 저장소 규약(`CLAUDE.md` §정보 저장 위치)에 따라 커밋에 편입**한 텍스트
산출물이다 — 코드가 아니며, 이번 3라운드가 그 결론을 다시 낼 이유가 없다.

직전 두 아키텍처 라운드(`review/code/2026/09/24/14_24_10/architecture.md` WARNING 1건,
`review/code/2026/09/24/15_26_17/architecture.md` — WARNING 재발 없음 확인, 위험도 NONE)의 판정이
현재 워킹트리 상태와 여전히 일치하는지 직접 파일을 열어 재확인했다:

- `codebase/backend/package.json:22-26` — `test`/`test:watch`/`test:cov`/`test:debug`/`test:e2e`
  5개 스크립트 전부 `node --experimental-vm-modules ./node_modules/jest/bin/jest.js` 로 통일돼
  있다(1라운드 WARNING — `test:debug` 만 `node_modules/.bin/jest` 잔존 — 조치 확인).
- `codebase/backend/jest.config.ts:41`, `codebase/backend/test/jest-e2e.json:9` —
  `transformIgnorePatterns` 가 양쪽 다 `['/node_modules/']` 기본값으로 일치한다.
- `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` — 2라운드 Warning 1
  (script 텍스트 자체를 지키는 가드 부재)에 대응해 "jest 를 띄우는 script 전부가 같은
  플래그·진입점을 쓴다" 테스트가 실제로 추가돼 있고, 5개 스크립트 명단을 `toEqual` 로 못박아
  6번째 스크립트가 접두어 없이 조용히 추가되는 경로도 막는다.
- `plan/in-progress/nestjs-v12-coordinated-upgrade.md:5` — `worktree: (unstarted)` 로
  `plan-scan.ts` 의 sentinel 과 일치(1라운드 CRITICAL 조치 확인).

## 발견사항

- **[INFO]** 두 plan 문서(`jest-esm-native-load.md` ↔ `nestjs-v12-coordinated-upgrade.md`) 간
  의존 방향이 여전히 단방향이며 순환 없음 — 재확인
  - 위치: `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §B("선행 조건") ↔
    `plan/in-progress/jest-esm-native-load.md`
  - 상세: 후자(선행)를 전자(후속)가 참조하고 역참조는 없다. "부분 메이저 범프는 성립하지
    않는 중간 상태" 라는 제약을 계획 단계에서 명시적으로 스코프 경계로 고정한 것은 모듈
    경계 관점에서 여전히 타당하다. 직전 라운드 관찰과 동일하며 이번 diff 로 이 구조가
    바뀌지 않았다.
  - 제안: 없음.

- **[INFO]** 신규 repo-guard 가 애플리케이션 코드 트리에서 테스트 인프라 설정 파일의 구체
  경로에 의존하는 역방향 결합 — 기존 관례와 일치하므로 신규 리스크 아님
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`
    (`path.resolve(__dirname, '../../../test/jest-e2e.json')`, `../../../package.json`)
  - 상세: `src/repo-guards` 트리(애플리케이션 코드 경계 안)가 `test/jest-e2e.json`·`package.json`
    이라는 빌드/테스트 설정 파일의 상대 경로를 하드코딩해 읽는다. 계층상 "테스트가 설정을
    검증"하는 방향은 자연스럽지만 "src 트리의 guard 가 프로젝트 루트 설정 파일 경로를 아는"
    것은 통상적인 레이어 분리 기준으로는 역방향이다. 다만 이 저장소는 이미
    `production-build-devdep-guard.ts` 등으로 "빌드/툴체인 불변식을 `src/repo-guards`에서
    정적으로 검증"하는 관례를 여러 건 갖고 있고, 두 라운드 전부터 이 패턴을 신규 리스크가
    아닌 것으로 판단해 왔다. 이번 3라운드에서도 그 판단을 뒤집을 새 근거는 없다.
  - 제안: 없음 — 기존 선례를 따르는 정상적 확장.

- **[INFO]** OCP 개선(손-유지 allowlist → 기본값 + 네이티브 ESM 로딩) — 3라운드째 동일 결론
  - 위치: `codebase/backend/jest.config.ts:19-41`, `codebase/backend/test/jest-e2e.json:9`
  - 상세: 새 ESM-only 의존성이 추가돼도(`@nestjs/typeorm@12`의 `import.meta.url`처럼 CJS로
    원리적으로 downlevel 불가능한 경우 포함) 설정 파일을 다시 열어 정규식에 패키지명을
    추가할 필요가 없어졌다 — "확장에는 열려 있고 수정에는 닫혀 있다"는 방향의 실질 개선이며,
    unit/e2e 두 설정이 이미 서로 어긋나 있었다는 근본 원인도 함께 제거됐다. 코드 자체가
    1·2라운드 이후 바뀌지 않았으므로 재확인만 한다.
  - 제안: 없음.

- **[INFO]** 5개 npm 스크립트의 공통 접두어 중복 — 이미 두 차례 검토·보류된 트레이드오프,
  이번 라운드도 재지적만
  - 위치: `codebase/backend/package.json:22-26`
  - 상세: `node --experimental-vm-modules ./node_modules/jest/bin/jest.js` 15단어 접두어가
    5곳(사실상 `test:debug` 포함 전부)에 문자 그대로 반복된다. Node 가 이 플래그를 stable로
    승격하며 이름이 바뀌거나 제거되면 5곳을 동시에 고쳐야 하는 단일 진실 지점 부재 리스크가
    남아 있다. 1·2라운드 모두 "현재 규모(5줄)에서 셸 스크립트로 뽑는 것은 오히려 간접층을
    추가하는 비용이 더 크다"는 근거로 defer 했고, `esm-native-load.spec.ts` 의 신규 텍스트
    대조 가드가 적어도 "드리프트(표기 불일치)"는 정적으로 잡아 주므로 중복 자체의 위험도는
    완화됐다. 이번 라운드에서 이 판단을 뒤집을 새 정보는 없다.
  - 제안: 없음 — blocking 아님, 기존 판단 유지.

## 요약

이번 changeset의 실질 아키텍처 표면은 1·2라운드와 동일하게 backend Jest 테스트 러너의 모듈
로딩 방식 전환(설정 3개 파일 + repo-guard 스펙 1개)에 국한되며, 프로덕션 런타임 레이어·API
계약·모듈 경계·레이어 책임 분리와는 무관하다. 직접 파일을 열어 대조한 결과 1라운드 CRITICAL
(plan `worktree` placeholder)과 1·2라운드 WARNING(`test:debug` 표기 드리프트, script 텍스트를
지키는 가드 부재)이 실제로 조치돼 현재 워킹트리에 반영돼 있음을 확인했다 — 재발 없음. 새로
발견된 CRITICAL/WARNING 급 아키텍처 결함은 없다. 손-유지 allowlist 제거는 OCP 관점의 실질
개선이고, 신규 repo-guard 의 역방향 결합·15개 스펙 중 소수(2개)가 guard 파일 분리 관례를
따르지 않는 점·5개 스크립트의 접두어 중복은 모두 기존 선례와 일치하거나 이미 검토·보류된
저위험 트레이드오프로, 세 라운드에 걸쳐 판단이 안정적이다. 순환 의존·레이어 위반·과도한
추상화·안티패턴은 발견되지 않았다. 저장소 파일에 대한 뮤테이션은 수행하지 않았다(정적
리뷰 + `Read`/`Bash cat` 확인만 사용) — `git status --short` 기준 이 세션이 만든 변경 없음.

## 위험도

NONE
