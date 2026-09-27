# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/Warning 0건. 1R(17_47_49)이 낸 Warning 2건(모델 설정 PATCH happy-path e2e 부재, `endpointPath` null 거부 미문서화)은 `e5de5226c` 로 완전히 조치됨을 8개 reviewer 전원이 코드/로그 직접 대조로 재확인했다. forced(router_safety) 화이트리스트 7명(`documentation`·`maintainability`·`requirement`·`scope`·`security`·`side_effect`·`testing`) 전원 결과 확보됨 — 강제 목록 미이행 없음. 남은 항목은 전부 INFO(비차단)이며, 그중 SPEC-DRIFT 1건은 별도 표기.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음. (1R의 Warning 2건은 `e5de5226c`로 조치 완료 — 아래 INFO #3 참고)

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/2-api-convention.md` §5.4 의 PATCH tri-state 서술("키 생략=값 불변·null=초기화·값=설정")이 이번 43필드 null-거부와 문면상 충돌해 보일 수 있으나, 문맥상 이는 "§5.4 응답 규칙을 요청 DTO 에 그대로 적용하면 부분 갱신 계약이 깨진다"는 예외 근거 설명이지 "모든 PATCH 필드가 null=초기화 를 지원해야 한다"는 전칭 규칙이 아니다. 43필드는 전부 `nullable` 미선언 필드이고 tri-state 대상 필드(`extractionLlmConfigId` 등)는 이 PR 이 건드리지 않아 실제 충돌 인스턴스는 없음 — 코드가 옳고 spec 문장이 오독 여지를 남김 | `spec/5-system/2-api-convention.md` §5.4 블록쿼트; 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 (10) | 코드 유지(revert 불요). 이미 planner 트래커에 등재됨 — 다음 planner 턴에서 §5.4 에 "tri-state 의 null=초기화 분기는 `nullable: true` 선언 필드에만 적용" 한 문장만 추가하면 해소 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 2 | 보안(범위 밖) | (기존 갭, 이 PR 이 만든 것 아님) `workflows.folderId`·`nodes.containerId`/`toolOwnerId`·assistant `llmConfigId` 의 PATCH 갱신 경로가 같은 워크스페이스 소속인지 검사하지 않는 것으로 보임(IDOR 의심) — developer 스스로 조사 중 발견해 기록 | `plan/in-progress/patch-null-validation.md` "범위 밖 관찰" 문단; `plan/in-progress/spec-draft-nullable-notation-followups.md` "PATCH null 후속" 항목 | 이미 백로그에 "미검증 · 착수 전 e2e 로 재현부터"로 등재됨 — 이번 병합 차단 사유 아님, 재-flag 불요 |
| 3 | 테스트/문서 (확인) | 1R Warning W1(모델 설정 PATCH happy-path e2e 부재)·W2(`endpointPath` null 거부 미문서화)가 `e5de5226c` 로 완전히 조치됨을 6개 reviewer(security·requirement·scope·side_effect·testing·documentation·api_contract)가 코드/e2e 로그 직접 대조로 재확인 — e2e 458→459 실측 일치 | `codebase/backend/test/patch-null-rejection.e2e-spec.ts:267-288`; `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts`(JSDoc/Swagger) | 조치 불요 — 완결 |
| 4 | 유지보수성 | `IsOptionalNonNull()` 이 `IsDefined` 고정 `message` 뒤에 `validationOptions` 를 스프레드해, 호출자가 `message` 옵션을 넘기면 "생략하면 값이 유지된다"는 안내 문구가 조용히 덮여씀 (현재 14개 DTO·43필드 전부 인자 없이 호출 — 미현실화) | `codebase/backend/src/common/utils/optional-non-null.ts:19-27` | 우선순위 낮음. 의도적 허용이면 JSDoc 명시, 아니면 스프레드 순서 조정 |
| 5 | 유지보수성 | `propertyKey` 를 런타임 검증 없이 `string` 으로 캐스트 — 저장소의 다른 커스텀 validator(`is-ip-or-cidr.validator.ts`)는 반환 함수 시그니처 자체를 `string` 으로 좁혀 캐스트 불필요, 이 파일만 스타일 outlier | `codebase/backend/src/common/utils/optional-non-null.ts:17-18` | 반환 함수 시그니처를 `(target: object, propertyKey: string) => void` 로 좁히면 기존 관례와 일관 |
| 6 | 유지보수성 | "43필드" 불변식이 단일 SoT 없이 단위 테스트 assert·JSDoc·plan 문서 여러 곳에 나뉨 — `TABLE` 자체에 새 항목이 **빠지는** 실수는 `toHaveLength(43)` assert 로 못 잡음(문서화된 기지의 한계) | `codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts:82-84`, JSDoc 28행 | 조치 불요(이미 문서화된 한계). 후속으로 `@IsOptionalNonNull()` 사용처 AST 전수 스캔 정적 가드 고려 가능 |
| 7 | 유지보수성 (신규, 2R) | W1 로 추가된 신규 happy-path e2e 에서 "보낸 값"(`send()`)과 "기대값"(`expected`)이 같은 리터럴로 두 곳에 따로 선언됨 — 향후 페이로드를 한쪽만 고치면 조용히 어긋날 수 있음 | `codebase/backend/test/patch-null-rejection.e2e-spec.ts:270-282` | `const payload = {...}` 하나로 선언해 `.send(payload)`/`toMatchObject(payload)` 양쪽에 재사용 |
| 8 | 유지보수성 | e2e `cases` 테이블에서 같은 라우트의 `url` 람다가 필드 수만큼(최대 4회) 반복 — 자매 unit 테스트(`patch-null-rejection.spec.ts`)는 `flatMap` 으로 라우트당 1줄로 축약하는 것과 대비 | `codebase/backend/test/patch-null-rejection.e2e-spec.ts:110-244` | 라우트당 `fields: [...]` + `flatMap` 형태로 축약하면 필드 추가 시 `url` 오타 여지도 감소 |
| 9 | 테스트 | 다중 필드가 동시에 `null` 인 요청에서 `details[]` 가 전부 담기는지는 unit/e2e 어디서도 검증되지 않음(모든 케이스가 단일 키). class-validator 는 프로퍼티별 독립 검증이라 위험 낮음, 매핑 계층(`CustomValidationPipe`)은 이 PR 범위 밖 | `patch-null-rejection.spec.ts` `constraintsFor`; e2e `it.each(cases)` | 우선순위 낮음, 이번 PR 을 막을 사안 아님 |
| 10 | API 계약 | `CustomValidationPipe.flattenErrors` 는 null 값에 대해 `isDefined`+타입 검증기 둘 다 위반시켜 같은 `field` 로 `details[]` 항목이 2개 생성됨(`optional-non-null.spec.ts` 로 이미 증명된 동작) — 파이프의 기존 구조이며 이번 PR 이 새로 만든 것 아님 | `codebase/backend/src/common/pipes/validation.pipe.ts` | 조치 불요. 후속으로 필드당 details 1개로 접을지 여부만 참고 |
| 11 | 문서화 | 테스트 docblock·트래커 문서가 아직 `plan/in-progress/` 에 있는 파일을 `plan/complete/patch-null-validation.md` 로 앞질러 인용 — 1R 이 이미 발견해 "마무리 커밋에서 해소"로 명시적으로 미룬 **의도된 지연** | `patch-null-rejection.spec.ts` 28행; `spec-draft-nullable-notation-followups.md` 1457/1464행 | 조치 불요. 2R 마무리 + `--impl-done` 통과 후 plan 이동과 함께 한 커밋에서 해소 |
| 12 | 부작용 | 43필드 null 입력에 대한 응답이 500/409/200(조용한 삭제)→400 으로 바뀌는 것은 공개 API 의 관측 가능한 계약 변경이지만, `CHANGELOG.md` 에 명시되고 프런트엔드 호출부 영향 0건이 grep 으로 확인된 **의도된 개선** | `codebase/backend/src/common/utils/optional-non-null.ts`; 13개 라우트 DTO | 조치 불요 — 이미 공지·게이트 통과 |
| 13 | 부작용 | e2e `beforeAll` 이 다수 DB 레코드(워크플로·노드·트리거 등)를 생성하고 `afterAll` 은 `db.end()` 만 하며 명시적 삭제 없음 — 저장소의 다른 e2e 스펙과 동일한 기존 컨벤션, 이번 PR 이 새로 도입한 패턴 아님 | `codebase/backend/test/patch-null-rejection.e2e-spec.ts:42-108` | 조치 불요, 기존 컨벤션 확인 기록 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | Critical/Warning 없음. IDOR 의심 백로그 항목 재확인(#2), W1·W2 조치 확인 |
| requirement | NONE | W1·W2 조치 확인, SPEC-DRIFT 원문 재검토(코드가 옳음), 43필드 전수 정합 재확인 |
| scope | NONE | `e5de5226c`·`3eec5f8be` 모두 선언된 범위 내에서만 변경, 스코프 이탈 없음 |
| side_effect | NONE | 유일한 부작용은 CHANGELOG 에 명시된 의도된 API 계약 변경(#12) |
| maintainability | LOW | INFO 5건 — 옵션 스프레드 순서(#4), `propertyKey` 캐스트 스타일(#5), 43 SoT 분산(#6), 신규 payload/expected 리터럴 중복(#7, 2R 신규), `url` 람다 반복(#8) |
| testing | LOW | W1 갭(모델 설정 happy-path) 해소 확인. 남은 INFO 2건(다중 null details #9, message 오버라이드 #4) 비차단 |
| documentation | NONE | W1·W2 문서 반영 확인. `plan/complete` 경로 조기 인용(#11)은 1R 이 이미 등재한 의도된 지연 |
| api_contract | LOW | W1·W2 조치 확인, breaking change 아님. SPEC-DRIFT(#1) + details 복수 항목 관찰(#10) |

## 발견 없는 에이전트

없음 — 8개 reviewer 모두 최소 1건 이상의 INFO(또는 SPEC-DRIFT)를 보고했으나, 신규 Critical/Warning 은 전원 0건이다.

## 권장 조치사항

1. (SPEC-DRIFT) 다음 planner 턴에서 `spec/5-system/2-api-convention.md` §5.4 에 "tri-state 의 null=초기화 분기는 `nullable: true` 선언 필드에만 적용"이라는 한 문장을 추가해 문면 모호성을 해소한다. 코드는 이미 옳으므로 revert 불필요, 이번 병합을 막지 않는다.
2. IDOR 의심 지점(#2, `folderId`/`containerId`/`toolOwnerId`/`llmConfigId` 워크스페이스 소속 미검증)은 이미 백로그에 "미검증·재현부터"로 등재돼 있으므로 별도 세션에서 e2e 재현을 우선 진행한다. 이번 PR 범위가 아니다.
3. (선택, 저priority) maintainability INFO 5건 — 특히 2R 에서 새로 지적된 #7(payload/expected 리터럴 중복)은 후속 커밋에서 상수 하나로 통합하면 향후 drift 를 예방한다. 병합을 막을 사안은 아니다.
4. 본 PR 은 Critical 0·Warning 0·forced 화이트리스트 전원 결과 확보로, 추가 조치 없이 병합 가능하다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract` (8명)
  - **제외**: 표 (6명, router 판단 — 개별 사유는 prompt 에 미제공)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명) — **forced 전원 결과 확보됨**, 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(사유 미제공) — 이번 diff 는 검증 데코레이터 교체뿐, 성능 영향 표면 아님으로 추정 |
  | architecture | router 판단(사유 미제공) — 아키텍처 변경 없음(신규 유틸 함수 1개 + DTO 데코레이터 치환) |
  | dependency | router 판단(사유 미제공) — 신규 의존성 추가 없음(기존 class-validator API 재사용) |
  | database | router 판단(사유 미제공) — 스키마/쿼리 변경 없음 |
  | concurrency | router 판단(사유 미제공) — 동시성 관련 코드 변경 없음 |
  | user_guide_sync | router 판단(사유 미제공) — 사용자 가이드 대상 UI 변경 없음(API 검증 동작만 변경) |