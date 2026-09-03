# 보안(Security) 리뷰

## 검토 범위 확인

이번 diff는 TypeORM 엔티티 9개 파일(`execution.entity.ts` · `knowledge-base.entity.ts` ·
`node-execution.entity.ts` · `node.entity.ts` · `notification.entity.ts` · `schedule.entity.ts` ·
`trigger.entity.ts` · `user.entity.ts` · `workflow.entity.ts`)의 TS 필드 타입을 실제 DB
`nullable: true` 컬럼에 맞춰 `T | null` 로 넓히고 일부 `@Column`에 `type:`(`'varchar'`/`'int'`)을
명시한 **타입 선언 정합화**, 그 여파로 시그니처를 넓힌 `shared/utils/redact-stored-error.ts`(+
`.spec.ts`), 그리고 이를 추적하는 plan 문서(`plan/in-progress/entity-nullable-column-type-mismatch.md`)로
구성된다. 나머지 파일 13~25(`review/code/2026/09/03/16_45_35/**`)는 직전 리뷰 라운드의 산출물(md/json)이
새 파일로 diff에 잡힌 것으로, 실행 코드가 아니라 보안 관점에서 별도 검토 대상이 아니다.

프롬프트가 크기 제한으로 잘랐던 `execution.entity.ts` · `trigger.entity.ts` · `user.entity.ts` ·
`redact-stored-error.ts`를 `Read`로 전문 직접 확인했다.

## 점검 관점별 확인

1. **인젝션** — 쿼리 문자열 조립, 커맨드 실행, 파일 경로 조합 등 신규/변경 로직 없음. 순수 타입
   선언 변경.
2. **하드코딩된 시크릿** — 없음. `trigger.entity.ts`의 `notificationSecretV2`/`chatChannelTokenV2`는
   원문 그대로(`type: 'text', nullable: true`)이며 시크릿 자체는 secret store ref만 보관하고
   plaintext가 아님을 주석이 명시. 이번 diff가 건드리지 않음.
3. **인증/인가** — `User.passwordHash`의 bcrypt-format 강제 로직(`@BeforeInsert`/`@BeforeUpdate`
   `validatePasswordHashFormat()`, `user.entity.ts:201-214`)은 이번 diff의 변경 대상이 아니고
   그대로 유지됨. 변경된 `oauthProvider`/`oauthProviderId`/`avatarUrl`은 이미 DB에서
   `nullable: true`였던 컬럼의 TS 타입만 뒤늦게 맞춘 것으로 인증 로직에 영향 없음.
4. **입력 검증** — 신규 사용자 입력 처리 경로 없음. 엔티티 레벨 타입 변경.
5. **OWASP Top 10** — 해당 없음(엔드포인트·컨트롤러·가드 변경 없음).
6. **암호화** — 해시/암호화 알고리즘·전송 방식 변경 없음.
7. **에러 처리 / 민감정보 노출** — `redact-stored-error.ts`가 `Execution`/`NodeExecution`의
   `error`/`inputData`/`outputData` 컬럼을 응답 직전에 자격증명 패턴 마스킹하는 핵심 보안 유틸인데,
   이번 diff는 `maskIfPresent`와 `redactNodeExecutionRowForResponse`의 제네릭 제약을 `| null`로
   넓혔을 뿐 마스킹 런타임 로직(`value == null ? value : (mask(value) ?? value)`)은 그대로다.
   `.spec.ts`(`redact-stored-error.spec.ts:270-320`)가 (a) `CRED` 값이 `'***'`로 마스킹됨,
   (b) `null`/`undefined` 두 부재 형태 모두 원본 참조 보존, 를 컬럼별로 각각 검증하고 있어
   회귀 없음을 테스트로 확인했다. 이중 캐스트 제거(`:305` 근방)도 `tsc --noEmit` 실측(오류 0)에
   근거한 정리이고 마스킹 대상 축소가 아니다.
8. **의존성 보안** — 신규/변경 의존성 없음.

## 추가로 직접 확인한 것 (INFO 후속 검증)

직전 리뷰 라운드(SUMMARY.md INFO#2)가 "nullable 확장이 하류 null-역참조를 넓힐 여지, 특히
`oauthProviderId`/`endpointPath` 등 인가·라우팅 관련 필드"를 범위 밖으로 남겨 뒀기에, 보안
관점에서 `endpointPath`(공개 webhook 라우팅 키) 소비처를 직접 추적했다:

- `triggers.service.ts:686`, `:1026` — `buildCallbackUrl` 호출 전 `if (!trigger.endpointPath) throw`
  로 이미 null 가드.
- `triggers.service.ts:1164` — `buildCallbackUrl(endpointPath: string)`는 non-null 파라미터를
  요구하며 호출부가 가드 이후에만 호출.
- `hooks.controller.ts` / `hooks.service.ts` / `embed-config.service.ts` /
  `public-webhook-throttle.guard.ts` — 전부 `@Param('endpointPath') endpointPath: string`(경로
  파라미터, 항상 string) 또는 `where: { endpointPath, ... }` 형태로 엔티티 필드 자체를
  역참조하지 않음.

즉 엔티티 타입이 `string | null`로 넓어졌어도 공개 webhook 라우팅 경로(인증 우회 표면과 가장
가까운 지점)의 실제 소비 코드는 이미 null을 방어적으로 처리하고 있어 신규 인가 우회·크래시
경로가 생기지 않는다. `strictNullChecks: true`(`tsconfig.json`) 하에서 `tsc` 신규 오류 0건이라는
선행 리뷰 실측과도 정합한다.

## 발견사항

없음.

## 요약

이번 변경은 9개 TypeORM 엔티티의 TS 타입을 이미 `nullable: true`로 선언돼 있던 DB 컬럼의
실제 nullability에 맞춰 `T | null`로 넓히는 컴파일 타임 정합화이며, 신규 쿼리·엔드포인트·인증
로직·시크릿 저장이 없다. 응답 egress 마스킹 유틸(`redact-stored-error.ts`)의 시그니처 확장도
런타임 마스킹 로직은 불변이고 자격증명 마스킹·null/undefined 부재 처리 모두 기존 테스트로
회귀 없음이 확인된다. 웹훅 라우팅의 핵심 필드(`endpointPath`) 소비처도 직접 추적해 이미
null-safe함을 확인했다. 보안 관점에서 지적할 사항이 없다.

## 위험도

NONE
