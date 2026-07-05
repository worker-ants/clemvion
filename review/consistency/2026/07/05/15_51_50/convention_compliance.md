# 정식 규약 준수 검토 — spec/2-navigation/ (invite-accept-confirm-ui, impl-done)

## 검토 범위 확인

`--impl-done` 모드로 전달된 target 은 `spec/2-navigation/` 영역 문서 전체(0-dashboard, 1-workflow-list,
10-auth-flow, 11-error-empty-states, 13-user-guide, 14-execution-history, 15-system-status,
16-agent-memory)지만, `origin/main` 대비 실제 diff 는 다음 한 곳뿐이다(`git diff origin/main --stat --
spec/2-navigation/`):

```
spec/2-navigation/10-auth-flow.md | 2 ++
1 file changed, 2 insertions(+)
```

즉 이번 세션에서 실질적으로 검토해야 할 신규 콘텐츠는 `10-auth-flow.md` §2.6 에 추가된 blockquote 2줄
(이미 로그인한 사용자가 초대 메일 링크로 진입할 때 `/invitations/accept?token=…` 로 리다이렉트하는 분기
설명)이며, 그 외 파일은 이번 세션의 diff 대상이 아닌 기존 콘텐츠다. 아래 발견사항은 신규 diff를 1차
대상으로 하되, 그 diff 가 참조·의존하는 기존 규약 정합성도 함께 확인했다.

## 발견사항

### 신규 diff (10-auth-flow.md §2.6) — 규약 위반 없음

- 신규 텍스트가 참조하는 라우트 `/invitations/accept?token=…` 는 같은 문서가 링크하는
  `5-system/1-auth.md §1.5.3` 의 기존 문구("수락 페이지는 `/invitations/accept?token=<초대토큰>`")와
  경로·쿼리 파라미터 이름(`token`)이 정확히 일치한다 — 신규/기존 스펙 간 명명 drift 없음.
- `has_session` 힌트 쿠키 설명은 §7 인증 상태 관리(`10-auth-flow.md §7.1`)의 기존 정의와 동일 서술을
  재사용하고 있으며, 코드(`auth-store.ts`, `proxy.ts`, `register-form.tsx`)도 동일 쿠키명·정책으로
  구현되어 있음을 확인했다(절대경로 grep 으로 확인, `document.cookie` 값·만료 정책 일치).
- 인용된 anchor(`#7-인증-상태-관리`, `1-auth.md#153-...`)는 실제 헤딩과 slug 가 일치하며,
  `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` (11 tests) 실행 결과 PASS —
  링크 무결성 가드에 저촉되지 않는다.
- `spec-frontmatter.test.ts` / `spec-code-paths.test.ts` / `spec-status-lifecycle.test.ts` /
  `spec-area-index.test.ts` (총 953 tests) 모두 PASS — frontmatter-evidence family 규약(§2~§4,
  `spec/conventions/spec-impl-evidence.md`) 위반 없음.

등급 부여할 CRITICAL/WARNING 없음 — 이 diff 는 규모가 작고 기존 SoT(§1.5.3)와 완전히 대칭적으로
정합되어 있다.

### [INFO] `has_session` 쿠키·`/invitations/accept` 서술 중복 (10-auth-flow.md §2.6 vs §1.5.3)

- target 위치: `spec/2-navigation/10-auth-flow.md` §2.6 신규 blockquote, `spec/5-system/1-auth.md`
  §1.5.3 기존 "경로·진입" 노트
- 위반 규약: 명시적 금지 규약은 없음 — CLAUDE.md "정보 저장 위치(단일 진실 원칙)" 의 정신(같은 사실을
  여러 문서에 재서술하면 한쪽만 갱신될 때 drift 위험)에 대한 참고 사항
- 상세: 두 문서가 "미로그인 vs 로그인 사용자의 분기 경로", "`has_session` 쿠키로 판정" 이라는 같은
  사실을 각자의 관점(2-navigation=UI 플로우, 1-auth=API 계약)에서 서술한다. 현재는 내용이 100% 정합하나,
  두 서술 중 하나만 갱신되면(예: 리다이렉트 대상 경로가 바뀌는 경우) drift 가 발생할 수 있다.
- 제안: 필수 조치 아님. 향후 이 로직이 다시 바뀔 때는 `10-auth-flow.md` 쪽에서 "SoT: 1-auth §1.5.3"
  형태의 단방향 참조로 축약하고 조건 판정 로직 자체는 1-auth.md 한 곳에만 두는 편이 유지보수에 유리하다.
  지금 단계에서 수정을 요구할 정도의 이슈는 아니다.

## 참고로 확인한 기존 conventions 정합 상태 (diff 밖, 정보성)

`spec/2-navigation/**` 영역 전체를 훑으며 프롬프트에 번들된 `spec/conventions/audit-actions.md` ·
`spec/conventions/cafe24-api-catalog/**` 외에 실제 저장소의 `spec/conventions/error-codes.md` ·
`spec/conventions/swagger.md` · `spec/5-system/2-api-convention.md` 를 대조했다(diff 대상은 아니지만
target 문서가 명시적으로 인용하므로 상호 정합만 재확인):

- `10-auth-flow.md §5.4` 의 OAuth 콜백 `error=invalid_state` 등 lowercase 코드, `1-workflow-list.md` 의
  `VALIDATION_ERROR`/`RESOURCE_CONFLICT`, `11-error-empty-states.md` 의 HTTP 상태 코드 사용 모두
  `error-codes.md` §3 historical-artifact 레지스트리 및 `api-convention.md §5.3/§6` 표기와 일치 —
  새로 위반하는 패턴 없음.
- `1-workflow-list.md §3` 의 `GET /api/workflows` 페이지네이션 응답은 `api-convention.md §5.2` 및
  `swagger.md §5-2` 의 single-wrap `{ data: [...], pagination }` 계약과 일치.
- `_layout.md`/`_product-overview.md` 네이밍, `16-agent-memory.md` 의 `id: nav-agent-memory`
  (동일 basename `agent-memory` 충돌 회피, `spec-impl-evidence.md §2.1` 규정과 일치) 등 명명 규약도
  모두 준수 상태.

## 요약

이번 세션에서 실제로 변경된 대상은 `spec/2-navigation/10-auth-flow.md` §2.6 의 2줄 추가뿐이며, 이는
이미 존재하는 `5-system/1-auth.md §1.5.3` SoT 내용과 경로·파라미터·쿠키 정책이 완전히 대칭·정합된
설명 보강이다. 관련 frontmatter-evidence·링크 무결성 build 가드(953+11 tests)가 모두 PASS 했고,
에러 코드·API 응답 포맷·명명 규약 등 정식 규약 위반 사항도 발견되지 않았다. CRITICAL/WARNING 없음,
INFO 1건(문서 간 서술 중복 가능성, 조치 불요)만 참고로 기록한다.

## 위험도

NONE
