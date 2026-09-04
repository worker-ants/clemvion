# 보안(Security) 리뷰

## 발견사항

- **[INFO]** DTO `nullable` 메타데이터 정정은 취약점이 아니라 계약 정확도 개선
  - 위치: `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts:43,46,54,63,72,86`
  - 상세: `@ApiPropertyOptional` → `@ApiProperty({ nullable: true })` 전환은 런타임 검증·직렬화 로직을 바꾸지 않는 순수 OpenAPI 문서 메타데이터 변경이다(`class-validator`/`class-transformer` 파이프라인은 TS 타입이 아니라 데코레이터 인자·실제 값 기준으로 동작하므로 동작 변화 없음). 종전엔 OpenAPI 문서가 "키가 항상 존재하며 null 이 올 수 있다"는 사실을 숨겨 API 소비자가 null 미처리 코드를 짤 수 있었던 문서-계약 불일치를 바로잡는 방향의 변경이라 보안 하방(악화) 요인은 없다.
  - 제안: 없음(개선 방향 확인만).

- **[INFO]** `create-assistant-session.dto.ts` 의 `llmConfigId` 타입 확장은 런타임 검증 로직 무변경
  - 위치: `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts:19`
  - 상세: `llmConfigId?: string` → `llmConfigId?: string | null` 는 컴파일 타임 타입 애노테이션만 바뀐 것이고, `@IsOptional() @IsUUID()` 는 런타임 값 기준으로 동작해 변경 전후 검증 동작이 동일하다(값이 `undefined`/`null` 이면 `@IsOptional()` 이 `@IsUUID()` 검사를 스킵하는 것은 이 diff 이전부터 성립). 새로운 인증/입력검증 우회 표면은 없다.
  - 제안: 없음.

- **[INFO]** 신규 repo-guard(`swagger-dto-contract-guard.ts`)는 신뢰 입력만 처리
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` (`findSwaggerContractMismatches` 함수)
  - 상세: `fs.readFileSync` 로 읽는 파일 목록은 저장소 내부 `collectTsFiles`(소스 트리 스캔)가 만든 경로이고 외부/사용자 입력이 아니다. `ts.createSourceFile` 은 파싱만 하고 실행하지 않으므로 코드 인젝션·경로 탐색 벡터가 없다. CI/테스트 전용 정적 분석 도구라 프로덕션 공격 표면에 포함되지 않는다.
  - 제안: 없음.

- **[INFO]** `temp-fixture.ts` 테스트 헬퍼의 tmpdir 사용은 표준적이고 프로덕션 코드 경로가 아님
  - 위치: `codebase/backend/src/common/__test-utils__/temp-fixture.ts:21` (`withFiles` 함수)
  - 상세: `fs.mkdtempSync(path.join(os.tmpdir(), prefix))` 는 예측 불가능한 접미사를 붙여 디렉터리를 생성하고(symlink/경로 예측 공격에 안전한 표준 패턴), `finally` 블록에서 `fs.rmSync(..., { recursive: true, force: true })` 로 확실히 정리한다. 파일 내용은 합성 fixture 문자열뿐이고 실제 비밀정보가 담기지 않으며, `__test-utils__` 경로라 프로덕션 빌드에 포함되지 않는다.
  - 제안: 없음.

- **[INFO]** plan 문서(`.md`) 변경은 서술 텍스트로 코드 실행 표면 없음
  - 위치: `plan/in-progress/execution-engine-residual-gaps.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`
  - 상세: 두 파일 모두 실측 기록·계획 갱신용 마크다운이며 실행되는 코드가 아니다. 보안 관점에서 검토 대상 아님.

## 요약

이번 diff 는 (1) nullable 타입/스웨거 계약 불일치를 잡는 신규 정적 분석 가드(AST 기반) 도입, (2) 그 가드가 실제로 잡아낸 8~9곳의 Swagger `@ApiProperty`/`@ApiPropertyOptional` 문서-타입 불일치 수정, (3) 테스트 전용 tmpdir 픽스처 헬퍼의 중복 제거 리팩터, (4) plan 문서 갱신으로 구성된다. 런타임 검증 로직(`class-validator` 데코레이터)이나 인증/인가 경로를 바꾸는 변경은 없고, 새 코드는 SQL/커맨드/경로 인젝션 벡터·하드코딩 시크릿·안전하지 않은 암호화·민감정보 노출 소지가 없다. DTO 의 `nullable` 메타데이터 정정은 오히려 API 문서-실제 계약 간 괴리(클라이언트가 null 을 예상 못 해 처리 누락을 일으킬 수 있는 요인)를 줄이는 방향이다. 신규 repo-guard 는 저장소 내부 소스만 읽는 CI 전용 정적 분석기라 공격 표면에 해당하지 않는다.

## 위험도

NONE
