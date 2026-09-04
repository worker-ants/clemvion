# 요구사항(Requirement) 리뷰 — Swagger DTO nullable 계약 거짓 9곳 + AST 가드 신설

## 검증 방법 (요약)

- `jest src/repo-guards/__tests__/swagger-dto-contract.spec.ts src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` 실행 → **2 suites, 48 tests 전부 PASS** (저장소 트리 무수정, 실행만).
- 스크래치 디렉터리(`/private/tmp/.../scratchpad/count-table.ts`)에 가드와 동일한 AST 로직을 독립 재구현해 `codebase/backend/src` 전체를 재스캔 — 저장소 파일은 전혀 건드리지 않음. 결과: `Api*` 필드 총 1,096개, `@Transform` 동반 18개(그중 null 축 괴리 1개=`workflowId`) — plan 문서·가드 docstring의 실측 수치와 **정확히 일치**.
- `redactStoredFieldsForResponse`(`shared/utils/redact-stored-error.ts`) 반환 타입과 `background-runs.service.ts`의 실제 객체 리터럴 조립 코드를 읽어, DTO 필드가 런타임에서도 항상 키가 존재함(`?:` 아님)을 확인.
- `class-validator@0.15.1`의 `IsOptional` 구현(`value !== null && value !== undefined`일 때만 검증)을 직접 열어 `llmConfigId: string | null` + `@IsOptional() @IsUUID()` 조합이 `null` 값에 대해 안전함을 확인.
- `spec/5-system/2-api-convention.md` §5.4, `spec/conventions/swagger.md` §1-3/§1-4, `spec/4-nodes/1-logic/12-background.md` 실측 대조.
- 뮤테이션/원복 불필요(저장소 파일을 고치지 않음). `git status --short` 최종 확인 — 리뷰 중 생성한 산출물(`review/code/...`) 외 잔여물 없음.

## 발견사항

- **[INFO]** `swagger-dto-contract-guard.ts`의 `readBooleanOption`은 `nullable`/`required` 값이 boolean 리터럴(`true`/`false`)일 때만 인식하고, 변수·상수 참조나 shorthand property(`{ nullable }`)는 `undefined`로 처리되어 조용히 "미선언"으로 판정된다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:59-74` (`readBooleanOption`)
  - 상세: 현재 저장소에서 `@ApiProperty`/`@ApiPropertyOptional` 인자로 `nullable:`/`required:`에 non-literal 값을 쓰는 사례는 0건(grep 확인)이라 지금 당장의 false negative는 없다. 다만 이 가드가 "전수 스캔" 을 표방하는 만큼, 향후 누군가 `nullable: SOME_CONST` 형태를 쓰면 가드가 조용히 통과시킨다.
  - 제안: 당장 수정 불필요(스코프 밖 회귀는 낮은 확률). 이런 패턴이 실제로 도입되면 그때 리터럴이 아닌 인자를 만났을 때 "판정 불가"로 별도 카운트하거나 throw 하는 방식으로 하드닝을 고려.

- **[INFO]** `spec-draft-nullable-notation-followups.md`의 "저장소 실측" 표(103/17/8/1=129)는 **이 커밋 자신의 DTO 수정 적용 전** 상태를 기술한다. 같은 커밋(`fefec2b27`)이 8곳(`background-run-response.dto.ts`)을 "row3(계약 거짓)" → "row2(의미상 옳음)"로 옮기고, `llmConfigId`가 TS 타입 수정으로 새로 "row1(TS-nullable 모집단)"에 편입되면서, 커밋 적용 **후** 실제 분포는 104/25/0/1 (합 130)로 바뀐다(스크래치 스크립트로 직접 재계산·확인). "§5.4 drift 103곳 배치" 후속 항목도 엄밀히는 이제 `llmConfigId` 1건이 새로 그 모집단에 들어가 104곳이 된다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` — "### 저장소 실측" 표(§③) 및 "## 후속" 체크리스트의 "§5.4 drift 103곳 배치" 항목.
  - 상세: 문서 자체가 "이 표를 두 번 틀렸다"는 자기수정 이력을 이미 담고 있고, 표는 §5.4 spec 결정의 근거(측정 시점 스냅샷)로 기능하며, "[x] 계약 거짓 9곳" 체크박스로 그 8+1건이 별도로 이미 처리됐음을 명시하고 있어 **읽는 사람을 실제로 오도할 위험은 낮다.** 다만 "103곳"이라는 숫자가 이 커밋 자체의 부수효과(`llmConfigId` 타입 수정)로 바로 다음 순간 정확하지 않게 된다는 점이 문서에 명시돼 있지 않다.
  - 제안: 코드 수정 불필요. 다음에 이 draft를 만지는 사람이 "§5.4 drift 103곳" 배치에 착수하기 전에 AST 가드로 재실측(104곳 예상)하도록 안내 문구를 하나 추가하면 충분 — 이는 `plan/` 문서 정정이라 developer 권한 내(§자기-반증형 소정정 조건 불필요, 단순 plan 갱신)이며 본 리뷰의 스코프 밖(코드 결함 아님)이므로 발견사항으로만 기록.

## 항목별 확인 결과 (문제 없음 — 근거만 기록)

- **`background-run-response.dto.ts`**: `@ApiPropertyOptional` → `@ApiProperty({ nullable: true })` 전환 8곳 전부 TS 타입이 이미 `| null`이었고(런타임도 `?? null`/`: null` 삼항으로 항상 키를 채움), `spec/4-nodes/1-logic/12-background.md`의 응답 예시(`"completedAt": null, "durationMs": null`)·필드 표(`completedAt: ISO8601 | null`, `durationMs: number | null`)와 line-level로 일치. §5.4 신규 문면("null 을 쓰는(상시 존재) 필드 → `@ApiProperty({nullable:true})` + `field: T | null`")과도 정확히 일치.
- **`create-assistant-session.dto.ts` `llmConfigId`**: 데코레이터(`@ApiPropertyOptional({nullable:true})`)는 이미 nullable을 선언했는데 TS 타입만 `string`(반대 방향 계약 거짓)이던 것을 `string | null`로 넓혀 정합화. 소비 코드(`workflow-assistant-session.service.ts:91` `dto.llmConfigId ?? null`)가 이미 null-safe했으므로 런타임 회귀 없음. `class-validator IsOptional`이 `null`/`undefined` 모두에서 하위 검증(`@IsUUID`)을 스킵함을 소스로 직접 확인.
- **`temp-fixture.ts` 추출**: `nullable-type-lie-cast.spec.ts`의 지역 함수를 공유 유틸로 옮긴 순수 리팩터. `withFiles`/`withFixture` 동작(tmpdir 생성 → 쓰기 → `try/finally` 정리)이 원본과 동일하고, 두 소비처(`nullable-type-lie-cast.spec.ts`의 `.entity.ts` 고정 래퍼, `swagger-dto-contract.spec.ts`의 `.dto.ts` 고정 래퍼)가 각각 올바르게 위임함을 확인.
- **`swagger-dto-contract-guard.ts` presence/null 축 판정 로직**: `effectiveRequired === tsOptional` → presence mismatch, `nullable !== tsNull && !hasTransform` → null mismatch. 두 로직 모두 spec.ts의 대조군 테스트(required 우선순위, 여러 줄 데코레이터에 준하는 화살표 함수 인자, 객체 리터럴 타입 내부 `;`, 중첩 `null`, `@Transform` 편도 면제)로 실측 검증되고 실제로 GREEN. `@Transform` 면제가 "허용목록이 아니라 원리"라는 주장도 실측(1,096개 중 18개 Transform 동반, 그중 1개만 null 축이 갈림)과 정확히 일치.
- **`swagger-dto-contract.spec.ts`**: `[전제]` 테스트로 스캔 대상 공허성(vacuous pass)을 방지하고 있고, `collectTsFiles(SRC_ROOT)`가 기본적으로 `.spec.ts`를 제외함을 소스로 확인 — "비-spec 전체" 모집단 주장과 일치.
- **`plan/in-progress/execution-engine-residual-gaps.md`**: G2 블로커 2·3 재실측 노트는 서술적 추가일 뿐 기능 변경이 없고, 인접 문맥(⛔ BLOCKED, defer 확정)과 모순되지 않음.
- **TODO/FIXME/HACK/XXX**: 변경된 6개 코드 파일 전수 grep — 0건.

## 요약

DTO 9곳의 "OpenAPI nullable 선언 vs TS 타입" 계약 거짓을 정공법(AST 파서 기반 가드 신설 + 실제 필드 수정)으로 고쳤고, 수정한 필드들은 런타임 조립 코드·spec 문서(§5.4 신규 문면, `12-background.md` 필드 표)와 line-level로 일치함을 직접 실행·소스 대조로 확인했다. 새 가드(`swagger-dto-contract-guard.ts`)의 presence/null 축 판정 로직은 대조군 테스트로 충분히 검증되고 실제로 저장소 전수(1,096 필드)에 대해 0 mismatch를 재현했다(독립 재구현 스크립트로도 동일 수치 확인). 발견된 두 건은 모두 INFO 수준으로, 하나는 현재 미노출 상태인 가드의 스코프 한계(non-literal `nullable`/`required` 값), 다른 하나는 같은 커밋의 부수효과로 plan 문서 수치(103곳)가 사실상 즉시 104곳으로 바뀌는 문서 신선도 이슈다 — 둘 다 코드 결함이 아니며 차단 사유가 아니다.

## 위험도
LOW
