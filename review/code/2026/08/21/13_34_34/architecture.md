# 아키텍처(Architecture) 리뷰 — masked-marker-contract-7d2e14 (라운드 6, 13_34_34)

## 검토 방법

이 PR 은 이미 5라운드 코드 리뷰(`11_27_29`~`13_14_29`)를 거쳤고, 매 라운드가 architecture 관점의
CRITICAL/WARNING 을 하나 이상 냈다가 순차로 처분됐다(가드 배치의 경로 게이팅 재도입 →
감시목록 자체가 미러 → 스캔 파생이 얕음 → 완료형 서술 거짓(비대칭 수정) → 반증된 절대 서술이
소스에 잔존). 이번 라운드는 diff 를 다시 읽는 대신, **직전 라운드가 "고쳤다"고 처분한 지점을
현재 저장소에서 직접 재대조**하는 데 집중했다 — 이 시리즈 자체가 "고쳤다는 서술과 실제 코드가
어긋난다"를 두 번 반증한 전력이 있기 때문이다(`12_50_37`, `13_14_29`).

실측 대상: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts`,
`codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts` 두 파일을
직접 `Read` 하고, 공백/따옴표 스타일을 정규화한 뒤 `diff` 로 **문자 단위 대조**했다. 또한
`spec/5-system/14-external-interaction-api.md` R17·frontmatter, `plan/in-progress/masked-marker-shared-package.md`
체크리스트, `.github/workflows/{backend,frontend,packages}-checks.yml` 의 pathspec 을 원본에서
재확인했다.

## 발견사항

- **[INFO] 두 스택의 미러 소멸 가드가 순수 탐지 로직(약 140줄)을 문자 그대로 복제하고 있다 — 이 복제 자체가 이 PR 안에서 이미 2회 결함의 원인이었다**
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts` (전체, 특히 `resolveScanDirs`/`findRedeclaredSymbols`/`findMirrorRedeclarations` 함수) vs `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts` (동일 함수 3개)
  - 상세: 정규화 후 diff 대조 결과, 두 파일은 주석 문구·import 스타일·`SOT_DIR` 리터럴 표현 방식을 빼면 **알고리즘이 완전히 동일**하다. 이 중복은 의도된 설계다(CI 경로 게이팅 — `frontend-checks` 는 `codebase/backend/**` 변경 시, `backend-checks` 는 `codebase/frontend/**` 변경 시 검사를 생략하므로 한쪽에만 가드를 두면 반대쪽 변경에 무력하다는 게 이 PR 의 출발점, `11_27_29` W1). 다만 이 트레이드오프의 대가가 이미 두 번 실현됐다: 라운드3→4 에서 `SOT_DIR` 접두 경계 하드닝이 backend 사본에만 반영되고 frontend 사본은 옛 취약 형태로 남았었고(`12_50_37` W1), 그 사고 자체가 "탐지 로직 중복은 값 미러와 달리 안전하다"는 가드 헤더의 절대 서술을 반증했다(`13_14_29` W3, 서술을 조건부로 정정). 지금은 캐너리(경로 접두 겹침·함수 선언 형태 재선언)로 **알려진** 회귀 형태를 양쪽에 대칭으로 고정해 뒀지만, 알고리즘에 새 분기(예: 이미 INFO 로 이월된 `type`/`enum` 선언 탐지)가 추가될 때마다 "양쪽에 대칭으로 넣었는가"를 사람이 다시 보증해야 하는 구조는 그대로다 — 캐너리는 *알려진* 비대칭을 잡지, 알고리즘이 진화하며 생기는 *새* 비대칭을 구조적으로 막지는 않는다.
  - 제안: 차단 사유는 아니다(이미 `12_50_37` 미조치 INFO 목록에 "탐지 로직 재추출 검토"로 등재되어 있고, 그때 "당장의 불일치는 사라졌다"는 이유로 명시적으로 defer 됐다 — 이번 라운드에서 재발한 새 증거는 없다). 다만 트레이드오프가 정적이지 않다는 점은 남는다: `resolveScanDirs`/`findRedeclaredSymbols`/`findMirrorRedeclarations`/`SOT_SYMBOLS` 를 `@workflow/masked-markers` 자신이나 별도의 얇은 내부 패키지로 옮기고 두 스택은 그것을 호출하는 thin spec 만 남기면, 두 CI 워크플로 모두 이미 `codebase/packages/**` 를 relevant 로 잡고 있으므로(실측 확인) "어느 쪽이 바뀌든 최소 하나가 실행된다"는 이 가드의 핵심 보장을 유지하면서 알고리즘 사본을 1개로 줄일 수 있다. 세 번째 비대칭 사고가 나기 전에 재검토할 가치는 있다.

- **[INFO] `SOT_DIR` 정규화 방식이 두 사본에서 서로 다른 기법을 쓴다 — 기능은 동일하지만, 이 PR 이 "비대칭이 반복 결함 원인"이라고 스스로 기록한 바로 그 지점에서 새로운 (작지만) 비대칭이다**
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts:29` (`export const SOT_DIR = 'codebase/packages/masked-markers';` — 슬래시 리터럴을 직접 하드코딩) vs `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:21,144` (`export const SOT_DIR = path.join("codebase", "packages", "masked-markers");` 로 OS 경로 구분자를 쓴 뒤, 소비 지점에서 `const sotPrefix = SOT_DIR.split(path.sep).join("/");` 로 다시 정규화)
  - 상세: 두 표현 모두 POSIX/Windows 어느 환경에서도 결과적으로 같은 슬래시 정규화 문자열과 비교되므로 **현재 기능 결함은 없다**(직접 대조로 확인). 다만 이 PR 의 서사 전체가 "같은 불변식을 두 곳에 서로 다른 방식으로 적어두면, 한쪽만 고쳐지고 그 비대칭을 알아채기 어렵다"(`12_50_37`/`13_14_29`)는 것이었는데, `SOT_DIR` 자체의 **정의 방식**이 이미 그 형태를 하나 갖고 있다 — 예컨대 향후 누군가 backend 의 `SOT_DIR` 을 "일관성을 위해" `path.join` 으로 바꾸면, frontend 처럼 소비 지점에서 별도 `split(path.sep).join('/')` 정규화가 필요해지는데 그 사실을 모르고 바꾸면 Windows CI(현재는 없지만)에서 조용히 어긋날 수 있는 잠재 지점이다.
  - 제안: 차단 사유 아님. 여유가 있을 때 backend 도 `path.join` + 소비 지점 정규화로, 혹은 frontend 도 슬래시 리터럴 직접 선언으로 통일하면 "두 사본이 같은 기법을 쓴다"는 이 가드 자신의 설계 원칙과 완전히 맞아떨어진다.

## 그 외 재확인한 항목 (문제 없음)

- 두 미러 가드 파일을 정규화 후 문자 단위로 diff 한 결과, `SOT_DIR` 표현 방식과 JSDoc 문구를 제외한 **알고리즘·제외 경계·정렬·인터페이스가 완전히 일치**한다 — `12_50_37`(접두 경계 비대칭)·`13_14_29`(섀도잉+루프 재계산)가 지적한 결함은 둘 다 실제로 해소되어 있다.
- `spec/5-system/14-external-interaction-api.md:1622-1631` R17 문장이 "SoT 는 `@workflow/masked-markers`" 로 정확히 반영돼 있고 frontmatter `code:`(`:16`)에 `codebase/packages/masked-markers/src/index.ts` 가 등재돼 있다.
- `plan/in-progress/masked-marker-shared-package.md:127` "spec R17 정정" 항목이 `[x]` 로 반영돼 실제 실행 경로(집행 커밋·`--impl-done` 검증·planner 턴 생략 사유)와 함께 남아 있다 — `11_53_49` 가 지적했던 stale 체크박스는 재발하지 않았다.
- `.github/workflows/backend-checks.yml:62`(`codebase/packages/**`)·`frontend-checks.yml`(`codebase/packages/**` + 신규 `codebase/channel-web-chat/**`)·`packages-checks.yml`(matrix 6개, `@workflow/masked-markers` 포함) 세 워크플로 모두 실측으로 서술과 일치함을 확인했다 — `11_53_49` W1(세 번째 스택 무방비)이 재발하지 않았다.
- 신규 패키지 `@workflow/masked-markers` 는 런타임 의존이 없는 순수 값 도메인 모듈이고, backend/frontend 는 이를 단방향으로만 의존한다(순환 없음). backend/frontend 재export shim(`sanitize-error-message.ts`/`lib/utils/masked-markers.ts`)은 기존 소비처의 import 경로를 보존하면서 SoT 를 패키지로 이전한 정직한 Adapter/Facade 형태다.

## 요약

이 PR 은 6번째 리뷰 라운드에 이르러서도 architecture 관점의 새로운 CRITICAL/WARNING 이 없다 —
직전 라운드까지 반복해서 발견된 "가드 배치가 서술보다 좁다"·"완료형 서술이 한쪽만 반영됐다"류
결함은 이번 라운드의 문자 단위 재대조에서 전부 해소된 상태로 확인됐다. 신규 공유 패키지
추출은 SRP·의존성 역전·모듈 경계 면에서 견고하고(순수 값 도메인, 단방향 의존, 재export 로
하위 호환 유지), CI 등록 표면(8곳)·spec R17·plan 체크리스트도 모두 실제 상태와 일치한다.
남은 것은 이미 알려져 있고 명시적으로 defer 된 구조적 트레이드오프 하나뿐이다 — 두 스택이
탐지 알고리즘 자체(약 140줄)를 문자 그대로 복제하는 설계는 CI 경로 게이팅을 우회하기 위한
의도된 선택이지만, 이 PR 자신의 이력에서 이미 2회(`12_50_37`, 그 원인이 된 비대칭) 결함의
근원이었다 — 캐너리로 *알려진* 회귀는 막았지만 알고리즘이 진화할 때마다 사람이 대칭을 다시
보증해야 하는 구조적 부담은 남아 있다. 부수적으로 `SOT_DIR` 정의 방식 자체가 두 사본에서
서로 다른 기법(하드코딩 리터럴 vs `path.join`+런타임 정규화)을 쓴다는, 기능상 무해하지만
이 PR 의 핵심 교훈("비대칭이 반복 결함의 근원")과 맞물려 있는 사소한 비일관성도 함께 남긴다.
둘 다 차단 사유가 아닌 INFO 다.

## 위험도
NONE
