# 신규 식별자 충돌 검토 — `spec/5-system/` (--impl-prep)

## 검토 범위 확인

target 번들(`spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md`)은
직전 커밋 `602f677cd`("docs(spec): auth 불변식 5곳 spec 동기화 — #1103·#1108·#1109")로
이미 `origin/main`에 병합된 상태와 동일하다(현재 워크트리 `git status` clean, 동일 커밋
HEAD). 즉 이번 세션은 그 커밋이 이미 반영한 5개 항목(§1.3 신규 에러 행 · frontmatter
`code:` 글로브 3건 · `data-flow/12-workspace.md` Rationale 신설 · `1-auth.md` Rationale
신설 · `secret-store.md` §2.1)을 대상으로 하며, 곧 착수할 실제 코드 작업(캐너리 주석
"73건" 수치 정정 — `plan/in-progress/auth-guard-reflection-hardening.md` "developer 범위"
항목, 워크트리명 `uuid-canary-docstring-fix`와 일치)은 **주석 한 줄 정정**이라 그 자체로
새 식별자를 도입하지 않는다.

동일 스코프에 대한 직전 세션(`review/consistency/2026/08/09/20_07_08/naming_collision.md`)이
이미 5개 항목 전체를 실측 검토했고, 그때 지적한 유일한 WARNING을 이 커밋이 실제로
반영했는지 직접 재확인했다.

## 발견사항

이번 세션에서 새로 발견된 CRITICAL/WARNING 없음.

## 확인했으나 충돌 없음 (재검증)

- **직전 WARNING 해소 확인** — `3-error-handling.md §1.3`. 직전 세션은 신규 행의
  "코드" 컬럼에 `` `VALIDATION_ERROR` (`X-Workspace-Id` 형식) `` 처럼 한정자를 박아 넣어
  같은 표의 기존 순수 `VALIDATION_ERROR` 행·`15-chat-channel.md §5.4`의 표기와 갈린다고
  지적했다. 현재 파일(`spec/5-system/3-error-handling.md:76-79`)을 직접 읽어 확인한 결과
  코드 컬럼은 두 행 모두 순수 `` `VALIDATION_ERROR` `` 로 통일돼 있고 한정자("`X-Workspace-Id`
  형식 오류")는 설명(prose) 셀로 옮겨졌다 — **반영 완료, 재발 없음.**
- `isUuidShaped`/`isValidUuid`/`resolveRequestWorkspaceContext`/`handlerConsumesWorkspaceId`/
  `assertWorkspaceIdReflectionWorks` — spec 서술이 `codebase/backend/src/common/utils/{uuid,workspace-context.util}.ts`,
  `codebase/backend/src/common/decorators/workspace-reflection-canary.ts`의 실제 함수명과
  정확히 일치(실측 grep). 다른 의미로 이미 쓰이는 동명 식별자 없음.
- `WEBAUTHN_RP_ID`·`WEBAUTHN_RP_NAME`·`WEBAUTHN_ORIGIN`·`WEBAUTHN_ALLOW_FALLBACK` — spec
  §1.4.3 서술이 `codebase/backend/src/common/config/webauthn.config.ts`의 실제 env var
  이름·기본값과 정확히 일치. 신규 도입이 아니라 이미 구현된 기능의 기존 env var 재서술.
  다른 의미로 쓰이는 동명 env var 없음(전수 grep).
- `1-auth.md` frontmatter `code:` 글로브 3건 신규 추가(`common/decorators/*.ts`,
  `common/utils/workspace-context.util.ts`, `common/utils/uuid.ts`) — 저장소 내 다른
  spec 문서의 `code:` 글로브 중 이 경로를 이미 소유한 문서 없음(재확인). evidence-chain
  이중 소유 충돌 없음.
- `id:` frontmatter 충돌 — 저장소 전체 `spec/**/*.md`의 `id:` 값 중 중복은 `common`
  (각 `4-nodes/*/0-common.md`, 카테고리별 관례적 재사용)과 `chat-channel`
  (`5-system/15-chat-channel.md` vs `conventions/spec-impl-evidence.md`)뿐이며, 둘 다
  target(`1-auth`/`2-api-convention`/`3-error-handling`)과 무관한 기존 상태로 이번
  target이 새로 만든 충돌이 아니다.
- 신규 API endpoint — 없음. 이번 커밋의 §1.3 신규 행은 기존 `/auth/login` 등 엔드포인트에
  대한 에러 응답 표 보강일 뿐 새 endpoint를 정의하지 않는다.
- 이벤트/메시지명 — 이번 target 범위(1-auth/2-api-convention/3-error-handling)에 신규
  webhook·queue·sse 이벤트명 도입 없음.
- 파일 경로 — `spec/5-system/{1-auth,2-api-convention,3-error-handling}.md`는 기존
  파일 수정이며 신규 spec 파일 생성 없음. 참조 플랜 `plan/in-progress/auth-guard-reflection-hardening.md`
  등도 기존 파일.

## 요약

target(`spec/5-system/`)은 이미 `origin/main`에 병합된 상태와 동일하며, 이 스코프에
대한 직전 naming_collision 검토(20_07_08)가 지적한 유일한 WARNING(§1.3 에러 코드 컬럼
표기 불일치)은 실측 확인 결과 해당 커밋에서 순수 코드값으로 정정되어 반영되었다.
이번 세션에서 신규로 도입되는 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·
파일 경로 중 기존 사용처와 다른 의미로 충돌하는 항목은 발견되지 않았다. 곧 착수할 실제
코드 작업(캐너리 주석의 "73건" 수치 정정)은 주석 정정 한 줄이라 그 자체로 새 식별자를
도입하지 않아 이 관점에서 추가 검토 대상이 아니다.

## 위험도

NONE
