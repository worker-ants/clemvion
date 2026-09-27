# Testing Review — patch-body-followups (2R)

## 배경

이번 changeset 은 직전 `/ai-review` 1R(`review/code/2026/09/27/15_46_38`, Critical 0 · Warning 2)에서 지적된
testing 관점 Warning 두 건(W1: `omitUndefined(null)` 계약 미고정, W2: e2e 케이스 E 가 3개 리소스를 한 `it` 에 묶음)에 대한
후속 조치(`3cc0d092f`)와 plan/CHANGELOG 갱신을 포함한다. 소스 로직 변경은 없고 DTO 선언(`nullable: true`, `T | null`)·
테스트·문서만 바뀌었다.

## 검증 방법

- `omit-undefined.ts`/`omit-undefined.spec.ts`, DTO 3종(`update-workflow.dto.ts`/`update-node.dto.ts`/`update-auth-config.dto.ts`)과
  대응 validation spec, `auth-configs.service.spec.ts`, `nodes.service.spec.ts`, `patch-partial-body.e2e-spec.ts` 전문을 `Read` 로 직접 열어
  게이트 번호와 대조.
- 저장소를 건드리지 않고 실제 테스트를 재실행해 회귀 여부를 독립적으로 확인:
  - `codebase/backend` 에서 `npm test -- <5개 spec 파일>` → **5 suites / 157 tests 전부 PASS**.
  - `omit-undefined.spec.ts` 단독 → 7/7 PASS.
  - (주의사항 아래 기재: 처음에 `npx jest` 로 직접 돌렸을 때 `uuid` ESM 관련 4 suite 실패가 났는데, 이는 이 PR 의 결함이 아니라
    `package.json` 의 `test` 스크립트가 요구하는 `node --experimental-vm-modules` 플래그를 빼고 호출한 내 쪽의 거짓 실패였다.
    `npm test` 로 재호출하니 전부 통과했다 — 다음 리뷰어를 위해 기록.)
- `git status --short` 로 세션 디렉터리(`review/code/2026/09/27/16_07_49/`) 외 변경 없음 확인(작업 전/후 동일).

## 발견사항

- **[INFO]** 1R 의 두 Warning 이 뮤테이션 검증까지 마친 캐너리로 실제로 닫혔다.
  - 위치: `codebase/backend/src/common/utils/omit-undefined.spec.ts:51-53` (W1 — `omitUndefined(null as never)` → `toThrow(TypeError)`),
    `codebase/backend/test/patch-partial-body.e2e-spec.ts:255-321` (W2 — `E1`/`E2`/`E3` 로 분리, 각 케이스가 null 아닌 시작값을 먼저 단언)
  - 상세: plan(`plan/in-progress/patch-body-followups.md` 뮤턴트 표 N1·W1·W2)이 주장하는 KILLED 결과를 실측(재실행)으로 재확인했다.
    N1(헬퍼 null-safe화)·W1(웹훅 검증이 null 도 목록 검사)·W2(`[]` 도 목록 검사)에 대응하는 각 테스트가 실제로 실패 방향을 갖는
    형태로 작성되어 있다(공허(vacuous) 단언 아님).
  - 제안: 없음 — 조치 완료로 간주.

- **[INFO]** 요청 DTO nullable 선언 3곳(`UpdateWorkflowDto.description`, `UpdateNodeDto.description`,
  `UpdateAuthConfigDto.ipWhitelist`) 모두 "검증기가 null 을 통과시킨다"(런타임)와 "OpenAPI 가 nullable 로 광고한다"(선언)를
  **분리된 두 `it`** 로 고정했고, 이는 의도적 설계다 — `@IsOptional()` 은 TS 타입과 무관하게 항상 null 을 통과시키므로
  데코레이터·타입을 **함께** 되돌리는 회귀(D4~D6)는 "OpenAPI 가 nullable 로 광고한다" 쪽 단언 하나만 이를 잡는다.
  - 위치: `codebase/backend/src/modules/workflows/dto/workflow-dto-validation.spec.ts:306-317`,
    `codebase/backend/src/modules/nodes/dto/node-dto-validation.spec.ts:102-113`,
    `codebase/backend/src/modules/auth-configs/dto/auth-config-ip-whitelist.dto.spec.ts:131-142`
  - 상세: plan 의 D4~D6 실측("캐너리 하나뿐이 KILLED")과 직접 읽은 코드가 일치한다 — swagger 가드가 못 보는 사각을 이 두 번째
    단언이 메운다는 주장이 근거 있는 설계 근거다(단순 주장이 아니라 검증됨).
  - 제안: 없음.

- **[INFO]** 단위 캐너리(`nodes.service.spec.ts:230-246`, `auth-configs.service.spec.ts:383-402`)의 mock 시퀀스(`findOne`
  1회만 stub)가 서비스 구현(`nodes.service.ts:63-84`, `label` 미변경 시 `assertLabelUnique` 미호출이라 두 번째 `findOne` 호출
  없음)과 정확히 맞는다 — mock 호출 횟수가 실제 코드 경로를 반영하지 않는 괴리는 없음.

## 커버리지 갭 (새로 발견된 것 없음)

- request DTO 의 null-clear 동작은 unit(서비스 레벨) · DTO validation(검증기+OpenAPI) · e2e(HTTP 왕복+영속화) 세 층 모두에서
  각각 다른 관측 지점으로 커버된다 — 층 간 중복이 아니라 서로 다른 회귀를 잡는 구조(예: 서비스 unit 은 병합 로직, e2e 는
  실제 라우팅+DB 저장까지). 새로 남은 갭은 찾지 못했다.
- PATCH 의 NOT NULL 필드에 null 을 보내는 500 결함은 이번 PR 의 축이 아니라고 plan 이 명시했고 실제로 diff 에 그 경로를 고치는
  코드가 없다 — 테스트도 추가되지 않았는데, 이는 스코프 밖이라는 plan 의 처분과 일치하므로 커버리지 갭으로 지적하지 않는다
  (새 트래커 항목으로 이미 등재됨, `plan/in-progress/spec-draft-nullable-notation-followups.md`).

## 회귀 테스트

- 기존 `auth-configs.service.spec.ts`·`nodes.service.spec.ts`·DTO validation spec 의 사전 테스트들이 새 캐너리 추가로 깨지지
  않았음을 재실행으로 확인(157/157 PASS, 5 suites).
- e2e A~D(기존)와 신설 E1~E3 가 같은 `describe` 블록 안에서 `uniqueName`/`uniqueEmail` 로 리소스를 격리해 서로 의존하지 않는다.

## 요약

직전 라운드(1R)에서 지적된 두 Warning(헬퍼 null 인자 계약 미고정, e2e 케이스 병합)이 이번 diff 에서 뮤테이션 테스트로
검증된 구체적 캐너리로 실제로 해소됐다. 요청 DTO 3개의 nullable 선언 변경은 런타임 검증기 테스트와 OpenAPI 스키마 테스트로
이중 고정되어 있고, 이 이중 구조가 swagger 가드의 사각(데코레이터·타입 동시 되돌림)을 메운다는 설계 근거도 뮤턴트 D4~D6 로
직접 검증됐다. 독립적으로 재실행한 결과 관련 테스트 스위트 157개 전부 통과했고, 저장소에는 세션 디렉터리 외 어떤 변경도 남기지
않았다. 이번 라운드에서 새로 지적할 테스트 결함은 발견하지 못했다.

## 위험도

NONE
