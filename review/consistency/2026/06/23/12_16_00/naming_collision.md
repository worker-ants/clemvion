# 신규 식별자 충돌 검토 결과

검토 대상: `spec/2-navigation` (--impl-prep 모드)
검토 일시: 2026-06-23

---

## 발견사항

### INFO — `id: system-status` vs `id: system-status-api` 구분 명확함
- target 식별자: `spec/2-navigation/15-system-status.md` — `id: system-status`
- 기존 사용처: `spec/5-system/16-system-status-api.md` — `id: system-status-api`
- 상세: 두 ID 는 `-api` suffix 로 명시 구분되어 있다. `system-status` 는 UI 화면 spec, `system-status-api` 는 백엔드 API spec 이다. suffix 차이가 명확해 혼동 가능성은 낮다.
- 제안: 현행 유지. 충돌 아님.

### INFO — `id: nav-agent-memory` vs `id: agent-memory` 구분 명확함
- target 식별자: `spec/2-navigation/16-agent-memory.md` — `id: nav-agent-memory`
- 기존 사용처: `spec/5-system/17-agent-memory.md` — `id: agent-memory`
- 상세: navigation 측이 `nav-` prefix 를 붙여 도메인 중복을 의도적으로 회피했다. 두 문서가 다른 레이어(UI 화면 vs 저장소·API)를 정의한다.
- 제안: 현행 유지. 충돌 아님.

### INFO — `id: execution-history` vs `id: execution` 구분 명확함
- target 식별자: `spec/2-navigation/14-execution-history.md` — `id: execution-history`
- 기존 사용처: `spec/3-workflow-editor/3-execution.md` — `id: execution`
- 상세: `-history` suffix 가 목록/상세 페이지(navigation UI)를 에디터 내부 실행 흐름(spec/3-workflow-editor)과 분리한다. 추가로 `id: execution-engine`(`spec/5-system/4-execution-engine.md`)·`id: execution-context`(`spec/conventions/execution-context.md`)도 존재하나 모두 suffix 로 구분된다.
- 제안: 현행 유지. 충돌 아님.

### INFO — `triggerSource` DTO 필드 vs `__triggerSource` 엔진 내부 마커 — 사전 문서화됨
- target 식별자: `spec/2-navigation/14-execution-history.md §2.4` 의 `triggerSource` (응답 DTO 5종 enum)
- 기존 사용처: `spec/4-nodes/7-trigger/0-common.md`, `spec/4-nodes/7-trigger/1-manual-trigger.md`, `spec/data-flow/10-triggers.md` — `__triggerSource` 엔진 내부 마커(3종)
- 상세: 동일 단어 기반이지만 `__` prefix 로 엔진 내부 마커, 접두사 없는 camelCase 로 DTO 필드가 명확히 분리된다. `spec/2-navigation/14-execution-history.md` Rationale R-2 에 "내부 마커 `__triggerSource`(3종)와 별개의 식별자" 임을 명시적으로 기록해 두었다.
- 제안: 현행 유지. 의도적 분리가 spec 에 근거 문서화됨.

### INFO — `RESEND_COOLDOWN_SECONDS` 상수 중복 정의 — 코드 레벨 기존 이슈
- target 식별자: `spec/2-navigation/10-auth-flow.md §2.5` 에서 `RESEND_COOLDOWN_SECONDS = 60` 을 `verify-email-content.tsx` 소속으로 참조
- 기존 사용처: `/codebase/frontend/src/app/(auth)/verify-email/verify-email-content.tsx` 와 `/codebase/frontend/src/components/auth/forgot-password-form.tsx` — 동일 이름·동일 값(`60`)이 두 파일에 각각 정의됨
- 상세: spec 이 동 상수를 단 한 곳(`verify-email-content.tsx`)의 소속으로 참조하나, 코드에는 두 파일에 독립 정의가 존재한다. spec 정의가 잘못된 것이 아니라 코드 레벨의 DRY 이슈다. impl-prep 대상인 M-2 page-API 리팩터링이 이 파일들을 직접 건드리지 않는 한 충돌은 아니다.
- 제안: INFO 기록. M-2 구현에서 `verify-email-content.tsx` 를 수정할 경우 `forgot-password-form.tsx` 의 동명 상수와 통일 여부 확인 권장. spec 변경 필요 없음.

---

## 요약

`spec/2-navigation` 전체 17개 spec 파일의 frontmatter `id`, API endpoint, DTO 이름, 상수 식별자를 기존 `spec/3-workflow-editor`, `spec/4-nodes`, `spec/5-system`, `spec/conventions`, `spec/data-flow` 와 교차 검토했다. 동일 ID 를 다른 의미로 사용하는 실질적 충돌은 발견되지 않았다. `system-status`/`system-status-api`, `nav-agent-memory`/`agent-memory`, `execution-history`/`execution` 등 유사 이름 쌍은 모두 명시적 suffix 또는 prefix 로 분리되어 있으며, `triggerSource` 와 `__triggerSource` 의 의미 차이는 spec Rationale R-2 에 사전 문서화되어 있다. `RESEND_COOLDOWN_SECONDS` 의 두 파일 중복 정의는 기존 코드 레벨 issue 로, 구현 과정에서 해당 파일을 수정할 경우 확인이 권장되나 spec 충돌은 아니다.

---

## 위험도

NONE

---

STATUS: OK
