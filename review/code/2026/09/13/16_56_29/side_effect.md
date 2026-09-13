# 부작용(Side Effect) 코드 리뷰

## 스코프 확인

`git diff --stat origin/main...HEAD` 로 전체 changeset(172 files)을 확인했다. 그중
`codebase/**` 에 속하는 실제 실행 코드는 7개 파일뿐이다:

- `CHANGELOG.md`, `PROJECT.md` — 산문 갱신
- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts` (삭제)
- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts` (삭제)
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` (신규)
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (신규)
- `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts` (JSDoc 1줄 수정)

나머지(160여 개)는 `plan/**`·`review/**` 산출물(마크다운·JSON)로 실행되지 않는 문서다. 이
lens(부작용)는 위 7개 파일에 집중했다.

## 발견사항

- **[INFO]** 모듈 스코프의 `g`-플래그 정규식 5개가 `lastIndex` 라는 은닉된 가변 상태를 공유한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` — `FIELD_TABLE_NAME`(125행)·`CODE_FIELD`(158행)·`BACKTICK`(166행)·`collectEnvDeclarations` 내부의 `envLine`(262행)·`composeLine`(270행)
  - 상세: 다섯 정규식 모두 `new RegExp(..., "g")` 로 **모듈 최상단(또는 함수 진입 시점)에 한 번 생성**되고, 매 호출 지점에서 `rx.lastIndex = 0` 을 수동으로 리셋한 뒤 `while ((m = rx.exec(...)) !== null)` 루프를 돈다(`scanIdentifierCitations` 189-201행, `collectSourceTokens` 219-224행, `collectEnvDeclarations` 264-268행·272-276행). 이는 "전역 변수 수정" 관점에서 볼 만한 패턴이다 — `FIELD_TABLE_NAME`/`CODE_FIELD`/`BACKTICK` 세 상수는 모듈 스코프에 살아 있고 `.lastIndex` 는 실행마다 변한다. 현재는 사용 지점마다 리셋을 빠짐없이 넣어 안전하지만(뮤테이션 실측으로 각 정규식 경계가 라운드 4~5에서 검증됨), **이 리셋은 코드 리뷰나 타입시스템이 강제하지 않는 관례다** — 다음 사람이 이 정규식들을 재사용하는 새 호출부를 추가하면서 `lastIndex = 0` 을 빠뜨리면, 이전 호출의 잔여 오프셋 때문에 매치가 조용히 누락된다(방향은 "거짓 PASS" 쪽 — 이 파일의 다른 경계 논의들과 같은 위험 방향). 실제 결함은 아니며 현재 호출부는 전부 규율을 지키고 있다.
  - 제안: 조치 불요 수준(테스트 전용 정적 스캐너이고 단일 스레드·동기 실행이라 인터리빙 위험은 없다). 다만 향후 이 정규식들을 재사용하는 호출부를 추가할 때는 `lastIndex` 리셋 관례를 유지하도록 주석 근처에 남겨두면 좋다.

- **[INFO]** 파일시스템 접근은 전부 읽기 전용이며, 쓰기/삭제/네트워크/환경변수 변경은 관측되지 않음
  - 위치: `guide-identifier-scan.ts`(전체), `guide-identifier-existence.test.ts`(전체)
  - 상세: `fs.readFileSync`·`fs.readdirSync`·`fs.existsSync` 만 사용하고 `writeFile`·`appendFile`·`unlink`·`mkdirSync`·`rmSync` 류 API 는 grep 결과 0건이다. `.env.example`·`docker-compose*.yml` 자체도 이번 diff 에서 수정되지 않았다(`git diff --stat` 확인 — 매치 없음). `process.env` 읽기/쓰기도 없다(스캐너는 env **선언처 파일**을 문자열로 파싱할 뿐, 실제 `process.env` 값을 읽거나 쓰지 않는다). 네트워크 호출·타이머·이벤트 emitter·콜백 등록도 없다.

- **[INFO]** 삭제된 모듈(`guide-error-code-scan.ts`)에 대한 외부 참조 잔존 여부 확인 — 코드 상 잔존 없음
  - 위치: 저장소 전체 `codebase/` grep
  - 상세: `grep -rln "guide-error-code-scan" codebase/` 결과 매치 없음. `guide-sanitized-message-parity.test.ts:16` 의 옛 파일명 언급은 "그 당시엔 이 이름이었다"는 역사적 각주로, 실제 import/참조가 아니다(라운드 1 WARNING 으로 지적됐던 크로스레퍼런스는 이미 이 각주로 해소됨). 삭제된 두 파일을 import 하는 잔존 코드는 없으므로 "삭제 후 죽은 참조로 인한 런타임 실패" 부작용은 없다.

- **[INFO]** 시그니처/인터페이스 변경의 영향 범위 — 유일한 소비자가 같은 diff 안에 있어 외부 영향 없음
  - 위치: `guide-identifier-scan.ts` export (`scanIdentifierCitations`, `collectSourceTokens`, `collectEnvDeclarations`, `GUIDE_EXTERNAL_VOCABULARY`, `CitationAxis`) / `guide-identifier-existence.test.ts`
  - 상세: 신규 모듈이고 삭제된 `guide-error-code-scan.ts` 의 옛 함수 시그니처(`collectErrorCodesFromSource` 류)와 이름·인자가 다르지만, 이 함수들을 import 하는 파일은 저장소 전체에서 `guide-identifier-existence.test.ts` 하나뿐이다(grep 확인). 공개 API(barrel export, 다른 패키지에서의 import)가 아니므로 하위 호환성 파손 대상이 없다.

## 요약

이번 diff(부작용 lens 스코프)는 문서 정합성 검증용 vitest 정적 스캐너의 리네임·재설계(`guide-error-code-*` 삭제 → `guide-identifier-*` 신설)와 인접 테스트 파일의 주석 1줄 수정, 그리고 `CHANGELOG.md`/`PROJECT.md` 산문 갱신으로 구성된다. 모든 파일시스템 접근은 읽기 전용(`readFileSync`/`readdirSync`/`existsSync`)이고 쓰기·삭제·네트워크 호출·환경변수 변경·이벤트/콜백 등록은 전혀 없다. 삭제된 모듈에 대한 죽은 참조도 코드 상 없다(문서 각주만 남음). 유일하게 짚을 만한 것은 모듈 스코프 `g`-정규식 5개가 `lastIndex` 라는 은닉 가변 상태를 공유하는 패턴인데, 현재 모든 호출부가 사용 전 리셋을 지키고 있어 실질적 결함은 아니며 단일 스레드 동기 실행이라 인터리빙 위험도 없다. 종합적으로 이 lens 관점의 실질적 위험은 없다.

## 위험도

NONE
