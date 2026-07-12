# 문서화(Documentation) Review

대상: channel-web-chat 위젯 chrome 문자열 EN 다국어화(`locale` 활성) — `origin/main..HEAD` 4 commits
(`3214db045`/`b0267310c`/`6227d236f`/`54de6f567`), 36개 변경 파일(spec 7개, 코드/테스트 19개, `PROJECT.md`/
`doc-sync-matrix.json`, plan 2개, consistency-check 아카이브 7개).

## 총평

spec 5개 파일(`0-overview.md`/`1-widget-app.md`/`2-sdk.md`/`5-admin-console.md`/`_product-overview.md`) +
`i18n-userguide.md` + `PROJECT.md` + `doc-sync-matrix.json` 이 같은 turn 안에서 동반 갱신됐고, 신규 코드
(`src/lib/i18n/*`)의 JSDoc·인라인 주석·spec 상호참조도 대체로 정확하다. `consistency-check --spec`/`--impl-prep`
이 이미 5-checker 로 spec 정합을 검증(BLOCK NO)해 spec 레벨 문서 갭은 거의 없다. 발견된 갭은 이 turn 의
"코드 변경 위치" 바깥에 있는 2차 문서(`CHANGELOG.md`, `codebase/channel-web-chat/README.md`)와, 코드 내부에
남은 stale JSDoc 1건이다.

## 발견사항

- **[WARNING]** `CHANGELOG.md` 미갱신 — 이 저장소의 확립된 패턴과 불일치
  - 위치: `CHANGELOG.md` (diff 대상 아님 — 이번 4 commit 전부 미접촉, `git diff origin/main --stat -- CHANGELOG.md` 공백)
  - 상세: `CHANGELOG.md` 최상단 5개 항목이 전부 `codebase/channel-web-chat` 관련 최근 기능(§R8 table truncation 총 개수 노출 #921, EIA-RL-07 idle reaper #918, coalesce+cancel #917 등)이며, 각 PR 이 "Unreleased — ..." 절을 동반했다. 이번 변경은 그와 동급 이상의 사용자 가시 동작 변화다 — `BootConfig.locale` 이 reserved/inert 에서 실제로 위젯 chrome 을 EN 으로 렌더하도록 활성화되고(고객 임베드 사이트에 즉시 영향), `GENERIC_ERROR_MESSAGE` 의 내부 아키텍처도 바뀐다(더 이상 리터럴이 아니라 catalog 참조 + 렌더 시 지역화). 그런데도 `CHANGELOG.md` 는 이번 4 commit 중 어느 것도 건드리지 않았다.
  - 제안: 다른 최근 웹챗 항목과 동일한 형식으로 "Unreleased — 위젯 chrome 문자열 EN 다국어화(`locale` 활성, 7-channel-web-chat/1-widget-app §4)" 절을 추가하고, 번역 범위(chrome-only)·언어 해석 우선순위·SoT 링크를 요약한다.

- **[WARNING]** `codebase/channel-web-chat/README.md` "## 상태" 목록에 신규 i18n 모듈 누락
  - 위치: `codebase/channel-web-chat/README.md` "## 상태" 절 ("구현됨: 상태기계(`src/lib/widget-state`), EIA 클라이언트(`src/lib/eia-client`), … 차트 축 레이블·범례·툴팁(...)." 문단)
  - 상세: 이 절은 위젯의 구현 완료 기능을 정확한 소스 경로와 함께 나열하는 구현 상태 인덱스다(`src/lib/widget-state`, `src/lib/eia-client`, `src/lib/conversation`, `src/lib/session-store`, `src/widget/host-bridge`, `src/widget/components/presentations.tsx`, `src/lib/safe-html.ts` 등). 이번 변경으로 신설된 `src/lib/i18n/{catalog,resolve-locale,context,index}.ts` — 위젯 로컬 ko/en 카탈로그 + locale 해석 + Provider — 는 다른 항목들과 동일한 "구현 완료 표면" 인데도 이 목록에 반영되지 않았다.
  - 제안: "## 상태" 문단에 "chrome 문자열 ko/en i18n(`src/lib/i18n` — `BootConfig.locale` 명시 → 브라우저 auto-detect → ko)" 항목을 추가.

- **[WARNING]** `use-widget.ts` 의 `GENERIC_ERROR_MESSAGE` JSDoc 이 신규 인라인 주석과 상충
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:602-605` (diff 상 JSDoc 블록은 무변경, 바로 아래 신규 주석 + 정의만 변경)
  - 상세: 바로 위 기존 JSDoc은 여전히 `/** 사용자 노출용 일반화 에러 문구(W1·4-security §5)... */` 로 시작해 "이 상수가 곧 사용자에게 보이는 문자열" 이라고 서술한다. 그런데 이번 diff 가 그 아래 추가한 새 주석은 "state.error 에 저장되는 내부 신호(진단·테스트 기준 ko). 사용자 표시는 panel 이 t(\"error.generic\") 로 지역화한다" 라고 정반대를 명시한다 — 신규 아키텍처에서 `GENERIC_ERROR_MESSAGE`(`WIDGET_STRINGS.ko["error.generic"]`)는 더 이상 렌더되는 문자열 그 자체가 아니라 내부 ko 기준 신호일 뿐이며, EN 로케일 사용자는 이 상수를 보지 않는다(`panel.tsx` 가 `t("error.generic")` 로 재지역화). 같은 코드 블록 안에 서로 다른 사실을 주장하는 두 주석이 공존해, 다음 편집자가 위 JSDoc 만 보고 "이 상수가 사용자 노출 문구다" 라고 오인할 위험이 있다.
  - 제안: 기존 JSDoc 첫 문장을 "내부 ko 기준 에러 신호(state.error 저장용) — 실제 사용자 표시는 §4 catalog `error.generic` 를 `panel` 이 로케일 렌더" 로 갱신해 두 주석을 하나의 사실로 통일.

- **[INFO]** `doc-sync-matrix.json` 의 대규모 재포맷팅이 실질 변경(신규 행 1개)과 같은 diff 에 섞여 있음
  - 위치: `.claude/config/doc-sync-matrix.json` 전체 diff (~370줄 중 실질 신규 내용은 마지막 `new-widget-chrome-string` 행뿐, 나머지는 기존 20개 행의 `trigger.globs`/`guard_tests` 한 줄 배열 → 여러 줄로 pretty-print)
  - 상세: 기능적으로는 무해(JSON 파싱 결과 동일, `test_doc_sync_matrix.py` 는 구조만 검증)하지만, 리뷰어가 신규 행을 찾으려면 370줄의 순수 포맷 변경을 눈으로 걸러내야 한다. 문서 성격의 SoT 파일이라 향후 유사 PR 에서도 반복되면 diff 가독성이 계속 저하된다.
  - 제안: 향후에는 포맷 변경(pretty-print)과 내용 변경(신규 행 추가)을 별도 commit 으로 분리하거나, 기존 스타일(한 줄 `{ "globs": [...], "match": "..." }`)을 유지한 채 신규 행만 추가.

- **[INFO]** `doc-sync-matrix.json` 신규 행과 `PROJECT.md` 신규 행의 상대 위치가 서로 다름
  - 위치: `.claude/config/doc-sync-matrix.json` — `new-widget-chrome-string` 은 21번째(마지막) 행으로 append. `PROJECT.md` §변경 유형 → 갱신 위치 매핑 — 대응 행은 "신규 UI 문자열 (TSX)" 바로 다음(표의 4번째 행)에 삽입.
  - 상세: `test_doc_sync_matrix.py::test_row_count_matches_project_md_table` 은 두 표현 사이 **행 개수**만 1:1 검증하고 순서·위치는 검증하지 않아 이 divergence 는 CI 로 잡히지 않는다. 두 파일이 "같은 표의 두 표현" 이라는 문서 서두 주석(`_doc` 필드)의 취지상, 같은 상대 위치에 두면 향후 사람이 두 파일을 나란히 비교하기 쉽다.
  - 제안: 필수는 아니나, JSON 쪽도 "신규 UI 문자열" 행 바로 다음에 삽입하는 편이 두 SoT 표현의 대응을 더 명확히 유지한다.

- **[INFO]** `spec/7-channel-web-chat/2-sdk.md` §1 스니펫 예시가 `locale` 활성화 이후에도 `'ko'` 값만 보여줌
  - 위치: `spec/7-channel-web-chat/2-sdk.md:41` (diff 밖, 기존 예시 무변경)
  - 상세: `locale` 이 reserved/inert 이던 시절엔 예시 값이 `'ko'` 하나뿐이어도 문제가 없었지만, 이제 `locale: 'en'` 이 실제로 위젯 chrome 을 영문 렌더하는 활성 계약이 됐다. §4/§R6 산문은 우선순위·EN 활성을 설명하지만, 개발자가 실제로 복붙할 스니펫 예시 자체는 여전히 `'ko'` 만 보여줘 "EN 도 지정 가능하다" 는 사실이 코드 예시 레벨에서는 드러나지 않는다.
  - 제안: 필수는 아니나, §1 또는 §4 인근에 `locale: 'en'` 예시나 짧은 주석("`'en'` 지정 시 위젯 chrome 이 영문으로 렌더")을 한 줄 추가하면 문서 완결성이 높아진다.

## 요약

spec·`PROJECT.md`·`doc-sync-matrix.json`·신규 i18n 모듈의 JSDoc/인라인 주석은 같은 turn 안에서 촘촘히 동반 갱신됐고 consistency-check(BLOCK NO)까지 거쳐 spec 레벨 문서 정합성은 높다. 다만 이 diff 범위 밖의 두 2차 문서 — 저장소가 웹챗 기능마다 관례적으로 갱신해 온 `CHANGELOG.md`, 그리고 구현 완료 표면을 인덱싱하는 `codebase/channel-web-chat/README.md` "## 상태" — 가 이번 기능을 반영하지 못했고, `use-widget.ts` 의 `GENERIC_ERROR_MESSAGE` JSDoc 한 곳은 새 아키텍처(내부 ko 신호 vs 지역화된 표시 문구)와 문구가 상충한다. 세 건 모두 CRITICAL 수준의 오정보나 빌드 차단은 아니며 후속 커밋으로 쉽게 해소 가능한 완결성 갭이다.

## 위험도

LOW
