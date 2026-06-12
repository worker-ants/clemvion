# 신규 식별자 충돌 검토

## 검토 대상

- **Target**: `spec/conventions/error-codes.md` (diff-base: `origin/main`)
- **검토 범위**: `spec/conventions/` — diff 결과 실제 변경 파일은 `spec/conventions/error-codes.md` 1개

## 발견사항

충돌로 판정되는 식별자는 없다.

### 신규 식별자 목록

이번 diff 에서 `spec/conventions/error-codes.md` §5 Rename 이력에 추가된 행이 도입하는 새 식별자:

| 구분 | 식별자 | 종류 |
|---|---|---|
| 신규 (대체 코드) | `WORKSPACE_ID_REQUIRED` | 에러 코드 |
| 은퇴 (구 코드) | `WORKSPACE_REQUIRED` | 에러 코드 (retired, §5 이력 등재) |

**`WORKSPACE_ID_REQUIRED` 기존 정의 확인**

- `spec/5-system/3-error-handling.md:47` — "워크스페이스 컨텍스트 부재 — `X-Workspace-Id` 헤더와 JWT `workspaceId` 둘 다 없음 (`common/decorators/workspace.decorator.ts` 발행) | 400" 으로 이미 canonical 정의 존재 (origin/main 기준).
- `spec/5-system/15-chat-channel.md:341` — §5.4 에러 표에도 동일 의미로 이미 등재 (origin/main 기준).
- `codebase/backend/src/common/decorators/workspace.decorator.ts:18` — 실제 발행 코드 문자열과 일치.
- `codebase/frontend/src/lib/i18n/backend-labels.ts:573` — i18n 라벨 매핑도 이미 존재.

따라서 `spec/conventions/error-codes.md` §5 에 추가된 행은 **새로운 식별자를 도입하는 것이 아니라**, 이미 canonical 정의된 `WORKSPACE_ID_REQUIRED` 에 대한 rename 이력을 §5 에 소급 등재하는 것이다.

**`WORKSPACE_REQUIRED` (구 코드) 정리 확인**

- `spec/` 내 `error-codes.md`·`15-chat-channel.md` 외에 `WORKSPACE_REQUIRED` 를 사용하는 문서 없음.
- `codebase/` 내 소스 파일에서 `WORKSPACE_REQUIRED` 잔존 없음 (dist/build 아티팩트 제외 전수 확인).

### 관련 식별자 (변경된 다른 spec 파일)

| 식별자 | 파일 | 판정 |
|---|---|---|
| `R-CC-18` (요구사항 ID) | `spec/5-system/15-chat-channel.md` | origin/main 에서 R-CC-17 이 마지막. R-CC-18 은 순차 신설이며 중복 없음 |
| `MakeshopMcpToolProvider` | `spec/5-system/11-mcp-client.md` | 기존 다수 spec 문서 + codebase 에서 동일 의미로 이미 사용. 새 표 row 는 기존 정의 참조일 뿐 |
| `POST /api/auth/resend-verification` | `spec/5-system/1-auth.md` | `spec/2-navigation/10-auth-flow.md`, `spec/data-flow/2-auth.md`, `codebase/backend` 에 이미 정의. 문서 완성도 추가일 뿐 |

## 요약

이번 `spec/conventions/` diff 에서 실질적으로 변경된 유일한 파일은 `spec/conventions/error-codes.md` 이며, 추가된 내용은 `WORKSPACE_REQUIRED → WORKSPACE_ID_REQUIRED` rename 이력 1행이다. `WORKSPACE_ID_REQUIRED` 는 이미 `spec/5-system/3-error-handling.md` 에 canonical 정의가 존재하고 codebase 구현·i18n 라벨도 정합하므로 신규 식별자 충돌이 없다. 은퇴 코드 `WORKSPACE_REQUIRED` 역시 소스 코드에서 완전 제거되어 잔존 충돌이 없다. 나머지 변경 파일(`1-auth.md`, `11-mcp-client.md`, `15-chat-channel.md`)이 참조하는 식별자는 모두 기존에 다른 문서에서 동일 의미로 먼저 정의된 것이며 의미 충돌이 없다.

## 위험도

NONE
