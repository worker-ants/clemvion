# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `_shared.ts` 가 성격이 다른 두 책임(파일시스템 루트 탐색 vs YAML 서브셋 파싱)을 한 모듈에 담고 있다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts:21-124` (특히 `repoRoot` 블록 21-54행과 YAML 추출기 블록 62-124행)
  - 상세: 두 블록은 서로를 호출하지 않는 독립된 기능이고, 묶인 이유는 "두 가드가 공통으로 쓴다"는 **소비처 기준**이지 **책임(도메인) 기준**이 아니다. 파일 헤더(17-19행)가 이미 "언젠가 공유할지도 로 끌어오면 이 모듈이 두 번째 잡동사니가 된다"고 위험을 인지하고 경계를 세워둔 상태라 당장 문제는 아니지만, 지금 이 파일 자체가 이미 "루트 탐색"과 "YAML 파싱"이라는 무관한 두 축을 한 파일에 갖고 있다. 세 번째 공유 대상이 생기면(예: 다른 도메인의 헬퍼) 응집도가 더 흐려질 수 있다.
  - 제안: 지금 크기(124줄)에서 분리 비용이 이익보다 크므로 즉시 조치는 불필요. 다만 다음에 항목이 추가될 때는 "두 가드가 공유하는가"뿐 아니라 "같은 도메인인가"도 분리 기준에 넣는 것을 고려할 만하다(예: `_root.ts` / `_yaml.ts`).

- **[INFO]** tsconfig exclude·vitest include 설명 문단이 두 파일에 사실상 동일 문장으로 중복된다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts:13-15` 와 `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:11-13`
  - 상세: "이 파일도 `__tests__/` 아래라 tsconfig 의 `src/**/__tests__/**` exclude 에 걸려 tsc/next build 에서 제외되고, vitest 의 test include 는 `*.{test,spec}.ts` 뿐이라 테스트로 실행되지도 않는다"는 설명이 두 파일에 거의 동일하게 반복된다. 각 파일 헤더가 독립적으로 읽혀야 한다는 이 저장소의 기존 문서화 관례(각 가드 헤더가 자기 완결적)를 따른 결과로 보이며 실질적 위험은 낮지만, 이 설명 자체가 바뀌면(예: tsconfig 패턴 변경) 두 곳을 함께 고쳐야 하는 동기화 지점이 하나 더 생긴 것이다.
  - 제안: 현 상태로도 무방하나, 향후 세 번째 파일에도 같은 문단이 필요해지면 `_shared.ts` 헤더로 문구를 단일화하고 나머지는 포인터만 남기는 편이 드리프트를 줄인다.

- **[INFO]** `_shared.ts` 만 파일명에 언더스코어 프리픽스를 쓰는 이유가 코드 근거로는 드러나지 않는다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts` (파일명), 비교 대상 `internal-package-registration-guard.ts` / `typescript-toolchain-guard.ts`
  - 상세: 같은 디렉터리의 비-테스트 모듈 셋(`_shared.ts`, `internal-package-registration-guard.ts`, `typescript-toolchain-guard.ts`) 중 `_shared.ts` 만 언더스코어가 붙어 있다. 헤더 주석(13-15행)이 설명하는 "vitest test include 는 `*.{test,spec}.ts` 뿐"이라는 이유는 셋 다 동일하게 적용되므로, 언더스코어가 실행/빌드 동작에 기능적으로 필요한 것은 아니다("내부/보조 모듈"이라는 의도 신호로 읽히지만 그 규칙이 문서화되어 있지 않다). 저장소 다른 `__tests__/` 디렉터리에도 이 프리픽스의 선례가 없어(전수 확인) 이 파일이 첫 사례다.
  - 제안: 의도된 명명이라면 헤더 주석에 "언더스코어 = 두 가드 어느 쪽 도메인도 아닌 중립 보조 모듈" 같은 한 줄 규칙을 남기면, 다음에 세 번째 공유 모듈이 생길 때 같은 규칙을 따를지 판단 기준이 생긴다.

## 요약

이번 변경(`_shared.ts` 신설을 통한 공유 프리미티브 분리, `validateWorkspacePatterns` 순수 함수 추출과 `readLines` 주입점 대칭화, `shared.test.ts` 신설)은 유지보수성 관점에서 전반적으로 우수하다. 함수는 모두 짧고 단일 책임이며(가장 긴 것도 20줄 내외), 중첩 깊이는 1단계를 넘지 않고, 상수(`MAX_ROOT_SEARCH_DEPTH`)는 매직 넘버 대신 이름 붙여 export 되어 테스트에서도 하드코딩 없이 재사용된다. 특히 "이관의 부산물로 API 가 넓어지는 건 이관이 아니다"라는 원칙 아래 `blockRange`/`findKeyLine`을 `_shared.ts` 에서만 공개하고 소비 가드의 재export 범위에서는 의도적으로 뺀 판단, 그리고 `repoRoot`/`discoverWorkspaceDirs` 양쪽에 대칭적인 DI(주입) 지점을 연 것은 이 저장소가 반복해 겪은 실패 클래스(비대칭 테스트 가능성, 이관에 의한 공개 표면 확대)에 대한 구체적이고 근거 있는 대응이다. 발견한 사항은 모두 INFO 수준의 사소한 응집도·명명 관찰이며 즉각 조치가 필요한 구조적 결함은 없다.

## 위험도
LOW
