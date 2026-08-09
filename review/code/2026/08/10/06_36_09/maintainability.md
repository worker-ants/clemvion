# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** UUID 형태 판정 정규식이 프로덕션 `isUuidShaped` 와 별도로 손으로 복제됨
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.spec.ts:58-59` (`UUID_SHAPED` 상수)
  - 상세: `codebase/backend/src/common/utils/uuid.ts:42-43` 의 `UUID_SHAPE_PATTERN`
    (`export function isUuidShaped`) 과 사실상 같은 정규식을 이 spec 이 로컬 상수로 다시
    작성했다 (`i` 플래그 유무만 다름 — production 은 대소문자 무시, 여기는 소문자 전용).
    두 곳이 "같은 개념(UUID 형태)"을 서로 다른 소스로 유지하므로, 나중에 `isUuidShaped` 의
    판정 기준이 바뀌면(예: 브레이스 형태 허용 등) 이 spec 은 조용히 옛 기준으로 남는다.
    다만 의도적으로 production 함수에 의존하지 않고 독립 판정을 쓴 것으로 보인다 —
    `isUuidShaped` 자체에 회귀가 생겨도 이 spec 의 export-추출 로직이 영향받지 않게 하려는
    설계일 수 있어 완전한 결함은 아니다.
  - 제안: 의도적 독립이면 그 이유를 주석 한 줄로 남기고, 아니라면 `isUuidShaped` 를 import 해
    재사용해 두 정의가 갈라지지 않게 한다.

- **[INFO]** 로드 시점 호출 검증이 소스 텍스트의 정확한 포맷(줄 단위·세미콜론)에 결합됨
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.spec.ts:42-44`
    (`callSites` regex 필터, `/^\s*assertAllUnique\(ALL_WS\);/`)
  - 상세: `assertAllUnique(ALL_WS);` 가 정확히 한 줄에, 세미콜론 포함, 다른 명명(별칭 import 등)
    없이 쓰였을 때만 매치한다. Prettier 기본 설정(세미콜론 유지)이라 당장 깨질 위험은 낮고,
    "헬퍼 존재 ≠ 호출" 을 검증하려는 의도와 이유가 주석에 충분히 설명돼 있다. 이 파일을 프리티어가
    재포맷하거나 호출부가 리팩터링되면(예: 변수에 담아 호출) 실제 배선은 멀쩡한데 이 테스트만
    깨질 수 있다는 점만 인지해두면 된다. 같은 "소스 텍스트 스캔" 패턴이 이 코드베이스에
    이미 존재한다(`production-guards.spec.ts`, `config-env-coverage.spec.ts`, cafe24
    `catalog-*-drift.spec.ts`)는 점에서 컨벤션 일관성은 있다.
  - 제안: 현행 유지 가능. 필요시 정규식에 후행 주석·개행을 허용하도록 살짝 관대하게 두거나,
    "이 줄 포맷을 바꾸지 말 것" 주석을 호출부(`workspace-id-fixtures.ts:88`)에도 남기면 두
    파일 중 하나만 봐도 결합을 알 수 있다.

## 요약

이번 changeset 은 기존 리뷰에서 지적된 두 항목(픽스처 값 유일성 가드 부재, nil-UUID 회귀
근거의 4곳 중복)을 실제로 해소한다. `assertAllUnique`/`ALL_WS` 는 순수 함수 + 로드 시점 호출
분리로 판정 로직 자체를 단위 테스트 가능하게 만들었고, 신설 spec 은 "헬퍼가 존재한다"와
"헬퍼가 실제로 배선돼 호출된다"를 구분해서 검증하는 등 vacuous 테스트를 피하려는 설계 의도가
주석으로 명확히 드러난다. `uuid.spec.ts`/`workspace-id-fixtures.ts` 의 nil-UUID 관련 산문은
근거·앵커의 SoT 를 `uuid.ts` 의 `isUuidShaped` docstring 한 곳으로 모으고 나머지는 포인터로
축약해 중복 산문이 여러 곳에서 따로 stale 해지던 문제를 구조적으로 줄였다. 함수 길이·중첩
깊이·네이밍(SCREAMING_SNAKE_CASE 상수 / camelCase 함수)은 기존 컨벤션과 일관되고, 매직
넘버성 하드코딩도 없다. 유일한 옥의 티는 spec 내 UUID 형태 정규식이 production 판정 로직과
별도로 손으로 복제돼 있다는 점과, 소스 텍스트를 정확한 포맷으로 스캔하는 배선 검증 테스트가
포맷 변경에 다소 취약하다는 점인데, 둘 다 의도와 근거가 주석에 충분히 남아 있어 심각한
유지보수성 저해로 보지 않는다. plan 문서(`auth-guard-reflection-hardening.md`) 변경은
체크리스트 항목을 완료로 갱신하고 근거를 남긴 것으로 문서 위생 관점에서 적절하다.

## 위험도
LOW
