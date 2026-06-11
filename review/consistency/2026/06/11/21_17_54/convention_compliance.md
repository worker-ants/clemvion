# 정식 규약 준수 검토 결과

검토 모드: 구현 착수 전 (--impl-prep, scope=spec/5-system)
검토 대상: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md`, `spec/conventions/cafe24-api-catalog/_overview.md`, `spec/conventions/cafe24-api-catalog/application.md`, `spec/conventions/cafe24-api-catalog/application/apps.md`

---

## 발견사항

### **[WARNING]** `1-auth.md §4.1` — Planned 감사 액션 중 resource dot-prefix 미준수 항목

- target 위치: `spec/5-system/1-auth.md` §4.1 "Planned (미구현 — 목표 커버리지)" 표, 인증 카테고리 행
- 위반 규약: `spec/5-system/1-auth.md` §4.1 본문 "Action naming 규약: `<resource>.<verb>` — resource dot-prefix 가 필수다" (동일 문서 내 자기 규약과 불일치)
- 상세: Planned 행에 `password_change`, `2fa_enable/disable` 가 dot-prefix 없이 기재되어 있다. 동일 표 내 구현된 행(`workspace.transfer_ownership`, `execution.re_run`, `auth_config.reveal`)과 계획 행의 다른 항목(`workspace.create`, `member.invite`, `workflow.create` 등)은 모두 `<resource>.<verb>` 형식을 따른다. `password_change`와 `2fa_enable/disable`만 resource prefix 없이 bare verb 형태다.
- 제안: Planned 행을 `user.password_change`, `user.2fa_enable`, `user.2fa_disable` (또는 `auth.*` 체계)로 통일하거나, 해당 이벤트가 workspace 컨텍스트를 갖는다는 설명과 함께 `workspace.password_change` 등으로 보완. `2fa_enable/disable` 슬래시 표기도 별도 행으로 분리(`2fa_enable`, `2fa_disable`)해 `AUDIT_ACTIONS` 에 추가할 때의 형식을 명확히 할 것.

---

### **[INFO]** `1-auth.md` — Overview 섹션 미선언 (3섹션 구조 권장)

- target 위치: `spec/5-system/1-auth.md` 전체 구조
- 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장
- 상세: `1-auth.md`는 `## Rationale` 섹션은 말미에 있으나 `## Overview` 섹션이 없다. 본문이 바로 `## 1. 인증`으로 시작한다. `10-graph-rag.md`는 `## Overview (제품 정의)` 섹션을 명시적으로 선언하고 있어 대조된다.
- 제안: `1-auth.md` 모두(冒頭)에 간략한 `## Overview` 블록(인증/인가 시스템의 범위·목표 요약)을 추가해 3섹션 구조를 갖추면 일관성이 높아진다. 현재 관련 문서 링크 블록이 Overview 역할을 부분 수행하고 있으나 섹션 헤더가 없다.

---

### **[INFO]** `11-mcp-client.md` — Overview·Rationale 섹션 모두 미선언

- target 위치: `spec/5-system/11-mcp-client.md` 전체 구조
- 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장
- 상세: `11-mcp-client.md`는 `## Overview`도 `## Rationale`도 없다. `## 1. 개요`로 시작해 `## 12. 확장 포인트`로 끝난다. 설계 결정 배경이 각 절 내부 인라인 설명으로 분산되어 있어 Rationale 섹션이 사실상 없는 상태다.
- 제안: INFO 수준이므로 즉시 차단 이슈는 아니나, `## Overview`(제품 범위·위치 요약)와 `## Rationale`(transport 선택, Internal Bridge vs 외부 HTTP 설계 근거 등 집약) 섹션을 추가하면 일관성이 높아진다. 규약 갱신 없이 target 수정으로 해결 가능.

---

### **[INFO]** `cafe24-api-catalog/_overview.md` — `_overview.md` basename이 `_product-overview.md` 컨벤션과 상이

- target 위치: `spec/conventions/cafe24-api-catalog/_overview.md`
- 위반 규약: CLAUDE.md "정보 저장 위치" 표 — `spec/<영역>/_product-overview.md` 명명 패턴
- 상세: CLAUDE.md는 영역 폴더의 진입 문서를 `_product-overview.md`로 명시한다. 카탈로그 내 개요 파일은 `_overview.md`를 사용하고 있다. 단, `spec-impl-evidence.md §1` 제외 규칙에서 `spec/_*.md` 및 `spec/<영역>/_*.md` (밑줄 prefix)는 frontmatter 가드에서 면제되어 있고, `_overview.md`는 이미 spec-impl-evidence 가드 예외 패턴(`_*.md`)에 포함된다. 또한 이 파일은 카탈로그 디렉토리 전용 내부 가이드로 설계됐으므로 프로덕트 영역 진입 문서와 성격이 다르다.
- 제안: 현재 사용 패턴(`_overview.md`)은 카탈로그 내부 구조 문서로서 허용 범위 안에 있다고 볼 수 있다. 단, CLAUDE.md의 `_product-overview.md` 컨벤션이 "spec 영역 진입 문서" 한정이라는 점을 명확히 하고 싶다면 CLAUDE.md에 "(카탈로그 내 개요 문서 등 보조 문서는 `_<name>.md` 자유)" 정도의 주석을 보강할 수 있다.

---

### **[INFO]** `cafe24-api-catalog/application/apps.md` — field-level 파일의 self-referential 링크

- target 위치: `spec/conventions/cafe24-api-catalog/application/apps.md` 도입부 관련 문서 링크 (`[PRD Graph RAG](./10-graph-rag.md)`)는 없으나, `10-graph-rag.md`의 `> 관련 문서: [PRD Graph RAG](./10-graph-rag.md)` 참고
- 위반 규약: 해당 없음 (단순 관찰)
- 상세: `apps.md`의 관련 문서 섹션은 `[../application.md]`와 `[../_overview.md]`를 올바르게 참조한다. 규약 위반은 없다.
- 제안: 해당 없음.

---

## 요약

`spec/5-system` 의 세 파일 및 `spec/conventions/cafe24-api-catalog` 파일군을 정식 규약 관점에서 검토한 결과, **CRITICAL 위반은 없다**. 주요 발견사항은 `1-auth.md §4.1`의 Planned 감사 액션 표에서 `password_change`·`2fa_enable/disable` 두 항목이 동일 문서에서 자체 선언한 `<resource>.<verb>` dot-prefix 규약을 따르지 않는 WARNING 1건이다. 이 항목들은 아직 미구현 계획(Planned)이라 `AUDIT_ACTIONS` 상수에 반영되기 전이므로 구현 착수 전에 정정하기 적합하다. 나머지는 3섹션 구조 권장(Overview/Rationale 미선언)에 대한 INFO 수준 형식 제안으로, 기능적 invariant 를 깨지는 않는다.

## 위험도

LOW
