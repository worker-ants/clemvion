# 보안(Security) 코드 리뷰

## 검토 범위 확인

이번 diff 는 크게 두 축이다.

1. **실질 코드 변경(1~14)**: TypeORM 엔티티 9개 파일(`execution` · `knowledge-base` ·
   `node-execution` · `node` · `notification` · `schedule` · `trigger` · `user` · `workflow`)의
   `nullable: true` DB 컬럼/relation 30건을 TS 타입에서 `T` → `T | null` 로 넓히고, 일부 `@Column`
   에 누락돼 있던 `type:`(`'varchar'`/`'int'`)을 DB 실측 기반으로 명시했다. 그 여파로
   `shared/utils/redact-stored-error.ts`(+`.spec.ts`) 의 `maskIfPresent`/
   `redactNodeExecutionRowForResponse` 시그니처가 `| null` 을 받도록 넓어졌고, docstring 의 반증된
   전제("두 컬럼은 정적으로 non-null")를 취소선 보존 + 정정문으로 갱신했다. `hooks.service.spec.ts`·
   `schedule-runner.service.spec.ts` 는 이제 불필요해진 `as unknown as Date` 캐스트 3건을 제거했다.
   `plan/in-progress/entity-nullable-column-type-mismatch.md` 는 이 배치의 진행 기록이다.
2. **리뷰/일관성 산출물(15~46)**: 직전 두 리뷰 라운드(`16_45_35`, `17_09_06`)와 consistency
   check(`17_09_09`)의 산출 마크다운/json 파일이 신규 파일로 diff 에 잡힌 것이다. 실행 코드가
   아니며 보안 관점에서 별도 검토 대상이 아니다 — 다만 두 라운드 모두 이 diff 를 이미 보안
   관점에서 상세히 검토했고 (특히 `17_09_06/security.md` 가 `endpointPath` 소비처를 직접
   추적) 위험도 NONE 으로 결론 냈으므로, 이번 라운드에서는 그 결론을 재현·독립 검증하는 데
   집중했다.

## 독립 검증 (직접 `Read`/`grep` 재실행, 저장소 무변경)

- `redact-stored-error.ts` 전문을 직접 읽어 마스킹 런타임 로직을 확인 — `maskIfPresent` 의
  `value == null ? value : (mask(value) ?? value)` (파일 내 160행)는 변경되지 않았고, `null`/
  `undefined` 두 부재 형태 모두 여전히 마스킹을 우회하지 않고 `null` 로 정규화되거나(3-컬럼
  일괄 헬퍼) 원본을 그대로 보존한다(`nodeExecutions[]` 행 헬퍼). 시그니처 확장은 이미 항상
  참이던 런타임 계약을 타입에 뒤늦게 반영한 것뿐이며, 마스킹 대상 축소·우회 경로는 생기지
  않았다.
- `node-execution.entity.ts` 현재 상태를 직접 읽어 `inputData` 가 여전히 non-null
  (`default: {}`, `nullable: true` 없음)이고 `outputData`/`error` 만 `| null` 로 넓어졌음을
  확인 — plan 문서 W1 정정 내용과 일치.
- `oauthProvider`/`oauthProviderId` 를 실제로 인가 판단에 쓰는지 `auth`/`users` 모듈 전수 grep 로
  확인 — 두 필드는 OAuth 프로필 upsert 시 **쓰기**(`auth-oauth.service.ts:395,415`)와 조회
  `where` 절(`users.service.ts:219`)에만 쓰이고, "OAuth-only 계정" 판정은 별도 필드
  `passwordHash` 의 truthy 체크(`auth.service.ts:73,324`, `sessions.service.ts:255`)로 이루어진다
  — 이번 diff 가 건드리지 않은 필드다. `oauthProvider` nullable 확장이 인증 우회 분기에
  개입하지 않음을 직접 확인했다.
- `endpointPath`(공개 webhook 라우팅 키) 소비처를 재추적 — `triggers.service.ts:686,1026` 는
  `buildCallbackUrl` 호출 전에 `if (!trigger.endpointPath) throw` 로 이미 null 가드하고,
  `hooks.controller.ts`/`embed-config.service.ts` 는 전부 `@Param('endpointPath') endpointPath:
  string`(경로 파라미터, 항상 string) 을 받아 `where` 절에 그대로 쓸 뿐 엔티티 필드를
  역참조하지 않는다. `string | null` 로 넓어진 엔티티 타입이 공개 라우팅 경로에 새 null-역참조나
  인가 우회를 만들지 않음을 직접 재확인했다(직전 라운드 `17_09_06/security.md` 의 동일 결론을
  독립 재현).
- `git diff origin/main --unified=0 -- codebase/backend/src plan/in-progress/entity-nullable-column-type-mismatch.md`
  결과를 `api[_-]?key|secret|password|token|bearer|-----BEGIN` 로 grep — 추가된 줄(`+`) 중
  매치 0건. 하드코딩된 시크릿 없음.

## 점검 관점별 결과

1. **인젝션** — 쿼리 문자열 조립·커맨드 실행·경로 조합 등 신규/변경 로직 없음. 순수 타입 선언
   변경.
2. **하드코딩된 시크릿** — 없음(위 grep 확인).
3. **인증/인가** — `oauthProvider`/`oauthProviderId`/`endpointPath` 등 인가·라우팅에 인접한
   필드의 nullable 확장이 실제 판단 분기(패스워드 유무 체크, null 가드 후 콜백 URL 생성)에
   영향을 주지 않음을 직접 추적 확인. `User.validatePasswordHashFormat()` 등 기존 인증 로직은
   변경 대상이 아니다.
4. **입력 검증** — 신규 사용자 입력 처리 경로 없음.
5. **OWASP Top 10** — 해당 없음(엔드포인트·컨트롤러·가드 변경 없음).
6. **암호화** — 해시/암호화 알고리즘·전송 방식 변경 없음.
7. **에러 처리 / 민감정보 노출** — `redact-stored-error.ts` 의 egress 마스킹 로직은 불변이며,
   `.spec.ts` 가 `null`/`undefined` 두 부재 형태·마스킹 대상 컬럼별로 회귀를 커버한다. 캐스트
   제거는 `tsc --noEmit` 실측(오류 0)에 근거한 것으로 마스킹 대상 축소가 아니다.
8. **의존성 보안** — 신규/변경 의존성 없음.

DB 관점 보강: 모든 대상 컬럼은 이미 `nullable: true` 였고(마이그레이션 변경 없음, `.sql` 파일이
diff 에 없음), `synchronize: false` 이므로 `@Column type:` 보강이 운영 DDL 을 트리거하지 않는다
— 스키마·인가 경계에 영향 없음.

## 발견사항

없음.

## 요약

이번 diff 는 9개 TypeORM 엔티티의 TS 타입을 이미 `nullable: true` 로 선언돼 있던 DB 컬럼의 실제
nullability 에 맞춰 `T | null` 로 넓히는 컴파일 타임 정합화이며, 신규 쿼리·엔드포인트·인증
로직·시크릿 저장이 없다. 응답 egress 마스킹 유틸(`redact-stored-error.ts`)의 시그니처 확장도
런타임 마스킹 로직은 불변이고, 인가·라우팅에 인접한 필드(`oauthProvider`/`oauthProviderId`/
`endpointPath`)의 실제 소비처를 직접 추적해 null 확장이 인증 우회나 새 null-역참조를 만들지
않음을 독립 재확인했다. 하드코딩된 시크릿도 발견되지 않았다. diff 에 함께 포함된 이전 두 리뷰
라운드·consistency check 산출물(리뷰 15~46)은 실행 코드가 아니며, 그 내용 자체도(직접 확인한
`redact-stored-error.ts`·`endpointPath` 재추적과 일치하게) 보안 관점 위험도를 NONE 으로 결론 낸
것과 부합한다. 보안 관점에서 지적할 사항이 없다.

## 위험도

NONE
