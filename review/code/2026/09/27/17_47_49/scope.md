# 변경 범위(Scope) 리뷰 — patch-null-validation

## 발견사항

- **[INFO]** 신규 공용 데코레이터 `IsOptionalNonNull` 도입은 기능 확장이 아니라 43필드 반복을 막는 최소 인프라
  - 위치: `codebase/backend/src/common/utils/optional-non-null.ts`
  - 상세: PATCH DTO 43개 필드에서 `@IsOptional()` → `@IsOptionalNonNull()` 교체가 이루어지는데, 이를 필드마다 `@ValidateIf(...) + @IsDefined(...)` 로 풀어 쓰지 않고 9줄짜리 공용 데코레이터로 뽑았다. 기존에도 같은 폴더(`common/utils/`)에 `omit-undefined.ts` 선례가 있어 디렉터리·패턴 모두 기존 관례를 따른다. over-engineering 이 아니라 오히려 중복을 줄인 최소 구현으로 판단된다.
  - 제안: 조치 불필요. (단, 이 헬퍼가 spec `code:` 에 미등재라는 점은 `--impl-prep` consistency-check 가 이미 WARNING #1 로 잡아 트래커에 등재됨 — `plan/in-progress/spec-draft-nullable-notation-followups.md` — scope 위반이 아니라 문서 링크 갭이므로 별도 조치 불요.)

- **[INFO]** 43필드 변경이 plan 이 전수조사로 선언한 대상과 정확히 일치
  - 위치: `codebase/backend/src/modules/{alerts,auth-configs,folders,integrations,knowledge-base,model-config,nodes,schedules,triggers,users,workflow-assistant,workflow-test-datasets,workflows,workspaces}/dto/*.ts`
  - 상세: 각 DTO 파일 diff를 `plan/in-progress/patch-null-validation.md` §전수의 (A)38 + (D)6 = 43필드 표와 대조한 결과 필드 수·이름이 정확히 일치한다(alerts 4·auth-configs 2·folders 2·integrations 1·knowledge-base 8·model-config 4·nodes 5·schedules 2·triggers 3·users(update-me) 3·workflow-assistant 1·workflow-test-datasets 3·workflows 3·workspaces 2 = 43). 각 파일에서 nullable 로 남겨야 하는 필드(예: `update-node.dto.ts` 의 `description`·`containerId`·`toolOwnerId`, `update-workflow.dto.ts` 의 `description`·`folderId`·`settings`, `update-auth-config.dto.ts` 의 `type`·`config`·`ipWhitelist`, `update-model-config.dto.ts` 의 `apiKey`·`baseUrl`·`dimension`·`isDefault`, `update-trigger.dto.ts` 의 `config`·`authConfigId`·`notification`·`interaction`·`chatChannel`, `update-workspace-settings.dto.ts` 의 `maxConcurrentExecutions`, `update-me.dto.ts` 의 `avatarUrl`)는 손대지 않고 `@IsOptional()` 그대로 남아 있다. 의도 이상의 필드 변경이나 드라이브바이 리팩토링은 발견되지 않았다.
  - 제안: 조치 불필요.

- **[INFO]** 각 DTO 파일의 diff는 import 1줄 추가 + 데코레이터 교체뿐, 포맷팅·순서 변경 없음
  - 위치: 예) `codebase/backend/src/modules/integrations/dto/integration.dto.ts:17`, `codebase/backend/src/modules/model-config/dto/update-model-config.dto.ts:11`
  - 상세: 모든 대상 파일에서 `import { IsOptionalNonNull } from '../../../common/utils/optional-non-null';` 한 줄이 기존 import 블록 끝에 추가되고, 기존 import 순서·공백·다른 import 는 재배열되지 않았다. 데코레이터 교체도 해당 줄만 `-`/`+` 로 정확히 치환되어 무관한 줄 변경이 없다.
  - 제안: 조치 불필요.

- **[INFO]** 테스트 변경은 새 동작을 검증하는 데 필요한 최소 범위
  - 위치: `codebase/backend/src/modules/users/dto/update-me.dto.spec.ts` (theme=null 기대값 변경), `codebase/backend/src/common/utils/optional-non-null.spec.ts` (신규), `codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts` (신규, 43필드 전수), `codebase/backend/test/patch-null-rejection.e2e-spec.ts` (신규, 12라우트 33케이스)
  - 상세: `update-me.dto.spec.ts` 는 종전엔 "theme=null 은 optional 통과" 를 검증했는데, 이는 결함(저장 시 500)을 고정하던 테스트였다. 기대값을 "거부한다" 로 바꾸고 사유를 주석으로 남긴 변경은 이번 fix 의 직접적 결과이며 범위를 벗어나지 않는다. 나머지 3개 테스트 파일은 신규 데코레이터·43필드 표·e2e 경로를 검증하는 목적에 정확히 부합하고, 무관한 기존 테스트를 건드리지 않았다.
  - 제안: 조치 불필요.

- **[INFO]** CHANGELOG·plan·consistency-check 산출물은 프로젝트 규약이 요구하는 부수 문서
  - 위치: `CHANGELOG.md`, `plan/in-progress/patch-null-validation.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`, `review/consistency/2026/09/27/17_14_44/*`
  - 상세: CHANGELOG 항목 추가는 CLAUDE.md/메모리 규약상 "수정의 일부"로 요구되는 작업이고, plan 신규 작성·트래커 항목 완료 처리(`[ ]`→`[x]`) 및 후속 항목 신설은 developer 워크플로가 요구하는 표준 산출물이다. `review/consistency/2026/09/27/17_14_44/**` 는 `--impl-prep` 게이트 실행의 필수 산출물(harness 요구)이며 코드 변경과 무관한 별도 파일이지 스코프 침범이 아니다. spec_impact 프런트매터에 `spec/2-navigation/9-user-profile.md` 를 추가한 것도 `spec-draft-nullable-notation-followups.md` 트래커 문서 자체의 메타데이터 갱신으로, 실제 spec 본문을 건드린 것은 아니다.
  - 제안: 조치 불필요.

## 요약

전체 diff(30개 파일)를 plan 이 스스로 선언한 스코프(§전수 (A)38+(D)6=43필드의 `@IsOptional()` → `@IsOptionalNonNull()` 교체, 그를 지원하는 공용 데코레이터 1개, 관련 테스트·CHANGELOG·plan·consistency-check 산출물)와 대조한 결과, 선언된 범위를 벗어나는 추가 수정·리팩토링·기능 확장·무관한 파일 수정·포맷팅 잡음·불필요한 주석/임포트·설정 변경은 발견되지 않았다. 각 DTO 파일은 정확히 필요한 줄만 최소로 건드렸고, nullable 로 유지해야 할 필드는 의도적으로 손대지 않은 것이 diff와 전체 컨텍스트 대조로 확인된다. 신규 공용 헬퍼 도입은 43필드 반복을 피하기 위한 합리적 최소 구현이며, 이미 존재하는 `omit-undefined.ts` 패턴을 따른다.

## 위험도

NONE
