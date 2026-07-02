# 신규 식별자 충돌 검토 결과

## 검토 대상
- Target: `spec/5-system/1-auth.md` (id: auth, status: partial), `spec/5-system/10-graph-rag.md` (id: graph-rag, status: implemented)
- 모드: `--impl-prep` — 두 파일 모두 기존 spec(frontmatter `code:` 매핑 보유, status implemented/partial)이며, 구현 착수 직전 재검증 성격. "신규 도입"이라기보다 이미 정착된 식별자 집합을 구현 대상 코드와 대조하는 상황.
- 대조 코퍼스: `spec/0-overview.md`, `spec/1-data-model.md`, `spec/conventions/audit-actions.md`, `plan/in-progress/*`(5건), `spec/conventions/cafe24-api-catalog/*`(무관 도메인)

## 발견사항

검토 관점 1~6(요구사항 ID·엔티티/타입명·API endpoint·이벤트/메시지명·환경변수/설정키·파일 경로) 전체에 걸쳐 CRITICAL/WARNING 급 충돌을 발견하지 못했다. 세부 근거:

- **요구사항 ID**: `KB-GR-MD-*`/`KB-GR-EX-*`/`KB-GR-DM-*`/`KB-GR-SR-*`/`KB-GR-PA-*`/`KB-GR-UI-*`/`KB-GR-OB-*`/`NF-GR-*` prefix 는 코퍼스 내 다른 문서(`0-overview.md`, `1-data-model.md`, `audit-actions.md`, plan 문서들)에서 재사용된 흔적이 없다. `1-auth.md` 는 별도 ID 네임스페이스를 새로 부여하지 않는다(RBAC 표·엔드포인트 표 위주).
- **엔티티/타입명**: `Entity`/`Relation`/`ChunkEntity` 는 `spec/1-data-model.md` §2.12.2~§2.12.4 에 그래프 RAG 문서와 완전히 동일한 필드·제약조건으로 이미 정의돼 있고, `spec/0-overview.md` §7 용어 정의(1486행)도 동일한 의미로 설명한다 — 새 의미 충돌이 아니라 이미 정합된 cross-reference.
- **API endpoint**: `/api/knowledge-bases/:id/*`(re-extract, entities, relations, graph/stats, graph/visualization) 계열과 `/api/auth/*`·`/api/auth/2fa/webauthn/*` 계열이 코퍼스 내 다른 endpoint 정의와 method+path 중복이 없다.
- **이벤트명**: `document:graph_started`/`_progress`/`_completed`/`_retry`/`_failed`(및 미emit `_error`)는 기존 `document:embedding_*` 패턴과 동일 네임스페이스 관례를 따르며 실제 값 충돌 없음.
- **환경변수**: `WEBAUTHN_RP_ID`/`WEBAUTHN_RP_NAME`/`WEBAUTHN_ORIGIN`/`WEBAUTHN_ALLOW_FALLBACK` 는 문서 내에서만 자기 일관적으로 사용되며 코퍼스의 다른 env var 와 겹치지 않는다.
- **파일 경로**: `spec/5-system/10-graph-rag.md` 는 `0-overview.md` §8 문서 맵의 `N-name.md` 넘버링 컨벤션(정수 prefix, 영역 내 정렬)을 따르고 기존 파일과 경로 충돌 없음. frontmatter `id:` 값(`auth`, `graph-rag`)도 코퍼스 내 다른 `id:`(`data-model`, `audit-actions`, `application`)와 겹치지 않는다.

INFO 수준으로 참고할 만한 점(충돌은 아님): `error-codes.md`(historical-artifact 레지스트리)·`node-output.md` 등 명명 규약 SoT 문서 본문이 이번 검색 코퍼스에 포함되지 않아, `1-auth.md` §1.5.4 의 `lower_snake_case` 예외 코드(`invitation_not_found` 등)와 `10-graph-rag.md` 의 `KB_REEXTRACT_IN_PROGRESS`/`WEBAUTHN_DISABLED` 같은 `UPPER_SNAKE_CASE` 코드가 서로 다른 명명 스타일을 쓰는 것은 이미 `1-auth.md` 본문이 스스로 "historical-artifact 예외"로 문서화해 설명하고 있어 문제로 보지 않는다.

## 요약
target 두 문서(`1-auth.md`, `10-graph-rag.md`)는 이미 구현과 매핑된 기존 spec이며, 이번 회차에서 새로 부여하는 요구사항 ID·엔티티명·API endpoint·이벤트명·환경변수·파일 경로 모두 검색 코퍼스(`0-overview.md`, `1-data-model.md`, `audit-actions.md`, plan 문서, cafe24 컨벤션) 내 기존 사용처와 의미 충돌이나 이름 재사용 없이 일관되게 상호 참조되고 있다. 구조적으로도 `N-name.md`·`id:` 네임스페이스·`<resource>.<verb>` 감사 액션 규약을 그대로 따르고 있어 신규 식별자 충돌 리스크는 낮다.

## 위험도
NONE
