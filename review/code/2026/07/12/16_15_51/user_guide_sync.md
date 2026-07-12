> **복구본**: sub-agent disk write 유실(disk-write gap) — journal.jsonl 반환값 복구.

## 발견사항

검토 대상 변경 set 은 `doc-sync-matrix.json`(파일 1)·`PROJECT.md`(파일 2)에 신규 행 `new-widget-chrome-string`("신규 위젯 chrome 문자열 (channel-web-chat)")을 스스로 추가하면서, 같은 changeset 안에서 그 trigger 를 유발하는 실제 코드 변경(`codebase/channel-web-chat/src/**/*.tsx`)까지 함께 포함하고 있다. 매칭 결과는 아래와 같다.

- 매칭된 trigger: `new-widget-chrome-string` (glob `codebase/channel-web-chat/src/**/*.tsx`, semantic match) — `composer.tsx`, `dynamic-form.tsx`, `launcher.tsx`, `panel.tsx`, `presentations.tsx`, `widget-app.tsx` 가 하드코딩 한국어 리터럴을 `t()` 호출로 치환.
- 요구 동반 갱신(target 원문): `codebase/channel-web-chat/src/lib/i18n/catalog.ts 의 WIDGET_STRINGS {ko,en} 양쪽 — 위젯 로컬 catalog 키 경유 (parity 가드 fail)`
- 검증 결과: **동반 갱신 누락 없음.**
  - `codebase/channel-web-chat/src/lib/i18n/catalog.ts` (파일 4) 에 사용된 모든 키(`composer.*`, `panel.*`/`header.*`/`confirm.*`, `group.*`, `launcher.*`, `carousel.*`, `table.*`, `chart.*`, `form.*`, `error.generic`)가 ko/en 양쪽에 등록됨.
  - parity 가드 `catalog.test.ts` (파일 3, 신규) 가 키 집합 동일성 + 빈 문자열 금지 + `{{placeholder}}` 대응까지 hard-fail 검증.
  - `codebase/channel-web-chat/src` 전체를 grep 해 잔존 하드코딩 한국어 사용자 노출 문자열을 찾아봤으나, 남은 항목은 전부 spec §3.3 이 명시적으로 비대상 처리한 범주뿐이었다: `console.warn` 진단 로그, `EiaError` 내부 진단 메시지(항상 `t("error.generic")` 로 대체 렌더), `app/demo/**` 데모 페이지, 코드 주석.
  - `.claude/tests/test_doc_sync_matrix.py` 7/7 pass 확인(JSON rows ↔ PROJECT.md 표 row-count 1:1, guard_tests 실존, convention_ref 실존, glob base 실존) — SSOT 두 파일이 drift 없이 동기화됨.
  - `pnpm test`(channel-web-chat, vitest) 22 files / 335 tests all pass — parity 가드 포함 전체 그린.
- `spec/conventions/i18n-userguide.md` (파일 36) 은 위젯 carve-out 서술을 "전면 제외"에서 "chrome 은 로컬 catalog 대상, 운영자 콘텐츠는 여전히 제외"로 갱신하고 "자동 가드 요약" 표에 `2-위젯` 행을 신설 — 이는 이전 consistency-check(`review/consistency/2026/07/12/14_34_23/convention_compliance.md`)가 지적한 WARNING(Edit E 범위 협소)을 이미 반영한 상태.
- `codebase/frontend/src/content/docs/**`, `codebase/frontend/src/lib/i18n/dict/**`, `backend-labels.ts`, `codebase/frontend/src/lib/docs/locale.ts` 등 다른 매트릭스 target 은 이번 changeset 이 건드리는 어떤 trigger 와도 매칭되지 않았다(신규 노드·신규 섹션 디렉토리·warning/error code·표현식 언어·auth 흐름 변경 모두 무관).

INFO 수준 참고(비차단): `spec/conventions/i18n-userguide.md` frontmatter `code:` 글로브 목록이 여전히 `codebase/frontend/src/lib/i18n/**` 만 가리키고 신설된 `codebase/channel-web-chat/src/lib/i18n/**` 를 포함하지 않는다 — `spec-code-paths.test.ts` 는 "status: implemented ⇒ code 글로브 ≥1 매치"만 요구하므로 hard-fail 은 아니며, 이 항목은 spec frontmatter 완결성(consistency-checker 영역)에 가까워 User Guide Sync 관점의 확정 결함으로는 보지 않는다.

## 요약
매트릭스 25개 행(신규 `new-widget-chrome-string` 포함) 중 이번 changeset 은 정확히 1개 trigger(`new-widget-chrome-string`)에 매칭됐고, 그 요구 동반 갱신(`catalog.ts` WIDGET_STRINGS ko/en parity)이 같은 PR 안에 완전히 포함돼 있음을 실행 확인(unittest 7/7, vitest 335/335)했다. 이 PR 은 오히려 해당 trigger 행 자체를 신설한 PR이며 self-compliant — 누락 0건.

## 위험도
NONE
