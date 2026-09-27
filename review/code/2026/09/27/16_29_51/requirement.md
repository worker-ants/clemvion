# 요구사항(Requirement) 리뷰

## 발견사항

- **[INFO]** `PATCH /nodes/:id` 의 `label: null` 은 라벨 중복 검사가 `label: null` 로 다른 노드를 찾아 엉뚱한 409(`DUPLICATE_NODE_LABEL`)를 낸다.
  - 위치: `codebase/backend/src/modules/nodes/nodes.service.ts` `update()` — `if (dto.label !== undefined && dto.label !== node.label) { await this.assertLabelUnique(node.workflowId, dto.label, id); }`
  - 상세: `UpdateNodeDto.label` 은 `@IsOptional()` 만 있고(`@IsString()` 도 있으나 `IsOptional` 이 null 을 먼저 걸러 뒤 검증기를 건너뛴다) 타입은 여전히 `string`(nullable 아님) 이라, 런타임에 `label: null` 을 보내면 DTO 검증은 통과하고 `dto.label !== undefined` 가 참이 되어 `assertLabelUnique(workflowId, null, id)` 호출로 이어진다. 직접 재현하지는 않았고(뮤테이션 금지 규약에 따라 저장소를 건드리지 않음), 코드 경로 추적만으로 확인했다. 이번 diff 가 만든 회귀는 아니다 — `plan/in-progress/spec-draft-nullable-notation-followups.md` 새 백로그 항목("PATCH 의 NOT NULL 필드에 null 을 보내면 500 이다")이 동일 실측(`_test_logs/e2e-20260927-151214.log`)을 이미 기록해 두었다. 코드 경로 재확인으로 그 기록이 여전히 유효함을 뒷받침한다.
  - 제안: 조치 불요(이미 트래커에 등재, 이번 PR 범위 아님). 착수 시 `label` 도 그 백로그의 "NOT NULL 컬럼 + `@IsOptional()`" 전수에 포함해야 한다(현재 문구는 `name`·`tags`·`isActive`·`config` 만 나열 — `label` 이 §전수에 빠졌다면 후속 착수 전 추가할 것).

- **[INFO]** `plan/in-progress/patch-body-followups.md` 자신과 이번 라운드 리뷰 산출물(`review/code/2026/09/27/15_46_38/RESOLUTION.md`, `16_07_49/*`)이 `plan/complete/patch-body-followups.md` 를 인용하지만, 현재 HEAD(`44053cb9f`)에는 그 파일이 아직 `plan/in-progress/`에 있다(`plan/complete/patch-body-followups.md` 미존재).
  - 위치: `plan/in-progress/patch-body-followups.md`(frontmatter `status: in-progress`), `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커 항목이 `plan/complete/patch-body-followups.md` 를 인용)
  - 상세: 요구사항 기능 자체와는 무관한 plan 라이프사이클 항목이라 이 리뷰 범위(코드 요구사항 충족)의 핵심은 아니지만, 문서가 미래 경로를 선인용하는 상태로 머지된 것으로 보인다. 코드 기능에는 영향 없음.
  - 제안: 이번 PR 을 최종 마무리하는 커밋에서 `plan/in-progress/patch-body-followups.md` → `plan/complete/patch-body-followups.md` 이동 + frontmatter `status: complete` 갱신이 필요(아직이라면).

## 확인한 항목 (문제 없음)

- **기능 완전성 / 반환값**: `UpdateWorkflowDto.description`, `UpdateNodeDto.description`, `UpdateAuthConfigDto.ipWhitelist` 세 필드 모두 `nullable: true` + `T | null` 로 선언이 바뀌었고, 실제 서비스 계층(`workflows.service.ts` `update()`, `nodes.service.ts` `update()`, `auth-configs.service.ts` `update()`)은 이미 `omitUndefined()` 를 통해 `null` 을 그대로 병합해 컬럼을 지운다(엔티티 컬럼 `Workflow.description`/`Node.description` 은 이미 `string | null`). CHANGELOG 의 "원래 그렇게 동작했는데 OpenAPI 가 적지 않았다 / 동작 변화는 없다" 주장을 코드로 직접 추적해 확인했다 — 순수 선언(문서) 정정이며 런타임 로직 변경은 없다.
- **엣지 케이스**: `ipWhitelist: null` 과 `ipWhitelist: []` 가 `verifyWebhookRequest` 의 `ac.ipWhitelist?.length` 검사에서 둘 다 falsy 로 동일하게 "제한 없음"으로 처리됨을 `auth-configs.service.ts:400-401` 에서 확인. `auth-configs.service.spec.ts` 의 `it.each(['null', null], ['빈 배열', []])` 캐너리가 이를 실행 레벨로 고정한다.
- **에러 시나리오**: `@IsOptional()` + null 조합이 `@IsArray()`/`@IsString()`/`@IsIpOrCidr({each:true})` 를 모두 건너뛰어 `validate()` 가 0 errors 를 반환함을 각 DTO spec 의 새 테스트(`plainToInstance` → `validate(dto, VALIDATE_OPTIONS)`)가 실측한다 — 주장이 아니라 실행된 단언이다.
- **spec fidelity**: `spec/5-system/2-api-convention.md` §5.4 도입부가 정확히 이 패턴을 요구사항으로 명문화한다 — "PATCH 부분 업데이트는 키 생략(=값 불변)·`null`(=초기화)·값(=설정)의 tri-state" 이며 "요청 DTO 에서는 `@ApiPropertyOptional({ nullable: true })` + `field?: T | null` 조합이 정당하다"(선례로 `UpdateAssistantSessionDto.llmConfigId` 를 든다). 이번 diff 의 세 DTO 변경은 이 문장을 line-level 로 그대로 따른다. `spec/1-data-model.md` §2.17 도 `ip_whitelist | String[]? |` 로 이미 nullable 을 데이터 모델 층에서 선언해 두었다 — drift 아님. 응답 DTO(`workflow-response.dto.ts:25`, `node-response.dto.ts:44`, `auth-config-response.dto.ts:28`)는 이전 PR 에서 이미 `T | null` 로 선언돼 있어, 이번 변경은 요청↔응답 양쪽 선언의 비대칭만 없앤 것 — SPEC-DRIFT 아니고 spec 이 이미 이 형태를 정당화하고 있다.
- **캐너리 유효성**: `swagger-dto-contract-guard.ts` 는 데코레이터 이름(`ApiProperty`/`ApiPropertyOptional`) 과 무관하게 `nullable` 옵션과 TS `| null` 을 대조하므로, 세 DTO 의 `@ApiPropertyOptional({ nullable: true })` + `field?: T | null` 조합을 올바르게 인식한다. `contractForDto()` 는 임시 probe 컨트롤러로 스키마를 생성하는 범용 유틸이라 요청 DTO 에도 정상 동작한다(파일: `codebase/backend/src/shared/testing/response-contract.ts`).
- **문서 일관성**: 1R 에서 지적됐던 "`UpdateWorkflowDto`/`UpdateAuthConfigDto` 필드 JSDoc 미갱신"(`review/code/2026/09/27/15_46_38/documentation.md` INFO)은 커밋 `3cc0d092f`(RESOLUTION INFO 6)에서 실제로 고쳐졌음을 현재 파일 상태로 재확인했다 — `update-workflow.dto.ts:27` `/** 변경할 설명 (null 이면 지운다) */`, `update-auth-config.dto.ts:49` `/** 변경할 IP 화이트리스트 (null · 빈 배열이면 전체 삭제) */` 모두 반영됨.
- **TODO/FIXME**: 변경된 12개 코드/스펙 파일 전체에서 TODO/FIXME/HACK/XXX grep 0건.
- 뮤테이션 규약 준수: 이번 리뷰는 저장소 파일을 전혀 쓰거나 고치지 않았다(Read/Grep 만 사용). `git status --short` 재확인 불요 — 애초에 워크트리에 쓰기 작업 없음.

## 요약

이번 변경(`UpdateWorkflowDto.description`, `UpdateNodeDto.description`, `UpdateAuthConfigDto.ipWhitelist` 의 `nullable` 선언·타입 정정 + 선언/동작 캐너리 + CHANGELOG)은 이미 존재하던 런타임 동작(널 값으로 필드를 지움)에 OpenAPI 선언과 TS 타입을 뒤늦게 맞춘 것으로, `spec/5-system/2-api-convention.md` §5.4 가 명시한 PATCH tri-state 예외 문장과 line-level 로 정확히 일치한다. 서비스 계층 코드 추적과 신설 unit/e2e 테스트 모두 "null 이 값을 지운다"·"null 과 `[]` 가 동치"라는 주장을 실행 레벨로 뒷받침하며, 1R·2R 두 차례 리뷰에서 지적된 항목(테스트 캐너리 보강, 문구 통일, e2e 케이스 분리)도 현재 코드에 반영되어 있다. 남은 것은 이번 PR 범위 밖으로 이미 트래커에 등재된 기존 결함(PATCH NOT NULL 필드에 `null` → 500/409)뿐이며, 코드 경로 재추적으로 그 기록이 여전히 정확함을 확인했다(신규 회귀 아님). Critical 은 없다.

## 위험도

NONE
