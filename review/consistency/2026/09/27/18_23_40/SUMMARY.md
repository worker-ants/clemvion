# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전원 성공(전문 확보), Critical 0건. WARNING 5건(중복 제거 후) · INFO 4건은 모두 기존 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 (10))에 이미 등재됐거나 이번 라운드에서 새로 발견된 저위험 문서-동기화 갭이며 어느 것도 구현 자체(43필드 null-거부 스윕)의 정합성을 흔들지 않는다.

## 전체 위험도
**LOW** — 전 checker 가 LOW 로 수렴. `spec/2-navigation/` 델타는 0(코드 전용 PR), 이미 2라운드 `/ai-review`(Critical 0·Warning 0)와 `--impl-prep`(BLOCK:NO)를 통과한 변경에 대한 재확인 성격이 강하다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 이번 라운드에 Critical 이 없으므로 인계 대상 없음. 다만 아래 WARNING 중 §5.4 블록쿼트 갱신·`2-trigger-list.md` 서술 보강은 어차피 `spec/` 쓰기 권한이 필요해 planner 턴 몫이며, 이미 `spec-draft-nullable-notation-followups.md` 트래커에 등재돼 있다(권장 조치 참고).

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity | §5.4 PATCH tri-state 블록쿼트("null=초기화")가 이번 43필드 null-거부와 문언상 어긋나 보임 — 단 이미 트래커에 등재된 기존 항목, 구현 자체는 §5.4 취지(선언과 런타임 일치)를 따름 | `spec/5-system/2-api-convention.md §5.4` 블록쿼트 | `codebase/backend/src/common/utils/optional-non-null.ts` + 43개 DTO 필드 | 이번 PR 범위 조치 불요. planner 턴에서 `spec-draft-nullable-notation-followups.md` 항목 (10) 이행 — §5.4 에 "미선언(non-nullable) 필드의 null 은 400" 한 문장 추가 |
| 2 | cross_spec | `settings.maxConcurrentExecutions`(워크플로·워크스페이스)가 null-거부 스윕에서 제외돼 spec 의 "hard-fail" 서술과 실측(에러 0건, null 저장까지 도달)이 어긋남 — 실측 확인, 이미 트래커에 등재된 의도적 제외 | `WorkflowSettingsDto`/`UpdateWorkspaceSettingsDto` 의 `maxConcurrentExecutions`(`@IsOptional()` 그대로) | `spec/2-navigation/1-workflow-list.md §3.2`(6번 "미지 키·비양수·비정수는 400") + `## Rationale` §2 | 이번 PR 범위 조치 불요(트래커에 열려 있음). 후속 PR 에서 `IsOptionalNonNull` 전환 또는 spec "hard-fail" 서술 완화 중 하나를 명시적으로 결정 |
| 3 | convention_compliance | `endpointPath` null-거부 캐비엇이 `swagger.md §3` "보안·정책 캐비엇" 의 요약+SoT-링크 패턴 중 링크 축을 빠뜨림 — 그 링크가 가리킬 spec 본문도 아직 이 캐비엇을 담지 않음 | `update-trigger.dto.ts` `endpointPath` JSDoc/`@ApiPropertyOptional` | `spec/conventions/swagger.md §3` (자매 필드 `botTokenRef`/`inboundSigningRef` 는 SoT 링크 명시) | `2-trigger-list.md §2.3.1` `endpointPath` 행에 null-거부(400) 한 줄 추가 + DTO description 을 그 앵커로 축약 (아래 #4 와 동일 근본 원인, 함께 처리) |
| 4 | plan_coherence | 트래커 항목 (10) 의 범위가 `2-trigger-list.md` 의 `endpointPath` 서술 갱신을 명시적으로 포함하지 않음 — 문구 그대로 이행해도 이 필드의 spec 서술 갭은 안 닫힘 | `spec/2-navigation/2-trigger-list.md §2.3.1` 필드 권한 매트릭스 `endpointPath` 행, §3 註 | `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 (10) 현재 문구(§5.4 + `9-user-profile.md` §6.1 만 명시) | 트래커 항목 (10) 에 "`2-trigger-list.md` §2.3.1 endpointPath 행·§3 註에 null 거부(400) 한 줄 추가"를 명시적으로 보강 — planner 턴에서 §5.4 문장과 함께 처리하도록 스코프 확장 |
| 5 | naming_collision | 신규 `IsOptionalNonNull()`(요청 DTO 검증)이 기존 "optional-non-nullable"(응답 계약, `response-contract.ts`/`trigger-workflow-ref.ts`) 어휘와 철자상 거의 동일 — 서로 다른 레이어인데 상호 참조 없음 | `codebase/backend/src/common/utils/optional-non-null.ts:14` | `codebase/backend/src/shared/testing/response-contract.ts:259-269`, `trigger-workflow-ref.ts:65` | `optional-non-null.ts` JSDoc 에 "응답 계약의 optional-non-nullable(§5.4, response-contract.ts)과는 별개 — 이쪽은 요청 DTO 입구 검증" 한 줄 추가. 리네임 불요 |

> #3·#4 는 근본 원인이 같다(`2-trigger-list.md §2.3.1` 이 endpointPath 의 null-거부 400 을 아직 서술하지 않음) — planner 턴에서 트래커 항목 (10) 보강 한 번으로 동시에 해소된다.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `interactionAllowedOrigins` PATCH 바디 표기에 `?` 누락(실제로는 완전 optional) | `spec/2-navigation/9-user-profile.md §6.1` | 트래커 항목 (10) 이행 시 함께 수정(이미 등재) |
| 2 | rationale_continuity | 검증 층 표에 신규 헬퍼(`optional-non-null.ts`) 미등재 | `spec/5-system/2-api-convention.md §5.4` "검증 층" 표 | planner 턴에서 표 갱신 시 함께 추가 고려 |
| 3 | convention_compliance | 신규 회귀 테스트(`patch-null-rejection.spec.ts`)가 `repo-guards/__tests__/` 의 지배적 AST-가드 페어링 형태와 다름(완전한 전례 없음은 아님 — `esm-native-load.spec.ts` 선례 존재) | `codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts` | 조치 불요에 가까움. 다음에 같은 종류 테스트 추가 시 도메인 근접 위치 우선 검토 또는 디렉터리 역할을 `swagger.md` 에 한 문장 명문화 |
| 4 | naming_collision | `omit-undefined.ts`/`optional-non-null.ts` 는 같은 PATCH tri-state 축의 짝인데 서로 미참조 | `codebase/backend/src/common/utils/{omit-undefined,optional-non-null}.ts` | 필수 아님 — JSDoc 상호 링크 한 줄 정도의 사소한 보완 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | §5.4 tri-state 문언 불일치·`maxConcurrentExecutions` 제외 — 둘 다 실측 확인됐으나 이미 트래커 등재된 기존 항목, 신규 아님 |
| rationale_continuity | LOW | §5.4 gap 은 기각된 대안 재도입 아님, 오히려 §5.4 취지(선언-런타임 일치)를 필드별로 정확히 지킴. INFO 2건 |
| convention_compliance | LOW | `endpointPath` 캐비엇의 SoT-링크 누락(WARNING), 신규 테스트 위치 형태 차이(INFO). 나머지 규약(에러코드·swagger 명명·PATCH tri-state 경계)은 전부 준수 확인 |
| plan_coherence | LOW | 트래커 항목 (10) 스코프가 `2-trigger-list.md` endpointPath 서술을 놓침 — 두 라운드 리뷰·`--impl-prep` 통과 이력과 정합 |
| naming_collision | LOW | `IsOptionalNonNull` vs 기존 "optional-non-nullable"(응답 계약) 어휘 근접 — 설계 결함 아니나 grep 오인 소지. 신규 엔티티·endpoint·에러코드·ENV 충돌은 전수 확인 결과 0건 |

## 권장 조치사항
1. (이번 PR 비차단, planner 턴 권장) `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 (10) 스코프를 `spec/2-navigation/2-trigger-list.md §2.3.1` endpointPath 행·§3 註 갱신까지 명시적으로 확장 — WARNING #3·#4 동시 해소.
2. (planner 턴, 이미 등재) 항목 (10) 원안대로 `spec/5-system/2-api-convention.md §5.4` 블록쿼트에 "미선언 필드의 null 은 400" 한 문장 추가, `9-user-profile.md §6.1` `interactionAllowedOrigins?` 표기 수정.
3. (후속 PR, 이미 등재) 워크플로/워크스페이스 `settings.maxConcurrentExecutions` 의 null 처리를 `IsOptionalNonNull` 전환 또는 spec "hard-fail" 서술 완화 중 하나로 명시적으로 결정.
4. (선택, developer 권한 내) `common/utils/optional-non-null.ts` JSDoc 에 응답 계약 `response-contract.ts` 의 "optional-non-nullable" 과 별개 레이어임을 한 줄 명시 — 이 PR 또는 사소 후속 커밋으로 처리 가능.
5. (선택, 저위험) INFO 4건(검증 층 표 갱신·테스트 디렉터리 역할 명문화·`omit-undefined`/`optional-non-null` 상호 링크)은 다음 관련 편집 시 함께 처리.