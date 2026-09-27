# 테스트(Testing) 리뷰 — patch-null-validation (2R)

이 diff 는 직전 라운드(`review/code/2026/09/27/17_47_49`)와 동일한 코드 변경 + 그 라운드의 조치 커밋(`e5de5226c`) + 리뷰/컨시스턴시 산출물 자체를 포함한다. 직전 testing 리뷰가 남긴 WARNING 1건이 실제로 해소됐는지를 코드로 재확인하고, 남은 갭을 다시 점검했다.

## 발견사항

- **[해소 확인]** 직전 라운드 WARNING("`model-configs` PATCH 는 유효 값 경로를 검증하는 e2e/통합 테스트가 없다")가 `e5de5226c` 로 실제 해소됐음을 코드로 직접 확인했다.
  - 위치: `codebase/backend/test/patch-null-rejection.e2e-spec.ts:267-288` (`it('모델 설정 PATCH — 유효 값은 200 으로 저장되고, 생략한 키는 값이 그대로다', ...)`)
  - 상세: `{ provider, name, defaultModel, defaultParams }` 4필드를 유효 값으로 PATCH → 200 + 응답 `data` 를 `toMatchObject` 로 대조, 이어 빈 바디(`{}`) PATCH → 200 + 동일 값 유지(`toMatchObject(expected)`)까지 검증한다. `IsOptionalNonNull` 이 정상 경로(값 통과·키 생략)를 깨지 않는다는 것을 실측으로 고정했다. 이 테스트는 `cases`(33건, null 거부만 검증) 뒤에 정의돼 있고 null 거부 케이스들은 400 으로 막혀 상태를 바꾸지 않으므로, 정의 순서·`maxWorkers: 1`(`test/jest-e2e.json`) 하에서 실행 순서 의존 없이 독립적으로 성립한다. 회귀 안전망 갭은 닫혔다고 판단한다.

- **[회귀 검증 — 통과]** 이 PR 이 건드리지 않은 nullable 필드(`ipWhitelist`·`description`·`folderId`·`containerId`·`authConfigId`)에 대한 기존 null 테스트(`auth-config-ip-whitelist.dto.spec.ts`·`node-dto-validation.spec.ts`·`workflow-dto-validation.spec.ts`·`trigger-dto-validation.spec.ts`)를 직접 열어 확인했다. 전부 "null 을 받는다(=값을 지운다)"를 검증하는 것이고 이번에 `@IsOptionalNonNull()` 로 바뀐 43필드와 겹치지 않는다 — stale 회귀 없음.
  - 위치: 위 4개 파일 (`grep -rln "null" src/modules/*/dto/*.spec.ts` 로 전수 확인)

- **[전제 검증 — 통과]** `patch-null-rejection.spec.ts` 의 `TABLE` 을 손으로 합산하면 3+5+3+3+2+4+1+1+4+8+2+3+2+2 = 43 으로, `expect(CASES).toHaveLength(43)` 단언과 일치한다. e2e `cases` 배열도 정확히 33건(스크립트로 `field:` 리터럴 카운트)으로 plan 문서("12라우트/33케이스")와 일치한다 — 표·전제 테스트·plan 서술 세 곳이 서로 어긋나지 않는다.

- **[INFO — 직전 라운드에서 이미 지적, 미해소이나 비차단]** 다중 필드가 동시에 `null` 인 요청에서 `details[]` 가 전부 담기는지는 여전히 unit·e2e 어디서도 검증되지 않는다(모든 케이스가 `{ [field]: null }` 단일 키). class-validator 는 프로퍼티별 독립 검증이라 위험은 낮고, 매핑 계층(`CustomValidationPipe`)은 이 PR 의 변경 범위 밖이다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts` `constraintsFor`, `codebase/backend/test/patch-null-rejection.e2e-spec.ts` `it.each(cases)`
  - 제안: 우선순위 낮음, 이번 PR 을 막을 사안 아님(직전 라운드 SUMMARY 도 동일하게 판단).

- **[INFO — 직전 라운드에서 이미 지적, 미해소이나 비차단]** `IsOptionalNonNull()` 이 `validationOptions` 를 `IsDefined` 의 고정 `message` 뒤에 스프레드해, 호출자가 `message` 를 넘기면 조용히 덮어쓸 수 있는 경로가 여전히 테스트되지 않는다. 현재 전 호출부(14개 DTO, 43필드)가 인자 없이 쓰므로 미현실화.
  - 위치: `codebase/backend/src/common/utils/optional-non-null.ts:23-27`
  - 제안: 우선순위 낮음. 변경 없음.

- **[관찰 — 테스트 설계 유지]** `optional-non-null.spec.ts`(데코레이터 자체의 일반 동작을 전용 `Probe` 클래스로) 와 `patch-null-rejection.spec.ts`(43개 실 DTO 필드가 데코레이터를 달고 있는지만 표로) 의 책임 분리, mock 없이 실물 `class-validator`/`class-transformer`·실 HTTP 요청을 쓰는 점은 직전 라운드 평가와 동일하게 유효하다 — 이번 조치(`e5de5226c`)가 이 구조를 깨지 않았다.

## 요약

직전 라운드가 지적한 유일한 테스트 갭(`model-configs` PATCH 의 유효 값 경로 e2e 부재)이 `e5de5226c` 로 정확히 해소됐음을 코드를 직접 읽어 확인했다 — 유효 값 200 저장 + 키 생략 시 값 유지까지 한 테스트에서 함께 검증한다. 43필드 표·33케이스 e2e·전제 단언(`toHaveLength(43)`) 은 서로 정합하고, 이 PR 이 건드리지 않은 15개 nullable 필드의 기존 null 테스트도 충돌 없이 그대로 유효하다(stale 회귀 없음). 단위·e2e·뮤테이션(M1~M4, plan 기록) 3계층 검증과 mock-free 설계는 견고하다. 남은 것은 직전 라운드가 이미 INFO 로 낮춰 등재한 두 항목(다중 필드 동시 null 시 `details[]` 미검증, `message` 옵션 오버라이드 미검증)뿐이며 둘 다 우선순위가 낮고 이 PR 의 범위를 벗어나지 않는다. 새로운 Critical/Warning 은 발견하지 못했다.

## 위험도

LOW
