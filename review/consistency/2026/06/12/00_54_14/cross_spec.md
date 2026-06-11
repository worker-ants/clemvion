# Cross-Spec 일관성 검토 결과

대상: `spec/5-system` (1-auth.md, 10-graph-rag.md, 11-mcp-client.md)  
검토 모드: `--impl-done` (구현 완료 후 검토), diff-base=origin/main

---

## 발견사항

### [WARNING] Integration (Org) RBAC — auth.md §3.2 vs 0-overview.md 기술 불일치

- **target 위치**: `spec/5-system/1-auth.md §3.2` 리소스별 권한 매트릭스 `Integration (Org)` 행
- **충돌 대상**: `spec/0-overview.md §6.1 (워크스페이스 단위 Integration 공유·RBAC)` 주석
- **상세**: `spec/5-system/1-auth.md §3.2` 는 `Integration (Org) | CRUD | CRUD | R | R` 으로 표기해 Owner/Admin=CRUD, Editor/Viewer=R 을 나타낸다. `spec/0-overview.md §6.1` 은 "작성/수정/삭제(create·update·delete·rotate)는 `@Roles('editor')` 가드로 Editor+ 로 제한된다"고 기술하며 이를 "라우트 가드 floor" 로 설명하고 `spec/2-navigation/4-integration.md §8` 이 SoT 라고 명시한다. `spec/2-navigation/4-integration.md §8` 은 Organization scope 에서 생성·수정·Rotate·Scope 추가 요청·삭제를 모두 "Admin 이상" 으로 제한한다. 세 문서를 종합하면 Organization Integration CRUD 는 Admin+ 이고 Editor 는 Read-only 이므로 auth.md §3.2 의 `Admin=CRUD` 표기는 내부적으로는 맞으나 `Owner=CRUD` 표기에 대해서는 Owner 도 Admin+ 조건을 만족하므로 일관성이 있다. 그러나 `spec/0-overview.md §6.1` 의 "Editor+ 라우트 가드 floor" 설명이 auth.md §3.2 의 `Editor=R` 과 표면적으로 긴장을 유발한다 — auth.md §3.2 는 이 두 레이어의 구분(라우트 가드 floor vs 도메인 RBAC)을 전혀 설명하지 않는다.
- **제안**: `spec/5-system/1-auth.md §3.2` Integration (Org) 행 하단에 `spec/0-overview.md §6.1` 과 동일한 설명 각주 추가: "Editor 는 라우트 가드 floor(editor) 이상이지만 Organization scope 의 생성·수정·삭제는 Admin+ 가 필요 — `spec/2-navigation/4-integration.md §8` 참조."

---

### [INFO] resend-verification 경로 — §1.1 본문에서 `/api/` prefix 누락

- **target 위치**: `spec/5-system/1-auth.md §1.1` 이메일/비밀번호 인증 표 "인증 메일 재발송" 행
- **충돌 대상**: `spec/2-navigation/10-auth-flow.md §5 API 표` 및 `spec/data-flow/2-auth.md §2.3 rate-limit 표`
- **상세**: `spec/5-system/1-auth.md §1.1` 은 `POST /auth/resend-verification` (prefix 없음) 으로 기재했다. 반면 `spec/2-navigation/10-auth-flow.md` 은 `POST /api/auth/resend-verification`, `spec/data-flow/2-auth.md` 도 동일 경로를 사용한다. `spec/5-system/1-auth.md §5` 엔드포인트 목록에는 이 경로 자체가 누락되어 있다. 프로젝트 전체 API 경로 관례는 `/api/` prefix 이므로 §1.1 기재가 오기(typo)이다.
- **제안**: `spec/5-system/1-auth.md §1.1` 의 `POST /auth/resend-verification` 을 `POST /api/auth/resend-verification` 으로 수정하고, §5 엔드포인트 표에도 해당 행을 추가해 completeness 보완.

---

### [INFO] MCP Integration 기본 scope — 11-mcp-client.md vs 4-integration.md §5.6 기술 부재

- **target 위치**: `spec/5-system/11-mcp-client.md §3.1`
- **충돌 대상**: `spec/2-navigation/4-integration.md §5.6 MCP Server`
- **상세**: `spec/5-system/11-mcp-client.md §3.1` 은 `Integration.scope` 기본값을 `organization` 으로 명시("기본 `organization` (개인 등록 미지원)"). `spec/2-navigation/4-integration.md §5.6` MCP Server 등록 UI 폼 설명에는 `scope` 기본값이나 개인 등록 미지원 여부가 기술되지 않아 UI 구현 시 기본 선택 동작을 오해할 여지가 있다. 직접 모순이라기보다 정보 누락이다.
- **제안**: `spec/2-navigation/4-integration.md §5.6` MCP Server 절에 "scope 는 기본 `organization` (Personal 선택 불가)" 명시 한 줄 추가.

---

### [INFO] Graph RAG 데이터 모델 §2.2 graph_extraction_status — 5종 Enum canonical SoT 이중 선언

- **target 위치**: `spec/5-system/10-graph-rag.md §2.2 Document 추가 컬럼`
- **충돌 대상**: `spec/1-data-model.md §2.12 Document`
- **상세**: `spec/5-system/10-graph-rag.md §2.2` 는 `graph_extraction_status` Enum 의 5종(`pending/processing/completed/error/failed`) 을 직접 기재하면서 "5종 enum 의 canonical 정의는 `spec/1-data-model.md §2.12`" 라고 정확히 위임하고 있다. `spec/1-data-model.md §2.12` 도 동일 5종을 `embedding_status` 와 병치해 정의한다. 두 정의가 현재 일치하므로 모순은 없다. 그러나 향후 한쪽만 변경될 경우 drift 위험이 있다. 현재 graph-rag.md §2.2 가 값 목록을 재기재하면서 "canonical 정의는 data-model 참조" 라는 지침이 혼재한다 — 값 재기재를 제거하고 참조만 유지하는 것이 drift 방지에 유리하다.
- **제안**: `spec/5-system/10-graph-rag.md §2.2` 의 `graph_extraction_status` 5종 enum 값 열거를 제거하고 "의미는 `embedding_status` 와 동일 — `spec/1-data-model.md §2.12` 참조" 만 남긴다 (현재 문서 하단의 설명 방향과 동일하게 강화).

---

### [INFO] Graph RAG §6 WebSocket 이벤트 — `document:graph_error` dead-declared 이벤트 교차 언급

- **target 위치**: `spec/5-system/10-graph-rag.md §6 WebSocket 이벤트` 주석
- **충돌 대상**: `spec/5-system/8-embedding-pipeline.md §8 WebSocket 이벤트` 및 같은 문서 §2.2 참조
- **상세**: `spec/5-system/10-graph-rag.md §6` 하단 주석은 "`document:graph_error` 는 타입 union 에만 dead-declared, 미emit" 이라고 기술한다. `spec/5-system/8-embedding-pipeline.md §8` 도 같은 사실을 재확인한다. 두 spec 이 dead-declared 이벤트를 각각 기술하는 것은 동기화 부담을 만들 수 있다. 직접 모순은 아니나 정보 분산이 문제다.
- **제안**: dead-declared 이벤트 사실은 graph-rag.md §6 에만 단일 기재하고, embedding-pipeline.md §8 에서는 참조 링크로 대체.

---

## 요약

`spec/5-system` (1-auth.md, 10-graph-rag.md, 11-mcp-client.md) 를 기존 spec 영역과 교차 검토한 결과, CRITICAL 등급의 직접 모순은 발견되지 않았다. WARNING 1건은 `spec/5-system/1-auth.md §3.2` 의 Integration (Org) 권한 매트릭스가 `spec/0-overview.md §6.1` 의 "라우트 가드 floor vs 도메인 RBAC 2-layer" 설명 없이 기재되어 있어, `spec/2-navigation/4-integration.md §8` 의 Admin+ 제약과 표면적 긴장을 일으킨다는 것이다. INFO 3건은 각각 API 경로의 `/api/` prefix 누락(§1.1 typo), MCP 기본 scope 설명 부재, Graph RAG Enum canonical SoT 의 재기재 drift 위험이다. 전반적으로 spec 간 중요 계약(데이터 모델·API shape·상태 전이·인가 흐름)은 일관되게 유지되고 있다.

---

## 위험도

LOW
