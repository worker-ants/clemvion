# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. `documentation` reviewer 가 WARNING 2건(SoT 절 인용 오류, CHANGELOG 누락)을 제기했고, 나머지 13개 reviewer 는 전부 NONE(INFO 다수 또는 발견 없음). forced(router_safety) 8명(`dependency, documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | 신규 술어의 SoT 주석이 `spec-impl-evidence.md §3`("pending_plans row")을 가리키나, 실제 `pending_plans` 경로 제약("plan/in-progress/ 또는 plan/complete/ 에 실존 의무")은 §2.1 필드 정의 표에 있다. §3(상태 라이프사이클)에는 경로 제약을 정의하는 행이 없다. 같은 diff 에 포함된 consistency-check 산출물(`rationale_continuity.md`, `plan_coherence.md`, `SUMMARY.md`)은 정확히 §2.1 로 인용해 서로 어긋난다 | `spec-frontmatter-parse.ts:86`, `spec-frontmatter-parse.test.ts:79`, `spec-pending-plan-existence.test.ts:15`, `pending-plan-is-plan.md:19,88` | 5곳의 `§3` 인용을 `§2.1`로 정정 (`§4` 가드 인용은 정확하므로 유지) |
| 2 | 문서화 | 수 주간 비-plan 파일(`.sql` 마이그레이션)이 `pending_plans:` 가드를 통과하던 실제 사고를 고치는 CI 동작 변경 커밋(`c288c7aaf`)인데 `CHANGELOG.md` 항목이 없다. 같은 저장소는 동일 디렉터리에 새 가드를 추가할 때 "무엇이 뚫려 있었고 무엇을 새로 강제하는가"를 기록해 온 선례가 이미 다수 있다 | 커밋 `c288c7aaf` (`CHANGELOG.md` 변경 없음) | `CHANGELOG.md` Unreleased 에 사고 요약·처방(`isPendingPlanPath`)·회귀 위험(기존 27개 spec 항목 0건 위반 확인) 기록 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | "plan 위치 디렉터리" 지식이 신규 `PENDING_PLAN_DIRS`와 기존(미변경) `spec-pending-plan-existence.test.ts`의 `"/in-progress/"→"/complete/"` 문자열 치환 두 곳에 독립적으로 중복 존재 — 세 번째 plan 위치가 추가되면 한쪽만 갱신되고 다른 쪽이 조용히 낡을 수 있음 | `spec-frontmatter-parse.ts:95`, `spec-pending-plan-existence.test.ts:60` | 다음에 파일을 만질 기회에 resolve 체크를 `PENDING_PLAN_DIRS` 기반으로 파생시켜 두 지식을 합칠 것 |
| 2 | 요구사항 | 이번 PR 이 닫는 결함과 같은 클래스("존재 검사 ≠ plan 여부 검사")가 인접 가드 `spec-status-lifecycle.test.ts` guard (c)의 `partial→implemented` 승격 판정에는 아직 남아 있음 — `pending_plans`에 비-plan 경로가 실려도 "전부 완료"로 오판할 수 있음 | `spec-status-lifecycle.test.ts:54-63` (이번 diff 밖, 미변경) | 후속 트래커 항목으로 등재, guard (c)에도 `isPendingPlanPath` 선필터 적용 검토 |
| 3 | 테스트 | `isPendingPlanPath`가 비-string/undefined 입력(예: frontmatter 오타로 `pending_plans: 42`)에 방어가 없어 `path.posix.normalize`가 `TypeError`를 던져 테스트 스위트 전체가 unhandled throw 로 죽을 수 있음 | `spec-frontmatter-parse.ts:97-101` | `typeof relPath !== "string"` 가드 또는 최소 방어적 테스트(빈 문자열 입력) 1개 추가 |
| 4 | 테스트 | `plan/in-progress-archive/foo.md` 같은 "look-alike 디렉터리"(접두 문자열은 같지만 실제로는 다른 디렉터리)를 정확히 걸러내는지 직접 단언하는 테스트가 없음 — 이 정확성은 트레일링 슬래시 표기에 전적으로 의존하며, 향후 리팩터링 시 조용히 깨질 수 있음 | `spec-frontmatter-parse.test.ts` (`isPendingPlanPath` describe 블록) | `expect(isPendingPlanPath("plan/in-progress-archive/foo.md")).toBe(false)` 케이스 추가 |
| 5 | 유지보수성 | `isApplicable`과 `isPendingPlanPath`가 "배열 접두사 중 하나로 시작하는가"를 각자 인라인(`.some(...startsWith(...))`)으로 중복 구현 | `spec-frontmatter-parse.ts:77`, `:100` | 현재는 짧은 함수라 추출 비용 대비 이득 낮음 — 세 번째 유사 술어가 생기면 공용 헬퍼로 통합 고려 |
| 6 | 변경 범위(scope) | 핵심 수정과 무관한 별도 트래커 항목(`0-common.md` 6개의 `id: common` 중복, planner 위임 표시) 1건이 같은 커밋에 동봉됨 — 절차 위반은 아니나 기능 diff 와 관리성 diff 가 섞여 있음 | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 조치 불요(기록 목적) |
| 7 | 보안 | `fs.existsSync` 존재-오라클의 신뢰 경계는 PR 리뷰를 거쳐 저장소에 병합된 spec frontmatter(비-사용자 입력)이며, 이번 변경은 검증 표면을 "디스크의 아무 파일"에서 `plan/**.md`로 좁혀 오히려 개선 방향 | `spec-frontmatter-parse.ts:97-101`, `spec-pending-plan-existence.test.ts:56-65` | 조치 불요 |
| 8 | 요구사항 | 신규 "is a work plan" 단언과 기존 "path resolves" 단언의 역할 분담(전자=plan 형태, 후자=단순 존재)을 설명하는 주석이 없어 다음 편집자가 두 단언의 목적을 오해할 소지 | `spec-pending-plan-existence.test.ts` | "path resolves 는 존재만 보며 plan 여부는 위 단언이 전담한다" 주석 한 줄 추가 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신뢰 경계 유지(저장소 병합 콘텐츠), 시크릿/인젝션 없음, 검증 표면 오히려 축소 |
| performance | NONE | 신규 술어 O(1), 병목·N+1·캐싱 누락 없음 |
| architecture | NONE | 관례 일관, allow-list fail-closed 설계 양호. plan 디렉터리 지식 중복(INFO) |
| requirement | NONE | spec(§2.1/§4)과 line-level 정합, 68/68 테스트 재현. 인접 가드에 동일 클래스 갭 잔존(INFO) |
| scope | NONE | 핵심 3파일은 목적에 정확히 부합. 무관 트래커 항목 1건 동봉(INFO) |
| side_effect | NONE | 순수 함수, 전역상태·FS·네트워크·인터페이스 부작용 없음 |
| maintainability | NONE | 네이밍·주석·순환복잡도 양호. 접두사 매칭 패턴 중복(INFO) |
| testing | NONE | 68/68 PASS, 판별 뮤테이션 자체 수행. 비-string 입력 방어·look-alike 테스트 부재(INFO) |
| documentation | **LOW** | SoT 절 인용 오류(§3→§2.1, 5곳) + CHANGELOG 누락(WARNING 2건) |
| dependency | NONE | 신규 외부 의존성 없음, 내부 결합 추가 없음 |
| database | NONE | DB 관련 코드 없음 (해당 없음) |
| concurrency | NONE | 순수 동기 로직, 공유 상태·락·async 없음 (해당 없음) |
| api_contract | NONE | API 엔드포인트/DTO/라우트 변경 없음 (해당 없음) |
| user_guide_sync | NONE | 매트릭스 23개 trigger 전수 대조, 매칭 0건 (해당 없음) |

## 발견 없는 에이전트

- `side_effect` — 부작용 없음(전역 상태·FS·환경변수·네트워크·이벤트 콜백 8개 관점 전수 확인)
- `database` — DB 스키마/쿼리/ORM/마이그레이션 해당 없음
- `concurrency` — 비동기·공유자원·락 해당 없음
- `api_contract` — REST 엔드포인트/DTO/인증 해당 없음
- `user_guide_sync` — doc-sync-matrix 23개 trigger 매칭 0건

## 권장 조치사항

1. `documentation` WARNING 1: `spec-frontmatter-parse.ts:86`, `spec-frontmatter-parse.test.ts:79`, `spec-pending-plan-existence.test.ts:15`, `pending-plan-is-plan.md:19,88` 5곳의 SoT 인용을 `§3`에서 `§2.1`로 정정.
2. `documentation` WARNING 2: `CHANGELOG.md` Unreleased 섹션에 이번 가드 강화(사고 요약·처방·회귀 검증 결과) 항목 추가.
3. (선택, INFO) `testing` #3·#4: `isPendingPlanPath` 비-string 입력 방어 + look-alike 디렉터리 회귀 캐너리 테스트 추가.
4. (선택, INFO) `requirement` #2: `spec-status-lifecycle.test.ts` guard (c)의 동일 클래스 갭을 별도 후속 트래커 항목으로 등재.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용(사유 미기재, prompt 에 `routing_skip_reason` 없음). 전체 reviewer 14명 실행.
- **강제 포함(router_safety)**: `dependency, documentation, maintainability, requirement, scope, security, side_effect, testing` (8명) — 전원 결과 확보됨(누락 없음).
- **제외**: 없음(router 미사용이므로 전원 실행, skipped 목록 `(none)`).
