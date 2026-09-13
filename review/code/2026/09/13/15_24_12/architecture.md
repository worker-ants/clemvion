# 아키텍처(Architecture) 코드 리뷰

## 발견사항

- **[INFO]** `collectEnvDeclarations` 가 소스 유형별로 하드코딩된 두 개의 위치 인자(`envExampleTexts`, `composeTexts`)를 받는 고정 함수형이라, 세 번째 선언처(예: 향후 k8s manifest, CI 워크플로 env, `.env.production` 등)가 추가되면 시그니처 자체를 변경해야 한다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` — `collectEnvDeclarations` 함수 (192~214행)
  - 상세: 함수 내부는 사실상 `(정규식, 텍스트 배열)` 쌍을 순회하는 동일한 루프를 두 번 반복한다(`envLine`/`envExampleTexts`, `composeLine`/`composeTexts`). 현재는 소스 계열이 2개뿐이라 문제가 드러나지 않지만, 개방-폐쇄 원칙 관점에서 새 선언처 종류가 추가될 때마다 이 함수의 파라미터 목록과 호출부(`guide-identifier-existence.test.ts`)를 함께 고쳐야 한다 — 데이터(선언처 종류)를 늘리는 변경이 코드 구조 변경을 요구한다.
  - 제안: 시급하지 않음. 다음에 세 번째 선언처가 실제로 필요해지는 시점에 `{ label: string; pattern: RegExp; texts: readonly string[] }[]` 형태의 목록을 순회하는 형태로 일반화하면 파라미터를 늘리지 않고 확장 가능하다. 지금 당장 리팩터할 이유는 없다(소스 2종 고정, 실측 근거로 그 이상 필요성이 없음).

- **[INFO]** `guide-identifier-existence.test.ts` 한 파일이 세 가지 다른 층위의 검증(코퍼스 수준 baseline-0 가드 · `GUIDE_EXTERNAL_VOCABULARY` 데이터 불변식 4종 · `scanIdentifierCitations`/`collectEnvDeclarations`의 순수 함수 단위 대조군)을 한 파일(305행, 4개 최상위 `describe`)에 누적하고 있다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` 전체 — 특히 `describe("유저 가이드 식별자 실재성 가드", …)`(39~192행) vs `describe("collectEnvDeclarations — 분기별 대조군", …)`(206~246행) vs `describe("scanIdentifierCitations — 축별 대조군", …)`(254~304행)
  - 상세: 이 자체는 이 폴더(`__tests__/`)의 기존 자매 파일들(`impl-anchor-existence.test.ts` 등)과 같은 관례이고, 지난 라운드 `maintainability.md` INFO#3 이 같은 파일 안 "설계 근거 삼중 복제"를 이미 지적·처분(추후 축 개수·허용목록 상한 근접 시 분리)했으므로 **새 지적이 아니라 같은 관찰의 다른 축**(코드 복제가 아니라 책임 경계)이다. 모듈 응집도 자체는 "식별자 실재성" 이라는 단일 주제로 묶여 있어 나쁘지 않지만, 순수 함수 단위 테스트(스캐너 축별 대조군)와 저장소 상태에 의존하는 통합 가드(baseline-0)가 같은 파일에서 같은 `basis`/`citations` 지역 변수를 공유하지 않고 독립적으로 재구성되는 점은 향후 파일이 더 커지면 분리 신호가 된다.
  - 제안: 즉각 조치 불요. RESOLUTION.md INFO#7 의 "축 4개 초과 또는 허용목록 상한 근접 시 분리" 기준에 "테스트 파일 라인 수/describe 블록 수" 축을 하나 더 추가해 두면 다음 분리 시점을 놓치지 않는다.

## 긍정적으로 확인된 설계

- **레이어 분리 준수**: `guide-identifier-scan.ts` 는 `node:fs`/`node:path` 조차 import 하지 않는 순수 함수·데이터 모듈(문자열 → 문자열, 정규식 매칭만)이고, 파일 I/O·저장소 순회는 전부 `guide-identifier-existence.test.ts` 쪽(오케스트레이션 계층)에 있다. 이는 같은 폴더의 기존 가족(`impl-anchor-parse.ts`/`impl-anchor-existence.test.ts`, `plan-scan.ts`/`plan-scan.test.ts`)과 동일한 관례이며 순환 의존도 없다(`scan.ts` → 무의존, `existence.test.ts` → `tree-walk.ts` + `impl-anchor-parse.ts`, 역방향 참조 없음).
- **OCP 를 데이터로 구현**: `GUIDE_EXTERNAL_VOCABULARY` 를 배열 데이터로 두고 4가지 불변식(시스템명 의무·상한·인용 여부·기준집합 배제)을 테스트가 강제하는 구조는, 외부 어휘 예외를 늘릴 때 판정 로직(`scanIdentifierCitations`)을 건드리지 않고도 데이터 추가만으로 확장하면서 동시에 "허용목록이 은폐 수단이 되는 것"을 코드로 막는다 — 원칙(개방-폐쇄)과 안전장치(회귀 방지)를 함께 만족하는 드문 사례다.
- **모듈 경계의 의도적 설계**: frontend 테스트가 backend 소스를 `import` 하지 않고 `readFileSync` 로 텍스트만 읽는 이유(패키지 경계를 넘는 빌드타임 의존 방지)가 `guide-sanitized-message-parity.test.ts` 헤더와 이 가드 계열에 일관되게 명시돼 있고, `sourceTexts` 수집에서 frontend 자체 소스를 **의도적으로 제외**(자기 증명 방지)한 결정도 정합적이다.
- **DFS 중복 제거**: `tree-walk.ts` 로 여섯 벌의 손수 짠 DFS 를 통합한 뒤 이번 파일이 `walkTree` 를 필터 콜백(`skipDir`/`includeFile`) 주입으로 재사용하는 점은 전략 패턴을 통한 적절한 추상화 수준 사례다.
- **이전 라운드 WARNING 정정 확인**: `guide-sanitized-message-parity.test.ts:16` 의 자매 참조가 `guide-identifier-existence.test.ts`(옛 이름 병기)로 갱신됐고, `composeTexts` 필터가 `docker-compose*.ya?ml` 로 좁혀졌으며, "이 주석을 지우지 말 것" 절이 재작성본에 경위와 함께 복원돼 있음을 소스에서 직접 확인했다 — 이전 리뷰(`14_41_14`)의 WARNING#1·#2·#3 이 실제로 해소됐다.

## 요약

이번 변경은 `guide-error-code-*`(에러 코드 전용) 가드를 `guide-identifier-*`(에러 코드 + 환경변수)로 스코프 확장·리네임하는 순수 test/tooling 리팩터다. `scan.ts`(순수 로직) ↔ `existence.test.ts`(I/O·오케스트레이션) 분리, 무의존 순환 없음, 데이터 기반 허용목록으로 개방-폐쇄를 구현한 점 등 이 폴더의 기존 가드 가족 관례를 일관되게 따르며 구조적으로 건전하다. 직전 리뷰(`14_41_14`)가 지적한 stale 자매 참조·과도하게 넓은 `composeTexts` 스코프·삭제됐던 한계 주석은 모두 실측으로 정정 확인됐다. 남은 것은 `collectEnvDeclarations` 의 고정 파라미터 형태가 향후 세 번째 선언처 추가 시 확장성 제약이 될 수 있다는 점과, 테스트 파일이 통합-가드/데이터-불변식/단위-대조군 세 층위를 한 파일에 누적하고 있어 다음 축 추가 시 분리 신호를 지켜봐야 한다는 점인데, 둘 다 지금 당장 조치가 필요한 결함이 아니라 관찰 수준(INFO)이다.

## 위험도
LOW
