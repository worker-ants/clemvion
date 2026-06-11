# Cross-Spec 일관성 검토 결과

- 검토 모드: `--impl-prep` (구현 착수 전 검토)
- 대상 영역: `spec/5-system` (1-auth.md, 10-graph-rag.md, 11-mcp-client.md)
- 검토일: 2026-06-12

---

## 발견사항

### [WARNING] `spec/5-system/1-auth.md §1.1` — `POST /auth/resend-verification` 경로 불일치 + §5 엔드포인트 목록 누락

- **target 위치**: `spec/5-system/1-auth.md` §1.1 테이블 (line 35), §5 API 엔드포인트 목록 (line 400–427)
- **충돌 대상**:
  - `spec/2-navigation/10-auth-flow.md` line 139, 460 → `POST /api/auth/resend-verification`
  - `spec/data-flow/2-auth.md` line 228, 274 → `POST /api/auth/resend-verification`
- **상세**:
  1. `spec/5-system/1-auth.md §1.1` 이메일 인증 재발송 항목은 `POST /auth/resend-verification` (prefix 없음)으로 기술한다. 반면 `10-auth-flow.md`와 `data-flow/2-auth.md`는 모두 `/api/auth/resend-verification`(시스템 표준 `/api` prefix 포함)으로 기술한다. 다른 엔드포인트는 §5에서 모두 `/api/` prefix를 쓰므로, §1.1의 기술은 prefix 누락이다.
  2. §5 API 엔드포인트 목록에 `POST /api/auth/resend-verification`이 존재하지 않는다. §1.1에서 기능을 선언했지만 §5 공식 목록에서 빠져 있어 spec 사용자가 엔드포인트 존재를 §5만 보고 파악할 수 없다.
- **제안**:
  - `spec/5-system/1-auth.md §1.1` line 35의 경로를 `POST /api/auth/resend-verification`으로 수정.
  - `spec/5-system/1-auth.md §5` 엔드포인트 표에 `| POST | /api/auth/resend-verification | 인증 이메일 재발송 (throttle 5/min, email-enumeration-safe 응답) |` 추가.

---

### [INFO] `spec/5-system/1-auth.md §4.1` — 감사 액션 verb 표기 혼용 설명이 일부 미흡

- **target 위치**: `spec/5-system/1-auth.md §4.1` Action naming 규약 단락 및 구현된 액션 표 (line 349–399)
- **충돌 대상**: `spec/data-flow/1-audit.md` line 63, 202 (통합 action naming 규칙 논의)
- **상세**: `spec/5-system/1-auth.md §4.1`의 Action naming 규약은 "integration은 과거분사(`created`/`updated`/`deleted`), auth_config는 현재형(`create`/`update`/`delete`)"이라고 명시한다. `spec/data-flow/1-audit.md`도 동일한 설명을 담고 있어 모순은 없다. 다만 `1-auth.md` 규약 설명이 `auth_config` 계열의 예외 근거를 "과거분사가 부자연스러운 동사가 섞여" 라고 설명하는 반면, data-flow에서는 같은 현상을 더 길게 기술한다 — 내용 충돌은 아니나 단일 진실 소재가 두 파일에 분산되어 있어 향후 drift 위험이 있다.
- **제안**: 현행 유지 가능. 단 Action naming 규약의 단일 SoT를 명시(`spec/5-system/1-auth.md §4.1` 또는 `spec/data-flow/1-audit.md` 중 하나에 "canonical 정의")하고 나머지는 참조만 하는 형태로 정리를 권장.

---

### [INFO] `spec/5-system/10-graph-rag.md §2.1` — `extractionLlmConfigId` (camelCase) vs `extraction_llm_config_id` (snake_case) 혼용

- **target 위치**: `spec/5-system/10-graph-rag.md §2.1` (line 243), §3.2 (line 333), §7.1 Rationale (line 608), 요구사항 표 (line 55, 87, 155, 190)
- **충돌 대상**: `spec/1-data-model.md §2.11` (line 345, 557)
- **상세**: `spec/5-system/10-graph-rag.md`는 요구사항·기술 결정 표에서 `extractionLlmConfigId` (camelCase)를, 데이터 모델 절(§2.1)과 처리 흐름 절(§3.2)에서는 `extraction_llm_config_id` (snake_case)를 혼용한다. `spec/1-data-model.md`는 일관되게 `extraction_llm_config_id` (DB 컬럼 표기)를 사용한다. 두 표기 모두 같은 필드를 가리키므로 의미 충돌은 없으나, spec 독자가 DB 컬럼명과 camelCase API 필드를 동일 문서에서 구분 없이 섞어 읽을 경우 혼란을 줄 수 있다. 일반 규칙으로 spec 내 DB 컬럼은 `snake_case`, API/DTO 필드는 `camelCase`이어야 하므로 context에 따른 표기 구분이 명시되어 있지 않은 게 문제다.
- **제안**: `spec/5-system/10-graph-rag.md` 요구사항 표·기술 결정 표는 "API/설정 필드" 맥락이므로 `extractionLlmConfigId` 유지 가능. 다만 §2.1 데이터 모델 테이블과 §3.2 처리 흐름 설명에서는 `extraction_llm_config_id` (DB 컬럼)로 통일하고, 두 표기를 혼용할 때 "(DB: `extraction_llm_config_id`, API: `extractionLlmConfigId`)"처럼 병기 표시를 권장.

---

### [INFO] `spec/5-system/10-graph-rag.md §6` — WebSocket 채널명 `kb:{documentId}` 참조 명확화 권장

- **target 위치**: `spec/5-system/10-graph-rag.md §6` (line 539)
- **충돌 대상**: `spec/5-system/8-embedding-pipeline.md §8` (line 280, 297, 415)
- **상세**: graph-rag spec §6은 "채널은 `kb:{documentId}` (`spec/5-system/8-embedding-pipeline.md §8`과 동일)"이라고 올바르게 참조한다. embedding-pipeline spec도 `kb:${documentId}`(문서 ID 기반)임을 명확히 한다. 실제 충돌은 없으나, `8-embedding-pipeline.md`의 내부 주석(line 415)이 "과거에 KB 단위(`embedding:{knowledgeBaseId}`)에서 문서 단위로 전환됐다"는 히스토리를 기술할 뿐 현재 SoT는 정렬돼 있다. 구현 착수 시 `kb:{documentId}` 채널을 기준으로 삼으면 된다.
- **제안**: 현행 유지. 구현 시 `kb:{documentId}` 채널로 일관 사용.

---

### [INFO] `spec/5-system/11-mcp-client.md §3.1` — `Integration.auth_type='none'` 의도적 사용이 data-model과 일치함 (확인)

- **target 위치**: `spec/5-system/11-mcp-client.md §3.1` (line 100)
- **충돌 대상**: `spec/1-data-model.md §2.10` (line 285), `spec/1-data-model.md §2.17.3` (line 607)
- **상세**: mcp-client spec에서 `Integration.auth_type='none'`을 공용 MCP 서버용으로 사용하는 것은 `spec/1-data-model.md §2.10`의 `auth_type` Enum에 `none`이 포함된 것과 일치한다. `spec/1-data-model.md §2.17.3`은 "`Integration.auth_type='none'`(공용 MCP 서버 등)과 `AuthConfig.type`에 `none` 없음"을 명시적으로 구분·설명하여 모순이 없다.
- **제안**: 불필요. 현행 일관성 유지.

---

## 요약

`spec/5-system` 전체적으로 Cross-Spec 일관성은 양호하다. 주요 엔티티(User, KnowledgeBase, WebAuthnCredential, LoginHistory, ModelConfig, Integration 등)의 정의가 `spec/1-data-model.md`와 `spec/5-system/1-auth.md`·`spec/5-system/10-graph-rag.md` 간에 일치하고, RBAC 권한 매트릭스는 `spec/2-navigation/6-config.md`·`spec/2-navigation/9-user-profile.md`와 정합한다. 감사 로그 액션명 규약, WebSocket 채널명, 상태 enum도 data-flow 문서와 일관된다. 발견된 문제는 WARNING 1건(`/auth/resend-verification` 경로 prefix 누락 및 §5 엔드포인트 목록 누락)과 INFO 3건(audit verb 설명 분산, camelCase/snake_case 혼용 컨텍스트 미명시, 채널명 히스토리 주석 확인)이며, CRITICAL 충돌은 없다.

---

## 위험도

LOW
