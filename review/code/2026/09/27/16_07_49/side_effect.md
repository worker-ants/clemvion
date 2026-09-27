# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 요청 DTO 3개 필드 타입 확장(`string`→`string | null`, `string[]`→`string[] | null`)은 시그니처 변경이지만 런타임 동작 변화가 없음을 확인
  - 위치: `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts:35`, `codebase/backend/src/modules/nodes/dto/update-node.dto.ts:62`, `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts:62`
  - 상세: `UpdateWorkflowDto.description` · `UpdateNodeDto.description` · `UpdateAuthConfigDto.ipWhitelist` 의 TS 타입에 `| null` 을 추가하고 `@ApiPropertyOptional({ nullable: true })` 를 붙였다. 호출 경로(`workflows.service.ts` `update()` 라인 239~271, `nodes.service.ts`, `auth-configs.service.ts` `update()` 라인 225~265)는 이미 `omitUndefined()` 를 거쳐 `Object.assign(entity, omitUndefined(rest))` 로 병합하는데, `omitUndefined` 는 `null` 값을 걸러내지 않고 그대로 남긴다(`omit-undefined.ts` 본문 불변, JSDoc만 추가됨). 즉 `null` 은 검증 전에도 이미 엔티티에 병합돼 컬럼을 지우고 있었고, 대상 컬럼(`Workflow.description` · `Node.description` · `AuthConfig.ipWhitelist`)이 모두 nullable 컬럼임을 확인했다(`entities/auth-config.entity.ts:43` `ipWhitelist: string[] | null`). 타입 확장은 이미 존재하던 런타임 계약을 타입 시스템·OpenAPI 선언에 맞춘 것으로, 새 부작용을 만들지 않는다.
  - 제안: 조치 불요 (plan `plan/in-progress/patch-body-followups.md` 의 실측 표 및 뮤턴트 D1~D6 이 같은 결론을 뒷받침).

- **[INFO]** `Partial<AuthConfig>` 로 흘러가는 `UpdateAuthConfigDto` 의 타입 확장이 엔티티 필드 타입과 일치하는지 확인 — 컴파일 영향 없음
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.controller.ts:128` (`body: UpdateAuthConfigDto` 를 `service.update(id, workspaceId, body, userId, req.ip)` 로 그대로 전달, `service.update` 시그니처는 `data: Partial<AuthConfig>`)
  - 상세: `UpdateAuthConfigDto.ipWhitelist: string[] | null` 이 `Partial<AuthConfig>` 에 구조적으로 대입 가능하려면 엔티티도 같은 타입이어야 한다 — 확인 결과 엔티티가 이미 `ipWhitelist: string[] | null` 로 선언돼 있어 시그니처 불일치가 없다.
  - 제안: 조치 불요.

- **[INFO]** `review/**` 하위에 리뷰·컨시스턴시 세션 산출물(SUMMARY·RESOLUTION·meta.json·`_retry_state.json` 등 다수)이 신규 파일로 커밋되는 파일시스템 변경
  - 위치: `review/code/2026/09/27/15_46_38/*`, `review/consistency/2026/09/27/15_19_25/*` (파일 15~36)
  - 상세: 대량의 새 파일 생성이지만, 프로젝트 컨벤션(`CLAUDE.md` "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`")이 명시적으로 요구하는 저장 위치이자 이전 리뷰 라운드(1R)의 정상 산출물이다. 의도치 않은 부작용이 아니라 워크플로가 규정한 기록.
  - 제안: 조치 불요.

- **[INFO]** `omit-undefined.ts` · `omit-undefined.spec.ts` 는 JSDoc·테스트만 추가되고 함수 본문(`Object.fromEntries(Object.entries(obj).filter(...))`)은 변경되지 않음 — 순수 문서/캐너리 변경
  - 위치: `codebase/backend/src/common/utils/omit-undefined.ts:25` (함수 시그니처·본문 불변, 주석만 20~23행 추가)
  - 상세: 새 테스트(`omit-undefined.spec.ts:51-53`)는 `omitUndefined(null)` 이 `TypeError` 를 던진다는 **기존에도 있던 동작**을 문서화·고정할 뿐, 헬퍼의 동작을 바꾸지 않는다.
  - 제안: 조치 불요.

이 외에 전역 변수 신설, 환경 변수 읽기/쓰기, 신규 네트워크 호출, 이벤트/콜백 변경은 diff 전체에서 발견되지 않았다. `test/patch-partial-body.e2e-spec.ts` 의 신규 `it` 3건(E1~E3)은 기존 e2e 하니스가 이미 수행하는 HTTP 호출 패턴(로컬 테스트 서버 대상)을 그대로 따르며, 새로운 외부 서비스 호출을 추가하지 않는다.

## 요약

이번 변경은 세 요청 DTO(`UpdateWorkflowDto.description` · `UpdateNodeDto.description` · `UpdateAuthConfigDto.ipWhitelist`)의 TS 타입/OpenAPI 선언을 이미 존재하던 런타임 null 허용 동작에 맞추는 문서적 성격의 수정이며, 실측(`omitUndefined` 가 null 을 통과시키고 대상 컬럼이 모두 nullable)으로 "동작 변화 없음" 주장이 뒷받침된다. 시그니처 확장이 흘러가는 다운스트림(서비스 병합 로직, `Partial<AuthConfig>` 대입)도 직접 확인했고 불일치가 없다. 나머지 파일은 테스트·CHANGELOG·plan·리뷰 산출물 추가로, 전역 상태·환경 변수·네트워크·이벤트 콜백 어느 축에서도 의도치 않은 부작용을 일으키지 않는다.

## 위험도

NONE
