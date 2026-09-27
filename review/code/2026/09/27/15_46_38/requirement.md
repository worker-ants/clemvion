# 요구사항(Requirement) 충족 리뷰 — patch-body-followups

## 검증 방법

저장소를 직접 `Read`/`Grep` 해 프롬프트에서 절단된 파일(CHANGELOG.md, auth-configs.service.spec.ts,
patch-partial-body.e2e-spec.ts, spec-draft-nullable-notation-followups.md)을 보강했고, 다음을
추가로 대조했다(모두 read-only, 저장소에 아무것도 쓰지 않음):

- 세 엔티티 컬럼(`AuthConfig.ipWhitelist`, `Node.description`, `Workflow.description`)의 실제
  `@Column(...)` nullable 여부
- `AuthConfigsService.update`/`NodesService.update`가 `omitUndefined()` 결과를
  `Object.assign(entity, …)`으로 병합하는 실제 코드(명시적 `null`이 엔티티에 실제로 도달하는지)
- `AuthConfigsService`의 `ipWhitelist?.length` 사용처(널/빈 배열 동치 주장의 실측)
- `findSwaggerContractMismatches`(`swagger-dto-contract-guard.ts`) 로직 — 데코레이터·타입을
  **함께** 되돌리면 놓친다는 테스트 JSDoc 주장이 실제 `nullable !== tsNull` 비교식과 일치하는지
- `spec/5-system/2-api-convention.md` §5.4 본문(요청 DTO의 `nullable: true` + `T | null` 조합
  선례 조항)
- 라우팅(`auth-configs.controller.ts`, `nodes.controller.ts`)이 e2e 케이스 E가 가정하는 경로와
  일치하는지

`git status --short`로 리뷰 시작·종료 시 워크트리에 변화가 없음을 확인했다(untracked 항목은
이 리뷰 세션 산출물 하나뿐).

## 발견사항

전 항목 문제 없음 — 아래는 확인된 정합성 근거이며 CRITICAL/WARNING 없음.

- **[INFO]** 세 필드의 nullable 요청 DTO 선언은 spec 본문(§5.4)과 line-level로 일치한다.
  - 위치: `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts:29-35`,
    `codebase/backend/src/modules/nodes/dto/update-node.dto.ts:56-62`,
    `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts:50-62`
  - 상세: `spec/5-system/2-api-convention.md:278`이 "요청 DTO 에서는
    `@ApiPropertyOptional({ nullable: true })` + `field?: T | null` 조합이 정당하다"고 명시하고
    선례로 `UpdateAssistantSessionDto.llmConfigId`를 든다. 이번 변경은 그 조항을 문자 그대로
    따른다. 대응 엔티티 컬럼도 모두 `nullable: true`로 실제 DB 상 null을 받는다
    (`node.entity.ts:66`, `workflow.entity.ts:29`, `auth-config.entity.ts:42`).
  - 판정: 코드가 spec을 정확히 따름 — 조치 불요.

- **[INFO]** 런타임 null-clear 경로가 실제로 동작함을 서비스 코드로 직접 확인.
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:247`
    (`Object.assign(config, omitUndefined(rest))`), `codebase/backend/src/modules/nodes/nodes.service.ts:78`
  - 상세: `omitUndefined`는 `undefined`만 걸러내고 명시적 `null`은 통과시키므로(JSDoc·구현 일치,
    `omit-undefined.ts:28-30`), PATCH body의 `{ description: null }`/`{ ipWhitelist: null }`가
    엔티티에 그대로 병합되어 저장된다. 새로 추가된 서비스 단위 캐너리
    (`auth-configs.service.spec.ts` "명시적 null 은 로드한 값을 지운다",
    `nodes.service.spec.ts` 동일 제목)와 e2e 케이스 E(`patch-partial-body.e2e-spec.ts`)가 이
    경로를 실제로 실행해 응답값·GET 재조회값을 단언한다.

- **[INFO]** CHANGELOG의 "`ipWhitelist`는 `null`과 빈 배열이 같은 뜻" 주장이 실측과 일치.
  - 위치: `CHANGELOG.md` "Unreleased — OpenAPI: 설명 · IP 화이트리스트를 null 로 지울 수 있다고
    광고한다" 항목; 근거 코드는 `auth-configs.service.ts:400`
    (`if (ac.ipWhitelist?.length) { … }`).
  - 상세: `?.length`는 `null`과 `[]` 모두에서 falsy이므로 두 값이 "화이트리스트 없음"으로
    동일하게 취급된다 — CHANGELOG 서술이 코드와 정확히 일치.

- **[INFO]** swagger 가드의 사각지대(데코레이터·타입 동시 회귀 미탐지) 주장이 가드 구현과 일치.
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:199-212`
    (`if (nullable !== tsNull && …)`)
  - 상세: `nullable`(OpenAPI)과 `tsNull`(TS 타입)을 **둘 다** false로 되돌리면
    `nullable !== tsNull`이 `false !== false` = `false`가 되어 판정을 통과한다 — 새로 추가된
    선언 캐너리(`*.dto.spec.ts`의 "검증기가 null 을 통과시킨다" / "OpenAPI 가 nullable 로
    광고한다")가 이 사각지대를 메운다는 주장은 코드 레벨로 확인됨. 이 사각지대를 메우는 근거로
    제시된 뮤턴트 표(D4~D6, `plan/in-progress/patch-body-followups.md`)의 예측과 위 로직이
    일치한다.

- **[INFO]** 라우팅·응답 계약이 새 e2e 케이스 E의 가정과 일치.
  - 위치: `codebase/backend/test/patch-partial-body.e2e-spec.ts` (새 `it('E. …')`),
    `auth-configs.controller.ts:71,89,112`, `nodes.controller.ts:68,85-90`
  - 상세: `POST/PATCH/GET /api/auth-configs/:id`, `POST /api/workflows/:id/nodes` +
    `PATCH /api/nodes/:id` + `GET /api/workflows/:id/nodes` 경로가 실제로 존재하며,
    `NodesService.findByWorkflow`는 매퍼 없이 엔티티를 그대로 반환하고
    `NodeDto.description?: string | null`(`node-response.dto.ts:44`)이 이미 nullable로 선언돼
    있어 리스트 조회에서도 `description: null`이 유실되지 않는다.

- **[INFO — 회색지대, 조치 불요]** `PATCH /api/triggers|schedules/:id`의 동일 NOT NULL→500
  결함 클래스는 이번 diff 범위 밖으로 명시적으로 트래커에 등재됐다(`plan/in-progress/patch-body-followups.md`
  §방향 6, `spec-draft-nullable-notation-followups.md`의 새 항목). 이미 `--impl-prep`
  consistency 세션(`review/consistency/2026/09/27/15_19_25`)이 W1/W2/W4로 지적했고 BLOCK: NO로
  통과했으며, plan 문서가 그 처분(W1 → 트래커 항목에 "미검증" 명시, W4 →
  `keyset-cursor-uuid-validation.md §A` 교차 인용 지시)을 §`--impl-prep` 처분 절에 반영해
  두었다. 코드 자체가 스코프를 좁힌 것은 의도적 결정이며 이 diff의 결함이 아니다.

## 요약

세 요청 DTO(`UpdateWorkflowDto.description`, `UpdateNodeDto.description`,
`UpdateAuthConfigDto.ipWhitelist`)의 `nullable: true` + `T | null` 선언은 spec
`5-system/2-api-convention.md` §5.4가 요청 DTO에 대해 명시적으로 정당화하는 패턴과 문자
그대로 일치하며, 대응 엔티티 컬럼이 모두 nullable이고 서비스 레이어(`omitUndefined` +
`Object.assign`)가 명시적 `null`을 실제로 엔티티까지 통과시켜 값을 지운다는 것을 코드 추적으로
직접 확인했다. CHANGELOG의 "동작 변화 없음 · null과 `[]`가 같은 뜻" 주장, swagger 가드의
"데코레이터·타입을 함께 되돌리면 못 잡는다"는 사각지대 주장 모두 해당 소스(서비스 코드,
`swagger-dto-contract-guard.ts`)로 재확인되어 근거가 있다. 새로 추가된 선언 캐너리·단위
캐너리·e2e 케이스 E는 각각 (1) 검증기가 null을 통과시키는지, (2) OpenAPI가 nullable로
광고하는지, (3) 서비스가 명시적 null을 실제로 지우는지, (4) API 왕복 전체에서 응답·저장값이
null로 유지되는지를 서로 다른 계층에서 고정하며 중복 없이 상호보완적이다. NOT NULL 필드에
null을 보내는 케이스(폴더·워크플로 name 등의 500)는 의도적으로 이번 PR의 축이 아니며 트래커에
등재·`--impl-prep`로 사전 처분됐다 — 새 결함이 아니다. TODO/FIXME/HACK 주석, 미완성 반환 경로,
검증 우회 가능 지점은 발견되지 않았다.

## 위험도

NONE
