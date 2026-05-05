### 발견사항

---

**[WARNING] `uniqueSlug` 절단 로직이 충돌 미해소를 야기**
- 위치: `button-slug.util.ts` — `uniqueSlug` 함수
- 상세: base slug 가 61자 이상일 때 충돌이 발생하면 `${base}-${n}` 이 64자를 초과하고, `result.slice(0, 64)` 는 접미사 숫자를 잘라낸다. 예: base = `'a'.repeat(64)` 이고 `taken` 에 이미 있으면 `'a'*64 + '-2'` → 64자 절단 → `'a'*64` (= base, 여전히 충돌). 반환된 slug 가 `taken` 에 있는 값과 동일해 **uniqueness 요건이 깨진다.**
- 제안: 접미사를 붙이기 전에 base 를 `64 - (n 자릿수 + 1)` 로 사전 절단한 뒤 suffix 를 붙여야 한다.
  ```ts
  const suffix = `-${n}`;
  const trimmedBase = base.slice(0, 64 - suffix.length);
  const result = trimmedBase + suffix;
  ```

---

**[WARNING] 마이그레이션 audit_log 가 전체 워크스페이스 대상이나 단일 workspace_id 를 기록**
- 위치: `scripts/migrate-button-ids.ts` — `main()` audit_log INSERT
- 상세: SQL 은 `WHERE n.type = ANY($1)` 로 **모든 워크스페이스** 노드를 스캔하지만, audit_log 에는 CLI 로 입력한 단일 `--workspace-id` 만 기록된다. 감사 로그가 실제 영향 범위를 반영하지 않아 추후 추적에서 오해를 일으킨다.
- 제안: audit_log 를 워크스페이스별로 한 행씩 기록하거나, `resource_type = 'global-migration'` 과 `workspace_id = NULL` 을 사용하고 `metadata.affected_workspaces` 에 목록을 포함한다.

---

**[WARNING] `normalizeButtonsArray` 와 `backfillButtonIds` 가 buttons 배열 내 null 항목을 방어하지 않음**
- 위치: `button-slug.util.ts:normalizeButtonsArray`, `scripts/migrate-button-ids.ts:backfillButtonIds`
- 상세: `buttons.map((b, i) => { if (isValidExistingId(b.id)) ... })` 에서 DB 에 저장된 버튼 항목이 `null` 이면 `b.id` 접근 시 TypeError 가 발생한다. `config.items[*]` 레벨에는 `!item || typeof item !== 'object'` 가드가 있으나 buttons 배열 레벨에는 없다.
- 제안:
  ```ts
  const result = buttons.map((b, i) => {
    if (!b || typeof b !== 'object') return b; // null guard 추가
    ...
  });
  ```

---

**[WARNING] `PORT_ID_SLUG_REGEX` 가 두 곳에 중복 정의**
- 위치: `scripts/migrate-button-ids.ts:63` 과 `nodes/core/port-id.util.ts`
- 상세: 마이그레이션 스크립트가 로컬에 동일 regex 를 선언하고 있다. `port-id.util.ts` 의 정의가 향후 변경되면 마이그레이션 스크립트와 운영 경로가 서로 다른 유효성 기준을 가져 idempotency 가 깨진다 — 마이그레이션에서 유효하다고 보존한 ID 를 운영 정규화가 재부여할 수 있다.
- 제안: 마이그레이션 스크립트도 `import { PORT_ID_SLUG_REGEX } from '../src/nodes/core/port-id.util'` 를 사용하거나, 공통 상수를 별도 파일로 분리한다.

---

**[INFO] 대용량 DB 에서 메모리 문제 가능성 (배치 미적용)**
- 위치: `scripts/migrate-button-ids.ts` — `ds.query(...)` 단일 쿼리
- 상세: 모든 워크스페이스의 button 노드를 한 번에 메모리에 적재한다. 수만 개 이상의 노드가 있으면 OOM 또는 긴 응답 시간이 발생할 수 있다.
- 제안: `LIMIT / OFFSET` 또는 cursor 기반 배치로 처리하거나, 최소한 `--limit` CLI 플래그를 추가해 점진적 실행을 지원한다.

---

**[INFO] shadow-workflow.spec.ts F-2 테스트가 carousel 타입에만 집중**
- 위치: `shadow-workflow.spec.ts` — `F-2 buttons[*].id 자동 부여` describe 블록
- 상세: `isButtonNodeType` 이 반환 true 인 `chart`, `table`, `template` 은 integration 레벨에서 테스트되지 않는다. 단위 테스트(`button-slug.util.spec.ts`) 와 `isButtonNodeType` 테스트로 보완되어 있으나, shadow 수준의 통합 검증은 carousel 만 존재한다.
- 제안: 적어도 한 케이스에서 `chart` 또는 `template` 타입으로 `add_node` → button slug 부여를 검증하는 테스트를 추가한다.

---

**[INFO] spec 의 함수 귀속이 부정확**
- 위치: `spec/3-workflow-editor/4-ai-assistant.md` — 추가된 버튼 자동 부여 정책 문단
- 상세: "서버 (`shadow-workflow.normalizeNodeButtonIds`)" 로 기술되어 있으나, `normalizeNodeButtonIds` 는 `nodes/core/button-slug.util.ts` 에 있으며 shadow-workflow 가 이를 호출하는 구조다.
- 제안: "서버 (`button-slug.util.normalizeNodeButtonIds`, `shadow-workflow` 에서 호출)" 로 수정한다.

---

### 요약

F-2 요구사항(add_node/update_node 시 buttons[*].id 자동 부여, 기존 id 보존, 마이그레이션 안전성)의 핵심 구현은 올바르다. 살아있는 id 보존 → label-slug 부여 → fallback prefix 의 3단계 정책이 util, shadow-workflow, 마이그레이션 스크립트, spec, 테스트에 걸쳐 일관되게 반영되어 있다. 다만 `uniqueSlug` 의 64자 절단 로직이 base ≥ 62자 충돌 시 실질적 비유일 slug 를 반환하는 버그가 있어 유일성 요건을 위반하며, 마이그레이션의 audit_log 가 전체 워크스페이스 범위를 단일 workspace-id 로 귀속시키는 감사 불일치, 그리고 buttons 배열 null 항목 미방어 및 regex 중복 정의도 수정이 필요하다.

### 위험도

**MEDIUM** — `uniqueSlug` 의 유일성 깨짐이 충돌 해소를 실패시킬 수 있으나, 실제로 영향받는 레이블은 62자 이상 순수 ASCII 인 극히 드문 케이스로 제한된다. 나머지 이슈는 운영 안전성·감사 일관성 수준의 개선 사항이다.