# 정식 규약 준수 검토 결과

- **Checker**: Convention Compliance
- **검토 모드**: `--impl-done` (scope=`spec/5-system`, diff-base=`origin/main`)
- **판정**: **PASS (Critical 0)** — 1 Warning, 2 Info

## 검토 컨텍스트

`diff-base=origin/main` 기준 diff 가 비어 있다 (`HEAD == origin/main == 4c59fe5b`). 즉 본 검토 대상 변경은 이미 main 에 머지된 상태이며, 직전 커밋들(#462·#465·#466·#467 — agent-memory / rerank / rag-search / llm-client)이 `spec/5-system` 을 갱신했다. 따라서 "구현 완료 후" 검토를 머지된 `spec/5-system` 현 상태 전수 점검으로 수행했다.

대상 spec (prompt 명시 + 최근 변경): `1-auth.md`, `7-llm-client.md`, `9-rag-search.md`, `10-graph-rag.md`, `11-mcp-client.md`, `17-agent-memory.md` 및 관련 conventions(`swagger.md`·`error-codes.md`·`migrations.md`).

---

## 점검 관점별 결과

### 1. 명명 규약 — PASS

- **마이그레이션 명명** (`migrations.md §1`): spec 본문이 참조하는 V번호 파일이 모두 실재하고 snake_case 소문자 descriptor 를 따른다 — `V073__agent_memory.sql`, `V080__agent_memory_expires_at.sql`, `V081__rerank_config.sql`, `V082__knowledge_base_rerank.sql`. 단조 증가·gap 없음(현 max=V082). `17-agent-memory.md §1` 의 `(workspace_id, scope_key, created_at)` 인덱스(V073)·`expires_at` partial(V080) 참조가 실파일과 일치.
- **에러 코드 명명** (`error-codes.md §1` 의미 기반 + §표기 UPPER_SNAKE_CASE): `9-rag-search.md §4.2` 의 `RERANK_ENDPOINT_FAILED`·`RERANK_NO_VALID_RESULTS`·`RERANK_LLM_GRADING_FAILED`·`RERANK_CONFIG_INVALID`, `7-llm-client.md §6` 의 `LLM_RATE_LIMIT`·`LLM_CONNECTION_ERROR`·`LLM_CONFIG_INVALID`·`LLM_CREDENTIALS_REQUIRED`·`LLM_MODEL_LIST_FAILED`·`LLM_STREAMING_UNSUPPORTED` 모두 `<DOMAIN>_<CONDITION>` 도메인 prefix + 의미 기반 명명을 따른다. inline-string 코드도 `error-codes.md §적용범위`(프로젝트 전체 문자열) 대상이며 위반 없음.
- **API endpoint 명명**: `/api/auth/2fa/webauthn/...`, `/api/knowledge-bases/:id/re-extract`, `/api/llm-configs/preview-models` 등 kebab/RESTful 명명 일관.

### 2. 출력 포맷 규약 — PASS

- 성공 응답 `{ data: ... }` 래핑 규약(`swagger.md §2-5`)을 spec 응답 예시가 준수: `1-auth.md §1.1.A` (`200 { data: { message } }`), `1-auth.md §1.4.3` (`{ data: { enabled: boolean } }`).
- 에러 envelope·HTTP status 선택이 `3-error-handling.md` SoT 와 정합 (예: `1-auth.md §1.5.4` 의 404/410/400/403/429 매핑, `7-llm-client.md §6` 의 코드↔status 표).
- `7-llm-client.md §6` 은 "미구현(Planned) 세분화 코드"(`LLM_AUTH_ERROR`/`LLM_MODEL_NOT_FOUND`/`LLM_CONTEXT_EXCEEDED`)를 명시적으로 Planned 라벨링하고 현 수렴 코드를 적시 — 출력 계약 drift 방지가 잘 되어 있음.

### 3. 문서 구조 규약 — 1 Warning

- 3섹션 구성(Overview / 본문 / Rationale): `10-graph-rag.md`·`17-agent-memory.md` 는 `## Overview (제품 정의)` + 본문 + `## Rationale` 3섹션을 갖춤. `7-llm-client.md`·`9-rag-search.md` 도 본문 + `## Rationale` 보유. `1-auth.md` 는 본문 + `## Rationale` (Overview 는 `_product-overview.md` 위임, frontmatter 의 관련 문서 링크로 진입) — 모두 규약 허용 범위.
- `_product-overview.md` 존재·underscore prefix 정상. frontmatter `id`·`status`·`code`·`pending_plans` 스키마 일관.

**[Warning] `9-rag-search.md §3.1` — 파라미터 표가 blockquote 로 분절되어 `$5` 행이 표 밖으로 떨어짐**

`spec/5-system/9-rag-search.md` 142~150행:

```
| `$3` | 유사도 임계값 (threshold) | ... |
| `$4` | 최대 결과 수 (topK) | ... |        ← 표 끝
                                             ← 빈 줄
> **`rerank_mode ≠ off` 시 분기** ...        ← blockquote (표를 끊음)
| `$5` | 워크스페이스 ID (멀티테넌시 격리) | - |  ← 표가 끊긴 뒤의 orphaned 행
```

`$4` 행과 `$5` 행 사이에 빈 줄 + blockquote 가 끼어 있어, 렌더링 시 `$5` 행이 표의 일부로 묶이지 않고 **파이프 텍스트 한 줄(깨진 행)** 로 노출된다. `$5`(workspace ID 격리 파라미터)는 §3.1 SQL 의 핵심 멀티테넌시 바인딩이라 표에서 누락 표시되면 가독성·정합성 손실. 조치: blockquote 를 표 아래(`$5` 행 다음)로 옮기거나, `$5` 행을 `$4` 바로 다음으로 이동해 표를 연속시킨다. (정식 conventions 위반은 아닌 markdown 구조 결함 — 차단 아님.)

### 4. API 문서 규약 (Swagger) — PASS (Info)

- spec 본문은 endpoint 표·인증 요건(`@Public`/JWT)·에러 코드를 기술하며, DTO 데코레이터·`writeOnly`/`readOnly`·응답 래퍼 헬퍼는 구현 레이어 책임이라 spec 직접 위반은 없음.
- `7-llm-client.md §5.5` 의 `preview-models` 가 `apiKey` 를 body 로 받되 "로그·응답·캐시 미기록 + `maskSensitiveFields`" 를 명시 — `swagger.md §1-5` 의 보안 민감 입력(`writeOnly`) 정신과 정합. **[Info]** 구현 DTO 에서 `apiKey` 필드의 `writeOnly: true` 동반 여부는 코드 레이어 검토에서 확인 권장(본 spec 검토 범위 밖).

### 5. 금지 항목 — PASS

- `error-codes.md §2` rename 금지 / §3 historical-artifact 레지스트리 위반 신설 없음.
- `migrations.md §1` alphanumeric suffix 금지(`V035a` 등) 위반 없음 — 전부 단조 정수.
- `1-auth.md §1.4.I` 의 `requiresTotp` 언급은 **deprecated 필드 제거를 문서화한 Rationale** 이지 금지 패턴 답습이 아님 (정상).

---

## Info

- **[Info]** `1-auth.md §1.4.G` 가 `V058` 마이그레이션을 NOT VALID + VALIDATE 2-step 으로 분리하지 않은 근거를 Rationale 로 명시 — `migrations.md` 가 위임한 `migrations/README.md §1` 컨벤션의 의식적 예외이며 조건(append-only·enum 확장·소규모 테이블)·향후 1M row 승격 권고를 적시. 규약 일탈을 근거와 함께 문서화한 모범 사례.
- **[Info]** `7-llm-client.md §6` Planned 에러 코드, `9-rag-search.md §3.3` rerank Planned 단계가 일관되게 "구현됨 vs 후속" 으로 라벨링 — spec-impl evidence 규약과 정합.

---

## 결론

`spec/5-system` 대상 문서는 정식 규약(`swagger.md`·`error-codes.md`·`migrations.md` + CLAUDE.md 문서 구조)을 **준수**한다. Critical 위배 없음 → 차단 사유 없음. 유일한 실질 이슈는 `9-rag-search.md §3.1` 의 markdown 표 분절(Warning, 비차단)로, 후속 편집 시 표 연속성 복구를 권장한다.
