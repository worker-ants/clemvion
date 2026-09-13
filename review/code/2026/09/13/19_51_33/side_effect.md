# 부작용(Side Effect) 코드 리뷰 — error-code-emission-axis

## 검토 범위

실질 코드 변경은 두 파일에 집중된다 — `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(발행 축 수집기 3종 `collectQuotedLiterals`/`collectMessagePrefixes`/`collectCatalogCodes` + 공용 헬퍼 `collectMatches` + 신규 데이터 목록 `GUIDE_NON_EMITTED_VOCABULARY`)와 `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`(같은 축의 단언 다수 + 경계 대조군 `describe` 블록). 나머지(`CHANGELOG.md`, `PROJECT.md`, `logic.mdx`/`logic.en.mdx`, `plan/**`, `review/**`)는 문서·프로세스 산출물이라 부작용 관점 코드 실행 경로가 없다. 프롬프트가 컨텍스트 예산으로 생략한 부분(파일 5·6 후반부·파일 7·10·11)은 `git diff afaef5bef..HEAD -- <path>` 로 전문을 직접 확인했다.

## 발견사항

- **확인 후 문제 없음(참고)**: 새 정규식 상수 `QUOTED_LITERAL`/`MESSAGE_PREFIX`/`CATALOG_CODE` (`guide-identifier-scan.ts` 신규 선언부, `collectMatches` 바로 위)에 `.lastIndex` 를 수동으로 설정하는 코드가 없음을 grep 으로 확인했다(`lastIndex` 대입은 기존 4개 함수의 기존 상수에만 있다 — `rx`/`BACKTICK_SPAN`/`BACKTICK_INNER`/`envLine`/`composeLine`, 전부 신규 상수와 무관). `String.prototype.matchAll`은 스펙상 내부적으로 정규식을 복제해 `lastIndex`를 그 복제본에서만 진행시키므로, 원본 모듈 전역 상수의 공유 상태(`lastIndex`)가 여러 호출 간(여러 테스트·여러 텍스트) 오염되지 않는다는 JSDoc의 주장이 실제 구현과 일치한다.
- **확인 후 문제 없음(참고)**: 신규 export(`collectQuotedLiterals`, `collectMessagePrefixes`, `collectCatalogCodes`, `GUIDE_NON_EMITTED_VOCABULARY`)는 순수 추가이며, `grep -rl "guide-identifier-scan" codebase/frontend/src` 결과 이 모듈을 import 하는 곳은 해당 테스트 파일 하나뿐이다. 기존 함수(`collectSourceTokens`/`collectEnvDeclarations`/`scanIdentifierCitations`)의 시그니처는 이 diff 에서 변경되지 않았으므로 시그니처·인터페이스 변경으로 인한 기존 호출자 영향은 없다.
- **확인 후 문제 없음(참고)**: `guide-identifier-existence.test.ts` 신규 "`where`의 `파일:줄`이 실제로 그 토큰을 담는다" 테스트가 `walkTree(root, ["codebase/backend/src"], ...)` + `fs.readFileSync`로 소스를 읽지만, 둘 다 `tree-walk.ts`의 기존 읽기 전용 구현(`fs.existsSync`/`fs.readdirSync`, 쓰기 없음)을 그대로 재사용한다. 새 `collectCatalogCodes` 호출도 `fs.readFileSync(.../3-error-handling.md, "utf8")`로 읽기만 하며, 이 파일을 포함해 diff 전체에 파일 생성·수정·삭제, `process.env` 읽기/쓰기, 네트워크 호출, 이벤트/콜백 발생 지점은 없다.
- **[INFO]** 신규 "카탈로그" 하드 리드가 describe 블록 최상위(모듈 평가 시점)에서 실행돼, 대상 파일(`spec/5-system/3-error-handling.md`)이 사라지면 이 스위트의 **모든** 테스트가 개별 실패가 아니라 일괄 collection-error 로 죽는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` — `collectCatalogCodes([fs.readFileSync(path.join(root, "spec/5-system/3-error-handling.md"), "utf8")])` 호출부 (describe 콜백 본문, `describe("유저 가이드 식별자 실재성 가드", () => { ... })` 안, `quotedLiterals`/`messagePrefixes` 선언 바로 다음)
  - 상세: 같은 파일의 기존 카탈로그류 리드도 이미 이 관행(`readIfPresent` 없이 하드 리드)을 쓰고 있어(직전 라운드 `review/code/2026/09/13/19_23_22/documentation.md` INFO#1 이 "기존 관행 일치 — 조치 불요"로 처분한 바로 그 사안), 이번 diff 가 새로 만든 리스크라기보다는 기존 패턴의 확장이다. 부작용 관점에서는 상태를 변경하는 것은 아니고 "예상 밖 실패 형태(파일별이 아니라 스위트 전체)"에 가까워 등급을 낮춘다.
  - 제안: 신규 조치 불요(기존 관행과 일관). 향후 이 파일의 하드 리드들을 한꺼번에 손볼 계획이 있다면 그때 같이 정리.
- **[INFO]** `review/code/2026/09/13/19_23_22/*`·`review/consistency/2026/09/13/18_40_54/*` 등 이전 리뷰/일관성 세션 산출물 다수가 이번 diff 로 신규 커밋된다
  - 위치: `meta.json` 파일 목록(파일 14, `agents` 배열 이하) 및 해당 디렉터리 하위 파일 전체
  - 상세: 저장소 관례상 `review/code/**`·`review/consistency/**` 는 세션 산출물을 커밋해 보존하는 것이 정상 흐름(`CLAUDE.md` "정보 저장 위치" 표)이라 이 자체는 결함이 아니다. "예상치 못한 파일 생성"에 해당하는지 확인차 diff 를 열었고, 전부 `new file mode 100644`(기존 파일 덮어쓰기 아님)이며 코드 실행 결과로 생긴 부산물이 아니라 리뷰 세션이 의도적으로 작성한 문서임을 확인했다. 참고용으로만 남긴다.

## 요약

이번 배치의 실질 코드 변경(수집기 3종 + 공용 헬퍼 + 신규 예외 목록)은 순수 함수·읽기 전용 파일시스템 접근·모듈 전역 정규식 상수의 `matchAll` 기반 무상태 사용으로 구성돼 있어, 점검 관점 8가지(의도치 않은 상태 변경/전역 변수/파일시스템 부작용/시그니처 변경/인터페이스 변경/환경 변수/네트워크 호출/이벤트·콜백) 중 어느 것도 CRITICAL/WARNING 급 결함으로 이어지지 않았다. `lastIndex` 공유 오염을 피했다는 JSDoc 의 설계 근거는 실제 `.lastIndex` 대입 지점을 grep 으로 대조해 검증했고, 신규 export 는 테스트 파일 하나만 소비하므로 인터페이스 변경의 하위 호환성 리스크도 없다. 유일하게 남기는 것은 카탈로그 파일을 describe 최상위에서 하드 리드하는 기존 관행이 이번에도 반복된다는 INFO 뿐이며, 이는 직전 라운드 리뷰가 이미 "조치 불요"로 처분한 것과 동일한 패턴이다.

## 위험도
NONE
