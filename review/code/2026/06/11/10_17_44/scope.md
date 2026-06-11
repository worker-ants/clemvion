# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] plan/complete/security-jwt-secret-fallback.md — status 및 superseded 노트 추가
- 위치: `plan/complete/security-jwt-secret-fallback.md` diff
- 상세: diff 에서 `status: backlog` → `status: superseded` 로 갱신되고 SUPERSEDED 블록이 삽입돼 있다. plan 파일이 `plan/in-progress/` 가 아닌 `plan/complete/` 에 있으므로 완료 상태로의 전이 처리가 필요했다. 이는 `plan/in-progress/prod-fail-closed-guards.md` 체크리스트의 "security-jwt-secret-fallback.md superseded→complete" 항목에 명시된 의도된 변경이다. 별도 이슈 없음.

### [INFO] spec/5-system/1-auth.md — JWT_SECRET production fail-closed 노트 추가 (spec 갱신 의무)
- 위치: `spec/5-system/1-auth.md` diff — §2.1 테이블 아래 blockquote 1단락 삽입
- 상세: plan 체크리스트 `spec/5-system/1-auth.md §2.1: JWT_SECRET production fail-closed 노트` 에 정확히 대응한다. 삽입 내용은 해당 보안 변경을 기술하는 최소한의 spec 노트이며 범위를 벗어나지 않는다.

### [INFO] spec/5-system/11-mcp-client.md — MCP_ALLOW_INSECURE_URL production throw + ALLOW_PRIVATE_HOST_TARGETS warn 분리 노트 추가
- 위치: `spec/5-system/11-mcp-client.md` diff — §3.2 SSRF 블록 끝 blockquote 1단락 추가
- 상세: plan 체크리스트 `spec/5-system/11-mcp-client.md §본문: MCP_ALLOW_INSECURE_URL production throw + ALLOW_PRIVATE_HOST_TARGETS warn 분리` 에 정확히 대응한다.

### [INFO] spec/conventions/secret-store.md §3.3 — ENCRYPTION_KEY placeholder 노트 추가
- 위치: `spec/conventions/secret-store.md` diff — §3.3 마스터키 목록 1줄 추가 + "표준" → "표준 형식" 미세 문구 수정
- 상세: plan 체크리스트 `spec/conventions/secret-store.md §3.3: .env.example=placeholder + 예시 키 production 거부` 에 대응한다. "표준" → "표준 형식" 은 의미를 명확히 하는 최소 수정으로 무관한 순수 포맷팅은 아니다.

### [INFO] spec/5-system/14-external-interaction-api.md — INTERACTION_JWT_SECRET 설명 문구 갱신
- 위치: `spec/5-system/14-external-interaction-api.md` diff — 단일 긴 문장에서 괄호 내용 일부 갱신
- 상세: 기존 설명에서 `OAUTH_STUB_MODE/LLM_STUB_MODE 부팅 가드와 동형` 부분에 `JWT_SECRET/ENCRYPTION_KEY 부팅 가드` 언급과 `common/config/production-guards.ts 의 assertProductionConfig 에 응집` 설명이 추가됐다. 본 PR 의 신규 `production-guards.ts` 파일과 기존 `INTERACTION_JWT_SECRET` 가드의 관계를 명확히 하는 것으로 의도된 범위 내 spec 동기화다.

### [INFO] spec/5-system/7-llm-client.md §7.1 — LLM_STUB_MODE 프로덕션 차단 설명 갱신
- 위치: `spec/5-system/7-llm-client.md` diff — 단일 라인 설명 갱신
- 상세: 기존 "main.ts 부팅 가드가 … throw 한다 ("not allowed when NODE_ENV=production")" → "assertProductionConfig(common/config/production-guards.ts — JWT_SECRET·ENCRYPTION_KEY·MCP_ALLOW_INSECURE_URL·OAUTH_STUB·LLM_STUB 를 응집한 단일 production fail-closed 블록, refactor 04 C-1·M-4·M-7)" 로 더 상세해졌다. 본 PR 이 `main.ts` 의 인라인 가드를 `production-guards.ts` 로 옮기므로 설명 갱신이 필연적이며 의도된 spec 동기화다.

## 요약

이번 변경은 `plan/in-progress/prod-fail-closed-guards.md` 의 체크리스트에 기술된 범위(신규 `production-guards.ts` + `production-guards.spec.ts` 파일 생성, `main.ts` 인라인 가드 응집 리팩토링, `.env.example` ENCRYPTION_KEY placeholder 교체, spec 4건 갱신, `security-jwt-secret-fallback.md` superseded 처리)와 정확히 일치한다. 10개 파일 모두 계획된 변경 또는 그 변경에서 직접 파생된 spec 동기화에 해당하며, 요청 범위를 벗어난 리팩토링·기능 확장·무관한 포맷팅 변경·불필요한 임포트 정리는 발견되지 않았다.

## 위험도

NONE
