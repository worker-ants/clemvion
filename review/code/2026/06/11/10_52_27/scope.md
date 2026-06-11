# 변경 범위(Scope) 리뷰

## 변경 의도

production fail-closed 가드 블록 구현 (refactor 04 C-1·M-4·M-7):
- C-1: `JWT_SECRET` 미설정/sentinel/예시값 → production 부팅 거부
- M-4: `ENCRYPTION_KEY` 공개 예시 키 → production 부팅 거부
- M-7: `MCP_ALLOW_INSECURE_URL=true` → production 부팅 거부

## 발견사항

### 핵심 코드 변경

- **[INFO]** `codebase/backend/src/common/config/production-guards.ts` (신규): 의도에 부합. 순수 함수 `assertProductionConfig` + `isFlagOn` 분리. 범위 내.
- **[INFO]** `codebase/backend/src/common/config/production-guards.spec.ts` (신규): 전 분기 단위 테스트 12건. 범위 내.
- **[INFO]** `codebase/backend/src/main.ts`: 기존 `OAUTH_STUB_MODE`/`LLM_STUB_MODE` 인라인 가드 2개 → `assertProductionConfig` 1줄로 응집. `Logger` import 추가, `ALLOW_PRIVATE_HOST_TARGETS` warn 분기 추가.
- **[INFO]** `codebase/backend/src/modules/auth/auth.module.ts`: `?? 'fallback'` dead branch 제거 → `getOrThrow`. 직접 연관 (C-1 의 fallback 정리 완료).
- **[INFO]** `codebase/backend/.env.example`: `ENCRYPTION_KEY` 실값 → all-zero placeholder + 재생성 주석. 범위 내 (M-4).

### Spec 변경

- **[INFO]** `spec/5-system/1-auth.md`: §2.1 production fail-closed 노트 + `## Rationale` 신규 섹션. 범위 내.
- **[INFO]** `spec/5-system/11-mcp-client.md`: `MCP_ALLOW_INSECURE_URL` 블록 안에 production 강제 노트 추가. 범위 내.
- **[INFO]** `spec/conventions/secret-store.md`: §3.3 placeholder 노트 추가 + R5 Rationale 신규 섹션. 범위 내.
- **[INFO]** `spec/5-system/7-llm-client.md`: 단일 문장 — `main.ts` 인라인 → `assertProductionConfig` 참조로 수정. 범위 내 (기존 가드 통합 결과로 참조 갱신 필요).
- **[INFO]** `spec/5-system/14-external-interaction-api.md`: 괄호 안 설명문 — `JWT_SECRET`/`ENCRYPTION_KEY` 가드가 `assertProductionConfig` 에 응집됐음을 명시, `INTERACTION_JWT_SECRET` 은 분리 유지 이유 추가. 범위 내 (기존 설명의 정확성 갱신).

### Plan 파일

- **[INFO]** `plan/in-progress/prod-fail-closed-guards.md` (신규): 본 worktree 작업 계획. 범위 내.
- **[INFO]** `plan/complete/security-jwt-secret-fallback.md` (신규): 이전 plan 의 `superseded` 마감. plan lifecycle 규약 준수.
- **[INFO]** `plan/in-progress/refactor/04-security.md`: C-1/M-4/M-7 항목 완료 표시. 범위 내.
- **[INFO]** `plan/in-progress/refactor/README.md`: 완료 항목 취소선 처리. 범위 내.

### Review 산출물 파일

- **[INFO]** `review/code/2026/06/11/10_04_16/`, `review/code/2026/06/11/10_17_44/`: 이전 `/ai-review` 라운드 결과물. 이번 리뷰 대상이 아니며 review 디렉터리에 정상 보관.
- **[INFO]** `review/consistency/2026/06/11/09_53_08/`, `review/consistency/2026/06/11/10_17_44/`: 이전 consistency check 결과물. 동일.

### `ALLOW_PRIVATE_HOST_TARGETS` warn 분기 추가 (main.ts)

- **[INFO]** `main.ts` 에 `ALLOW_PRIVATE_HOST_TARGETS` production warn 블록이 추가됐다.
  - 위치: `codebase/backend/src/main.ts` (bootstrap 함수 내 가드 블록)
  - 상세: M-7 구현 계획에 "throw 아닌 warn — 정당 self-host 용도" 로 명시돼 있고 plan 파일도 동일. 범위 명세에 포함된 변경이다.
  - 판단: 범위 이탈 없음. 단 plan 의 "M-7" 설명이 MCP_ALLOW_INSECURE_URL throw 와 ALLOW_PRIVATE_HOST_TARGETS warn 두 부분을 모두 포함한다.

### `Logger` import 추가 (main.ts)

- **[INFO]** `@nestjs/common`에서 `Logger` import 추가.
  - 위치: `codebase/backend/src/main.ts`
  - 상세: `ALLOW_PRIVATE_HOST_TARGETS` warn 로그에 사용. 기능 목적 import. 범위 내.

## 요약

변경된 모든 파일이 refactor 04 C-1·M-4·M-7 (production fail-closed 가드 블록) 의 구현 및 그에 필요한 spec/plan 갱신 범위 안에 있다. `main.ts` 의 `ALLOW_PRIVATE_HOST_TARGETS` warn 분기는 plan 에서 M-7 의 일부로 명시된 정책 분리이며 범위 이탈이 아니다. `spec/5-system/7-llm-client.md`와 `spec/5-system/14-external-interaction-api.md` 의 수정은 기존 가드 통합으로 인한 참조 갱신으로, 의도된 부수 변경이다. 불필요한 리팩토링·포맷팅 변경·무관한 파일 수정은 발견되지 않았다.

## 위험도

NONE
