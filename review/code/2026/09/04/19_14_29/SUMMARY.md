# Code Review 통합 보고서

## 전체 위험도
**LOW** — 실질 변경은 서비스 로직이 소비한 적 없는 죽은 쿼리 파라미터(`QueryExecutionDto.workflowId`) 제거 1건. CRITICAL 없음. 유일한 실질 WARNING(외부 클라이언트 200→400 breaking change)은 두 reviewer(api_contract, side_effect)가 공통 지적했으나 CHANGELOG 문서화 + 신규 회귀 테스트로 이미 완화됨. forced whitelist(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보, 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | api_contract / side_effect (공통 지적) | `QueryExecutionDto.workflowId` 쿼리 필드 제거 + 전역 `forbidNonWhitelisted: true` 로 인해, 이 파라미터를 계속 보내는 **저장소 밖 제3자 클라이언트**는 `200`(무시)에서 `400`(거절)으로 응답이 바뀌는 breaking change. 저장소 내부 소비자(서비스·프런트·spec·e2e·OpenAPI 코드젠) 부재는 다수 reviewer가 독립 재확인했으나, 제3자 클라이언트 존재 여부는 액세스 로그 없이 확정 불가("미발견"≠"부재 확인"). 유예 기간·`Deprecation`/`Sunset` 헤더 없이 즉시 cutover. | `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` (필드 삭제), `CHANGELOG.md:17-24` | 코드 변경 불필요(설계 근거 타당, 이미 두 차례 리뷰에서 병합 가능 판정). CHANGELOG에 이미 반영된 "배포 시 확인" 경고를 실제 릴리즈 공지 채널에도 반영 권장. 향후 유사 케이스는 유예 기간/`Deprecation` 헤더 컨벤션화 고려. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | `workflowId` 필드 제거는 보안 관점에서 중립~긍정. 서비스가 애초에 이 값을 구조분해하지 않아 인젝션·IDOR 표면과 무관했고, 삭제 후 미지 키 요청은 조용한 무시 대신 명시적 400 거절(fail-closed 강화)로 바뀐다. 경로 파라미터 `workflowId`의 `ParseUUIDPipe` 검증과 `verifyWorkflowOwnership`(IDOR 방지)은 이번 diff와 무관하게 유지. | `codebase/backend/src/modules/executions/dto/query-execution.dto.ts`, `executions.controller.ts` | 조치 불요. |
| 2 | security / testing (신규 테스트 관련, 공통 관찰) | 신규 `forbidNonWhitelisted` 회귀 테스트가 전역 보안/검증 통제를 처음으로 회귀 고정(긍정). 다만 파이프 레벨 유닛 테스트라 `GET .../workflow/:workflowId?workflowId=...` 실제 라우팅·가드 체인을 통과한 종단(e2e) 보증은 아니며, `ArgumentMetadata.type`은 구현이 실제로 사용하지 않는 장식적 필드. | `codebase/backend/src/common/pipes/validation.pipe.spec.ts:86-116` | 조치 불요(필수 아님). 종단 보증이 필요해지면 `workflow-execution.e2e-spec.ts`에 `?workflowId=<uuid>` → 400 negative 케이스 1건 추가. |
| 3 | testing | `narrowMeta` 상수를 두 `it()`이 공유하지만 `pipe.transform()`이 인자를 변형하지 않는 순수 함수라 현재는 격리 안전. 향후 테스트가 이 객체를 mutate하도록 바뀌면 오염 여지. | `validation.pipe.spec.ts` (신규 `describe` 블록) | 조치 불요, 참고만. |
| 4 | security / scope / side_effect (공통 관찰) | 함께 커밋된 리뷰/consistency 산출물 32~33개 파일은 `CLAUDE.md` "정보 저장 위치" 표가 규정한 표준 경로(`review/code/**`, `review/consistency/**`)의 정상 부산물이며 문서 전용, 하드코딩 시크릿 없음. 표본 확인 결과 전부 이번 단일 작업에 관한 내용. | `review/code/2026/09/04/{18_34_04,18_56_22}/*`, `review/consistency/2026/09/04/18_51_26/*` | 조치 불요. |
| 5 | requirement | 저장소 밖 제3자 클라이언트의 breaking change는 이번 diff 관측 범위 밖으로 남아 있음(위 WARNING #1과 동일 사안의 다른 각도 서술). | `query-execution.dto.ts` 클래스 JSDoc / `CHANGELOG.md` "영향" 절 | 조치 불요 — 이미 CHANGELOG에 "배포 시 확인" 경고 반영. |
| 6 | maintainability / side_effect (공통 확인) | 직전 두 리뷰 라운드가 지적한 결함(신규 테스트 언어 혼재, ephemeral 리뷰 세션 ID를 영구 주석 근거로 인용)이 최신 커밋(`22d1ec1ab`)에서 실제로 해소됨을 재확인 — 파일 전체 영어 통일, JSDoc 추적 링크가 SoT 문서(`plan/in-progress/spec-draft-nullable-notation-followups.md`)를 인용. | `validation.pipe.spec.ts:72-116` | 조치 불요(확인용 기록). |
| 7 | maintainability | "workflowId 제거" 서사(200→400, 실측 1,095/17/0)가 CHANGELOG·plan·DTO JSDoc·pipe spec JSDoc 네 곳에 중복 기재. 두 라운드 연속 INFO로 유지, 정량 수치는 `grep` 대조로 세 곳 모두 일치해 실질 동기화 사고는 없음. | `CHANGELOG.md:23-40`, `plan/in-progress/spec-draft-nullable-notation-followups.md:307-323`, `query-execution.dto.ts:5-14`, `validation.pipe.spec.ts:72-85` | 조치 불요. 다섯 번째 중복 자리가 생기면 한쪽을 SoT로 지정하고 나머지는 링크로 축약 고려. |
| 8 | maintainability / security / side_effect (공통 확인) | `swagger-dto-contract-guard.ts` 변경은 순수 JSDoc 재서술이며 판정 로직(`findSwaggerContractMismatches`, `@Transform` 예외 조건)은 diff 전후 동일함을 `Read`로 대조 확인. | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:92-121` | 조치 불요. |
| 9 | maintainability | `query-execution.dto.ts`의 필드 제거 diff는 죽은 필드와 미사용 import(`IsUUID`, `Transform`)를 정확히 함께 제거해 범위가 제거 대상에 정확히 국한됨(긍정 관찰). | `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` (전체) | 조치 불요. |
| 10 | side_effect | 신규 테스트는 로컬 전용 클래스(`NarrowDto`, export 안 됨)와 자체 `pipe` 인스턴스를 사용해 격리돼 있고, `CustomValidationPipe`는 인스턴스 필드가 없는 stateless 클래스라 전역/공유 상태 오염 없음. | `validation.pipe.spec.ts:86-116` | 조치 불요. |
| 11 | documentation | CHANGELOG에 신규 회귀 테스트(`forbidNonWhitelisted` describe 블록) 추가 사실이 언급되지 않음. 필수 사항은 아니나 향후 CHANGELOG만 보고 회귀 커버리지 유무를 판단하려는 사람에게 도움이 될 수 있음. | `CHANGELOG.md` (Unreleased 항목 전체) | 선택 사항: "영향" 절 말미에 회귀 테스트로 고정됐다는 한 줄 추가. |
| 12 | documentation | `swagger-dto-contract-guard.ts` JSDoc의 인용 블록(`>`) 종료 직후 비-인용 문장이 줄바꿈으로 이어져 시각적 전환이 다소 어색함(순수 스타일, 판정 로직 무관). | `swagger-dto-contract-guard.ts:118-120` | 조치 불요 — 스타일 참고. |
| 13 | api_contract | 신규 CHANGELOG 항목이 이 저장소가 기존에 써 온 breaking-change 태깅 컨벤션(`**Behavior change (breaking): ...**` 또는 `### Breaking changes` 헤더)을 따르지 않음 — "breaking" 키워드 부재로 `grep -i breaking` 훑는 릴리즈 담당자가 놓칠 수 있음. | `CHANGELOG.md:3` | 헤더 또는 본문 첫 문장에 "(breaking)" 표시 추가. |
| 14 | api_contract | URL/경로 설계 관점에서는 이번 변경이 계약을 개선 — 경로 파라미터와 쿼리 파라미터가 같은 리소스를 이중 지시하던 구조적 모순 제거(긍정 소견). | `query-execution.dto.ts` 클래스 JSDoc | 조치 불요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 필드 제거는 보안 중립~긍정(fail-closed 강화), 시크릿 노출 없음 |
| requirement | LOW | 기능적으로 완전·안전, 전 소비처 교차검증 및 테스트 실행 통과. 유일 잔여는 제3자 클라이언트 관측 불가(INFO) |
| scope | NONE | 단일 작업(`workflowId` 제거)에 정확히 수렴, 요청 외 변경 없음 |
| side_effect | LOW | 200→400 breaking change(WARNING, 완화됨), 그 외 부작용 없음 |
| maintainability | NONE | 이전 라운드 지적사항 해소 확인, 구조적 결함 없음(중복 서사만 INFO) |
| testing | LOW | 신규 회귀 테스트 5/5·가드 테스트 19/19 통과, 뮤테이션 재검증 일치. e2e negative 케이스 부재는 INFO |
| documentation | NONE | JSDoc·spec 인용·plan 정합 전부 재검증 일치, CHANGELOG 태깅·회귀테스트 언급 누락은 INFO |
| api_contract | LOW | 200→400 breaking change(WARNING, 완화됨), 그 외 계약 개선(경로/쿼리 중복 해소) |

## 발견 없는 에이전트

없음 — 8개 reviewer 전원 결과 확보(INFO 이상 발견 최소 1건씩 존재).

## 권장 조치사항
1. (선택) CHANGELOG 헤더/본문에 "(breaking)" 키워드를 추가해 breaking-change 태깅 컨벤션을 준수하고, 배포 시점에 실제 릴리즈 공지 채널에도 200→400 회귀 가능성을 반영.
2. (선택) `workflow-execution.e2e-spec.ts`에 `?workflowId=<uuid>` → 400 negative 케이스 1건을 추가해 종단(e2e) 보증을 완성.
3. (선택) CHANGELOG "영향" 절에 신규 `forbidNonWhitelisted` 회귀 테스트 존재를 한 줄 언급.
4. 코드 변경 없이 병합 가능 — 위 항목은 모두 INFO/이미 완화된 WARNING이며 차단 사유 없음.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract` (8명)
  - **제외**: 표 (6명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(죽은 쿼리 필드 제거 + 유닛 테스트 추가)와 무관 |
  | architecture | 아키텍처 구조 변경 없음 |
  | dependency | 의존성 변경 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 관련 로직 변경 없음 |
  | user_guide_sync | 사용자 가이드 대상 기능 변경 없음 |