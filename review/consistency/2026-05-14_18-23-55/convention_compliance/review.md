대상 문서와 제공된 정식 규약(`spec/conventions/cafe24-api-metadata.md`, `spec/conventions/migrations.md`, `spec/conventions/node-output.md`)을 대조하여 점검합니다.

---

### 발견사항

---

**[WARNING] DRAFT 2D §6 다이어그램 — mermaid 코드 블록 내 비표준 문법**

- **target 위치**: DRAFT 2D `### 2D. §6 상태 전이 (replace 다이어그램 + 전이 표)` — `` ```mermaid `` 코드 블록
- **위반 규약**: 직접적 규약 문서는 없으나, 기존 `spec/data-flow/integration.md §3.1` (DRAFT 3A) 이 `stateDiagram-v2` 문법을 사용하며 — CLAUDE.md의 "단일 진실 원칙(형식 일관성)"과 충돌
- **상세**: DRAFT 2D의 다이어그램은 `` ```mermaid `` 코드 블록을 선언했으나, 내부 문법이 mermaid 가 아닌 ASCII 화살표(`──▶`)를 사용한다. mermaid.js 파서는 첫 줄에 diagram type(`stateDiagram-v2`, `graph LR` 등)이 없으면 해당 블록을 파싱하지 못해 **plain text 로 렌더링**된다. DRAFT 3A(`spec/data-flow/integration.md`)는 동일한 `pending_install` 전이를 올바른 `stateDiagram-v2` 문법으로 재정의한다 — 두 파일의 형식이 불일치한다.
- **제안**: DRAFT 2D 다이어그램 블록을 `stateDiagram-v2` 문법으로 재작성하거나, mermaid 블록을 제거하고 전이 표 + 주석만 유지. 예:
  ```mermaid
  stateDiagram-v2
    pending_install --> connected : install callback success
    pending_install --> expired : install TTL 24h (status_reason=install_timeout)
    pending_install --> pending_install : callback 실패 (status 보존, last_error 갱신)
    pending_install --> [*] : manual delete
  ```

---

**[WARNING] DRAFT 1D — migration V번호 플레이스홀더 `V0XX`**

- **target 위치**: DRAFT 1D `### 1D. §3 인덱스 전략` 하단 blockquote: "후속 V0XX 로 추가한다"
- **위반 규약**: `spec/conventions/migrations.md §2 V번호 정책` — "신규 V번호는 항상 현재 main 의 max(V) **+1**", `§5 새 마이그레이션 추가 절차` — 확정된 V번호를 spec 에 명시해야 함
- **상세**: `V0XX` 는 결정되지 않은 플레이스홀더다. migration convention 은 "번호는 단조 증가하는 정수이고 gap 을 두지 않는다"고 정의하며, spec 에서 실제 migration 을 언급할 때 확정 번호를 사용하는 것이 원칙이다. 현재 초안은 `(install_token)` 부분 인덱스를 V042 와 함께 추가할 수도 있고 별도 번호로 분리할 수도 있다고 서술해 스펙 독자가 실제 적용 순서를 추론할 수 없다.
- **제안**: 두 가지 대안 중 하나를 선택:
  1. V042 에 인덱스를 포함하도록 결정하고 blockquote 를 "인덱스는 V042 에 포함된다" 로 확정
  2. 결정을 후속 plan 으로 위임한다면 "후속 plan 에서 결정 — V번호 미지정" 으로 명시하고, 이 spec 절에는 인덱스 전략 요건만 기술하고 V번호는 생략

---

**[INFO] `spec/conventions/swagger.md` 참조 — 검증 불가**

- **target 위치**: DRAFT 2F `### 2F. §9.4 공통 응답 포맷` — `CAFE24_PRIVATE_APP_ALREADY_CONNECTED (409)` 항목 주석: "swagger 규약(spec/conventions/swagger.md §2-4 — 중복/충돌은 409 ...)"
- **위반 규약**: 제공된 규약 목록(`cafe24-api-metadata.md`, `migrations.md`, `node-output.md`)에 `swagger.md` 가 포함되지 않아 §2-4 준수 여부를 본 검토에서 독립적으로 확인 불가
- **상세**: 드래프트가 인용하는 "swagger 규약 §2-4" 가 실제로 `spec/conventions/swagger.md` 에 존재하고 해당 내용을 담고 있는지 확인 필요. `INTEGRATION_IN_USE(409)` 선례 인용은 일관성 있어 보이나, swagger.md 가 아직 없거나 §2-4 내용이 없다면 dead reference 가 된다.
- **제안**: `spec/conventions/swagger.md §2-4` 가 존재하는지 확인 후 적용. 없다면 "기존 `INTEGRATION_IN_USE(409)` 선례와 통일" 로 근거를 변경.

---

**[INFO] 경로 파라미터 명명 — `:installToken` (camelCase) vs DB 컬럼 `install_token` (snake_case)**

- **target 위치**: DRAFT 2E, 2F-bis, 2J-1, 2J-2 — `GET /api/integrations/oauth/install/cafe24/:installToken`
- **위반 규약**: `spec/conventions/swagger.md` (검증 불가) — path parameter 명명 규칙
- **상세**: REST API 에서 path parameter 를 camelCase(`installToken`)로, DB 컬럼을 snake_case(`install_token`)로 구분하는 것은 일반 관행이다. 단, 프로젝트의 기존 API 경로 파라미터 명명 패턴(예: `:workspaceId`, `:integrationId`)이 camelCase 인지 확인이 필요하다 — swagger.md §2-4 또는 기존 endpoint spec 을 참조.
- **제안**: swagger.md 또는 기존 API spec 의 경로 파라미터 명명 패턴 확인 후 일치 여부 검증. 프로젝트가 camelCase 를 이미 사용한다면 이슈 없음.

---

**[INFO] `credentials_unreadable` 공식화 — data-flow §3.2 와의 기존 처리 정합성**

- **target 위치**: DRAFT 3B `### 3B. §3.2 status_reason 매핑` — `error` 행에 `credentials_unreadable` 추가
- **위반 규약**: 직접 규약 위반은 아님 — 단일 진실 원칙(CLAUDE.md §정보 저장 위치)에서 파생
- **상세**: 드래프트 1C는 "`credentials_unreadable` 은 pre-existing 분기(`integrations.service.ts:845`)로 본 개정 범위 외이나 정합성 유지를 위해 §10.4 / data-flow §3.2 에 동시 명시"라고 서술한다. 현재 `spec/data-flow/integration.md §3.2` 에 `credentials_unreadable` 이 이미 존재하는지, 아니면 이번에 처음 추가되는지에 따라 "본 개정 범위 외" 서술의 의미가 달라진다. 기존 spec 에 없던 값이라면 DRAFT 는 실제로 이 값을 신규 도입하는 셈이다.
- **제안**: 현재 `spec/data-flow/integration.md §3.2` 의 실제 내용을 확인해 `credentials_unreadable` 이 기존에 명시되어 있는지 점검.

---

### 요약

대상 드래프트는 제공된 3개 정식 규약(`cafe24-api-metadata.md`, `migrations.md`, `node-output.md`)에 대한 직접 위반이 없다. 에러 코드는 전부 `UPPER_SNAKE_CASE`, `status_reason` 저장값은 `snake_case`, 카테고리/Resource 용어 구분은 `cafe24-api-metadata.md §6` 과 정합하며, `## Rationale` 섹션 신설도 CLAUDE.md 권장 구조를 따른다. 다만 두 가지 WARNING 이 실제 적용 전 수정을 권고한다: DRAFT 2D 의 mermaid 코드 블록이 렌더링 불능 문법을 사용하는 점, DRAFT 1D 의 `V0XX` 플레이스홀더가 migration convention 의 확정 V번호 원칙에 어긋나는 점. INFO 항목은 `swagger.md` 접근 가능 시 추가 검증이 필요한 사항들이다.

### 위험도
**LOW**