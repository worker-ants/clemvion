# 부작용(Side Effect) 리뷰

## 검토 범위

이번 changeset(21개 파일, 실질 코드 변경은 파일 1~14) 은 `UpdateWorkflowDto.description` ·
`UpdateNodeDto.description` · `UpdateAuthConfigDto.ipWhitelist` 세 요청 필드의 TS 타입/OpenAPI
선언을 `nullable` 로 넓히고, 그 선언을 고정하는 단위/e2e/선언 캐너리를 추가한다. 나머지
(파일 15~49) 는 이 브랜치 안에서 먼저 돌았던 `/ai-review` 1R·2R·`consistency-check --impl-prep`
세션의 산출물(SUMMARY·RESOLUTION·개별 리포트·`meta.json`·`_retry_state.json`)이며,
`CLAUDE.md` 가 명시한 `review/code/**`·`review/consistency/**` 저장 규약을 따르는 정상 기록이다
— 이번 diff 가 만든 "예상치 못한" 파일시스템 변경이 아니다.

## 발견사항

- **[INFO]** 요청 DTO 3개 필드의 타입/OpenAPI 시그니처 확장(`string`/`string[]` → `| null`)
  — 다운스트림 병합 경로를 직접 대조해 새 부작용이 아님을 확인
  - 위치: `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts` `description?: string | null`,
    `codebase/backend/src/modules/nodes/dto/update-node.dto.ts` `description?: string | null`,
    `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts` `ipWhitelist?: string[] | null`
  - 상세: `workflows.service.ts` `update()` 는 `Object.assign(workflow, omitUndefined(rest))` 로
    DTO 를 엔티티에 병합한다(`omit-undefined.ts` 는 이번 diff 에서 JSDoc 만 추가됐고 필터 로직
    본문은 불변 — `null` 은 원래도 걸러지지 않고 통과한다). 대상 엔티티 컬럼을 직접 열어
    확인한 결과 `Workflow.description`·`Node.description` 이 이미 `string | null` 로 선언돼
    있어(`workflow.entity.ts:30`, `node.entity.ts:67`) 타입 불일치가 없다. 즉 DTO 타입 확장은
    "이미 런타임이 받아 병합하던 값" 에 타입 시스템·OpenAPI 선언을 뒤늦게 맞춘 것이며, 서비스
    로직 자체(`workflows.service.ts`·`nodes.service.ts`·`auth-configs.service.ts`)는 이번 diff
    에 포함돼 있지 않다.
  - 제안: 조치 불요. 단 이 스키마로 codegen 된 외부 API 클라이언트가 있다면 타입이 넓어졌다는
    점(하위 호환이지만 non-null 가정 코드가 있다면 재생성 권장)을 배포 노트에 남기면 충분.

- **[INFO]** 새 e2e 케이스(E1~E3) 가 테스트 DB 에 실제 워크플로·노드·인증설정 레코드를 생성
  - 위치: `codebase/backend/test/patch-partial-body.e2e-spec.ts` — `it('E1. …')`, `it('E2. …')`,
    `it('E3. …')`
  - 상세: `POST /api/workflows`·`POST /api/workflows/:id/nodes`·`POST /api/auth-configs` 를
    호출해 레코드를 만든다. 같은 파일의 기존 케이스(A~D)와 동일하게 `uniqueName()` 으로 이름
    충돌을 피하고 격리된 e2e 테스트 DB 안에서만 실행되므로, 새로운 종류의 부작용이 아니다.
  - 제안: 조치 불요.

- **[INFO]** `contractForDto` — 신규 도입이 아니라 기존 pre-existing 테스트 인프라 재사용
  - 위치: `auth-config-ip-whitelist.dto.spec.ts`·`node-dto-validation.spec.ts`·
    `workflow-dto-validation.spec.ts` 의 신규 `import { contractForDto } from '../../../shared/testing/response-contract'`
  - 상세: `response-contract.ts` 를 직접 읽어 확인 — 모듈 레벨 `contractCache`(`Map<Type, Promise<DtoContract>>`)
    는 이번 diff 이전부터 존재하는 메모이제이션이고, 파일 자체는 이 diff 에서 전혀 수정되지
    않았다. Jest 는 spec 파일마다 모듈 레지스트리를 새로 만들므로 캐시는 파일 내부로만
    격리되며, 부트스트랩은 in-memory Nest 테스트 모듈(swagger 문서 생성)일 뿐 디스크·네트워크
    I/O 가 없다. 3개 신규 spec 파일이 이 헬퍼를 새로 가져다 쓰는 것은 기존
    `patch-partial-body.e2e-spec.ts` 의 기존 사용 패턴을 그대로 따르는 것이다.
  - 제안: 조치 불요.

- **[INFO]** `omit-undefined.ts`/`omit-undefined.spec.ts` — JSDoc·캐너리 테스트만 추가, 함수
  본문·시그니처는 불변
  - 위치: `codebase/backend/src/common/utils/omit-undefined.ts` (함수 본문 `Object.fromEntries(...)`
    무변경, JSDoc 4줄만 추가), `omit-undefined.spec.ts` (`it('인자 자체가 null 이면 TypeError 를
    던진다…')` 신규)
  - 상세: 새 테스트는 헬퍼의 **기존** 동작(인자 자체가 `null` 이면 `Object.entries` 가 던진다)을
    문서화·고정할 뿐 동작을 바꾸지 않는다. `export function omitUndefined<T extends object>(...)`
    시그니처도 그대로다 — 기존 호출부(`workflows.service.ts`·`nodes.service.ts`·
    `auth-configs.service.ts`) 영향 없음.
  - 제안: 조치 불요.

- **[INFO]** `plan/**`·`review/**` 신규/수정 파일은 프로젝트 규약이 요구하는 기록이지 의도치
  않은 파일시스템 부작용이 아님
  - 위치: `plan/in-progress/patch-body-followups.md`(신규), `plan/in-progress/spec-draft-nullable-notation-followups.md`
    (항목 취소선 + 후속 항목 추가), `review/code/2026/09/27/{15_46_38,16_07_49}/*`,
    `review/consistency/2026/09/27/15_19_25/*`
  - 상세: `CLAUDE.md` 가 "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`",
    "일관성 검토 산출물 → `review/consistency/...`" 로 저장 위치를 명시하고, `developer` 는
    구현 착수 직전 `consistency-check --impl-prep` 을 의무로 돈다. 이번 브랜치의 1R·2R
    `/ai-review` 세션과 impl-prep consistency-check 가 만든 정상 산출물이며, 이 리뷰
    자체(3번째 세션)도 같은 규약을 따라 `review/code/2026/09/27/16_29_51/` 에 쓴다.
  - 제안: 조치 불요.

이 외에 diff 전체에서 새 전역 변수 도입, 기존 전역/공유 상태의 의도치 않은 변경, 환경 변수
읽기/쓰기, 신규 네트워크 호출(외부 서비스), 이벤트/콜백 발생·배선 변경은 관측되지 않았다.
`AuthConfigsService.verifyWebhookRequest` 등 서비스 로직 파일 자체는 이번 diff 에 전혀
포함돼 있지 않다(대상은 DTO 타입/선언 + 테스트뿐).

## 리뷰 중 저장소 변경 여부

읽기 전용으로 진행했다 — 가설 검증을 위해 `grep`/`Read` 로 서비스·엔티티 파일을 직접
대조했을 뿐 저장소 파일을 고치거나 뮤테이션하지 않았다. `git status --short` 결과 이 세션
산출 디렉터리(`review/code/2026/09/27/16_29_51/`) 외 변경 없음.

## 요약

이번 changeset 의 실질 코드 변경은 세 요청 DTO 필드의 타입·OpenAPI 선언을 `nullable` 로
넓히는 것이 전부이며, 서비스 계층의 병합 로직(`omitUndefined` 경유 `Object.assign`)과 대상
엔티티 컬럼(`Workflow.description`·`Node.description` 이미 `string | null`)을 직접 대조한
결과 이 확장이 새로운 런타임 부작용을 만들지 않음을 확인했다. 나머지 파일은 그 선언을
고정하는 단위/e2e/선언 캐너리, JSDoc 문서화, 그리고 프로젝트 규약이 요구하는 plan/review
산출물로 모두 격리된 테스트 환경 또는 문서 영역에 머무른다. 전역 상태·환경 변수·네트워크·
이벤트 콜백 어느 축에서도 의도치 않은 부작용은 발견되지 않았다. CRITICAL/WARNING 없음.

## 위험도

NONE
