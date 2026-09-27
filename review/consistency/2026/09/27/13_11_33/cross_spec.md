# Cross-Spec 일관성 검토 — `spec/2-navigation/` (--impl-prep)

## 검토 범위 및 방법

target 은 `spec/2-navigation/` 전체 번들(워크플로 목록·트리거 목록·스케줄·설정 화면 본문 + 15개 파일 — 컨텍스트 예산으로 본문 생략, 목록만 확인)이었다. 번들에 포함된 "관련 spec 본문" 섹션은 `spec/0-overview.md` 를 제외한 대부분(`1-data-model.md`, `5-system/*`, `4-nodes/*`, `3-workflow-editor/*` 등 90여 개 파일)이 컨텍스트 예산 초과로 본문이 생략되어 있었다 — 이 checker 는 그 목록을 근거로 관련성이 높은 파일(`spec/1-data-model.md`, `spec/5-system/2-api-convention.md`, `spec/5-system/1-auth.md`, `spec/5-system/4-execution-engine.md`, `spec/4-nodes/3-ai/0-common.md`)을 직접 `Read`·`grep` 하여 대조했다. 나머지 생략 파일은 열지 않았으므로 "충돌 없음"의 근거로 삼지 않는다.

배경: 본 검토는 `plan/in-progress/patch-omit-undefined.md`(PATCH 부분 본문이 로드한 엔티티를 통째로 덮어써 응답이 거짓 null/키 누락을 내고, 워크플로 `settings` 는 DB 값까지 지우는 결함 — `workflows.service.ts`/`nodes.service.ts`/`auth-configs.service.ts` 수정 예정, `spec_impact: none`)의 impl-prep 단계에서 호출됐다. target 문서 자체는 이번 PR 로 변경되지 않는다 — 아래 발견사항은 target 의 **현재 텍스트**가 다른 영역과 이미 갖고 있는 불일치다.

---

## 발견사항

### [WARNING] Schedule 타임존 최종 fallback 값이 `1-data-model.md` 와 `3-schedule.md` 에서 서로 다르다

- **target 위치**: `spec/2-navigation/3-schedule.md` §2.2 "타임존" 행 — *"미지정 시 서버가 **워크스페이스 설정(`settings.timezone`) → `'Asia/Seoul'`** 순으로 fallback 한다 (`SchedulesService.resolveTimezone`: 명시값 > workspace settings.timezone > 'Asia/Seoul')."*
- **충돌 대상**: `spec/1-data-model.md` §2.2 Workspace `settings` 필드 설명 — *"`timezone: string?` (IANA, NAV-SC-06 — 미설정 시 서버 default `process.env.TZ` → `UTC`. AI 노드의 System Context Prefix ... **와 Schedule 의 default timezone 이 본 값을 참조**)"*
- **상세**: `1-data-model.md` 는 "AI 노드 System Context Prefix" 와 "Schedule 의 default timezone" 둘 다 같은 fallback 체인(workspace `settings.timezone` → `process.env.TZ` → `UTC`)을 공유한다고 서술한다. 그러나 실제로 두 소비처의 최종 fallback 값은 다르다:
  - AI 노드 System Context Prefix (`spec/4-nodes/3-ai/0-common.md` §11.3, 구현 `system-context-prefix.ts`): `Workspace.settings.timezone → process.env.TZ → 'UTC'` (3단계, 코드 주석 "§11.3 SoT precedence" 로 명시).
  - Schedule (`3-schedule.md` §2.2, 구현 `schedules.service.ts resolveTimezone`): `명시값 → workspace settings.timezone → 'Asia/Seoul'`. 코드 주석이 이 차이를 **의도적**이라고 명시한다 — *"`'Asia/Seoul'` 은 Schedule 도메인 전용 제품 기본값이다 (서버 `process.env.TZ`/UTC 가 아니라 — 본 제품의 1차 타겟 사용자 기준)"*. `getWorkspaceTimezone()` 은 미설정 시 `undefined` 를 반환할 뿐 `'UTC'` 로 폴백하지 않으며, `process.env.TZ` 를 참조하는 코드 경로가 Schedule 쪽에는 없다.
  - 즉 워크스페이스가 `settings.timezone` 을 설정하지 않은 상태에서: AI 프롬프트 prefix 는 `UTC`(또는 `process.env.TZ`)를 쓰지만 Schedule 은 `'Asia/Seoul'` 을 쓴다 — 실제로 다른 기본값이며, `1-data-model.md` 의 "본 값을 참조" 서술은 이 분기를 감춘다.
- **제안**: `1-data-model.md` §2.2 의 해당 괄호 서술에서 "Schedule 의 default timezone" 을 분리하거나, "단 Schedule 의 최종 fallback 은 `process.env.TZ`/`UTC` 가 아니라 도메인 전용 `'Asia/Seoul'`" 이라는 각주를 추가해 `3-schedule.md`·`schedules.service.ts` 코드 주석과 정합시킨다. (실제 구현·`3-schedule.md`·`schedules.service.spec.ts` 세 곳이 이미 `'Asia/Seoul'` 로 일치하므로, 고쳐야 할 쪽은 `1-data-model.md` 로 보인다.)

---

### [WARNING] PATCH "키 생략 = 값 불변" tri-state 계약이 `2-trigger-list.md` 에만 명시되고 `1-workflow-list.md`(settings)·`6-config.md`(AuthConfig) 에는 없다

- **target 위치**: `spec/2-navigation/1-workflow-list.md` §3 API 표 — `PATCH /api/workflows/:id` 는 *"워크플로우 수정 (이름, 상태 등)"* 한 줄뿐이고, §3.2 Rationale 은 `settings` 의 **값 검증**(strict, 미지 키·비정수 400)만 다루며 **부분 갱신 시 생략된 키의 취급**(기존 값 유지 vs 초기화)은 서술하지 않는다. `spec/2-navigation/6-config.md` §3 Authentication API 의 `PATCH /api/auth-configs/:id` 도 *"수정 (name·IP·비-비밀 config·활성 토글)"* 로만 서술되고, R-2 는 nested `config` JSONB 의 shallow-merge 만 언급할 뿐 top-level 필드(`ipWhitelist`, `isActive`)의 생략 시 취급은 언급하지 않는다.
- **충돌 대상**:
  1. `spec/2-navigation/2-trigger-list.md` §3 註 — *"**PATCH 의 저장은 이 요청이 바꾸는 필드만 싣는다.** 엔티티를 통째로 저장하면 재읽기 뒤에 락 밖에서 커밋된 컬럼이 재읽기 시점 값으로 되써진다"* — 같은 번들 안 형제 화면이 동일 클래스의 계약을 명시적으로 문서화하고 있다.
  2. `spec/5-system/2-api-convention.md` §5.4 상단 — *"PATCH 부분 업데이트는 키 생략(=값 불변)·`null`(=초기화)·값(=설정) 의 **tri-state** 가 각각 의미를 갖는 별개 계약"* — 이 tri-state 는 시스템 전역 PATCH 요청 바디 규약으로 선언돼 있다.
- **상세**: `plan/in-progress/patch-omit-undefined.md` 의 실측(무수정 코드 e2e 프로브)이 정확히 이 gap 을 보여준다 — `workflows.service.ts update()` 는 `settings: {}` 를 보내면 기존 `maxConcurrentExecutions` 를 **DB 에서까지** 지우고(§5.4 tri-state 위반: 키 생략이 "불변" 이 아니라 "초기화"로 동작), `auth-configs.service.ts update()` 는 `{ name }` 만 보내도 응답에서 `ipWhitelist`/`isActive` 가 거짓 null/키 누락으로 나온다. `1-workflow-list.md`·`6-config.md` 어느 쪽도 이 tri-state 계약을 명시하지 않아, "settings 는 strict DTO 로 값 검증한다"(현재 서술)와 "생략된 키는 유지돼야 한다"(§5.4 가 요구하는 기본 규약) 사이의 관계가 두 문서만 읽는 사람에게는 드러나지 않는다. `trigger-list.md`(같은 폴더, 같은 PATCH 부분갱신 클래스)만 이를 명시적으로 문서화해 온 것과 비교하면 내비게이션 영역 내부에서도 문서화 수준이 불균일하다.
- **제안**: 이번 PR(코드 수정, `spec_impact: none`)과 별개로, 후속 spec 정비에서 `1-workflow-list.md` §3.2 Rationale 과 `6-config.md` §A.2/R-2 에 "PATCH 는 §5.4 tri-state 를 따른다 — `settings`/top-level 필드 모두 생략 시 기존 값을 유지한다" 는 한 문장을 추가해 `trigger-list.md` 수준으로 맞추는 것을 권장한다. (코드 수정 자체는 이 문서 격차와 무관하게 `omitUndefined` 헬퍼로 진행 가능 — 이 항목은 문서 동기화 권고이지 이번 구현을 막는 사유는 아니다.)

---

### [INFO] 나머지 대조는 정합 확인됨 (기록용)

시간·예산 안에서 추가로 대조한 항목은 불일치가 없었다 — 참고로 남긴다(재검토 불필요, 근거 첨부):

- Trigger/Schedule/Workflow 의 RBAC: `2-trigger-list.md` §4.1 (viewer 불가·editor 자기 워크스페이스·admin/owner 가능) ↔ `5-system/1-auth.md` §3.2 매트릭스(`Trigger: Owner/Admin/Editor=CRUD, Viewer=R`) — 일치.
- Trigger 삭제 cascade: `2-trigger-list.md` §4.3 (`workflow_id`/`workspace_id` CASCADE, `execution.trigger_id` SET NULL, `auth_config_id` FK만 끊김) ↔ `1-data-model.md` §"인덱스"/"FK" 서술(`Trigger(workflow_id)` CASCADE, `Trigger(auth_config_id) WHERE ... ON DELETE SET NULL`) — 일치.
- Workflow `settings.maxConcurrentExecutions` 기본값(3, 미설정 시) — `1-workflow-list.md` §3.2 R-2 ↔ `1-data-model.md` §2.4 ↔ `5-system/4-execution-engine.md` §8 표 — 세 곳 모두 "워크플로우당 3" 으로 일치.

---

## 요약

target(`spec/2-navigation/`)은 전반적으로 매우 촘촘하게 상호 참조되어 있고(§5.4 tri-state, RBAC 매트릭스, FK cascade 등 대부분 다른 영역과 정합), RBAC·cascade·기본값 같은 핵심 축에서는 직접 대조한 범위 안에서 모순을 찾지 못했다. 다만 두 가지 실질적 drift 를 확인했다: (1) `1-data-model.md` 가 Schedule 의 타임존 최종 fallback 을 AI 노드와 동일한 `UTC` 계열로 서술하지만 실제로는 `3-schedule.md`·구현 모두 도메인 전용 `'Asia/Seoul'` 로 의도적으로 다르며 이 분기가 데이터 모델 문서에 반영되지 않았다. (2) 이번 PR 이 고치는 PATCH 부분갱신 결함의 근거가 되는 §5.4 tri-state 계약을 같은 폴더 안에서도 `trigger-list.md` 만 명시하고 `workflow-list.md`(settings)·`config.md`(AuthConfig)는 명시하지 않아, 문서만으로는 이번 결함이 "계약 위반" 이었다는 사실이 드러나지 않는다. 둘 다 코드 수정 자체를 막는 CRITICAL 은 아니며, 문서 동기화를 권고하는 WARNING 수준이다.

## 위험도

LOW
