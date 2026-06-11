---
worktree: prod-fail-closed-guards
started: 2026-06-11
owner: resolution-applier
---
# Spec Fix Draft — production-guards prose (W5, W8, W9, W10)

## 분류
spec 결함 (spec 자체 수정) — 구현은 맞고 spec 본문이 부정확하거나 가독성 저하

## 원본 발견사항

### SUMMARY#5 (W5)
`spec/5-system/3-error-handling.md §1.2` `TOKEN_INVALID` 설명에서 reuse 탐지
(`is_revoked=true`) 케이스 누락 — 클라이언트가 refresh reuse 탐지 응답 코드를
에러 코드 SoT 에서 확인 불가.

### SUMMARY#8 (W8)
`7-llm-client.md §7.1` 프로덕션 차단 설명 단일 문장 200자 초과 — 주어·술어·수식·
대상이 중첩 parenthetical 로 뒤섞여 가독성 저하.

### SUMMARY#9 (W9)
`14-external-interaction-api.md §8.3` `iext_*` bullet 에 주제 4가지(서명 방식·
fallback 순서·production fail-closed·assertProductionConfig 예외)가 단일 bullet
에 혼재, 3단계 이상 중첩 괄호.

### SUMMARY#10 (W10)
`spec/conventions/secret-store.md §3.3` 신규 bullet 이 정책·근거·예외·비교를 단일
문장에 담고 기존 "미설정 → fail-fast" 항목과 부분 중복.

## 제안 변경

### W5 — `spec/5-system/3-error-handling.md §1.2`

현재 `TOKEN_INVALID` 설명에서 refresh reuse 탐지 케이스가 누락돼 있다.
`data-flow/2-auth.md §1.4` 에 이미 상세 동작이 기술되어 있으므로 두 가지 선택지:

**옵션 A (교차 참조)**: `TOKEN_INVALID` 설명 끝에 "reuse 탐지 시에도 동일 코드 반환
(참조: `data-flow/2-auth.md §1.4`)" 1줄 추가.

**옵션 B (인라인)**: 설명을 "변조/형식 오류 또는 reuse 탐지(`is_revoked` 토큰 재사용)
시 반환" 으로 확장.

권장: 옵션 A (SoT 분산 방지).

### W8 — `spec/5-system/7-llm-client.md §7.1`

200자 초과 단일 문장을 "핵심 문장 + 부연 불릿" 구조로 분리한다.

Before (개략):
> `NODE_ENV=production` 에서 `[환경변수 1·2·3…]`(spec `1-auth.md §Rationale`
> 참조, 실제 차단은 `production-guards.ts assertProductionConfig` 에서 수행)이
> 설정돼 있으면 부팅을 거부한다.

After:
> `NODE_ENV=production` 에서 LLM stub·insecure 플래그가 활성화된 채 부팅하면
> `assertProductionConfig` 가 기동을 거부한다.
>
> - 관할 환경변수: `LLM_STUB_MODE`, `MCP_ALLOW_INSECURE_URL`
> - 구현 위치: `codebase/backend/src/common/config/production-guards.ts`
> - 전체 가드 목록: `spec/5-system/1-auth.md §Rationale "Production fail-closed 가드"`

### W9 — `spec/5-system/14-external-interaction-api.md §8.3` `iext_*` bullet

4가지 주제를 nested bullet 또는 sub-section 으로 분리한다.

Before (개략):
> `iext_*` 토큰은 HS256(서명 secret 우선순위: `INTERACTION_JWT_SECRET` →
> `JWT_SECRET` fallback, production 에서 둘 다 미설정이면 `InteractionTokenService`
> 생성자 throw — `assertProductionConfig` 는 직접 관할하지 않음)으로 서명한다.

After:
> `iext_*` 토큰 서명 방식:
> - **알고리즘**: HS256
> - **secret 우선순위**: `INTERACTION_JWT_SECRET` → `JWT_SECRET` fallback
> - **production fail-closed**: 두 secret 모두 미설정이면 `InteractionTokenService`
>   생성자에서 throw (DI 초기화 단계)
> - **참고**: `assertProductionConfig` 는 `INTERACTION_JWT_SECRET` 를 직접 관할하지
>   않는다 — 모듈 로컬 컨텍스트 필요. 전체 설계 근거: `1-auth.md §Rationale`

### W10 — `spec/conventions/secret-store.md §3.3`

기존 "미설정 → fail-fast" 항목과 신규 production fail-closed 항목을 단일 항목으로
통합하거나 명시적으로 연결한다.

Before (개략):
- 기존: "secret 미설정 시 fail-fast — 서비스 기동 거부"
- 신규: "production 에서 예시 키·기본값 사용 시 `assertProductionConfig` throw ..."

After:
> **production fail-closed**: secret 미설정(`JWT_SECRET`, `ENCRYPTION_KEY`) 또는
> `.env.example` 예시 키 사용 시 `assertProductionConfig` 가 부팅을 즉시 거부한다
> (CWE-798/CWE-521 방어). 세부 조건: `spec/5-system/1-auth.md §Rationale`.
>
> *(기존 "미설정 → fail-fast" 항목을 본 항목으로 통합하거나 교차 참조로 연결)*
