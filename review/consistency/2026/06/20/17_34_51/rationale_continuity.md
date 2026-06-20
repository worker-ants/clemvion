### 발견사항

발견된 Rationale 연속성 위반 없음.

**[INFO]** `data-flow/2-auth.md §1.2` 인용의 정확도

- target 위치: `auth.service.ts` JSDoc 주석 (`data-flow/2-auth.md §1.2` 가 bcrypt 비교를 일관되게 `AuthService` 에 배치한다(레이어 정렬))
- 과거 결정 출처: `spec/data-flow/2-auth.md §1.2` 시퀀스 다이어그램 + `plan/in-progress/refactor/02-architecture.md §C-3`
- 상세: `data-flow/2-auth.md §1.2` 의 시퀀스 다이어그램은 로그인 플로의 bcrypt.compare 위치를 `AuthService` 로 표기한다. 이 다이어그램이 "모든 bcrypt.compare 는 Service 에 있어야 한다"는 일반 원칙을 명시한 것은 아니다 — 로그인 시퀀스를 서술한 것이다. 그러나 `plan/in-progress/refactor/02-architecture.md §C-3` 가 바로 이 다이어그램을 근거로 "controller 내 bcrypt 는 spec 의 데이터 흐름 모델과 불일치"로 판정하고 Option A(AuthService.verifyPasswordForUser 이관)를 권장·채택했으므로, 구현의 인용은 plan 의 논리를 충실히 따른다. spec Rationale 에 명시적 원칙이 있는 것은 아니지만 plan 의 분석과 정합하다.
- 제안: 현 JSDoc 인용은 spec-plan 문맥상 정확하므로 변경 불필요. 향후 data-flow/2-auth.md 에 "bcrypt 비교는 AuthService 에 집중" 원칙을 명문화하면 유사 리팩터링의 근거가 더 명확해진다 (선택적 개선).

---

### 요약

target 변경(AuthController.disable2fa 의 raw bcrypt 검증 블록을 AuthService.verifyPasswordForUser 로 이관)은 기존 spec Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 원칙을 위반하지 않는다. 반대로 `plan/in-progress/refactor/02-architecture.md §C-3` 이 "controller 내 bcrypt 는 spec 데이터 흐름 모델과 불일치"로 분류하고 Option A(AuthService 이관)를 권장한 결정을 정확히 이행한 것이다. 에러 코드(PASSWORD_REQUIRED/PASSWORD_INVALID)·메시지·401 shape 보존 요건도 준수됐다. 기각된 대안(Option B — 보류/controller 잔존)의 재도입 없음. Rationale 연속성 위반 없음.

### 위험도

NONE
