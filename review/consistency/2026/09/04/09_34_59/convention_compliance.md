# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-nullable-notation-followups.md`

검토 모드: spec draft 검토 (`--spec`). 대상은 `spec/1-data-model.md` §2.9, `spec/data-flow/10-triggers.md` §3.2,
`spec/5-system/2-api-convention.md` §2.2·§5.4 에 대한 변경안을 담은 planner draft 3건.

번들에 포함되지 않은(컨텍스트 예산 초과로 절단된) `spec/conventions/swagger.md`·`migrations.md` 는
저장소에서 직접 읽어 대조했다. `error-codes.md`·`spec-impl-evidence.md` 는 이번 세 항목과
도메인이 겹치지 않아(에러 코드·frontmatter lifecycle) 직접 대조는 생략했다.

## 사실관계 검증 (요약)

아래 발견사항의 전제가 되는 target 의 실측 인용을 저장소에서 재확인했다 — 전부 일치했다.

- `spec/1-data-model.md:260` `next_run_at | Timestamp` (물음표 없음) vs `:261` `last_run_at | Timestamp?` — target 주장과 일치.
- `spec/5-system/2-api-convention.md` §2.2 의 기존 예외 2개(RPC-style sub-channel · `/api/external/*` 인증 family) 문면 확인 — target 인용과 일치. `/api/auth/workspaces/:id/switch` 가 이미 RPC-style 예외에 포함된 것도 일치.
- `codebase/backend/src/modules/auth/**/*.controller.ts` 의 verb-style 경로 실측 — `register`/`verify-email`/`login`/`login/totp`/`2fa/*`/`logout`/`refresh`/`forgot-password`/`reset-password`/`check-email`/`oauth/:provider/callback`/`webauthn/*` 등 target 이 나열한 20개와 대체로 부합.
- `node_modules/.pnpm/@nestjs+swagger@11.4.5.../decorators/api-property.decorator.js` — `ApiPropertyOptional(options) { return ApiProperty({...options, required: false}); }` 확인. target 의 "`@ApiPropertyOptional` = `ApiProperty({required:false})`" 주장은 정확하다(줄 번호만 51-53 vs target 인용 `:52` — 사소한 차이).
- `AuthConfigUsageCallDto.sourceIp` (`auth-config-response.dto.ts:87-88`) — `@ApiProperty({ type: String, nullable: true, ... }) sourceIp: string | null;` 확인. target 이 "의미상 옳은 형태"의 실례로 든 것과 일치.
- `spec/5-system/2-api-convention.md:184` 의 §5.4 원문 인용("`null` 을 쓰는 필드는 `@ApiPropertyOptional({ nullable: true })` + `field?: T | null`")도 일치.

## 발견사항

### [WARNING] §5.4 개정안이 `swagger.md` 크로스링크를 갱신하지 않아 데코레이터 패턴의 SoT 가 두 문서로 흩어진다

- target 위치: `③` "변경안" (draft 158~165행)
- 위반 규약: `spec/conventions/swagger.md` — CLAUDE.md 정보 저장 표의 "정식 규약 → `spec/conventions/<name>.md`" 원칙, 그리고 §1-3 을 지목하는 기존 `api-convention.md §5.4` 인용 관행
- 상세: 현행 `api-convention.md:184` 는 DTO 데코레이터 규칙을 적으면서 `([Swagger 규약 §1-3](../conventions/swagger.md#1-3-optional-필드))` 로 `spec/conventions/swagger.md` 를 캐노니컬 출처로 인용한다. target 의 개정 문구(draft 158~165행)는 이 링크를 아예 제거하고 데코레이터 규칙을 `api-convention.md` 자체에서 완결시킨다. 그런데 `spec/conventions/swagger.md` §1-3(Optional 필드)·§1-4(nested/enum/union) 어디에도 "상시 존재 + nullable" 조합(`@ApiProperty({ nullable: true })` + `field: T | null`)의 예시가 없다 — 직접 확인 결과 `swagger.md` 전체에 `required: true` 문자열도, 이 조합의 코드 예시도 없다. `spec/conventions/swagger.md` 는 "Swagger 문서화 일관된 패턴 가이드"로서 데코레이터·DTO 패턴의 정식 SoT 역할을 자임하는 문서인데(CLAUDE.md §4 "API 문서 규약"의 관할 문서), 이 개정 후에도 그 문서만 읽는 개발자는 이 결정적 패턴을 여전히 볼 수 없다.
- 제안: (a) `spec/conventions/swagger.md` §1 에 "상시 존재 + nullable" 패턴 예시를 함께 추가하고 `spec_impact` 에 `spec/conventions/swagger.md` 를 포함하거나, (b) 최소한 개정 문구에 `swagger.md` 링크를 유지하되 앵커를 이 draft 가 신설하는 정확한 위치로 갱신 — 다만 (b) 만으로는 여전히 swagger.md 본문에 예시가 없으므로 (a) 가 더 완전하다. 최소 조치로 개정 문구 하단에 "swagger.md 는 아직 이 패턴을 다루지 않는다" 는 한 줄 캐비엇이라도 남기면 다음 사람이 같은 조사를 반복하지 않는다.

### [WARNING] "70 vs 16" 실측치에 집계 기준이 없다 — 같은 문서의 선례가 명시적으로 경고한 실수

- target 위치: `③` "저장소 실측" 표 (draft 145~152행)
- 위반 규약: `spec/conventions/swagger.md` §Rationale "§3 DTO 길이는 왜 강제가 아닌가" — 그 절은 "**집계 기준을 적어 둔다 — 안 적으면 재현이 안 된다**" 며 대상 glob·분류 기준·길이 계산 방식 3가지를 명시적으로 남긴 전례다(요청 vs 응답 DTO 를 다르게 잡아 다른 리뷰어가 다른 수치(118/368)를 얻었던 사고 이후의 교훈).
- 상세: target 의 "70 vs 16" 은 어떤 glob(`dto/**/*.dto.ts` 전체인지 `responses/` 제외인지), 어떤 정규식(단일 옵션 객체 `{...}` 안의 `nullable:\s*true` 인지 멀티라인 포함인지), `oneOf`/union 필드(의도적으로 optional+nullable 인 §1-4 케이스, 즉 "위반이 아닌" 케이스)를 제외했는지를 전혀 밝히지 않는다. 직접 재현해 본 결과(파일 전체 `*.dto.ts`, `@ApiPropertyOptional({...nullable...true...})` 및 `@ApiProperty({...nullable...true...})` 정규식 매치, 멀티라인 포함) **102 vs 17** 이 나왔다 — 방향(현행 문면 형태가 압도 다수)은 target 과 일치하지만 절대값은 상당히 다르다(70 대 102, 16 대 17). `AuthConfigUsageCallDto.sourceIp` 등 개별 인용은 정확했으므로 결론 자체가 틀렸다고 보기는 어렵지만, 정확한 수치는 §1-4 의 "정당한 optional+nullable"(닫힌 union) 케이스를 어떻게 걸러내느냐에 따라 갈린다 — 그 분류 기준이 바로 이번 draft 가 고치는 §5.4 규칙이라 순환적이다.
- 제안: `swagger.md` §3 Rationale 이 남긴 것과 동일한 형태로 "대상 glob / 분류 기준(§1-4 닫힌 union 제외 여부) / 매칭 정규식"을 한 줄 각주로 남긴다. 이 draft 가 나중에 "drift 규모 기록"의 근거로 인용될 것이므로(§변경안 하단 "70곳" 언급), 재현 불가능한 숫자는 후속 developer plan 의 스코프 산정을 왜곡할 수 있다.

### [INFO] 신설 예외명 "인증 액션 네임스페이스"가 기존 "인증 family 전용 네임스페이스"와 명명이 근접해 표에서 구분이 어렵다

- target 위치: `②` "변경안 — 세 번째 예외 조항" (draft 95~101행)
- 위반 규약: 없음(직접 위반은 아님) — `spec/5-system/2-api-convention.md` §2.2 예외 표의 기존 두 항목과의 명명 일관성 상 제안
- 상세: §2.2 표는 이미 "**예외 — 인증 family 전용 네임스페이스**"(`/api/external/*`, execution 단명 토큰 인증)를 갖고 있다. target 이 추가하려는 신설 행은 "**예외 — 인증 액션 네임스페이스**"(`/api/auth/*`, 세션 기반 인증 상태 전이)다. 두 라벨 모두 "인증 ... 네임스페이스"로 시작해 표를 훑을 때(특히 향후 이 규칙을 인용하는 다른 spec 문서에서) 어느 쪽을 가리키는지 헷갈리기 쉽다 — 실제로 두 예외는 인증 주체·목적이 서로 다르다(전자는 "다른 인증 방식으로 접근하는 별도 자원군", 후자는 "자원이 아예 없는 상태 전이 액션").
- 제안: 라벨을 더 분화한다. 예: "예외 — 인증 상태 전이 액션(session auth actions)" 대 기존 "예외 — 인증 family 전용 네임스페이스(execution-token auth)"처럼 괄호로 인증 방식을 병기하면 두 예외가 어떤 축에서 다른지(대상 자원 유무 vs 인증 토큰 종류) 표만 보고도 구분된다.

### [INFO] 컨텍스트 예산 절단으로 이번 검토의 1차 번들에서 `swagger.md`가 빠져 있었다

- target 위치: 해당 없음(리뷰 파이프라인 이슈)
- 위반 규약: 없음 — 프로세스 관찰
- 상세: `_prompts/convention_compliance.md` 의 "정식 규약 모음" 번들이 컨텍스트 예산 초과로 `spec/conventions/swagger.md`(23,277자)·`migrations.md`·`error-codes.md`·`spec-impl-evidence.md` 를 전부 "본문 생략" 처리했다. 이번 draft 의 핵심 쟁점(③) 이 바로 `swagger.md` 데코레이터 시맨틱이라 번들만 보고 판정했다면 핵심 규약을 못 보고 지나갔을 것이다(`.claude/docs` 기존 교훈 "consistency `--spec` 기본 예산이 conventions 를 통째로 떨군다"와 동일 클래스). 이번 검토는 저장소에서 직접 읽어 보완했다.
- 제안: 없음(정보 제공). orchestrator 가 `--spec` 예산 산정 시 target draft 의 `spec_impact` 가 가리키는 spec 파일과 이름이 겹치는 `spec/conventions/*.md`(예: API 관련 draft → `swagger.md`/`error-codes.md`)를 우선순위 앞당겨 번들링하는 것을 고려할 수 있다.

## 요약

target draft 는 세 항목 모두 실측이 저장소 상태와 정확히 일치했고(§2.9 표기, §2.2 verb-style 20개, `@ApiPropertyOptional`=`required:false` 구현 사실, `AuthConfigUsageCallDto.sourceIp` 실례), 제안 문구도 기존 `2-api-convention.md` §2.2 예외 표의 서식·`spec/conventions/swagger.md` §1-3/§1-4 의 데코레이터 어휘와 형식적으로 어긋나지 않는다. 다만 ③ 항목이 정정하려는 DTO 데코레이터 규칙의 캐노니컬 예시가 `spec/conventions/swagger.md` 본문에는 여전히 부재해 SoT 가 `api-convention.md` 쪽으로만 쏠리는 문제, 그리고 "70 vs 16" 수치가 바로 그 `swagger.md` 자신이 같은 클래스의 실수(집계 기준 미기재)를 명시적으로 경고했음에도 재발한 문제가 WARNING 급으로 남는다. 두 사안 모두 draft 의 결론(§5.4 개정 필요성)을 뒤집지는 않으며, 후속 반영 전에 정정하면 된다. CRITICAL 급 — 명명 규약·출력 포맷 규약·문서 구조 규약(3섹션)·API 문서 규약을 직접 위반해 다른 시스템의 invariant 를 깨는 발견 — 은 없었다.

## 위험도

LOW
