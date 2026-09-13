# 보안(Security) 리뷰 — error-code-emission-axis (23_04_01)

## 범위 요약

이번 diff(`git diff origin/main`, 206개 파일 변경)는 성격상 세 그룹으로 나뉜다.

1. **문서 정정**: `CHANGELOG.md`, `PROJECT.md`, `codebase/frontend/src/content/docs/02-nodes/logic.mdx`/`logic.en.mdx` — 유저 가이드가 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`를 구조화된 `error.code`처럼 서술하던 것을 "메시지 접두일 뿐 전용 코드는 없다"로 정정.
2. **테스트 전용 정적 스캐너 확장**: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(순수 함수·정규식·상수 추가) + `guide-identifier-existence.test.ts`(신규 "발행 축" 테스트 스위트). 가이드 문서가 인용하는 UPPER_SNAKE 식별자가 실제로 코드로 "발행"되는지를 저장소 자신의 소스/스펙 텍스트에 대해 정적으로 검사한다.
3. **plan/review 산출물**: `plan/in-progress/*.md`, `review/code/**`, `review/consistency/**` 다수 — 이전 리뷰 라운드(19:23~22:38)의 산출물과 트래킹 문서를 커밋하는 것. 코드 실행 경로가 아니다.

런타임 프로덕션 경로(백엔드 API 핸들러, 인증/인가, DB 쿼리, 외부 네트워크 호출, 시크릿 취급)를 수정하는 코드는 이 diff 에 **없다**. 신규 스캐너(`guide-identifier-scan.ts`)는 CI/로컬 테스트 시점에만 실행되며, 입력은 전부 저장소 자신의 하드코딩된 상대경로(`spec/5-system/3-error-handling.md`, `codebase/backend/src`, `codebase/packages` 등)에서 읽은 정적 텍스트이지 사용자 입력이나 네트워크 경계를 다루지 않는다.

## 발견사항

- **[INFO]** 신규 정규식 3종(`QUOTED_LITERAL`, `MESSAGE_PREFIX`, `CATALOG_CODE`) 및 `parseWhereRefs`의 참조 정규식에 ReDoS 가능성 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (`QUOTED_LITERAL`/`MESSAGE_PREFIX`/`CATALOG_CODE` 선언부, 기존 `UPPER_SNAKE` 재사용), `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` (`parseWhereRefs` 함수 정의부)
  - 상세: 세 정규식 모두 `UPPER_SNAKE = "[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+"`를 감싸는 형태로, 첫 그룹은 `_`를 생성할 수 없고 둘째 그룹은 반드시 `_`로 시작해 두 정량자의 매치 범위가 겹치지 않는다 — catastrophic backtracking의 전제(모호한 부분 반복)가 성립하지 않는다. `parseWhereRefs`의 `/([\w./-]+\.ts):(\d+(?:·\d+)*)/g`도 유사하게 단순 선형 패턴이다. 신규 수집기 `collectMatches`는 `matchAll`을 사용해 정규식을 내부적으로 복제하므로 공유 `lastIndex` 오염도 없다. 입력은 전부 이 저장소 자신의 정적 텍스트(소스 `.ts`, spec `.md`)이며 외부/사용자 입력이 아니므로, 설령 이론적 성능 저하가 있어도 공격 표면이 아니다.
  - 제안: 조치 불필요.

- **[INFO]** 스캐너가 읽는 파일 경로는 전부 하드코딩된 저장소 상대경로 — 경로 탐색(path traversal) 벡터 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` (`catalogCodes` 초기화부의 `path.join(root, "spec/5-system/3-error-handling.md")`, `SOURCE_ROOTS = ["codebase/backend/src", "codebase/packages"]`, `resolveSourceLines`의 `walkTree(root, SOURCE_ROOTS, ...)`)
  - 상세: 신규 `resolveSourceLines`는 `where` 문자열에서 뽑은 파일명(`basename`)으로 `SOURCE_ROOTS` 안을 탐색하지만, `where` 값 자체가 코드에 하드코딩된 상수 배열(`GUIDE_NON_EMITTED_VOCABULARY`)의 리터럴이지 사용자/외부 입력이 아니다. 유일성 검사(`found.length === 1` 아니면 `null`)까지 있어 탐색이 애매하게 확장되지도 않는다.
  - 제안: 조치 불필요.

- **[INFO]** 하드코딩된 시크릿/자격증명 없음
  - 위치: 리뷰 대상 diff 전체 (`CHANGELOG.md`, `PROJECT.md`, `*.mdx`, `guide-identifier-*.ts`, `plan/**`, `review/**`)
  - 상세: `git diff origin/main`에 대해 `password|secret|api[_-]?key|token[:=]|BEGIN (RSA|PRIVATE|CERTIFICATE)|Authorization:\s*Bearer` 패턴으로 전수 확인했으나 실제 매치되는 것은 전부 `token: string` 같은 TypeScript 타입 필드명이거나 `CONTAINER_MISSING_EMIT`/`MAKESHOP_UNRESOLVED_PATH_PARAM` 같은 에러 코드/식별자 **이름**이지 값이 아니다. `.env.example`/compose 파일 자체는 이번 diff에 포함되지 않았다(테스트가 읽기만 함).
  - 제안: 조치 불필요.

- **[INFO]** 신규 스캐너에 `child_process`/`eval`/네트워크 호출 없음 — 코드 실행·인젝션 표면 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`, `guide-identifier-existence.test.ts` 전체
  - 상세: `exec`로 매치된 자리는 전부 `RegExp.prototype.exec`(정규식 매칭)이며 `child_process.exec`가 아니다. 두 파일에서 `spawn`/`child_process`/`eval(` 패턴은 0건이다. `fs.readFileSync`/`fs.existsSync`만 사용해 파일 내용을 읽어 메모리 내 `Set`/`string[]`으로 반환하는 순수 함수들이다.
  - 제안: 조치 불필요.

- **[INFO]** 문서 정정 자체가 보안 방향으로 긍정적
  - 위치: `codebase/frontend/src/content/docs/02-nodes/logic.mdx`, `logic.en.mdx`
  - 상세: "여러 개 또는 0개를 연결하면 `CONTAINER_MISSING_EMIT` 또는 `CONTAINER_MULTIPLE_EMIT`로 실행 실패해요"를 "실패 메시지 앞에 붙어요 — 전용 에러 코드는 없으니 코드가 아니라 메시지를 봐야 해요"로 정정한 것은, 사용자가 존재하지 않는 구조화된 `error.code` 필드를 신뢰해 오동작하는 조건 분기를 작성하는 것을 예방하는 방향이다. 새로운 정보 노출이나 오도 없음.
  - 제안: 조치 불필요.

뮤테이션 검증(가설 확인용 코드 수정)은 수행하지 않았다 — 정적 검토만으로 판단이 충분했고, 병렬 리뷰어 오염 위험을 피하기 위해 저장소 트리는 전혀 건드리지 않았다(`git status --short` 결과 이 세션에서 만든 변경 없음).

## 요약

이번 변경 세트는 유저 가이드 문서 2건의 서술 정정, 그 정확성을 지속 검증하는 테스트 전용 정적 스캐너("발행 축")의 순수 함수·정규식·상수 추가, 그리고 이전 리뷰 라운드들의 plan/review 산출물 커밋으로 구성되며 프로덕션 런타임 코드(API·인증/인가·DB·네트워크)는 전혀 건드리지 않는다. 신규 정규식은 기존에 안전성이 확인된 `UPPER_SNAKE` 패턴을 재사용해 ReDoS 위험이 없고, 모든 파일 읽기는 하드코딩된 저장소 상대경로에 대해서만 이뤄져 경로 탐색 벡터가 없으며, 코드 실행·네트워크 호출·하드코딩된 시크릿도 발견되지 않았다. 보안 관점에서 이 PR의 위험은 사실상 없다.

## 위험도

NONE
