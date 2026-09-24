# 아키텍처(Architecture) 리뷰

## 검토 범위 확인

`git diff origin/main...HEAD --stat -- codebase/ PROJECT.md` 로 실제 코드/설정 diff 를 직접
확인했다 — 5개 파일, 163 삽입/22 삭제:

- `PROJECT.md` (정책 문서 1문장 보강)
- `codebase/backend/jest.config.ts` (`transformIgnorePatterns` 허용목록 제거 + 주석)
- `codebase/backend/package.json` (`scripts.test*` 5개, `--experimental-vm-modules` 도입)
- `codebase/backend/test/jest-e2e.json` (`transformIgnorePatterns` 를 기본값으로)
- `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (신규 repo-guard 스펙)

프롬프트에 나열된 나머지 약 88개 파일(`plan/in-progress/*.md`, `review/code/2026/09/24/{14_24_10,
15_26_17,16_02_28,16_29_15}/**`, `review/consistency/2026/09/24/{12_57_36,13_55_20}/**`)은 이전
4개 리뷰 라운드의 산출물을 저장소 규약(`CLAUDE.md` §정보 저장 위치)에 따라 커밋에 편입한 텍스트이거나
plan 문서다 — 코드가 아니며, 이번 5라운드가 그 결론을 다시 낼 이유가 없다.

이번 라운드는 4라운드(`review/code/2026/09/24/16_29_15`)가 지적한 Warning 1(census 가드가
플래그↔진입점 **순서**는 보지만 `test:debug` 의 `-r tsconfig-paths/register`·`-r ts-node/register`
**위치**는 안 봄)에 대한 조치(`00791d3c8`)가 **반영된 뒤의 상태**를 검토한다 — 즉 architecture
관점에서는 실질적으로 새로운 코드(재작성된 `esm-native-load.spec.ts`)를 처음 보는 라운드다.

## 발견사항

- **[INFO]** 4라운드 Warning 수정이 「자리 열거」에서 「형태 선언」으로 설계를 바꿨다 — 이전 세 라운드가 반복하던 회귀 패턴을 구조적으로 닫음
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (`it('jest 를 띄우는 script 전부가 node 인자 구간을 그대로 유지한다', ...)` 블록, `NODE_ARGS` 상수 정의부)
  - 상세: 이전 구현(1~4라운드에 걸쳐 세 번 뚫린 형태)은 "플래그가 존재하는가" → "플래그가 진입점보다 앞에 있는가" 순으로 **점검 항목을 하나씩 열거**하는 방식이었고, 매번 열거되지 않은 다음 자리(셸 shim 진입점 → 순서 → `-r` 옵션 순서)가 남았다. 현재 버전은 이를 뒤집어 script 별로 "node 가 해석해야 하는 인자 구간 전체 + 진입점" 을 하나의 문자열(`expectedPrefix`)로 선언하고, 실행 커맨드의 앞부분을 그 길이만큼 잘라 **값 동치**로 비교한다. 이는 화이트리스트 열거(개별 불변식을 계속 추가해야 하는, 닫혀 있지 않은 확장점)에서 골든 값 비교(형태 자체를 고정하는, 새로운 회귀 클래스를 구조적으로 포괄하는 방식)로의 설계 전환이며, 개방-폐쇄 원칙 관점에서 "이 종류의 모든 순서 결함"에 대해 닫혀 있다. 대가(정당한 node 옵션 변경도 실패시킴)를 스펙 주석(`:82-87`)에 명시적으로 남긴 점도 "문서한 보장이 구현보다 넓어지지 않게" 하는 이 저장소의 관례와 일치한다.
  - 제안: 없음 — 설계 개선으로 판단.

- **[INFO]** 신규 census 가드가 `package.json`(scripts)·`test/jest-e2e.json` 두 설정 파일의 정확한 값을 테스트 코드 안에 재선언(mirroring)한다 — 의도된 트레이드오프, 새 리스크 아님
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts:88-95`(`NODE_ARGS` 리터럴), `:118-127`(e2e `transformIgnorePatterns` 기대값 리터럴)
  - 상세: 두 블록 모두 원본 설정 파일(`package.json`·`test/jest-e2e.json`)의 값을 그대로 문자열/배열 리터럴로 다시 적어 넣고 `fs.readFileSync`+`JSON.parse` 로 읽은 실제 값과 대조한다. 구조적으로는 "단일 진실을 두 곳에 쓰고 대조한다"는 형태라 DRY 원칙과 긴장 관계에 있지만, 이 파일의 목적 자체가 **드리프트 탐지**(과거 unit/e2e 허용목록이 서로 어긋난 근본 원인)이므로 골든 값을 코드 안에 갖는 것은 설계상 불가피하다. 스펙 헤더 주석(`:41-45`)이 "행동 검증이 아니라 설정 대조"라고 스스로 보증 범위를 명시해 두어 다음 사람이 이 가드를 실제 런타임 동작 검증으로 오독할 여지도 낮다.
  - 제안: 없음.

- **[INFO]** `src/repo-guards` 트리(애플리케이션 코드 경계 안)가 프로젝트 루트 설정 파일 경로를 하드코딩해 읽는 역방향 결합 — 5라운드째 동일 결론, 변경 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts:62`(`path.resolve(__dirname, '../../../package.json')`), `:119-122`(`path.resolve(__dirname, '../../../test/jest-e2e.json')`)
  - 상세: `production-build-devdep-guard.ts` 등 "빌드/툴체인 불변식을 `src/repo-guards`에서 정적으로 검증"하는 기존 관례와 일치하는 패턴이며, 1~4라운드에서 이미 신규 리스크가 아닌 것으로 판단해 왔다. 이번 라운드에서 그 판단을 뒤집을 새 근거는 없다.
  - 제안: 없음.

- **[INFO]** 손-유지 ESM allowlist 제거는 OCP(개방-폐쇄) 관점 실질 개선 — 5라운드째 동일 결론, 코드 변경 없음
  - 위치: `codebase/backend/jest.config.ts:19-41`, `codebase/backend/test/jest-e2e.json:9`
  - 상세: 신규 ESM-only 의존성(`@nestjs/typeorm@12` 의 `import.meta.url` 처럼 CJS 로 downlevel 이 원리적으로 불가능한 경우 포함)이 등장해도 설정 파일의 정규식에 패키지명을 추가할 필요가 없다. `jest.config.ts`(6개 패키지)와 `test/jest-e2e.json`(3개 패키지)이 이미 서로 어긋나 있었다는 근본 결함도 기본값 전환으로 함께 제거됐다.
  - 제안: 없음.

- **[INFO]** 두 plan 문서(`jest-esm-native-load.md` ↔ `nestjs-v12-coordinated-upgrade.md`) 간 의존 방향이 단방향 — 순환 없음, 재확인
  - 위치: `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §B("선행 조건") ↔ `plan/in-progress/jest-esm-native-load.md`
  - 상세: 후속 plan 이 선행 plan 을 참조하고 역참조는 없다. "부분 메이저 범프는 성립하지 않는 중간 상태"라는 제약(§A 실측: `@nestjs/platform-express@12` 단독 범프는 `ERR_MODULE_NOT_FOUND` 로 런타임 사망)을 계획 단계에서 스코프 경계로 명시해, 이번 PR 의 책임(테스트 러너의 ESM 네이티브 로딩)과 다음 PR 의 책임(NestJS 12 동반 업그레이드)을 분리했다.
  - 제안: 없음.

- **[INFO]** 5개 npm 스크립트의 `node --experimental-vm-modules ./node_modules/jest/bin/jest.js` 접두어 반복 — 네 라운드 연속 검토·보류된 저위험 트레이드오프, 이번 라운드도 재지적만
  - 위치: `codebase/backend/package.json:22-26`
  - 상세: 15단어 접두어가 5곳(사실상 전부, `test:debug` 포함)에 문자 그대로 반복된다. Node 가 이 플래그를 stable 로 승격하며 이름이 바뀌거나 제거되면 5곳을 동시에 고쳐야 하는 단일 진실 지점 부재가 남는다. 다만 이번 라운드에서 강화된 census 가드(`NODE_ARGS` 명시적 선언 + 접두어 값 비교)가 "표기 드리프트"뿐 아니라 "순서/구간 드리프트"까지 정적으로 잡아 주므로, 중복 자체가 유발하던 실제 위험(1라운드 `test:debug` 셸 shim, 4라운드 `-r` 순서)의 재발 가능성은 한층 더 완화됐다. 1~4라운드 모두 "현재 규모(5줄)에서 셸 스크립트로 뽑는 것은 오히려 이 저장소에 선례 없는 새 간접층을 추가하는 비용이 더 크다"는 근거로 defer 했고, 이 판단을 뒤집을 새 정보는 이번 라운드에도 없다.
  - 제안: 없음 — blocking 아님, 기존 판단 유지.

## 요약

이번 changeset 의 실질 아키텍처 표면은 5라운드에 걸쳐 이미 확정된 것과 동일하게 backend Jest
테스트 러너의 모듈 로딩 방식 전환(설정 파일 3개 + repo-guard 스펙 1개)에 국한되며, 프로덕션
런타임 레이어·API 계약·서비스 간 모듈 경계·레이어 책임 분리와는 무관하다. `git diff
origin/main...HEAD --stat` 으로 실제 코드 diff 파일 목록이 4라운드 이후 그대로임을 확인했고,
유일한 실질 변경은 4라운드 Warning(census 가드가 `-r` 옵션 순서를 못 봄)에 대한 조치로
`esm-native-load.spec.ts` 의 census 테스트가 "자리 열거" 방식에서 "node 인자 구간 전체를
문자열로 선언해 값 동치 비교" 방식으로 재설계된 것이다 — 이는 같은 형태의 결함이 세 번
재발한 뒤 나온 구조적 개선으로, 특정 옵션이 아니라 "명령 형태" 자체를 불변식으로 고정해
향후 유사 회귀 클래스 전체를 구조적으로 포괄한다. 그 대가(정당한 node 옵션 변경도 실패
처리됨)를 스펙 주석에 명시적으로 남긴 것도 보증 범위를 구현과 일치시키는 이 저장소의
관례와 부합한다. 신규 repo-guard 의 역방향 결합(`src/` → 루트 설정 파일 경로 하드코딩)·
5개 스크립트의 접두어 중복·plan 문서 간 단방향 의존은 모두 1~4라운드에 걸쳐 이미 검토·
보류되었거나 기존 선례와 일치하는 저위험 관찰로, 판단이 다섯 라운드 연속 안정적이다.
순환 의존·레이어 위반·과도한 추상화·안티패턴은 발견되지 않았다. 저장소 파일에 대한
뮤테이션은 수행하지 않았다(정적 리뷰 + `Read`/`Bash git diff --stat` 확인만 사용) —
`git status --short` 기준 이 세션이 만든 코드 변경 없음.

## 위험도

NONE
