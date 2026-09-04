# 요구사항(Requirement) 리뷰 — Swagger DTO nullable 계약 거짓 9곳 + AST 가드 (2R, 후속 커밋 포함)

## 검증 방법 (요약)

- `origin/main...HEAD` 전체(커밋 9개, `fefec2b27`~`4be1249f1`)를 diff 로 확인. 핵심 코드 변경은
  `fefec2b27`(DTO 9곳 + 가드 신설)과 `59f83058e`/`27d85e74c`/`a3111ab57`(직전 code-review
  세션 `11_02_30` 의 WARNING 5건 fix)이고, 나머지는 plan/CHANGELOG/review 산출물 커밋이다.
- 저장소 트리 **무수정** — 실제 파일(`swagger-dto-contract-guard.ts`, `temp-fixture.ts`,
  `background-run-response.dto.ts`, `create-assistant-session.dto.ts`,
  `nullable-type-lie-cast-guard.ts`, `create-assistant-session.dto.ts` 소비처)을 `Read` 로 직접
  열어 diff 가 아니라 **현재 실제 상태**를 확인했다.
- `npx jest src/repo-guards/__tests__/swagger-dto-contract.spec.ts
  src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts
  src/common/__test-utils__/temp-fixture.spec.ts` 를 직접 실행(뮤테이션 없이 실행만) —
  **3 suites / 56 tests 전부 PASS**, 저장소 전수 스캔(`findSwaggerContractMismatches`)이
  실제로 `[]` 를 반환함을 재확인.
- `class-validator@0.15.1` 의 `IsOptional` 구현(`node_modules/class-validator/cjs/decorator/common/IsOptional.js`)을
  직접 열어 `value !== null && value !== undefined` 조건을 확인 — `llmConfigId: string | null`
  + `@IsOptional() @IsUUID()` 조합이 `null` 에 대해 하위 검증을 스킵함을 소스로 재검증(직전 리뷰의
  주장을 재실측으로 재확인).
- `background-runs.service.ts` 의 실제 응답 조립 코드(`toNodeExecutionDto`,
  `redactStoredFieldsForResponse` 반환 타입)를 읽어 8필드가 런타임에서 **항상 키를 채움**
  (`?? null` / 삼항으로 `undefined` 가 나올 경로 없음)을 확인 — `required: true` 전환이 실제
  wire 동작과 일치.
- `spec/5-system/2-api-convention.md` §5.4(라인 175-203)·`spec/conventions/swagger.md` §1-4(라인
  85-120, `Rationale` 408-424)를 직접 열어 정본 문면과 diff 를 line-level 대조.
- `git status --short` 로 최종 확인 — **본 세션이 만든 잔여물 없음**. 단, 세션 도중 내가
  건드리지 않은 파일 하나가 로컬에서 변경 상태로 관측됨(아래 발견사항 참조 — 병렬 세션 오염
  의심, 보고만 하고 원복하지 않았음).

## 발견사항

- **[INFO]** `spec-draft-nullable-notation-followups.md` 안에 "몇 곳이 아직 새 §5.4 문면과
  어긋나는가" 를 서술하는 두 자리가 이번 세션 안에서 **서로 다른 수를 말한다**
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` — "### 마이그레이션은
    이 문서가 강제하지 않는다" 절의 첫 문장(`정정하면 기존 103 + 8 = 111곳이 새 문면과
    어긋난다...`) vs 그 아래 "## 후속" 체크리스트의 "§5.4 drift 배치" 항목
    (`계약 거짓 9곳 수정 후 **104곳** — 착수 시 재측정할 것`).
  - 상세: 이번 세션(같은 PR)이 두 자리를 **같은 커밋**(`2bd48a38b`)에서 함께 갱신했다 —
    "103+8=111곳" 은 101+8=109 에서 숫자만 교체된 것이고, 체크리스트의 "104곳" 은 별도로
    "계약 거짓 9곳 수정 후" 라는 시점 조건을 명시해 정정했다. 그런데 "111곳" 문장 자신은
    "8곳" 이 이미 이 PR(`fefec2b27`) 에서 고쳐졌다는 사실을 반영하지 않은 채, 마치 111곳
    **전부**가 여전히 마이그레이션 대상인 것처럼 읽힌다 — 바로 위 "저장소 실측" 표에는
    "이 표는 계약 거짓 9곳 수정 적용 *전* 스냅샷이다... 적용 후는 104/25/0/1" 이라는 명시적
    caveat 이 붙어 있는데, 이 문단에는 같은 caveat 이 없다. 체크리스트를 읽으면 104곳이
    맞는 수라는 것을 알 수 있지만, "마이그레이션은 이 문서가 강제하지 않는다" 절만 읽는
    사람은 111곳(이미 고쳐진 8곳 포함)을 아직 손대야 할 작업량으로 오인할 수 있다.
  - 제안: 코드 수정 불필요(plan 문서, developer 권한 내 사실 정정). "정정하면 기존 103+8=111곳"
    문장 뒤에 "(8곳은 이 PR 에서 이미 정정 — 잔여는 103+1=104곳)" 정도의 한 줄을 보태거나,
    체크리스트가 이미 쓰는 "104곳" 표현으로 이 문단도 맞춘다.

- **[INFO]** (절차 관측, 코드 결함 아님) `review/consistency/2026/09/04/11_33_21/SUMMARY.md` 가
  본 리뷰 세션 진행 중 로컬에서 **커밋된 내용과 다른 상태로 변경됨**을 관측했다
  - 위치: `review/consistency/2026/09/04/11_33_21/SUMMARY.md`
  - 상세: 본 리뷰는 이 파일을 프롬프트 diff(파일 27, 커밋 `4be1249f1`)로만 읽고 저장소 트리에
    **쓰지 않았다**. 그런데 검증 도중 `git status --short` 를 찍어 보니 이 파일이 `M`
    (수정됨)으로 나타났다 — 내용은 같은 결론(BLOCK:NO, WARNING 2건, 동일 W1/W2)을 다른
    포맷("Consistency SUMMARY" → "Consistency Check 통합 보고서")으로 다시 쓴 것으로 보여
    실질적 판정 변화는 없어 보이지만, 병렬로 같은 워크트리를 쓰는 다른 세션/에이전트가 이
    파일을 재생성했을 가능성이 있다. 규약에 따라 `git checkout`/`git restore` 로 원복하지
    않았다 — 그 자체가 다른 세션의 미커밋 작업을 지울 수 있어서다.
  - 제안: 오케스트레이터가 이 세션 종료 후 `git status`/`git diff` 로 실제 원인(동시 실행
    중이던 다른 리뷰/컨시스턴시 세션인지)을 확인. 코드 리뷰 결론에는 영향 없음.

## 항목별 확인 결과 (문제 없음 — 근거만 기록)

- **`swagger-dto-contract-guard.ts` presence/null 축 판정**: `effectiveRequired === tsOptional`
  (presence)·`nullable !== tsNull && !hasTransform`(null) 두 식 모두 §5.4 문면("required 는
  TS `?` 와 정반대", "`nullable:true` 는 TS 최상위 `| null` 과 일치")을 정확히 구현한다.
  `readBooleanOption` 의 "인자가 데코레이터 이름을 이긴다" 우선순위, `hasTopLevelNull` 의
  "최상위만" 제약, `@Transform` 예외의 편도(null 축만) 적용 모두 대조군 테스트로 실측
  검증되고 실제로 GREEN 이다(직접 실행 재확인).
- **W1(별칭 가정 캐너리)**: `swagger-dto-contract.spec.ts` 하단 `[캐너리] @nestjs/swagger
  별칭 가정이 살아있는가` 가 실제 `ApiPropertyOptional()`/`ApiProperty({required:false})`
  를 호출해 `Reflect` 메타데이터를 비교한다 — 가정이 아니라 라이브러리 실측이다.
- **W3(경로 정규화)**: `nullable-type-lie-cast-guard.ts` 세 함수(`findCastOffenders`·
  `findUntypedNullableColumns`·`findStaleSpecCasts`) 전부 `.split(path.sep).join('/')` 가
  적용됨을 직접 확인 — RESOLUTION.md 의 "네 자리 동시 수정" 주장과 실제 코드가 일치.
- **W4(async 오용 하드닝)**: `temp-fixture.ts` 의 `withFiles` 가 `isThenable` 로 콜백 반환값을
  검사해 thenable 이면 `try` 블록 안에서 명시적으로 throw 하고, `finally` 의 `rmSync` 가
  (throw 경로 포함) 항상 실행됨을 코드·테스트(`temp-fixture.spec.ts`) 양쪽으로 확인.
- **W5(line/file 단언)**: `[대조군] 실패 위치(line/file) 보고` 테스트가 실제 줄 번호(3)와
  파일명(`probe.dto.ts`)을 `toMatchObject` 로 직접 단언 — 데코레이터 포함 위치가 `line` 이
  된다는 사실까지 픽스처로 고정돼 있고 실제로 통과.
- **`background-run-response.dto.ts` 8필드**: 런타임 조립 코드(`background-runs.service.ts`)가
  전부 `?? null`/삼항으로 키를 항상 채움을 확인 — `@ApiPropertyOptional`→
  `@ApiProperty({nullable:true})` 전환(`required:false→true`)이 실제 wire 동작과 정확히
  일치. `redactStoredFieldsForResponse` 반환 타입도 `inputData`/`outputData`/`error` 세
  키를 항상 포함(옵셔널 아님)하도록 선언돼 있어 object-spread 가 조용히 키를 생략할 가능성이
  없음을 재확인(과거 "object spread 가 fresh literal 을 widening" 실패 클래스가 여기서는
  재발하지 않음).
- **`create-assistant-session.dto.ts` `llmConfigId`**: `@IsOptional()` 이 `null`/`undefined`
  둘 다에서 하위 `@IsUUID()` 를 스킵함을 `class-validator` 소스로 직접 확인. 소비처
  (`workflow-assistant-session.service.ts:91` `dto.llmConfigId ?? null`)도 이미 null-safe.
- **CHANGELOG `llmConfigId` 절**: "§5.4 를 따랐다" 는 이전 표현이 제거되고, §5.4 가
  `## 5. 응답 형식` 하위 절(spec 원문 확인: 라인 115/175)이며 본문이 "**응답** 안에 섞여도
  무방하나" 로 응답 바디를 전제한다는 정확한 인용으로 대체돼 있다 — spec 원문과 line-level
  일치.
- **plan 참조 hygiene**: `source-scan.ts:190`·`nullable-type-lie-cast.spec.ts:22` 모두
  `plan/complete/entity-nullable-column-type-mismatch.md`(실존 확인) + 실제 후속 추적처
  (`spec-draft-nullable-notation-followups.md` §5.4 drift 배치)로 정정돼 있고, 두 서술이
  가리키는 파일이 실제로 그 경로에 존재/부재함을 `ls` 로 직접 확인.
- **TODO/FIXME/HACK/XXX**: `git diff origin/main...HEAD -- codebase/` 전수 grep — 0건.
- **회귀 없음**: 직접 실행한 3개 spec 파일(56 테스트) 전부 GREEN, RESOLUTION.md 가 주장하는
  전체 스위트 결과(445 suites/9310 tests)와 모순되는 징후 없음.

## 요약

핵심 요구사항(§5.4 부재 표현 규칙을 실제 코드에 구현 + 재발 방지 AST 가드 신설)은 spec
원문과 line-level 로 정확히 일치하며, 직전 code-review 세션(`11_02_30`)이 지적한 WARNING
5건(W1~W5)이 이번 diff 에서 전부 실제로 고쳐졌음을 코드를 직접 열어 재검증했다 — 캐너리
테스트·경로 정규화 4자리·async 하드닝·line/file 단언 모두 주장과 실측이 일치한다. 직전
consistency 세션(`11_33_21`)이 지적한 WARNING 2건(낡은 plan 참조, §5.4 요청 DTO 인용)도
CHANGELOG 문구 정정 + plan 문서 갱신 + planner 백로그 등재로 적절히 처리됐다. 유일하게 새로
발견한 것은 plan 문서 안에서 "111곳"(구형 총계, 이미 고쳐진 8곳을 포함한 채 갱신되지 않음)과
"104곳"(체크리스트가 쓰는 갱신된 잔여치)이 같은 문서 안에서 병존하는 INFO 급 서술
불일치이며, 코드 결함이 아니다. 별도로 리뷰 도중 본 세션이 만들지 않은 파일 변경
(`review/consistency/.../SUMMARY.md`)을 관측해 절차상 기록했다 — 원복은 시도하지 않았다.
CRITICAL·WARNING 급 요구사항 결함은 발견되지 않았다.

## 위험도

LOW
