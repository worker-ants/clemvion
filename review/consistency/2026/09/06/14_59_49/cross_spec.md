# Cross-Spec 일관성 검토 — `spec/2-navigation/` (impl-done)

## 전제

- scope(`spec/2-navigation/`) 델타: **0개 파일** — 이 브랜치는 해당 영역의 spec 문서를 바꾸지 않았다. 검토는 (1) target 영역 문서가 이미 서술한 계약이 이번 구현 diff(17파일/2285줄, `User` 엔티티 컬럼 방어 + 두 곳의 보안 수정)로 실제로 실현됐는지, (2) 그 실현 형태가 `spec/2-navigation/` 밖 다른 영역의 기존 관례·계약과 충돌하는지를 대상으로 했다.
- 실제 코드 변경은 `git diff origin/main...HEAD`(9개 커밋, `96d3856a9`~`a185846a5`)를 워킹트리에서 직접 열람해 확인했다 (트리거 서비스 2건, 워크플로 버전 서비스, workspace DTO, 신규 방어 가드 9개, e2e 3건).
- 직전 라운드 `review/consistency/2026/09/06/14_26_32`가 발견한 CRITICAL(§3 문서한 `TRIGGER_ENDPOINT_PATH_CONFLICT` 계약이 구현에 없음)은 이번 diff의 `triggers.service.ts` `rethrowEndpointPathConflict`로 **해소됐다** — 그 해소 방식 자체가 이번 라운드의 새 발견(아래 WARNING #1)이다.

## 발견사항

### WARNING — `TRIGGER_ENDPOINT_PATH_CONFLICT` 세부 코드 표현 위치가 저장소 전역 관례와 다르고 에러 카탈로그에 미등재

- **target 위치**: `spec/2-navigation/2-trigger-list.md:94`, `:164` — "`(workspace_id, endpoint_path)` UNIQUE 위반 시 409 `RESOURCE_CONFLICT` (세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`, `details.field='endpoint_path'`)"
- **충돌 대상**:
  - `spec/5-system/3-error-handling.md:87-90` — `RESOURCE_CONFLICT`(409 기본값) 아래 `DUPLICATE_NODE_LABEL`("`RESOURCE_CONFLICT` 의 노드 라벨 특화 코드")과 `WORKFLOW_VERSION_CONFLICT`(같은 `workflow-versions.service.ts` 도메인!)가 등재되어 있다.
  - `spec/5-system/3-error-handling.md:193-230` (§1.7~§1.9) — Webhook/KB/워크스페이스 멤버 도메인의 특화 409/403 코드(`ALREADY_A_MEMBER`, `KB_REEXTRACT_IN_PROGRESS`, `CANNOT_ASSIGN_OWNER`, `WORKSPACE_TYPE_MISMATCH`) 전부 "도메인 spec 참조" 패턴으로 본 카탈로그에 등재.
  - `spec/conventions/error-codes.md:47-48` — "클라이언트(프론트엔드·통합 사용자)는 **코드의 의미로 분기**하며 이름 토큰 부분 문자열을 파싱하지 않는다."
- **상세**: 저장소 전역에서 "생성 409 를 세분화해야 하는 도메인 특화 충돌"은 예외 없이 **top-level `code` 필드 자체를 특정 값으로 바꿔** 발행한다 — `DUPLICATE_NODE_LABEL`·`WORKFLOW_VERSION_CONFLICT`·`ALREADY_A_MEMBER`·`KB_REEXTRACT_IN_PROGRESS`·`KB_REEMBED_IN_PROGRESS`·`CANNOT_ASSIGN_OWNER`·`WORKSPACE_TYPE_MISMATCH` 7개 전부가 이 패턴이며, 각각 `3-error-handling.md` §1.1 표 또는 §1.7~§1.9 "도메인 spec 참조" 섹션에 등재돼 있다. 이번 PR 이 새로 구현한 `triggers.service.ts:1602` `rethrowEndpointPathConflict`(diff 상 신규)는 이 패턴을 따르지 않고, top-level `code` 는 그대로 **일반값 `RESOURCE_CONFLICT`** 를 유지한 채 세부 코드를 `details.subCode`(`triggers.service.ts:1614`)라는 **저장소에 선례가 없는 새 자리**에 넣는다 (`grep -rn subCode codebase/backend/src` → 이 한 곳뿐). 코드 주석(`triggers.service.ts:1608`)은 "봉투 top-level 에 subCode 를 실으면 GlobalExceptionFilter 가 code·message·requestId·details 만 복사하므로 wire 에 도달하지 않는다"고 적었으나, 이는 **새 top-level 키 `subCode` 를 추가하는 것**과 **기존 top-level `code` 키의 *값* 을 `RESOURCE_CONFLICT` 대신 `TRIGGER_ENDPOINT_PATH_CONFLICT` 로 바꾸는 것**(=7개 선례가 실제로 쓰는 방법, 새 키 도입이 전혀 아님)을 혼동한 근거다 — 7개 선례 모두 `GlobalExceptionFilter` 를 그대로 통과해 wire 에 정상 도달한다.
  - 부수: `TRIGGER_ENDPOINT_PATH_CONFLICT` 는 `3-error-handling.md` §1 카탈로그(SoT 를 자처 — `conventions/error-codes.md:14`) 어디에도 등재되지 않았다. 자동 가드는 없다 (`repo-guards/__tests__/*error*` 전수 확인 — 카탈로그 완결성 강제 가드 부재).
  - 실질 영향은 현재는 **잠재적**이다 — 프런트엔드에 이 코드를 소비하는 지점이 아직 없다(`grep -rn TRIGGER_ENDPOINT_PATH_CONFLICT codebase/frontend/src` 0건). 따라서 지금 당장 "작동 불가"는 아니지만, 다음에 이 조건을 프런트가 분기하려는 사람은 `error.code` 대신 `error.details.subCode` 를 확인해야 하는데 이는 7개 선례 + `error-codes.md` 의 "코드의 의미로 분기" 계약과 어긋난다.
- **제안**: 아래 중 하나를 택해 명시적으로 결정한다 (두 문서를 함께 갱신해야 함).
  1. **선례 정렬(권장)**: `rethrowEndpointPathConflict` 가 `code: 'TRIGGER_ENDPOINT_PATH_CONFLICT'` 를 top-level 로 던지고 `details: { field: 'endpoint_path' }` 만 남긴다. `2-trigger-list.md:94,164` 문구를 "409 `TRIGGER_ENDPOINT_PATH_CONFLICT`" 로 정정하고, `3-error-handling.md` §1.1 표(또는 신규 §1.x "Trigger 도메인 에러 코드")에 `DUPLICATE_NODE_LABEL` 행과 같은 형식으로 등재한다.
  2. **현행 유지 + 명문화**: `details.subCode` 자리를 의도적 신규 패턴으로 확정한다면, `2-api-convention.md §5.3` 에 "도메인 세부 코드는 `details.subCode` 로 표현할 수 있다"는 옵션을 정식 등재하고 `2-trigger-list.md` Rationale 에 왜 이번 건만 기존 7개 선례와 다른 자리를 쓰는지 근거를 남긴다. 이 경로를 택하지 않으면 다음 신규 도메인 충돌 코드가 또 다른 제3의 자리를 만들 위험이 있다.

### INFO — `WorkflowVersion` 상세 응답의 `creator` 투영 축소가 `spec/3-workflow-editor/5-version-history.md`(target 밖)와 비동기

- **target 위치**: 해당 없음 — `spec/2-navigation/` 범위 밖. 참고용으로만 기록.
- **충돌 대상**: `spec/3-workflow-editor/5-version-history.md:96-101`(§7.2) — "응답: `WorkflowVersion` 단건 + `snapshot` 포함"
- **상세**: 이번 diff (`workflow-versions.service.ts`)가 `findOne()` 의 반환 타입을 `WorkflowVersionDetail`(= `creator` 를 `{id,name,email}` 3필드로 투영)로 좁혔다(보안 수정, 정당함 — 이전엔 `User` 전 컬럼이 그대로 응답에 실렸다). `5-version-history.md §7.2` 는 여전히 "`WorkflowVersion` 단건"이라고만 서술해 이 투영을 명시하지 않는다. §7.1(목록)은 "메타데이터 + 작성자만 포함"이라고 이미 명시했으므로 §7.2 도 동일하게 갱신하면 대칭이 맞는다. 직전 라운드(`14_26_32`)의 `rationale_continuity` 가 같은 사실을 "target 범위 밖, 조치 불요"로 이미 처분했으므로 본 라운드도 조치를 요구하지 않고 참고로만 남긴다.
- **제안**: 다음에 `3-workflow-editor/5-version-history.md` 를 손댈 때 §7.2 표에 "creator: id/name/email 투영(전체 `User` 아님)" 한 줄 추가.

### INFO — `WorkspaceMemberDto.joinedAt` 신규 필드가 `spec/2-navigation/9-user-profile.md` 에 미기술 (기존 추적 항목, 재확인만)

- **target 위치**: `spec/2-navigation/9-user-profile.md` §4.1/§4.2 (본 프롬프트에서는 예산 절단으로 본문 생략 — 실제 파일을 직접 grep 하여 `joinedAt`/`가입일`/`합류 시각` 부재를 재확인함)
- **충돌 대상**: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` `WorkspaceMemberDto.joinedAt`(이번 diff 신규 필드, §5.4 기본형 — 상시 존재·`null` 표현)
- **상세**: 직전 라운드(`14_26_32`)가 이미 이 필드를 INFO#1로 발견했고 "UI 노출 계획이 서면 §4.1 표 갱신, 지금 조치 불요"로 처분했다. 본 라운드에서 재확인한 결과 여전히 미기술 상태이며 모순은 아니다(단순 확장 미문서화).
- **제안**: 조치 불요 — 향후 UI 노출 시 `9-user-profile.md §4.1` 표에 "가입일" 열 추가.

## 요약

target(`spec/2-navigation/`) 자체의 spec 델타는 0이며, 그 문서가 이미 서술한 트리거 endpoint-path 충돌 계약(§3, §2.3.1)은 이번 diff 의 `triggers.service.ts` 구현으로 마침내 실현되어 직전 라운드의 CRITICAL(문서한 보장이 구현보다 넓었던 상태)은 해소됐다. 다만 그 해소 방식(top-level `code` 는 일반값 유지 + 신설한 `details.subCode` 에 세부 코드를 담는 새 자리)이 같은 저장소가 이미 7개 사례(`DUPLICATE_NODE_LABEL`·`WORKFLOW_VERSION_CONFLICT`·워크스페이스 멤버/KB 도메인 코드들)로 일관되게 지켜 온 "도메인 특화 코드는 top-level `code` 값 자체를 대체한다" 관례 및 `conventions/error-codes.md` 의 "클라이언트는 코드로 분기" 원칙과 어긋나며, `3-error-handling.md` §1 카탈로그에도 미등재다 — 지금 당장 활성 소비자가 없어 시스템이 작동 불가 상태는 아니지만, 다음에 이 코드를 프런트가 소비하려 할 때 선례와 다른 자리를 찾아야 하는 잠재 충돌이라 WARNING 으로 판정한다. 그 외 워크플로 버전 상세 응답의 `creator` 투영 축소(보안 수정, target 밖) 문서 비동기와 `WorkspaceMemberDto.joinedAt` 미문서화는 이미 이전 라운드가 처분한 낮은 우선순위 INFO 로, 이번 라운드에서 상태 변화가 없어 조치를 요구하지 않는다.

## 위험도

MEDIUM
