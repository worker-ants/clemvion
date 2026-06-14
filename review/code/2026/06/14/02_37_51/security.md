# 보안(Security) 리뷰 결과

## 발견사항

- **[INFO]** `avatarUrl` 필드의 `IsUrl({ require_tld: false })` 설정이 광범위한 URL 형식을 허용
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-user-profile-gaps-f00493/codebase/backend/src/modules/users/dto/update-me.dto.ts` 55-58행
  - 상세: `require_tld: false` 옵션은 `http://localhost/...` 또는 `http://internal-service/...` 같은 내부 주소를 허용한다. 이는 SSRF(Server-Side Request Forgery) 벡터가 될 수 있다 — 서버가 해당 URL로 HTTP 요청을 실행하는 로직(아바타 다운로드·프록시·OG fetch 등)이 추가되는 경우. 현재 코드에서 backend가 avatarUrl을 능동적으로 fetch하지 않고 저장만 한다면 즉각적 위험은 낮다. 그러나 `require_tld: false` 가 의도적 선택인지 기본 동작 수용인지 문서화되지 않았다.
  - 제안: 현재 동작(URL 저장·반환만)이 맞다면 이 수준은 허용 가능하나, 향후 서버 측 fetch 로직 추가 시 `require_tld: true` + 허용 프로토콜 제한(`http`, `https`) + 내부 IP 대역 차단(SSRF 방어) 가드를 함께 추가할 것. 주석으로 "서버는 이 URL을 fetch하지 않음" 을 명시해두면 후속 기여자의 실수를 예방할 수 있다.

- **[INFO]** 이번 변경의 핵심인 `USER_THEMES` 허용 값 확장은 열거형 화이트리스트(`@IsIn`) 방식으로 적절히 제한됨
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-user-profile-gaps-f00493/codebase/backend/src/modules/users/dto/update-me.dto.ts` 16행, 47-48행
  - 상세: `'system'` 값 추가가 `as const` 배열 + `@IsIn` 데코레이터 체인 내에서 이루어져, 임의 문자열 주입 경로가 없다. DB 컬럼이 `varchar(10)` 으로 선언되어 있고 `'system'` 은 6자이므로 길이 초과 위험도 없다.
  - 제안: 문제 없음.

- **[INFO]** 테스트 파일(`update-me.dto.spec.ts`)에 하드코딩된 시크릿, 실제 자격증명, 민감 데이터 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-user-profile-gaps-f00493/codebase/backend/src/modules/users/dto/update-me.dto.spec.ts` 전체
  - 상세: 테스트 픽스처가 `'light'`, `'dark'`, `'system'`, `'solarized'` 같은 무해한 문자열만 사용한다.
  - 제안: 문제 없음.

- **[INFO]** plan 문서 및 spec 문서 변경은 코드 실행 경로에 영향을 주지 않음
  - 위치: `plan/in-progress/spec-sync-user-profile-gaps.md`, `spec/2-navigation/9-user-profile.md`
  - 상세: 순수 문서 변경이므로 인젝션, 인증, 암호화 등의 보안 취약점 벡터가 없다.
  - 제안: 해당 없음.

## 요약

이번 변경은 `UpdateMeDto.USER_THEMES` 허용 열거 값에 `'system'` 을 추가하는 매우 좁은 범위의 백엔드 DTO 변경이다. 열거형 화이트리스트 검증(`@IsIn`) 이 유지되어 임의 값 주입 경로가 없고, 하드코딩된 시크릿·인증 우회·SQL 인젝션·XSS·커맨드 인젝션 등 OWASP Top 10 관련 취약점은 이번 diff에서 발견되지 않는다. 기존부터 존재하던 `avatarUrl` 의 `IsUrl({ require_tld: false })` 설정이 향후 서버 측 URL fetch 로직 도입 시 SSRF 위험 진입점이 될 수 있으나, 현재 구현 범위(저장·반환 전용)에서는 즉각적 위협이 아니다. 전체적으로 보안 위험도는 낮다.

## 위험도

LOW
