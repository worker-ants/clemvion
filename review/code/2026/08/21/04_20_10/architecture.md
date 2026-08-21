# 아키텍처(Architecture) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부

## 발견사항

- **[INFO]** 마스킹 마커 판정 primitive(`MASKED_MARKERS`/`isMaskedMarker`)가 "egress 마스킹" 전용 모듈(`sanitize-error-message.ts`)에서 "ingress 재제출 거부"(`reject-masked-resubmission.ts`)까지 겸하게 됐다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:150`(`export const MASKED_MARKERS`), `:164`(`export function isMaskedMarker`); 소비처 `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts:3`
  - 상세: 이 모듈은 이름·기존 책임(응답 직전 에러 메시지 마스킹) 그대로인데, 이번 변경으로 "마스킹 마커의 정본 레지스트리"라는 더 넓은 역할을 겸하게 됐다. 방향 자체는 타당하다 — docstring 이 명시하듯 마커 목록을 두 곳에 복제하면 한쪽만 갱신될 때 조용히 fail-open 하는 사고가 이 시리즈에서 반복됐고(이번 diff 의 `Object.freeze` 캐너리 코멘트가 그 반증 사례를 직접 인용한다), 공유 SoT 로 묶는 편이 분기(divergence)를 구조적으로 막는다. 다만 파일명·모듈 docstring 은 여전히 "sanitize error message"(egress 전용)를 표방하고 있어, 다음에 이 파일을 여는 사람이 "왜 인바운드 검증 로직이 여기 export 를 쓰는가"를 파일명만으로는 못 짐작한다.
  - 제안: 강제 사안 아님. 마커 상수/판정 함수가 세 번째 소비처를 얻게 되면 이 시점에 `shared/utils/masked-marker.ts` 류의 중립 모듈로 재추출해 "egress 전용" 이라는 파일명과 실제 책임(양방향 마커 판정 SoT)의 불일치를 해소하는 것을 고려.

- **[INFO]** 두 Manual 진입점(`executions.service.ts`, `workflows.controller.ts`)의 마스킹 가드 중복이 이번 diff 에서 공유 wrapper 로 이미 해소됨(확인용 기록)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:499`(`resolveTriggerParametersRejectingMasked(...)` 호출), `codebase/backend/src/modules/workflows/workflows.controller.ts:317`(동일 호출)
  - 상세: 직전 리뷰 라운드(`review/code/2026/08/21/00_03_57/maintainability.md`)가 지적한 "find+length체크+throw 3줄이 두 호출부에 문자 그대로 중복"은 이번 diff 의 `resolveTriggerParametersRejectingMasked` 도입으로 실제 해소됐다 — 두 호출부는 이제 각각 한 줄만 호출하고, 검사 순서(raw 우선→resolve→재검사)와 판정 로직은 `reject-masked-resubmission.ts` 한 곳에 있다("호출부가 아니라 여기서 순서를 소유한다" docstring). SRP·DRY 관점에서 양호. 별도 조치 불필요.

- **[INFO]** 아키텍처 경계를 코드(AST 파서 기반 fitness function)로 강제하는 `masked-reject-callers-guard.ts`/`.spec.ts` 는 이 리뷰 관점에서 특히 견고한 설계다(확인용 기록)
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts`, `codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts`
  - 상세: "Manual 실행 경로는 base `resolveTriggerParameters` 를 직접 호출하면 안 되고 wrapper 를 거쳐야 한다"는 규칙을 JSDoc/컨벤션이 아니라 TypeScript AST 순회로 CI 시점에 강제한다. 허용목록(`ALLOWED_DIRECT_CALLERS`)에 대한 "죽은 항목 없음" 캐너리, "실제 위반 탐지" 합성 fixture 캐너리, "wrapper 접두 겹침 오탐 방지" 캐너리, 우회 형태 7종 회귀 고정까지 갖춰 가드 자체의 무보증화(가드가 있다고 믿지만 실제로는 아무것도 안 지키는 상태)를 반복적으로 막아온 이력이 문서화돼 있다. 신규 파일이 wrapper 대신 base 를 import 하면 이 테스트가 즉시 RED 가 되므로, 향후 세 번째 Manual 경로가 추가될 때 가드가 누락되는 회귀를 구조적으로 방지한다. 개선 제안 없음.

- **[INFO]** `tsconfig.build.json` exclude 확장은 레이어 경계(프로덕션 아티팩트 vs 테스트 전용 인프라)를 정확히 좁힌 수정이다(확인용 기록)
  - 위치: `codebase/backend/tsconfig.build.json`
  - 상세: `src/repo-guards/**` 만 빌드 exclude 에 추가되고 `tsconfig.json`(dev/jest 타입체크)에는 포함이 그대로 유지된다(`codebase/backend/tsconfig.json` 확인). `devDependency` 인 `typescript` 를 import 하는 가드가 `*-guard.ts` 라는 이유로(`*spec.ts` 패턴 미매치) 그동안 `dist/` 로 새 나가 프로덕션 설치에서 `require("typescript")` 실패 지뢰가 됐던 문제를 정확히 그 원인 파일 셋만 배제해 해결했다. 과다 배제(테스트 실행 경로까지 끊음)나 과소 배제(문제 파일이 여전히 dist 에 남음) 어느 쪽도 아니다.

## 요약

핵심 변경은 두 계층으로 깔끔히 분리된다 — (1) `reject-masked-resubmission.ts` 가 "raw 우선 검사 → resolve → 재검사"라는 순서 지식과 판정 로직을 단일 지점에 캡슐화한 decorator/wrapper(개방-폐쇄 원칙 준수: 기존 `resolveTriggerParameters` 를 수정하지 않고 감싸 새 정책을 추가), (2) `masked-reject-callers-guard.ts` 가 그 캡슐화를 "누가 base 를 우회하지 못하게"라는 아키텍처 불변식으로 AST 기반 fitness function 테스트로 고정. 두 Manual 진입점(`executions.service.ts`, `workflows.controller.ts`)은 각자의 프레젠테이션 레이어 책임(HTTP 에러 코드 매핑)만 유지한 채 도메인 예외(`TriggerParameterValidationException`)를 공유하고, webhook/schedule 은 의도적으로 base 함수를 그대로 써 저작 주체가 다른 페이로드에 대한 오탐을 피한다 — 경계 기준(payload 저작 주체)이 코드·주석·가드 허용목록 세 곳에서 일관된다. 순환 의존성은 없고(`shared/utils` 는 명시적으로 cross-layer 중립 위치), 마커 판정 primitive 를 egress 모듈에서 공유하는 선택은 파일명과 실제 책임 범위가 다소 어긋나지만 마커 분기(divergence) 재발을 막기 위한 의도적 트레이드오프로 문서화돼 있어 심각하지 않다. 새로 도입된 추상화(wrapper 함수 1개, AST 가드 1개)는 과하지 않고 각각 반복된 실측 결함 클래스(검사 시점 오류, 가드 우회 형태 누적)에 정확히 대응한다.

## 위험도

NONE
