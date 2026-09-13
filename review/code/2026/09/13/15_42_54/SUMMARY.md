# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 2건(SPEC-DRIFT 1건 + 테스트 판별 fixture 갭 1건) 모두 즉시 차단 사유는 아니며, 14개 reviewer(강제 포함 7명 전원 포함) 결과 전부 확보됨 — 누락된 forced reviewer 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/conventions/user-guide-evidence.md §2` 가 이 가드 가족(`guide-identifier-existence.test.ts`·`guide-identifier-scan.ts`·`guide-sanitized-message-parity.test.ts`)을 아직 등재하지 않았다 — 코드·구현·테스트는 실측으로 일관되게 검증되었고 spec 문서 갱신만 밀려 있다. | `spec/conventions/user-guide-evidence.md:68`(§2 표, 가드 3건만 열거) vs `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:4`(동일 문서를 SoT 로 자칭) | `developer` 는 `spec/` 쓰기 권한이 없고 자기-반증형 소정정 예외(자신이 쓴 예고 문장에만 열림)에도 해당하지 않는다. `project-planner` 가 다음 spec 턴에서 §2 표를 3→5건으로, §2.1 관계표에 2행 추가, frontmatter `code:` 목록에 3파일 추가, `## Rationale`에 "허용목록 없음" 원칙 번복 근거 반영. 초안이 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:3247`에 등재돼 있으므로 그대로 반영만 하면 됨. |
| 2 | 테스팅 | `code-field` 축(`CODE_FIELD` 정규식)의 키 이름 왼쪽 경계가 미검증 — `"code"`로 끝나는 임의의 키(예: `"statusCode"`, `"mycode"`)를 전부 오매칭할 수 있는데, 이 파일이 다른 두 축(`field-table`의 줄 단위 경계, `backtick`의 약어 제외)에는 적용한 "판별 fixture" 관례가 이 축에만 빠졌다. 뮤테이션(negative lookbehind 로 경계를 정확한 `code`로 좁힘)으로 실측한 결과 25/25 GREEN — 스위트가 이 경계를 전혀 겨누지 않음을 확인. | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:105`(`CODE_FIELD`), 대응 테스트 `guide-identifier-existence.test.ts:274-281` | `"statusCode": "X"`처럼 `code`로 끝나지만 정확히 `code`가 아닌 키는 `code-field` 축으로 잡히지 않는다는 음성 판별 fixture 1건 추가. 필요시 정규식에 왼쪽 경계(`(?<![A-Za-z])` 류) 추가. 오늘 코퍼스엔 해당 키가 없어 즉시 회귀는 아니며, 이 규칙 자체는 삭제된 구 파일(`guide-error-code-scan.ts`)에서 이어받은 기존 로직이라 이번 PR 의 신규 버그는 아님 — 다만 같은 파일이 다른 두 축에는 새 판별 fixture 를 추가하며 이 축만 그 일관성에서 빠졌다는 점에서 WARNING. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | `guide-identifier-scan.ts`(214줄) 가 세 이질적 책임(가이드 파싱 정규식군 / 큐레이션 외부 어휘 데이터 / 소스·인프라 기준집합 수집기)을 한 파일에 누적 — 외부 의존성 0(순수 함수)이라 오늘은 응집도 문제 없음 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 전체 | 지금 조치 불요. 축이 4개를 넘거나 허용목록이 상한(5)에 근접하면 axis-scanning/basis-collection 모듈 분리 검토 |
| 2 | 아키텍처 | 삭제된 구현(`guide-error-code-scan.ts`)의 정규식 리터럴을 회귀 fixture 로 손으로 복제 — 연결이 git 이력뿐, 자동 링크 없음 | `guide-identifier-existence.test.ts:182-190` | 현행 유지 가능. 주석에 삭제 커밋 SHA 를 박으면 향후 대조 비용 감소(선택) |
| 3 | 유지보수성 | 정규식 `lastIndex` 리셋 → `exec` 루프 → `Set`/배열 적재 패턴이 한 파일 안에서 4회 반복 | `guide-identifier-scan.ts:139-148,163-171,197-203,205-211` | 가드가 더 늘면 공유 `matchAll` 유틸 검토 |
| 4 | 유지보수성 | 설계 근거(`#1330` 축별 실측표, "허용목록 없음" 번복 서사)가 소스 헤더 주석·테스트 JSDoc·plan 문서 세 곳에 축약 없이 반복 | `guide-identifier-scan.ts:1-76`, `guide-identifier-existence.test.ts:18-27`, `plan/in-progress/guide-identifier-existence.md` §A~C | 다음 축·허용목록 변경 시 "코드 헤더가 SoT, 테스트 JSDoc·plan 은 참조만" 방향으로 점차 정리 권고 |
| 5 | 테스팅 | `field-table` 축(`FIELD_TABLE_NAME`)도 `name`이 객체 리터럴의 첫 프로퍼티일 때만 매칭 — 같은 경계 클래스지만 삭제된 구 파일에서 이어받은 기존 로직이라 이번 diff 의 신규 결함 아님 | `guide-identifier-scan.ts:102` | 즉시 조치 불요. 다음에 이 축을 손볼 때 스캐너 상단 한계 주석(53~76행)에 "특정 프로퍼티 순서에 결합됨" 한계 추가 검토 |
| 6 | 보안 | env/compose 선언처 수집기(`collectEnvDeclarations`)는 변수 **이름**만 수집하고 값은 정규식에 포함되지 않음 — 시크릿 노출 경로 아님 | `guide-identifier-scan.ts:192-214` | 조치 불요 |
| 7 | 프로세스 관측 | 리뷰 진행 중 병렬 세션으로 추정되는 일시적(미커밋) 뮤테이션이 `guide-identifier-scan.ts`의 `CODE_FIELD` 정규식에 관측됨(negative lookbehind 실험 추정) — 재확인 시 자체 원복되어 커밋 diff 에는 영향 없음. documentation·dependency·security 세 리뷰어가 독립적으로 동일 현상 관찰(공유 워크트리 동시 read 환경의 알려진 특성) | `guide-identifier-scan.ts` `CODE_FIELD` 정의 줄 | 조치 불요(이미 원복 확인). 다음 라운드 리뷰어가 유사한 순간적 diff 를 보더라도 본 PR 결함으로 오인하지 말 것 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | ReDoS/시크릿 노출/경로 탐색 벡터 없음. 외부 입력·인증·암호화 표면 자체가 없음 |
| performance | NONE | 라운드 3 이후 코드 변경 없음(테스트 12줄 추가뿐). 정규식 전부 선형, 과거 WARNING(과다 YAML 스캔) 해소 유지 |
| architecture | LOW | SOLID 관점 건실. 한 파일의 3축 누적(INFO), 구 정규식 수작업 복제(INFO) |
| requirement | LOW | 기능 완전성 충족. [SPEC-DRIFT] user-guide-evidence.md §2 미등재(WARNING, 이미 plan 등재됨) |
| scope | LOW | 라운드 3 이후 델타가 직전 WARNING에 1:1 결속, 스코프 이탈 없음 |
| side_effect | NONE | 순수 함수 + 읽기 전용 I/O만. 과거 WARNING 2건(죽은 참조, compose 과다 스캔) 해소 유지 |
| maintainability | LOW | 핵심 로직 SRP·저복잡도 양호. 정규식 반복 패턴·설계 근거 삼중 복제(INFO) |
| testing | LOW | `code-field` 축 판별 fixture 누락(WARNING), `field-table` 축 동일 클래스 기존 로직(INFO) |
| documentation | LOW | 이전 3라운드 지적 전부 해소 확인. SPEC-DRIFT 는 developer 권한 밖으로 이미 위임 완료 |
| dependency | NONE | 신규 외부 패키지/lockfile 변경 0건. 내부 sibling 참조 정합 |
| database | NONE | SQL/ORM/마이그레이션/트랜잭션 관련 코드 없음 |
| concurrency | NONE | 단일 스레드 동기 실행, async/lock/race 표면 없음 |
| api_contract | NONE | 컨트롤러/DTO/응답 스키마 등 API 계약 코드 변경 없음 |
| user_guide_sync | NONE | doc-sync-matrix 21개 trigger 전수 대조 — 매칭 0건(가이드 자체가 아니라 가이드 검증 harness 변경) |

## 발견 없는 에이전트

database, concurrency, api_contract, user_guide_sync

## 권장 조치사항

1. (WARNING #2, 우선) `code-field` 축(`CODE_FIELD`)에 "`code`로 끝나지만 정확히 `code`가 아닌 키는 오매칭되지 않는다"는 음성 판별 fixture 를 추가하고, 필요시 정규식에 왼쪽 경계를 넣어 실제 동작과 테스트 의도를 맞춘다. 오늘 코퍼스에 즉각 회귀는 없으므로 이 PR 을 막을 사유는 아니나, 다음 축 변경 이전에 반영 권장.
2. (SPEC-DRIFT #1) `project-planner` 가 다음 spec 턴에서 `spec/conventions/user-guide-evidence.md §2` 표/관계표/frontmatter/Rationale 을 이 가드 가족(5건 기준)으로 갱신한다 — 초안은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 있으므로 반영 작업만 남음. `developer` 가 직접 고칠 수 없는 항목이므로 코드 쪽 조치는 불필요.
3. (선택, INFO 누적) 이 폴더에 가드가 더 늘어날 경우를 대비해 `guide-identifier-scan.ts` 의 정규식 수집 뼈대(4회 반복) 공유 유틸화와, 세 축(파일-헤더/JSDoc/plan)에 흩어진 설계 근거 서술의 단일화(코드 헤더를 SoT 로)를 다음 설계 변경 시점에 함께 검토.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용, 전체 14개 reviewer 실행됨(security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync).
- **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(누락 없음, 전문 인라인 제공).
- **제외**: 없음(전체 실행).