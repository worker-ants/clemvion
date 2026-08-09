# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 테스트 파일에서 export 된 함수가 사실상 비공식 공개 인터페이스가 됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:57` (`isGateCEnforced`), `:63`(`hasMalformedStarted`), `:68`(`hasValidSpecImpact`), `:96`(`danglingSpecImpact`), `:112`(`makeSpecExists`)
  - 상세: `.test.ts` 파일에서 프로덕션 판정 로직을 `export` 하고 있어, 다른 모듈이 이를 import 하면 "테스트 파일 변경 = 프로덕션 인터페이스 변경"이 되는 결합이 생긴다. 실제로 grep 결과 현재 이 함수들을 외부에서 import 하는 곳은 없어(같은 파일 내부 호출뿐) **지금 시점엔 파급 없음**을 확인했다. 다만 이 상태는 커밋 메시지(`4e1995cb8`) 자체가 "판정이 `.test.ts` 안에 산다"는 사실을 알고 있고, 그 이동을 `plan/in-progress/docs-guard-walker-dedup.md` 로 등재해 별도 작업으로 미룬 기결정 사항이다.
  - 제안: 현 상태 유지는 문제 없음(이미 추적 중). 향후 다른 스크립트가 이 함수들을 재사용하려는 시점에 `docs-guard-walker-dedup.md` 작업을 선행할 것.

- **[INFO]** 함수 시그니처가 "파싱된 값" → "frontmatter 원문 블록"으로 변경됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:47-60` (`startedDate`, `isGateCEnforced`), `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:214-225`(`rawScalar` 매칭 범위 축소: `^[ \t]*key:` → `^key:`)
  - 상세: 두 시그니처 모두 의도적 변경(JSDoc이 근거를 명시)이며, grep 으로 저장소 전체를 확인한 결과 두 함수 모두 같은 파일 내부에서만 호출된다. 외부 호출자에 대한 파급 효과 없음.
  - 제안: 없음(정보 제공용).

- **[INFO]** `makeSpecExists` 는 `fs.statSync`(symlink 추종)를 쓰고, traversal 가드는 리터럴 경로 문자열의 `path.resolve` 결과에만 적용됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:112-133`
  - 상세: `spec/` 하위로 정규화된 경로인지는 정확히 검증하지만(직전 커밋 `6aacded22` 가 `..` 우회를 막음), `spec/` 안에 실제로 심볼릭 링크가 존재하고 그 링크가 저장소 밖 파일을 가리키는 경우 `statSync().isFile()` 은 링크를 따라가 `true` 를 반환할 수 있다. 즉 traversal 가드는 "경로 문자열이 `spec/` 하위인가"만 보장하고 "그 경로가 가리키는 실제 파일이 `spec/` 물리적 하위인가"까지는 보장하지 않는다.
  - 제안: 이 저장소에 `spec/` 하위 symlink 를 두는 관행/도구가 없다면 실질 위험은 낮음(수정 불필요). 우려된다면 `fs.lstatSync` 로 symlink 여부를 먼저 배제하거나 realpath 비교를 추가.

- **[INFO, 검증 완료]** `parseFrontmatterSafe` 의 `matter(raw, {})` 가 실제로 gray-matter 의 모듈 전역 캐시(`matter.cache`)를 우회하는지 소스로 직접 확인함
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:121-128`
  - 상세: `node_modules/gray-matter/index.js` 를 직접 열어 확인한 결과, `matter(input, options)` 는 `if (!options)` 분기에서만 `matter.cache` 를 조회/기록한다. `{}` 는 truthy 이므로 `!options` 가 `false` 가 되어 캐시 조회·기록 분기 전체를 건너뛴다 — JSDoc 이 주장하는 "빈 옵션 객체가 파일 간(정확히는 동일 파일 내 반복 호출 간) 캐시 오염을 막는다"는 설명이 실제 구현과 정확히 일치한다. 이 모듈 자체가 도입하는 전역 상태(`matter.cache`)에 대한 **의도적·검증된 방어**이며 잔존 결함 없음.
  - 제안: 없음(정보 제공용 — 후속 리뷰가 이 주장을 재검증할 때 참조).

- **[INFO]** `plan-scan.test.ts` 의 fixture 파일시스템 부작용은 OS 임시 디렉터리로 격리되어 실 저장소에 영향 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts:37-38`(`beforeAll`/`mkdtempSync`), `:72-74`(`afterAll`/`rmSync`), `:370-382`(두 번째 `describe` 의 별도 fixture 쌍)
  - 상세: `fs.writeFileSync`/`fs.mkdirSync` 는 전부 `os.tmpdir()` 기반 `mkdtempSync` 산출 경로 하위에만 쓰고, 각 `describe` 블록이 독립된 `root` 변수와 `afterAll` cleanup 을 갖는다. 실 저장소(`plan/**`) 파일을 생성·수정·삭제하지 않는다. `spec-plan-completion.test.ts` 는 반대로 실 저장소 `plan/complete/**` 를 읽지만 전부 읽기 전용(`fs.readFileSync`/`readdirSync`/`existsSync`/`statSync`)이라 쓰기 부작용 없음.
  - 제안: 없음 — 정상적인 테스트 격리 패턴.

- **[INFO]** 전역 상태/환경 변수/네트워크 호출 없음
  - 위치: 3개 파일 전체
  - 상세: 세 파일 모두 모듈 top-level 상수(`GATE_C_CUTOFF`, `NONE_VALUES`, `TERMINAL_PLAN_STATUSES`, `WORKTREE_SENTINEL`, `WORKTREE_PLACEHOLDER`, `ISO_DATE`)는 전부 `const`/`ReadonlySet` 이며 런타임에 재할당되지 않는다. `process.env` 읽기·쓰기, `fetch`/HTTP 호출, 이벤트 emitter/콜백 등록은 어디에도 없다.
  - 제안: 없음.

## 요약

세 파일 모두 `codebase/frontend/src/lib/docs/__tests__/` 안의 테스트·테스트 헬퍼 코드로, 실 저장소 프로덕션 코드나 런타임 동작에는 영향을 주지 않는다. 파일시스템 접근은 (1) 실 저장소 `plan/complete/**`·`spec/**` 에 대한 읽기 전용 스캔, (2) `os.tmpdir()` 격리 임시 디렉터리에 대한 fixture 생성/삭제(모두 `afterAll` 로 정리)로 나뉘며 어느 쪽도 실 저장소 파일을 쓰거나 지우지 않는다. 시그니처 변경(`isGateCEnforced` 등 파싱값→원문 블록, `rawScalar` 매칭 범위 축소)은 grep 으로 전수 확인한 결과 모두 동일 파일 내부에서만 소비되어 외부 호출자에 대한 파급이 없다. `.test.ts` 에서 판정 로직을 export 하는 구조적 결합과 `makeSpecExists` 의 symlink-follow 여지는 실질 위험이 낮은 기지(既知) 사안으로 INFO 로만 기록한다. gray-matter 캐시 우회 주장은 라이브러리 소스를 직접 대조해 사실로 검증했다. CRITICAL/WARNING 급 부작용은 발견되지 않았다.

## 위험도

LOW
