# 보안(Security) 코드 리뷰

## 범위

이번 changeset(25개 파일)의 실체는 두 겹이다:

1. **응답 DTO `required` 정합화 (실 코드 변경)** — `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`(`ExecutionDto` 10필드) 와
   `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts`(`ExecutionStatusDto` 5필드) 에서
   `@ApiPropertyOptional({ nullable: true }) field?: T | null` → `@ApiProperty({ nullable: true }) field: T | null` 로 전환(OpenAPI `required: false→true`, TS `?` 제거).
   대응 테스트 `execution-status-response.dto.spec.ts` 에 `required` 배열 단언을 추가.
   `CHANGELOG.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` 는 이 변경의 배경(§5.4 정정 후속)·측정 근거를 기록한 문서다.
2. **이전 리뷰 라운드 산출물의 커밋 (`review/code/.../14_54_36/*`, `review/consistency/.../15_16_28/*`)** — 신규 코드가 아니라, 직전 코드 리뷰 8개 에이전트 결과 + consistency check 5개 checker 결과가 담긴 마크다운/JSON 산출물이다.

diff 전체를 grep/Read 로 대조해 위 패턴(데코레이터·TS 옵셔널 마커·문서 산출물) 밖의 로직 변경이 있는지 확인했으며, 예외 없이 전부 이 형태였다. 리포지토리 파일은 뮤테이션하지 않았다 — 읽기 전용 검토(`Read`/`grep`)로 판정에 충분했다. `git status --short` 로 확인한 결과 이 리뷰가 만든 잔여물은 없다(세션 산출 디렉터리 `review/code/.../15_22_06/` 자체만 untracked로 잡히며, 이는 orchestrator 가 생성한 이번 리뷰 세션의 정상 산출 대상이다).

## 발견사항

- **[INFO]** 응답 바디에 노출되는 필드 자체는 이 변경으로 늘거나 줄지 않는다 — wire 레벨 payload 는 changeset 이전과 동일
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:19-117`, `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts:123-174`
  - 상세: `?` 제거와 `ApiPropertyOptional`→`ApiProperty` 전환은 OpenAPI 스키마의 `required` 플래그와 TS 컴파일 타임 옵셔널리티만 바꾼다. `@ApiProperty`/`@ApiPropertyOptional` 은 `@nestjs/swagger` 전용 문서화 데코레이터이며 `class-validator`/`class-transformer` 와 달리 런타임 직렬화·검증에 관여하지 않는다. 컨트롤러의 객체 리터럴 조립부, `ExecutionDto.error`/`inputData`/`outputData` 의 기존 redaction 로직(`shared/utils/redact-stored-error.ts`)은 diff 범위 밖이라 그대로 유지된다. 따라서 정보 노출 표면(exposure surface) 변화는 없다.
  - 제안: 조치 불필요. 참고용 기록.

- **[INFO]** 요청(Request) DTO 는 이번 배치에서 의도적으로 제외됨 — 잘한 판단
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (§5.4 drift 배치 1단계 항목)
  - 상세: PATCH류 요청 DTO 는 "키 생략=값 불변, `null`=초기화" 라는 tri-state 의미 체계를 쓰므로, 응답 DTO 와 동일하게 `?` 를 제거하면 부분 업데이트 계약이 깨질 수 있다(요청 DTO 21곳은 명시적으로 범위 밖). 이번 diff 는 요청 DTO 를 전혀 건드리지 않아, 입력 검증·바디 파싱 계약을 건드리는 회귀는 없다.
  - 제안: 조치 불필요.

- **[INFO]** 클라이언트 생성 타입이 optional→required 로 좁아지며 소비자 코드의 `undefined` 분기가 죽은 코드가 될 수 있음(보안이 아니라 신뢰성 이슈)
  - 위치: 위 2개 DTO 파일 전반
  - 상세: OpenAPI `required:true` + `nullable:true` 조합은 "키는 항상 있지만 값이 `null` 일 수 있다"는 올바른 계약이며 생성 타입은 `T | null` 로 유지되므로 null-safety 자체는 보존된다. 종전 `field?: T | null` 을 가정하고 `undefined` 분기를 쓰던 소비자 코드가 있다면(diff 범위 밖) 그 분기가 죽은 코드가 될 뿐, 인증 우회·정보 노출로 이어지는 경로는 확인되지 않았다.
  - 제안: 조치 불필요(보안 관점 밖). 프런트/SDK 소비 빌드가 `tsc` 로 이 변경을 검증하는지만 확인 권장.

- **[INFO]** 커밋된 리뷰 산출물(`review/code/.../14_54_36/*.md`, `review/consistency/.../15_16_28/*.md`)에 시크릿·자격증명·내부 인프라 세부(호스트명·포트·DB 연결정보 등)가 포함되는지 확인 — 없음
  - 위치: `review/code/2026/09/04/14_54_36/*`, `review/consistency/2026/09/04/15_16_28/*` (RESOLUTION.md, SUMMARY.md, `_retry_state.json`, `meta.json`, 각 checker/reviewer md 12건)
  - 상세: 이 파일들에는 절대경로(로컬 워크트리 경로), 세션 타임스탬프, 필드명·파일 경로만 담겨 있다. API 키·비밀번호·토큰·개인정보 패턴(`grep -niE "api[_-]?key|secret|password|token|credential|private[_-]?key"`)을 전수 스캔했고 매치는 `IntegrationDto.credentials`·`AuthConfigDto.config` 같은 **필드명 언급**뿐, 실제 값이 아니다.
  - 제안: 조치 불필요.

## 점검 관점별 결과

1. 인젝션 취약점 — 해당 없음(데코레이터/타입 메타데이터만 변경, 쿼리·커맨드·경로 처리 코드 없음)
2. 하드코딩된 시크릿 — 없음(코드·리뷰 산출물 전수 grep 확인)
3. 인증/인가 — 없음(인가 로직·가드·미들웨어 미변경). `AuthConfigDto` 등 인증 관련 DTO 가 다음 배치(2단계, 68곳) 후보로 plan 에 등재돼 있으나 이번 diff 범위 밖
4. 입력 검증 — 해당 없음(요청 DTO 변경 없음, 응답 DTO 는 입력 검증 대상 아님)
5. OWASP Top 10 — 해당 항목 없음
6. 암호화 — 관련 코드 없음
7. 에러 처리 — 에러 메시지 노출 로직 미변경(`ExecutionDto.error` 마스킹 정책은 diff 밖에서 그대로 유지)
8. 의존성 보안 — `package.json`/lockfile 변경 없음

## 요약

이번 changeset 은 두 겹으로 구성된다 — (1) `ExecutionDto`/`ExecutionStatusDto` 15개 필드의 OpenAPI `required` 플래그를 실제 wire 동작(항상 키 존재, 값은 `null` 가능)에 맞춰 정정하는 순수 문서화/타입 정합성 수정, (2) 직전 리뷰 라운드(code review + consistency check)의 산출물을 저장소에 커밋. 두 겹 모두 런타임 직렬화·인가·마스킹·검증 로직을 전혀 건드리지 않으며, 요청(PATCH) DTO 는 tri-state 의미 보존을 위해 명시적으로 배치에서 제외돼 부분 업데이트 계약 회귀 위험도 없다. 커밋된 리뷰 산출물에도 시크릿·자격증명 노출은 없다. 보안 관점에서 새로 도입되는 취약점이나 정보 노출 표면 변화는 발견되지 않았다.

## 위험도

NONE
