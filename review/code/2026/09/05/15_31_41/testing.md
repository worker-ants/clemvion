# 테스트(Testing) 리뷰

## 검증 방법

`origin/main..HEAD` 11개 커밋 전체(§5.4 응답 계약 검증자 신설 → `AuditLogsService.findAll`
민감정보 유출 수정 → 자기참조/`oneOf` 사각지대 수정 → union `allowUndeclared` 캐너리)를 대상으로,
현재 저장소 최종 상태를 `Read`로 직접 열어 다음을 대조했다.

- `codebase/backend/src/shared/testing/response-contract.ts` / `.spec.ts` (전문)
- `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` / `.spec.ts` (전문)
- 4개 e2e 스펙(`audit-logs`/`session-revocation`/`workflow-crud`/`workflow-execution`)의 계약 대조
  배선 지점
- 이전 3라운드(`13_49_54`, `14_39_31`, `15_12_02`)의 `testing.md`·`RESOLUTION.md`를 읽어, 그
  라운드들이 낸 Critical/WARNING/INFO가 이번 최종 상태에서 실제로 해소됐는지 재확인

저장소 트리에는 아무것도 쓰지 않았다(읽기 전용, `git status --short` 로 무변경 확인).

## 이전 라운드 대비 회귀 확인 (전부 해소됨)

- `13_49_54` Critical(감사 로그 `user` 26키 유출) — `leftJoin`+`addSelect(['user.id','user.name','user.email'])` 전환 + unit(`qb.leftJoin`/`addSelect` 호출 단언, `leftJoinAndSelect` 부재 단언) + e2e(계약 대조 + `Object.keys(user).sort()` 독립 캐너리) 이중 고정. **해소 확인.**
- `14_39_31` Critical(자기참조 DTO 순환 가드가 스키마 이름 기반이라 내부가 통째로 미검사 통과) — 방문 집합을 payload 객체 동일성으로 교체, 1단계·2단계 위반 주입 테스트(`response-contract.spec.ts` "자기참조 스키마의 첫 단계 내부가 검사된다"/"두 단계 아래도 잡는다") + 값 그래프 순환 종료 테스트로 **해소 확인**(vacuous였던 이전 캐너리가 실제 위반을 주입하는 형태로 교체됨).
- `14_39_31` WARNING(판별자 없는 `oneOf`/`anyOf` 아래가 사각지대) — `visitUnion` 추가, `UnionDto`/`VariantADto`/`VariantBDto` 픽스처로 "어느 변형에 있으면 통과", "어느 변형에도 없으면 undeclared", "required 강제 안 함" 3테스트로 **해소 확인.**
- `15_12_02` INFO#1(`visitUnion`의 `allowUndeclared` 면제 분기가 어떤 테스트에도 안 걸림 — 지워도 스펙 전부 통과) — 뮤턴트 생존을 먼저 실측(36/36 통과)한 뒤 캐너리(`'allowUndeclared 는 union 아래에서도 먹는다'`, `response-contract.spec.ts:369-379`) 추가. **해소 확인**(그 뮤턴트가 이제 그 테스트 하나만 실패시킴을 커밋 메시지가 실측으로 밝힘).
- `15_12_02` INFO#2(`visitUnion`의 `_onPath` 미사용 파라미터) — 파라미터 제거 + docstring에 "union 아래로는 안 내려가므로 순환 가드 불필요" 명시. **해소 확인.**

## 발견사항

- **[INFO]** `descend()`의 방어 분기(`referencedNames`가 반환한 이름이 `contract.schemas`에 없는 경우)가 어떤 테스트로도 물리지 않는다 — 이 도구가 잡으려는 것과 같은 성격의 "조용한 미검사 통과"를 자기 자신 안에 남겨 둔다
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:201-204` (`nested` 매핑+필터 후 `if (nested.length === 0) return;`)
  - 상세: `$ref`/`allOf`로 참조된 스키마 이름이 `walk.contract.schemas`(생성 문서의 `components.schemas`)에 없으면 이 함수는 조용히 리턴해 그 하위를 전혀 검사하지 않는다. 지금 `response-contract.spec.ts`의 모든 중첩 픽스처(`NestedDto`, `CycleDto`, `UnionDto`/`VariantADto`/`VariantBDto`)는 전부 실제 NestJS 데코레이터로 등록돼 있어 `schemas`에 항상 존재하므로, 이 필터를 통째로 지워도(뮤테이션) 현재 스펙은 아마 전부 통과한다 — 확인은 안 했지만(저장소에 뮤테이션을 넣지 않음, 규약 준수) 코드 구조상 그렇게 보인다. 실무에서 이 분기가 실제로 걸리는 경우는 DTO가 `@ApiExtraModels` 없이 `getSchemaPath()`로만 참조되거나 스키마 생성 파이프라인이 예상과 다르게 동작할 때인데, 정확히 이런 "선언은 있는데 생성 문서에 반영이 안 된" 상황이 이 PR이 막으려는 "선언 vs 실제"의 불일치와 같은 축이다. 지금 위험도는 낮다(스윕 대상 DTO들이 전부 표준 데코레이터 패턴을 쓰는 한 발생하지 않음) — 다만 커버리지 갭으로 기록해 둔다.
  - 제안: 필수 아님. 여유가 있다면 `schemas`에서 못 찾는 경우를 별도 위반(예: `'unresolved-ref'`)으로 승격하거나, 최소한 이 분기를 잠깐 지워서 실제로 어떤 스펙도 안 깨지는지 한 번 뮤테이션 확인 후 캐너리 추가 여부를 판단.

- **[INFO]** `workflow-execution.e2e-spec.ts`에 배선된 `assertMatchesContract`가 항상 "정상 완료" 경로만 대조한다 — `ExecutionDto`의 실패/진행 상태 전용 필드(`error`, `finishedAt`/`durationMs`의 값-존재 케이스 등)는 이 계약 대조로 한 번도 검증되지 않는다
  - 위치: `codebase/backend/test/workflow-execution.e2e-spec.ts:116-156` (테스트 `'B. GET /api/executions/workflow/:workflowId ...'`) — `createWorkflow()`(84행)가 매번 노드 실행 실패 없는 Manual Trigger 전용 워크플로우를 만들고, `pollExecution`이 `TERMINAL_STATUSES`(28행: `completed`/`failed`/`cancelled`) 중 아무 상태에서나 멈추면 그 1건을 그대로 `assertMatchesContract`에 넘긴다
  - 상세: 이 워크플로우는 노드가 없거나 실행이 실패할 조건이 없어 실제로는 항상 `completed`로 끝난다(다른 테스트들의 `grep` 결과 이 파일에 `failed` 상태를 의도적으로 만드는 시나리오가 없음). `ExecutionDto.error`는 `@ApiPropertyOptional`(키 생략형+nullable 추정)로 선언돼 있어, 이 계약 대조는 "필드가 없어도 된다"만 계속 확인하고 "필드가 있고 값이 채워진 실패 케이스의 형태가 선언과 맞는지"는 한 번도 실측하지 않는다. `13_49_54/api_contract.md`가 이미 `ExecutionDto` 22필드 중 10개가 "optional+nullable" 형태라 커버리지가 과장될 수 있다고 지적했는데, 이 갭은 그 지적의 구체적 사례 하나다 — required 필드는 이 배선으로 강하게 물리지만, 실패 상태에서만 채워지는 필드들의 "존재+비-null" 형태는 이 PR의 어떤 테스트로도 실측되지 않는다.
  - 제안: 필수 아님(이번 PR 범위인 §5.4 값-검사기 자체의 정확성은 `response-contract.spec.ts`의 합성 픽스처로 이미 독립적으로 검증됨). 여유가 있으면 실패 노드를 포함한 워크플로우를 별도로 실행해 `failed` 상태의 `ExecutionDto` 응답도 한 번 `assertMatchesContract`에 넘기는 캐너리를 추가하면 이 커버리지 갭이 닫힌다.

- **[INFO]** (회귀 확인, 조치 불요 — 이미 처분됨) `AuditLogDto.user`의 `nullable: true` 분기, `AuditLogsService.findAll`의 `getSortColumn`/`action`/`resourceType`/`startDate`/`endDate` 필터 미검증, "find→toBeDefined→assert" 3문장 반복은 `15_12_02/RESOLUTION.md`에서 각각 "다른 트랙"/"기존 갭"/"이미 등재"로 명시 처분됐고 이번 diff는 이 경로들을 건드리지 않았다. 재지적하지 않는다 — 다시 올리면 "이미 유예된 항목을 매 라운드 재지적"하는 루프가 된다.

## 좋았던 점 (참고)

- 이번 PR의 개발 프로세스 자체가 테스트 리뷰가 요구하는 걸 이미 실천하고 있다: 각 fix 커밋이 "뮤턴트를 먼저 실측 → 그 뮤턴트를 정확히 잡는 캐너리 추가"를 반복했다(`db45d1b09`의 자기참조 vacuous 캐너리 교체, `bf02fe328`의 `allowUndeclared` 뮤턴트 생존 확인 후 캐너리 추가). 회귀 방지 코멘트가 "왜 예전 테스트가 거짓 통과였는지"를 실측 수치와 함께 남겨, 같은 실수의 재발을 막는 방식으로 잘 문서화돼 있다.
- `response-contract.spec.ts`는 §5.4 네 가지 선언 형태(required+non-nullable / required+nullable / 키 생략형 / 키 생략형+nullable)를 한 픽스처(`ProbeDto`)에 전부 모아 각 규칙을 독립 축으로 물고, `[전제]` 테스트로 "스키마가 실제로 그 축들을 담고 있는가"를 먼저 확인해 vacuous-test 함정을 스스로 방어한다.
- 감사 로그 유출 회귀는 unit(`qb.leftJoin`/`addSelect` 호출 인자 + `leftJoinAndSelect` 프로퍼티 부재 단언)과 e2e(계약 대조 + `Object.keys(user).sort()` 독립 캐너리) 두 층에 있어, "검증자 자체가 놓친 결함"이라도 단위 층이 잡을 수 있게 이중화돼 있다.
- 4개 e2e 스펙 전부 `beforeAll`에서 계약을 1회 생성해 재사용하는 형태로 통일됐고(이전 라운드 지적 해소), 기존 unique email/name 격리 패턴을 그대로 따라 새로운 테스트 간 의존성을 만들지 않는다.

## 요약

이전 세 라운드가 낸 Critical 2건(감사 로그 민감정보 유출, 자기참조 DTO 검증 우회)과 WARNING 1건(`oneOf`/`anyOf` 사각지대), INFO 2건(`allowUndeclared` union 미검증, 미사용 파라미터)이 모두 실측 기반으로 해소되고 판별력 있는 회귀 테스트로 고정된 것을 현재 코드에서 직접 확인했다. 이번 라운드에서 새로 발견한 것은 전부 INFO 수준의 좁은 커버리지 갭이다 — `descend()`의 방어 분기(참조된 스키마가 생성 문서에 없는 경우)가 어떤 테스트로도 안 걸리는 점과, `workflow-execution` e2e 배선이 실패 상태의 `ExecutionDto` 필드 형태를 한 번도 실측하지 않는 점이다. 둘 다 이 PR의 핵심 로직(§5.4 값 검사기 자체)의 정확성에는 영향이 없고, 검사기 자체는 합성 픽스처로 이미 독립 검증돼 있다. 발견의 성격이 라운드를 거치며 "동작 결함 → 구조/미검증 경로"로 계속 내려가고 있어 수렴 신호로 읽힌다. 병합을 막을 사유는 없다.

## 위험도

LOW
