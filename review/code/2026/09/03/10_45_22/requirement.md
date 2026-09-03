# 요구사항(Requirement) 리뷰 — `change-password` 실패 코드 형제 정렬

## 검토 방법

핵심 코드 변경(`password.util.ts`·`auth.service.ts`·`sessions.service.ts`·`users.service.ts`와
동반 테스트/e2e/문서/spec) 을 diff 와 저장소 원본 양쪽으로 대조했다. 관련 spec 본문
(`spec/5-system/1-auth.md` §1.1.A·§2.3 note·§5 note, `spec/5-system/3-error-handling.md`
§1.2.1, `spec/conventions/error-codes.md` §5, `spec/2-navigation/9-user-profile.md` §2.1/§2.2)을
Grep/Read 로 직접 열어 line-level 로 대조했다. `codebase/backend` 에서 대상 unit 테스트
(`users.service.spec.ts`·`sessions.service.spec.ts`·`auth.service.spec.ts`·
`users.controller.spec.ts`, 총 117 테스트)를 직접 실행해 GREEN 을 확인했고, scratch 사본으로
뮤테이션(OAuth-only 분기 코드를 `.REQUIRED`→`.INVALID` 로 되돌림)을 적용해 **RED 2**(전용
테스트 + 대조군)를 재현한 뒤 `cp` 로 원복해 GREEN 재확인했다(`git status --short` 로 잔여
변경 없음 확인). 저장소 트리에 남은 뮤테이션은 없다.

## 발견사항

- **[WARNING]** plan 체크리스트가 이미 완료된 developer 턴을 미체크 상태로 남겨 둠
  - 위치: `plan/in-progress/auth-change-password-oauth-only-code-split.md:147`
    (`- [ ] developer 턴 — backend 두 분기 + 공용 상수화(...) + 단위/e2e + 유저 가이드
    password-and-sessions.mdx ko/en :80 사실 오류 정정 ...`)
  - 상세: 이 changeset(커밋 `1950e5773`+`139115d34`)이 이 항목이 열거하는 하위 작업을
    **전부** 완료했다 — (1) backend 두 분기(`UsersService.changePassword` 의
    `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 분리, 실측 확인), (2) 공용 상수화
    (`PASSWORD_VERIFY_CODES`, `password.util.ts`), (3) 단위 테스트(`users.service.spec.ts`
    +6, `sessions.service.spec.ts` +1 리터럴 단언, `users.controller.spec.ts` 리터럴 갱신)
    /e2e(`users-change-password.e2e-spec.ts` 신규 OAuth-only 케이스, 실행 확인),
    (4) 유저 가이드 `password-and-sessions.mdx`/`.en.mdx` ko/en 양쪽 사실 오류 정정(확인).
    같은 파일의 바로 위 5개 항목(§L132~139)은 이번 라운드에서 정확히 `- [x]` 로 갱신됐는데
    이 마지막 항목만 남겨졌다 — 사용자 메모리 규약("plan 체크박스 = 실제 상태", 수행 후에만
    체크)과 어긋난다. 바로 위 줄(§L142, "후속(별개 PR) — `User.passwordHash` 타입" 항목)은
    이 PR 범위 밖 별도 작업이라 미체크가 정당하지만, §L147 은 이 PR 자체가 완료한 작업이라
    구분이 필요하다. 다음 사람이 이 plan 을 훑을 때 "developer 턴이 아직 안 끝났다" 고
    오판할 위험이 있다(같은 파일 안에 완료/미완료 두 종류의 미체크 항목이 섞여 있다).
  - 제안: `- [x]` 로 갱신. `plan/complete/` 로의 이동 여부는 §L142(후속 별개 PR, 의도적으로
    남겨둔 항목)의 존재 때문에 별개로 판단할 사안이나, 완료된 항목의 체크 표시는 이번
    changeset 에 포함시켜야 한다.

## 점검 관점별 확인 내역

1. **기능 완전성** — 의도(OAuth-only ↔ 불일치 두 조건을 형제 흐름과 같은 코드로 분리)를
   발행 지점 3곳(`auth.service.ts`·`sessions.service.ts`·`users.service.ts`) 모두에서
   `PASSWORD_VERIFY_CODES` 단일 SoT 로 정확히 구현. `sessions.service.ts`/`auth.service.ts`
   는 이미 두 코드를 쓰고 있었으므로 리터럴→상수 치환만(런타임 값 불변, 실측), 실제 응답 값이
   바뀌는 곳은 `users.service.ts` 뿐 — 커밋 메시지·CHANGELOG 진술과 정확히 일치.
2. **엣지 케이스** — `!user.passwordHash`(null/빈 문자열 모두 OAuth-only 취급) → `bcrypt`
   호출 전 조기 반환. 사용자 미존재는 `USER_NOT_FOUND`(404) 로 분기 변경 없음(진술대로 확인).
   OAuth-only 상태를 실제 HTTP 레벨로 만드는 e2e(`password_hash` 를 NULL 로 직접 UPDATE)까지
   갖춰 라우팅/직렬화 계층 엣지케이스도 커버.
3. **TODO/FIXME** — 이 diff 범위(`codebase/**`) 전수 grep 결과 TODO/FIXME/HACK/XXX 0건.
4. **의도와 구현 간 괴리** — 함수명·JSDoc(`@throws`)·인라인 주석이 실제 분기 순서·코드값과
   1:1 대응. `PASSWORD_VERIFY_CODES` JSDoc 이 소비처 3곳(`AuthService`·`UsersService`·
   `SessionsService`, 후자는 `.INVALID` only)을 정확히 열거 — 1라운드 리뷰가 지적한 "2곳만
   열거" 결함이 이미 정정됨.
5. **에러 시나리오** — `PASSWORD_REQUIRED`(401, 미설정/미입력) / `PASSWORD_INVALID`(401,
   불일치) / `REAUTH_REQUIRED`(400, `verifyReauth` 미입력) / `REAUTH_NOT_AVAILABLE`(403,
   재인증 수단 전무) / `USER_NOT_FOUND`(404) — 상태별 HTTP status·코드가 모두 정의돼 있고
   spec 표(§1.2.1)와 정확히 일치.
6. **데이터 유효성** — `changePassword` 는 현재 비밀번호 검증 → 새 비밀번호
   `validatePasswordStrength` → 해시 → 저장 순서를 그대로 유지(diff 로 순서 변경 없음).
7. **비즈니스 로직** — "형제 흐름과 완전 정렬, 신규 코드 0" 이라는 plan 의 결정(D안)이 코드에
   정확히 반영. `login_history.failure_reason` 의 동명 감사값(`INVALID_PASSWORD`)은 레이어가
   달라 존속한다는 설계도 `auth.service.ts:348` 실측으로 확인(변경 없음, 의도대로).
8. **반환값** — 성공 경로(`{ data: { accessToken } }`)·세 실패 경로 모두 예외 객체
   (`{ code, message }`)를 명시적으로 던짐. 누락 경로 없음.
9. **spec fidelity** — `spec/5-system/1-auth.md:339`(변경 실패 코드 서술)·`:521`(민감 동작
   재확인 코드 공유)·`:750`(OAuth-only 차단 서술), `spec/5-system/3-error-handling.md:53,65,66,69`
   (§1.2.1 카탈로그 행), `spec/conventions/error-codes.md`(§5 등급 B 행, "현재 B 등급 행은
   2건" 진술을 실제로 `grep -c` 대조해 2건 일치 확인), `spec/2-navigation/9-user-profile.md:94,141,147`
   (OAuth-only 안내 SoT 지정)을 모두 코드와 line-level 대조 — 함수 시그니처·필드명·에러
   코드·기본값·상태 전이 전부 spec 과 일치. spec 문서 자체의 결함은 발견되지 않았고
   SPEC-DRIFT 사례도 없음(코드가 spec 을 정확히 따라감).

## 요약

`INVALID_PASSWORD` 단일 코드가 "비밀번호 미설정(OAuth-only)"과 "현재 비밀번호 불일치"라는
서로 다른 실패를 뭉뚱그려 OAuth-only 사용자에게 "비밀번호가 틀렸다"고 잘못 안내하던 실제
결함을, 형제 흐름이 이미 쓰던 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 로 완전히 정렬한
변경이다. 신규 코드 0(근접 명명·wire/audit 동명 충돌 재생산을 피함), 발행 지점 3곳을
`PASSWORD_VERIFY_CODES` 단일 상수로 통합해 drift 원인을 구조적으로 제거했으며, 이전 리뷰
라운드(WARNING 4건)의 지적사항 — 세션 재인증 흐름의 코드값 미검증, breaking 분기의 e2e 부재,
CHANGELOG 누락, 무관 커밋 편입 — 이 후속 커밋(`139115d34`)에서 전부 실측 검증(뮤테이션 RED/GREEN
포함)과 함께 조치되어 있음을 직접 재확인했다. 코드·테스트·spec(§1.1.A/§2.3/§5, §1.2.1,
§5 등급 B, §2.2)·유저 가이드(ko/en) 사이의 대응 관계가 line-level 로 정확히 일치하고, unit
117건 GREEN·자체 뮤테이션 재현(RED→원복 GREEN)도 확인했다. 유일한 흠은 이번 changeset 이
완료한 developer 작업을 열거하는 plan 체크리스트 마지막 항목이 미체크 상태로 남은 문서
위생 이슈(WARNING 1건)로, 기능적 결함이 아니라 다음 사람의 plan 상태 판단을 흐릴 수 있는
잔여 정리 항목이다.

## 위험도

LOW
