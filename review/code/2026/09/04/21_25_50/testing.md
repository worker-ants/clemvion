# 테스트(Testing) 코드 리뷰

## 범위 확인

이번 changeset(`origin/main...HEAD`)에서 테스트 관점의 실질 대상은 여전히 다음 5개뿐이다 —
나머지는 `review/code/**`·`review/consistency/**` 아래 이전 네 라운드(`19_43_18`·`20_16_17`·
`20_39_25`·`21_10_30`)와 consistency-check(`20_05_42`)의 산출물이 이 브랜치에 이미 커밋된
것으로, 코드가 아니다.

1. `CHANGELOG.md` — 문서
2. `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` — `threshold: number → string`
3. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — `findSwaggerContractMismatches`/`findNumericAsNumber`/`scanNumericExposure`/`readOption`
4. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` — 위 축의 회귀 테스트 33건
5. `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts` — 신규 e2e (POST→GET→PATCH)
6. `plan/in-progress/spec-draft-nullable-notation-followups.md` — 계획 문서(코드 아님)

직전 라운드(`21_10_30`)가 WARNING 2건(`readOption` 무방비 분기·plan 서술 재부모화)을 실측
뮤테이션으로 발견했고, 그 직후 커밋(`40005a6e0`)이 둘 다 조치했다. 이번 라운드는 (1) 그 조치가
현재 소스에 실제로 반영돼 있는지 직접 재확인하고 (2) 아직 아무도 짚지 않은 새 갭이 있는지
독립적으로 점검했다. 저장소 파일은 **읽기만** 했고 뮤테이션하지 않았다 — `npx jest`
실행만으로 확인 가능한 항목이라 저장소 트리를 건드릴 필요가 없었다(`git status --short` 로
변경 없음 확인).

## 발견사항

- **[INFO]** (재확인, 이미 해소됨) `21_10_30` W1 — `readOption` 이 문서화한 "리터럴을 만날 때까지
  계속 훑는다" 분기를 무는 캐너리가 이제 존재한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` —
    `describe('옵션 리더는 리터럴을 만날 때까지 훑는다', ...)` 블록(파일 내 `readOption`
    JSDoc 서술 바로 아래, `swagger-dto-contract-guard.ts:61-85`가 그 대상 로직)
  - 상세: 동일 키가 두 번 나오고 앞의 것이 비-리터럴(`declare const dynamicRequired: boolean`)인
    픽스처로 뒤의 리터럴(`required: false`)을 집는지 직접 단언한다. `npx jest
    src/repo-guards/__tests__/swagger-dto-contract.spec.ts` 를 재실행해 **33 passed, 33 total**
    확인(직전 라운드 32 + 캐너리 1). 이 캐너리가 없으면 `if (picked !== undefined) return
    picked;` → `return picked;` 뮤테이션에도 스위트 전체가 GREEN 이었다는 것이 직전 라운드의
    실측이었다 — 지금은 그 뮤턴트를 죽이는 테스트가 존재한다(직전 라운드가 이미 재현·확정했으므로
    본 라운드에서 재뮤테이션은 생략).
  - 제안: 없음(조치 완료 확인).

- **[INFO]** e2e 신규 파일이 `jest-e2e.json` 의 `testRegex`(`.e2e-spec.ts$`)와 일치해 실제로
  수집·실행됨을 확인
  - 위치: `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts`(파일명),
    `codebase/backend/test/jest-e2e.json`
  - 상세: 새 e2e 스펙이 명명 규칙을 지켜 CI e2e 스테이지에서 실제로 픽업된다는 것을
    `jest-e2e.json` 을 직접 열어 확인했다. 회귀 테스트가 "존재하지만 아무도 실행 안 한다"는
    형태의 위장 커버리지가 아니다.
  - 제안: 없음(조치 불요, 확인용 INFO).

- **[INFO]** e2e 테스트가 예시로 쓰는 `threshold` 값이 전부 **소수부 없는 정수**(`10`, `15`)라
  `numeric(12,4)` 스케일 포맷팅을 형식적으로만 확인한다
  - 위치: `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts` — `it('POST → GET →
    PATCH 세 응답 모두 threshold 가 문자열이다', ...)` 블록 전체(`send({ ..., threshold: 10,
    ... })`, `.send({ threshold: 15 })`)
  - 상세: GET 응답에 대해 `expect(mine?.threshold).toMatch(/^\d+\.\d{4}$/)` 로 소수 4자리
    포맷을 확인하는 것은 좋은 설계다(값만 보는 공허한 단언을 피함). 다만 입력값이 항상 정수라,
    `"10.0000"`/`"15.0000"` 처럼 소수부가 전부 `0000` 인 형태만 실제로 관측된다. 이 필드가
    `numeric` 컬럼으로 설계된 근본 이유(정밀도 보존)를 더 직접적으로 검증하려면, 유의미한
    소수부를 가진 값(예: `12.3456`)을 최소 한 케이스 포함해 GET 응답이 `"12.3456"` 을
    그대로 돌려주는지 확인하는 편이 더 강한 방어선이다 — 정수 입력만으로는 서비스 계층이
    실수로 `Math.round(...)` 나 `parseInt` 류의 손실 변환을 끼워 넣어도 테스트가 여전히
    GREEN 일 수 있다(정수는 반올림해도 값이 같다). 우선순위는 낮다 — 이번 diff 의 핵심
    결함(`number` 선언 vs `string` wire)은 이미 타입 축만으로 충분히 재현·고정됐고, 이
    지적은 그 위에 얹는 추가 방어선 제안이다.
  - 제안: `POST`/`PATCH` 페이로드 중 하나를 `12.3456` 류의 비-정수 값으로 바꾸고, GET 응답의
    `Number(...)` 비교와 정규식 매치에 그 값을 반영한다. 새 `it` 을 추가하기보다 기존 케이스의
    입력값을 바꾸는 쪽이 테스트 개수를 늘리지 않고 방어력을 높인다.

- **[INFO]** (재확인, 기결정 — 조치 불요로 이미 판정됨) `collectNumericFields`/
  `collectDtoFieldTypes` 가 `extends`/`PickType`/`OmitType` 합성 필드를 못 보는 사각지대는
  이번 라운드에도 그대로 남아 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:296-317`
    (`collectNumericFields`), `:320-339`(`collectDtoFieldTypes`) — 둘 다 `node.members` 만
    순회
  - 상세: `20_39_25`·`21_10_30` 두 라운드가 이미 INFO 로 등재했고, `21_10_30/RESOLUTION.md`
    가 "검출력에 영향 없음(실사례 0건)" 으로 조치 불요 판정을 내렸다. 이번 라운드에서 재확인한
    결과 코드에 변화가 없어 그 판정이 그대로 유효하다 — 새로 지적할 사항이 아니라 이력
    확인 목적으로만 기재한다.
  - 제안: 없음(기결정 유지, 재논의 불필요).

## 검증 절차 (재현 가능)

1. `npx jest src/repo-guards/__tests__/swagger-dto-contract.spec.ts` → **33 passed, 33 total**
   (직전 라운드 32 + `readOption` 캐너리 1, `21_10_30/RESOLUTION.md` 서술과 일치).
2. `codebase/backend/test/jest-e2e.json` 의 `testRegex` 를 직접 읽어 신규 e2e 파일명이
   패턴과 일치함을 확인.
3. `codebase/backend/test/helpers/db.ts` 를 읽어 e2e 가 생성한 워크스페이스/알림 규칙을
   명시적으로 지우지 않는 것이 결함이 아니라 "ephemeral schema 이므로 누적 cleanup 불필요"
   라는 이 저장소의 명시된 관례임을 확인(다른 50개 e2e 스펙과 동일 패턴).
4. `git status --short` → 이 리뷰 세션 산출물(`review/code/2026/09/04/21_25_50/`) 외
   저장소 변경 없음.

## 요약

네 라운드에 걸쳐 실질적인 테스트 갭(런타임 계약 e2e 부재·정규식 위음성 4형태·전제 테스트
부재·`readOption` 무방비 분기)이 순차적으로 발견되고 모두 조치됐으며, 이번 라운드에서 직접
재현·재확인한 결과 그 조치들은 현재 소스에 정확히 반영돼 있다(33/33 GREEN, e2e 파일이 실제
CI 패턴에 걸림, cleanup 부재가 의도된 관례임을 확인). 새로 찾은 것은 심각도 낮은 개선 제안
하나뿐이다 — e2e 가 사용하는 `threshold` 예시 값이 전부 정수라 `numeric(12,4)` 컬럼의
존재 이유인 "정밀도 보존"을 소수 케이스로는 직접 검증하지 않는다. 코드 변경
(`AlertRuleDto.threshold` 타입 정정) 자체와 그 회귀 방지 가드에는 결함이 없고, 기존 테스트를
깨는 부분도 없다.

## 위험도

LOW
