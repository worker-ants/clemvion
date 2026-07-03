# 정식 규약 준수 검토 — spec/5-system/ (--impl-prep)

대상: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md` (+ 참조된 `spec/conventions/**` 전체 대조)

## 발견사항

- **[INFO]** `document:graph_error` dead-declared WS 이벤트 — 명명 규약 위반은 아니나 미사용 상태를 문서가 그대로 보존
  - target 위치: `spec/5-system/10-graph-rag.md` §6 WebSocket 이벤트, 표 하단 각주
  - 위반 규약: 직접 위반은 없음. 참고 규약은 `spec/conventions/node-output.md` Principle 3 (에러 컨트랙트 통일) 의 취지
  - 상세: `document:graph_error` 가 `websocket.service.ts` 이벤트 타입 union 에는 선언돼 있으나 실제 emit 되지 않는다고 문서가 명시적으로 밝히고 있음. 코드와 spec 이 정직하게 정합(dead code 존재를 은폐하지 않음)되어 있어 규약 위반은 아니지만, 향후 코드 정리 대상으로 남아있음을 참고 정보로 남김.
  - 제안: 규약 위반이 아니므로 조치 불요. 코드 리팩토링 시 유니온에서 해당 이벤트 타입 제거를 고려(spec 변경 불요, 코드 전용 정리).

- **[INFO]** `1-auth.md` §5 API 표와 §1.5.4/§4.1 에러 코드 표기의 대소문자 혼재가 규약이 요구하는 형태로 각주 처리됨 — 정합성 양호, 참고로만 기록
  - target 위치: `spec/5-system/1-auth.md` §1.5.4 "명명 — historical-artifact 예외" 각주
  - 위반 규약: `spec/conventions/error-codes.md` §1 (`UPPER_SNAKE_CASE`), §3 (historical-artifact 예외 레지스트리)
  - 상세: `invitation_not_found`/`invitation_expired`/`invitation_already_used`/`invitation_email_mismatch`/`forbidden`/`rate_limited` 는 `lower_snake_case` 로 §1 원칙과 다르지만, target 문서가 이를 `error-codes.md §3` historical-artifact 레지스트리 항목과 정확히 대조 각주를 달아 예외 처리를 명시하고 있음. `error-codes.md` §3 표의 해당 행과 문구·근거(rename=breaking, "초대 API 한정")가 정확히 일치함을 교차 확인함.
  - 제안: 조치 불요 — 규약이 요구하는 "명시적 예외 등재 + 이유 설명" 패턴을 정확히 따르고 있음.

- **[INFO]** `audit-actions.md` §3 레지스트리와 `1-auth.md` §4.1 실제 액션 카탈로그의 상호 정합성 양호
  - target 위치: `spec/5-system/1-auth.md` §4.1 "현재 구현된 액션" / "Planned" 표, §Rationale 4.1.A
  - 위반 규약: 없음. `spec/conventions/audit-actions.md` §1(`<resource>.<verb>` dot-prefix), §2(시제 3분류), §3(도메인별 분류 레지스트리) 대조
  - 상세: `user.password_changed`/`user.2fa_enabled`/`user.2fa_disabled`/`user.email_changed` 가 `audit-actions.md` §3 의 `user` 행(과거분사, §2.1)과 정확히 일치. `auth_config.*` 현재형 예외(§2.2), `execution.re_run`/`workspace.transfer_ownership` 도메인 고유 동사(§2.3) 분류도 일치. Planned 표의 `model_config.*` 현재형 예외 처리도 규약과 일치.
  - 제안: 조치 불요.

- **[INFO]** graph-rag.md 문서 구조의 "Overview (제품 정의)" → "1. 개요" 이중 헤더 — 프로젝트 전역 기존 패턴, target 고유 이탈 아님
  - target 위치: `spec/5-system/10-graph-rag.md` L29 `## Overview (제품 정의)`, L206 `## 1. 개요`
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장과 표면적으로 다소 다른 이중 헤딩처럼 보이나, 실질적으로는 Overview(PRD성 요구사항 카탈로그) → 본문(1~8, 기술 스펙) → Rationale 3단 구조를 그대로 따르고 있음
  - 상세: 동일 디렉토리의 `spec/5-system/8-embedding-pipeline.md` 도 `## Overview (제품 정의)` → `## 1. 개요` 동일 패턴을 사용 중임을 확인함 (L19, L25). `5-system/` 영역의 기존 컨벤션으로 굳어진 형태이며 target 문서만의 이탈이 아님.
  - 제안: 조치 불요. 다만 이 패턴이 반복되면 `spec/conventions/` 에 "5-system 영역 한정 4섹션 변형(Overview-제품정의 / 1.개요-기술요약 / 본문 / Rationale)" 을 명문화하는 것을 project-planner 가 검토할 수 있음(선택 사항, 규약 자체 갱신 권고이지 위반 아님).

- **[INFO]** `spec/conventions/cafe24-api-catalog/**` 는 target 범위(`spec/5-system/`) 밖이나 프롬프트에 포함됨 — 자체 내적 일관성 확인, target 과 직접 연관 없음
  - target 위치: 해당 없음 (프롬프트에 포함된 conventions 참조 자료)
  - 위반 규약: 없음
  - 상세: `_overview.md`/`application.md`/`application/apps.md` 3파일의 상호 참조(§4 동기 규칙, §7 field-level 레이어, frontmatter 가드 제외 규정)가 자체적으로 일관됨을 확인. `spec/5-system/1-auth.md`, `10-graph-rag.md` 어느 쪽도 cafe24 카탈로그를 참조하지 않아 이번 검토 범위와 실질적 연관은 없음.
  - 제안: 조치 불요.

## 요약

`spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md` 두 target 문서 모두 참조 대상 정식 규약(`error-codes.md`, `node-output.md`, `audit-actions.md`)의 명명·안정성·구조 규율을 정확히 따르고 있다. 특히 `1-auth.md` 는 규약이 요구하는 "historical-artifact 예외는 명시적으로 등재하고 근거를 남긴다" 는 패턴을 `error-codes.md §3` 과 정확히 교차 참조하며 준수하고 있고, 감사 액션 명명도 `audit-actions.md` 의 3분류 taxonomy 및 도메인별 레지스트리와 완전히 일치한다. `graph-rag.md` 의 WebSocket 이벤트·API 표기 역시 dead-declared 상태(`document:graph_error`)까지 투명하게 문서화해 코드-spec 간 정합성을 유지하고 있다. 문서 구조("Overview (제품 정의)" → "1. 개요" 이중 헤딩)는 `5-system/` 영역에서 반복되는 기존 패턴으로, CLAUDE.md 의 3섹션 권장 취지(Overview/본문/Rationale)를 실질적으로 충족하며 target 고유의 이탈이 아니다. CRITICAL/WARNING 등급 발견사항은 없다.

## 위험도

NONE
