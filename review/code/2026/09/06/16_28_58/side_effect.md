# 부작용(Side Effect) 리뷰

## 개요

이번 diff 는 `User` 엔티티 컬럼 노출 방어 3축(구조 가드 `user-entity-exposure-guard.ts`,
JSDoc 인용 가드 `dto-jsdoc-citation-guard.ts`, 값 기반 `user-secret-absence.ts`) 신설과,
그 과정에서 드러난 두 개의 실제 결함 수정(`WorkflowVersionsService.findOne` 의 `User` 전
컬럼 유출, `TriggersService` 의 `endpoint_path` UNIQUE 충돌 계약 미구현)으로 구성된다.
`.claude/hooks/_lib/review_guard.py` 의 YAML frontmatter 파서 변경도 이 라운드에 포함돼
있다. 각 항목을 직접 코드를 열어 호출부·부작용 표면을 확인했다.

## 발견사항

- **[INFO]** `TriggersService.create`/`update` 가 `save()` 실패 시 예외 형태를 바꿔 던진다 — 의도된 계약 정렬이며 다른 경로에 영향 없음을 확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `create()` 의 `triggerRepository.save(trigger).catch(...)` 호출부, `update()` 의 동일 패턴, 그리고 새 private 메서드 `rethrowEndpointPathConflict`
  - 상세: 종전에는 `(workspace_id, endpoint_path)` UNIQUE 위반이 그대로 전역 `GlobalExceptionFilter` 로 올라가 `details` 없는 일반 `RESOURCE_CONFLICT` 를 냈다. 이제 `create`/`update` 가 `save()` 의 rejection 을 가로채, 해당 인덱스(`idx_trigger_workspace_endpoint`) 위반일 때만 `details: { field, code }` 를 실은 `ConflictException` 을 새로 던지고, **그 외 모든 에러(다른 UNIQUE 위반 포함)는 원본 그대로 rethrow** 한다 — 코드를 직접 읽어 else 분기가 `throw err` 로 원본을 보존함을 확인했다. `isPostgresUniqueViolation`/`pgErrorConstraint` 를 이 파일 밖에서 사용하는 유일한 다른 호출자(`integration-oauth.service.ts`)는 이 변경과 무관한 별개 호출이다. 트랜잭션 매니저로 감싸여 있지 않아 partial-write 우려도 없다. spec(`2-trigger-list.md §3`)이 이미 이 형태를 계약으로 적어 두었던 것을 구현이 못 따라가고 있던 상태였으므로, 이는 API 응답 바디에 필드가 **추가**되는 방향의 정렬이지 기존 소비자가 의존할 수 있던 필드를 제거·변경하는 방향이 아니다.
  - 제안: 조치 불요 — 문서화·양방향 단위 테스트(맞는 인덱스명/다른 인덱스명/비-unique 에러 3갈래)로 이미 고정돼 있다.

- **[INFO]** `WorkflowVersionsService.findOne` 반환 타입이 `Promise<WorkflowVersion>` → `Promise<WorkflowVersionDetail>` 로 좁혀짐 — 유일 호출자 확인, 영향 없음
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` — `findOne()` 시그니처 및 `WorkflowVersionDetail` 타입 정의(`creator`/`workflow` 관계 제외)
  - 상세: 이 서비스 메서드를 호출하는 곳은 저장소 전체에서 두 곳뿐이다 — 컨트롤러(`workflow-versions.controller.ts:81`, 결과를 그대로 반환하는 것이 바로 이번 수정의 목적)와 `WorkflowsService.restoreVersion`(`workflows.service.ts:666`). 후자를 직접 열어 확인한 결과 `target.snapshot`·`target.version` 두 필드만 사용하며, 둘 다 `WorkflowVersionDetail` 에 그대로 남아 있어 컴파일·런타임 모두 영향이 없다. `creator` 를 참조 3필드로 좁히고 로드되지 않는 `workflow` 관계를 타입에서 제외한 것은 이번 PR 이 의도한 보안 수정 그 자체(응답에서 `User` 전 컬럼을 빼는 것)이며, 프런트엔드의 손으로 맞춘 미러 타입(`codebase/frontend/src/lib/api/workflows.ts` 의 동명 `WorkflowVersionDetail`)은 이미 더 넓은 옵셔널 형태(`creator?: {...} | null`)라 이 좁힘과 충돌하지 않는다는 점도 diff 주석에 명시돼 있다.
  - 제안: 조치 불요.

- **[INFO]** `review_guard.py` 의 frontmatter `code:` 파서 변경은 이 PR 자신의 diff 범위를 넘어 저장소 전체 spec 의 게이팅 판정에 영향을 미친다 — 의도되고 실측된 변경
  - 위치: `.claude/hooks/_lib/review_guard.py` 의 `_parse_frontmatter_code`(블록 리스트 루프가 빈 줄·`#` 줄 전체 주석에서 더 이상 `break` 하지 않고 `continue`, 트레일링 주석 절단 로직 `_strip_comment` 신설)
  - 상세: 이 함수는 이 PR 이 건드리지 않은 다른 `spec/**/*.md` 파일들의 `code:` glob 해석 결과도 바꾼다 — 즉 이번 diff 의 "부작용" 은 이 PR 소스 파일에 국한되지 않고 **push/commit 게이팅 인프라 자체의 전역 판정**에 미친다. docstring·CHANGELOG·plan 노트에 실측(spec 387개 중 7개 파일에서 41개 entry 유실 확인, 프런트엔드 파서와 731/731 일치)이 함께 실려 있고, 캐싱이나 모듈 전역 상태 없이 매 호출마다 파일을 새로 읽는 순수 함수임을 확인했다(다른 은닉된 부작용 없음). 게이팅을 더 엄격하게(더 많은 파일을 spec-linked 로) 만드는 방향이라 안전 쪽으로의 변경이다.
  - 제안: 조치 불요 — 이미 여러 라운드에 걸쳐 반대 방향 대조군(다음 키에서는 여전히 멈춘다·따옴표 안의 `#`·앞 공백 없는 `#`)까지 테스트로 고정돼 있음을 `.claude/tests/test_review_guard.py` 에서 확인했다.

## 요약

이번 diff 가 만드는 실질적 부작용 표면은 세 가지다 — (1) `TriggersService` 의 예외 응답 형태 변경, (2) `WorkflowVersionsService.findOne` 의 반환 타입/응답 형태 축소, (3) `review_guard.py` 파서가 이 PR 범위 밖 spec 파일들의 게이트 판정에 미치는 파급. 세 가지 모두 직접 호출부·소비자를 추적해 확인한 결과 의도된 변경이고, 다른 경로·다른 파일에 예상치 못한 규모로 영향을 주지 않음을 확인했다(각각 유일 호출자 검증, 다른 에러 유형 passthrough 검증, 순수 함수·무상태 검증). 새로 도입된 전역 변수는 없고(`CREATOR_PROJECTION`/`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX` 는 모두 `Object.freeze` 되거나 불변 모듈 상수), 신설된 정적 분석 가드(`user-entity-exposure-guard.ts`/`dto-jsdoc-citation-guard.ts`)는 `fs.readFileSync` 로만 읽고 쓰기·네트워크·환경변수 접근이 전혀 없음을 grep 으로 직접 확인했다. e2e 신규 케이스(`workspace-rbac.e2e-spec.ts` J, `workflow-crud.e2e-spec.ts` H)의 라벨도 기존 A~I/G 체계와 충돌하지 않음을 직접 파일에서 확인했다. 새로 지적할 CRITICAL/WARNING 급 부작용은 없다.

## 위험도

LOW
