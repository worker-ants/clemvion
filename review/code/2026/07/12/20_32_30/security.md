# 보안(Security) 코드 리뷰

## 리뷰 대상

- `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts` (수정)
- `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts` (수정)
- `codebase/backend/src/modules/external-interaction/dto/responses/execution-status.literal.ts` (신규)
- `codebase/backend/src/modules/external-interaction/dto/responses/execution-status.literal.spec.ts` (신규)
- `codebase/backend/src/modules/external-interaction/dto/responses/interact-ack-response.dto.ts` (수정)
- `codebase/backend/src/modules/external-interaction/dto/responses/interact-ack-response.dto.spec.ts` (신규)
- `plan/in-progress/eia-context-schema-followups.md` (문서)
- `review/code/2026/07/12/19_49_01/**`, `review/code/2026/07/12/20_08_27/**` (직전 리뷰 세션 산출물 — SUMMARY/RESOLUTION/각 리뷰어 markdown·meta.json·_retry_state.json 등, 코드 아님)

## 변경 개요

`ExecutionStatusDto.status` 와 `InteractAckDto.currentStatus` 가 각자 선언하던 동일한 6값 리터럴 유니온
(`'pending' | 'running' | 'waiting_for_input' | 'completed' | 'failed' | 'cancelled'`)과 swagger `enum`
배열을, 신규 파일 `execution-status.literal.ts` 의 `EIA_EXECUTION_STATUS_VALUES`(as const) +
`ExecutionStatusLiteral` 파생 타입으로 통합한 behavior-preserving 리팩터. 두 DTO 는 응답(response) DTO 이며
`class-validator` 데코레이터가 없다 — 클라이언트 입력을 파싱/검증하는 경로가 아니라 서버가 응답을 조립할 때
OpenAPI 문서화 + TS 컴파일타임 타입으로만 소비된다. 값 집합·순서는 diff 전후 완전히 동일하다(삭제된 인라인
배열과 신규 SoT 배열이 정확히 일치). 신설된 `.spec.ts` 3건은 `SwaggerModule.createDocument()` 로 실제 OpenAPI
문서를 생성해 `status`/`currentStatus` 의 `enum` 값·순서, 엔티티 `ExecutionStatus` 와의 집합 동등성을 assert
하는 순수 회귀 가드이며 런타임 프로덕션 로직을 포함하지 않는다. 나머지 변경(plan 문서, 직전 리뷰 세션
산출물 markdown/json)은 코드가 아닌 작업 추적·리뷰 기록이다.

### 발견사항

- **[INFO]** 순수 리팩터 — 보안 영향 없음
  - 위치: `execution-status.literal.ts` 전체, `execution-status-response.dto.ts`/`interact-ack-response.dto.ts` 의 `status`/`currentStatus` 필드
  - 상세: (1) 응답 필드이므로 입력 검증/인젝션 표면과 무관, (2) 값 집합·직렬화 형태(wire enum 배열 순서 포함)가 리팩터 전후 동일, (3) 하드코딩된 시크릿·자격증명·API 키 없음, (4) 인증/인가 로직 미접촉(가드·미들웨어·세션 처리 변경 없음), (5) 암호화·해시 알고리즘 무관, (6) 에러 메시지 내용 무변경(`description` 텍스트 그대로 유지), (7) 신규 외부 의존성 없음(로컬 파일 추가일 뿐, 3rd-party 패키지 추가 없음).
  - 제안: 조치 불요.

- **[INFO]** 신규 테스트 파일의 `StubController` — 프로덕션 노출 없음
  - 위치: `interact-ack-response.dto.spec.ts` — `@Controller('stub') class StubController { @Post() ack(): InteractAckDto { return null as never; } }`
  - 상세: `SwaggerModule.createDocument()` 로 OpenAPI 스키마를 뽑아내기 위한 테스트 전용 스텁 컨트롤러다. 실제 `AppModule`/production 라우팅에 등록되지 않고 `Test.createTestingModule({ controllers: [StubController] })` 로 격리된 테스트 모듈에서만 존재하며, `app.close()` 로 매 테스트 후 정리된다. `ack()` 는 `null as never` 를 반환하는 미구현 스텁이라 실제 요청을 처리하지 않는다 — 엔드포인트 경로 `stub` 이 실서비스에 노출될 위험 없음.
  - 제안: 조치 불요.

- **[INFO]** 응답 DTO 라 입력 검증(class-validator) 대상 아님
  - 위치: 두 DTO 클래스 전체
  - 상세: `status`/`currentStatus` 는 서버가 채워 내려보내는 출력 필드이며, `class-validator` 데코레이터(`@IsEnum` 등)가 원래도 없었고 이번 변경도 이를 추가/제거하지 않았다. 리터럴 유니온 → `ExecutionStatusLiteral` 타입 alias 치환은 TS 컴파일타임 타입 정보 및 swagger 문서 생성용 `enum` 메타데이터에만 영향을 미치며, 런타임 값 검증 동작(현재 부재 상태)에는 변화가 없다 — 회귀도 개선도 아닌 현행 유지.
  - 제안: 조치 불요(입력 검증이 필요한 것은 별도의 request DTO — 본 변경 범위 밖).

- **[INFO]** `plan/**`, `review/code/**` 문서/리뷰 산출물 변경
  - 위치: `plan/in-progress/eia-context-schema-followups.md`, `review/code/2026/07/12/{19_49_01,20_08_27}/**`
  - 상세: 코드가 아닌 작업 추적 문서 및 이전 리뷰 세션의 산출물(markdown 보고서·`meta.json`·`_retry_state.json`)이다. 시크릿·자격증명·개인정보·내부 인프라 세부사항(호스트명, 내부 IP, 실제 토큰값 등) 노출 여부를 grep 으로 확인했으며 해당 패턴 없음. `_retry_state.json` 은 절대경로(로컬 worktree 경로)만 포함하고 있어 민감정보로 보기 어렵다.
  - 제안: 조치 불요.

## 요약

이번 변경은 두 응답 DTO(`ExecutionStatusDto.status`, `InteractAckDto.currentStatus`)가 중복 선언하던 6값
상태 리터럴 유니온·swagger `enum` 배열을 단일 로컬 SoT(`execution-status.literal.ts`)로 통합하고 이를
검증하는 회귀 테스트 3건을 추가한 behavior-preserving 리팩터다. 응답(output) 스키마 정의에 국한되며 입력
검증·인증/인가·암호화·에러 메시지 노출·의존성 어느 축에서도 동작이나 신뢰 경계에 변화가 없다. 값 집합·순서가
리팩터 전후 동일함을 diff 로 직접 확인했고, 신규 테스트의 스텁 컨트롤러도 테스트 모듈에만 격리돼 프로덕션
노출 위험이 없다. 하드코딩된 시크릿, 인젝션 가능 지점, 안전하지 않은 암호화, 민감정보 에러 노출은 발견되지
않았다. 동봉된 plan 문서·이전 리뷰 세션 산출물에도 시크릿·내부 인프라 정보 노출이 없음을 확인했다.

## 위험도

NONE
