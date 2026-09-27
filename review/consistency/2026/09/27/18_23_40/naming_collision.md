# 신규 식별자 충돌 검토 — patch-null-validation (--impl-done, scope=spec/2-navigation/)

## 조사 범위

- Target: `spec/2-navigation/` — diff-base(`origin/main`) 대비 **spec 델타 0개 파일**(정상. 코드 전용 PR).
- 구현 diff: 19개 파일 / 1081줄. 핵심은 신규 공용 데코레이터 `IsOptionalNonNull()`(`codebase/backend/src/common/utils/optional-non-null.ts`)을 21개 PATCH 라우트 중 14개 DTO(43필드)에 배선 — 기존 `@IsOptional()` → `@IsOptionalNonNull()` **교체**다. `spec/2-navigation/` 소유 코드 중 `triggers/dto/update-trigger.dto.ts`(2-trigger-list.md) · `folders/dto/update-folder.dto.ts`·`workflows/dto/update-workflow.dto.ts`(1-workflow-list.md)가 포함된다.
- 이 PR 이 도입하는 새 식별자 후보 전수: 함수/데코레이터 `IsOptionalNonNull`, 파일 `common/utils/optional-non-null.ts`(+`.spec.ts`), 테스트 파일 `repo-guards/__tests__/patch-null-rejection.spec.ts` · `test/patch-null-rejection.e2e-spec.ts`. 새 엔티티·endpoint·이벤트·ENV·에러 코드·요구사항 ID는 없다(전수 확인, 아래 참고).

## 발견사항

- **[WARNING] `IsOptionalNonNull` 이름이 기존 응답-계약 어휘 "optional-non-nullable" 과 근접 — 다른 레이어를 가리킨다**
  - target 신규 식별자: `IsOptionalNonNull()` (`codebase/backend/src/common/utils/optional-non-null.ts:14`) — **요청** DTO(PATCH body)에서 "생략은 허용, `null` 은 400 거부"를 강제하는 class-validator 데코레이터.
  - 기존 사용처: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts:65` (사전 존재, `#1308`, 이번 PR 무관) — *"`response-contract.ts` 의 `visit()` 은 **optional-non-nullable** 필드에 `null` 이 오면 `kind:'null'` 로 잡는다"*. 실제 구현은 `codebase/backend/src/shared/testing/response-contract.ts:259-269` — **응답** 바디에서 `required` 아닌(=optional) 필드에 `null` 이 실리면 위반으로 문다.
  - 상세: 두 축이 거의 같은 자연어 개념("생략 가능하지만 null 은 안 된다")을 가리키지만 서로 다른 경계를 검증한다 — 하나는 응답 바디(`§5.4`), 하나는 PATCH 요청 바디(`§5.4` 자신이 명시적으로 "요청 바디는 대상이 아니다", `spec/5-system/2-api-convention.md:278`, tri-state 별도 계약)다. 이 분리 자체는 spec SoT 에 이미 정당화돼 있어 **설계 결함은 아니다.** 다만 신규 식별자 `IsOptionalNonNull` 이 기존 "optional-non-nullable" 서술 어휘와 철자상 사실상 동일해, 두 파일 사이에 상호 참조가 전혀 없는 상태로 grep 하면("OptionalNonNull") 두 메커니즘을 같은 것으로 오인하기 쉽다. 실제로 `grep -rin "optionalnonnull\|optional-non-null"` 결과 `trigger-workflow-ref.ts` 한 곳만 이 PR 신규 파일들과 무관하게 같은 어휘를 쓰고 있었다.
  - 제안: `optional-non-null.ts` JSDoc 에 "응답 계약의 optional-non-nullable(§5.4, `response-contract.ts`)과는 별개 — 이쪽은 **요청** DTO 입구 검증" 한 줄만 추가해 미래 grep 오인을 막는다. 이름 자체를 바꿀 필요는 없다(이미 14개 DTO·43필드에 배선 완료돼 리네임 비용이 큼).

- **[INFO] `omit-undefined.ts` / `optional-non-null.ts` 상호 미참조 — 같은 PATCH tri-state 축의 짝인데 서로를 가리키지 않는다**
  - target 신규 식별자: `codebase/backend/src/common/utils/optional-non-null.ts` (신규, 같은 디렉터리).
  - 기존 사용처: `codebase/backend/src/common/utils/omit-undefined.ts` (사전 존재) — PATCH 부분 본문을 엔티티에 병합하기 전 `undefined` 키를 제거하는 유틸. JSDoc 이 §5.4 tri-state 를 언급한다.
  - 상세: 둘 다 "PATCH 에서 키 생략(=값 불변) vs `null`(=지움/거부)" 이라는 동일 tri-state 계약의 서로 다른 절반(하나는 입구 거부, 하나는 병합 전 청소)을 구현하지만 어느 쪽 JSDoc 도 서로를 링크하지 않는다. 이름 충돌은 아니지만("omit-undefined" vs "optional-non-null" 은 철자가 다름) 신규 파일이 도입될 때 같은 디렉터리의 개념적 짝을 찾기 어렵다.
  - 제안: 필수는 아님 — 두 파일 JSDoc 상호 링크 한 줄 정도의 사소한 보완.

- **엔티티/타입명·API endpoint·이벤트/메시지명·환경변수/설정키·요구사항 ID 충돌 없음**
  - `IsOptionalNonNull` / `optional-non-null.ts` / `patch-null-rejection.*` 는 `codebase/frontend`·`codebase/packages`·`codebase/channel-web-chat` 전수 grep 결과 0건 — 프런트·패키지 영역과 충돌 없음.
  - PATCH 21라우트는 전부 `spec/2-navigation/1-workflow-list.md §3` · `2-trigger-list.md §2.3.1` 등에 이미 선언된 기존 endpoint이며 새 endpoint 를 추가하지 않는다.
  - 응답 코드는 기존 `400 VALIDATION_ERROR`(`spec/5-system/2-api-convention.md:195`)를 재사용 — 신규 `details.code` 값 신설 없음.
  - 새 ENV var·config key·webhook/queue/sse 이벤트·요구사항 ID 없음(plan frontmatter `spec_impact: none`).
  - 파일 경로(`common/utils/optional-non-null.ts`, `repo-guards/__tests__/patch-null-rejection.spec.ts`, `test/patch-null-rejection.e2e-spec.ts`)는 기존 파일과 이름이 겹치지 않고(`git cat-file -e origin/main:...` 확인, NOT_EXISTS), 디렉터리 기존 명명 관례(접미사 유무 혼재)를 벗어나지 않는다.

## 요약

이 PR 은 spec/2-navigation 델타는 0이지만 그 영역이 소유한 트리거·워크플로·폴더 PATCH DTO 를 포함해 43필드에 신규 공용 데코레이터 `IsOptionalNonNull()`을 배선했다. 전수 grep 으로 확인한 결과 새 엔티티·endpoint·이벤트·ENV·에러 코드·요구사항 ID 충돌은 없었고, 유일한 주목할 점은 신규 데코레이터명이 기존 응답-계약 검증 어휘("optional-non-nullable", `response-contract.ts`/`trigger-workflow-ref.ts`)와 철자가 거의 같아 서로 다른 레이어(요청 vs 응답)를 가리킨다는 사실을 상호 참조 없이 방치하고 있다는 점이다 — 설계상 결함은 아니나 명명 혼동 소지가 있어 WARNING 으로 기록한다. 이 PR 을 막을 CRITICAL 은 없다.

## 위험도

LOW
