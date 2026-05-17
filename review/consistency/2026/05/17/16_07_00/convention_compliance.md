# 정식 규약 준수 검토 — convention_compliance

**검토 대상**: `plan/in-progress/spec-draft-notification-dismiss.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 시각**: 2026-05-17

---

## 발견사항

### 발견사항 1
- **[WARNING]** DTO 파일명 패턴이 정식 규약과 불일치
  - target 위치: 변경안 #1-D §4.2 "DTO 위치 (developer 단계 구현)" 절
  - 위반 규약: `spec/conventions/swagger.md §5-1` — 응답 DTO 파일명은 `*-response.dto.ts` 패턴
  - 상세: draft 는 두 DTO 파일명을 다음과 같이 제안한다.
    - `dismiss-result.dto.ts` (`DismissResultDto`)
    - `dismiss-all-result.dto.ts` (`DismissAllResultDto`)
    swagger.md §5-1 은 응답 DTO 위치를 `dto/responses/*-response.dto.ts` 패턴으로 명시한다. 기존 파일 `notification-response.dto.ts` 는 이 패턴을 따르며, 그 안에 `MarkAllReadResultDto` 가 함께 수록되어 있다. 신규 DTO 를 별도 파일로 분리한다면 `dismiss-response.dto.ts` / `dismiss-all-response.dto.ts` 명명이 규약 일치이고, 기존 방식처럼 `notification-response.dto.ts` 에 통합 수록하는 방안도 규약을 위반하지 않는다. `*-result.dto.ts` suffix 는 규약에 없는 새 패턴이다.
  - 제안: 파일명을 `dismiss-response.dto.ts` / `dismiss-all-response.dto.ts` 로 변경하거나, 기존 `notification-response.dto.ts` 에 `DismissResultDto` / `DismissAllResultDto` 를 추가하는 방식으로 통일한다. DTO 클래스 이름(`DismissResultDto`, `DismissAllResultDto`) 자체는 허용 범위 내이나, 파일명과 클래스명이 동일 패턴으로 맞춰져야 혼선이 없다.

---

### 발견사항 2
- **[INFO]** 마이그레이션 파일명 표기에 플레이스홀더(`V0NN`, `V0NN+1`) 사용 — 규약 명세 형식과 이질적
  - target 위치: 변경안 #1-B 마이그레이션 분리 note, 영향 점검 표 내 migration 행
  - 위반 규약: `spec/conventions/migrations.md §1` — 파일명은 `V<번호>__<snake_case_descriptor>.sql` 형식, 번호는 단조 증가 정수
  - 상세: draft 는 `V0NN__notification_dismissed_at_add.sql` / `V0NN+1__notification_active_partial_index.{sql,conf}` 와 같이 `V0NN` 을 플레이스홀더로 사용한다. migrations.md §1 은 alphanumeric suffix(`V035a`, `V035_1`) 를 명시적으로 금지한다. `V0NN` 자체가 Flyway 파서에서 매치 실패할 수 있는 형태이므로, spec 문서에 이 표기가 최종 형태처럼 보이면 developer 가 그대로 사용할 위험이 있다. draft 본문에 "착수 직전 번호 재확인" 주석이 있어 의도적 플레이스홀더임을 나타내지만, 영향 점검 표에도 동일 표기가 반복되어 일관성이 있다.
  - 제안: 플레이스홀더임을 명확히 하려면 `V<NNN>` (꺾쇠 괄호) 표기 또는 주석을 표 셀에도 추가한다. spec 본문 반영 시 `V0NN` 표기가 최종 마이그레이션 파일명 예시처럼 보이지 않도록 표현을 정정한다. 이 항목은 INFO 수준 — 현재 draft 단계에서 developer 착수 전 확인 항목으로 명시되어 있어 실제 파일 생성 단계에서 교정될 것이 예상된다.

---

### 발견사항 3
- **[INFO]** plan 문서에 draft 변경안 본문을 직접 포함하는 구조 — spec 본문과의 경계 불명확
  - target 위치: 문서 전반 (변경안 #1-D 의 `§4 Dismiss 흐름` 새 절 전체 등)
  - 위반 규약: `CLAUDE.md §정보 저장 위치 — 기술 명세(스펙)는 spec/<영역>/*.md 본문`
  - 상세: draft 문서의 성격상 spec 반영 전 검토용 임시 전문을 plan 문서에 담는 것은 이 프로젝트의 `consistency-checker --spec` 패턴이므로 일탈이 아니다. 다만 변경안 #1-D 의 코드 블록 내 `## 4. Dismiss 흐름 (사용자 액션)` 전체가 그대로 실제 spec 문서의 새 섹션이 되므로, plan 문서의 본문이 spec 문서의 진실 원본처럼 취급될 수 있다. spec 반영 후 `plan/in-progress/` 에 draft 를 유지하는 방침(작업 절차 §3)은 일정 기간 양쪽 문서 간 drift 발생 여지를 남긴다.
  - 제안: spec 반영 완료 시 draft 내 변경안 본문 섹션에 "반영 완료" 주석을 추가하거나, 해당 절을 요약 링크로 대체하여 spec 문서가 단일 진실(SoT)임을 명확히 한다. 이는 INFO 수준 — 기능적 문제가 아니라 관리 일관성 권장 사항.

---

### 발견사항 4
- **[INFO]** 변경안 #1-D §4.2 응답 본문 표기에 `ApiOkWrappedResponse` 를 인라인 객체 형태로 표기
  - target 위치: 변경안 #1-D §4.2 "응답 코드 / 본문" 절 — `ApiOkWrappedResponse({ id: string, dismissedAt: string | null })`
  - 위반 규약: `spec/conventions/swagger.md §5-2·5-3` — `ApiOkWrappedResponse(Dto)` 는 DTO 클래스를 인자로 받아야 하며, 인라인 객체 리터럴 스키마 표기는 레거시 패턴(§6)
  - 상세: draft 본문의 이 표기는 실제 구현 코드가 아니라 spec 문서 내 동작 설명으로 쓰인 의사코드(pseudocode)다. 그러나 swagger.md §5-3 의 예시에서 `ApiOkWrappedResponse(WorkflowDto)` 처럼 DTO 클래스를 전달하는 방식을 규약으로 정하고 있고, §6 은 인라인 객체 스키마를 명시적 레거시로 분류한다. spec 문서가 규약 패턴과 다른 의사코드를 담으면 developer 가 혼동할 수 있다.
  - 제안: spec 본문 반영 시 `ApiOkWrappedResponse(DismissResultDto)` 처럼 DTO 클래스명을 명시하거나, 응답 필드 목록을 산문·표 형식으로 기술해 구현 코드와 혼동을 막는다. 이는 spec 기술 명확성의 INFO 수준 제안이다.

---

## 규약 준수 긍정 사항 (참고)

다음 항목은 정식 규약을 올바르게 따르고 있어 별도 지적 없이 기록한다.

1. **파일 위치 규약** — draft 파일이 `plan/in-progress/spec-draft-notification-dismiss.md` 에 위치하며 frontmatter(`worktree`, `started`, `owner`)를 모두 포함한다. CLAUDE.md §PLAN 문서 라이프사이클 준수.
2. **수정 대상 spec 경로 명명** — `spec/data-flow/8-notifications.md` (숫자 prefix 준수), `spec/2-navigation/_layout.md` (언더스코어 prefix 준수), `spec/2-navigation/4-integration.md` (숫자 prefix 준수). CLAUDE.md 명명 컨벤션과 일치.
3. **Rationale 섹션 추가** — 변경안 #1-E 에서 spec 문서의 Rationale 섹션에 결정 배경·기각된 대안을 추가하는 방향. CLAUDE.md 권장 3섹션(Overview/본문/Rationale) 준수.
4. **swagger.md §5 참조** — 변경안 #1-D §4.2 에서 `spec/conventions/swagger.md §5` 를 명시적으로 참조해 규약 근거를 기록.
5. **금지 경로 미사용** — `prd/`, `memory/`, `user_memo/` 옛 경로를 사용하지 않음. CLAUDE.md §금지 항목 준수.
6. **마이그레이션 파일 쌍** — `.conf` 를 `.sql` 과 동일 base name 으로 쌍으로 제안 (`V0NN+1__notification_active_partial_index.{sql,conf}`). migrations.md §1 페어 규칙 준수 의도가 명확.
7. **DTO 위치 경로** — `backend/src/modules/notifications/dto/responses/` 디렉토리는 swagger.md §5-1 위치 규약과 일치.
8. **`executeInTransaction=false` + CONCURRENTLY 패턴** — migrations.md 및 backend/migrations/README.md 의 partial index 전환 절차를 올바르게 인용.

---

## 요약

`plan/in-progress/spec-draft-notification-dismiss.md` 는 PLAN 문서 frontmatter, spec 경로 명명 컨벤션, Rationale 섹션 구조, 금지 경로 미사용 등 핵심 정식 규약을 전반적으로 잘 준수하고 있다. CRITICAL 위반은 없다. 주요 지적 사항은 두 가지다. 첫째, 신규 응답 DTO 파일명(`dismiss-result.dto.ts`, `dismiss-all-result.dto.ts`)이 swagger.md §5-1 의 `*-response.dto.ts` 패턴에서 벗어나 WARNING 등급으로 분류된다. 둘째, 마이그레이션 플레이스홀더 표기(`V0NN`)가 spec 문서 최종 본문에 그대로 노출되지 않도록 주의가 필요하며, 응답 스키마 의사코드가 레거시 패턴처럼 읽힐 여지가 있는 점도 INFO 수준으로 기록한다. 전체적으로 spec 반영 전 사전 검토용 draft 로서의 품질은 양호하며, developer 단계 착수 전 DTO 파일명 정정 한 건이 권장된다.

---

## 위험도

LOW
