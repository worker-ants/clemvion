# 보안(Security) 코드 리뷰

## 범위

이번 changeset 은 22개 파일(`CHANGELOG.md` 1 + 백엔드 응답 DTO 19 + plan 트래커 md 2)로, 실체는
**응답 DTO 83개 필드**에 대해 `@ApiPropertyOptional({ nullable: true }) field?: T | null` →
`@ApiProperty({ nullable: true }) field: T | null` 로 바꾸는 **OpenAPI 데코레이터·TS 옵셔널
마커 정정**이다. 전체 diff 를 훑어(`grep` 로 모든 unified diff 추가/삭제 라인을 대조) 이 패턴
밖의 로직 변경이 있는지 확인했으며, `import` 정리(미사용 `ApiPropertyOptional` 제거) 외에는
**예외 없이 전부 이 형태**였다. CHANGELOG 항목 자체도 "동작 변경은 없다. 서버가 내보내는 값은
그대로이고, OpenAPI 가 그 사실을 뒤늦게 따라간다" 고 명시하고, 타입체크(`tsc`) 비-spec 오류 0건을
판정 근거로 든다.

리포지토리 파일은 뮤테이션하지 않았다(읽기 전용 검토로 충분히 판정 가능했음). `git status --short`
확인 불필요 — 아무것도 쓰지 않았다.

## 발견사항

- **[INFO]** 응답 바디에 노출되는 필드 자체는 이 변경으로 늘거나 줄지 않는다 — wire 레벨 payload
  는 changeset 이전과 동일
  - 위치: `codebase/backend/src/modules/*/dto/responses/*-response.dto.ts` 전체(19개 파일,
    83개 필드)
  - 상세: `?` 제거와 `ApiPropertyOptional`→`ApiProperty` 전환은 OpenAPI 스키마의
    `required` 플래그와 TS 컴파일 타임 옵셔널리티만 바꾼다. 런타임 직렬화 로직(컨트롤러의
    객체 리터럴 조립부)은 건드리지 않았고, 이미 마스킹이 적용되는 필드들(`ExecutionDto.error`
    / `inputData` / `outputData`, `IntegrationDto.credentials`, `AuthConfigDto.config` 등)의
    redaction 로직도 diff 범위 밖이라 그대로 유지된다. 따라서 정보 노출 표면(exposure surface)
    변화는 없다.
  - 제안: 조치 불필요. 참고용 기록.

- **[INFO]** 요청(Request) DTO 는 이번 배치에서 의도적으로 제외됨 — 잘한 판단
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (§"§5.4 drift 배치")
  - 상세: PATCH류 요청 DTO 는 "키 생략=값 불변, `null`=초기화" 라는 tri-state 의미 체계를 쓰므로
    응답 DTO 와 동일하게 `?` 를 제거하면 부분 업데이트 계약이 깨질 수 있었다(요청 DTO 21곳은
    작업 범위에서 제외). 이번 diff 에는 요청 DTO 변경이 전혀 포함되지 않아, 입력 검증/바디
    파싱 계약을 건드리는 회귀는 없다.
  - 제안: 조치 불필요.

- **[INFO]** 클라이언트 생성 타입이 optional→required 로 좁아지면서 소비자 코드가 null-check
  대신 optional-check 를 생략하게 될 수 있음(보안이 아니라 신뢰성 이슈)
  - 위치: 위 19개 DTO 파일 전반(예: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`)
  - 상세: OpenAPI `required:true` + `nullable:true` 조합은 "키는 항상 있지만 값이 `null` 일 수
    있다"는 올바른 계약이며, 생성 타입은 `T | null` 로 유지되므로 null-safety 자체는 보존된다.
    다만 종전에 `field?: T | null` 로 생성된 타입을 가정하고 `if (obj.field !== undefined)` 식
    옵셔널-체이닝을 하던 소비자 코드가 있다면(이번 diff 범위 밖) 그 코드가 아직 `undefined` 분기를
    참조할 수 있다 — 이는 타입 좁힘에 따른 컴파일 타임 이슈일 뿐, 보안 취약점(예: 인증 우회, 정보
    노출)으로 이어지는 경로는 확인되지 않았다.
  - 제안: 조치 불필요(보안 관점 밖). 프런트엔드/SDK 소비자 빌드가 `tsc` 로 이 변경을 검증하는지만
    확인 권장(이미 developer 가 83곳 뒤집고 `tsc` 비-spec 오류 0건을 확인했다고 기록됨).

## 점검 관점별 결과

1. 인젝션 취약점 — 해당 없음(데코레이터/타입 메타데이터만 변경, 쿼리·커맨드·경로 처리 코드 없음)
2. 하드코딩된 시크릿 — 없음
3. 인증/인가 — 없음(인가 로직·가드·미들웨어 미변경). `AuthConfigDto`, `UserProfileDto` 등
   인증 관련 DTO 가 포함되지만 필드 선언 방식만 바뀌었고 마스킹·인가 체크 코드는 diff 밖
4. 입력 검증 — 해당 없음(요청 DTO 변경 없음, 응답 DTO 는 입력 검증 대상 아님)
5. OWASP Top 10 — 해당 항목 없음
6. 암호화 — 관련 코드 없음
7. 에러 처리 — 에러 메시지 노출 로직 미변경(`ExecutionDto.error` 마스킹 정책은 diff 밖에서
   그대로 유지)
8. 의존성 보안 — `package.json`/lockfile 변경 없음

## 요약

이번 changeset 은 83개 응답 DTO 필드의 OpenAPI `required` 플래그를 실제 wire 동작(항상 키 존재,
값은 `null` 가능)에 맞춰 정정하는 순수 문서화/타입 정합성 수정이며, 런타임 직렬화·인가·마스킹·
검증 로직은 전혀 건드리지 않는다. 요청(PATCH) DTO 는 의미가 다르다는 이유로 명시적으로 배치에서
제외돼 있어 부분 업데이트 계약 회귀 위험도 없다. 보안 관점에서 새로 도입되는 취약점이나 정보
노출 표면 변화는 발견되지 않았다.

## 위험도

NONE
