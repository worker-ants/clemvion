# 신규 식별자 충돌 검토 — spec/5-system/

검토 모드: 구현 착수 전 (--impl-prep, scope=spec/5-system/)

---

## 발견사항

### [INFO] `graph_extraction_status` Enum 값 집합 불일치

- **target 신규 식별자**: `spec/5-system/10-graph-rag.md §2.2` — `graph_extraction_status` Enum: `pending / processing / completed / error / failed`
- **기존 사용처**: `spec/1-data-model.md §2.12` — `Document.graph_extraction_status` Enum: `pending / processing / completed / error / failed` 와 주석 "의미는 `embedding_status` 와 동일"
- **상세**: target의 `§2.2` 에 명시된 값 집합(`pending / processing / completed / error`) 은 `failed` 를 빠뜨리고 있다. 실제 데이터 모델(`spec/1-data-model.md §2.12`)에는 `failed` 가 포함되어 5개 상태로 기술되어 있고, target 문서의 다른 섹션(§7 에러 처리, §3.2 GraphExtractionProcessor)에서도 `graph_extraction_status = 'failed'` 를 언급한다. target §2.2 의 나열이 단순 탈락인지, 실제 다른 설계인지 불명확하다.
- **제안**: `spec/5-system/10-graph-rag.md §2.2` 의 Enum 나열을 `pending / processing / completed / error / failed` 로 통일한다.

---

### [INFO] WebSocket 채널 표기의 모호한 키 참조

- **target 신규 식별자**: `spec/5-system/10-graph-rag.md §6` — "채널은 `kb:{documentId}`"
- **기존 사용처**: `spec/5-system/8-embedding-pipeline.md §8` (참조만 나타나고 코퍼스에 본문이 없음)
- **상세**: target이 참조하는 채널 명칭 `kb:{documentId}` 가 기존 embedding-pipeline spec에서도 동일하게 사용하는지 코퍼스에서 직접 검증할 수 없다. target 내에서 "embedding-pipeline §8 과 동일" 이라고 자체 언급하지만, 임베딩 이벤트는 `document:{documentId}` 패턴을 사용하는 경우가 많아 실제로 `kb:` prefix 인지 `document:` prefix 인지 혼동 가능성이 있다.
- **제안**: `spec/5-system/8-embedding-pipeline.md §8` 의 채널 정의를 직접 참조해 `kb:{documentId}` vs `document:{documentId}` 를 명시적으로 비교하고, 두 spec 에서 동일 표기임을 확인·기재한다.

---

### [INFO] `re_run_of` / `chain_id` 컬럼이 `spec/1-data-model.md §2.13` 에 미반영

- **target 신규 식별자**: `spec/5-system/13-replay-rerun.md §9.1` — `executions` 테이블에 `re_run_of UUID NULL`, `chain_id UUID NOT NULL` 컬럼 추가
- **기존 사용처**: `spec/1-data-model.md §2.13 Execution` — 해당 컬럼이 목록에 없음
- **상세**: target 이 정의하는 두 신규 컬럼은 기존 데이터 모델 spec 에 등재되지 않은 식별자다. 충돌이 아니라 누락이지만, 단일 진실 원칙상 `spec/1-data-model.md` 가 Execution 의 최종 컬럼 목록 SoT 이므로, 구현 착수 전에 두 문서의 일치가 필요하다. 미반영 상태로 구현이 시작되면 spec 과 코드 사이의 drift 가 발생한다.
- **제안**: `spec/1-data-model.md §2.13 Execution` 에 `re_run_of` / `chain_id` 컬럼을 추가하고, `spec/5-system/13-replay-rerun.md §9.1` 과 동기화한다.

---

### [INFO] Re-run API 경로 버전 prefix 불일치

- **target 신규 식별자**: `spec/5-system/13-replay-rerun.md §8` — `POST /api/v1/executions/:executionId/re-run`, `GET /api/v1/executions/:executionId/chain`
- **기존 사용처**: `spec/5-system/1-auth.md §5` — `POST /api/auth/register`, `GET /api/audit-logs` 등 `/api/` prefix (v1 없음). `spec/5-system/12-webhook.md §3.1` — `POST /api/hooks/:endpointPath` (v1 없음). `spec/5-system/10-graph-rag.md §5` — `POST /api/knowledge-bases/:kbId/...` (v1 없음)
- **상세**: 프로젝트 내 대부분의 API 경로가 `/api/<resource>` 형식을 사용하는 반면, Re-run spec 은 `/api/v1/executions/...` 처럼 `v1` prefix 를 명시적으로 삽입하고 있다. 동일 `executions` 리소스를 다루는 기존 경로가 `v1` 없이 정의되어 있다면 라우팅 혼선 및 클라이언트 구현 오류 위험이 있다.
- **제안**: `spec/5-system/2-api-convention.md` 에서 API 버전 prefix 정책을 확인하고, 기존 경로와 통일한다. 기존이 `/api/` 무버전이라면 Re-run spec 도 `/api/executions/:executionId/re-run` 으로 수정하거나, 전체 경로에 v1 적용을 공식 결정해 spec 에 반영한다.

---

### [INFO] `RERUN_PERMISSION_DENIED` 에러 코드 — 기존 `forbidden` 코드와 충돌 가능성

- **target 신규 식별자**: `spec/5-system/13-replay-rerun.md §8.1` — 에러 코드 `RERUN_PERMISSION_DENIED`
- **기존 사용처**: `spec/5-system/1-auth.md §1.5.4` — 권한 부족 상황에 대해 `forbidden` (소문자) 를 사용. `spec/5-system/3-error-handling.md` 는 코퍼스에서 본문이 직접 제공되지 않았으나 본 리소스 코드는 `UPPER_SNAKE_CASE`.
- **상세**: target 이 도입하는 `RERUN_PERMISSION_DENIED` 는 UPPER_SNAKE_CASE 로 명명됐다. 기존 invitation spec 은 동일 권한 거부 상황에서 `forbidden` (lowercase) 를 사용한다. 두 코드가 같은 `error.code` 필드에 들어가는 값이라면 스타일이 불일치해 클라이언트 처리 패턴이 갈라진다.
- **제안**: `spec/5-system/3-error-handling.md` 의 에러 코드 컨벤션(UPPER_SNAKE_CASE vs lowercase)을 확인하고, `1-auth.md` 의 `forbidden` 또는 `13-replay-rerun.md` 의 `RERUN_PERMISSION_DENIED` 중 하나를 규약에 맞게 통일한다.

---

### [INFO] `MCP_ALLOW_INSECURE_URL` 환경변수 — 기존 ENV 목록과의 검증 필요

- **target 신규 식별자**: `spec/5-system/11-mcp-client.md §3.2` — 환경변수 `MCP_ALLOW_INSECURE_URL` (기본 `false`)
- **기존 사용처**: `spec/0-overview.md §2.7` — `S3_BUCKET` 환경변수 언급. `backend/.env.example` (코퍼스에 미포함).
- **상세**: target 이 도입하는 `MCP_ALLOW_INSECURE_URL` 과 `MCP_MAX_CONCURRENT_CONNECTIONS` (§4.3) 는 코퍼스에 포함된 다른 ENV 목록에서 충돌을 발견하지 못했다. 그러나 `backend/.env.example` 이 코퍼스에 없어 실제 기존 코드와의 중복을 직접 검증할 수 없다.
- **제안**: `backend/.env.example` 을 대조해 `MCP_ALLOW_INSECURE_URL`, `MCP_MAX_CONCURRENT_CONNECTIONS` 가 기존 ENV 와 겹치지 않음을 구현 착수 전에 확인한다.

---

### [INFO] `document:graph_error` 이벤트 의미 변경 — 소비자 코드 호환성 위험

- **target 신규 식별자**: `spec/5-system/10-graph-rag.md §6` — `document:graph_error` 의 의미가 2026-05-11 변경됨 ("영구 실패 신호로 사용하지 말 것", 대신 `document:graph_failed` 를 사용)
- **기존 사용처**: 변경 이전 소비자가 `document:graph_error` 를 최종 실패로 처리했을 가능성 (frontend 코드, graph-rag 관련 UI 컴포넌트)
- **상세**: spec 자체에 "(의미 변경, 2026-05-11)" 주석이 있어 기존 동작과 현재 정의가 다르다는 것이 명시되어 있다. 이는 식별자 충돌보다는 breaking change 이지만, 기존 클라이언트 코드가 이미 이 이벤트를 영구 실패 신호로 처리하고 있다면 재정의된 spec 에 맞춰 전면 업데이트가 필요하다.
- **제안**: frontend의 `document:graph_error` 핸들러를 검색(`frontend/`)해 여전히 이를 최종 실패로 처리하는 코드가 있는지 확인하고, 있다면 `document:graph_failed` 로 마이그레이션한다.

---

## 요약

`spec/5-system/` 의 6개 파일(1-auth, 10-graph-rag, 11-mcp-client, 12-webhook, 13-replay-rerun)과 보조 코퍼스(`spec/0-overview.md`, `spec/1-data-model.md`) 를 대조한 결과, **동일 식별자가 다른 의미로 이미 사용 중인 직접 충돌(CRITICAL)은 발견되지 않았다.** 신규 도입된 엔티티명(Entity, Relation, ChunkEntity), API 경로, 이벤트명, 환경변수, 에러 코드는 모두 기존 식별자와 다른 이름을 사용하고 있다. 다만 INFO 등급의 개선 사항 6건이 발견되었다: (1) target §2.2의 `graph_extraction_status` Enum 값 탈락, (2) WebSocket 채널 prefix 검증 필요, (3) Execution 데이터 모델의 신규 컬럼 미반영, (4) Re-run API의 `/api/v1/` 버전 prefix 불일치, (5) 에러 코드 케이싱 불일치, (6) 신규 ENV 변수의 기존 코드 대조 필요. 이들은 구현 착수 전에 정비하면 코드-spec 간 drift 와 클라이언트 혼선을 예방할 수 있다.

---

## 위험도

LOW
