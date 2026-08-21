# 아키텍처(Architecture) 리뷰 — masked-marker-contract-7d2e14 (라운드 5, 13_14_29)

## 검토 방법

이 PR 은 5번째 코드 리뷰 라운드다. 이전 4라운드(`11_27_29`/`11_53_49`/`12_25_15`/`12_50_37`)가 남긴
architecture WARNING 4건(CI 경로 게이팅 재도입, 세 번째 스택 무방비, 감시 목록 자체가 미러, 스캔
파생이 한 단계만 훑음, `SOT_DIR` 접두 경계가 backend 만 고쳐짐)이 이번 diff 시점에 실제로 전부
반영됐는지 **원본 파일을 직접 `Read`** 해서 재확인했다(diff 인용이 아니라 현재 저장소 상태) —
`codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts`,
`codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts`, 대응 spec/test
파일 전문. 결론: 4건 전부 backend·frontend 양쪽에 대칭으로 반영돼 있다(`relPath === SOT_DIR ||
relPath.startsWith(...)` 경계가 두 파일 모두에 있고, `masked-markers-extra` 형제 fixture 캐너리도
양쪽에 있다). 그 위에서 이번 diff 전체(신규 패키지 `@workflow/masked-markers`, 재export 전환,
CI/Docker 등록 8곳)를 SOLID·결합도/응집도·레이어·순환의존·모듈 경계 관점으로 다시 훑었다.

## 발견사항

- **[INFO]** frontend 미러 가드 `findMirrorRedeclarations` 안에서, 함수 최상단에서 `import * as sot from "@workflow/masked-markers"` 로 들여온 SoT 모듈 네임스페이스를 루프 안의 지역 변수 `const sot = SOT_DIR.split(path.sep).join("/");` 가 그대로 **섀도잉**한다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:11`(모듈 레벨 import) / `:143`(같은 이름의 지역 변수, `findMirrorRedeclarations` 함수 본문)
  - 상세: 기능적으로는 TS/JS 렉시컬 스코프가 정확히 해석하므로 버그는 아니다. 다만 이 파일의 존재 이유 자체가 "무엇이 SoT 이고 무엇이 SoT 처럼 보일 뿐인 형제인가"를 정밀하게 가르는 것이고(바로 이 라운드까지 4번의 리뷰가 그 경계 판정 로직 자체의 결함을 지적해 왔다), 그 판정 로직 한가운데서 실제 SoT import 를 가리는 동명의 지역 변수를 쓰는 것은 이 파일의 핵심 관심사(SoT 식별)와 정확히 같은 이름 공간에서 혼동 여지를 만든다. `no-shadow` 계열 lint 규칙이 이 프로젝트에 없어(확인: `eslint.config.mjs` 에 해당 규칙 미설정) 정적 도구도 잡지 못한다. 형제 backend 파일(`masked-marker-mirror-guard.ts`)은 `SOT_DIR` 을 모듈 레벨에서 이미 정규화된 리터럴(`'codebase/packages/masked-markers'`, `/` 고정)로 선언해 두어 이런 지역 재계산·재명명 자체가 없다 — 같은 불변식을 지키는 두 "쌍둥이" 파일이 구조적으로 다시 한번 다른 형태를 취하고 있다(이 PR 시리즈가 라운드 1~4 에 걸쳐 반복해 겪은 "쌍둥이 비대칭" 클래스의 스타일 차원 재발이며, 다만 이번엔 판정 결과 자체는 갈리지 않는다).
  - 제안: 지역 변수명을 `sotPrefix` 등으로 바꿔 import 바인딩과 충돌을 없앤다. 겸사겸사 `SOT_DIR` 을 backend 처럼 슬래시 리터럴로 모듈 레벨에서 한 번만 정규화해 두면(예: `const SOT_DIR_POSIX = SOT_DIR.split(path.sep).join("/");` 를 모듈 스코프로 끌어올림) 매 파일 반복마다의 재계산도 함께 없앨 수 있다(이미 이전 라운드 maintainability/performance 리뷰가 지적한 별개의 INFO 와 겹치는 지점).

## 확인한 항목 (참고 — 문제 없음)

- **레이어·의존 방향**: `@workflow/masked-markers` 는 런타임 의존이 0인 순수 값 도메인 패키지이고, backend/frontend 는 단방향으로만 그것을 참조한다(패키지 → 소비처 역참조 없음). 순환 의존 없음.
- **재export shim 패턴**: backend `sanitize-error-message.ts` / frontend `masked-markers.ts` 는 값·함수를 삭제하고 패키지에서 import 후 동일 이름으로 재export 한다 — 기존 소비처의 import 경로(`@/lib/utils/masked-markers` 등)를 바꾸지 않아 OCP(개방-폐쇄)를 지킨다. Facade/Adapter 성격의 최소 변경.
- **가드 로직 중복의 설계 근거**: `resolveScanDirs`/`findRedeclaredSymbols`/`findMirrorRedeclarations` 가 backend·frontend 양쪽에 거의 동일하게 복제돼 있다. 값의 미러(이 PR 이 제거 대상으로 삼은 것)와 달리, CI 경로 게이팅이 두 워크플로 어느 쪽도 "무조건 실행"을 보장하지 못하는 이 저장소의 실측 제약(`.github/workflows/` 전수 확인, 게이팅 없는 워크플로가 없음) 아래에서는 "각 스택이 자기 트리거에서 도는 독립 사본"이 유일하게 방어선을 보장하는 배치다. 라운드 4에서 그 전제(사본이 실제로 갈릴 수 있다)의 비용이 한 번 실증됐고, 이번 재확인 시점엔 두 사본이 판정 로직 상 다시 대칭이다.
- **SoT 심볼 목록의 파생화**: `SOT_SYMBOLS` 를 패키지의 실제 export 표면(`Object.keys(sot)`)에서 파생시켜, 손 목록이 또 다른 미러가 되는 것을 막았다(라운드 2 WARNING 의 근본 처방). 모듈 interop 산물(`default`/`__esModule`) 필터링도 양쪽에 대칭으로 있다.
- **스캔 대상의 파생화**: `resolveScanDirs` 가 `codebase/<stack>/src` + `codebase/packages/<pkg>/src` 2단계를 파일시스템에서 실측 도출한다 — 신규 스택/패키지가 추가돼도 가드 코드 수정 없이 자동 포섭된다(확장성 관점에서 바람직한 설계).
- **기존 컨벤션 준수**: 신규 `masked-marker-mirror-guard.ts`/`.spec.ts`/`.test.ts` 는 `__tests__/` 안에 "순수 로직(`*-guard.ts`) + 소비 spec" 을 분리하는 이 저장소의 기존 repo-guard 패턴(`internal-package-registration-guard.ts`, `typescript-toolchain-guard.ts`, `production-build-devdep-guard.ts`, `masked-reject-callers-guard.ts`)을 그대로 따른다 — 새 디렉터리 구조나 새 패턴을 도입하지 않았다.
- **SRP/응집도**: 신규 패키지는 마커 리터럴 3종·집합·정확일치 판정·깊이 상한 5개 export 만 갖는 좁은 범위의 값 도메인이다. God-object/kitchen-sink 패키지화 징후 없음.

## 요약

5라운드째 반복 검증한 결과, 이전 라운드들이 지적한 architecture 급 결함(CI 경로 게이팅 사각지대 재도입·세 번째 스택 무방비·감시 목록 자체가 미러·스캔 파생이 얕음·`SOT_DIR` 경계가 한쪽 쌍둥이에만 반영)은 이번 diff 시점에 backend·frontend 양쪽 모두 대칭으로 반영돼 있음을 원본 파일 직접 대조로 확인했다. 핵심 리팩터(마커 상수·판정 로직·깊이 상한을 `@workflow/masked-markers` 단일 패키지로 추출하고 두 스택이 재export shim 으로 소비)는 SRP·OCP·의존 역전(backend/frontend 가 공유 추상화에 의존, 서로에 의존하지 않음) 관점에서 이 PR 이전보다 명확히 개선된 구조다. 유일하게 새로 발견한 것은 frontend 미러 가드 안에서 SoT import 네임스페이스(`sot`)를 동명의 지역 변수가 섀도잉하는 점 — 기능 결함은 아니지만, "무엇이 SoT 인지 정밀하게 가른다"는 이 파일의 존재 이유와 같은 이름 공간에서 혼동 여지를 만들고, 같은 불변식을 지키는 backend 쌍둥이와 다시 한번 구조적으로 다른 형태를 취한다는 점에서 이 시리즈가 반복해 겪은 "쌍둥이 비대칭" 패턴의 스타일 차원 재발이다. 차단 사유는 아니다.

## 위험도

NONE
