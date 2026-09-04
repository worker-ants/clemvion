# 보안(Security) 리뷰

## 발견사항

- **[INFO]** DTO `nullable`/`required` 메타데이터 정정은 런타임 검증·직렬화에 영향 없는 순수 OpenAPI 문서 변경
  - 위치: `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts:43,46,49-56,58-65,67-74,84-88,142-143,145-149`
  - 상세: `@ApiPropertyOptional` → `@ApiProperty({ nullable: true })` 전환 8곳은 Swagger 문서 생성 데코레이터만 바꾼다. `class-validator`/`class-transformer` 는 런타임 값과 별개 검증 데코레이터(`@IsOptional()`, `@IsUUID()` 등)로 동작하므로 이 변경으로 인증/인가·입력 검증 경로가 바뀌지 않는다. 응답 바디 조립 로직(`background-runs.service.ts`) 자체도 diff 에 포함되지 않았다. 문서상 `required` 가 `false→true` 로 좁아지는 방향이라 오히려 클라이언트가 "키가 항상 존재한다"는 사실을 정확히 알게 되어 null-미처리 코드가 줄어드는 방향 — 정보 노출·계약 우회 소지 없음.
  - 제안: 없음.

- **[INFO]** `create-assistant-session.dto.ts` `llmConfigId` 타입 확장은 기존 런타임 검증 동작을 그대로 반영한 것 — 신규 인가 우회 표면 없음
  - 위치: `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts:19`
  - 상세: `llmConfigId?: string` → `llmConfigId?: string | null` 은 컴파일 타임 타입만 넓힌다. `@IsOptional()` 은 이 diff 이전부터 `null`/`undefined` 모두에서 `@IsUUID()` 검사를 스킵했고(`class-validator` 구현 확인), 소비처 `workflow-assistant-session.service.ts:91` (`dto.llmConfigId ?? null`) 도 이미 `null` 을 받아들이고 있었다. `llmConfigId` 가 다른 워크스페이스의 LLM 설정을 가리킬 수 있는지(IDOR)를 확인했으나 이번 diff 가 그 경로의 검증·조회 로직을 건드리지 않으므로 이번 변경 범위에서 새로 발생한 인가 우회는 없다.
  - 제안: 없음.

- **[INFO]** 신규 repo-guard(`swagger-dto-contract-guard.ts`)는 CI/테스트 전용 정적 분석기로, 신뢰된 입력(저장소 자기 소스 트리)만 처리한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` (`findSwaggerContractMismatches`, `readBooleanOption`, `hasTopLevelNull`)
  - 상세: `fs.readFileSync` 로 읽는 파일 목록은 `collectTsFiles`(소스 트리 스캔)가 만든 경로이며 사용자·네트워크 입력이 아니다. `ts.createSourceFile` 은 파싱만 하고 코드를 실행하지 않으므로 코드 인젝션·경로 탐색 벡터가 없다. 프로덕션 빌드(`repo-guards/__tests__/**`)에는 포함되지 않으므로 공격 표면에 해당하지 않는다.
  - 제안: 없음.

- **[INFO]** 공유 tmpdir 픽스처(`temp-fixture.ts`)의 파일시스템 사용은 표준적이고 프로덕션 경로가 아님
  - 위치: `codebase/backend/src/common/__test-utils__/temp-fixture.ts:44-69` (`withFiles`)
  - 상세: `fs.mkdtempSync(path.join(os.tmpdir(), prefix))` 는 예측 불가능한 접미사로 디렉터리를 생성해 심볼릭 링크·경로 예측 공격에 안전한 표준 패턴을 따르고, `try/finally` 로 `fs.rmSync(dir, { recursive: true, force: true })` 를 확실히 실행해 정리한다. 콘텐츠는 합성 fixture 문자열뿐이라 시크릿·비밀정보가 담기지 않으며, `__test-utils__` 경로는 프로덕션 빌드 산출물에 포함되지 않는다. (참고: async 콜백을 넘기면 정리가 콜백 완료 전에 실행되는 레이스가 있으나 이는 신뢰성/동시성 이슈이지 보안 취약점은 아니며, `withFiles` 자체가 thenable 반환을 감지해 명시적으로 throw 하도록 방어돼 있다 — `temp-fixture.ts:56-64`.)
  - 제안: 없음.

- **[INFO]** 저장소 전수 grep 결과 신규/변경 코드 어디에도 하드코딩된 시크릿·API 키·토큰·인증서 없음
  - 위치: 변경분 전체 (`git diff origin/main...HEAD -- codebase/`)
  - 상세: `api[_-]?key|secret|password|token|private[_-]?key|BEGIN ... PRIVATE KEY|Authorization:|Bearer ` 패턴으로 전수 grep 한 결과 유일한 매치는 `tsOptional` 식별자 안의 부분 문자열(`Token`)이었고 실제 시크릿은 없었다.
  - 제안: 없음.

- **[INFO]** `plan/*.md`·`review/code/**` 문서 변경은 실행되는 코드가 아니며 보안 검토 대상 표면이 없음
  - 위치: `plan/in-progress/execution-engine-residual-gaps.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`, `review/code/2026/09/04/11_02_30/**`, `review/code/2026/09/04/11_44_16/**`, `review/consistency/2026/09/04/11_33_21/**`, `CHANGELOG.md`
  - 상세: 전부 서술형 마크다운/JSON 산출물(이전 리뷰 라운드 결과물 포함)이며 코드 실행 경로가 없다.
  - 제안: 없음.

## 요약

이번 diff 는 (1) `@ApiProperty`/`@ApiPropertyOptional` 선언과 TS 타입의 nullable/presence 불일치를 잡는 신규 AST 기반 CI 가드(`swagger-dto-contract-guard.ts`/`.spec.ts`) 신설, (2) 그 가드가 실제로 잡아낸 Swagger 문서-타입 불일치 9곳(`background-run-response.dto.ts` 8곳, `create-assistant-session.dto.ts` `llmConfigId` 1곳) 수정, (3) 저장소 repo-guard 들이 공유하는 경로 정규화(`toPosixRelative`)·tmpdir 픽스처(`temp-fixture.ts`) 헬퍼 추출 리팩터, (4) plan/CHANGELOG 문서 갱신으로 구성된다. 모든 DTO 변경은 `@nestjs/swagger` 문서 데코레이터에 국한되고 `class-validator` 런타임 검증·인가 로직은 바뀌지 않았으며, `llmConfigId` 의 타입 확장도 기존에 이미 성립하던 런타임 동작을 뒤늦게 타입에 반영한 것으로 확인했다(IDOR 등 신규 인가 우회 없음). 신규 repo-guard·픽스처 헬퍼는 전부 CI/테스트 전용이며 저장소 자기 소스만 읽어 인젝션·경로 탐색 벡터가 없다. 전수 grep 으로 하드코딩된 시크릿도 없음을 확인했다. SQL/커맨드/LDAP 인젝션, XSS, 인증/인가 우회, 안전하지 않은 암호화, 민감정보 노출 등 OWASP Top 10 관련 CRITICAL/WARNING 급 결함은 발견되지 않았다.

## 위험도

NONE
