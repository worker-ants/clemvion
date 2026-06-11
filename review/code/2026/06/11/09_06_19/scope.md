# 변경 범위(Scope) 리뷰

## 발견사항

발견된 범위 이탈 없음.

각 관점별 검토 결과:

1. **의도 이상의 변경**: `auth.service.ts` 의 `refresh()` 정상 회전 분기에 `stored.user` null 가드가 추가되었다 (INFO 5 반영). 이는 C-1 원자화 작업의 직접적 범위는 아니지만, RESOLUTION.md 에 "INFO 5 — Requirement" 항목으로 명시 수용되어 이전 리뷰 사이클에서 의도적으로 포함된 수정이다. 리뷰 수용 기록이 있으므로 범위 이탈이 아닌 승인된 확장으로 판단한다.

2. **불필요한 리팩토링**: 없음. `generateTokens` 시그니처에 `manager?: EntityManager` 파라미터 추가는 C-1 원자화의 핵심 메커니즘이며, 기존 호출처는 default 값으로 동작이 보존된다.

3. **기능 확장**: TOCTOU 방어를 위한 조건부 UPDATE (`isRevoked: false, expiresAt: MoreThan(new Date())`) 추가는 plan 문서에 "옵션 A" 구현체의 일부로 명시되어 있고, RESOLUTION.md W2 항목에서 리뷰 후 의도적으로 추가된 보안 강화다. plan 범위 내 승인된 변경.

4. **무관한 수정**: 없음. 수정된 파일 7개 모두 C-1 작업과 직접 연관된다.
   - `auth.service.ts`, `auth.service.spec.ts` — 구현 + 단위 테스트
   - `plan/complete/auth-refresh-rotation-atomic.md` — 완료 plan 생성 (plan lifecycle 규약)
   - `plan/in-progress/refactor/05-database.md` — C-1 체크박스 완료 표시
   - `plan/in-progress/refactor/README.md` — C-1 항목 완료 취소선 표시
   - `review/code/2026/06/11/08_45_18/RESOLUTION.md`, `SUMMARY.md`, `_retry_state.json` — 리뷰 산출물 (규약상 정규 경로)

5. **포맷팅 변경**: 없음. 코드 변경은 모두 실질 로직 변경이며 공백/줄바꿈 전용 변경 없음.

6. **주석 변경**: 추가된 주석(`// 05 C-1 —`, JSDoc `@param manager`, `@internal` 등)은 모두 신규 기능·동작 설명이거나 RESOLUTION W1·W5·INFO 4 반영으로 승인된 변경이다.

7. **임포트 변경**: `EntityManager`, `MoreThan` 임포트 추가는 각각 optional manager 파라미터, 조건부 UPDATE에서 실제로 사용되는 심벌이다. 불필요한 임포트 없음.

8. **설정 변경**: 없음. 설정 파일 수정 없음.

## 요약

이번 변경은 `plan/in-progress/refactor/05-database.md` C-1 항목인 "refresh 토큰 rotation 비원자성 — 세션 소실 가능" 수정에 완전히 집중되어 있다. 수정된 모든 파일은 C-1 구현(`auth.service.ts`), 단위 테스트(`auth.service.spec.ts`), plan 상태 갱신(완료 이동 + in-progress 체크박스), 그리고 리뷰 산출물로 구성되며, 어느 것도 선언된 작업 범위 밖에 위치하지 않는다. `stored.user` null 가드 및 TOCTOU 조건부 UPDATE는 직전 리뷰 사이클(08_45_18)에서 명시 수용·적용된 항목이므로 사후 범위 이탈이 아니다.

## 위험도

NONE
