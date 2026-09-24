# 아키텍처(Architecture) 리뷰

## 검토 범위 확인

이번 changeset(39개 파일) 중 실제 실행 코드/설정 변경은 4개뿐이다 — `codebase/backend/jest.config.ts`,
`codebase/backend/package.json`(scripts), `codebase/backend/test/jest-e2e.json`,
`codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`(신규). `PROJECT.md` 는 정책 문서
1문장 추가, `plan/in-progress/*.md` 2건은 작업 계획 문서, 나머지 30개(`review/code/2026/09/24/14_24_10/**`,
`review/consistency/2026/09/24/{12_57_36,13_55_20}/**`, `RESOLUTION.md`)는 **직전 라운드의 리뷰
산출물을 저장소 규약(`CLAUDE.md` §정보 저장 위치)에 따라 커밋에 편입**한 것이다 — 코드가 아니다.

직전 아키텍처 라운드(`review/code/2026/09/24/14_24_10/architecture.md`)가 지적한 WARNING(`test:debug` 만
`node_modules/.bin/jest` 셸 셈을 그대로 남겨 나머지 4개 스크립트와 표기가 갈라진 문제)이 이번 diff의
`package.json` 에서 실제로 고쳐졌는지 직접 확인했다 — 5개 스크립트(`test`/`test:watch`/`test:cov`/
`test:debug`/`test:e2e`) 전부 `./node_modules/jest/bin/jest.js` 로 통일돼 있다. `RESOLUTION.md` 가
주장하는 조치 내역과 실제 파일 상태가 일치한다.

## 발견사항

- **[INFO]** 새 repo-guard 스펙이 unit/e2e 두 설정 파일 간 drift 를 정적으로 봉인하는 단일 진실 지점 역할을 한다 — 설계상 개선
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`
  - 상세: 이 PR 이 제거한 손-유지 allowlist 는 애초에 `jest.config.ts`(6개 패키지)와
    `test/jest-e2e.json`(3개 패키지)이 이미 서로 어긋나 있었다는 근본 원인을 갖고 있었다.
    새 가드는 e2e 설정 파일을 직접 읽어(`fs.readFileSync` + `JSON.parse`) unit 쪽 기대값과
    비교하는 세 번째 테스트를 둠으로써, "두 설정 파일이 각자 손으로 유지되며 갈라진다" 는
    이 PR 이 고친 문제의 재발을 하나의 지점에서 구조적으로 막는다. 결합도 관점에서는
    `src/repo-guards` 트리(애플리케이션 코드)가 `test/jest-e2e.json`(테스트 인프라 설정)의
    구체 경로에 의존하는 역방향 결합이 생기지만, 이 저장소는 이미 `production-build-devdep-guard.ts`
    등으로 "빌드/툴체인 불변식을 `src/repo-guards`에서 정적으로 검증"하는 관례를 갖고 있어
    새로운 패턴이 아니다.
  - 제안: 없음 — 긍정적 관찰.

- **[INFO]** `esm-native-load.spec.ts` 는 이 디렉터리의 지배적 관례(`<name>-guard.ts` + `<name>.spec.ts`
  분리)를 따르지 않고 로직을 스펙 파일에 직접 내장한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (전체)
  - 상세: `codebase/backend/src/repo-guards/__tests__/` 안의 15개 스펙 중 13개는 `<name>-guard.ts`(순수
    검증 로직)와 `<name>.spec.ts`(그 로직을 호출하는 테스트)로 분리돼 있다. 이번 신규 파일은
    `workspace-roles-attachment.spec.ts` 와 마찬가지로 별도 guard 파일 없이 스펙 안에 직접
    import·assert 로직을 담는 두 번째 사례다 — 다만 이 파일의 검증 내용(uuid 패키지의 `type`
    필드 확인, 실제 로드 성공 여부, 두 설정 파일 JSON 대조)은 재사용 가능한 순수 함수로 뽑을
    만큼 복잡하지 않아 분리 생략이 합리적이다. 디렉터리 안에 두 관례가 공존하는 것 자체는
    이미 존재하던 상태이므로 이번 PR 이 새로 만든 불일치는 아니다.
  - 제안: 없음 — 기존 선례(`workspace-roles-attachment.spec.ts`)와 일치하므로 조치 불요.

- **[INFO]** OCP 관점 개선 — 손-유지 allowlist 제거로 "확장 시 설정 수정 불필요" 가 됨 (직전 라운드 관찰과 일치, 재확인)
  - 위치: `codebase/backend/jest.config.ts:19-41`, `codebase/backend/test/jest-e2e.json:9`
  - 상세: 기존 `transformIgnorePatterns` 는 새 ESM 패키지가 등장할 때마다 정규식에 사람이
    패키지명을 추가해야 하는 구조였고(닫혀 있지 않은 확장점), 실제로 unit/e2e 두 곳이 이미
    어긋나 있었다. `--experimental-vm-modules` + 기본값 전환은 새 ESM-only 의존성(`@nestjs/typeorm@12`
    의 `import.meta.url` 처럼 CJS 로 원리적으로 downlevel 불가능한 것 포함)을 설정 변경 없이
    수용하므로, "확장에는 열려 있고 수정에는 닫혀 있다"는 방향으로 실질 개선이다. 직전
    아키텍처 라운드가 이미 이 점을 INFO 로 적었고, 이번 diff 로 코드가 바뀌지 않았으므로
    재확인만 한다.
  - 제안: 없음.

- **[INFO]** 두 plan 문서(`jest-esm-native-load.md` ↔ `nestjs-v12-coordinated-upgrade.md`) 사이 의존
  방향이 단방향이고 순환이 없음을 확인
  - 위치: `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §B("선행 조건") ↔
    `plan/in-progress/jest-esm-native-load.md`
  - 상세: 후자가 전자를 선행 조건으로 참조("`@nestjs/typeorm@12` 를 CJS jest 가 로드하지 못한다")
    하고, 전자는 후자를 참조하지 않는다 — 단방향 의존이며 부분 메이저 범프라는 "성립하지 않는
    중간 상태"를 시도하지 않도록 스코프 경계를 계획 단계에서 명시한 사례다. 순환 참조 없음.
  - 제안: 없음.

- **[INFO]** 5개 npm 스크립트에 `node --experimental-vm-modules ./node_modules/jest/bin/jest.js` 접두어가
  반복되는 중복은 이번 diff 에도 그대로 남아 있음 — 이미 인지·평가된 트레이드오프이므로 재지적만
  - 위치: `codebase/backend/package.json:22-26`
  - 상세: `RESOLUTION.md` 는 이 접두어 단일화(별도 셸 스크립트/헬퍼로 추출)를 "reviewer 스스로
    우선순위 낮음으로 냈고, 단일화가 오히려 간접층을 만든다" 는 근거로 조치하지 않기로 명시적으로
    판단했다. `package.json` scripts 필드에서 공통 접두어를 5곳에 문자 그대로 복제하는 것은
    Node 관용구 안에서 흔한 패턴이고, 이 저장소에 셸 스크립트로 뽑는 대안이 다른 곳에도 선례가
    없어 새 간접층을 만드는 비용이 실질적으로 존재한다는 판단에 동의한다. 다만 향후 플래그가
    Node 에서 안정화되어 제거될 때 5곳을 동시에 고쳐야 한다는 점은 여전히 유효한 리스크이므로,
    "이미 검토·보류됐다" 는 사실을 여기 남긴다(새로운 지적 아님, 재차단 아님).
  - 제안: 없음 — blocking 아님, 판단 유지.

## 요약

이번 changeset의 실질 아키텍처 표면은 backend Jest 테스트 러너의 모듈 로딩 방식 전환(설정 3개 파일 +
신규 repo-guard 스펙 1개)에 국한되며, 프로덕션 런타임 레이어·API 계약·모듈 경계·레이어 책임 분리와는
무관하다. 손으로 유지하던 ESM allowlist(이미 unit/e2e 간 drift 가 있었다)를 jest 기본값 + 네이티브
ESM 로딩으로 대체한 것은 개방-폐쇄 원칙 관점에서 실질적 개선이며, 그 불변식("플래그와 기본 허용목록은
한 쌍")을 지키는 전용 repo-guard 스펙을 신설해 우연한 커버리지에서 이름 붙은 회귀 테스트로 격상한
점도 설계상 타당하다(기존 `production-build-devdep-guard.ts` 류 관례와 일치). 직전 아키텍처 라운드가
지적한 유일한 WARNING(`test:debug` 스크립트의 표기 드리프트)은 이번 diff 에서 실제로 고쳐졌음을
파일을 직접 열어 확인했다. 순환 의존·레이어 위반·과도한 추상화·anti-pattern 은 발견되지 않았고,
남아 있는 스크립트 접두어 중복은 이미 검토·보류된 저위험 트레이드오프다. 저장소 파일에 대한 뮤테이션은
수행하지 않았다(정적 리뷰 + `Read`/`Bash cat`/`node -e` 확인만 사용) — `git status --short` 확인은
불필요하다(트리에 쓰기 없음).

## 위험도

NONE
