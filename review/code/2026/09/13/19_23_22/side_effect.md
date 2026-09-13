# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 신규 카탈로그 파일 read 가 다른 축과 달리 존재 가드 없이 이뤄진다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:82-87`
  - 상세: `catalogCodes` 는 `fs.readFileSync(path.join(root, "spec/5-system/3-error-handling.md"), "utf8")` 를 최상위 `describe` 블록(모든 `it` 실행 전, 테스트 수집 시점)에서 직접 호출한다. 같은 파일의 `envExampleTexts` 는 `readIfPresent`(내부에서 `fs.existsSync` 로 먼저 확인)를 거치는데, 이 신규 read 는 그 가드를 거치지 않는다. 대상 파일이 이동·삭제되면 이 describe 블록 전체(발행 축뿐 아니라 기존 베이스라인·과거 결함 재현 테스트까지)가 컬렉션 단계에서 예외로 죽는다.
  - 다만 같은 패턴(SoT 파일을 가드 없이 `fs.readFileSync`)이 이미 `guide-sanitized-message-parity.test.ts:29,50` 에도 있어 이 저장소의 기존 관행과 일치한다 — 새로 도입된 위험이라기보다는 기존 관행의 반복이다. 대상 파일(`spec/5-system/3-error-handling.md`)도 실존을 확인했다.
  - 제안: 조치 불필요(기존 관행과 일치). 굳이 강화하려면 `readIfPresent` 로 통일해 실패 시 부분 실패(vacuity floor RED)로 좁힐 수 있다.

- **[INFO]** 모듈 스코프 정규식 3개가 추가됐지만 공유 가변 상태(`lastIndex`) 오염은 회피됨 — 긍정적 설계 확인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:259-266` (선언), `:344-389` (사용)
  - 상세: `QUOTED_LITERAL`/`MESSAGE_PREFIX`/`CATALOG_CODE` 는 모듈 최상위에 선언된 공유 `RegExp`(전역 상태에 준함)이지만, 호출부가 `rx.exec`+`lastIndex` 수동 관리 대신 `String.prototype.matchAll` 을 쓴다. `matchAll` 은 내부적으로 정규식을 복제해 순회하므로 원본 객체의 `lastIndex` 를 건드리지 않는다 — 이 파일에 이미 있던 4곳의 `rx.lastIndex = 0` 패턴(재호출 시 리셋 누락이면 두 번째 호출부터 조용히 결과가 준다는, 트래커에 등재된 결함 클래스)을 새로 반복하지 않는다. 부작용 관점에서 우려할 공유 상태 변경이 없음을 확인했다(결함이 아니라 회피 확인).

## 검토했으나 부작용 없음으로 판단한 항목

- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`: 신규 함수 `collectQuotedLiterals`/`collectMessagePrefixes`/`collectCatalogCodes` 는 인자로 받은 문자열 배열만 읽어 새 `Set` 을 반환하는 순수 함수 — 전역 상태·파일시스템·네트워크 접근 없음. `GUIDE_NON_EMITTED_VOCABULARY` 는 불변(`readonly`) 배열 상수 추가로 기존 export(`collectSourceTokens`·`collectEnvDeclarations`·`scanIdentifierCitations`·`GUIDE_EXTERNAL_VOCABULARY`)의 시그니처는 전혀 변경되지 않았다 — 기존 호출자에 영향 없음(순수 추가).
- `codebase/frontend/src/content/docs/02-nodes/logic.mdx`, `logic.en.mdx`: 사용자 가이드 문장 정정뿐, 코드/런타임 동작 변경 없음.
- `CHANGELOG.md`, `PROJECT.md`: 문서 추가/갱신뿐.
- `plan/in-progress/error-code-emission-axis.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`(추가분), `review/consistency/2026/09/13/18_40_54/**`: 프로젝트 harness 관례(plan 트래킹·consistency-check 산출물 커밋)에 따른 정적 문서/리포트 파일 신규 생성 — 코드 실행 경로에 영향을 주는 파일시스템 부작용이 아니며, 이 저장소의 정식 저장 위치 규약과 일치한다. `_retry_state.json`·`meta.json` 도 해당 세션의 정적 산출물이고 다른 프로세스가 참조하는 실행 중 상태가 아니다.
- env 변수·네트워크 호출·이벤트/콜백: 이번 diff 범위(테스트/스캐너/문서/plan) 안에 신규 `process.env` 읽기, 외부 서비스 호출, 이벤트 발행/구독 변경이 전혀 없다.
- 백엔드 런타임 코드(`execution-engine.service.ts` 등)는 이번 diff 에 포함되지 않았다 — 가이드 문장이 그 코드의 실제 동작(메시지 접두, 구조화 코드 미방출)을 서술만 정정했을 뿐, 엔진 동작 자체는 변경되지 않았다(plan §D 에도 "동작은 안 바꾼다" 로 명시).

## 요약
이번 변경은 문서(가이드 mdx·CHANGELOG·PROJECT.md), 테스트 전용 스캐너(`guide-identifier-scan.ts`)의 순수 함수·상수 추가, 그리고 plan/review 산출물 신규 생성으로 구성되며 프로덕션 런타임 코드는 건드리지 않는다. 신규 함수들은 인자만 읽는 순수 함수이고, 신규 정규식은 `matchAll` 사용으로 공유 `lastIndex` 오염을 스스로 회피했다. 유일하게 언급할 만한 점은 테스트 파일이 새로 추가한 `spec/5-system/3-error-handling.md` 읽기가 형제 필드(`envExampleTexts`)와 달리 존재 가드 없이 이뤄진다는 것인데, 이는 같은 테스트 스위트 내 기존 관행(`guide-sanitized-message-parity.test.ts`)과 일치하는 패턴이라 새로운 위험으로 보지 않는다. 전역 상태 변경, 시그니처/공개 API 파괴적 변경, 예기치 않은 파일 생성·삭제, 환경변수·네트워크·이벤트 부작용은 발견되지 않았다.

## 위험도
NONE
