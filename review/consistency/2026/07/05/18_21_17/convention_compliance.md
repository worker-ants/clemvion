# 정식 규약 준수 검토 — spec/5-system/ (impl-prep)

검토 대상: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md` (프롬프트에 번들된 target 발췌본 기준)
대조 규약: `spec/conventions/audit-actions.md`(번들 제공) + 저장소 내 `spec/conventions/error-codes.md` · `node-output.md` · `spec-impl-evidence.md` · `swagger.md` · `spec/5-system/2-api-convention.md`(target 이 직접 SoT 로 인용하므로 교차 확인) · `spec/5-system/6-websocket-protocol.md`(교차 확인)

---

### 발견사항

- **[INFO]** `10-graph-rag.md` 본문이 번호를 두 번 재사용하는 이중 구조 (PRD `### 1~8` 안에 nested + 이후 기술 SoT `## 1~8` 별개)
  - target 위치: `spec/5-system/10-graph-rag.md` — `## Overview (제품 정의)` 아래 `### 1. 목표` ~ `### 8. 미결 / 후속 검토`, 그리고 그 뒤에 다시 `## 1. 개요` ~ `## 8. 비-목표`
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장 — 직접 금지 조항은 아니나 "본문" 파트 안에서 헤딩 레벨(`##`)과 번호가 두 세트로 중복돼 가독성·앵커 예측성을 떨어뜨림
  - 상세: 실제 앵커 슬러그 충돌은 없음(`#3-그래프-추출-파이프라인` vs `#3-요구사항` 등 텍스트가 달라 구분됨, 스크립트로 검증 완료). 외부 문서(`0-overview.md`, `9-rag-search.md`, `8-embedding-pipeline.md`, `4-nodes/3-ai/*.md`)가 앵커를 참조하는 지점은 모두 살아있는 링크였음. 다만 "PRD 요구사항"과 "기술 스펙"을 같은 heading depth·번호 체계로 이어붙인 구조는 다른 5-system 문서(`1-auth.md` 등)의 단일 Overview→본문→Rationale 흐름과 결이 다름
  - 제안: 규약 위반은 아니므로 필수 수정 아님. 다만 향후 개정 시 PRD 섹션을 `### P1~P8` 처럼 별도 prefix 로 구분하거나 `## Overview` 하위에 완전히 접어 넣어 "본문(##)" 넘버링과 시각적으로 분리하면 유지보수 시 혼동 소지가 줄어듦 — 필수는 아니고 문서 자체 개선 제안

- **[INFO]** WS `document:graph_error` 1:1 대응 서술과 graph-rag SoT 의 dead-declared 서술 간 표현 결
  - target 위치: `spec/5-system/6-websocket-protocol.md §4.3` "그래프 추출 이벤트(6개)" 행 — `document:graph_started / _progress / _completed / _error / _retry / _failed` 를 "임베딩 이벤트와 1:1 대응"으로 서술
  - 위반 규약: 엄밀히는 conventions 위반이 아니라 spec-대-spec(6-websocket-protocol.md ↔ 10-graph-rag.md) 정합성 이슈. 다만 node-output/이벤트 payload 표기 정확성이라는 점검 관점(§2 출력 포맷 규약)과 맞닿아 있어 기록
  - 상세: `10-graph-rag.md §6`(SoT로 명시 지정된 문서)은 `document:graph_error` 가 `websocket.service.ts` 타입 union 에만 dead-declared 돼 있고 실제로 emit 되지 않는다고 명확히 밝힌다. 반면 6-websocket-protocol.md §4.3 은 6개 이벤트를 "임베딩 이벤트와 1:1 대응"이라고만 적어, 임베딩 쪭 `_error`(실제 emit 되는 in-flight 신호)와 graph 쪽 `_error`(dead-declared, 미emit)가 동일하게 동작한다는 오해를 줄 수 있음
  - 제안: `6-websocket-protocol.md §4.3` 그래프 이벤트 행에 "`_error` 는 미emit(dead-declared), 상세는 10-graph-rag.md §6 참조" 정도의 각주를 추가해 두 문서 서술을 정렬. project-planner 소관 (consistency-check 본 대상 문서 자체가 아니라 인접 spec 파일 수정이 필요하므로 별도 커밋 권장)

---

### 요약

`spec/5-system/1-auth.md` 는 명명 규약(에러 코드 UPPER_SNAKE_CASE, 감사 액션 `<resource>.<verb>` dot-prefix·시제 3분류), 출력 포맷 규약(`api-convention §5.2` 비-페이징 고정 컬렉션 `{data:{items}}` 정확히 재사용), 문서 구조(Overview/본문/Rationale 3섹션 + frontmatter `status: partial` + `pending_plans` 실존 경로), historical-artifact 예외(초대 흐름 lowercase 코드가 `error-codes.md §3` 레지스트리와 1:1 일치) 모두를 정확히 준수하고 있으며, 감사 액션 카탈로그(§4.1)도 `audit-actions.md` 의 3분류 taxonomy·레지스트리와 완전히 정합한다. `spec/5-system/10-graph-rag.md` 도 frontmatter·에러 코드 명명(`KB_REEXTRACT_IN_PROGRESS` 등)·WS 이벤트 명명 패턴이 기존 embedding-pipeline 관례를 그대로 따르며 규약 위반은 발견되지 않았다. 발견된 두 항목은 모두 INFO 등급으로, 하나는 문서 내부 번호 체계 중복(실질적 앵커 충돌 없음)이고 다른 하나는 인접 spec 문서(6-websocket-protocol.md)와의 서술 정밀도 차이이며 정식 규약을 직접 위반하는 CRITICAL/WARNING 사항은 없다.

### 위험도

LOW
