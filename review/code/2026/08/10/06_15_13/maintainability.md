# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `Set` 이 동일 입력으로 두 번 생성됨 (조건문·에러 메시지 각각)
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts:73-76`
  - 상세: `if (new Set<string>(ALL_WS).size !== ALL_WS.length)` 와 에러 메시지 템플릿 리터럴 안의
    `new Set<string>(ALL_WS).size` 가 각각 별도로 `Set` 을 구성한다. `ALL_WS` 가 7개 원소뿐이고
    모듈 로드 시 1회만 실행되므로 성능상 문제는 없으나, 같은 계산을 두 곳에 반복해 두면
    "두 계산이 항상 같은 값을 낸다"는 사실이 코드 형태만으로는 드러나지 않아 가독성이 소폭
    떨어진다.
  - 제안: `const uniqueCount = new Set(ALL_WS).size;` 로 한 번만 계산해 조건문과 메시지 양쪽에서
    재사용하면 의도가 더 명확해진다. 우선순위는 낮다(INFO) — correctness 리스크는 없다.

## 요약

이번 changeset 은 세 파일 모두 작고 목적이 뚜렷하다. `workspace-id-fixtures.ts` 에 추가된
값-유일성 가드는 모듈 자신의 계약("이름은 역할, 값은 서로 다르다")을 로드 시점 런타임 검사로
강제해 향후 픽스처 추가/수정 시 조용한 회귀(값 충돌로 cross-tenant 테스트가 무의미해지는 것)를
막는다 — 목적을 설명하는 JSDoc 이 충실하고 네이밍(`ALL_WS`, `HEADER_WS`/`TOKEN_WS` 등)도 기존
컨벤션과 일관된다. 유일한 개선점은 `Set` 을 두 번 구성하는 사소한 중복(INFO)뿐이다.
`uuid.spec.ts` 변경은 순수 주석 정리로, 동일한 근거·앵커 정정 이력이 소스 3곳+plan 1곳에
산문으로 복제되던 것을 `uuid.ts` 의 `isUuidShaped` docstring 한 곳으로 모으고 나머지는
포인터로 축약했다 — 정확히 DRY 원칙에 부합하는 개선이며, 실측(`workspace-context.util.ts:74` 가
유일한 프로덕션 호출부)과 `roles.guard.spec.ts` 배제 사유처럼 SoT 에 없는 고유 사실은 그대로
남겨 정보 손실이 없다. `plan/in-progress/auth-guard-reflection-hardening.md` 는 체크리스트
항목 완료 기록으로, 코드가 아닌 작업 추적 문서라 이번 리뷰 관점(가독성/네이밍/함수 길이 등)이
직접 적용되지 않으며 프로젝트 컨벤션(근거 추적 중심 plan 기록)과 일관된다. 전반적으로 순환
복잡도·중첩·매직 넘버·함수 길이 문제는 없고, 문서 중복 제거라는 유지보수성 목표를 정확히
달성한 변경이다.

## 위험도
NONE
