# 테스트(Testing) 코드 리뷰

## 리뷰 범위

`origin/main..HEAD` 누적 diff 기준, 테스트 관점에서 실질적으로 검토 대상인 것은 다음 3개
파일이다 (나머지 CHANGELOG.md·plan 문서·이전 라운드 review 산출물은 코드가 아니라 서술
문서라 테스트 관점 발견사항 없음):

1. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — 순수 로직에
   `readOption`(제네릭화) · `readStringOption` · `readColumnType` · `collectNumericFields` ·
   `collectDtoFieldTypes` · `scanNumericExposure` · `findNumericAsNumber` 신규.
2. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` — 위 신규 로직에
   대한 unit 테스트 대량 추가(약 20건).
3. `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts` — 신규 e2e, `POST → GET →
   PATCH` 세 응답의 `threshold` wire 타입을 실 HTTP 로 검증.

실행 확인: `swagger-dto-contract.spec.ts` 를 직접 `npx jest` 로 돌려 **33/33 PASS** 를
재현했다(로컬 실측, 2026-09-04). `tsc --noEmit` 도 돌렸는데 이 changeset 파일에서 나는
에러는 없었다 — `alerts-evaluator.service.spec.ts` 의 TS2353 은 `origin/main` 에 이미 있던
것으로 `git show origin/main:...` 대조로 확인, 이번 diff 밖.

## 발견사항

- **[WARNING]** `readOption` 의 "리터럴을 만날 때까지 계속 훑는다" 분기가 **`readStringOption`
  인스턴스에서는 캐너리로 고정되지 않았다** — `readBooleanOption`(→`required`) 경로만 고정
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:296`-`311`
    (canary `DUPLICATE_KEY`), 대응 프로덕션 코드
    `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:69`-`109`
    (`readOption`/`readBooleanOption`/`readStringOption`)
  - 상세: `readOption<T>` 은 이번 diff 에서 제네릭으로 승격돼 `readBooleanOption`
    (`required`/`nullable` 판정용)과 `readStringOption`(→`readColumnType`, `numeric`/`decimal`
    컬럼 판별용)이 **같은 순회·continue 로직을 공유**한다. 그런데 "같은 키가 중복되고
    앞엣것이 원하는 형태가 아니면 뒤엣것까지 훑는다" 는 동작을 검증하는 캐너리
    (`DUPLICATE_KEY` — `@ApiProperty({ required: dynamicRequired, required: false })`)는
    `readBooleanOption` 인스턴스 하나뿐이다. `readStringOption`(`readColumnType`) 쪽에는
    동등한 케이스(예: `@Column({ type: dynamicVar, type: 'numeric' })`)가 없다.
    `readColumnType` 이 첫 인자가 문자열 리터럴이면 그 값을 바로 쓰고, 아니면
    `readStringOption` 으로 위임하는 구조라 옵션 객체 안에 `type:` 키가 **중복**되는 형태만
    이 분기를 탄다 — 지금 있는 픽스처(중첩 객체·같은 줄·접근제한자·인접 데코레이터·
    포지셔널 인자)는 전부 `type:` 키가 **한 번**만 나오므로 `pick` 이 첫 시도에서 값을
    반환해 `continue` 분기를 밟지 않는다. 이 저장소는 "실사례 0건인 분기도 캐너리로
    고정한다" 원칙을 `@Transform` 예외·`readBooleanOption` 양쪽에 이미 적용해 왔는데
    (`swagger-dto-contract-guard.ts` 헤더 및 `readOption` JSDoc 참조), 같은 원칙이
    `readStringOption` 인스턴스에는 아직 적용되지 않았다. `pick` 콜백이 두 인스턴스에서
    서로 다르므로(`TrueKeyword`/`FalseKeyword` 판정 vs `isStringLiteralLike`), 한쪽 캐너리가
    다른 쪽의 회귀를 담보하지 않는다.
  - 제안: `swagger-dto-contract-guard.ts` 나 `.spec.ts` 에 `@Column({ type: someExpr, type:
    'numeric' })` 형태의 대조군 하나를 추가해 `readStringOption`/`readColumnType` 경로에서도
    "앞의 비-리터럴을 건너뛰고 뒤의 리터럴을 집는다" 를 직접 고정한다.

- **[INFO]** `[전제]` 테스트가 실제 프로덕션 스키마 값(`AlertRule.threshold`,
  `LlmUsageLog.costUsd`, `AlertRuleDto`)에 이름으로 결속돼 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:338`-`346`
  - 상세: `scanNumericExposure` 가 "스캔이 실제로 뭔가를 집었다" 는 전제를 검증하려고
    실재하는 엔티티·DTO 이름을 하드코딩한다. 의도된 설계(같은 파일의 JSDoc 이 "공허한
    `expect([]).toEqual([])` 방지" 근거를 명시)이지만, 이후 `AlertRule.threshold` 컬럼명이
    바뀌거나 `llm_usage_log` 의 numeric 컬럼이 제거되면 이 테스트가 **가드 로직과 무관하게**
    깨진다. 지금은 결함이 아니라 결합도 기록 차원의 참고 사항.
  - 제안: 조치 불요 — 향후 이 테스트가 실패하면 "가드가 깨졌다" 가 아니라 "전제 스키마가
    바뀌었다" 를 먼저 의심하라는 점을 테스트 실패 시 진단 순서로 기억해 두면 충분하다.

- **[INFO]** e2e 테스트가 `DELETE /api/alerts/:id` 응답은 다루지 않는다(범위 밖)
  - 위치: `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts:73`(단일 `it` 블록)
  - 상세: `threshold` wire 타입이라는 스코프에서는 자연스러운 배제다(`DELETE` 는 204
    No Content, body 없음). 지적이라기보다 스코프 확인 차원의 기록.
  - 제안: 조치 불요.

## 강점 (테스트 관점에서 특히 잘된 점)

- **정밀도 손실을 가르는 입력 선택**: `CREATED_THRESHOLD = 12.3456`, `PATCHED_THRESHOLD =
  7.0625` — `numeric(12,4)` 의 scale 을 꽉 채운 값으로, 이전 라운드에서 정수(`10`/`15`)를
  쓰다가 `Math.round`/`parseInt` 가 끼어들어도 통과하는 공허한 단언이었음을 실측으로
  잡고(`21_25_50` INFO#2) 고친 이력이 코드 주석에 남아 있다(`alerts-threshold-wire-type.e2e-
  spec.ts:60`-`70`). "생성 입력이 곧 커버리지" 원칙에 부합한다.
- **in-memory 응답과 DB 재조회를 모두 검증**: `POST`/`PATCH` 직후 응답(in-memory 엔티티)뿐
  아니라 이어지는 `GET /api/alerts` 로 DB 를 다시 읽어 문자열 값·소수부까지 대조한다
  (`:90`-`:97`, `:111`-`:117`) — "저장 경로에서 정밀도가 깎여도 in-memory 응답만 보면
  놓친다" 는 자각이 테스트 구조에 반영돼 있다.
- **"위반 0건" 의 공허성 방지**: `findNumericAsNumber` 의 저장소 전수 스캔 단언과 별개로,
  스캔이 실제로 뭔가를 집었다는 `[전제]` 테스트를 분리했다(`:323`-`:346`) — `ENTITY_DIR`/
  `RESPONSE_DTO_DIR` 뮤턴트가 저장소 단언만 GREEN 으로 살아남았던 실측(`20_39_25` W3)에
  대한 정확한 대응.
- **정규식 회귀 방지 캐너리 4종 + 포지셔널 인자 캐너리 2종**: 과거 정규식 구현에서 실제로
  놓쳤던 형태(중첩 객체·같은 줄·접근제한자·인접 데코레이터)와 AST 1차 구현에서 놓쳤던
  포지셔널 `@Column('numeric', {...})` 형태를 각각 `it.each` 로 개별 고정해, 향후 누군가
  구현을 되돌려도 스위트가 잡는다.
- **알려진 한계를 무해하다고 덮지 않고 명시 테스트로 고정**: `<Entity>Dto` 이름 관례를
  벗어난 `StatisticsResponseDto` 케이스를 "이 술어가 못 본다" 는 사실 그대로 테스트로 남겼다
  (`:473`-`:486`) — 거짓 안전감을 주지 않는다.
- **테스트 격리**: `withFiles`(tmpdir + `finally` cleanup, thenable 콜백 오용 시 명시적
  throw)와 e2e 의 `uniqueEmail`/`uniqueName` 생성기 모두 테스트 간 상태 공유가 없다. 저장소
  전반의 e2e 관례(다른 워크스페이스 생성 헬퍼와 동일 패턴)를 그대로 따른다.
- **테스트 용이성**: 프로덕션 로직이 `readOption`/`readColumnType`/`collectNumericFields`/
  `collectDtoFieldTypes`/`scanNumericExposure` 로 잘게 분리돼 있어 DI 없이도 각 함수를 직접
  단위 테스트할 수 있는 구조다.
- **회귀**: 로컬 재실행으로 `swagger-dto-contract.spec.ts` 33/33 PASS 확인. 리팩터
  (`readBooleanOption` → `readOption` 위임)가 기존 presence/null 축 테스트를 깨지 않았다.

## 요약

이번 changeset 의 테스트 추가(`numeric`/`decimal` 정적 가드 unit 테스트 약 20건 + `threshold`
wire 타입 e2e 1건)는 이 저장소가 축적해 온 "생성 입력이 곧 커버리지"·"공허한 단언 방지"·
"알려진 한계를 테스트로 고정" 관례를 충실히 따르며, 실제로 놓쳤던 정규식/포지셔널-인자
위음성을 각각 개별 캐너리로 재발 방지했다. 로컬 재실행으로 33/33 PASS 를 확인했고 `tsc`
에도 새 에러가 없다. 유일하게 실질적인 갭은 이번에 제네릭화된 `readOption` 의 "리터럴을
만날 때까지 훑는다" 분기가 `readBooleanOption` 인스턴스로만 캐너리 고정되고
`readStringOption`(`readColumnType`) 인스턴스에는 동등한 대조군이 없다는 점이다 — 공유
헬퍼의 각 인스턴스는 별도 표면이라는 이 저장소 자신의 원칙에서 보면 좁은 자리 하나가
남아 있다.

## 위험도

LOW
