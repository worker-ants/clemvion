# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

해당 없음 — 변경 코드가 매트릭스의 어떤 trigger 에도 동반 갱신 누락을 일으키지 않습니다.

### 매트릭스 적재 결과

총 19개 row. 변경 파일 목록 기준으로 순차 매칭한 결과:

| 검토 항목 | 판정 |
|---|---|
| `new-node` / `node-schema-change` (glob: `codebase/backend/src/nodes/**`) | 비매칭 — 변경 파일은 `chat-channel/shared/` 및 `execution-engine/` 하위이며 `src/nodes/` 밖 |
| `new-ui-string` (semantic, TSX) | 매칭 + 충족 — `dynamic-form-ui.tsx` 의 4개 신규 i18n 키(`formFileMimeRejected`, `formFileSizeExceeded`, `formFileTotalExceeded`, `formFileCountExceeded`)가 `/dict/ko/editor.ts`(line 256-259) 와 `/dict/en/editor.ts`(line 260-263) **양쪽** 등록 완료. i18n parity 충족 |
| `new-warning-code` / `new-error-code` | 비매칭 — 이번 PR 에 신규 `warningRules` 또는 `ErrorCode` enum 추가 없음 |
| `new-backend-ui-zod-value` | 비매칭 — 신규 `ui.label`/`hint`/`group` 값 없음 |
| `auth-session-flow-change` | 비매칭 — `auth/` 미변경 |
| `run-debug-flow-change` (semantic) | 비매칭 — 실행 엔진 내 form 검증 경로 변경이지만 실행·디버깅 흐름 자체(로그·디버그 표면·실행 상태 전환) 변경 아님 |
| `spec-major-change` (glob: `spec/4-*/**`) | 매칭되나 해당 row 의 targets 는 spec frontmatter(`code:/status:/pending_plans:`) 정합 — user-guide MDX 동반 갱신 대상이 아님. spec-frontmatter reviewer 소관 |
| `userguide-gui-flow-section` | 비매칭 — 이번 PR 에 `codebase/frontend/src/content/docs/**` MDX 변경 없음 |

### docs MDX 현재 상태 확인

`codebase/frontend/src/content/docs/02-nodes/presentation.mdx` 및 `.en.mdx` 는 이번 PR 에서 변경되지 않았으나 이미 올바른 상태를 유지하고 있습니다:

- FieldTable 에 `allowedMimeTypes`(기본 목록/built-in default list), `maxFileSize`(10), `maxTotalSize`(50), `maxFiles`(5) 가 정확한 기본값으로 기재됨.
- 구 "Planned / 미구현" 마커 없음 (prior commit #332 에서 제거됨).
- `<Callout>` 에 실행 파일·스크립트·아카이브가 기본 MIME 목록 밖이라는 사용자 안내 포함.

클라이언트/서버측 검증의 reject 흐름·오류 메시지 상세는 spec(`spec/4-nodes/6-presentation/4-form.md`)에 서술되어 있으며, 노드 사용자 가이드 FieldTable 수준의 동반 갱신은 불필요합니다.

## 요약

매트릭스 19개 row 중 의미 있게 매칭된 trigger 는 `new-ui-string` 1건이며, 4개 신규 i18n 키가 ko/en 양쪽 dict 에 동일 PR 안에서 등록되어 parity 가 충족됩니다. 나머지 trigger 는 비매칭이거나 이미 충족 상태입니다. 동반 갱신 누락 0건.

## 위험도

NONE
