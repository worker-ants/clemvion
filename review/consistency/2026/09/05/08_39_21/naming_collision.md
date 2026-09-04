# 신규 식별자 충돌 검토 — `spec-draft-numeric-wire-convention.md`

## 발견사항

없음.

target 문서는 실제로 **새 식별자를 거의 도입하지 않는다** — 요구사항 ID·엔티티/DTO명·API
endpoint·이벤트명·ENV var·config key 어느 것도 새로 만들지 않으며, 기존 두 spec 파일
(`spec/1-data-model.md`, `spec/conventions/swagger.md`)의 **기존 행·기존 섹션을 정정/보강**하는
것이 변경의 전부다. 점검 관점별로 확인한 내용:

1. **요구사항 ID 충돌** — 해당 없음. target 은 이 저장소가 쓰는 `§2.24`/`§2.25` 류의 신규
   섹션 번호를 부여하지 않는다. `1-data-model.md` 의 `§2.24 LlmUsageLog`(`cost_usd` 행,
   L851)와 `§2.25 AlertRule`(`threshold` 행, L873)은 **기존에 이미 그 번호로 존재**하고,
   target 은 그 두 행의 설명 문구만 바꾼다. 새 `§2.26` 등은 만들지 않는다.

2. **엔티티/타입명 충돌** — 해당 없음. `AlertRuleDto.threshold`, `StatisticsResponseDto.costUsd`,
   `findNumericAsNumber`, `alert-rule-response.dto.ts` 는 모두 코드베이스에 **이미 존재하는**
   이름을 그대로 인용한 것이고(`codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:353`
   에 `findNumericAsNumber` 실존 확인), target 이 새로 짓는 이름이 아니다.

3. **API endpoint 충돌** — 해당 없음. 새 endpoint 정의 없음.

4. **이벤트/메시지명 충돌** — 해당 없음.

5. **환경변수·설정키 충돌** — 해당 없음.

6. **파일 경로 충돌**
   - target 자신의 plan 파일 경로 `plan/in-progress/spec-draft-numeric-wire-convention.md` 는
     `plan/in-progress/`·`plan/complete/` 어디에도 동명 파일이 없다 — 신규 명명 컨벤션
     (`spec-draft-*`) 부합, 충돌 없음.
   - target 이 `swagger.md` 에 신설하는 `### 1-6. numeric/decimal 컬럼의 wire 타입` 섹션 번호는
     실측 결과 **비어 있다** — `swagger.md` 는 `### 1-5. writeOnly/readOnly` 다음이 곧바로
     `## 2) Controller 패턴` 이라 `1-6` 은 기존에 쓰인 적이 없다(`grep -n "^#\{1,4\} "
     spec/conventions/swagger.md` 로 헤딩 전수 확인). 저장소 내 `swagger.md#1-6-...` 앵커를
     선참조하는 문서도 없다(`grep -rn "swagger.md#" spec/ plan/` 결과에 `#1-6-` 없음) — 앞으로
     생길 앵커라 선점 충돌이 있을 수 없는 상태.
   - target 이 `swagger.md` §3 에 추가하는 "JSDoc 은 공개 OpenAPI 로 나간다" 단락은 독립된
     헤딩을 만들지 않는(소제목 없는 인용 단락) 구조라 앵커 충돌 자체가 성립하지 않는다.

## 요약

target 문서는 신규 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·ENV/config key 를 전혀
도입하지 않으며, 유일하게 "새로 생기는" 식별자인 `swagger.md` 의 `### 1-6` 섹션 번호는
실측상 비어 있는 자리(`1-5` 바로 다음, `## 2)` 바로 앞)이고 그 앵커를 선참조하는 기존 문서도
없어 충돌 여지가 없다. `1-data-model.md` 의 두 행(`§2.24 cost_usd`, `§2.25 threshold`)도
기존에 이미 그 번호로 존재하는 행의 설명 문구 정정이지 신규 등재가 아니다. 신규 식별자 충돌
관점에서는 대상이 사실상 "무해"하다.

## 위험도

NONE
