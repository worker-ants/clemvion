# 테스트(Testing) 리뷰 — patch-body-followups (3R)

## 검증 방법

- 프롬프트 diff 의 게이트 숫자와 실제 저장소 파일(`Read`)을 대조 — `codebase/backend/src/common/utils/omit-undefined.spec.ts`,
  `codebase/backend/test/patch-partial-body.e2e-spec.ts`, `codebase/backend/src/modules/{auth-configs,nodes,workflows}/**` 전문을 직접 열어 확인.
  저장소 트리에 쓰기는 하지 않았다(read-only, `Read`/`Bash grep` 만 사용). `git status --short` 로 세션 산출물(`review/code/2026/09/27/16_29_51/`) 외
  잔여 변경 없음 확인.
- 1R(`review/code/2026/09/27/15_46_38/testing.md`)·2R(`review/code/2026/09/27/16_07_49/testing.md`)이 이미 지적한 Warning(헬퍼 null 계약 미고정,
  e2e 케이스 병합)이 실제로 코드로 닫혔는지 소스 레벨에서 재확인했고, 두 라운드가 못 본 새 축(응답 DTO 쪽 nullable 캐너리 대칭성)을 찾았다.
- `nodes.service.ts:54-84`·`auth-configs.service.ts:225-255`의 `update()` 구현을 직접 읽어 mock 시퀀스·병합 로직이 실제 코드 경로와 일치하는지 대조했다.

## 발견사항

- **[WARNING]** 응답 DTO(`NodeDto.description`·`AuthConfigDto.ipWhitelist`)의 `nullable: true` 선언이 "데코레이터·타입을 함께 되돌리는" 회귀에 대해
  캐너리가 없다 — 이번 PR 이 요청 DTO 축(D4~D6)에서 정확히 같은 형태의 결함을 고쳤는데, 응답 DTO 축에는 대칭 캐너리가 없다.
  - 위치: `codebase/backend/test/patch-partial-body.e2e-spec.ts` `it('E2. 노드 설명에 null 을 보내면 값을 지운다', ...)`(272-297행) · `it('E3. 인증 설정 IP
    화이트리스트에 null 을 보내면 값을 지운다', ...)`(299-321행) — 둘 다 `toHaveProperty(field, null)` 만 쓰고 `assertMatchesContract`(같은 파일
    A/C/D 가 쓰는 98·193·247행 패턴)를 부르지 않는다. 응답 DTO 선언은 `codebase/backend/src/modules/nodes/dto/responses/node-response.dto.ts:42-44`
    (`@ApiPropertyOptional({ nullable: true }) description?: string | null;`), `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts:27-28`
    (`@ApiPropertyOptional({ type: [String], nullable: true, ... }) ipWhitelist?: string[] | null;`).
  - 상세: `assertMatchesContract` 는 "null 이 허용되지 않는데 null 이다" 축(`response-contract.ts` 의 `kind: 'null'`)을 정확히 이 시나리오에서
    검사할 수 있는 도구인데, E2·E3 는 그 도구를 부르지 않는다. `grep -rln "contractForDto(NodeDto)\|contractForDto(AuthConfigDto)"
    codebase/backend/test` 로 전수 확인한 결과 두 DTO 의 `contractForDto` 호출은 이 파일의 C·D(비-null 값)뿐이다 — 즉 저장소 전체에서
    `NodeDto.description`·`AuthConfigDto.ipWhitelist` 가 **null 값으로** 응답 계약과 대조되는 지점이 하나도 없다(`WorkflowDto.description` 은
    `workflow-crud.e2e-spec.ts:176` 이 생성 직후 미설정 → null 인 값을 `assertMatchesContract` 로 이미 검증해 상대적으로 덜 노출돼 있다).
    기존 `swagger-dto-contract.spec.ts`(AST 가드)는 데코레이터·타입 중 **하나만** 어긋나면 잡지만, 이번 PR 이 요청 DTO 에서 뮤턴트 D4~D6 로
    실측했듯 **둘을 함께** 되돌리면 못 잡는다 — 그 사각을 요청 DTO 쪽엔 이번 PR 이 캐너리(각 DTO validation spec 의 "OpenAPI 가 nullable 로
    광고한다")로 메웠는데, 응답 DTO 쪽엔 대칭 캐너리가 없다. 또한 이 파일 자신의 docblock(15-24행, "단언 순서가 판정의 일부다: 저장값(GET) →
    응답 값 → 응답 계약")이 세운 3단 규율을 A·C·D 는 지키고 E2·E3 는 응답 계약 단계를 건너뛴다 — 같은 PR 안에서 관례가 갈린다.
  - 제안: E2·E3(및 대칭을 위해 E1 도)에 `assertMatchesContract(patched.body.data, await contractForDto(NodeDto|AuthConfigDto|WorkflowDto))` 한 줄을
    추가한다. 비용은 낮고(이미 import 돼 있음), 응답 DTO 의 nullable 선언이 미래에 "선언·타입 동시 롤백" 형태로 회귀하는 것을 그 자리에서 바로
    잡는다.

- **[INFO]** 1R·2R 이 지적한 두 Warning 은 실제로 뮤테이션 검증까지 마친 캐너리로 닫혀 있음을 소스 레벨에서 재확인했다 — 재-flag 아님.
  - `omit-undefined.spec.ts:49-53` — `omitUndefined(null as never)` → `toThrow(TypeError)`. `Object.entries(null)` 이 실제로 `TypeError` 를
    던지는 것과 일치하고, plan 뮤턴트 N1(헬퍼를 null-safe 로 바꾸면 이 테스트가 RED)이 KILLED 로 기록돼 있다.
  - `patch-partial-body.e2e-spec.ts:255-321` — 케이스가 `E1`·`E2`·`E3` 로 리소스별 분리됐고, 각각 null 이 아닌 시작값(`'before'`·`'memo'`·
    `['10.0.0.1']`)을 먼저 단언한 뒤 지운다 — "원래 null 이라 우연히 통과" 하는 공허(vacuous) 형태가 아니다.
  - `auth-configs.service.spec.ts:717-732` — `it.each([['null', null], ['빈 배열', []]])` 로 `verifyWebhookRequest` 의 null/`[]` 동치를
    검증 레벨에서 고정했고, `clientIp: '203.0.113.9'`(화이트리스트 밖 IP)가 통과하는지를 보므로 "화이트리스트 없음" 의미를 직접 관측한다.

- **[INFO]** `nodes.service.spec.ts:230-246`·`auth-configs.service.spec.ts:383-402` 의 새 "명시적 null" 단위 테스트는 mock 시퀀스가 실제 서비스
  분기와 정확히 일치한다.
  - `nodes.service.ts:73-78`: `label` 이 안 바뀌므로 `assertLabelUnique`(두 번째 `findOne`)를 안 타는데, 테스트도 `mockResolvedValueOnce`
    한 번만 stub 한다 — 괴리 없음. `Object.assign(node, omitUndefined(dto))` 가 `description: null`/`containerId: null` 을 그대로 병합하는
    코드 경로를 직접 태운다(omitUndefined 는 undefined 만 걸러내므로 null 은 통과) — vacuous 아님.
  - `auth-configs.service.ts:238-247` 의 `rest` 구조분해(`configPatch`/`id`/`workspaceId`/`type` 만 제외)도 `ipWhitelist` 를 그대로 남기므로
    테스트가 실제 병합 로직을 그대로 탄다.

- **[INFO]** 새 e2e/단위 테스트는 서로 독립적으로 실행 가능하다 — `uniqueName`/`uniqueEmail` 로 리소스를 매번 새로 만들고, `nodes.service.spec.ts`
  는 `beforeEach` 에서 mock 을 매번 재생성한다(36-52행). 순서 의존이나 공유 상태로 인한 격리 문제는 발견하지 못했다.

## 커버리지 갭 (그 외)

- E1(워크플로)·E2(노드)·E3(인증 설정) 모두 "필드 하나만 null" 케이스만 검증한다 — `{ name: 'x', description: null }` 처럼 null 필드와 다른
  갱신 필드를 같은 PATCH 요청에 함께 보내는 조합은 테스트되지 않는다. `omitUndefined` + shallow-merge 구조상 필드 간 상호작용이 없어 보이므로
  우선순위는 낮지만, 새 회귀가 생긴다면 이 조합에서 드러날 가능성이 있다.

## 회귀 테스트

- 기존 A~D(워크플로·노드·인증 설정의 "보내지 않은 필드 보존") 테스트 본문은 이번 diff 로 수정되지 않았다(순수 append) — 새 캐너리 추가가 기존
  단언을 깨뜨릴 가능성은 낮다. `omit-undefined.spec.ts` 의 기존 5개 테스트도 그대로 유지된다.

## 요약

이번 PR 은 세 요청 DTO 의 nullable 선언을 런타임 동작에 맞추는 변경으로, 두 차례 리뷰 라운드를 거치며 헬퍼 null 계약·e2e 케이스 분리·
`verifyWebhookRequest` null/`[]` 동치 같은 실질적인 테스트 갭을 뮤테이션 검증까지 동반해 촘촘히 메웠다 — 소스를 직접 읽어 그 주장들이
사실임을 재확인했다. 다만 이번 라운드에서 새로 발견한 것은, 이번 PR 이 요청 DTO 축에서 고친 것과 동일한 형태의 결함 클래스(선언·타입을
함께 되돌리는 회귀)가 응답 DTO 축(`NodeDto.description`·`AuthConfigDto.ipWhitelist`)에는 아직 캐너리가 없다는 점이다 — 저장소 전체에 그
두 필드를 null 값으로 응답 계약과 대조하는 지점이 하나도 없다. 낮은 비용으로(이미 있는 `assertMatchesContract` 호출 패턴을 E2·E3 에
한 줄씩 추가) 닫을 수 있는 갭이라 차단 사유는 아니다.

## 위험도

LOW
