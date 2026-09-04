# 테스트(Testing) 리뷰

## 리뷰 범위 및 방법

이번 changeset(`origin/main...HEAD`, 52개 파일)에서 테스트 관점의 실질 대상은 5개뿐이다 — 나머지
47개는 `review/code/**`·`review/consistency/**` 아래 이전 세 라운드(`19_43_18`·`20_16_17`·
`20_39_25`)와 consistency-check(`20_05_42`)의 산출물이 이 브랜치에 커밋된 것으로, 코드가 아니다.

- `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` — `threshold: number → string`
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — `findNumericAsNumber`/`scanNumericExposure`/`readColumnType`/`readOption` 축
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` — 위 축의 테스트 32건
- `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts` — 신규 e2e (POST→GET→PATCH)
- `CHANGELOG.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` — 문서(테스트 자체는 아님)

앞의 세 리뷰 라운드가 이미 이 축을 촘촘히(정규식→AST 전환, 경로 정규화, `[전제]` 프리미스 테스트,
e2e 신설 등) 다뤘으므로, 이번 라운드는 (1) 그 WARNING 들이 **현재 소스에** 실제로 반영돼 있는지
저장소를 직접 읽어 재확인하고 (2) 아직 아무도 짚지 않은 새 갭이 있는지 독립적으로 뮤테이션했다.

저장소 밖 scratch(`mktemp` 계열 디렉터리)에 `swagger-dto-contract-guard.ts` 원본을 `cp` 해 둔 뒤
저장소 파일을 1회 뮤테이션하고, `cp` 로 즉시 원복했다(`git diff --quiet` 로 clean 확인 완료).
`git checkout`/`restore` 는 쓰지 않았고, 저장소에 `*.bak` 등 잔여물을 남기지 않았다.

## 발견사항

- **[WARNING]** `readOption` 이 문서화한 "같은 키가 여러 번 나오면 리터럴이 아닌 첫 값을 건너뛰고
  계속 찾는다" 동작이 테스트 0건 — 뮤테이션으로 무방비 확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:61-85`
    (`readOption` 함수 및 그 JSDoc, 특히 `:65-67`의 설계 근거 서술과 `:81`
    `if (picked !== undefined) return picked;`)
  - 상세: 이 함수의 JSDoc 은 "`pick` 이 `undefined` 를 주면 계속 훑는다 — 같은 키가 여러 번
    나오고 앞의 것이 원하는 리터럴 형태가 아닐 때(`required: someVar` 뒤에 `required: true`)
    뒤엣것을 놓치지 않기 위해서다" 라는 구체적 설계 근거를 명시한다. 그런데
    `swagger-dto-contract.spec.ts` 전체(32건)에 이 분기 — 동일 데코레이터 인자 안에 같은 키가
    두 번 이상 나타나는 픽스처 — 를 겨누는 테스트가 없다. 직접 검증했다: `if (picked !==
    undefined) return picked;` 를 `return picked;` 로 바꿔(즉 "첫 매치가 리터럴이 아니어도
    그대로 반환한다"로 되돌려) `npx jest src/repo-guards/__tests__/swagger-dto-contract.spec.ts`
    를 돌리니 **32/32 GREEN — 회귀가 전혀 잡히지 않았다.** `cp` 로 즉시 원복해 `git diff --quiet`
    로 clean 확인했다. 이 저장소는 정확히 같은 성격의 0-실사례 분기(`@Transform` 예외, 파일
    상단 `:144-152`)에는 "실사례가 0 이어도 예외는 남긴다 … 분기가 죽지 않도록 대조군이
    양방향으로 고정한다"는 원칙을 명시적으로 세워 두고 실제로 캐너리 테스트를 붙여 뒀다 —
    `readOption` 의 이 분기만 같은 원칙을 적용받지 못했다.
  - 제안: `[전제]` 류 대조군 하나를 추가한다 — 예컨대
    `` @ApiProperty({ required: someExpr, required: true }) `` 같은 (문법적으로 유효한) 중복 키
    픽스처로 `readBooleanOption`(또는 `readStringOption`)이 두 번째 리터럴 값을 집는지 직접
    단언한다. 그런 픽스처를 만들기 어렵다면(중복 키를 prettier/eslint 가 거부하는 등), JSDoc 의
    해당 문단을 "이론상 방어이나 현재 검증되지 않음"으로 낮추는 편이 낫다 — 검증되지 않은 설계
    근거를 확정형 문장으로 남기면 다음 사람이 그 문장을 근거로 판단한다.

- **[INFO]** (재확인, 이미 해소됨) `19_43_18` W1 / `20_39_25` W4 — `AlertRuleDto.threshold` 의
  런타임 wire 타입을 되잡는 e2e 테스트가 이제 존재하고 구조도 견고하다
  - 위치: `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts` 전체
  - 상세: `POST`(생성, in-memory 응답) → `GET`(DB 재조회, `numeric(12,4)` 스케일까지
    `/^\d+\.\d{4}$/` 로 형식 검증) → `PATCH`(in-memory 응답, 형식 검증은 생략하고 `typeof`+
    `Number(...)` 만 확인) 세 응답을 실 HTTP 로 대조한다. `PATCH` 응답이 DB round-trip 을 거치지
    않아 `"15"`처럼 스케일 없는 문자열일 수 있다는 것까지 주석으로 명시하고 그에 맞춰 단언
    강도를 조절한 점이 정확하다 — `alerts.service.ts:39-58`(`update()`)를 직접 대조한 결과,
    `entity.threshold = String(dto.threshold)` 후 바로 `save()` 하므로 DB 의 numeric scale
    포맷팅이 응답에 실리지 않는다는 테스트의 전제가 맞다. 값뿐 아니라 타입까지
    (`typeof === 'string'`) 확인해 "무엇을 담아도 통과하는 공허한 단언"을 피했다.
    `registerAndLogin`/`createTeamWorkspace`/`uniqueEmail`/`uniqueName` 헬퍼 시그니처와 실제
    호출부를 대조했고 일치한다 — 다른 e2e 스펙과 같은 격리 패턴(무작위 접미사, 자체
    `db`/`beforeAll`/`afterAll`)이라 테스트 간 의존성 없음.
  - 제안: 없음(조치 완료 확인).

- **[INFO]** (재확인, 이미 해소됨) `20_39_25` W3 — 저장소 전수 스캔 단언의 "위반 없음" vs
  "애초에 스캔 안 됨" 구분 불가 문제
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:359-418`
    (`scanNumericExposure` 가 `numericColumns`/`responseDtoClasses` 를 함께 반환),
    `swagger-dto-contract.spec.ts:308-316` (`[전제] 스캔이 실재하는 numeric 컬럼과 응답 DTO 를
    집는다`)
  - 상세: `scanNumericExposure` 가 위반 목록뿐 아니라 실제로 무엇을 스캔했는지
    (`numericColumns`/`responseDtoClasses`)를 함께 돌려주고, `[전제]` 테스트가 `AlertRule.threshold`·
    `LlmUsageLog.costUsd`·`AlertRuleDto` 가 실제로 집혔는지 **엔티티 축과 DTO 축을 각각**
    단언한다. `ENTITY_DIR`/`RESPONSE_DTO_DIR` 를 존재하지 않는 경로로 바꾸면 이 `[전제]` 가
    직접 RED 를 내는 구조로 바뀌어 있음을 코드 읽기로 확인했다(직전 라운드의 예측/실측 표와
    코드 구조가 일치).
  - 제안: 없음(조치 완료 확인).

- **[INFO]** (재확인, 여전히 유효한 기지정 갭) `collectNumericFields`/`collectDtoFieldTypes` 가
  `extends`/`PickType`/`OmitType` 합성 필드를 못 본다 — `20_39_25` testing.md 가 이미 INFO 로
  등재하고 미조치로 남긴 항목, 이번 라운드에도 변화 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:296-317`
    (`collectNumericFields`), `:320-339`(`collectDtoFieldTypes`) — 둘 다 `node.members` 만
    순회해 클래스가 **직접 선언한** 필드만 본다
  - 상세: 저장소 현재 상태를 재확인한 결과 이 사각지대를 겨누는 캐너리(예: `<Entity>Dto` 이름
    관례 한계처럼 "[알려진 한계]" 로 명시하는 테스트)는 여전히 없다. 실사례 0건(`AlertRuleDto`
    는 `extends` 없이 직접 필드 선언)이라 CRITICAL/WARNING 은 아니지만, 위 `readOption` 항목과
    같은 성격 — "0 실사례 분기에도 이 파일은 대체로 캐너리를 남기는데 이 자리는 예외" — 이라
    함께 처리하면 일관성이 좋아진다.
  - 제안: 이전 라운드 제안대로 `[알려진 한계]` 캐너리 1건 추가를 후속으로 유지.

## 검증 절차 (재현 가능)

1. `npx jest src/repo-guards/__tests__/swagger-dto-contract.spec.ts` (원본) → **32 passed, 32
   total**.
2. `readOption` 의 `if (picked !== undefined) return picked;` → `return picked;` 로 뮤테이션(
   저장소 파일 직접 수정, 원본은 scratch 에 `cp` 보관) → 재실행 → **32 passed, 32 total (무변화)**
   — 위 WARNING 의 근거.
3. `cp` 로 즉시 원복 → `git diff --quiet -- codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` → 종료 코드 0(clean) 확인. `git status --short` 최종 확인 결과 이 리뷰
   세션 산출물(`review/code/2026/09/04/21_10_30/`) 외 잔여물 없음.
4. `alerts.controller.ts`/`alerts.service.ts`/`alert-rule.dto.ts` 를 직접 읽어 e2e 테스트의
   전제(POST/PATCH 는 in-memory 응답, GET 은 DB 재조회, PATCH 는 스케일 미포함 가능)가 실제
   구현과 일치함을 확인.

## 요약

`AlertRuleDto.threshold` 결함 자체와 그 재발 방지(`findNumericAsNumber` 축 + e2e)는 세 라운드에
걸쳐 반복 검증됐고, 이번 라운드에서 직접 재현한 결과 이전에 지적된 WARNING(런타임 계약 테스트
부재·전제 테스트 부재)은 모두 현재 소스에 정확히 반영돼 있다 — 32/32 GREEN, e2e 파일 구조도
견고하다. 다만 독립 뮤테이션으로 새 갭 하나를 확인했다 — `readOption` 이 JSDoc 으로 명시한
"동일 키 중복 시 리터럴인 값을 계속 찾는다"는 설계 근거가 테스트로 전혀 뒷받침되지 않으며, 그
분기를 제거해도 스위트 전체가 그대로 GREEN 이다. 이 파일 자신이 이미 세운 "실사례 0건이어도
분기를 캐너리로 고정한다"는 원칙(`@Transform` 예외)과 내적으로 불일치한다. 그 외 코드 변경
(`threshold` 타입 정정) 자체에는 결함이 없고, 기존 테스트를 깨는 변경도 없다.

## 위험도

LOW
