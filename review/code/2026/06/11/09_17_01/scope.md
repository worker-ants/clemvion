# 변경 범위(Scope) 리뷰 — auth-refresh-rotation-atomic

## 발견사항

### [INFO] `auth.service.ts` — 주석 텍스트 변경 (기능과 무관한 언어 전환)
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` `generateTokens()` 내부 (`expiresIn: 900` 및 `// Create refresh token` 라인)
- 상세: `// 15 minutes` → `// 15분`, `// Create refresh token` → `// refresh token 생성` 로 교체됐다. 이 두 줄은 05 C-1 원자화 목표와 직접 연관이 없는 단순 언어 전환이다. 기능 변경이 전혀 없고 해당 함수를 이번에 수정한 김에 한국어로 통일한 것이므로, 실질 문제는 없다. 다만 scope 관점에서 의도 외 수정이 포함된 점을 기록한다.
- 제안: 언어 통일은 유지보수성 관점에서 바람직하므로 수용 가능. 단, 엄격한 scope 기준에서는 별도 커밋으로 분리하는 것이 이상적.

### [INFO] `auth.service.ts` — `stored.user` null 가드 추가 (범위 외 방어 코드)
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` `refresh()` 정상 회전 분기 (`const user = stored.user` 직후)
- 상세: 05 C-1 의 핵심 목표는 revoke+INSERT 원자화다. `stored.user` null 가드는 원자화와 무관한 방어 코드로, reuse 분기에 이미 있는 패턴과의 일관성을 맞추기 위해 추가됐다. 기능적으로 올바르고 보안상 이로우나, 이번 변경의 원래 요청 범위(C-1 원자화)에는 포함되지 않는 추가 수정이다.
- 제안: RESOLUTION.md 에 INFO 5 항목으로 이미 기록되어 있고, 방어 패턴 일관성 향상이라는 근거가 명확하므로 수용 가능.

## 요약

변경은 `plan/in-progress/refactor/05-database.md` C-1 에 정의된 "refresh 토큰 rotation 원자화" 목표에 전반적으로 정확히 부합한다. 핵심 변경(트랜잭션 래핑, 조건부 UPDATE, optional EntityManager, 단위 테스트 4건, spec 업데이트, plan 문서 갱신)은 모두 해당 목표의 직접 구현이다. 의도 외 수정으로 볼 수 있는 항목은 두 가지(주석 언어 전환, `stored.user` null 가드)이나, 둘 다 사소하고 해롭지 않으며 RESOLUTION.md 에 근거가 기록된 상태다. 불필요한 리팩토링, 기능 확장, 무관 파일 수정, 포맷팅 혼입, 설정 변경은 발견되지 않는다.

## 위험도

NONE
