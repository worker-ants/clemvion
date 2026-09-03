### 발견사항

- **[INFO]** `error-codes.md` §5 표의 `PR` 컬럼 표기 불일치
  - target 위치: `spec/conventions/error-codes.md` §5 "Rename 이력" 표, `INVALID_PASSWORD` 행 (L175)
  - 위반 규약: 명시적 규약 위반은 아님 — `spec/conventions/error-codes.md` §5 표 자체의 열 형식 관례
  - 상세: 같은 표의 다른 행들은 `PR` 열에 `PR4b`·`#1193`·`#566`처럼 **plain 식별자**를 쓰는데, 신규 `INVALID_PASSWORD` 행만 `[`auth-change-password-oauth-only-code-split.md`](../../plan/complete/...)` 형태의 **마크다운 링크**를 쓴다. 표 안에서 같은 열의 표현 방식이 갈린다.
  - 제안: 열 관례를 유지하려면 PR 번호(있다면)로 통일하거나, 이 열을 "PR/근거" 성격으로 명시적으로 재정의하는 한 줄을 §5 서두에 추가. 다만 이 행은 PR 번호가 없는 plan-driven 결정이라 링크가 정보량은 더 크므로, **규약 갱신(열 의미를 "PR 또는 근거 문서"로 명문화)** 쪽이 더 적절해 보임.

이 외에는 CRITICAL/WARNING 발견 없음. 상세 검증 내역:

1. **명명 규약** — `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 는 `UPPER_SNAKE_CASE`, 의미 기반 명명(§1)을 따른다. 신규 코드를 만들지 않고 형제 흐름(`AuthService.verifyPasswordForUser`, `SessionsService.verifyReauth`)이 이미 쓰던 코드를 재사용한 것은 §2(rename 대신 신설/재사용 원칙)와 부합. `codebase/backend/src/common/utils/password.util.ts` 의 `PASSWORD_VERIFY_CODES` 상수가 3개 발행처(`auth.service.ts`·`sessions.service.ts`·`users.service.ts`) 전부에서 실제로 import 되는 것을 `git -C <worktree> grep`으로 확인 — 문서(`3-error-handling.md` §1.2.1 "형제 흐름이 공유")와 코드가 일치한다.

2. **출력 포맷 규약** — `INVALID_PASSWORD` wire 은퇴는 `spec/conventions/error-codes.md` §5 "등급 B(잔여 위험 인수)" 요건(사용자 결정 명시, grep 미발견 근거, 감사값 잔존 caveat)을 모두 충족해 등재됨. 엔티티 nullable 타이핑 정정(`execution.entity.ts` 등 8개 파일, `triggerId`/`finishedAt`/`durationMs` 등에 `| null` 추가)은 이미 `execution-response.dto.ts` 등 응답 DTO가 `@ApiPropertyOptional({ nullable: true })` + `field?: T | null` 로 정확히 선언돼 있어(직접 확인) `2-api-convention.md §5.4`("null 쓰는 필드는 `nullable: true` + `T | null`")를 이미 만족하던 wire 형태에 **타입만 뒤늦게 맞춘 것** — 응답 계약 변경 없음, 위반 아님.

3. **문서 구조 규약** — 이번 검토 scope(`spec/5-system/`) 델타는 0(정상, 코드 전용 PR). `1-auth.md`/`3-error-handling.md`/`2-api-convention.md`는 Overview/본문/Rationale 3섹션 구조를 유지하고 있고, `error-codes.md` §5 신규 행도 기존 표 스키마(구코드/대체코드/HTTP/PR/비고)를 그대로 따른다(위 INFO 제외).

4. **API 문서 규약(Swagger)** — `swagger.md` §5-1("엔티티를 그대로 노출하지 않고 별도 DTO 사용")이 지켜지고 있어 엔티티 타입 정정이 wire 스키마에 영향을 주지 않는다. 이번 diff는 컨트롤러·DTO·`@Api*` 데코레이터를 건드리지 않았다.

5. **금지 항목** — 신규 에러 코드 신설(§2 금지 관행) 없음, `PASSWORD_NOT_SET` 재사용 시도했다면 재발했을 wire/audit 동명 충돌을 오히려 회피(§5 §근거에 명시). 확인된 금지 패턴 답습 없음.

### 요약
이번 검토 대상(spec/5-system 문서 자체는 델타 0, 실질 diff는 TypeORM 엔티티 nullable 타입 정정 배치 2 + 앞선 커밋에서 완결된 `change-password` 에러 코드 정렬)은 `spec/conventions/error-codes.md`·`swagger.md`·`2-api-convention.md §5.4` 세 규약 모두에 대해 명명·안정성·DTO 표현 규칙을 정확히 따르고 있다. `INVALID_PASSWORD` 은퇴는 등급 B 요건(사용자 결정, 위험 인수 명시, 감사값 잔존 caveat)을 온전히 충족해 §5에 등재됐고, 코드 재사용(신규 코드 미신설)은 §1·§2 원칙에 부합한다. 엔티티 nullable 타이핑 정정은 이미 올바르게 선언돼 있던 응답 DTO의 wire 계약과 늦게 정렬한 순수 내부 정확성 수정이라 출력 포맷 규약에 영향이 없다. 유일한 지적은 `error-codes.md` §5 표의 `PR` 열 표기 방식이 신규 행에서만 링크 형태로 갈린다는 사소한 형식 비일관성(INFO)이며, 이는 규약 위반이라기보다 규약(열 의미)을 명문화하면 해소되는 수준이다.

### 위험도
NONE
