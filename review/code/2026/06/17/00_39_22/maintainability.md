# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### [INFO] PROJECT.md — 버전·도구 정책 단락 문장 길이 과다
- 위치: `PROJECT.md` +38~39행 (새로 추가된 버전 핀 정책·Node 지원 floor 항목)
- 상세: 한 항목이 150자를 초과하는 단일 문장으로 서술되어 있다. 문장 내에 em-dash(`—`), 괄호, 예시 목록이 혼재하여 빠른 스캔이 어렵다. 특히 `engines.node` 항목은 "외부 SDK·내부 앱" 구분, `@types/node` 정렬 근거, README 표기 의미까지 한 줄에 집약되어 있다.
- 제안: 항목마다 한 문장에 하나의 규칙만 담거나, 소항목(들여쓰기 리스트)으로 분리하여 각 근거를 독립적으로 확인할 수 있도록 구조화한다.

### [INFO] jest.config.ts — 인라인 주석 구두점 불일치
- 위치: `codebase/backend/jest.config.ts` +88~90행
- 상세: 기존 주석은 영문 문장 끝에 마침표(`.`)를 사용하는 반면, 새로 추가된 첫 번째 줄 (`uuid >=12, p-limit >=4, yocto-queue;`)은 세미콜론(`;`)으로 끝나 스타일이 혼재된다. 동일 블록 내 주석이면 구두점을 통일해야 가독성이 향상된다.
- 제안: 세미콜론을 마침표로 교체하거나, 기존 주석도 세미콜론으로 통일한다.

### [INFO] auth.service.spec.ts — 불필요한 eslint-disable 제거 vs 미사용 변수 처리 불일치
- 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts` -35행(`eslint-disable-next-line` 삭제)
- 상세: `eslint-disable-next-line @typescript-eslint/no-unused-vars` 주석을 삭제하고 빈 줄로 대체했다. `jwtService`가 실제로 사용되지 않는 경우 린트 오류가 재발생할 수 있고, 사용되는 경우라면 원래 주석이 불필요한 억제였음을 의미한다. 양쪽 모두 이유가 불명확하다.
- 제안: `jwtService`가 실제로 사용되는지 확인하고, 사용되지 않는다면 변수 선언 자체를 제거하거나 `_jwtService`로 네이밍 컨벤션을 적용하여 의도를 명시한다.

### [INFO] auth.service.spec.ts — 불필요한 캐스트 제거 일관성
- 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts` -584~585행 vs +586~587행
- 상세: `(sessionsService.revokeAllFamilies as jest.Mock).mock` → `sessionsService.revokeAllFamilies.mock` 으로 불필요한 캐스트를 제거했다. 같은 파일의 +588행 `(jwtService.sign as jest.Mock).mock` 패턴은 동일하게 캐스트가 남아 있다. 일관성이 없다.
- 제안: `jwtService.sign.mock`으로 동일하게 캐스트를 제거하거나, 그 줄도 같은 방식으로 통일한다.

### [INFO] totp.service.ts — `EPOCH_TOLERANCE_SECONDS` 상수 위치와 범위 설명
- 위치: `codebase/backend/src/modules/auth/totp.service.ts` +18행
- 상세: 상수에 달린 주석이 "v12 `authenticator.options = { window: 1 }` 와 동등"이라고 설명하며 마이그레이션 맥락을 함께 서술한다. 향후 v12 레거시 맥락이 불필요해지면 주석이 노이즈가 된다. 상수 자체의 의미(허용 시간창 ±1 step = 60초)가 이름만으로 부분적으로 전달되지만, `EPOCH_TOLERANCE_SECONDS`라는 이름에 `= 30`이 "±1 step"을 나타낸다는 점이 즉시 드러나지 않는다.
- 제안: 상수 이름을 `TOTP_WINDOW_SECONDS` 또는 `TOTP_EPOCH_TOLERANCE_S`로 바꾸거나, 주석을 v12 마이그레이션 설명과 의미 설명으로 분리하여 유지보수 편의를 높인다. v12 참조는 별도 마이그레이션 노트나 CHANGELOG에 옮기는 것이 장기적으로 더 깨끗하다.

### [INFO] totp.service.ts — `verifyCode` 내 에러 로그 메시지 국문/영문 혼재
- 위치: `codebase/backend/src/modules/auth/totp.service.ts` +47행
- 상세: 서비스 전체적으로 에러 메시지나 예외 메시지는 한국어(`'사용자를 찾을 수 없습니다.'`)로 작성되어 있는데, `verifyCode` 내 `logger.warn`은 영문(`'TOTP verify threw, treating as invalid: ...'`)으로 작성되었다. 코드베이스 로그 언어 컨벤션이 혼재된다.
- 제안: 프로젝트의 로그 언어 컨벤션(서버 로그 = 영문 or 한국어)을 명확히 정하고, 이에 맞게 통일한다. 현재 파일 내에서도 예외 메시지는 한국어, 로그는 영문이 혼재하므로 컨벤션 결정 후 일괄 정리가 필요하다.

### [INFO] totp.service.spec.ts — 헬퍼 함수 `bootstrapSecret` 위치
- 위치: `codebase/backend/src/modules/auth/totp.service.spec.ts` +775~786행
- 상세: `bootstrapSecret` 헬퍼 함수가 파일 맨 끝에 선언되어 있어 사용 위치(+681행)보다 훨씬 뒤에 나타난다. 함수 선언 전 참조는 TypeScript/JavaScript 호이스팅 규칙상 문제없지만, 가독성 관점에서 테스트 헬퍼가 `describe` 블록 밖 파일 끝에 분산되면 파일 탐색 비용이 증가한다.
- 제안: 헬퍼 함수를 `describe` 블록 상단 또는 `beforeEach` 바로 아래로 이동하거나, 동일 파일 내 테스트 헬퍼 섹션(`// --- helpers ---`)을 최상단 `const` 영역에 배치하는 패턴을 택해 일관성을 높인다.

### [INFO] totp.service.spec.ts — 매직 리터럴 `'000000'`, `'123456'`
- 위치: `codebase/backend/src/modules/auth/totp.service.spec.ts` +702행, +708행
- 상세: `'000000'`은 "틀린 코드" 의미로, `'123456'`은 "임의 코드" 의미로 사용되었다. 의미가 없는 하드코딩된 문자열이다.
- 제안: `const INVALID_TOTP_CODE = '000000'`, `const ARBITRARY_CODE = '123456'`처럼 상수로 분리하거나, 인라인 주석(`// invalid totp`)을 추가하여 의도를 명확히 한다.

### [INFO] totp.service.spec.ts — RFC6238 상수명에 `_B32` 접미사
- 위치: `codebase/backend/src/modules/auth/totp.service.spec.ts` +21행
- 상세: `RFC6238_SECRET_B32`는 명확하고 좋은 네이밍이다. 다만 위 주석이 이 상수의 의미를 길게 설명하고 있는데, 상수명 자체에 `RFC6238_APPENDIX_B_SECRET` 같이 Appendix B 출처까지 담으면 주석 없이도 의도가 전달된다. (현재는 사소한 수준으로 INFO 등급.)
- 제안: 현행 유지 가능. 보다 엄밀한 네이밍을 원하면 `RFC6238_APPENDIX_B_SECRET_B32`로 변경을 고려한다.

## 요약

이번 변경은 otplib v12→v13 메이저 업그레이드, `@types/node` ^24 정렬, Node engines 플로어 통일, 그리고 관련 테스트 추가로 구성된다. `totp.service.ts`는 v13 functional API로 깔끔하게 전환되었고, `verifyCode` 헬퍼 추출로 책임 분리가 명확해졌다. `totp.service.spec.ts`는 RFC 6238 표준 벡터를 활용한 cross-version 호환성 테스트까지 포함해 의도가 잘 문서화되어 있다. 주요 유지보수성 우려는 소규모로, 로그 언어 혼재(영문/한국어), 캐스트 제거 불일관성, 테스트 내 매직 리터럴 정도이다. 이 중 어느 것도 즉각적인 수정이 필요한 결정적 결함은 아니며, 코드베이스 전체 컨벤션 확립 시 일괄 정리하는 수준의 개선 사항이다.

## 위험도

LOW
