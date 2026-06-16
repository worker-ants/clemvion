# 유지보수성(Maintainability) 리뷰

## 발견사항

### auth.service.spec.ts

- **[INFO]** 캐스팅 제거로 일관성 개선
  - 위치: line 1055 (diff 기준)
  - 상세: `(jwtService.sign as jest.Mock).mock` → `jwtService.sign.mock` 변경으로 `sessionsService.revokeAllFamilies.mock` 과 동일한 패턴으로 통일됨. 코드베이스 내 다른 `jest.Mocked<T>` 접근 방식과 일치해 가독성이 개선되었다. 변경 자체는 적절함.
  - 제안: 이미 수정 완료. 이 파일 내 다른 위치에 잔존하는 `as jest.Mock` 캐스팅이 없는지 전체 점검 권장.

- **[INFO]** `mockUser` 상수의 매직 리터럴
  - 위치: `auth.service.spec.ts` lines 108-116
  - 상세: `id: 'user-uuid-1'`, `email: 'test@example.com'` 등이 파일 전체에서 직접 중복 참조됨. 이번 diff 변경 대상은 아니나 기존 패턴 검토 차원에서 언급.
  - 제안: 현재 `mockUser` 상수로 중앙 관리 중이므로 허용 범위. 추후 테스트 확장 시 `mockUser.id` 참조를 일관성 있게 사용할 것.

### totp.service.spec.ts

- **[INFO]** `bootstrapSecret` 헬퍼 위치
  - 위치: 파일 맨 끝 (line 1312-1323)
  - 상세: `bootstrapSecret` 헬퍼가 사용 위치(`verifyAndEnable` describe 블록)보다 훨씬 뒤에 선언되어 있음. JavaScript 함수 선언식이 아닌 `async function` 이지만 hoisting 되므로 런타임 문제는 없다. 그러나 코드 탐색 시 헬퍼를 찾으려면 파일 끝까지 내려가야 하는 가독성 이슈가 있음.
  - 제안: `describe('TotpService')` 블록 상단 또는 상수 선언부(`RFC6238_SECRET_B32`) 직후로 이동.

- **[INFO]** 새로 추가된 `disable` describe 블록 내 테스트 케이스 1개
  - 위치: lines 1111-1118 (추가된 코드)
  - 상세: `disable()` 테스트가 정상 경로 1개만 커버. idempotent 동작(이미 disabled 상태에서 재호출) 및 없는 userId 전달 시 동작이 테스트되지 않음. 단, `disable()` 구현 자체가 userId 유효성 검증 없이 `usersService.update` 를 직접 위임하는 단순 위임 메서드이므로 현재 커버리지가 구현 복잡도에 비례함.
  - 제안: 허용 범위. 구현이 단순 위임이므로 현재 테스트로 충분. 추후 `disable()` 에 가드 로직이 추가되면 케이스 보강 필요.

- **[INFO]** 새로 추가된 `verifyAndEnable` user=null 테스트의 설명 언어
  - 위치: line 1102
  - 상세: 새로 추가된 테스트 설명 `'사용자가 없으면(findById null) BadRequestException'` 은 한국어 + 영문 혼재. 기존 파일의 다른 테스트도 동일 혼재 패턴이므로 일관성은 유지됨.
  - 제안: 이 패턴은 코드베이스 전체 컨벤션이므로 별도 조치 불필요.

### totp.service.ts

- **[INFO]** 로그 메시지 언어 혼재
  - 위치: `verifyCode` 메서드 (line 1427), `verifyForLogin` 메서드 (line 1519)
  - 상세: `verifyCode` 의 `logger.warn` 메시지는 영문(`TOTP verify threw...`), `verifyForLogin` 의 `logger.log` 메시지는 영문(`User ${user.id} used a recovery code...`), 예외 메시지는 한국어(`인증 코드가 올바르지 않습니다.`). 서비스 예외 메시지(사용자에게 노출)와 내부 로그(운영자용) 언어를 분리하는 관행 자체는 합리적이나 프로젝트 공식 컨벤션이 문서화되지 않음. 이번 diff 에서 W2 수정으로 로깅 내용은 개선되었음.
  - 제안: 로그 언어 컨벤션(`내부 로그=영문, 사용자 메시지=한국어` 또는 전체 영문)을 `spec/conventions/` 에 1회 정리 권장. 당장 변경 불필요.

- **[INFO]** `disable()` JSDoc 주석 간결성
  - 위치: line 1490
  - 상세: `/** 2FA 비활성. 호출 전에 비밀번호 재확인은 컨트롤러에서 수행. */` 주석이 컨트롤러 책임을 명시적으로 기술. 단일 책임 경계를 문서화한 좋은 패턴.
  - 제안: 긍정 평가. 현행 유지.

- **[INFO]** `null as unknown as string` 캐스팅
  - 위치: `disable()` 메서드 line 1493
  - 상세: `twoFactorSecret: null as unknown as string` — `UsersService.update` 의 타입이 `Partial<User>` 를 받으면서 `twoFactorSecret: string | null` 을 허용하지 않아 이중 캐스팅이 필요한 상황. 이는 `UsersService.update` 의 타입 정의 문제를 `null as unknown as string` 으로 우회하는 것이므로 유지보수 부채.
  - 제안: `UsersService.update` 파라미터 타입이 nullable 필드를 올바르게 반영하도록 수정(`Partial<User>` 또는 별도 DTO 타입)하면 이 캐스팅을 제거할 수 있음. 현재는 동작하나 타입 안전성 개선 여지 있음.

### safe-html.test.ts

- **[INFO]** 새로 추가된 describe 블록 제목의 리뷰 ticket 참조
  - 위치: line 1562
  - 상세: `describe("빈/공백 입력 경계값 (ai-review m-4 W5)")` — describe 제목에 내부 리뷰 ticket 참조(`ai-review m-4 W5`)가 포함됨. 테스트 출력 시 이 문자열이 그대로 노출되어 외부 독자에게 맥락 없는 코드처럼 보일 수 있음.
  - 제안: `describe("빈/공백 입력 경계값")` 으로 ticket 참조 제거. 추적 정보는 commit 메시지/RESOLUTION에 충분히 기록됨.

- **[INFO]** 빈 html 입력 결과값 단언 방식
  - 위치: 새 테스트 케이스 (line 1563-1567)
  - 상세: `renderTemplateHtml("", "html")` 에 대해 `expect(result).toBe("")` 로 빈 문자열 반환을 단언. 구현이 변경되어 `null` 이나 `" "` 를 반환하면 즉시 탐지 가능해 회귀 방지 효과가 좋음. 명확한 단언.
  - 제안: 현행 유지.

### review/code RESOLUTION.md + SUMMARY.md (문서 파일)

- **[INFO]** SUMMARY.md 마지막 줄 개행 누락
  - 위치: SUMMARY.md diff `\ No newline at end of file`
  - 상세: 파일 끝 개행 누락. 일반적으로 Git 에서 경고가 발생하며 일부 편집기에서 diff noise 유발.
  - 제안: 파일 끝에 개행 1개 추가.

---

## 요약

이번 변경 세트는 직전 ai-review (LOW, Critical 0 / Warning 6) 에서 지적된 항목을 정확히 처분한 refactor 커밋이다. 유지보수성 관점에서 가장 주목할 개선은 `jwtService.sign.mock` 캐스팅 제거로 테스트 파일 내 mock 접근 패턴이 통일되었고, `verifyCode` 로그 메시지가 에러 타입명만 포함하도록 간결화된 것이다. 신규 추가된 테스트(`disable()`, `verifyAndEnable` user=null, safe-html 경계값)는 각각 대상 함수의 복잡도에 비례한 적절한 단언을 포함하고 있다. 잔존 이슈로는 `null as unknown as string` 이중 캐스팅(`totp.service.ts disable()`)이 타입 정의 부채를 나타내며, `bootstrapSecret` 헬퍼의 파일 끝 배치와 describe 제목의 ticket 참조가 가독성 개선 여지를 남긴다. 전반적으로 의도가 명확하고 패턴 일관성이 유지되며, 신규 코드의 중복 없음 — 전체 유지보수성 등급은 양호(LOW 위험).

## 위험도

LOW
