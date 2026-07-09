# 변경 범위(Scope) 리뷰

대상 커밋: `5c4ffd5b` `refactor(frontend): ai-review WARNING 조치 — 게이트 테스트 단일화·guard 헬퍼 공유·CHANGELOG·주석`
(선행 리뷰 `review/code/2026/07/09/13_37_11` SUMMARY 의 WARNING 5건(W1~W5)에 대한 resolution-applier 성격의 조치 커밋)

## 발견사항

- **[INFO]** 커밋이 선행 SUMMARY 의 W1~W5 항목과 1:1 매핑되며 그 외 파일 변경 없음
  - 위치: 커밋 전체 (`git show 5c4ffd5b --stat` = 정확히 9개 파일)
  - 상세: 커밋 메시지가 명시한 5개 조치(W1 게이트 행위 SoT 테스트 신설+layout 테스트 축소, W2 guard 스캐닝 골격 공유 헬퍼 추출, W3 stale 주석 정정, W4 CHANGELOG phase 2 항목, W5 `buildEditorHref` 단위 테스트)와 실제 diff 의 9개 파일이 정확히 대응한다. `workspace-slug-gate.tsx`(게이트 컴포넌트 자체)는 선행 커밋(`61407b761`, phase 2 구현 커밋)에서 이미 존재하며 본 커밋에서는 건드리지 않았다 — 프로덕션 로직 변경은 전무하고 테스트 재구성·주석·CHANGELOG 만 포함된다.
  - 제안: 없음 (범위 이탈 아님, 참고용 기록)

- **[INFO]** 임포트 변경은 모두 리팩토링에 직접 종속
  - 위치: `no-raw-editor-href.test.ts:4`, `no-raw-execution-href.test.ts:4` (`import { SRC, collectSourceFiles, findRawHrefOffenders } from "./href-guard-utils"`), `href.test.ts:2` (`buildEditorHref` 추가)
  - 상세: 신규/변경된 임포트는 전부 W2(공유 헬퍼 추출)·W5(신규 테스트 대상 함수) 목적에 직접 종속되며, 사용되지 않는 임포트 추가나 무관한 정리는 없다. 두 guard 테스트 파일 모두 `fs`/`path` 는 여전히 자체적으로 사용되는 부분(HELPER 경로 조립·`fs.existsSync`)이 남아있어 임포트 잔존이 타당하다.
  - 제안: 없음

- **[INFO]** 리팩토링 범위가 선언된 대상(두 guard 테스트의 공통 스캐닝 골격)에 국한
  - 위치: `href-guard-utils.ts`(신규), `no-raw-editor-href.test.ts`, `no-raw-execution-href.test.ts`
  - 상세: 신규 헬퍼는 `SRC`/`collectSourceFiles`/`findRawHrefOffenders` 3개만 export 하며 각 guard 고유의 `regex`/`isExempt` 판정은 그대로 파일에 남겨 W2 설명("각 guard 는 자신의 regex+예외만 유지")과 정확히 일치한다. 과도한 추상화(옵션 파라미터 확장, 불필요한 유틸 추가 등) 없음.
  - 제안: 없음

- **[INFO]** CHANGELOG 추가 항목은 phase 1 항목과 동일한 관행(포맷·SoT 표기)을 따름
  - 위치: `CHANGELOG.md` 신규 phase 2 섹션
  - 상세: W4 가 명시한 대로 phase 1 항목 바로 위에 동일한 헤딩 스타일·SoT 각주 형식으로 추가됐다. 다른 기존 CHANGELOG 섹션에는 손대지 않았다.
  - 제안: 없음

발견된 CRITICAL/WARNING 급 범위 이탈 없음.

## 요약

본 커밋은 직전 코드 리뷰 SUMMARY 의 WARNING 5건(W1~W5)을 그대로 해소하는 resolution 커밋이며, `git show --stat` 로 확인한 실제 변경 파일 9개가 커밋 메시지의 5개 항목과 정확히 1:1 대응한다. 프로덕션 로직 변경은 `use-workspace-slug.ts` 의 주석 정정(W3) 한 건뿐이고 나머지는 테스트 재구성(W1·W5)·테스트 공용 헬퍼 추출(W2)·CHANGELOG 문서(W4)에 한정된다. 요청되지 않은 추가 리팩토링, 기능 확장, 무관한 파일·설정 변경, 의미 없는 포맷팅 뒤섞임, 불필요한 임포트/주석 변경은 발견되지 않았다.

## 위험도

NONE
