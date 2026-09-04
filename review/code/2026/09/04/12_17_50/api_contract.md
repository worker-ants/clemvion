# API 계약(API Contract) 리뷰

## 검증 방법 (요약)

- `background-run-response.dto.ts`·`create-assistant-session.dto.ts` 현재 전체 파일을 직접 열어 diff 뒤 최종 상태를 확인 (저장소 무수정, 읽기만).
- 신설 가드 `swagger-dto-contract-guard.ts` 전체(176줄)를 직접 읽고 `readBooleanOption`/`hasTopLevelNull`/`effectiveRequired` 판정 로직, 그리고 이전 라운드에서 지적된 경로 정규화(`toPosixRelative`) 적용 여부를 확인.
- `spec/5-system/2-api-convention.md` §5.4 본문을 직접 열어 "응답 형식" 절 하위 규칙임과 표(선례) 대조.
- 이 브랜치의 직전 두 리뷰 라운드(`review/code/2026/09/04/11_02_30/api_contract.md`, `11_44_16/api_contract.md`) 산출물을 판독해 이미 다뤄진 항목과 새 항목을 구분.
- 뮤테이션 불필요(저장소 파일 무수정). `git status --short` 로 잔여물 없음 확인.

## 발견사항

- **[INFO]** `BackgroundRunNodeExecutionDto`/`BackgroundRunResponseDto` 계열 응답 필드 8개의 OpenAPI `required` 가 `false → true` 로 전환된다 — 방향은 계약을 "넓히는" 것이 아니라 "정확화"하는 쪽이라 런타임 breaking 은 아니지만, 엄격한 OpenAPI 코드제너레이터 소비자에게는 생성 타입이 바뀐다
  - 위치: `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts:43`(`finishedAt`), `:46`(`durationMs`), `:49-55`(`inputData`), `:58-64`(`outputData`), `:67-73`(`error`), `:84-87`(`nextCursor`), `:142-143`(`completedAt`), `:145-149`(`durationMs`, `BackgroundRunResponseDto`)
  - 상세: `@ApiPropertyOptional` → `@ApiProperty({ nullable: true })` 로 8필드 전부 전환됐다. 직접 읽은 현재 파일 기준으로 TS 타입은 diff 이전부터 이미 전부 `T | null`(옵셔널 `?` 아님)이었고, 이번 변경은 OpenAPI 선언을 TS 실제 타입·wire 동작에 맞춘 것이다. `spec/5-system/2-api-convention.md` §5.4 규칙("`null` 을 쓰는 상시 존재 필드 → `@ApiProperty({nullable:true})` + `field: T | null`")과 정확히 일치한다. `CHANGELOG.md` 에 방향(이전 두 자매 항목과 반대로 "좁히는" 쪽)까지 명시돼 소비자에게 고지됐다.
  - 제안: 코드 수정 불요 — 이미 CHANGELOG 로 고지됨. 외부 SDK/코드젠 소비자가 실재하면 배포 노트에도 남기는 정도면 충분.

- **[INFO]** `CreateAssistantSessionDto.llmConfigId` 요청 DTO 타입이 `string?` → `string | null` 로 넓어졌다 — OpenAPI 출력·요청 검증 동작 변화 없음
  - 위치: `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts:12-19`
  - 상세: 현재 파일을 직접 확인 — `@ApiPropertyOptional({ nullable: true })` 데코레이터는 diff 이전부터 그 값이었고, `@IsOptional()` 은 `null`/`undefined` 모두에서 `@IsUUID()` 검증을 스킵하므로(class-validator 구현) `null` 요청 바디는 이 변경 전에도 이미 수락되고 있었다. 생성된 OpenAPI 스키마는 변하지 않는다 — TS 컴파일 타임 타입만 실제를 뒤늦게 따라잡았다.
  - 제안: 없음(교정 완료로 충분).

- **[INFO]** 신설 가드 `swagger-dto-contract-guard.ts` 의 `readBooleanOption` 이 boolean 리터럴(`true`/`false`)만 인식하고, 상수 참조·shorthand property 는 조용히 "미선언" 처리된다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:58-74` (`readBooleanOption`)
  - 상세: 직접 코드를 읽어 확인 — `prop.initializer.kind === ts.SyntaxKind.TrueKeyword/FalseKeyword` 만 매칭한다. `nullable: SOME_CONST` 형태가 오면 `undefined` 가 반환되어 presence 축은 데코레이터 이름 기본값으로, null 축은 `false` 로 취급돼 실제 불일치를 놓칠 수 있다. 저장소 전수(1,096개 `Api*` 필드) 에는 현재 이런 non-literal 사례가 없다고 두 차례 선행 리뷰가 실측했다 — 지금 당장의 위음성은 없다. 이 가드 자체가 이번 diff 로 신설된 API 계약 거버넌스 자산이라, 이 갭은 회귀가 아니라 신규 자산의 알려진 한계다.
  - 제안: 급하지 않음. non-literal 값을 만나면 "판정 불가"로 별도 표시/카운트하거나 throw 하는 하드닝을 향후 고려.

- **[INFO]** DTO 스키마 교정(9곳)에 대응하는 API 버전 분기·헤더 마킹이 없음 — 정합화 성격상 필수는 아님
  - 위치: `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts` 전체, `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts:12-19`
  - 상세: 저장소에 명시적 API 버전 관리 체계(`v1`/`v2` 경로 분기 등)가 이 diff 범위에서 확인되지 않는다. 변경이 계약을 "좁히는" 것이 아니라 실제 wire 동작에 문서를 맞추는 "정합화"이므로 버전 분기가 필수라고 보지 않는다. `spec/5-system/2-api-convention.md` §5.4 자체도 "이미 문서화된 필드는 소급 요구하지 않는다"는 전제를 갖고 있어, 스키마 교정류 변경에 버전 분기를 요구하는 문면은 없다.
  - 제안: 이번 PR 을 막을 사안 아님. 프로젝트에 별도 API 버전 정책이 성문화되면 이런 "계약 거짓 교정"류가 그 정책의 예외로 명시돼 있는지만 추후 확인.

- **[INFO]** `spec/5-system/2-api-convention.md` §5.4 규칙이 "응답 형식" 절 하위임을 직접 확인 — `llmConfigId`(요청 DTO)에 그 규칙을 문면 그대로 적용하는 것은 스코프 밖이나, `CHANGELOG.md`/plan 문서가 이를 인지하고 별도 근거(PATCH tri-state·워크스페이스 기본값 폴백 등가성)로 정당화하고 있음을 확인
  - 위치: `spec/5-system/2-api-convention.md:115,175-195`, `CHANGELOG.md`(`llmConfigId` 섹션)
  - 상세: §5.4 는 "## 5. 응답 형식" 의 하위 절이고 본문도 "한 **응답** 안에 섞여도 무방하나" 로 응답 바디를 전제한다. `llmConfigId` 는 요청 DTO 이므로 이 규칙이 형식적으로 그대로 적용되는 자리는 아니며, CHANGELOG 는 이를 스스로 인지하고 "키 생략과 명시적 null 이 둘 다 워크스페이스 기본값 사용으로 수렴하므로 optional+nullable 조합이 정당하다"는 별도 근거를 댄다 — §5.4 문면을 오적용하지 않고 응답/요청을 구분해 서술한 점은 API 계약 관점에서 정확하다. §5.4 본문 자체에 "응답 바디 한정" 을 명시하는 후속 작업은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 등재돼 있어 별도 지적 불필요.
  - 제안: 없음 — 이미 추적 중.

## 항목별 확인 결과 (문제 없음 — 근거만 기록)

- `swagger-dto-contract-guard.ts` 의 presence/null 축 판정(`effectiveRequired === tsOptional`, `nullable !== tsNull`)과 `@Transform` 예외 — 직접 읽어 로직을 재구성한 결과 §5.4 규칙과 정확히 대응한다. 경로 정규화(`toPosixRelative`)도 형제 가드와 통일돼 있어 이전 라운드(`11_02_30`)가 지적한 WARNING(정규화 누락)이 실제로 고쳐져 있음을 직접 확인했다.
- `BackgroundRunNodeExecutionsPageDto`(cursor 기반 페이지네이션: `data`/`nextCursor`/`hasMore`)는 이번 diff 에서 필드 구성·페이지네이션 방식 자체는 바뀌지 않았다 — `nextCursor` 의 `nullable: true` 선언만 추가됐고 §8.2 선례("없으면 null")와 일치한다.
- 컨트롤러·라우트·인증 가드는 이번 diff 범위에 없다 — DTO(데코레이터·타입 선언)만 변경되어 인증/인가·URL 설계 축에는 영향이 없다.

## 요약

이번 diff 의 실질 API 계약 표면은 두 DTO 파일(`background-run-response.dto.ts` 8필드, `create-assistant-session.dto.ts` `llmConfigId` 1필드)로 좁고, 둘 다 "OpenAPI 선언과 TS 타입이 서로 다른 말을 하던" 기존 계약 거짓을 실제 wire 동작·spec 문서(§5.4)에 맞춰 정정하는 성격이다. 직접 소스를 열어 대조한 결과 요청 검증(`@IsOptional`+`@IsUUID`)·응답 조립 로직은 바뀌지 않았고, `background-run-response.dto.ts` 8필드의 `required: false→true` 전환만이 엄격한 코드제너레이터 소비자에게 유일하게 관측 가능한 영향이며 CHANGELOG 에 방향·영향과 함께 명시적으로 고지됐다. 이 축을 지속 강제하는 AST 기반 repo-guard(`swagger-dto-contract-guard.ts`/`.spec.ts`)가 신설돼 향후 유사 OpenAPI-TS 불일치를 CI 에서 원천 차단하며, 이전 두 리뷰 라운드에서 지적된 경로 정규화 누락(WARNING)은 실제로 고쳐져 있음을 직접 확인했다. 페이지네이션·URL 설계·인증/인가 축은 이 diff 범위 밖(컨트롤러 무변경)이라 영향 없음. CRITICAL/WARNING 급 결함은 발견되지 않았고, 남은 항목(가드의 non-literal boolean 미판정, 버전 분기 부재)은 전부 현재 실사례 0건이거나 정책상 필수가 아닌 방어적 관찰(INFO)이다.

## 위험도

LOW
