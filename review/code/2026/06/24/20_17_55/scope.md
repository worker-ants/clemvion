# 변경 범위(Scope) 리뷰 — M-2: API_BASE_URL 분산 정의 통합

## 발견사항

### 발견된 범위 이탈 없음

모든 변경이 M-2 plan 에 명시된 범위 내에 있다.

**코드베이스 변경 7건** (모두 plan 명시 파일):
- `codebase/frontend/src/lib/api/constants.ts` (신규): plan 개선 방안 1 그대로
- `codebase/frontend/src/lib/api/client.ts`: plan 명시 3001→3011 + 중앙 import
- `codebase/frontend/src/lib/api/assistant.ts`: plan 명시 3001→3011 + 중앙 import
- `codebase/frontend/src/lib/api/auth-providers.ts`: plan 명시 로컬 const 제거, `getServerApiBaseUrl()` 사용
- `codebase/frontend/src/components/auth/login-form.tsx`: plan 명시 로컬 const 제거
- `codebase/frontend/src/components/auth/register-form.tsx`: plan 명시 로컬 const 제거
- `codebase/frontend/src/lib/websocket/ws-client.ts`: plan 명시 WS fallback 3001→3011

**리뷰 아티팩트 8건** (`review/consistency/2026/06/24/20_02_49/`):
consistency-check --impl-prep 의 산출물로, 프로젝트 규약(developer SKILL §impl-prep 의무)에 따라 구현 착수 전 생성·커밋된 파일이다. 코드 변경이 아닌 워크플로 산출물이며 범위 이탈 아님.

**포맷팅/공백**: `login-form.tsx` 와 `client.ts` 에서 각 1줄씩 빈 줄 제거가 발생했다 (`-\n-const API_BASE_URL` 패턴). 로컬 const 제거와 함께 발생한 최소 포맷팅 조정이며, 의미 변경 없는 잡다한 포맷팅 변경이 아닌 논리적 수반이다.

**주석 변경**: `auth-providers.ts` 에서 기존의 파일-상단 인라인 주석(`// Server-component fetches prefer INTERNAL_API_URL...`)이 제거되고, `getServerApiBaseUrl()` 호출 위치에 짧은 호출-포인트 주석으로 이전됐다. 로직을 `constants.ts` 로 이전하면서 불가피하게 수반된 주석 재배치이며, 설명의 양과 내용이 실질적으로 동일하다.

**임포트 변경**: 각 파일에서 로컬 const 정의를 삭제하고 중앙 import 로 교체했다. 이것이 M-2 의 핵심 목적이므로 의도된 변경이다.

## 요약

이번 커밋은 plan `03-maintainability §M-2` 에 정확히 대응하는 7개 코드 파일 변경과 의무 consistency-check 산출물 8개로만 구성된다. 변경된 모든 파일은 plan 이 명시한 교체 목록(6파일 + 신규 1파일)과 1:1 일치하며, 요청 범위 밖의 파일 수정, 기능 추가, 불필요한 리팩토링이 없다. 주석 및 포맷팅 변경은 로컬 const 제거의 직접적인 수반 효과로 scope 이탈이 아니다.

## 위험도

NONE
