# Code Review SUMMARY — 백엔드 테스트 open-handle 누수 근본 수정 (L3, forceExit 의존 제거)

- 일시: 2026-06-19 21:45 (worktree `forceexit-rootfix-d6afe8`)
- 대상 changeset (working-tree, pre-commit): 5 파일
  - `codebase/backend/src/modules/knowledge-base/parsers/pdf.parser.ts` — top-level `require('pdf-parse')` → lazy memoized `getPdfParse()`
  - `codebase/backend/src/modules/knowledge-base/parsers/parser.factory.spec.ts` — pdf 분기 테스트 추가(리뷰 반영)
  - `codebase/backend/jest.config.ts` — `forceExit: true` 제거 + 주석 갱신(+ e2e cross-ref)
  - `codebase/backend/test/jest-e2e.json` — `forceExit: true` 제거
  - `codebase/backend/test/workflow-test-dataset.e2e-spec.ts` — 누락된 `afterAll(db.end())` 추가
- 실행 reviewer (6): scope / side-effect / testing / maintainability / performance / requirement
  - router 미사용. main 이 변경 성격(테스트 인프라 + 소량 production 리팩토링)에 맞는 관점을 직접 선정.
  - bg 워크트리 격리로 sub-agent 의 Write 가 차단되므로 reviewer 는 findings 를 텍스트로 반환, 본 SUMMARY 는 main 이 직접 기록.

## BLOCK: NO

미해결 Critical/Warning 없음. Critical 1건은 오탐(미커밋 상태 — 커밋으로 해소), Warning 2건 fix, Warning 2건 근거 있는 won't-fix.

---

## 근본 원인 (이 작업이 고친 것)

L2(PR #639)가 `forceExit: true` 로 가리던 실제 누수처를 식별·제거:

- **Unit**: `pdf.parser.ts` 의 top-level `require('pdf-parse')` 가 정적 import 그래프만으로 실행되며 `pdfjs-dist → @napi-rs/canvas` 네이티브 addon 을 `dlopen` → 프로세스 수명 `CustomGC` libuv 핸들 등록. 이게 unit 스위트 **유일** open handle 이었음(`--detectOpenHandles` 전수 스캔으로 확인, 1건). 실제로 PDF 를 파싱하는 unit spec 은 전부 `jest.mock('pdf-parse')` 라 mock 을 호출 → 유일하게 import 만 하고 mock 안 한 `document-embedding.processor.spec.ts` 가 native addon 로드를 트리거. lazy-load 로 import 시점 로드를 제거.
- **E2e**: `workflow-test-dataset.e2e-spec.ts` 가 `beforeAll` 에서 pg `Client` 를 connect 하나 `afterAll` 자체가 없어 미종료. 나머지 34개 e2e spec 은 이미 `afterAll(db.end())` 보유. afterAll 추가로 제거.

## 검증 (forceExit 제거 근거)

- **Unit**: `--detectOpenHandles` 전수 스캔 — 수정 후 355 suites / 7125 tests, **open handle 0건**. 추가로 forceExit·detectOpenHandles 둘 다 끈 plain 런이 "did not exit / Force exiting" 메시지 없이 **스스로 종료** 확인.
- **E2e**: 실 컨테이너(`make e2e-test` 경로, backend-e2e 재빌드)에서 `--detectOpenHandles` 로 35 suites / 205 tests, **open handle 0건**. 컨테이너 정리 완료.
- → unit·e2e 양쪽 forceExit 제거. L1 워치독(run-test.sh, 미변경)이 최종 backstop.

---

## 발견사항 및 해소

### Critical
| # | reviewer | 위치 | 내용 | 판정 |
|---|---|---|---|---|
| C1 | testing | jest.config.ts / jest-e2e.json | 변경이 미커밋(working-tree) 상태 — HEAD 는 여전히 forceExit:true | **오탐/비차단**. pre-commit 리뷰의 정상 상태. 본 changeset 커밋으로 해소되며, 커밋 후 fresh review 로 재확인. 코드 결함 아님. |

### Warning
| # | reviewer | 위치 | 내용 | 조치 |
|---|---|---|---|---|
| W1 | maintainability | jest.config.ts ↔ jest-e2e.json | e2e forceExit 제거 사유가 JSON 이라 코드에서 추적 불가 → 미래에 hang 시 재삽입 위험 | **FIX**. jest.config.ts 주석에 "jest-e2e.json 도 같은 이유로 제거(black-box HTTP·Nest app/native addon 없음·각 spec 이 db.end() 로 pg Client 종료); hang 시 forceExit 재삽입 말고 db.end() 빠뜨린 spec 을 찾아라" cross-ref 추가. |
| W2 | testing | parser.factory.spec.ts | factory 레벨 `parseDocument(_, 'pdf')` 분기 미테스트 — lazy-load 가 factory 경유로 동작하는지 미검증 | **FIX**. `parseDocument(buffer,'pdf')` → 'mocked pdf content' 테스트 추가(switch 순서 txt→md→pdf→csv 정렬). lazy `getPdfParse()` 가 mock 으로 라우팅됨을 end-to-end 검증. 5/5 통과. |
| W3 | testing | workflow-test-dataset.e2e-spec.ts:68 | `beforeAll` throw 시 `db` 미초기화 → `afterAll` 의 `db.end()` TypeError 가능 | **WON'T FIX (근거)**. reviewer 도 "기존 모든 e2e spec 동일 패턴, 새 위험 도입 아님" 명시. plain `await db.end()` 는 코드베이스 다수(32/39 spec); 이 한 파일만 `db?.end()` 로 바꾸면 오히려 불일치. 현실 실패경로(connect throw)는 db 가 이미 할당돼 pg `.end()` 가 정상 처리 — hang 없음. 전역 패턴 일괄 변경은 본 작업 범위 밖(별개 리팩토링). |
| W4 | testing | pdf.parser.ts:19 | 모듈 전역 `cachedPdfParse` 가 teardown 에서 리셋 안 됨 → `jest.resetModules()` 도입 시 stale 가능 | **WON'T FIX (근거)**. reviewer 결론도 "현재 설계상 문제없음". jest 의 per-file module registry 격리로 파일 간 오염 없음(side-effect reviewer 도 확인). 가설적 미래 시나리오를 위해 export/DI 추가는 over-engineering. |

### Info (조치 불요 / 범위 밖)
- side-effect/performance/requirement/scope 의 Info 다수: lazy-load 의 에러 전파 시점 이동(import→first-parse, async 호출자라 영향 없음), 병렬 첫 호출 race 없음(Node 단일스레드 + require 캐시), 시그니처 불변·내부 심볼 미export, 첫 파싱 latency 일회성 이동(허용 가능), public API 불변 — 모두 무해 확인.
- testing 의 run-test.sh 워치독 테스트 커버리지 갭/`set -m` 주석 등 Info: **작업이 명시적으로 "run-test.sh 워치독·env 는 건드리지 않는다"(별개 관심사, PR #639 머지됨)** 라 범위 밖. 미조치.
- maintainability 의 `parser.factory.spec.ts` SIGSEGV 주석 obsolete Info: 해당 주석은 "mock 제거 시 native 로드 SIGSEGV" 경고로 **여전히 유효**(mock 을 지우면 실제 canvas 로드됨). 약화 위험이 있어 의도적으로 미변경.
- requirement/maintainability 의 db.end 가드 스타일 Info: 실측 결과 plain `await db.end()` 가 다수(32) 패턴 — 현 코드가 이미 다수 컨벤션 준수. 미변경.

---

## 완료 기준 대비 (requirement reviewer 확인: 4/4 PASS)
1. 누수처 식별 + teardown 수정 제거 — ✅ (unit: lazy-load / e2e: afterAll db.end)
2. forceExit 없이 자체 종료 검증 — ✅ (unit·e2e 모두 detectOpenHandles 0핸들, unit plain 런 자체 종료)
3. jest.config.ts / jest-e2e.json 주석·설정 갱신 — ✅ (config 주석 갱신 + e2e cross-ref; JSON 은 주석 불가라 라인만 제거하고 사유는 config 주석·커밋/PR 에 기록)
4. run-test.sh 워치독·env 미변경 — ✅ (diff 4(→fix 후 5)파일 모두 codebase/backend 하위, run-test.sh 없음)
