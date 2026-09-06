# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 발견 없음. 실유출(User 전 컬럼 노출) 수정과 3축 검출 가드 신설은 건실하나, 이번 fix 가 닫으려던 것과 **같은 실패 형태**(YAML `code:` 항목의 조용한 유실)가 "트레일링 인라인 주석" 형태로 재발 가능하다는 WARNING 이 두 reviewer(maintainability·testing)에서 독립적으로 확인됐고, 브랜치 스코프가 3단(애플리케이션 보안→리뷰 하네스→spec 문서)으로 연쇄 확장됐다는 WARNING 도 있다. forced(router_safety) 화이트리스트 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability/testing | `_parse_frontmatter_code` 의 신설 skip 로직이 "줄 전체 주석·빈 줄"만 건너뛰고, glob 항목과 **같은 줄에 붙는 트레일링 `# comment`**(`- codebase/backend/a.ts  # 비고`, 단일값 형태 `code: a.ts  # 비고`도 동일)는 여전히 값 전체로 캡처되어 어떤 파일과도 매치되지 않는 죽은 glob 이 된다. 이번 PR이 막으려던 것과 정확히 같은 실패 형태(entry 조용한 유실, 게이트가 안 무는 쪽이 기본값)가 재발 가능하며 회귀 테스트도 없다. 두 reviewer가 각각 정규식 실행(`re.match(...).group(1)`)으로 직접 재현·확인했다. 현재 저장소 `spec/**/*.md` 에 이 형태 실사용례는 0건. | `.claude/hooks/_lib/review_guard.py` `_parse_frontmatter_code` (block-list 분기 + `elif rest:` 단일값 분기) | `mm.group(1)`/단일값 `rest` 를 `_clean()` 에 넘기기 전, 따옴표로 감싸이지 않은 값에 한해 ` #` 이후를 잘라내는 정규화 추가(YAML/`gray-matter` 표준과 동일 규칙). `code:\n  - a.ts  # note\n  - b.ts` 및 `code: a.ts  # note` 형태 회귀 테스트 각 1건 추가 |
| 2 | architecture | spec frontmatter `code:` 파서가 Python(hooks)과 TypeScript(frontend `gray-matter`) 양쪽에 독립 구현되어 있고, 이번 diff 는 그 발산이 41개 entry 유실을 낸 뒤의 증상 패치일 뿐 — "빈 줄·주석 건너뛰기" 한 형태만 닫혔고 구조적 SSOT 부재(같은 YAML 을 두 언어가 각자 재구현)는 그대로 남아 위 WARNING #1 같은 재발이 언제든 가능 | `.claude/hooks/_lib/review_guard.py:637-658` vs `codebase/frontend/src/lib/docs/registry.ts:211,313` | 두 파서가 공유하는 golden fixture 코퍼스(주석·빈 줄·트레일링 주석·중첩 등)를 두 언어 테스트가 함께 참조해 "같은 입력→같은 출력"을 계약으로 명시 |
| 3 | scope | `dto-jsdoc-citation-guard.ts` 신설은 "User 엔티티 컬럼 노출 방어"라는 브랜치 원목표와 별개 관심사(DTO JSDoc 경유 리뷰 산출물 경로 유출 방지)이며, 판정 대상·방어 원리가 다른 독립 신규 기능이 같은 브랜치에 포함됨. spec 문서(`review-citations.md`, `spec-impl-evidence.md`) 정정까지 연쇄 유발 | `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts`, `dto-jsdoc-citation.spec.ts`, 커밋 `4529812c6` | 기능은 건실하고 충분히 disclose 됨 — 되돌릴 필요는 없으나, 향후 유사 상황은 별도 브랜치로 분리해 리뷰 단위를 좁힐 것 |
| 4 | scope | 리뷰 하네스(`review_guard.py` frontmatter 파서) 버그 수정이 애플리케이션 기능 브랜치에 섞여 들어감 — "User 컬럼 방어"와 무관한 개발 도구 인프라 계층 변경. 발단은 WARNING #3(신규 가드의 spec 등재용 인라인 YAML 주석)이 유발한 2차 파생 | `.claude/hooks/_lib/review_guard.py:640-651`, `.claude/tests/test_review_guard.py:329-374`, 커밋 `8b67300b5` | 커밋이 이미 애플리케이션 커밋과 분리되어 있어 이력 추적은 용이 — 병합 시 별도 cherry-pick/리뷰 고려 가능(현재 기능상 문제 없음) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability/documentation | `_parse_frontmatter_code` 최상단 docstring 이 이번에 추가된 "빈 줄·`#` 주석 건너뛰기" 동작을 요약하지 않음(설명은 함수 본문 인라인 주석에만 있음) | `.claude/hooks/_lib/review_guard.py:601-604` | docstring에 한 줄 추가: block-list 항목이 빈 줄·주석과 섞여도 안전하다는 계약 명시 |
| 2 | requirement | `findByWorkflow` 헤더 주석(119행)이 이 PR 이 재정의한 `WorkflowVersionListItem` 타입(`creator`/`workflow` 도 이제 투영된 형태로 좁혀짐)을 반영 못해 이전 형태("snapshot만 제외")를 그대로 인용 — 기능 영향 없음, 순수 주석-구현 괴리 | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:119` | 주석을 현재 `WorkflowVersionListItem` 정의로 갱신하거나 타입 정의를 SoT 로 참조만 하도록 축약 |
| 3 | architecture | `findByWorkflow`/`findOne` 의 `select` 객체 중 `creator`(이번 PR 이 `CREATOR_PROJECTION` 으로 상수화)를 제외한 나머지 6개 공유 키는 여전히 두 곳에 손으로 중복 나열됨 — 이번 PR 이 고친 결함 클래스(자매 메서드 중 하나만 투영을 가짐)가 축소된 범위로 남음 | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:126-134, 152-161` | 공유 6개 키를 `BASE_VERSION_SELECT` 상수로 추출 후 스프레드로 조립 |
| 4 | architecture/api_contract | `WorkflowVersionDetail` 타입명이 FE/BE 에 독립 정의(손 미러)되어 있고 필드 형태가 이미 갈려 있음(BE: creator 3필드 고정, FE: 전부 옵셔널) — 이름 동일성이 3라운드 연속 "유일 정의" 오판을 유발한 이력을 저자가 코드 주석으로 disclose, 이번 PR 범위 밖으로 명시 이관 | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:61-64` vs `codebase/frontend/src/lib/api/workflows.ts:109` | (후속) 타입 개명 또는 OpenAPI 파생 공유 타입 패키지로 이관 |
| 5 | security | `WorkspacesService.listMembers` 는 DB 레벨 투영이 아니라 애플리케이션 코드의 수동 필드 선택(`User` 전체 로드 후 email/name만 재구성)에 의존 — `WorkflowVersionsService` 와 달리 이름 기반 e2e(`expectNoUserSecrets`)가 유일한 안전망. 기존 상태이며 문서에도 disclose됨 | `codebase/backend/src/modules/workspaces/workspaces.service.ts` (`listMembers`) | (장기) DB 레벨 `select` 투영으로 전환해 해당 엔드포인트 클래스 전체를 같은 방어 강도로 통일 |
| 6 | security | DTO JSDoc 인용 가드의 강제 범위가 응답 DTO(`dto/responses/**`)로 한정되고 컨트롤러 JSDoc 축은 사람 리뷰에 의존 — spec 이 스스로 이 경계를 명시 | `spec/conventions/review-citations.md` §3 | 조치 불요(축 단위로 정확히 scoping되어 기록됨) |
| 7 | side_effect | `review_guard.py` 파서 변경의 블라스트 반경이 이 PR 이 건드리지 않은 다른 7개 spec 문서의 `code:` 판정(41개 entry)까지 넓혀, 향후 그 파일들을 만지는 무관한 PR 들의 게이트 동작에 영향을 줌 — 의도된 강화 방향(더 엄격해짐)이며 회귀 테스트 완비, 위험도 낮음 | `.claude/hooks/_lib/review_guard.py:637-658` (`_spec_code_patterns` 경유 spec 전체 순회) | 조치 불요 — 이후 "무관한 spec 파일이 갑자기 spec-linked 로 걸린다"는 보고 시 이 커밋을 원인으로 우선 의심 |
| 8 | requirement | 신설 회귀 테스트 3건이 "block-list 첫 줄이 바로 주석인" 경계(다음 줄이 아니라 시작부터 주석)는 별도로 커버하지 않음(로직상 안전함은 직접 실행해 확인) | `.claude/tests/test_review_guard.py:329-374` | (선택) `code:\n  # 주석\n  - a.ts\n` 형태 테스트 1건 추가 |
| 9 | testing | `enclosingName` 의 `'<module>'` 폴백 분기가 여전히 어떤 fixture 로도 실행되지 않음 — 이전 라운드(`13_39_20`)가 이미 조치 불요로 처분, 이번 라운드는 재확인만 | `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` (`enclosingName`) | 이 가드를 다음에 만질 때 함께 채우면 분기 커버리지 완결(즉시 조치 불요) |

## 관측 사항 (코드 결함 아님)

리뷰 도중 security·api_contract 두 reviewer 가 `.claude/hooks/_lib/review_guard.py` 가 `git status` 상 일시적으로 수정된 상태(신설 skip 로직 5줄이 빠진 이전 형태)로 관측됐다고 각자 독립적으로 보고했다. 원인은 testing reviewer 가 같은 파일에 대해 뮤테이션 검증(신설 skip 로직 제거→RED 확인→`git show HEAD:...` 로 원본을 스크래치에 떠서 `cp` 복원)을 수행한 것과 시간대가 일치한다 — testing reviewer 스스로 이 절차를 로그로 남겼고, 최종 `git status`/`git diff`/`pytest 40/40` 으로 무결 복원을 확인했다. 병렬 fan-out reviewer 간 일시적 레이스이며 실제 저장소에 잔여 diff 는 없다.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `WorkflowVersionsService` 실유출 수정 확인(긍정), `listMembers` 수동 필드선택 잔여 구조 리스크(INFO), JSDoc 가드 scoping 명시(INFO) |
| architecture | LOW | 파서 이원구현 SSOT 부재(WARNING), FE/BE 타입명 충돌(INFO), select 중복(INFO) |
| requirement | LOW | 핵심 요구사항 전부 구현·테스트 확인, stale 주석 1건(INFO), 테스트 경계케이스 갭(INFO) |
| scope | LOW | 3단 연쇄 범위 확장(WARNING 2건) — 절차 준수·은폐 없음, 핵심 산출물은 원 목표에 정확히 대응 |
| side_effect | LOW | 파서 변경의 PR-외 블라스트 반경(INFO), 나머지 공개 시그니처 변경 호출자 영향 없음 확인 |
| maintainability | LOW | 트레일링 주석 파싱 갭 재발(WARNING), docstring 갱신 누락(INFO) |
| testing | LOW | 동일 트레일링 주석 갭을 뮤테이션으로 직접 재현·확인(WARNING), 회귀 테스트 40/40 통과 |
| documentation | NONE | docstring 사소 INFO 1건 외 결함 없음, 과거 라운드 지적 전항목 해소 재확인 |
| api_contract | LOW | 계약 좁힘은 정합화(breaking 아님), FE 타입 잔존 이슈는 architecture 와 중복(INFO) |
| user_guide_sync | NONE | 매트릭스 21행 중 1건만 매칭, UI 미노출로 문서 갱신 불요 |

## 발견 없는 에이전트

없음 — 전 에이전트가 최소 INFO 이상을 보고했다(대부분 확인/긍정 성격이며 실질 Critical/추가 조치 필요 결함은 위 WARNING 4건에 집중됨).

## 권장 조치사항

1. `_parse_frontmatter_code` 에 트레일링 `# comment` 스트립 정규화를 추가하고, block-list·단일값 두 형태의 회귀 테스트를 추가한다 — 이번 PR 이 막으려던 것과 동일한 실패 형태(entry 조용한 유실)의 재발 경로이므로 최우선.
2. Python/TS 양쪽 `code:` 파서가 공유 golden fixture 코퍼스를 참조하도록 계약화해, 향후 다른 YAML 형태(앵커·여러 줄 문자열 등)에서의 발산을 사전에 잡는다.
3. `_parse_frontmatter_code` docstring 을 새 skip 동작에 맞춰 갱신한다.
4. `workflow-versions.service.ts:119` 의 stale 헤더 주석을 현재 `WorkflowVersionListItem` 정의에 맞게 정정한다.
5. (선택) `findByWorkflow`/`findOne` 의 공유 select 6키를 `BASE_VERSION_SELECT` 상수로 추출한다.
6. (후속, 범위 밖) `WorkflowVersionDetail` FE/BE 타입명 충돌을 개명 또는 공유 타입 패키지화로 해소한다.
7. 향후 유사 확장(별개 관심사의 가드·하네스 수정)은 가능하면 별도 브랜치로 분리해 리뷰 단위를 좁힌다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — **전원 결과 확보됨**(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 (프롬프트에 상세 사유 미포함 — diff 가 정적 스캔/투영 좁히기 위주로 성능 영향 저관련 판단 추정) |
  | dependency | 라우터 판단 (신규 외부 의존성 추가 없음 추정) |
  | database | 라우터 판단 (스키마 변경 없음, DB 쿼리 select 축소만 존재 — 별도 위험도 낮음 추정) |
  | concurrency | 라우터 판단 (동시성 관련 코드 변경 없음 추정) |