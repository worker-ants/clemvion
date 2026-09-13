# 성능(Performance) 리뷰 — guide-identifier-existence (라운드 4 / 최종 수렴)

## 범위 안내

이번 changeset(98개 파일)에서 런타임 성능에 관계되는 코드는 여전히
`codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` /
`guide-identifier-scan.ts`(구 `guide-error-code-existence.test.ts` / `guide-error-code-scan.ts` 삭제 후
대체) 뿐이다. `guide-sanitized-message-parity.test.ts` 는 주석(JSDoc) 한 줄 교체뿐이라 실행 경로에
영향이 없다. 나머지(`CHANGELOG.md`·`PROJECT.md`·`plan/in-progress/*.md`·
`review/code/2026/09/13/{14_41_14,15_03_06,15_24_12}/**`·`review/consistency/**`)는 전부 이전
라운드들의 리뷰/컨시스턴시 산출물과 plan 문서로, 문서·리포트일 뿐 실행되지 않는다.

**이번 라운드(`15_42_54`)에서 실제 코드는 이전 라운드(`15_24_12`) 이후 변경되지 않았다.**
`git log -- codebase/.../guide-identifier-scan.ts codebase/.../guide-identifier-existence.test.ts` 로
확인한 결과 마지막 코드 커밋은 `b75fe0ace`(라운드 3 fix)이며, 그 커밋이 `guide-identifier-existence.test.ts`
에 추가한 유일한 변경은 트리비얼한 합성-fixture 테스트 12줄(`LLM`/`HTTP`처럼 밑줄 없는 약어는
안 잡고 `LLM_TIMEOUT`은 잡는다는 대조군 — `git show b75fe0ace` 로 diff 직접 확인)이며, 이는 in-memory
문자열 하나를 순수 함수에 넣는 호출이라 성능 영향이 없다. 즉 이 라운드가 커밋하는 내용은 실질적으로
"라운드 1~3 리뷰·컨시스턴시 산출물 및 plan 문서를 저장소에 반영"하는 것이며, 코드 자체에 대한
신규 성능 델타는 없다.

두 실행 파일(`guide-identifier-scan.ts`, `guide-identifier-existence.test.ts`)을 직접 `Read` 로 열어
독립적으로 재확인했다.

## 발견사항

- **[INFO]** `composeTexts` 파일 스코프는 이전 라운드(`14_41_14`)의 WARNING(루트의 모든
  `.yml`/`.yaml`을 읽어 `pnpm-lock.yaml` 784KB까지 스캔) 해소 상태가 그대로 유지됨 — 재확인, 회귀 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:55-58`
  - 상세: `fs.readdirSync(root).filter((f) => /^docker-compose.*\.ya?ml$/.test(f))` 로 파일명까지
    거른다. 직접 `Read` 로 확인했고 이 라운드의 diff 도 이 블록을 건드리지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `collectEnvDeclarations`/env 기준집합 병합은 여전히 매 실행마다 무조건 계산되며,
  코드 스스로 "오늘 판정을 지탱하지 않는다"고 명시(뮤턴트 실측 포함)함 — 절대 비용은 미미
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:183-190`
    (`collectEnvDeclarations` docstring), `guide-identifier-existence.test.ts:34-37,55-61`
    (env/compose 텍스트 로딩 및 `basis` 병합)
  - 상세: `.env.example` 2개 파일 + `docker-compose*.yml` 소수 파일을 읽어 정규식으로 훑는 비용은
    (수백 줄 규모) 테스트 스위트 전체 실행 시간 대비 무시할 수준이다. "내일의 오탐 방지"라는
    트레이드오프가 코드 주석·plan·회귀 테스트 세 곳에 일관되게 disclose 되어 있어 결함이 아니라
    참고 사항으로 남긴다.
  - 제안: 조치 불요.

- **[INFO]** 가드 계열 전체가 `codebase/backend/src` + `codebase/packages` 소스를 가드 파일별로
  독립적으로 재순회·재적재(walk + read)하는 기존 구조가 유지됨 — 이번 PR 이 새로 만든 비용 증가는
  없음(1:1 대체)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:45-48`
    (`walkTree(root, ["codebase/backend/src", "codebase/packages"], …).map(f => fs.readFileSync(...))`)
  - 상세: `describe()` 콜백은 vitest 수집 시점에 파일당 1회만 실행되므로, 이 파일 내부 다수 `it()`
    블록이 소스 재적재를 반복하지는 않는다(N+1 아님). 다만 이 저장소의 자매 가드들(`impl-anchor-existence.test.ts`
    등)이 각자 같은 두 디렉터리를 독립적으로 walk 하는 구조는 가드 개수가 늘수록 스위트 전체의
    I/O+정규식 스캔 총량이 가드 수에 비례해 선형으로 커진다. 세 번째 라운드까지 반복 지적된
    구조적 여지이며, 이번 PR 범위의 회귀는 아니다.
  - 제안: 이번 PR 범위에서 조치 불요. 이 폴더에 가드가 계속 늘어나면 backend+packages 소스 텍스트를
    여러 테스트 파일이 공유하는 모듈 레벨 캐시(top-level memoization)를 검토할 가치가 있다는 점만
    기록해 둔다(신규 지적 아님, 누적 관찰).

- **[INFO]** 핵심 정규식(`UPPER_SNAKE`, `FIELD_TABLE_NAME`, `CODE_FIELD`, `BACKTICK`,
  `collectSourceTokens`/`collectEnvDeclarations` 내부 `envLine`/`composeLine`)은 이번 라운드에서도
  무변경 — 이차 백트래킹(ReDoS) 형태 아님, 이전 세 라운드 판단과 동일
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:90,102,105,113,163,197,205`
  - 상세: `UPPER_SNAKE = "[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+"` 는 반복 그룹마다 리터럴 `_` 를 앵커로
    요구해 중첩 정량자 간 모호성이 없다 — 선형 패턴. 나머지 세 축 정규식도 전부 `UPPER_SNAKE` 를
    감싸는 고정 리터럴 컨텍스트(`{ name: "…"`, `code: "…"`, `` `…` ``, `^#?…=`, `^\s+…:`) 형태로
    같은 성질을 물려받는다. 입력도 저장소 내부 신뢰 콘텐츠(MDX/소스/`.env.example`/compose)로
    한정돼 공격자 제어 경로가 아니다.
  - 제안: 조치 불요.

- **[INFO]** `scanIdentifierCitations`/`collectSourceTokens`/`collectEnvDeclarations` 내부의
  "`lastIndex` 리셋 → `exec` 루프 → 배열/Set 적재" 패턴이 파일 내 4곳에서 반복되나, 알고리즘
  복잡도에는 영향 없음(각 호출은 여전히 O(입력 길이))
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:138-149,162-173,196-213`
  - 상세: 유지보수성 관점(코드 중복)의 지적은 이전 라운드(`15_24_12/maintainability.md`)가 이미
    다뤘고 이 폴더 전반의 기존 관례로 처분됐다 — 성능 관점에서는 각 루프가 독립적으로 선형이라
    추가 비용이 없다. 중복 제거 시에도 알고리즘적 이득은 없으므로(가독성 이슈) 이 리뷰의 스코프
    밖으로 남겨 둔다.
  - 제안: 조치 불요(성능 관점 해당 없음, 유지보수성 트랙에서 이미 처분됨).

## 요약

이번 diff 의 실행 가능한 코드(`guide-identifier-scan.ts`, `guide-identifier-existence.test.ts`)는
라운드 3(`15_24_12`) 이후 실질 변경이 없으며(라운드 3 fix 커밋이 추가한 12줄은 트리비얼한 합성
fixture 단언 하나), 세 차례 독립 라운드가 이미 발견·해소한 유일한 성능 관련 WARNING(`composeTexts`
가 이름·문서 의도보다 넓게 루트의 모든 YAML — 대형 lockfile 포함 — 을 읽던 문제)은 `docker-compose*.yml`
글롭으로 좁혀진 상태가 그대로 유지되고 있음을 직접 소스를 열어 재확인했다. 모든 정규식은 선형이고
(ReDoS 형태 아님), env/compose 기준집합 병합은 "오늘은 판정에 기여하지 않는다"는 사실이 코드
주석·plan·뮤테이션 테스트로 이미 투명하게 disclose 되어 있다. 가드 계열이 backend+packages 소스를
가드별로 독립 재적재하는 구조적 비용은 기존 설계이자 반복 관찰된 사항으로 이번 PR 의 신규 회귀가
아니다. 신규 CRITICAL/WARNING 급 성능 결함은 발견되지 않았다.

## 위험도

NONE
