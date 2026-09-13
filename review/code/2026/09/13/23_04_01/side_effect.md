# 부작용(Side Effect) 리뷰 — error-code-emission-axis

## 범위 확인

`git diff origin/main --stat` 전수 확인 결과, 실제 런타임 프로덕션 코드(`execution-engine.service.ts` 등)는 이번 브랜치에 포함되지 않는다. 변경은 다음 6개 실질 파일로 국한된다:

- `CHANGELOG.md`, `PROJECT.md` — 서술 정정
- `codebase/frontend/src/content/docs/02-nodes/{logic,logic.en}.mdx` — 유저 가이드 문장 정정
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` — 발행 축 테스트 추가
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` — 발행 축 스캐너(순수 함수) 추가
- `plan/in-progress/{error-code-emission-axis.md, spec-draft-nullable-notation-followups.md}` — plan 트래킹

나머지 200여 개는 `review/code/**`·`review/consistency/**` 산출물(정적 마크다운/JSON 기록)이다. `spec/**` 은 이번 diff 에 없다 — developer 쓰기 경계 위반 없음.

## 발견사항

- **[INFO]** 신규 카탈로그 파일 read 가 존재 가드 없이 이뤄짐
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` (`catalogCodes` 초기화부, `fs.readFileSync(path.join(root, "spec/5-system/3-error-handling.md"), "utf8")`)
  - 상세: 같은 파일의 `envExampleTexts` 는 `readIfPresent`(내부에서 `fs.existsSync` 선확인)를 거치는데, 이 신규 read 는 가드 없이 직접 호출한다. 대상 파일이 이동·삭제되면 이 `describe` 블록 전체(발행 축뿐 아니라 기존 존재-축 테스트까지)가 컬렉션 단계에서 예외로 죽는다. 다만 같은 패턴(SoT 파일을 가드 없이 `fs.readFileSync`)이 이미 `guide-sanitized-message-parity.test.ts` 에도 있고, 대상 파일(`spec/5-system/3-error-handling.md`)의 실존을 직접 확인했다 — 새로 도입된 위험이 아니라 기존 관행의 반복이며, 이전 라운드들에서도 같은 결론(조치 불요)으로 처분됐다.
  - 제안: 조치 불필요(누적 처분 유지). 강화하려면 `readIfPresent` 로 통일.

- **[INFO]** 모듈 스코프 메모이제이션 캐시(`sourceLinesCache`) — 부작용 없음 확인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` (`sourceLinesCache`/`resolveSourceLines` 선언부, `describe` 블록 앞)
  - 상세: `Map<string, string[] | null>` 이 테스트 파일 모듈 스코프에 있어 파일 실행 동안 상주하지만, (1) 오직 이 파일 내부에서만 참조되고 export 되지 않으며 (2) 읽기 전용 파일시스템 조회 결과만 캐싱하고 (3) `basename` 충돌 시 이미 `null`(유일하게 특정 안 됨)로 수렴하도록 설계돼 있어 잘못된 캐시 히트를 만들지 않는다. 순수 캐시이며 다른 테스트/파일에 누출되는 공유 가변 상태가 아니다.
  - 제안: 조치 불필요(양성 확인 목적의 기록).

- **[INFO]** 신규 export 는 전부 순수 함수/불변 상수 — 기존 시그니처 무변경
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (`collectQuotedLiterals`, `collectMessagePrefixes`, `collectCatalogCodes`, `isMessagePrefixOnly`, `computeNonEmittedOffenders`, `GUIDE_NON_EMITTED_VOCABULARY`)
  - 상세: 기존 export(`collectSourceTokens`, `collectEnvDeclarations`, `scanIdentifierCitations`, `GUIDE_EXTERNAL_VOCABULARY`, `CitationAxis`)의 시그니처는 diff 상 변경되지 않았다. 신규 함수는 전부 인자로 받은 문자열/집합만 읽어 새 `Set`/`string[]`을 반환하며 전역 상태·파일시스템·네트워크 접근이 없다. `grep -rn` 으로 이 저장소 전체에서 신규 식별자 6종의 사전 사용례가 0건임을 확인했다 — 이름 충돌 없음.
  - 제안: 조치 불필요.

- **[INFO]** 이전 라운드에서 지적된 이름 충돌(`staleEntries`)이 현재 diff 에서 해소됨 — 잔여 확인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` (`staleGuideEntries` 함수, `export` 없음 — 모듈 비공개)
  - 상세: RESOLUTION.md(`20_34_32`)가 기록한 대로, 최초 이름 `staleEntries` 가 `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:129` 의 **export 된 동명 함수**(시그니처 상이: `(string[], string[])`)와 겹쳤던 것을 `staleGuideEntries` 로 개명해 반영했다. `grep` 재확인 결과 현재 diff 의 `staleGuideEntries` 는 이 파일에만 존재하고 비공개(export 없음)라 교차 모듈 충돌 여지가 없다.
  - 제안: 조치 불필요(정상 해소 확인).

- **[INFO]** `SOURCE_ROOTS`/`skipBuildDirs` 상수화로 "백엔드 소스" 정의를 파일 내 단일화 — 부작용 관점에서 긍정적
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` (`SOURCE_ROOTS`, `skipBuildDirs` 선언 및 `sourceTexts`/`resolveSourceLines` 양쪽에서의 재사용)
  - 상세: 두 값 모두 모듈 비공개이며, `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 의 유사 이름(`CODEBASE_SOURCE_ROOTS`)과도 export 되지 않아 충돌하지 않는다. 기존에 `sourceTexts` 계산에만 있던 소스 루트 정의가 `resolveSourceLines`(신규 `where` 검증용)에도 같은 상수로 공유돼, "같은 개념에 정의가 두 곳"이던 구조를 하나로 합쳤다.
  - 제안: 조치 불필요.

- **[INFO]** env 변수·네트워크·이벤트/콜백 부작용 없음
  - 위치: 리뷰 대상 6개 실질 파일 전체
  - 상세: 신규 `process.env` 읽기/쓰기, 외부 서비스 호출, 이벤트 발행/구독 변경이 diff 안에 없다. `plan/**` 문서 신규 생성은 이 저장소의 정식 plan 트래킹 관례와 일치하며 실행 경로에 영향을 주는 파일시스템 부작용이 아니다.
  - 제안: 조치 불필요.

## 검토했으나 부작용 없음으로 판단한 항목

- `logic.mdx`/`logic.en.mdx`: 문장 정정뿐, 코드/런타임 동작 변경 없음(엔진이 여전히 메시지 접두만 방출하며 구조화 코드를 신설하지 않는다는 점을 문서가 서술만 정정).
- `CHANGELOG.md`, `PROJECT.md`: 문서 갱신뿐.
- `plan/in-progress/*.md`: 트래커 갱신(체크박스 승격·frontmatter `spec_impact` 보강 등) — 정식 저장 위치 규약과 일치.
- 이번 diff 는 `spec/**` 을 건드리지 않는다 — spec 6~7파일의 `CONTAINER_*` 서술 불일치(spec-drift)는 이전 라운드에서 트래커 등재·planner 위임으로 처리하고 이 PR 범위 밖으로 확정됐다(RESOLUTION `20_13_13`/`20_34_32`).

## 요약

이번 diff 는 프로덕션 런타임 코드를 건드리지 않으며, 실질 코드 변경은 테스트 전용 정적 스캐너(`guide-identifier-scan.ts`)에 순수 함수·불변 상수를 추가하고 그 테스트(`guide-identifier-existence.test.ts`)를 확장한 것으로 국한된다. 기존 export 시그니처는 전부 보존됐고, 이전 라운드에서 지적된 이름 충돌(`staleEntries`)은 비공개 함수로 개명해 해소된 상태로 반영돼 있다. 유일하게 반복 언급할 만한 점은 신규 카탈로그 파일 read 가 형제 필드(`envExampleTexts`)와 달리 존재 가드 없이 이뤄진다는 것인데, 이는 이 테스트 스위트의 기존 관행과 일치하고 여러 라운드에 걸쳐 이미 조치 불요로 처분됐다. 전역 상태 오염, 파괴적 파일시스템 부작용, 환경변수·네트워크·이벤트 부작용은 발견되지 않았다.

## 위험도

NONE
