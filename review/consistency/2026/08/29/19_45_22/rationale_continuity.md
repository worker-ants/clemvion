### 발견사항

- **[INFO]** `secret-resolver.service.ts` 주석의 "형제 4곳" 수치는 이 checker 의 관할(Rationale 연속성) 밖이지만 참고로 남긴다
  - target 위치: diff `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` (C1/C2 판정 불요 사유 주석, "형제 3곳" → "형제 4곳"으로 수정)
  - 과거 결정 출처: `spec/5-system/3-error-handling.md` §6.3.1 (C1 AND C2 기준)
  - 상세: 이 수정 자체는 Rationale 과 상충하지 않는다 — §6.3.1 의 C1/C2 판정 로직을 그대로 따르는 주석 갱신일 뿐이다. 다만 "형제 4곳"이 실제로 `expression-resolver.service.ts/.spec.ts` + `code.handler.ts/.spec.ts` 4파일을 정확히 가리키는지는 이 checker(Rationale 연속성)가 아니라 구조적/사실 정합 checker 의 영역이라 여기서는 검증만 언급하고 등급을 매기지 않는다.
  - 제안: 별도 checker(코드 정합성) 가 파일 수를 grep 으로 재확인하도록 안내. Rationale 연속성 관점에서는 조치 불요.

### 요약

target diff(2건 신규 파일 `redis-fail-open-catalog-guard.ts`/`.spec.ts` + `http-exception.filter.spec.ts`·`expression-resolver.service.spec.ts`·`secret-resolver.service.ts`·`code.handler.spec.ts`·`packages/expression-engine/error-shape.spec.ts` 수정)은 두 축으로 나뉜다. (1) `clemvion.redis.fail_open` 의 `component` 라벨 3자(유니온·spec 카탈로그·실배선) 정합 가드는 `spec/data-flow/9-observability.md` `## Rationale` "`component` 를 실제 배선된 값만 열거하는 이유"가 요구하는 "코드 리터럴 유니온과 spec 카탈로그를 동시에 넓히는 규칙"을 정확히 계측 지점으로 고정한 것이며, `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 이 결정의 전체 이력(18→21개 파일 재실측, 19곳 배선은 별건으로 명시적 defer)이 살아있어 무근거 번복이 아니다. (2) `GlobalExceptionFilter` 의 `cause` 비노출 봉투 테스트는 `spec/5-system/3-error-handling.md` §6.3.1 Rationale 이 스스로 지목한 취약점("나중에 누가 `.cause` 를 봉투에 실으면 과거의 모든 부착이 소급해 노출이 된다")을 막는 계측 지점이며, §6.3.1 이 채택한 C1/C2(에러 객체 자신의 성질) 판정 기준을 되돌리거나 §6.3.1 이 명시적으로 기각한 "소비처가 직렬화하는가" 기준을 결정축으로 재도입하는 것이 아니다 — 오히려 그 기각된 축이 붕괴할 경우를 대비한 방어망을 추가한 것으로 Rationale 의 우려와 정합한다. 두 변경 모두 spec 파일 자체를 고치지 않았고 고칠 필요도 없다(구현이 기존 spec 문면과 이미 일치). 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 중 어느 것도 발견되지 않았다.

### 위험도
NONE
