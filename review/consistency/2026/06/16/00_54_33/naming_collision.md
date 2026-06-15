# 신규 식별자 충돌 검토 결과

## 발견사항

이번 diff(`1899c05e..HEAD`)가 도입하는 신규 식별자는 다음 5종이다.

| 신규 식별자 | 위치 |
|------------|------|
| `isIpOrCidr` (함수) | `codebase/backend/src/modules/auth-configs/dto/is-ip-or-cidr.validator.ts` |
| `IsIpOrCidrConstraint` (class) | 동 파일 |
| `IsIpOrCidr` (property 데코레이터) | 동 파일 |
| `SECRET_AUTOCLEAR_MS` (상수) | `codebase/frontend/src/app/(main)/authentication/page.tsx:108` |
| `AUTOCLEAR_MS` (테스트 로컬 상수) | `codebase/frontend/src/app/(main)/authentication/__tests__/generated-key-autoclear.test.tsx:31` |

spec 변경(1-data-model.md §2.17 `ip_whitelist` 설명 확장, 2-navigation/6-config.md §A.4 문단 추가)은 기존 필드명·섹션 ID를 수정·보완하는 것으로 신규 식별자를 발행하지 않는다.

---

각 항목에 대해 기존 사용처와의 충돌을 점검한다.

### 1. `isIpOrCidr` / `IsIpOrCidrConstraint` / `IsIpOrCidr`

- **INFO** — 신규 커스텀 validator, 충돌 없음
  - target 신규 식별자: `isIpOrCidr` (저수준 검증 함수), `IsIpOrCidrConstraint` (ValidatorConstraint 클래스, name=`'isIpOrCidr'`), `IsIpOrCidr` (property 데코레이터)
  - 기존 사용처: 백엔드 전체에서 `ValidatorConstraint`·`registerDecorator`를 사용하는 파일은 `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`(name=`'languageHintsPlaceholder'`) 단 1건. `isIpOrCidr` / `IsIpOrCidr` / `IsIpOrCidrConstraint` 라는 이름은 기존 코드베이스 어디에도 존재하지 않는다.
  - 상세: 충돌 없음. ValidatorConstraint `name` 속성(`'isIpOrCidr'`)도 기존 `'languageHintsPlaceholder'`와 다르다. 파일명(`is-ip-or-cidr.validator.ts`)도 관례(`*.validator.ts`)에 부합하며 기존 파일과 겹치지 않는다.
  - 제안: 없음. 명명이 명확하고 충돌 없음.

### 2. `SECRET_AUTOCLEAR_MS`

- **INFO** — 신규 모듈-레벨 상수, 충돌 없음
  - target 신규 식별자: `SECRET_AUTOCLEAR_MS = 30_000` — `authentication/page.tsx` 모듈 스코프 상수
  - 기존 사용처: `codebase/frontend/src` 전체에서 `SECRET_AUTOCLEAR_MS` 또는 유사한 `AUTOCLEAR` 접두 상수는 해당 파일 외에 발견되지 않는다.
  - 상세: 파일 스코프 내에서만 참조되며 외부로 export되지 않는다. 다른 모듈과의 이름 충돌 가능성 없음.
  - 제안: 없음.

### 3. `AUTOCLEAR_MS` (테스트 로컬 상수)

- **INFO** — 테스트 파일 로컬 상수, 충돌 없음
  - target 신규 식별자: `AUTOCLEAR_MS = 30_000` — `generated-key-autoclear.test.tsx` 파일 로컬 상수
  - 기존 사용처: 없음. 테스트 파일 내부 로컬 이름이며 export 없음.
  - 상세: 주석에 "page.tsx 의 `SECRET_AUTOCLEAR_MS` 와 동일해야 한다"고 명시되어 있으나 두 상수가 동기화되지 않을 경우 테스트가 경계 조건을 잘못 검증할 수 있다. 의미적으로 같은 값을 두 곳에 하드코딩한 점은 주의할 만하나 충돌(동일 식별자가 다른 의미로 쓰이는 경우)은 아니다.
  - 제안(INFO 수준): `AUTOCLEAR_MS`를 `page.tsx`에서 named export하거나 공용 상수 파일로 추출해 두 파일이 같은 값을 참조하도록 하면 미래 값 변경 시 테스트가 자동 반영된다. 현재 테스트는 값 불일치를 컴파일 타임에 감지하지 못한다.

---

## 요약

이번 변경이 도입하는 신규 식별자는 `isIpOrCidr` / `IsIpOrCidrConstraint` / `IsIpOrCidr` (백엔드 커스텀 validator 3종)와 `SECRET_AUTOCLEAR_MS` / `AUTOCLEAR_MS` (프론트엔드 모듈·테스트 로컬 상수 2종)이다. 5종 모두 기존 코드베이스에 동일 이름이 존재하지 않으며 spec 변경도 기존 필드명·섹션을 수정하는 범위에 그쳐 신규 ID를 발행하지 않는다. ValidatorConstraint `name` 충돌, 파일명 충돌, API endpoint 중복, 이벤트명·환경변수 충돌은 발견되지 않았다. `AUTOCLEAR_MS`가 `SECRET_AUTOCLEAR_MS`와 값을 하드코딩으로 이중 관리하는 점은 미래 유지보수 리스크이지만 현재 충돌은 아니다.

## 위험도

NONE
