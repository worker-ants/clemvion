파일 쓰기 권한이 필요합니다. 권한을 허용해 주시면 `review/2026-04-18_11-25-26/SUMMARY.md`에 저장하겠습니다. 아래는 통합 보고서 내용입니다:

---

# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** - 비밀번호 재설정 토큰 평문 저장 및 안티-열거 보호 불완전으로 보안 아키텍처 개선 필요

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/아키텍처 | **`passwordResetToken` 평문 DB 저장** — RefreshToken은 SHA-256 해시 후 저장하는 반면 리셋 토큰은 raw UUID 그대로 저장. DB 유출 시 즉시 계정 탈취 가능 | `auth.service.ts` — `forgotPassword()` | `hashToken(resetToken)` 해시값 저장, `findUserByResetToken`도 해시값으로 조회 |
| 2 | 보안 | **DEBUG 로그에 리셋 토큰 포함 URL 노출** — `[DEV]` 레이블에도 불구하고 프로덕션에서 실행됨 | `mail.service.ts` — `sendPasswordResetEmail()` | `MAIL_TRANSPORT_CONSOLE` 조건 분기, 비-콘솔 환경은 이메일 주소만 로깅 |
| 3 | 보안/요구사항 | **DB 업데이트 실패 시 안티-열거 보호 미적용** — `usersService.update` 예외 전파로 500 반환. 메일 실패는 삼키면서 DB 오류는 노출하는 구조적 불일치 | `auth.service.ts` — `forgotPassword()` | `usersService.update` 호출을 try-catch로 감싸 모든 오류에 동일 응답 반환 |
| 4 | 동시성 | **TOCTOU 경쟁 조건** — 동시 요청 시 findByEmail→token 생성→update 시퀀스가 비원자적. 이전 토큰 링크 무효화 가능 | `auth.service.ts` — `forgotPassword()` | DB 레벨 원자적 UPDATE 또는 유효 토큰 재사용 전략 |
| 5 | 데이터베이스 | **`passwordResetToken` 컬럼 인덱스 부재 가능성** — 메일 발송 활성화로 전체 테이블 스캔 경로가 처음으로 프로덕션 실행됨 | `auth.service.ts` — `findUserByResetToken()` | UNIQUE INDEX 추가 (`emailVerifyToken`도 동일 점검) |
| 6 | 아키텍처 | **`AuthService`가 `UsersService` 우회하여 Repository 직접 접근** — 서비스 캡슐화 위반 | `auth.service.ts` — `findUserByResetToken()`, `findUserByVerifyToken()` | `UsersService`에 메서드 추가 후 위임 |
| 7 | 보안/API | **Rate Limiting 부재** — 반복 요청으로 대량 이메일 발송 가능 | `auth.service.ts` — `forgotPassword()` | `@Throttle` 데코레이터 또는 IP/이메일 기반 요청 제한 확인 |
| 8 | 테스트 | **DB 업데이트 실패 경로 테스트 누락** | `auth.service.spec.ts` — `forgotPassword` describe | `usersService.update.mockRejectedValueOnce` 케이스 추가 |
| 9 | 테스트 | **만료 시간 정밀 검증 부재** — `expect.any(Date)`로만 검증, 30분 요구사항 미확인 | `auth.service.spec.ts:336` | 현재 시각 + 29~31분 범위 검증 |
| 10 | 유지보수성 | **`mail.service.ts` 코드 중복** — 세 `send*Email` 메서드 동일 구조 반복 | `mail.service.ts` | 공통 `dispatch(to, options)` 헬퍼 추출 |
| 11 | 유지보수성 | **HTML 템플릿 구조 중복** — 외곽 테이블/헤더가 세 빌더 함수에서 반복 | `mail.service.ts` — `build*Html()` | `buildEmailWrapper(content)` 공통 래퍼 추출 |
| 12 | 유지보수성 | **`sendVerificationEmail` 내 주석 코드 잔존** — `sendPasswordResetEmail`과 일관성 불일치 | `mail.service.ts` | 주석 처리된 코드 제거 |
| 13 | 문서화 | **`sendPasswordResetEmail` JSDoc 누락** — 형제 메서드와 불일치 | `mail.service.ts` | JSDoc 추가 (30분 만료 명시) |
| 14 | 테스트 | **메일 실패 테스트에서 `usersService.update` 호출 미검증** | `auth.service.spec.ts` | `expect(usersService.update).toHaveBeenCalled()` 단언 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | **`resetUrl` href에 HTML 이스케이프 미적용** — `frontendUrl`에 `"` 포함 시 속성 깨짐 가능 | `mail.service.ts` — `buildPasswordResetHtml()` | `escapeHtml(resetUrl)` 적용 |
| 2 | 보안 | **타이밍 차이로 이메일 열거 가능** — 사용자 존재/미존재 경로의 응답 시간 차이 | `auth.service.ts` — `forgotPassword()` | 큐 기반 비동기 메일 또는 동일 지연 추가 |
| 3 | 일관성 | **`buildPasswordResetText`에서 `name` 이스케이프 누락** — `\n` 포함 시 newline injection 가능성 | `mail.service.ts` | `name.replace(/[\r\n]/g, '')` 적용 고려 |
| 4 | 일관성 | **`AuthService`↔`MailService` 에러 전파 계약 비대칭** — 의도적이나 주석 보강 필요 | `auth.service.ts` — catch 블록 | 비대칭이 의도적임을 주석으로 명시 |
| 5 | API | **메일 발송 실패 시 DB에 유효 토큰 잔류** — 보안 문제 없으나 운영 추적 어려움 | `auth.service.ts` | 메일 발송 실패 메트릭 수집 고려 |
| 6 | 아키텍처 | **`MailService` 인터페이스 추상화 부재** — DIP 원칙 위반 | `auth.service.ts` 생성자 | `IMailService` 인터페이스 및 커스텀 토큰 주입 고려 |
| 7 | 아키텍처 | **HTML 템플릿 인라인 하드코딩** — OCP 위반 | `mail.service.ts` | `.hbs` Handlebars 템플릿 파일 분리 고려 |
| 8 | 테스트 | **`??[]` 폴백으로 타입 안전성 약화** | `auth.service.spec.ts:343-346` | `?? []` 제거 후 non-null assertion 사용 |
| 9 | 테스트 | **`frontendUrl` 미설정 케이스 미테스트** | `mail.service.spec.ts` | `createService({ 'app.frontendUrl': '' })` 추가 |
| 10 | 테스트 | **XSS 테스트가 text body 미검증** | `mail.service.spec.ts` | text body에 raw `<script>` 포함 의도 명시 |
| 11 | 테스트 | **연속 `forgotPassword` 호출 시 토큰 무효화 동작 미명시** | `auth.service.spec.ts` | 테스트 또는 주석 추가 |
| 12 | 문서화 | **Swagger 데코레이터 갱신 필요 가능성** | `auth.controller.ts` | 엔드포인트 데코레이터 확인 후 수정 |
| 13 | 유지보수성 | **`[DEV]` 접두사 중복** — `logger.debug`는 이미 개발 환경에서만 출력 | `mail.service.ts` | `[DEV]` 접두사 제거 |
| 14 | 유지보수성 | **테스트 구조 중복** — 두 describe 블록이 거의 동일한 케이스 반복 | `mail.service.spec.ts` | shared behavior 헬퍼 추출 고려 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | 리셋 토큰 평문 저장, DEBUG 로그 토큰 노출 |
| database | MEDIUM | 리셋 토큰 평문 저장, 인덱스 부재 가능성 |
| architecture | MEDIUM | 리셋 토큰 평문 저장, Repository 직접 접근 |
| requirement | MEDIUM | DB 업데이트 실패 시 안티-열거 보호 미적용 |
| testing | MEDIUM | 평문 저장 동작 고정하는 테스트 구조, 만료 시간 미검증 |
| concurrency | LOW | TOCTOU 경쟁 조건 |
| documentation | LOW | JSDoc 누락, 주석 코드 잔존 |
| dependency | LOW | 에러 전파 계약 비대칭 |
| maintainability | LOW | 코드 중복, 주석 코드 잔존 |
| side_effect | LOW | `resetUrl` HTML 미이스케이프, 토큰 로그 노출 |
| api_contract | LOW | Rate Limiting 부재 |
| scope | NONE | 불필요한 변경 없음 |
| performance | NONE | 실질적 성능 이슈 없음 |

---

## 발견 없는 에이전트
| 에이전트 | 비고 |
|----------|------|
| scope | 변경 범위가 기능 목적에 집중, 불필요한 변경 없음 |
| performance | 이메일 서비스 특성상 호출 빈도 낮아 실질적 성능 이슈 없음 |

---

## 권장 조치사항
1. **[보안 - 즉시]** `passwordResetToken` 해시 저장 — `hashToken(resetToken)` 값을 DB에 저장하고 `findUserByResetToken`도 해시값으로 조회
2. **[보안 - 즉시]** `forgotPassword` DB 업데이트 실패를 try-catch로 감싸 안티-열거 보호를 모든 오류 경로에 적용
3. **[보안]** DEBUG 로그에서 토큰 포함 URL 제거 (`MAIL_TRANSPORT_CONSOLE` 환경에서만 전체 URL 출력)
4. **[테스트]** DB 업데이트 실패 경로 및 만료 시간 정밀 검증 테스트 추가
5. **[테스트]** 메일 실패 테스트에 `usersService.update` 호출 검증 단언 추가
6. **[데이터베이스]** `passwordResetToken` 컬럼 인덱스 확인 및 추가
7. **[아키텍처]** `UsersService`에 `findByResetToken`/`findByVerifyToken` 메서드 추가하여 Repository 직접 접근 제거
8. **[유지보수]** `mail.service.ts` 공통 `dispatch` 헬퍼 및 `buildEmailWrapper` 추출로 중복 제거
9. **[유지보수]** `sendVerificationEmail` 내 주석 처리된 코드 블록 제거
10. **[문서화]** `sendPasswordResetEmail` JSDoc 추가, Swagger 데코레이터 확인