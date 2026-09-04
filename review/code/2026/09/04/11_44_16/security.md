# 보안(Security) 리뷰

## 검토 범위 메모

이번 diff(`origin/main...HEAD`, codebase 9파일 / 648줄)는 다음 세 부류로 구성된다.

1. **DTO nullable/`@ApiProperty` 메타데이터 정정** — `background-run-response.dto.ts` 8필드(`@ApiPropertyOptional` → `@ApiProperty({ nullable: true })`), `create-assistant-session.dto.ts` `llmConfigId`(`string?` → `string | null`). OpenAPI 문서·TS 컴파일 타임 타입만 바뀌고 `class-validator`/`class-transformer` 런타임 검증·직렬화 경로는 무변경.
2. **신규 정적 분석 repo-guard**(`swagger-dto-contract-guard.ts`/`.spec.ts`) — `typescript` AST 로 backend 소스 트리를 파싱해 OpenAPI 선언과 TS 타입의 불일치를 잡는 CI 전용 테스트. 저장소 내부 소스만 읽고 실행하지 않는다.
3. **테스트 인프라 리팩터** — `nullable-type-lie-cast-guard.ts` 의 상대경로 크로스플랫폼 정규화(`path.sep` 처리), 공유 tmpdir 픽스처 헬퍼 `temp-fixture.ts`/`.spec.ts` 신설(`nullable-type-lie-cast.spec.ts` 내 지역 함수를 추출).

나머지(`CHANGELOG.md`, `plan/**`, `review/**`)는 서술 텍스트·이전 리뷰 산출물이며 실행되는 코드가 아니다.

## 검증 방법

- `git diff origin/main...HEAD -- codebase/` 를 직접 읽고 `password|secret|api[_-]?key|token|BEGIN (RSA|PRIVATE)` 패턴으로 grep — 매치 1건(`questionToken`, TS AST 프로퍼티명)뿐이며 실제 시크릿 아님.
- `llmConfigId` 소비처 전수 확인(`workflow-assistant-session.service.ts:91,107`, `workflow-assistant-stream.service.ts:203`) — TypeORM 엔티티 필드 대입(`session.llmConfigId = dto.llmConfigId`)이며 raw SQL 조합이 아니다. `@IsUUID()` 가 non-null 문자열에 대해 형식을 강제하고, `@IsOptional()` 이 `null`/`undefined` 를 검증 없이 통과시키는 것은 이 diff 이전부터의 기존 동작 — 이번 타입 확장이 새 검증 우회 경로를 만들지 않는다.
- `swagger-dto-contract-guard.ts` 의 `fs.readFileSync` 대상은 `collectTsFiles(SRC_ROOT)` 가 만든 저장소 내부 경로 목록(외부/사용자 입력 아님) — 경로 탐색 벡터 없음. `ts.createSourceFile` 은 파싱만 하고 평가(`eval`)하지 않는다.
- `temp-fixture.ts` 의 `fs.mkdtempSync(path.join(os.tmpdir(), prefix))` 는 예측 불가능한 접미사를 붙이는 표준 안전 패턴이고, `try/finally` 로 확실히 정리하며, `__test-utils__` 경로라 프로덕션 빌드에 포함되지 않는다.

## 발견사항

- **[INFO]** DTO `nullable` 메타데이터 정정은 취약점이 아니라 계약 정확도 개선
  - 위치: `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts` (`BackgroundRunNodeExecutionDto.finishedAt`/`durationMs`/`inputData`/`outputData`/`error`, `BackgroundRunNodeExecutionsPageDto.nextCursor`, `BackgroundRunResponseDto.completedAt`/`durationMs` 각 데코레이터 게이트)
  - 상세: `@ApiPropertyOptional` → `@ApiProperty({ nullable: true })` 전환은 OpenAPI 문서 메타데이터만 바꾸고 런타임 직렬화·검증 로직은 그대로다. 종전엔 문서가 "키가 항상 존재하며 null 이 올 수 있다"는 사실을 숨겨 API 소비자가 null 미처리 코드를 짤 위험이 있었던 문서-계약 불일치를 바로잡는 방향 — 정보 노출 확대나 검증 약화가 아니다.
  - 제안: 없음.

- **[INFO]** `create-assistant-session.dto.ts` `llmConfigId` 타입 확장은 런타임 검증 로직 무변경
  - 위치: `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts:19`
  - 상세: `llmConfigId?: string` → `llmConfigId?: string | null` 은 컴파일 타임 타입만 넓힌다. `@IsOptional() @IsUUID()` 조합은 값이 `null`/`undefined` 일 때 이미 `@IsUUID()` 검사를 건너뛰었으므로(이 diff 이전부터 성립), 인증/입력검증 우회 표면이 새로 생기지 않는다. 소비처(`workflow-assistant-session.service.ts:91` `dto.llmConfigId ?? null`)도 TypeORM 필드 대입일 뿐 SQL 조합이 아니다.
  - 제안: 없음.

- **[INFO]** 신규 repo-guard(`swagger-dto-contract-guard.ts`)는 신뢰 입력만 처리하는 CI 전용 정적 분석기
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` (`findSwaggerContractMismatches`)
  - 상세: `fs.readFileSync` 로 읽는 파일 목록은 저장소 내부 스캔(`collectTsFiles`)이 만든 경로이며 외부/사용자 입력이 아니다. `ts.createSourceFile` 은 파싱 전용이라 코드 인젝션·경로 탐색 벡터가 없고, `__tests__` 경로이므로 프로덕션 공격 표면에 포함되지 않는다.
  - 제안: 없음.

- **[INFO]** `temp-fixture.ts` 테스트 헬퍼의 tmpdir 사용은 표준적이고 프로덕션 경로가 아님
  - 위치: `codebase/backend/src/common/__test-utils__/temp-fixture.ts` (`withFiles`)
  - 상세: `fs.mkdtempSync(path.join(os.tmpdir(), prefix))` 는 예측 불가능한 임시 디렉터리를 생성하고 `finally` 에서 `fs.rmSync(..., { recursive: true, force: true })` 로 정리한다. 파일 내용은 합성 fixture 문자열뿐이고 `__test-utils__` 경로라 빌드 산출물에 포함되지 않는다. (async 콜백 시 조기 삭제되는 레이스가 있으나 이는 side_effect/testing 관점 결함이지 보안 취약점은 아니다 — 시크릿 노출이나 권한 우회로 이어지지 않는다.)
  - 제안: 없음.

- **[INFO]** `nullable-type-lie-cast-guard.ts` 경로 정규화(`path.sep` → `/`) 변경도 CI 전용 리포팅 문자열 조작일 뿐 보안 무관
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` (`findCastOffenders`/`findUntypedNullableColumns`/`findStaleSpecCasts`)
  - 상세: 결과 객체의 `file` 필드 표시 형식을 통일하는 문자열 변환이며 파일 접근 경로 자체(`path.relative(SRC_ROOT, file)`)는 바뀌지 않는다.
  - 제안: 없음.

- **[INFO]** 하드코딩된 시크릿·API 키·자격증명 없음
  - 위치: 변경된 codebase 9파일 전수 grep(`password|secret|api[_-]?key|token|BEGIN (RSA|PRIVATE)`) — 매치 1건은 `questionToken`(TS AST 프로퍼티명)으로 오탐.
  - 제안: 없음.

## 요약

이번 diff 는 (1) Swagger `@ApiProperty`/`@ApiPropertyOptional` 선언과 TS 타입의 nullable/presence 불일치("계약 거짓") 9곳을 정정하고, (2) 그 축을 재발 방지하는 AST 기반 CI 전용 정적 분석 가드를 신설하며, (3) 테스트 전용 tmpdir 픽스처 헬퍼를 공유 모듈로 추출하는 리팩터로 구성된다. 런타임 인증/인가·입력 검증(`class-validator`) 경로, SQL/명령 조합 경로, 암호화·평문 전송 관련 코드는 어느 것도 바뀌지 않았다. `llmConfigId` 의 소비처를 직접 추적해 TypeORM 필드 대입임을 확인했고 SQL 인젝션 벡터가 없음을 확인했다. 신규 repo-guard 와 tmpdir 헬퍼는 둘 다 저장소 내부 소스/합성 fixture 만 다루는 `__tests__`/`__test-utils__` 전용 코드로 프로덕션 공격 표면에 해당하지 않는다. 하드코딩된 시크릿도 없다. CRITICAL/WARNING 급 보안 결함은 발견되지 않았다.

## 위험도

NONE
