# API 계약(API Contract) 리뷰

## 작업 트리 이상 상태 (관측 보고 — 본 리뷰의 뮤테이션 아님)

리뷰 시작 시 `git status --short` 에 다음 미커밋 변경이 이미 존재했다(본 세션이 만든 변경이 아니다 — 저장소에 아무것도 쓰지 않았음):

```
 M codebase/backend/src/modules/nodes/nodes.service.ts
```

`git diff` 로 확인한 내용은 아래와 같이 `nodes.service.ts` 의 `update()` 반환문이 프롬프트에 제시된 커밋 버전과 다르다:

```diff
-    const { workflow: _workflow, ...response } = saved;
-    return response;
+    return saved as unknown as Omit<Node, 'workflow'>;
```

이 변경은 **타입 단언(`as unknown as`)만으로 `workflow` 필드를 "제거된 것처럼" 타입 체크를 통과**시키지만 런타임에는 `saved` 객체에 `workflow` 가 그대로 남아 응답에 다시 실린다 — 이 PR 이 고친 undeclared 필드 유출 결함을 재도입하는 형태의 뮤턴트로 보인다(다른 fan-out reviewer의 검증용 변형일 가능성이 높음). 본 리뷰는 이 파일을 되돌리거나 추가로 건드리지 않았다 — 병렬 세션 오염 방지 규약에 따라 관측 사실만 보고한다. 아래 모든 발견사항·평가는 **프롬프트에 제시된 커밋된 diff**(정상 수정본, `const { workflow: _workflow, ...response } = saved; return response;`) 기준이다.

## 발견사항

- **[INFO]** `PATCH /nodes/:id` 응답에서 undeclared `workflow` 관계 필드를 제거 — 관측 가능한 응답 형태 변화
  - 위치: `codebase/backend/src/modules/nodes/nodes.service.ts:78` (`Object.assign(node, omitUndefined(dto))`) 및 `:82` (`const { workflow: _workflow, ...response } = saved;`)
  - 상세: 이전에는 `update()` 가 IDOR 검사를 위해 `relations: ['workflow']` 로 읽은 노드를 그대로 반환해 부모 워크플로 행 전체(`name`·`description`·`tags`·`settings`·`createdBy` 등)가 `PATCH` 응답에 실렸다. `NodeDto` 는 이 필드를 선언한 적이 없고 OpenAPI 에도 없으므로, 이번 제거는 "계약을 어기는" breaking change 가 아니라 **문서화되지 않은 채 새던 필드를 계약대로 되돌리는 수정**이다. 다만 이 undeclared 필드를 실제로 소비하던 클라이언트가 있었다면(코드베이스 내 프런트엔드 `updateNode` 호출처는 plan 문서 기준 없음) 응답 형태가 바뀐 것으로 관측된다.
  - 제안: 이미 plan(`plan/in-progress/patch-omit-undefined.md` §가드/§첫 TEST WORKFLOW)에 근거가 적절히 기록돼 있어 추가 조치 불요. 참고로만 남김.

- **[INFO]** 응답 계약 검증(`assertMatchesContract`)이 optional+nullable 필드의 "거짓 null/키 누락"을 걸러내지 못한다는 구조적 한계가 이번 수정으로 다시 확인됨
  - 위치: `codebase/backend/test/patch-partial-body.e2e-spec.ts:22-24` (docblock), `spec/5-system/2-api-convention.md §5.4` (`EXPECTED_OPTIONAL_NULLABLE_DRIFT`)
  - 상세: `WorkflowDto.description/folderId`, `NodeDto.description/containerId/toolOwnerId`, `AuthConfigDto.ipWhitelist` 가 optional+nullable 로 동결돼 있어, 계약 대조만으로는 이번에 고친 결함(보내지 않은 필드가 `null`로 실리거나 키가 빠짐)을 탐지할 수 없었다. 이번 PR 은 이를 인지하고 e2e 에서 계약 대조 외에 **값** 단언을 별도로 추가해 대응했다(`patch-partial-body.e2e-spec.ts` A/C/D 케이스) — 이 자체는 API 계약 관점에서 바람직한 보강이다. 다만 구조적 한계(§5.4 드리프트) 자체는 이 PR 의 축이 아니며 plan 이 이미 "§5.4 drift 배치" 후속으로 분리해 뒀다.
  - 제안: 조치 불요 — plan 에 이미 후속으로 분리·기록됨.

- **[INFO]** `omitUndefined` 의 신규 `NotArray<T>` 타입 제약은 런타임 API 동작에 영향 없음
  - 위치: `codebase/backend/src/common/utils/omit-undefined.ts:1-2, 17-19`
  - 상세: 컴파일 타임 가드로 배열 인자를 막을 뿐 5개 호출부(`folders`·`triggers`·`workflows`(rest/settings)·`nodes`·`auth-configs`) 모두 일반 객체(DTO 파생 `rest`/`Partial<Entity>`)를 넘겨 영향 없음을 확인. API 응답/요청 계약과 무관한 내부 타입 안전성 개선.

## 점검 관점별 요약

1. **하위 호환성**: `PATCH /workflows|nodes|auth-configs/:id` 세 엔드포인트의 응답이 "보내지 않은 필드가 `null`로 뒤바뀌거나 키가 빠지던" 결함을 고쳐 **저장값과 일치하는 값**을 돌려주도록 정정됐다. 이는 버그를 수정해 원래 의도된 계약(§5.4 tri-state: PATCH 에서 키 생략 = 값 불변)에 맞춘 것이라 breaking change 로 분류하지 않는다. `PATCH /workflows/:id` 의 `settings: {}` 케이스는 이전엔 저장된 `maxConcurrentExecutions` 를 DB 에서 지웠는데, 이제 병합 의도(코드 주석에 이미 명시돼 있던 "전체 교체 대신 병합")대로 동작한다 — 이 역시 문서화된 의도로의 정정이다. `PATCH /nodes/:id` 응답에서 undeclared `workflow` 필드가 빠지는 변화는 위 INFO 항목 참고.
2. **버전 관리**: 이 저장소는 URL 버전 관리(`/v1/` 등)를 쓰지 않으며 이번 변경도 라우트·버전에 손대지 않는다 — 해당 없음.
3. **응답 형식**: `WorkflowDto`/`NodeDto`/`AuthConfigDto` 선언 자체는 변경되지 않았고, 실제 응답 값이 선언(및 저장값)과 일치하도록 서비스 계층만 고쳤다. 신설 e2e(`patch-partial-body.e2e-spec.ts`)가 저장값(GET) → 응답 값 → 응답 계약(`assertMatchesContract`) 3단 검증으로 일관성을 확인한다 — 바람직한 보강.
4. **에러 응답**: 이번 diff 는 에러 처리 경로를 건드리지 않는다(`NotFoundException`/`ConflictException` 코드·상태 변화 없음).
5. **요청 검증**: 요청 DTO(`UpdateWorkflowDto`/`UpdateNodeDto`/`UpdateAuthConfigDto`/`WorkflowSettingsDto`)의 유효성 검증 규칙은 변경되지 않았다. 서비스 계층에서 `omitUndefined` 로 "보내지 않은 필드"만 걸러낼 뿐 값 검증 로직에는 개입하지 않는다.
6. **URL/경로 설계**: 라우트 신설/변경 없음 — 기존 `PATCH /api/{workflows,nodes,auth-configs}/:id` 단일 경로 원칙 유지(consistency-check 에서도 별도 `/toggle` 서브경로 없음을 확인).
7. **페이지네이션**: 목록 API 변경 없음 — 해당 없음.
8. **인증/인가**: `nodes.service.ts update()` 의 IDOR 가드(워크스페이스 소유권 검사, `relations: ['workflow']` 단일 쿼리)는 그대로 유지됐고, 이번 수정은 그 쿼리 결과에서 응답에 실을 필드만 골라내는 후처리를 추가한 것이라 인가 로직 자체에는 영향이 없다.

## 요약

세 PATCH 엔드포인트(`/workflows/:id`, `/nodes/:id`, `/auth-configs/:id`)가 부분 본문을 로드한 엔티티에 통째로 병합하면서 보내지 않은 필드를 `null`/키 누락으로 잘못 응답하던 결함, 그리고 워크플로 `settings` 병합이 빈 객체를 보내면 저장된 설정 키까지 DB 에서 지우던 결함을 공용 헬퍼(`omitUndefined`)로 일관되게 수정했다. 응답 DTO 선언·에러 코드·라우트·페이지네이션·인가 로직은 변경되지 않았고, 값 정정은 기존에 문서화된 의도(§5.4 tri-state, "settings 는 병합")로의 복귀이므로 API 계약 관점의 breaking change 로 보지 않는다. `PATCH /nodes/:id` 응답에서 undeclared `workflow` 관계 필드를 제거한 것은 관측 가능한 응답 형태 변화이지만 애초에 계약(OpenAPI/`NodeDto`)에 없던 필드를 계약대로 되돌린 것이라 INFO 수준이다. 신설 e2e 가 저장값·응답값·응답계약 3단으로 회귀를 고정해 검증 커버리지도 양호하다. CRITICAL/WARNING 급 API 계약 위반은 발견되지 않았다. (단, 리뷰 시작 시점에 위 §작업 트리 이상 상태에 적은 대로 `nodes.service.ts` 에 이 PR과 무관해 보이는 미커밋 변경이 이미 존재했다 — 병합/커밋 전 확인 필요.)

## 위험도

LOW
