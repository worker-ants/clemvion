# 요구사항(Requirement) 충족 리뷰 — patch-null-validation

검토 대상: PATCH 43필드에 `null` 을 보내면 500(31)/409(1)/200(1) 이던 결함을 `IsOptionalNonNull()` 공용 데코레이터로 400 `VALIDATION_ERROR` 로 조기 거부하도록 고친 변경(커밋 HEAD `10af7d0e5`). 데코레이터 구현·14개 DTO 적용·단위/e2e 테스트·CHANGELOG·plan·`--impl-prep` consistency 산출물을 모두 확인했다.

## 검증 방법

- `codebase/backend/src/common/utils/optional-non-null.ts` 구현을 class-validator 의 `ValidateIf`/`IsDefined`/`IsOptional` 내부 동작(조건부 스킵은 프로퍼티 단위로 적용됨, `IsDefined`/`IsString`/`IsObject`/`IsArray`/`IsUUID`/`IsIn`/`IsNumber`/`IsBoolean` 이 `null` 을 자체적으로도 거부하는지)과 대조해 데코레이터 자체의 정확성을 추론 검증.
- `plan/in-progress/patch-null-validation.md` §전수(A 38 · D 6 · B 8) 표와 CHANGELOG 43필드 주장을 실제 diff(파일 4~18, 14개 DTO)의 데코레이터 교체 지점과 필드명 단위로 전수 대조 — 43 합계 일치 확인.
- 단위 테스트 표(`repo-guards/__tests__/patch-null-rejection.spec.ts`, 43케이스) · e2e(`test/patch-null-rejection.e2e-spec.ts`, 33케이스, 대표 필드)를 전문 열람해 어서션 형태(`isDefined` 포함 여부, `{status:400, code:'VALIDATION_ERROR'}`, `details[].field`)가 실제 `CustomValidationPipe`(`common/pipes/validation.pipe.ts`) 출력 형태와 일치하는지 확인.
- `spec/2-navigation/2-trigger-list.md` §3/§2.3.1 을 직접 grep 해 "null 허용은 `authConfigId` 에만 명시" 주장을 원문으로 재확인.
- `spec/5-system/2-api-convention.md` §5.4 블록쿼트 원문을 직접 Read 해 consistency-checker 가 지적한 문면 모호성을 재확인.
- `git status --short`/`git log -1` 로 저장소가 커밋 HEAD(`10af7d0e5`)와 일치하고 리뷰 중 변조가 없음을 확인 — 저장소에 뮤테이션 없음(읽기만 수행).

## 발견사항

- **[SPEC-DRIFT] [WARNING]** `spec/5-system/2-api-convention.md` §5.4 블록쿼트("PATCH 부분 업데이트는 키 생략(=값 불변)·`null`(=초기화)·값(=설정)의 tri-state 가 각각 의미를 갖는 별개 계약")를 글자 그대로 읽으면 "모든 PATCH 필드에 tri-state 가 적용된다" 로 보이는데, 이번 구현은 그중 43필드에 대해 `null`(=초기화) 분기 자체를 거부(400)한다.
  - 위치: `spec/5-system/2-api-convention.md` §5.4 블록쿼트(파일 내 "### 5.4 부재 표현" 절, 직접 Read 로 확인). 코드 쪽 대응 지점은 `codebase/backend/src/common/utils/optional-non-null.ts` 파일 상단 JSDoc("쓰지 말아야 할 자리: 컬럼이 nullable 이고 null 이 «값을 지운다» 는 뜻인 필드").
  - 상세: 코드가 틀린 것이 아니다 — 이 43필드는 전부 OpenAPI 가 `nullable` 을 선언하지 **않은** 필드이고(§5.4 자체가 "null 이 뜻을 가지는 필드는 `nullable: true` 로 선언하라" 고 규정), `authConfigId`(트리거)·`llmConfigId`(어시스턴트 세션)·`parentId`/`folderId`(트리·워크플로)처럼 실제로 tri-state 가 적용되는 필드는 이번 변경이 전혀 건드리지 않았다(직접 확인). 즉 구현은 §5.4 의 "null 을 받기로 선언한 필드에만 초기화 의미" 라는 취지에 정확히 부합하지만, §5.4 원문 문장 자체가 "PATCH 부분 업데이트" 단위로 읽힐 여지를 남겨 둔다.
  - 이미 트래킹됨: 이 PR 자신의 `--impl-prep` consistency-check(`review/consistency/2026/09/27/17_14_44`, cross_spec WARNING #2 · plan_coherence 무관)가 동일 지점을 이미 지적했고, `plan/in-progress/spec-draft-nullable-notation-followups.md` 6399~6407행에 planner 항목 (10)으로 등재돼 있다. 새 조치를 요구하는 것이 아니라, 독립적으로 재확인한 결과가 일치함을 기록한다.
  - 제안: 코드는 유지. spec 반영은 `spec/5-system/2-api-convention.md` §5.4 블록쿼트에 "tri-state 의 `null`=초기화 분기는 `nullable: true` 로 선언된 필드에만 적용되고, 미선언 필드의 `null` 은 400 `VALIDATION_ERROR`" 한 문장을 추가하는 것 — planner 턴에서 이미 대기 중인 항목 (10)을 그대로 집행하면 된다.

- **[INFO]** 신규 단위 테스트 두 파일이 `plan/complete/patch-null-validation.md` 를 인용하지만, 현재 plan 문서는 아직 `plan/in-progress/patch-null-validation.md` 에 있다(체크리스트에 `/ai-review`·`--impl-done` 미체크 — 아직 `complete/` 로 이동 전).
  - 위치: `codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts` 27행(주석 `이 표는 plan/complete/patch-null-validation.md §전수...`); `codebase/backend/test/patch-null-rejection.e2e-spec.ts` 는 `src/repo-guards/__tests__/patch-null-rejection.spec.ts` 를 가리켜 간접 영향 없음.
  - 상세: 기능에는 영향 없는 문서 경로 선참조다. `--impl-done` 통과 후 plan 이 `complete/` 로 옮겨지면 저절로 맞아떨어지지만, 그 전에 이 주석만 단독으로 읽으면 존재하지 않는 경로를 가리킨다.
  - 제안: plan 을 `complete/` 로 옮기는 마무리 커밋에서 함께 맞는지만 재확인. 코드 자체를 지금 고칠 필요는 없음(경로 문자열이 로직에 쓰이지 않는 주석이므로 테스트 결과에 영향 없음).

- **[INFO] (확인 — 결함 아님)** `IsOptionalNonNull()` 데코레이터의 핵심 동작(생략=스킵, `null`=거부, 값=해당 검증기만) 을 class-validator 내부 `ConditionalValidation`(ValidateIf/IsOptional 이 공유하는 프로퍼티 단위 스킵 메커니즘) 기준으로 추론 검증한 결과, 의도한 대로 동작한다. `IsDefined` 가 없어도 `IsString`/`IsObject`/`IsArray`/`IsUUID`/`IsIn`/`IsNumber`/`IsBoolean` 은 이미 `null` 을 자체적으로 거부하므로(뮤턴트 M2 실측과 일치 — "400 자체는 유지, 잃는 것은 메시지뿐"), `IsDefined` 는 "생략하면 유지된다" 라는 진단 메시지를 위한 설계이지 400 자체의 방어선이 아니다. 문서화된 뮤턴트 표(M1~M4)의 예측·실측이 이 추론과 정확히 일치한다.
  - 위치: `codebase/backend/src/common/utils/optional-non-null.ts:14-29` (함수 본문), `optional-non-null.spec.ts:32-47` (null 거부 + 메시지 테스트).

- **[INFO] (확인 — 결함 아님)** 43필드 카운트·필드명이 CHANGELOG·plan §전수·`repo-guards` 테스트 표·실제 DTO diff 4곳 사이에서 전수 일치한다(14개 DTO 파일을 모두 직접 대조: 3+5+3+3+2+4+1+1+4+8+2+3+2+2 = 43). B그룹(선언 누락 8필드: assistant `title`, model-configs `baseUrl`/`dimension`, knowledge-bases `description`/`rerankConfigId`/`rerankScoreThreshold`/`rerankLlmConfigId`, users/me `avatarUrl`)과 이미 tri-state 가 적용된 필드(`authConfigId`·`llmConfigId`·`parentId`·`folderId`·`containerId`·`toolOwnerId`·`extractionLlmConfigId`·`embeddingModelConfigId`)는 실제 DTO 파일에서 미변경 상태임을 직접 확인했다 — 범위 밖 필드를 실수로 건드리지 않았다.
  - 위치: `codebase/backend/src/modules/knowledge-base/dto/update-knowledge-base.dto.ts`(description/rerankConfigId/rerankScoreThreshold/rerankLlmConfigId 미변경 직접 확인), `codebase/backend/src/modules/integrations/dto/integration.dto.ts`(UpdateIntegrationDto 는 name 단일 필드).

- **[INFO] (확인 — 결함 아님)** boundary/falsy 값 처리가 정확하다 — `isActive: false`, `sortOrder: 0`, `name: ''` 은 모두 `value !== undefined` 조건에서 "정의됨" 으로 취급돼 통과 가능하고(각 타입 검증기만 그 값을 심사), `null`/`undefined` 만 별도로 갈린다. 이 저장소가 과거 반복적으로 지적한 "truthiness 로 정상/이상을 가르는" 패턴이 아니라 명시적 `!== undefined`/`!== null` 비교를 쓴다.
  - 위치: `codebase/backend/src/common/utils/optional-non-null.ts:19` (`ValidateIf((_, value) => value !== undefined, ...)`).

## 요약

`IsOptionalNonNull()` 데코레이터 구현과 14개 DTO·43필드 적용은 의도한 기능(생략=값 불변, `null`=400 조기 거부)을 정확히 구현하며, 단위(43케이스×2)·e2e(33케이스, 고치기 전 RED 33/33 실측 포함)·뮤턴트(M1~M4 KILLED) 검증이 모두 실측 근거로 뒷받침된다. spec 대조 결과 트리거 `endpointPath`·워크스페이스 설정 등 대상 필드 어디에도 이 PR 이 위반하는 명시적 null 계약은 없었고(트리거는 `authConfigId` 에만 null 허용이 명시돼 있음을 원문으로 확인), tri-state 가 실제로 적용돼야 하는 필드(authConfigId·llmConfigId·parentId 등)는 정확히 스코프 밖에 남아 있다. 유일하게 남는 사안은 `spec/5-system/2-api-convention.md §5.4` 블록쿼트 문구가 "모든 PATCH 필드" 로 읽힐 여지를 주는 SPEC-DRIFT 이며, 이는 코드 결함이 아니라 문서 정밀도 문제로 이미 이 PR 자신의 `--impl-prep` consistency-check 가 발견해 planner 트래커((10)번 항목)에 등재해 두었다 — 독립 검증 결과도 동일한 결론에 도달했다. 그 외 `plan/complete/` 선참조 주석 1건은 plan 이동 시 자동 해소되는 문서적 사소함이다. TODO/FIXME/HACK 류 미완성 표식은 신규 파일 어디에도 없었다.

## 위험도

LOW
