# 변경 범위(Scope) 코드 리뷰

## 검토 방법

이번 changeset(125개 파일, `origin/main..HEAD`)은 harness 위생 리뷰의 4라운드째 누적 diff다.
직전 3라운드(`review/code/2026/09/01/{22_25_37,22_44_29,23_09_35}/`)와 그 조치 커밋들이 이미
포함돼 있고, 이번 라운드가 실제로 새로 추가한 것은 커밋 `7829dbd61`(`fix(harness): 리뷰 4R —
타입 오류가 게이트 사각지대로 들어와 있었다`) 하나뿐이다. `git show --stat 7829dbd61` 로 그
커밋의 diff 범위를 실제 소스 기준으로 대조했다.

## 발견사항

없음 — CRITICAL/WARNING 없음.

## 확인했으나 문제 없음 (근거 기록)

- **이번 라운드(4R) 자체의 diff 는 정확히 커밋 메시지가 말하는 4가지에 국한된다.**
  `git show --stat 7829dbd61` 확인: 실질 코드/문서 변경은 `stray-tool-tags.test.ts`(13줄),
  `tree-walk.ts`(5줄), `plan/in-progress/harness-review-gate-followups.md`(21줄 추가),
  `plan/in-progress/spec-conventions-engine-error-code-surface.md`(3줄, 줄번호 인용을 앵커
  문구로 교체)뿐이고, 나머지는 직전 라운드(`23_28_32`) 리뷰 산출물 재수록이다(관례상 커밋에
  포함되는 자료, 관련 없는 추가 아님).
  - `walkTree(bases: string[] → readonly string[])`: `grep -rn "walkTree(" __tests__/` 로
    전 호출부(`spec-frontmatter-parse.ts`, `impl-anchor-parse.ts`, `spec-links.ts` 3곳,
    `plan-scan.ts`)를 대조한 결과 **어느 호출부도 수정되지 않았다** — 시그니처만 넓히고
    기존 `string[]` 호출부는 그대로 두는 최소 변경이었다(readonly 로의 확장은 하위 호환).
  - `stray-tool-tags.test.ts` 의 fixture 확장(archive 경로 1곳 → 2곳)은 리뷰가 지적한
    "basename 매칭인데 fixture 가 한 경로만 검증" 갭을 정확히 메우는 추가일 뿐, 무관한 코드
    영역을 건드리지 않았다.
  - `harness-review-gate-followups.md` 추가 문단은 근본 원인(frontend 테스트가 어떤 게이트
    에서도 타입체크되지 않음)을 **등재만** 하고 CI job 신설이나 tsconfig 변경 등 실제 구현은
    이번 PR에 넣지 않았다 — "범위 주의: frontend 전체는 안 쟀다" 는 문구까지 포함해 후속
    작업으로 명확히 분리해 두었다(기능 확장/over-engineering 아님).
  - `spec-conventions-engine-error-code-surface.md` 의 줄번호→앵커 문구 교체는 이 PR 자신이
    만든 stale 인용을 고치는 것으로, 전수 grep(`error-codes.ts:<줄>` 인용은 이 1건뿐)까지
    확인된 국소 수정이다.

- **누적 diff 전체에 걸친 "harness 위생 vs spec 두 트랙 번들" 이슈(W1)는 새 발견이 아니다.**
  `codebase/backend/src/nodes/core/error-codes.ts`(JSDoc), `spec/conventions/error-codes.md`,
  그리고 `review/consistency/2026/09/01/{21_30_10..23_17_23}/` 7세션(약 60여 파일)은
  `EngineErrorCode`/`ErrorCode` 두 surface 병기라는 **별도 spec 결정**의 부산물이며, 세션
  워크트리 이름(`easy-a-harness-hygiene`)이 암시하는 범위보다 넓다. 그러나 이는 1R·2R·3R
  RESOLUTION.md 에서 이미 3회 다뤄졌고(`review/code/2026/09/01/22_25_37/RESOLUTION.md` W1,
  `22_44_29/RESOLUTION.md` W1·W2, `23_09_35/RESOLUTION.md` INFO 2) 처분도 문서화돼 있다 —
  "사용자가 'A 를 모두 처리하고 PR' 로 묶어 지시했고, PR 본문에 harness 축/spec 축을 갈라
  적는다" 는 명시적 결정. 이번 4R diff 는 그 결정을 뒤집거나 새로 확장하지 않았으므로,
  같은 항목을 다시 CRITICAL/WARNING 으로 재상정하지 않는다(이미 채택된 처분의 재확인일
  뿐이며, 반복 재지적은 이 저장소가 기록해 둔 "fix→리뷰 stale 루프" 패턴이다).

- **`plan/complete/*.md` 5파일의 `</content>`/`</invoke>` 잔재 제거**(파일 8~12, 16)는
  신규 가드(`stray-tool-tags.test.ts`)가 검사하는 바로 그 오염을 정리하는 것이라 가드
  추가와 직접 연결된 정리이지, 무관한 drive-by cleanup 이 아니다.

- **포맷팅/주석/임포트 관점**: 이번 4R diff 에는 의미 없는 공백·줄바꿈 변경, 무관한 주석
  추가/삭제, 미사용 임포트 정리가 없다. `tree-walk.ts` 의 3줄 주석은 타입 변경의 근거를
  바로 그 자리에 남긴 것으로 설명 대상과 위치가 일치한다.

- **설정 파일**: 이번 4R 은 `tsconfig.json`/`*-checks.yml` 등 CI·빌드 설정을 변경하지
  않았다 — 근본 원인(frontend 테스트 미검사)을 발견했음에도 구현 대신 plan 등재로만
  처리해, 의도치 않은 설정 변경 표면이 없다.

## 요약

4라운드째 diff(커밋 `7829dbd61`)는 직전 라운드 리뷰가 지적한 4가지 결함(readonly 타입
불일치, fixture 검증 폭 부족, 근본 원인 미등재, PR 자신이 만든 stale 줄번호 인용)에만
정확히 대응하며, 무관한 리팩토링·기능 확장·포맷팅 혼입·설정 변경이 없다. 누적 changeset
전체가 안고 있는 "harness 위생 커밋에 spec 두-surface 병기 결정이 번들됐다"는 구조적
관찰은 이미 3라운드에 걸쳐 검토·처분(분리하지 않고 PR 본문에 명시)이 끝난 사안이라 이번
라운드에서 새로 문제 삼지 않았다.

## 위험도

NONE
