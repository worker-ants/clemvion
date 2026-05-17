# 정식 규약 준수 검토 — `spec/data-flow/`

검토 범위: `spec/data-flow/` 전체 (0-overview.md + 12개 도메인 파일)
검토 모드: 구현 착수 전 검토 (`--impl-prep`)
주요 관심 파일: `spec/data-flow/8-notifications.md` (신규 dismiss 흐름 추가)

---

## 발견사항

### 1. [WARNING] `0-overview.md` 도메인 인덱스 카운트 오기 — "13개" vs 실제 12행

- **target 위치**: `spec/data-flow/0-overview.md` §2 (라인 102)
- **위반 규약**: CLAUDE.md "프로젝트 스펙 문서" — "변경이 누적되어 정합성이 흐려질 경우 문서를 전체적으로 정리·재구성한다."
- **상세**: `## 2. 도메인 인덱스`에서 "다음 13개 도메인 spec 이 본 폴더에 있다"고 기술하고 있으나 실제 인덱스 표에는 12행(인증·워크스페이스·워크플로우·실행·KB·Integration·Trigger·LLM Usage·File Storage·Notifications·Audit·Observability)이 있다. 실제 파일도 12개(`1-audit.md` ~ `12-workspace.md`). 숫자와 실제가 불일치한다.
- **제안**: `0-overview.md` §2 본문의 "13개"를 "12개"로 정정한다.

---

### 2. [WARNING] `0-overview.md` 인덱스 링크 텍스트가 실제 파일명과 불일치

- **target 위치**: `spec/data-flow/0-overview.md` §2 인덱스 표 (라인 107~118)
- **위반 규약**: CLAUDE.md "정보 저장 위치 — 단일 진실 원칙"; 문서 내 링크는 실제 경로를 정확히 반영해야 한다.
- **상세**: 인덱스 표의 "파일" 열에서 링크 텍스트와 실제 파일명이 다음과 같이 어긋난다.
  - `auth.md` → 실제 파일: `2-auth.md`
  - `workspace.md` → 실제 파일: `12-workspace.md`
  - `workflow.md` → 실제 파일: `11-workflow.md`
  - `execution.md` → 실제 파일: `3-execution.md`
  - `knowledge-base.md` → 실제 파일: `6-knowledge-base.md`
  - `integration.md` → 실제 파일: `5-integration.md`
  - `triggers.md` → 실제 파일: `10-triggers.md`
  - `llm-usage.md` → 실제 파일: `7-llm-usage.md`
  - `file-storage.md` → 실제 파일: `4-file-storage.md`
  - `notifications.md` → 실제 파일: `8-notifications.md`
  - `audit.md` → 실제 파일: `1-audit.md`
  - `observability.md` → 실제 파일: `9-observability.md`
  
  링크 타겟(`./2-auth.md` 등)은 실제 파일과 일치하지만, 표시 텍스트(예: ``[`auth.md`]``)가 prefix 없이 짧게 표시된다. 독자가 파일을 직접 탐색할 때 prefix 번호를 참고하지 못한다. CLAUDE.md 명명 컨벤션 표에서 `N-name.md` 형식이 "정렬 보장된 상세 spec 문서"임을 명시한다 — 인덱스에서 이 전체 파일명(`2-auth.md`)이 드러나는 것이 규약 일관성에 부합한다.
- **제안**: 링크 텍스트를 전체 파일명 형식으로 갱신한다. 예: `` [`2-auth.md`](./2-auth.md) ``.

---

### 3. [CRITICAL] `8-notifications.md` Schema 매핑에 미확정 마이그레이션 번호(`V<NNN>`) 잔류

- **target 위치**: `spec/data-flow/8-notifications.md` §2.1 Schema 매핑 표 (라인 67)
- **위반 규약**: `spec/conventions/migrations.md` — 마이그레이션 번호는 "단조 증가하는 정수"여야 하며, spec 문서는 최종 상태(latest)를 기술해야 한다 (CLAUDE.md "제품의 최종 상태를 정의한다").
- **상세**: `notification` 테이블의 Schema 매핑 표에서 `dismissed_at` 컬럼 추가 마이그레이션 번호를 `V<NNN>`으로 표기하고 있고, 인덱스 변경도 `V<NNN+1>`로 표기한다. spec 문서는 "history가 아닌 latest에 대한 기술"이어야 하므로, 착수 시점에 확정한 실제 V번호가 채워져야 한다. 구현 착수 이전 단계이더라도 spec이 플레이스홀더를 갖고 있으면 개발자가 엉뚱한 번호로 마이그레이션을 작성하거나 spec과 코드 사이 불일치가 발생할 위험이 있다. migrations.md §3 절차("착수 직전 `ls backend/migrations/` 로 현행 최신 번호 확인 후 +1, +2 채움")는 구현 단계의 행동 지침이지, spec 문서 안에 플레이스홀더를 남기는 근거가 아니다.
- **제안**: 구현 착수 전 `ls backend/migrations/ | tail -2`로 현재 최신 번호를 확인한 뒤, spec의 `V<NNN>`을 실제 번호(예: `V050`, `V051`)로 채우고 commit한다. spec 문서가 플레이스홀더를 포함한 채 확정 상태로 유지되어서는 안 된다.

---

### 4. [WARNING] `8-notifications.md` §3 상태 전이 다이어그램 단순화 주석이 spec 본문 위치에서 오해를 유발

- **target 위치**: `spec/data-flow/8-notifications.md` §3 상태 전이 (라인 100~103)
- **위반 규약**: `spec/data-flow/0-overview.md` §3.4 — "엔티티가 `status` 류 enum 을 가질 때 Mermaid `stateDiagram-v2`로 전이를 그린다"; CLAUDE.md "본문 (스펙) — 데이터 모델, 상태 전이 등 기술 명세."
- **상세**: §3 다이어그램에 "위 다이어그램은 `is_read` 단일 차원의 전이만 단순화해 표시한다"는 주석이 있다. 본 spec은 두 독립 차원(`is_read`, `dismissed_at`)을 모두 다루고 있어 단순화 다이어그램 하나만으로는 완전한 상태를 표현하지 못한다. 2차원 조합 상태 표(§4.1)는 별도 섹션에 있어 일관성 있게 읽히지 않는다. 상태 전이 섹션이 두 차원을 통합한 다이어그램 또는 명시적 분리 다이어그램 두 개를 제공하는 것이 `0-overview.md` §3.4 규약에 더 부합한다.
- **제안**: §3 상태 전이를 ① `is_read` 전이, ② `dismissed_at` 전이 두 개의 `stateDiagram-v2`로 분리 표기하거나, §4.1 조합 표를 §3으로 병합해 단일 섹션에서 완전한 상태를 제공한다. 또는 현행 방식을 유지하되 §4 제목을 "상태 전이 (상세)"로 변경해 §3의 연속임을 명확히 한다.

---

### 5. [INFO] `8-notifications.md` §1 다이어그램에 `Source → Sink` 표준 섹션 헤더 미사용

- **target 위치**: `spec/data-flow/8-notifications.md` §1 (라인 24)
- **위반 규약**: `spec/data-flow/0-overview.md` §3.2 — "Source → Sink 다이어그램" 섹션을 명시적으로 두도록 권장.
- **상세**: 다른 도메인 문서들은 `## 1. Source → Sink` 헤더를 명시적으로 두고 있다(예: `1-audit.md`, `2-auth.md`, `10-triggers.md`). `8-notifications.md`의 §1 헤더는 `## 1. Source → Sink`로 동일하게 명명되어 있어 규약 준수 상태이나, 다이어그램 바로 아래에 서브섹션(§1.1)이 하나 더 있어 구조는 일관된다. 실질적인 위반은 없으며 INFO 수준의 관찰이다.
- **제안**: 특별히 수정 불필요. 현행 구조 유지.

---

### 6. [WARNING] `8-notifications.md` §4.2 Endpoint 표에서 Swagger 규약(`ApiOkWrappedResponse`) 사용 명시가 spec 문서에 포함

- **target 위치**: `spec/data-flow/8-notifications.md` §4.2 (라인 136~144)
- **위반 규약**: CLAUDE.md 역할 분담 — "기술 명세(스펙)"은 `spec/`에, 구현 세부사항은 구현 단계에서 결정. `spec/conventions/swagger.md`는 구현 단계 가이드.
- **상세**: §4.2에서 `ApiOkWrappedResponse(DismissNotificationResponseDto)` 같은 NestJS/Swagger 헬퍼 클래스명을 spec 문서 본문에 직접 기재한다. spec 문서의 역할은 "무엇을 반환할지"(shape, HTTP code)를 정의하는 것이고, "어떤 데코레이터로 구현할지"는 `spec/conventions/swagger.md`에 위임해야 한다. 현재 표기는 spec과 구현 가이드의 경계를 흐린다. 단, 해당 내용은 `swagger.md §5`를 명시적으로 참조(링크)하며 DTO 클래스명을 명시하는 형태로 개발자에게 편의를 제공하는 의도가 있어 CRITICAL은 아니다.
- **제안**: DTO 파일 경로와 클래스명을 "구현 참고" 블록으로 분리하거나 Rationale로 이동한다. spec 본문에는 응답 shape(`{ id, dismissedAt }`, `{ affected }`)와 HTTP 코드만 명시하고, 구현 클래스명은 `> 구현 참고:` 블록으로 분리한다.

---

### 7. [INFO] `8-notifications.md` §4.6에서 미래 follow-up 내용이 spec 본문에 포함

- **target 위치**: `spec/data-flow/8-notifications.md` §4.6 (라인 169~175)
- **위반 규약**: CLAUDE.md "spec/ 하위 문서는 제품의 최종 상태를 정의한다. history가 아닌 latest에 대한 기술."
- **상세**: §4.6 "WebSocket 동기화 (follow-up)"은 "본 phase는 ... 다른 device 간 ... follow-up phase에서 검토하며"라고 기술한다. 미래 phase에서 할 것의 outline이 spec 본문에 남아 있어, spec이 현재 상태가 아닌 미래 의도를 포함하게 된다. CLAUDE.md는 spec이 "역사가 아닌 latest"여야 한다고 명시한다.
- **제안**: §4.6 내용을 Rationale 섹션으로 이동하거나, follow-up 사항은 `plan/in-progress/` plan 문서에 별도 체크리스트 항목으로 등록하고 spec에서는 제거한다.

---

### 8. [INFO] `8-notifications.md` Rationale 날짜 표기가 일부 섹션 제목에 포함

- **target 위치**: `spec/data-flow/8-notifications.md` Rationale 섹션들 (라인 202, 236, 263, 275, 308)
- **위반 규약**: CLAUDE.md "spec/ 문서는 history가 아닌 latest에 대한 기술."
- **상세**: Rationale 소제목에 `(2026-05-17)`이 포함되어 있다. spec 문서는 변경 이력을 포함하는 CHANGELOG가 아니므로 날짜 표기는 불필요하다. Rationale의 내용 자체는 규약에 따른 "결정의 배경·근거"로 적절하나, 제목에 날짜를 붙이는 패턴은 다른 도메인 spec 파일(예: `2-auth.md`, `5-integration.md`)에서 사용하지 않는다.
- **제안**: Rationale 소제목에서 날짜 suffix `(2026-05-17)`를 제거한다. 날짜 추적이 필요하면 git blame으로 충분하다.

---

## 요약

`spec/data-flow/` 폴더 전체는 정식 규약(`spec/conventions/`)과 CLAUDE.md 명명 컨벤션을 전반적으로 잘 따르고 있다. 파일명(`N-name.md`), `0-overview.md` prefix, Overview/본문/Rationale 3섹션, Mermaid 다이어그램, Schema 매핑 표, 외부 의존 섹션 등 핵심 구조가 규약에 부합한다.

주요 위반사항은 다음 두 가지다. 첫째, `0-overview.md`의 도메인 수("13개") 오기와 인덱스 링크 텍스트 prefix 누락(WARNING)이 정보 정합성을 해친다. 둘째, `8-notifications.md`의 Schema 매핑 표에 남아 있는 미확정 마이그레이션 번호 플레이스홀더(`V<NNN>`)가 가장 심각한 문제(CRITICAL)로, spec이 "최종 상태"를 표현해야 한다는 원칙에 반한다. 구현 착수 전 이 플레이스홀더를 실제 번호로 채우지 않으면 마이그레이션 번호 경쟁 조건 및 spec-코드 불일치가 발생할 수 있다.

---

## 위험도

**MEDIUM**

CRITICAL 1건(마이그레이션 번호 플레이스홀더)이 구현 착수 전 반드시 해소되어야 한다. 나머지는 WARNING·INFO 수준으로 시스템 동작에 즉각 영향을 주지 않으나, 정보 정합성을 위해 순차 정정을 권장한다.
