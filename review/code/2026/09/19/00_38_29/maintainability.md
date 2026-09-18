# 유지보수성(Maintainability) 리뷰 — 웹훅 `endpoint_path` 전역 유일 (V131/V132)

## 발견사항

- **[WARNING]** `@ApiConflictResponse` 설명 문자열이 두 데코레이터에 문자 그대로 중복되어 있고, 이번 변경이 그 중복을 그대로 유지한 채 두 곳을 동일하게 고쳤다
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:102`, `codebase/backend/src/modules/triggers/triggers.controller.ts:139`
  - 상세: `create()`와 `update()`의 `@ApiConflictResponse({ description: … })` 문자열이 완전히 동일하다(`'같은 endpointPath 를 쓰는 트리거가 이미 존재(다른 워크스페이스의 트리거 포함 — endpoint_path 는 전역 유일, V132). code=RESOURCE_CONFLICT, details.field="endpoint_path", details.code="TRIGGER_ENDPOINT_PATH_CONFLICT".'`). 이 중복은 이번 diff 이전부터 있었지만(옛 워크스페이스 스코프 문구도 두 곳에 동일하게 있었음), 이번 변경이 그 사실을 다시 한 번 보여준다 — 문구를 바꿀 때마다 두 자리를 사람이 손으로 동기화해야 한다. 다음에 한쪽만 고치고 잊으면(예: 세부 코드 추가·문구 개선) 두 엔드포인트의 Swagger 문서가 조용히 어긋난다. 저장소에 이미 이런 목적의 선례가 있다(`codebase/backend/src/modules/integrations/integrations.controller.ts`의 `OAUTH_BEGIN_RESULT_DESCRIPTION` 상수).
  - 제안: 파일 상단에 `const TRIGGER_ENDPOINT_PATH_CONFLICT_DESCRIPTION = '...'` 상수를 두고 두 데코레이터가 이를 참조하게 한다.

- **[INFO]** e2e B5 테스트가 `beforeAll`의 액터 생성 절차와 `createWebhookTrigger` 헬퍼의 요청 본문 구성을 인라인으로 재구현한다
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts` `B5. 다른 워크스페이스가 같은 endpointPath 로 생성 · 수정 → 409 …` 테스트 블록 (215~292행)
  - 상세: `beforeAll`(42~55행)이 `registerAndLogin` → `createTeamWorkspace` → `POST /api/workflows`로 액터를 만드는 절차를 B5가 두 번째 액터(`other`/`otherWs`/`otherWfId`)를 위해 거의 그대로 반복한다. 또한 `createWebhookTrigger` 헬퍼(83~102행)는 최상위 `token`/`workspaceId`/`workflowId` 클로저에 묶여 있어 다른 워크스페이스로는 쓸 수 없으므로, B5는 `POST /api/triggers` 요청 본문 구성을 두 번(승리자 경로 시도 · 자기 소유 트리거 생성) 인라인으로 다시 쓴다. 다만 이 파일 안에서 두 번째 액터가 필요한 테스트는 B5 하나뿐이고, 같은 코드베이스의 다른 e2e 스펙 다수도 액터 생성을 파일마다 인라인으로 반복하는 것이 기존 관행이라(`registerAndLogin`+`createTeamWorkspace`를 쓰는 e2e 파일이 20개 이상) 심각한 일탈은 아니다.
  - 제안: 당장 고칠 필요는 낮지만, 향후 멀티-액터 e2e 테스트가 늘어나면 `createWebhookTrigger(name, path, { token, workspaceId, workflowId, ...opts })` 처럼 override 파라미터를 받도록 일반화해 중복을 줄일 수 있다.

## 점검했으나 문제 없음으로 판단한 항목

- `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql`, `V132__trigger_endpoint_path_global_unique.sql`: 헤더 주석이 길지만(저장소의 기존 마이그레이션 관례와 일치), `DO $$ … $$` 블록 자체는 짧고(FOR 루프 + 단일 IF, 중첩 2단) 변수명(`r`, `n`, `n_chat`)도 PL/pgSQL 카운터 관례에서 벗어나지 않는다. `FOR r IN … LOOP` 패턴이 이 마이그레이션 디렉터리에서는 처음이지만 그 자체로 읽기 어렵지 않다.
- `triggers.service.ts`의 `isEndpointPathUniqueViolation`·`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`·`rethrowEndpointPathConflict`: 이름·주석이 값(`idx_trigger_workspace_endpoint` → `idx_trigger_endpoint_path`) 재배선을 정확히 반영하고, 술어가 "이름 불일치 시 조용히 좁힘을 포기"하는 안전한 실패 방향이라는 근거도 doc-comment에 명시돼 있다. 함수 길이·중첩·순환 복잡도 모두 낮다.
- `triggers.service.spec.ts`의 `err_` catch 파라미터 이름은 같은 파일 730행의 기존 패턴과 일치해 새 비일관성이 아니다(직전 커밋 `b290d236b`가 이미 이 이름으로 정리).
- `triggers.controller.ts`의 산문 변경(두 곳) 자체는 정확하고 명확하다 — 위 WARNING은 "이미 존재하던 구조적 중복을 이번에도 답습했다"는 지적이지 이번 diff가 새로 만든 결함은 아니다.
- `plan/in-progress/*.md`, `spec/**.md`의 변경은 문서이며, 취소선 + "정정" 각주 패턴은 저장소가 이미 쓰는 규약(자기-반증형 소정정 방식)과 일치한다.
- `review/consistency/2026/09/18/**`, `review/consistency/2026/09/19/**` 디렉터리들은 `--spec` 모드 consistency-check 세션들의 산출물이며, 코드가 아니라 각 세션의 스냅샷이라 세션 간 유사 문구 반복은 저장소 관례(`review/consistency/<타임스탬프>/`)상 정상이다 — 유지보수성 관점의 "중복 코드"로 볼 대상이 아니다.

## 뮤테이션 검증 관련 안내

이번 리뷰는 정적 분석만으로 결론을 낼 수 있어 저장소 파일을 뮤테이션하지 않았다. `git status --short` 기준으로 이 세션이 저장소에 남긴 변경은 없다.

## 요약

이번 변경(V131/V132 마이그레이션, `triggers.controller/service(.spec).ts`, e2e B5/B6)은 doc-comment가 "왜"를 충실히 설명하고, 이름·상수가 값 변경을 정확히 반영하며, 함수 길이·중첩·복잡도 모두 낮아 전반적으로 유지보수성이 양호하다. 발견된 두 항목은 모두 사소한 수준이다 — (1) Swagger 설명 문자열이 두 데코레이터에 중복돼 있어 향후 동기화 누락 위험이 있고(기존 구조적 부채를 이번 diff가 답습), (2) e2e B5가 멀티-액터 설정·트리거 생성 보일러플레이트를 인라인으로 반복하지만 이는 파일 내 1회성이고 코드베이스 전반의 기존 관행과 부합한다. 둘 다 즉시 차단할 사유는 아니며, 여유가 있을 때 상수 추출·헬퍼 일반화로 개선할 수 있는 정도다.

## 위험도

LOW
