# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 3건(그중 1건은 `[SPEC-DRIFT]` — developer 권한 밖, 이미 plan 등재·10회 독립 재확인된 선재 갭이며 이번 PR 이 만든 결함 아님). forced 화이트리스트 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 강제 목록 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `[SPEC-DRIFT]` `user-guide-evidence.md` §2 "Build-time 가드 (3건)" 표가 이 가드 가족의 실제 구성원(`guide-identifier-existence.test.ts`, 구 `guide-error-code-existence`; `guide-sanitized-message-parity.test.ts`)을 반영하지 못함. 이번 PR 이 새로 만든 갭이 아니라 `#1330`부터 있던 선재 결함이며, `plan/in-progress/guide-identifier-existence.md` §D 에 planner 등재 항목(파일명·스코프·Rationale 초안 포함)으로 이미 기록돼 7라운드 연속(통산 10회) 독립 재확인됨. `developer` 는 `spec/` 쓰기 권한이 없고 자기-반증형 소정정 예외(조건 1: developer 자신이 그 문장을 씀)도 적용 안 됨 | `spec/conventions/user-guide-evidence.md:68,72-76`(표 본문), `:155` | 코드 변경 불요(유지). 다음 `project-planner` 턴에서 §2 표에 두 가드 행 추가하고 "3건"→"5건"(또는 해당 시점 실제 건수)으로 정정 — 이미 plan 초안 존재, 새 등재 불필요 |
| 2 | 유지보수성 | `guide-identifier-scan.ts` 360줄 중 260줄(72%)이 "현재 계약"이 아니라 라운드 5~7 리뷰 이력의 연대기(첫 판→지금 대조표)로, 핵심 정보(현재 패턴·경계 규칙)가 그 서사에 파묻힘. 같은 내용이 `plan/in-progress/guide-identifier-existence.md`·`RESOLUTION.md`에도 이미 있어 이중화됨 | `guide-identifier-scan.ts:1-120, 135-221` | 각 정규식 JSDoc 을 "현재 계약 + 근거 한 문장 + plan 문서 참조" 수준으로 압축, 라운드별 대조표는 plan 문서로 이관 |
| 3 | 유지보수성 | 소스 주석이 비영속 산출물인 `review/code/<타임스탬프>/...` 세션 경로를 15곳(스캐너 6곳 + 테스트 9곳)에서 근거로 인용. 프로젝트 규약상 `review/**` 는 SoT 아니며 정리·이관되면 소스에 박힌 이 경로들은 검증 불가능한 죽은 링크가 됨 | `guide-identifier-scan.ts:85,148,167,172,204,327`; `guide-identifier-existence.test.ts:100,133,160,234,249,260,324,422,495` | PR/이슈 번호나 커밋 SHA 앵커로 교체하거나, plan 문서 하나로 인용을 수렴 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | `FIELD_TABLE_NAME` 정규식이 같은 줄 안에서 `name:` 앞에 닫힌 중첩 객체가 있으면 매치를 놓침(직접 재현 확인). 오늘 코퍼스엔 이 형태 없음 | `guide-identifier-scan.ts:152-155` | 조치 불요(저위험). 다음 축 손볼 때 한계 주석에 추가 |
| 2 | 테스트 | `readIfPresent` 의 "파일 부재" 분기가 어느 테스트에서도 실행되지 않음(`.env.example` 이 항상 존재). vacuity floor 가 간접적으로 RED 를 내지만 원인 구분(파일부재 vs 수집기 깨짐) 안 됨 | `guide-identifier-existence.test.ts` `readIfPresent` | 우선순위 낮음. 필요시 부재-분기 단위 테스트 1줄 추가 |
| 3 | 테스트 | `CODE_FIELD` 축 대조군이 따옴표 값만 검증 — 값이 따옴표 없는 형태(예: ``code: MADE_UP_CODE``, 백틱 밖)는 완전 미탐지. 오늘 코퍼스엔 없는 형태 | `guide-identifier-scan.ts` `CODE_FIELD` 정의 | 조치 불요. 다음 축 손볼 때 한계 주석/대조군 추가 고려 |
| 4 | 테스트 | `GUIDE_EXTERNAL_VOCABULARY` 항목별 검증 테스트가 현재 원소 1개(`MESSAGE_CREATE`)로만 실행돼 "항목 단위 개별 실패" 를 실제로 관측한 적 없음 | `guide-identifier-existence.test.ts` "각 항목이 외부 시스템과 사유를 밝힌다" | 조치 불요. 두 번째 항목 추가 시 자연히 검증됨 |
| 5 | 테스트 | `lastIndex = 0` 리셋 보일러플레이트가 4곳에 손복제, 리셋 누락 자체를 겨냥한 회귀 테스트 없음(라운드 5 에서 공유 헬퍼 리팩터로 defer 결정된 항목의 재확인) | `guide-identifier-scan.ts` — `scanIdentifierCitations`(2회)·`collectSourceTokens`(1회)·`BACKTICK_INNER` 사용부(1회) | 조치 불요(이미 defer). 공유 헬퍼 리팩터 시 "재호출도 처음부터 스캔" 테스트 1회 추가로 4곳 일괄 해소 |
| 6 | 스코프 | 공유 트래커 `spec-draft-nullable-notation-followups.md` 에 이번 작업과 무관한 새 백로그 항목(`cafe24-api-metadata.md §4` 오인용) 1건 등재 — `--impl-prep` 도중 발견해 관례대로 즉시 등재한 것(선재, 무관, 재확인) | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 조치 불요 — 관례 준수 |
| 7 | 스코프 | 가드 파일 교체가 `git mv` 대신 delete+create 로 이뤄져 `git log --follow` 이력이 끊김(`--find-renames=25%` 로도 재인식 안 됨, 6라운드 이상 확인·수용) | `guide-error-code-*`(삭제) → `guide-identifier-*`(신규) | 조치 불요(되돌리는 비용 > 이익) |
| 8 | 스코프 | `review/code/**`·`review/consistency/**` 산출물 약 177개 파일이 changeset 대다수를 차지 — 이 저장소의 표준 review-fix 워크플로(상시 승인된 강제 의무) 산출물로 정상 | `review/code/2026/09/13/**`, `review/consistency/2026/09/13/**` | 조치 불요 |
| 9 | 부작용 | `composeTexts` 의 루트 파일 스캔 필터가 과거(라운드 1) 지적대로 `/^docker-compose.*\.ya?ml$/` 로 이미 좁혀져 있음을 재확인(회귀 없음) | `guide-identifier-existence.test.ts:55-58` | 조치 불요 |
| 10 | 부작용 | 모듈 스코프(top-level) 동기 파일읽기는 vitest 프로세스 내부에서만 실행되는 읽기 전용 초기화로, 삭제된 자매 가드에도 동일 패턴 존재 — 부작용 아님 | `guide-identifier-existence.test.ts:28-37` 및 `describe` 최상단 | 조치 불요 |
| 11 | 부작용 | 삭제된 `guide-error-code-scan.ts` export 를 참조하는 외부 호출자 없음(grep 확인) — 시그니처 전면 교체가 깨뜨리는 소비자 없음 | `guide-error-code-scan.ts`(삭제) → `guide-identifier-scan.ts`(신규) | 조치 불요 |
| 12 | 부작용 | 신규 export `collectEnvDeclarations` 등 3개 함수 모두 순수 함수(입력 변경·전역 접근·I/O 없음) | `guide-identifier-scan.ts` | 조치 불요 |
| 13 | 유지보수성 | 3축(field-table/code-field/backtick)+허용목록+정규식 5개가 한 파일에 집중된 것은 라운드 2 RESOLUTION 이 "형제 가드와 같은 관례"로 이미 분리 유예 판정(재확인, 새 근거 없음) | `guide-identifier-scan.ts` 전체 | 조치 불요(기존 결정 유지) |
| 14 | 유지보수성 | 네이밍(`scanXxx`/`collectXxx`)·파일 분리(`-scan.ts`/`.test.ts`)·매직넘버 명명 상수화(`EXTERNAL_VOCABULARY_CAP`) 등 구조 일관성 양호 | `guide-identifier-scan.ts`, `guide-identifier-existence.test.ts` 전체 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 순수 정적 텍스트 스캐너(내부 신뢰 경로만 동기 읽기), 인젝션·ReDoS·시크릿·인증 이슈 없음, 신규 외부 의존성 없음 |
| requirement | LOW | 46/46 vitest 직접 실행 통과. SPEC-DRIFT 재확인(§2 표 미갱신) 1건, `FIELD_TABLE_NAME` 중첩객체 엣지케이스 1건(INFO) |
| scope | LOW | 이번 라운드 코드 변경은 직전 라운드 CRITICAL/WARNING 에만 좁게 대응. 무관 백로그 등재·rename 이력 단절 등 선재 확인 사항 3건(INFO) 재확인 |
| side_effect | NONE | 전역상태/파일쓰기/네트워크 없음. 과거 지적된 넓은 파일스캔 필터는 이미 좁혀짐(회귀 없음) |
| maintainability | LOW | 핵심 로직(~100줄)은 문제 없음. 주석이 파일의 72% 차지하며 그 다수가 리뷰 이력 서사(WARNING), 비영속 review 경로 15회 인용(WARNING) |
| testing | NONE | 46/46 GREEN 직접 실측. 7라운드 뮤테이션 테스트로 수렴, 남은 갭은 전부 코퍼스 미출현 형태의 INFO |
| documentation | NONE | CHANGELOG/PROJECT.md/plan 서술이 최신 코드와 일치. SPEC-DRIFT 항목은 이미 등재·조치 불요로 재확인 |

## 발견 없는 에이전트

해당 없음 — 전원 최소 1건 이상 기록(대부분 조치 불요/재확인 성격의 INFO). CRITICAL 을 낸 에이전트는 없음.

## 권장 조치사항

1. (가장 중요) 다음 `project-planner` 턴에서 `spec/conventions/user-guide-evidence.md` §2 "Build-time 가드" 표를 실제 가드 구성(`guide-identifier-existence.test.ts`, `guide-sanitized-message-parity.test.ts` 포함)에 맞춰 갱신 — `plan/in-progress/guide-identifier-existence.md` §D 의 기존 초안을 그대로 집행하면 됨. 코드 revert 불필요.
2. (선택, 저비용) 다음에 `guide-identifier-scan.ts`/`guide-identifier-existence.test.ts` 를 재작성할 기회가 있을 때, 리뷰 이력 서사를 JSDoc 밖(plan 문서)으로 옮기고 소스 내 `review/code/<타임스탬프>/` 경로 인용을 PR/이슈/커밋 SHA 앵커로 교체.
3. 나머지 INFO(엣지 케이스 미검증, `lastIndex` 보일러플레이트, 스코프 재확인 사항 등)는 전부 코퍼스에 아직 나타나지 않았거나 이미 defer 처분된 항목 — 즉시 조치 불필요, 관련 축을 다음에 손볼 때 함께 처리.

## 라우터 결정

- `routing=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명, 전원 forced 이자 forced 전원 결과 확보됨)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명 — 실행 목록과 동일, 전원 성공)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(정적 텍스트 스캐너·CI 전용) 와 관련성 낮음 |
  | architecture | router 판단상 관련성 낮음(파일 내부 리팩터, 아키텍처 경계 변경 없음) |
  | dependency | router 판단상 관련성 낮음(신규 외부 의존성 0건) |
  | database | router 판단상 관련성 없음(DB 접근 코드 없음) |
  | concurrency | router 판단상 관련성 없음(동시성 로직 없음) |
  | api_contract | router 판단상 관련성 없음(API 계약 변경 없음) |
  | user_guide_sync | router 판단상 관련성 낮음(가이드 콘텐츠 자체는 미변경, 가드만 변경) |