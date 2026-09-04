# 보안(Security) 리뷰

## 발견사항

- **[INFO]** `background-run-response.dto.ts` 8필드의 `@ApiPropertyOptional` → `@ApiProperty({ nullable: true })` 전환은 문서 메타데이터만 바뀐다 — 런타임 검증/직렬화 로직 무변화
  - 위치: `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts:43`(`finishedAt`), `:46`(`durationMs`), `:49-55`(`inputData`), `:58-64`(`outputData`), `:67-73`(`error`), `:84-87`(`nextCursor`), `:142-143`(`completedAt`), `:145-148`(`durationMs`, `BackgroundRunResponseDto`)
  - 상세: `@ApiProperty`/`@ApiPropertyOptional` 데코레이터는 OpenAPI 문서 생성 전용이며 `class-validator`/`class-transformer` 파이프라인은 이 데코레이터가 아니라 실제 값과 별도 검증 데코레이터로 동작하므로 인증/인가·데이터 노출 표면에 변화가 없다. `inputData`/`outputData`/`error` 필드는 이미 "자격증명으로 판별된 값은 마스킹되어 반환된다"는 기존 마스킹 정책이 그대로 유지되고, 이번 diff 는 그 마스킹 로직을 건드리지 않는다. 오히려 `required: false → true` 로 문서를 실제 wire 동작에 맞춰 좁히는 방향이라, OpenAPI 문서만 보고 null 미처리 클라이언트를 짜던 문서-실제 괴리(잠재적 NPE/처리 누락)를 줄이는 개선이다.
  - 제안: 없음(취약점 아님, 개선 방향 확인).

- **[INFO]** `create-assistant-session.dto.ts` `llmConfigId` 타입 확장(`string?` → `string | null`)은 입력 검증 동작을 바꾸지 않는다
  - 위치: `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts:19`
  - 상세: `@IsOptional()` 은 `class-validator` 관례상 값이 `null`/`undefined` 이면 뒤따르는 `@IsUUID()` 검사를 스킵한다 — 이 동작은 이번 diff 이전부터 성립했고(데코레이터 자체는 변경되지 않음), TS 타입만 실제 런타임 동작을 뒤늦게 반영했다. `null` 을 보내는 요청이 검증을 우회해 잘못된 값을 통과시키는 새 경로는 생기지 않는다 — `null`/`undefined` 모두 "생략" 과 동일하게 취급되는 것이 의도된 계약이고(자매 DTO 로 재확인됨), UUID 형식 검증을 우회할 새로운 인젝션 벡터는 아니다.
  - 제안: 없음.

- **[INFO]** 신규 repo-guard(`swagger-dto-contract-guard.ts`)는 저장소 내부 소스 파일만 읽는 CI 전용 정적 분석기 — 사용자 입력·프로덕션 공격 표면과 무관
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`(`findSwaggerContractMismatches`)
  - 상세: `fs.readFileSync(file, 'utf8')` 로 읽는 `file` 목록은 소비처(`swagger-dto-contract.spec.ts`)가 `collectTsFiles(SRC_ROOT)` 로 저장소 자신을 스캔해 만든 경로이며 외부/사용자 입력이 아니다. `ts.createSourceFile` 은 파싱만 하고 코드를 실행하지 않으므로 코드 인젝션 벡터가 없고, `path`/`toPosixRelative` 조합도 신뢰된 파일 목록 위에서만 동작해 경로 탐색 위험이 없다. `repo-guards/__tests__/*` 는 프로덕션 빌드 대상에서 제외되는 디렉터리(형제 가드 `production-build-devdep.spec.ts` 가 이를 자체 검증)라 런타임 공격 표면에 포함되지 않는다.
  - 제안: 없음.

- **[INFO]** 공유 테스트 헬퍼 `temp-fixture.ts` 의 tmpdir 사용은 표준적이며 실제 비밀정보를 다루지 않는다
  - 위치: `codebase/backend/src/common/__test-utils__/temp-fixture.ts` (`withFiles`)
  - 상세: `fs.mkdtempSync(path.join(os.tmpdir(), prefix))` 는 예측 불가능한 접미사로 디렉터리를 만들고(OS 기본 권한 `0700`), 파일 내용은 테스트 픽스처용 합성 소스 문자열뿐이다. `try/finally` 로 `fs.rmSync(dir, { recursive: true, force: true })` 를 확실히 호출해 콜백이 예외를 던져도 잔여물을 남기지 않는다(`temp-fixture.spec.ts` 가 예외 경로까지 직접 단언). `__test-utils__` 경로라 프로덕션 코드 경로에 포함되지 않는다.
  - 제안: 없음.

- **[INFO]** 신규 `withFiles` 의 async-thenable 거부 로직은 보안이 아니라 테스트 신뢰성 문제이며, 이번 수정으로 오히려 unhandled-rejection 누수 경로가 닫혔다
  - 위치: `codebase/backend/src/common/__test-utils__/temp-fixture.ts:56-68`
  - 상세: async 콜백이 reject 할 경우 종전엔 아무도 구독하지 않는 unhandled rejection 이 전역으로 새어나갈 수 있었는데(다른 리뷰 라운드 W4 가 이미 지적·수정), 이번 diff 는 `result.then(undefined, () => {})` 로 그 rejection 을 명시적으로 소비한 뒤 동기 에러로 실패시킨다. 이 경로는 테스트 하네스 내부에서만 실행되고 프로덕션 코드에 영향이 없어 보안 리스크로 분류하지 않는다.
  - 제안: 없음.

- **[INFO]** 신규 가드의 boolean 리터럴 전용 판독(`readBooleanOption`)이 상수 참조를 만나면 조용히 미판정 처리될 수 있다 — 회귀 방지 가드 자체의 견고성 문제이지 이번 diff 가 만든 취약점은 아니다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:58-74`(`readBooleanOption`)
  - 상세: `nullable`/`required` 값이 `TrueKeyword`/`FalseKeyword` 리터럴이 아니라 식별자·표현식(`nullable: SOME_CONST`)이면 `undefined` 로 처리되어 해당 필드의 계약 불일치를 못 잡을 수 있다. 이 가드 자체가 방어 대상(런타임 애플리케이션 코드)이 아니라 CI 게이트이므로 이는 "가드의 커버리지 공백" 이지 애플리케이션 보안 취약점이 아니다. 다른 리뷰어(api_contract/maintainability)가 이미 이 지점을 다른 관점에서 지적했다.
  - 제안: 이미 다른 리뷰 관점에서 다뤄지므로 이 리뷰에서는 추가 제안 없음.

- **[NONE]** 하드코딩된 시크릿·인증/인가 우회·안전하지 않은 암호화·평문 전송·SQL/XSS/커맨드/LDAP 인젝션·경로 탐색·민감정보 노출 에러 처리 — 전 범위에서 발견 없음
  - 상세: 리뷰 대상 전 파일(DTO 데코레이터 2건, 테스트 유틸리티 리팩터, 신규 CI 전용 AST 가드, plan/CHANGELOG 문서, 이전 리뷰 라운드 산출물 markdown/json)을 확인한 결과 인증·인가 로직, SQL/쿼리 빌더, 사용자 입력 처리 경로, 암호화·해시 로직, 외부 HTTP 호출, 의존성 추가(`package.json` 변경 없음)는 이번 diff 범위에 포함되지 않는다.

## 요약

이번 변경은 (1) Swagger DTO 의 `@ApiProperty`/`@ApiPropertyOptional`·`nullable` 선언과 TS 타입 사이의 문서-계약 불일치 9곳(응답 DTO 8곳 + 요청 DTO `llmConfigId` 1곳) 을 바로잡고 그 축을 앞으로 잡는 AST 기반 CI 가드(`swagger-dto-contract-guard.ts`/`.spec.ts`)를 신설하는 작업, (2) 저장소 repo-guard 들이 공유하는 tmpdir 테스트 픽스처·경로 정규화 헬퍼를 `common/__test-utils__/` 로 추출하는 리팩터, (3) plan/CHANGELOG 문서 갱신, (4) 이전 리뷰 라운드(`11_02_30`·`11_44_16`·`12_17_50`)의 산출물(markdown/json) 커밋으로 구성된다. 실제 런타임 검증(`class-validator`)·인증/인가·직렬화 로직은 어느 파일에서도 바뀌지 않았고, DTO 변경은 OpenAPI 문서 메타데이터를 실제 wire 동작에 맞추는 방향(요구가 더 정확해지는 방향)이라 클라이언트 보안 하방 요인이 없다. 신규 CI 가드와 테스트 헬퍼는 저장소 내부 소스·합성 픽스처만 다루고 사용자 입력·프로덕션 경로와 접점이 없어 공격 표면에 해당하지 않는다. 인젝션, 하드코딩 시크릿, 인증/인가 우회, 안전하지 않은 암호화, 민감정보 노출, 취약 의존성 등 OWASP Top 10 관점의 실질적 결함은 발견되지 않았다.

## 위험도

NONE
