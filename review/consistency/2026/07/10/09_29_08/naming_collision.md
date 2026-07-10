# 신규 식별자 충돌 검토 — spec/5-system/1-auth.md · spec/5-system/10-graph-rag.md

## 검토 범위 참고
`git diff origin/main...HEAD` 기준으로 두 target 파일 자체에는 이번 브랜치의 변경분이 없다(현재 브랜치 diff 는 `expression suggestions prefix-drill` 관련 코드/plan 만 포함). 따라서 본 검토는 두 파일이 도입한 식별자 전반을 최신 spec/plan corpus(`spec/0-overview.md`, `spec/1-data-model.md`, `spec/conventions/*`, `spec/2-navigation/*`, `spec/data-flow/*`, `plan/**`)와 대조하는 standing 방식으로 수행했다.

## 발견사항

- **[WARNING]** `document:graph_error` WebSocket 이벤트 — "활성 이벤트" 여부가 문서 간 불일치
  - target 신규 식별자: `document:graph_error` (WS 이벤트명, `spec/5-system/10-graph-rag.md` §6 · Rationale)
  - 기존 사용처: `spec/2-navigation/5-knowledge-base.md:182`
  - 상세: `spec/5-system/10-graph-rag.md:551`(및 §6 표, `spec/data-flow/6-knowledge-base.md:289,416`)은 `document:graph_error` 가 `websocket.service.ts` 이벤트 타입 union 에는 선언돼 있으나 `graph-extraction.service.ts` 에서 실제로 emit 되지 않는 **dead-declared** 값이라고 명시하고, 실제 emit 되는 이벤트는 `document:graph_started` / `_progress` / `_completed` / `_retry` / `_failed` 5종뿐이라고 정정해 두었다. 반면 `spec/2-navigation/5-knowledge-base.md:182` 는 "WebSocket 이벤트 (`document:graph_started` / `_progress` / `_completed` / `_error` / `_retry` / `_failed`) 로 실시간 갱신"이라고 서술해 `_error` 를 여전히 정상 emit 되는 이벤트 목록에 포함시키고 있다. 동일 식별자가 한 문서에서는 "실사용 이벤트", 다른 문서에서는 "미emit dead 값"으로 서로 다르게 취급되어, 이 문서만 참고해 프론트엔드 리스너를 구현하면 절대 발생하지 않는 이벤트를 기다리게 된다.
  - 제안: `spec/2-navigation/5-knowledge-base.md:182` 의 이벤트 목록에서 `_error` 를 제거하거나, `10-graph-rag.md` §6 처럼 "`_error` 는 타입 union 에만 존재하고 미emit" 각주를 동일하게 추가해 두 문서의 서술을 일치시킨다.

## 상세 대조 결과 (충돌 없음 확인)

아래 항목은 신규 식별자 충돌 관점에서 점검했으나 모두 기존 사용처와 일관되게 cross-reference 되어 있어 충돌로 보고하지 않음:

- **요구사항 ID**: `KB-GR-MD-*` / `KB-GR-EX-*` / `KB-GR-DM-*` / `KB-GR-SR-*` / `KB-GR-PA-*` / `KB-GR-UI-*` / `KB-GR-OB-*` / `NF-GR-*` — spec 전체에서 `10-graph-rag.md` 외 재사용 없음.
- **엔티티/타입명**: `Entity` / `Relation` / `ChunkEntity` — `spec/1-data-model.md §2.12.2~2.12.4` 의 정의(필드·제약조건·인덱스)와 `10-graph-rag.md §2.3~2.5` 가 완전히 동일. `WebAuthnCredential`(1-auth.md 참조)도 `data-model.md §2.21` 과 일치.
- **API endpoint**: `/api/knowledge-bases/:id/{re-extract,entities,relations,graph/stats,graph/visualization}`, `/api/users/me/email-change/{request,verify}`, `/auth/2fa/webauthn/*` 등 — `spec/2-navigation/5-knowledge-base.md`, `spec/2-navigation/9-user-profile.md`, `spec/data-flow/*` 의 동일 경로 서술과 의미 일치 (SoT 포인터 참조 패턴, 중복 정의 아님).
- **에러 코드**: `KB_REEXTRACT_IN_PROGRESS`, `REAUTH_NOT_AVAILABLE` — `spec/5-system/3-error-handling.md` 레지스트리에 단일 정의로 등재, 다른 의미로 재사용된 곳 없음.
- **감사 액션명**: `user.email_changed` — `spec/conventions/audit-actions.md:50` 레지스트리에 정식 등재, `spec/data-flow/1-audit.md:67` 와 일치.
- **환경변수**: `WEBAUTHN_RP_ID` / `WEBAUTHN_RP_NAME` / `WEBAUTHN_ORIGIN` / `WEBAUTHN_ALLOW_FALLBACK` — `1-auth.md` 외 어디에도 재정의 없음, 충돌 없음.
- **큐/마이그레이션 식별자**: `graph-extraction` 큐, `V025~V027`/`V037` 마이그레이션 번호 — `spec/data-flow/0-overview.md`, `spec/5-system/8-embedding-pipeline.md` 등과 번호·의미 모두 일관, 실제 마이그레이션 파일과도 1:1 대응 확인.
- **파일 경로**: `spec/5-system/10-graph-rag.md` 는 기존 `1-auth.md ~ 17-agent-memory.md` 넘버링 컨벤션과 충돌 없음(번호 10 은 유일).

## 요약

두 target 문서(`1-auth.md`, `10-graph-rag.md`)는 이미 `status: implemented`/`partial` 로 안정화되어 있고, 요구사항 ID·엔티티명·API 경로·에러 코드·감사 액션명·환경변수·큐명 등 조사한 모든 식별자가 데이터 모델·conventions·navigation·data-flow 문서와 정확히 일치해 "새 식별자가 기존에 다른 의미로 이미 사용 중"인 CRITICAL 급 충돌은 발견되지 않았다. 유일한 이슈는 `document:graph_error` 이벤트의 활성/사장(dead) 여부가 `2-navigation/5-knowledge-base.md` 와 `5-system/10-graph-rag.md`/`data-flow/6-knowledge-base.md` 사이에서 어긋나는 문서 drift로, 식별자 자체의 의미 충돌이라기보다는 갱신 누락에 가깝지만 오독 위험이 있어 WARNING 으로 보고한다.

## 위험도
LOW
