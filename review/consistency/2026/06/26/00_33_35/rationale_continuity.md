# Rationale 연속성 검토 결과

검토 범위: `03 m-4 — backend catch 변수명 통일 (eslint-plugin-unicorn catch-error-name 단일룰, name:'err', ^_ ignore, --fix 일괄 ~49파일)`

검토 모드: 구현 착수 전 (--impl-prep)

## 발견사항

### INFO-1: 명명 규약 SoT 를 lint 설정으로 두는 접근 — spec 과 명시적 충돌 없음, 단 갱신 안내
- **target 위치**: `plan/in-progress/refactor/03-maintainability.md m-4` — "lint 설정이 SoT 가 되어 spec 갱신도 불요"
- **과거 결정 출처**: `spec/conventions/error-codes.md ## Rationale` — "SoT 를 분리하는 이유: 카탈로그·envelope·HTTP status·표기를 각 축으로 분리해 독립 진화시키고, 본 문서는 명명 규율만 소유해 책임 중복을 피한다."
- **상세**: `error-codes.md` 는 에러 **코드 문자열**(`UPPER_SNAKE_CASE`)의 명명만 소유하고, catch 파라미터(`err`/`error`/`e`)의 변수명 규약은 해당 문서의 적용 범위 밖이다. 따라서 `error-codes.md` 의 "SoT 분리" Rationale 이 본 m-4 를 차단하지 않는다. target 이 명명 규약 SoT 를 lint 설정으로 삼겠다는 것은 새로운 레이어의 SoT 지정이며 기존 분리 원칙을 위반하지 않는다. 다만 현재 어떤 spec 문서도 catch 변수명 규약을 명시하지 않으므로, "lint 설정 = SoT" 라는 사실을 spec 어딘가에 한 줄 기록하지 않으면 후속 기여자가 이 결정 배경을 추적하기 어렵다.
- **제안**: `spec/conventions/error-codes.md § Overview` 책임 경계 표에 "catch 파라미터 명명 규약: lint 설정(`eslint.config.mjs`, `unicorn/catch-error-name`)이 SoT" 한 줄을 추가하거나, 본 plan 항목이 완료될 때 brief Rationale 주석을 eslint 설정 파일에 인라인으로 남기면 결정 추적성이 유지된다 (spec 갱신이 "불요"인 것과는 별개로, lint 파일이 SoT 라는 사실 자체를 문서화하는 최소 흔적을 남기는 것을 권장).

### INFO-2: `unicorn` preset 전체 비활성 결정 — 기각된 대안 처리 명확화
- **target 위치**: `plan/in-progress/refactor/03-maintainability.md m-4` 개선 방안 1 — "전체 preset 비활성 — 부수 규칙 유입 차단"
- **과거 결정 출처**: 해당 결정을 명시 기각한 이전 Rationale 없음 (unicorn preset 은 과거 채택·기각 이력이 spec/plan 에 등재된 바 없음)
- **상세**: `eslint-plugin-unicorn` 의 전체 preset 을 비활성하고 단일 룰만 활성하겠다는 결정은 기존 Rationale 에서 명시적으로 거부된 대안을 되살리는 케이스가 아니다 — 이전에 unicorn preset 을 채택했다가 폐기한 기록이 없다. 따라서 정확히는 "기각된 대안의 재도입" 이 아니라 새로운 결정이다. 단, 옵션 비교표에 "B. 수동 일괄 통일(lint 룰 없이)" 를 두 번째 후보로 기록했으므로, A(unicorn 단일 룰) 를 채택한 Rationale 이 plan 내에 이미 인라인으로 작성되어 있다. Rationale 공백은 없다.
- **제안**: 해당 없음 (plan 의 옵션 비교표 + 권장 근거가 충분히 Rationale 역할을 한다).

### INFO-3: `^_` ignore 패턴 — 기존 eslint `no-unused-vars` 패턴과 일관
- **target 위치**: `plan/in-progress/refactor/03-maintainability.md m-4` 개선 방안 3 — "`^_` ignore 유지"
- **과거 결정 출처**: `codebase/backend/eslint.config.mjs` 기존 `no-unused-vars` 규칙 — `caughtErrorsIgnorePattern: '^_'`
- **상세**: 현재 eslint 설정이 이미 `caughtErrorsIgnorePattern: '^_'` 로 catch 변수에 `_` prefix 무시를 허용하고 있다. `unicorn/catch-error-name` 의 `^_` ignore 와 일관하므로 invariant 충돌이 없다.
- **제안**: 구현 시 eslint 설정에 unicorn 룰을 추가할 때, 기존 `no-unused-vars` 의 `caughtErrorsIgnorePattern: '^_'` 와 `unicorn/catch-error-name` 의 `ignore: ['^_']` 가 모두 적용됨을 확인하면 된다. 충돌 없음.

## 요약

이번 m-4 구현 대상(eslint-plugin-unicorn 추가 + catch-error-name 단일 룰 + --fix 일괄)은 기존 spec Rationale 에서 명시적으로 기각·폐기된 대안을 재도입하지 않는다. `error-codes.md` 는 에러 코드 문자열 명명만 소유하며 catch 파라미터 변수명은 그 범위 밖이다. 기존 eslint 설정의 `^_` ignore 패턴과도 일관한다. 유일한 INFO 수준 갭은, lint 설정이 catch 변수명 규약의 SoT 가 된다는 사실을 spec 또는 lint 설정 인라인에 한 줄이라도 남겨 추적성을 확보하면 더 좋다는 것이다. Rationale 연속성 관점에서 전반적으로 이상 없음.

## 위험도

NONE
