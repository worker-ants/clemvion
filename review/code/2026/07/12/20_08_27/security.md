# 보안(Security) 코드 리뷰

## 리뷰 대상

- `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts` (수정 — enum drift 가드 assertion 추가)
- `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts` (수정 — `status` 필드를 공유 리터럴로 치환)
- `codebase/backend/src/modules/external-interaction/dto/responses/execution-status.literal.ts` (신규 — 공유 SoT 상수/타입)
- `codebase/backend/src/modules/external-interaction/dto/responses/interact-ack-response.dto.spec.ts` (신규 — `InteractAckDto` 스키마 회귀 테스트)
- `codebase/backend/src/modules/external-interaction/dto/responses/interact-ack-response.dto.ts` (수정 — `currentStatus` 필드를 공유 리터럴로 치환)
- `plan/in-progress/eia-context-schema-followups.md` (문서, 코드 아님)
- `review/code/2026/07/12/19_49_01/*` (신규 — 이전 리뷰 세션의 SUMMARY/RESOLUTION/meta/각 리뷰어 산출물. 리포지토리 정책상 커밋되는 리뷰 아티팩트이며 실행 코드 아님)

## 변경 개요

`ExecutionStatusDto.status` 와 `InteractAckDto.currentStatus` 가 각자 선언하던 동일한 6값 리터럴 유니온(`'pending' | 'running' | 'waiting_for_input' | 'completed' | 'failed' | 'cancelled'`)과 swagger `enum` 배열을, 신규 파일 `execution-status.literal.ts` 의 `EIA_EXECUTION_STATUS_VALUES`(as const) + `ExecutionStatusLiteral` 파생 타입으로 통합한 순수 DRY 리팩터. 두 DTO 는 응답(response) DTO 이며 `class-validator` 데코레이터가 없다 — 클라이언트 입력을 파싱/검증하는 경로가 아니라 서버가 응답을 조립할 때 OpenAPI 문서화 + TS 컴파일타임 타입으로만 소비된다. 값 집합·순서는 diff 전후 완전히 동일함을 확인했다(리터럴 배열 vs 삭제된 인라인 배열이 정확히 일치). 신설된 두 `.spec.ts` 는 `SwaggerModule.createDocument()` 로 실제 OpenAPI 문서를 생성해 `status`/`currentStatus` 의 `enum` 값·순서, 그리고 엔티티 `ExecutionStatus` 와의 집합 동등성을 assert 하는 회귀 가드일 뿐 런타임 로직이 없다.

### 발견사항

- **[INFO]** 순수 리팩터 — 인젝션/입력 검증 표면 무관
  - 위치: `execution-status.literal.ts` 전체, 두 DTO 파일의 `status`/`currentStatus` 필드, 두 `.spec.ts`
  - 상세: (1) 응답 전용 필드라 SQL/커맨드/경로 인젝션 표면과 무관, (2) 사용자 입력을 받는 필드가 아니므로 새니타이징 요구 없음, (3) 하드코딩된 시크릿·API 키·토큰·인증서 없음(리터럴 상수는 상태값 문자열일 뿐), (4) 인증/인가 로직·가드·세션 처리 미접촉, (5) 해시/암호화 알고리즘 무관, (6) 에러 메시지·description 텍스트 내용 변경 없음(민감정보 노출 신규 경로 없음), (7) 신규 외부 패키지 의존성 없음(로컬 파일 추가). enum 값·순서가 diff 전후 동일함을 직접 대조해 wire 계약 변경도 없다.
  - 제안: 조치 불요.

- **[INFO]** 엔티티 값 집합과의 drift 가드 신설은 보안이 아닌 계약 정합성 목적
  - 위치: `execution-status-response.dto.spec.ts` / `interact-ack-response.dto.spec.ts` 의 "wire SoT 는 엔티티 `ExecutionStatus` 상태 집합과 동일" 테스트
  - 상세: `Object.values(ExecutionStatus)` 를 테스트 코드에서 참조하지만 이는 컴파일 타임 enum 값 나열이며 민감 정보나 내부 인프라 세부사항이 아니다. 테스트만 변경되었고 프로덕션 응답 스키마에 엔티티 결합을 추가하지 않는다(런타임 import 없음).
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/eia-context-schema-followups.md` 및 `review/code/2026/07/12/19_49_01/*` 문서 변경
  - 위치: plan frontmatter `worktree` 필드·체크박스 상태, review 세션 산출물(SUMMARY/RESOLUTION/meta/각 관점 리포트, `_retry_state.json`)
  - 상세: 모두 작업 추적/리뷰 산출물이며 코드가 아니다. 내용을 확인한 결과 자격증명·개인정보·내부 인프라 엔드포인트·토큰 등 민감 정보 노출이 없다. `_retry_state.json` 은 로컬 파일시스템 절대경로만 담고 있어 시크릿에 해당하지 않는다.
  - 제안: 조치 불요.

## 점검 관점별 확인

1. **인젝션 취약점**: 해당 없음 — 사용자 입력을 받는 경로가 아닌 응답 DTO 필드/상수 선언.
2. **하드코딩된 시크릿**: 없음 — 리터럴 값은 execution 상태 문자열 6개뿐.
3. **인증/인가**: 미접촉.
4. **입력 검증**: 응답 DTO 라 해당 없음(요청 DTO 아님, `class-validator` 데코레이터 없음은 기존과 동일).
5. **OWASP Top 10**: 해당 범주 위험 없음(A03 Injection, A02 Cryptographic Failures, A01 Broken Access Control 등 어느 것도 이 diff 로 영향받지 않음).
6. **암호화**: 무관.
7. **에러 처리**: description 문자열 등 에러/응답 메시지 내용 변경 없음.
8. **의존성 보안**: 신규 외부 라이브러리 도입 없음(로컬 파일 1개 추가).

## 요약

이번 변경은 두 응답 DTO(`ExecutionStatusDto.status`, `InteractAckDto.currentStatus`)가 중복 선언하던 6값 상태 리터럴 유니온과 swagger `enum` 배열을 단일 로컬 SoT(`execution-status.literal.ts`)로 추출하고, 그 값·순서가 엔티티 및 두 DTO 간에 일치하는지 검증하는 회귀 테스트를 보강한 behavior-preserving 리팩터다. 응답(output) 스키마 정의와 테스트 코드에 국한되며 인젝션·시크릿·인증/인가·입력 검증·암호화·에러 노출·의존성 어느 축에서도 신뢰 경계나 동작 변화가 없다. 동반된 plan/review 문서 변경도 민감 정보를 담지 않는 작업 추적 산출물이다.

## 위험도

NONE
