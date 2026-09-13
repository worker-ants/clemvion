# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 2건(테스트 커버리지 갭 1건, 워크트리 잔존 `.bak` 파일 1건) 모두 병합을 막는 수준은 아니나 정리 필요. forced(router_safety) 화이트리스트 7개(`documentation`·`maintainability`·`requirement`·`scope`·`security`·`side_effect`·`testing`) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `UPPER_SNAKE` 정규식의 "밑줄 최소 1개(약어 `LLM`/`HTTP` 등 제외)"라는 코드 주석이 명시한 설계 결정이 어떤 테스트로도 겨냥되지 않음 — `(?:_[A-Z0-9]+)+` 의 `+`→`*` 뮤테이션(밑줄 그룹 0개 허용)을 적용해도 전체 스위트 31/31 이 그대로 GREEN(뮤테이션 생존 실측 확인) | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:89-90` | `scanIdentifierCitations — 축별 대조군`에 "밑줄 없는 대문자 약어는 안 집는다"(예: 백틱 단독 `` `LLM` ``) 판별 fixture 추가하여 이 설계 결정을 뮤테이션으로 고정 |
| 2 | documentation | 워크트리에 리뷰 프로토콜이 금지하는 뮤테이션 백업 파일이 옛 정규식(주석 처리된 env 선언 미대응 판)을 담은 채 방치됨 — 다른 세션의 뮤테이션 검증 산출물로 추정, gitignore 대상도 아니라 향후 `git add -A` 류 커밋에 실수 편입 위험 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts.bak` (이번 diff 범위 밖, untracked) | 병합 전 `rm codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts.bak` 로 제거. 향후 뮤테이션 검증 시 백업은 저장소 밖 scratch(`mktemp -d`)에만 둘 것 |

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `[SPEC-DRIFT]` `spec/conventions/user-guide-evidence.md §2` 가 이번에 리네임·확장된 가드 가족 3파일(`guide-identifier-scan.ts`/`guide-identifier-existence.test.ts`/`guide-sanitized-message-parity.test.ts`)을 여전히 등재하지 않음 — `--impl-prep`/`--impl-done`/`ai-review` 라운드 1·2·3 에 걸쳐 통산 7번째 독립 확인된 선재 갭. `developer` 는 `spec/` 쓰기 권한이 없고 이 표는 제품 카탈로그라 자기-반증형 소정정 예외 대상도 아님 | `spec/conventions/user-guide-evidence.md §2` (표·frontmatter `code:` 목록) | 코드 변경은 유지. `project-planner` 턴에서 §2 표에 가드 3건(신 파일명) 등재. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 `- [ ]` 항목으로 정확히 등재돼 있어 이번 리뷰가 새로 요구하는 조치는 없음(회귀 방지 재확인) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture | `collectEnvDeclarations` 가 소스 유형별 고정 파라미터(`envExampleTexts`, `composeTexts`) 2개를 받는 형태라 세 번째 선언처(예: k8s manifest, CI env) 추가 시 시그니처 변경이 필요 | `guide-identifier-scan.ts:192-214` | 지금 조치 불요. 3번째 선언처가 실제로 필요해지면 `{label, pattern, texts}[]` 목록 순회 형태로 일반화 |
| 2 | architecture | `guide-identifier-existence.test.ts` 한 파일이 baseline-0 통합 가드·`GUIDE_EXTERNAL_VOCABULARY` 데이터 불변식·순수 함수 단위 대조군 세 층위를 누적(305행, 4개 최상위 `describe`) | `guide-identifier-existence.test.ts` 전체 | 즉각 조치 불요. 축 4개 초과/파일 비대화 시 분리 신호로 기록 |
| 3 | maintainability | "정규식 lastIndex 리셋 → exec 루프 → Set 적재" 패턴이 한 파일 안에서 4회 손으로 반복(폴더 전반 기존 관례, 이번 PR 신규 결함 아님) | `guide-identifier-scan.ts:139-148, 163-171, 197-203, 205-211` | 조치 불요. 가드가 더 늘거나 반복이 5회 넘으면 공유 `matchAll` 유틸 검토 |
| 4 | maintainability | 동일 설계 근거(#1330 축별 실측표)가 소스 헤더 주석·테스트 JSDoc·plan 문서 세 곳에 축약 없이 반복돼 향후 드리프트 위험 | `guide-identifier-scan.ts:1-76`, `guide-identifier-existence.test.ts:18-27`, `plan/in-progress/guide-identifier-existence.md §A~C` | 즉각 조치 불요. 다음 설계 변경 시 "코드 헤더가 SoT, 나머지는 참조만" 방향으로 점진 정리 권장 |
| 5 | testing | `readIfPresent`(`.env.example` 부재 분기)는 이 저장소 조건상 항상 존재-분기만 실행되어 부재 분기가 어떤 테스트로도 커버되지 않음(이식성 방어, 현재 도달 불가) | `guide-identifier-existence.test.ts:30-37` | 조치 불요. 조건 분기가 하나 더 늘면 그때 분리·테스트 고려 |
| 6 | documentation | `plan/in-progress/guide-identifier-existence.md` 체크리스트 마지막 2항목(`run-test-all.sh`, `/ai-review + --impl-done`)이 실제로는 이미 수행됐음에도 미체크 상태로 남아 있음 | `plan/in-progress/guide-identifier-existence.md` §체크리스트 | 마무리 커밋에서 실제 상태로 체크 후 `complete/` 이동 준비 |
| 7 | 교차 관측 (requirement/dependency 공통) | 리뷰 도중 병렬 세션으로 추정되는 `guide-identifier-scan.ts` 일시적 뮤테이션(+`.bak`/`.bak2`)이 관측됐으나 재확인 시점엔 자체 원복돼 있었고 MD5 도 일치 — 이 세션이 만든 결함 아님 | `guide-identifier-scan.ts` (`collectEnvDeclarations`) | 조치 불요(이미 원복 확인). 후속 라운드에서 유사 순간적 diff 를 봐도 이 리뷰 결함으로 오인하지 말 것 |

## 해당 없음 / 문제 없음으로 확인된 항목

- **security**: 신규 코드는 저장소 내부 신뢰 파일만 동기 read 하는 순수 함수(정규식 + `Set` 연산). 네트워크·DB·인증/인가·인젝션 표면 없음. env 스캐너는 변수 *이름*만 수집, 값은 버림 — 시크릿 노출 경로 없음.
- **performance**: 실질 코드 델타는 변수 스코프 이동 + 합성 fixture 테스트 5건 추가뿐. 정규식은 선형(중첩 정량자 없음), 이전 라운드 WARNING(`composeTexts` 과다 스캔)은 이미 해소 유지.
- **side_effect**: 순수 함수 + 읽기 전용 파일시스템 접근만 존재. 전역 상태 변경·네트워크 호출·공개 인터페이스 파괴적 변경 없음. 이전 라운드 WARNING 2건(죽은 참조, `composeTexts` 과확장) 해소 재확인.
- **dependency**: `package.json`/lockfile 변경 0건. 신규 파일 import 는 Node 내장 + 기존 devDependency(`vitest`) + 저장소 내 기존 유틸(`tree-walk`, `impl-anchor-parse`)뿐.
- **database**: SQL/ORM/마이그레이션/트랜잭션/커넥션 관련 코드 전무. `POSTGRES_PASSWORD` 는 변수 이름 존재 확인 대상일 뿐 실제 DB 접속과 무관.
- **concurrency**: 전체 로직이 vitest 단일 프로세스 내 동기 실행. async/await·타이머·워커·락·공유 가변 전역 상태 없음.
- **api_contract**: 컨트롤러·라우터·DTO·응답 직렬화 등 API 계약에 해당하는 코드 없음.
- **user_guide_sync**: doc-sync-matrix 19개 trigger 전수 대조 결과 매칭 0건 — 변경 세트는 유저 가이드 콘텐츠/i18n/노드/통합/인증/실행 흐름 코드가 아니라 그것들을 검증하는 가드 테스트 하네스 자체이므로 매트릭스 대상 아님.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신뢰 파일 대상 순수 함수, 시크릿/인증/인젝션 표면 없음 |
| performance | NONE | 실질 델타는 스코프 이동+합성 테스트뿐, 정규식 선형 |
| architecture | LOW | `collectEnvDeclarations` 확장성 제약(INFO), 테스트 파일 다층위 누적(INFO) — 레이어 분리·OCP 는 양호 |
| requirement | LOW | 기능/엣지케이스/반환값 전부 정상(31/31 테스트). 유일 미해소는 SPEC-DRIFT(코드 결함 아님) |
| scope | LOW | 라운드2 fix 는 지적 1:1 결속. 스코프 이탈 없음. 무관 항목 2건은 이전 라운드에 이미 조치불요 처분 |
| side_effect | NONE | 순수 함수+읽기전용 I/O. 이전 WARNING 2건 해소 재확인 |
| maintainability | LOW | 정규식 반복 패턴(INFO), 설계근거 3중 복제(INFO) — 핵심 로직은 낮은 복잡도 유지 |
| testing | LOW | WARNING 1건(`UPPER_SNAKE` 약어제외 미검증, 뮤테이션 생존). 이전 라운드 WARNING 해소 확인, 31/31 GREEN |
| documentation | LOW | WARNING 1건(`.bak` 파일 잔존). plan 체크리스트 stale(INFO). 이전 라운드 결함 전부 해소 재확인 |
| dependency | NONE | 신규 의존성 0건, 이전 WARNING 2건(내부 참조) 해소 확인 |
| database | NONE | 해당 없음 |
| concurrency | NONE | 해당 없음 |
| api_contract | NONE | 해당 없음 |
| user_guide_sync | NONE | 매트릭스 trigger 매칭 0건 |

## 발견 없는 에이전트

database, concurrency, api_contract, user_guide_sync — 전부 "해당 없음" 판정(리뷰 대상 코드 성격상 검토 표면 자체가 없음).

## 권장 조치사항

1. **[WARNING #2]** 병합 전 `rm codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts.bak` 로 워크트리에 방치된 뮤테이션 백업 파일 제거.
2. **[WARNING #1]** `guide-identifier-existence.test.ts` 의 `scanIdentifierCitations — 축별 대조군`에 "밑줄 없는 대문자 약어는 안 집는다" 판별 fixture 를 추가해 `UPPER_SNAKE` 의 "약어 제외" 설계 결정을 뮤테이션으로 고정.
3. **[INFO #6]** 마무리 커밋에서 `plan/in-progress/guide-identifier-existence.md` 체크리스트 마지막 2항목을 실제 상태(수행 완료)로 갱신.
4. **[SPEC-DRIFT #1]** 후속 `project-planner` 턴에서 `spec/conventions/user-guide-evidence.md §2` 에 가드 3파일(신 파일명) 등재 — 이미 plan 백로그에 정확히 등재돼 있어 이번 PR 을 막을 사유는 아님.
5. **[INFO #1]** 3번째 env 선언처가 실제로 필요해지는 시점에 `collectEnvDeclarations` 를 `{label, pattern, texts}[]` 순회 형태로 일반화 검토(지금은 불요).

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용(prompt 상 `routing: skipped`). 전체 reviewer 14명 실행.
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명) — 전원 결과 확보됨(success, 전문 인라인 확인). 강제 화이트리스트 미이행 없음.
- **실행**: 전체 14명 — `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `dependency`, `database`, `concurrency`, `api_contract`, `user_guide_sync`
- **제외**: 없음 (router 미사용이므로 skip 대상 자체가 없음)
