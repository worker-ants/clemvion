# 부작용(Side Effect) 코드 리뷰 — error-code-emission-axis (4차 라운드, 종합)

## 검토 범위·방법

실질 코드 변경은 두 파일에 국한된다 — `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(발행 축 정규식 3종 + 공용 헬퍼 `collectMatches` + `GUIDE_NON_EMITTED_VOCABULARY` 신규 export)와 `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`(그 축을 소비하는 단언·경계 대조군). 나머지(`CHANGELOG.md`·`PROJECT.md`·`logic.mdx`/`logic.en.mdx`·`plan/**`·`review/**`)는 문서·plan·리뷰 산출물이라 부작용 관점 코드 실행 경로가 없다.

프롬프트가 두 핵심 `.ts` 파일의 diff 를 예산 초과로 생략했으므로 `Read` 로 전체 파일(각 559줄·864줄)을 직접 열어 확인했고, 다음을 독립적으로 재검증했다(파일을 수정하지 않고 `grep`/`git diff`만 사용):

- `grep -nE "fs\.(write|mkdir|unlink|rm|append|chmod|rename|copyFile)"` — 두 파일 모두 매치 0건.
- `grep -n "process\.env"` — 실제 읽기/쓰기 호출 0건(전부 주석·테스트 fixture 문자열 안의 언급).
- `grep -n "^export"` — `collectMatches` 는 export 목록에 없다(내부 전용 헬퍼로 유지됨을 확인).
- `grep -rl "guide-identifier-scan"` (codebase/frontend/src 전체) — 이 모듈을 import 하는 파일은 해당 테스트 파일 하나뿐.
- `git diff afaef5bef..HEAD -- guide-identifier-scan.ts | grep "^[+-]export"` — 이번 배치가 추가한 export 는 전부 `+`(신규)이고 기존 export(`scanIdentifierCitations`·`collectSourceTokens`·`collectEnvDeclarations`)에 대한 `-`(삭제/변경) 라인은 없다.

이 배치는 동일 세션의 `/ai-review` 라운드 1(`review/code/2026/09/13/19_23_22/side_effect.md`)·라운드 2(`review/code/2026/09/13/19_51_33/side_effect.md`)가 이미 위험도 NONE 으로 판정한 대상이며, 라운드 3(`20_13_13`)의 fix 커밋(`5778885ce`, WARNING#2 — `staleEntries` 판별 대조군 추가)이 마지막으로 코드를 건드렸다. 이번 라운드는 그 누적 결과를 독립 재검증한다.

## 발견사항

- **[INFO]** 카탈로그 SoT 파일 read 가 존재 가드 없이 describe 최상위(모듈 평가 시점)에서 이뤄진다 — 3라운드 연속 동일 패턴
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:110-115` (`fs.readFileSync(path.join(root, "spec/5-system/3-error-handling.md"), "utf8")`, `describe("유저 가이드 식별자 실재성 가드", …)` 콜백 본문, `it()` 블록 밖)
  - 상세: 같은 파일의 `envExampleTexts`(`:41-48`)는 `readIfPresent`(내부 `fs.existsSync` 가드)를 거치는데, 이 신규 read 는 가드 없이 그대로 `fs.readFileSync`를 호출한다. 대상 파일(`spec/5-system/3-error-handling.md`)이 이동·삭제되면 이 describe 블록 전체(발행 축뿐 아니라 기존 베이스라인·과거 결함 재현 테스트까지 도합 30여 개 `it`)가 개별 실패가 아니라 컬렉션 단계 예외로 일괄 죽는다. 대상 파일 실존은 확인했다. 같은 패턴이 `guide-sanitized-message-parity.test.ts:29,50`에도 있어 새로 도입된 위험이 아니라 이 스위트의 기존 관행 반복이며, 라운드 1·2 side_effect.md 가 이미 같은 근거로 조치 불요로 처분한 자리다 — 이번 라운드에서도 코드가 변경되지 않아 처분을 유지한다.
  - 제안: 조치 불필요(기존 관행과 일치). 이 파일의 하드 리드 전체를 한 번에 `readIfPresent` 로 통일하는 리팩터가 있다면 그때 함께.

- **확인 후 문제 없음(독립 재검증)**: 신규 export 는 모두 **순수 추가**이고 기존 함수 시그니처는 변경되지 않았다
  - `git diff afaef5bef..HEAD -- guide-identifier-scan.ts` 에서 `+export` 5건(`GUIDE_NON_EMITTED_VOCABULARY`, `collectQuotedLiterals`, `collectMessagePrefixes`, `collectCatalogCodes`, `isMessagePrefixOnly`)만 나타나고, 기존 export(`CitationAxis`, `IdentifierCitation`, `GUIDE_EXTERNAL_VOCABULARY`, `scanIdentifierCitations`, `collectSourceTokens`, `collectEnvDeclarations`)에 대한 시그니처 변경 라인은 없다. `grep -rl "guide-identifier-scan"` 결과 이 모듈의 유일한 소비자는 해당 테스트 파일이므로 기존 호출자 영향 자체가 없다.

- **확인 후 문제 없음(독립 재검증)**: 모듈 스코프 정규식 3개(`QUOTED_LITERAL`/`MESSAGE_PREFIX`/`CATALOG_CODE`, `guide-identifier-scan.ts:260-266`)가 추가됐지만 `.lastIndex` 수동 대입 지점이 이 상수들에는 없다(grep 결과 0건) — 호출부(`collectMatches`, `:281-291`)가 `String.prototype.matchAll`을 쓰기 때문이다. `matchAll`은 스펙상 정규식을 내부 복제해 순회하므로 원본 모듈 전역 상태(`lastIndex`)가 호출 간(여러 테스트·여러 텍스트) 오염되지 않는다 — 이 파일에 이미 있던 4곳의 수동 `rx.lastIndex = 0` 관용구(`scanIdentifierCitations`·`collectSourceTokens`·`collectEnvDeclarations`)를 새로 반복하지 않는다.

- **확인 후 문제 없음**: `collectMatches`(`guide-identifier-scan.ts:281-291`)는 export 되지 않은 모듈 내부 헬퍼다 — 인자로 받은 배열·정규식·그룹 인덱스만 읽어 새 `Set`을 반환하는 순수 함수이며, 외부 상태를 참조·변경하지 않는다.

- **확인 후 문제 없음**: `guide-identifier-existence.test.ts`의 신규 `where` grep 검증(`:224-260`)이 `walkTree(root, ["codebase/backend/src"], …)` + `fs.readFileSync`로 소스를 읽지만, 둘 다 `tree-walk.ts`의 기존 읽기 전용 구현(쓰기 없음)을 그대로 재사용한다. 등록 항목 수(현재 3건, 상한 5건)만큼 반복 호출되어 I/O 횟수는 늘지만 파일시스템 쓰기·삭제·이벤트 발생은 없다.

- **확인 후 문제 없음**: `review/code/2026/09/13/{19_23_22,19_51_33,20_13_13}/**`·`review/consistency/2026/09/13/{18_40_54,19_23_31}/**` 등 이전 세션 산출물이 이번 diff 로 신규 커밋된다 — 전부 `new file mode 100644`(기존 파일 덮어쓰기 아님)이고, CLAUDE.md 가 의무화한 `--impl-prep`/`/ai-review` 게이트의 정상 산출물이다. 코드 실행 결과로 생긴 예상치 못한 부산물이 아니다.

- env 변수·네트워크 호출·이벤트/콜백: 이번 diff 범위(테스트/스캐너/문서/plan) 안에 신규 `process.env` 읽기/쓰기, 외부 서비스 호출, 이벤트 발행/구독 변경이 전혀 없다 — grep 으로 재확인.

- 백엔드 런타임 코드(`execution-engine.service.ts` 등)는 이번 diff 에 포함되지 않는다 — 가이드 문장(`logic.mdx`/`logic.en.mdx`)이 그 코드의 실제 동작(메시지 접두, 구조화 코드 미방출)을 서술만 정정했을 뿐, 엔진 동작 자체는 변경되지 않았다.

## 요약

이번 배치의 실질 코드 변경(수집기 3종 + 공용 헬퍼 `collectMatches` + 신규 예외 목록 `GUIDE_NON_EMITTED_VOCABULARY` + 그 위의 단언·대조군)은 전부 `codebase/frontend/src/lib/docs/__tests__/` 하위 dev-time 전용 vitest 코드이며, 순수 함수·읽기 전용 파일시스템 접근·모듈 전역 정규식 상수의 `matchAll` 기반 무상태 사용으로 구성된다. 세 라운드에 걸친 이전 side_effect 리뷰(19_23_22·19_51_33)의 판정을 `grep`·`git diff`로 독립 재검증한 결과 동일한 결론에 도달했다 — 의도치 않은 상태 변경·새 전역 변수·예상치 못한 파일 생성/수정/삭제·기존 시그니처 파괴·공개 API 하위호환 리스크·환경변수 오용·네트워크 호출·이벤트/콜백 변경 중 어느 것도 발견되지 않았다. 유일하게 반복 언급할 항목은 카탈로그 SoT 파일을 describe 최상위에서 존재 가드 없이 하드 리드하는 것인데, 이는 이 스위트의 기존 관행(`guide-sanitized-message-parity.test.ts`)과 일치하고 3라운드 연속 조치 불요로 처분된 자리라 이번에도 등급을 올릴 근거가 없다.

## 위험도
NONE
