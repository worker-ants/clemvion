# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 은 없으나, `extractLinks()` 가 스스로 선언한 "양방향 안전성"(전부 링크로 오판하지 않음) 목표에 반하는 latent 결함이 requirement 리뷰에서 실측 재현됐다. 이 함수는 3개 build-차단 가드(`findBrokenLinks`/`findBrokenSpecLinksInSources`/`findBrokenPlanLinks`)의 핵심 판정 로직이라, 현재 라이브 트리엔 없어도 향후 무관한 문서 편집이 이 축을 우연히 건드리면 조용히 재발할 수 있다. forced whitelist(7개) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음(architecture/documentation 은 파일이 누락돼 있어 본 통합 과정에서 인라인 전문을 디스크에 영속화했다).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항/정확성 | `extractLinks()` 의 마스킹 매칭이 문단 경계(빈 줄)를 건너뛰는 텍스트를 실제 CommonMark 와 반대로 링크로 오판할 수 있다. JSDoc 이 "역방향(전부 링크로 오판)까지 잠갔다"고 선언했지만, `mdast-util-from-markdown`(이 파일이 헤딩 슬러그에 쓰는 그 파서)과 대조해 직접 재현: `[text\n\nsome other para](url)` 를 실제 파서는 링크로 보지 않는데 이 구현은 링크로 반환한다. 3개 build-차단 가드(`findBrokenLinks` 등)의 핵심 함수라 향후 무관한 문서 편집이 우연히 이 패턴을 만들면 build 를 조용히 막을 수 있다(latent, 현재 라이브 트리엔 미관측) | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:79`(`LINK_RE`), `:148-169`(`buildMaskedDoc`, 빈 줄이 코드펜스처럼 마스킹되지 않음) | 문단 경계(연속 빈 줄)를 코드펜스와 동일하게 마스킹하거나 `fromMarkdown` AST 순회로 전환. 최소한 "빈 줄로 분리된 문단은 링크가 아니다" 회귀 테스트를 추가 |
| 2 | 아키텍처 | 같은 파일 안에 정밀 CommonMark AST 파서(`headingSlugs`)와 부분 재구현 정규식 스캐너(`extractLinks`)가 공존하고, 이번 PR 은 후자를 계속 패치하는 방향으로 갔다. 이 불일치는 추상적 우려가 아니라 같은 PR 안에서 동일 결함 계열(손으로 짠 부분 파서가 CommonMark 엣지케이스를 놓침)이 2회 실증됐다(멀티라인 링크 미탐지 + plan 예시 문구가 스캐너를 깬 2차 사고) | `spec-links.ts:51-71`(`headingSlugs`, AST 기반) 대 `:148-203`(`buildMaskedDoc`/`lineForOffset`/`extractLinks`, 정규식 기반) | `headingSlugs` 와 대칭되는 `collectLinks`(AST 트리 순회)로 재작성 검토, 또는 최소 "왜 링크 추출만 정규식을 유지하는가" 근거를 JSDoc 에 명시 |
| 3 | 문서화 | `extractLinks()` 설계 근거를 설명하는 신규 장문 JSDoc 블록이 실제 함수 선언과 물리적으로 분리되어(중간에 `MaskedDoc`/`buildMaskedDoc`/`lineForOffset` 세 선언이 끼어들고, 함수 선언 바로 위는 빈 줄), IDE hover·`typedoc` 등에서 이 문서가 `extractLinks` 에 붙지 않는다 | `spec-links.ts:107-130`(JSDoc) 대 `:183`(`export function extractLinks`) | JSDoc 블록을 `extractLinks` 선언 바로 위로 이동 |
| 4 | 부작용 | 이 PR 이 "고쳤다"고 서술하는 바로 그 함정(인라인 코드 마스킹이 예시 문구를 진짜 링크로 재구성)이, 같은 커밋이 새로 커밋하는 리뷰 산출물 3곳(`RESOLUTION.md`/`SUMMARY.md`/`requirement.md`)에 펜스 없이 그대로 재인용되어 있다. 현재는 `review/**` 가 모든 링크 가드의 스캔 스코프 밖이라 안전함을 스코프 코드로 직접 확인했으나, 이는 우연한 배제에 의존하는 잠재 결함이며 이 PR 의 교훈과 정면으로 부딪힌다 | `review/code/2026/08/29/14_36_39/{RESOLUTION,SUMMARY,requirement}.md` | 즉시 조치 불요(현재 스코프 배제로 안전). 향후 관례로 예시 인용 시 3중 백틱 펜스 사용 권장, `collectGovernanceMarkdown` 근처에 "이 배제가 깨지면 위험한 파일들" 교차 참조 남기기 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 링크 타깃 경로 순회(`../..`) 미정규화 — 기존 로직, 이번 diff 범위 밖. 입력이 신뢰된 in-repo markdown 이라 실질 위험 없음 | `spec-links.ts` `findBrokenLinksInFiles` | 조치 불요(향후 외부 입력 스캔으로 확장 시 재검토) |
| 2 | 보안 | 신규 `LINK_RE`/마스킹 정규식은 중첩 정량자가 없어 ReDoS 위험 없음 | `spec-links.ts:82`(`LINK_RE`) | 조치 불요 |
| 3 | 보안 | 테스트 fixture 의 `mkdtempSync` 임시 디렉터리 사용은 TOCTOU/경합 위험 없이 안전 | `spec-links.test.ts` beforeAll/afterAll | 조치 불요 |
| 4 | 성능 | `MaskedDoc.srcLineOf` 배열 값이 인덱스+1 과 항상 동일해 목적 없는 할당 | `spec-links.ts:138,159,180` | 필드 제거하고 이진 탐색 결과에 `+1` 만 적용 |
| 5 | 성능 | 파일당 부가 배열/문자열 재조립으로 피크 메모리가 소폭 증가하나, 사전 필터 통과율(11.9%)과 실측(56ms)을 고려하면 허용 범위 | `buildMaskedDoc`/`extractLinks` | 조치 불요 |
| 6 | 성능 | 오프셋→줄 역산에 이진 탐색 도입, `regex.exec` 호출이 파일당 1회로 감소 — 정확성 수정의 부수 효과로 성능도 개선 | `spec-links.ts:172-181`(`lineForOffset`) | 조치 불요 |
| 7 | 아키텍처/유지보수성 | `MaskedDoc` 이 `startOf`/`srcLineOf` 두 병렬 배열로 줄 지도를 표현 — 직전 라운드에서 이미 트리아지되어 함수 분리로 완화됨으로 종결된 사안, 재확인만 | `spec-links.ts:132-139` | 조치 불요. 재편집 시 단일 배열 병합 고려 |
| 8 | 유지보수성 | 테스트 헬퍼 `writeDoc` 이 두 describe 블록에 문자 그대로 중복 정의됨(이번 diff 로 신규 발생) | `spec-links.test.ts:229,282` | 모듈 스코프 공유 헬퍼로 추출(우선순위 낮음) |
| 9 | 유지보수성 | `lineForOffset` 이진 탐색은 정확하나, 호출 패턴(오름차순 오프셋)상 전진 포인터로도 충분했을 자리 — 견고성 트레이드오프로 수용 가능 | `spec-links.ts:172-181` | 조치 불요 |
| 10 | 테스트 | `findBrokenSpecLinksInSources`/`findBrokenPlanLinks` 두 진입점은 멀티라인 픽스처로 통합 검증되지 않음(판별력 낮음, 우선순위 낮음) | `spec-links.test.ts` | 여유 시 `findBrokenPlanLinks` 에 멀티라인 DEAD 케이스 1건 추가 |
| 11 | 테스트 | `buildMaskedDoc`/`lineForOffset` 비공개(unexported)라 `extractLinks` 경유 간접 테스트만 가능 — 현재도 off-by-one 사각지대를 정확히 겨냥해 판별력 충분 | `spec-links.ts` ~148,172 | 조치 불요 |
| 12 | 검증 | RESOLUTION.md 의 "unit 6,213 passed, 신규 9건" 주장과 이전 라운드 Critical #1·Warning #2/#3/#5/#6 실제 반영 여부를 실측(테스트 실행, diff 대조)으로 교차 확인 완료 | 전체 diff, `_test_logs/unit-20260829-145321.log` | 조치 불요 |
| 13 | 범위 | `review/code/2026/08/29/14_36_39/**` 12개 파일이 같은 커밋에 포함된 것은 그 라운드가 지시한 조치를 그대로 수행한 결과이며 이 저장소의 표준 리뷰-즉시조치 워크플로에 부합, scope 위반 아님 | 커밋 `cf613bf89` | 조치 불요 |
| 14 | 범위 | 워크트리 슬러그(`eslint10-upgrade`)와 실제 작업 주제(spec-link 버그 수정) 불일치 — 직전 라운드에서 이미 지적된 기존 관찰이며 코드 diff 자체엔 eslint10 관련 변경 0건 | 워크트리 경로 | 조치 불요(중복 재지적 방지 목적 기록) |
| 15 | 부작용 | `extractLinks` 반환 계약(`MdLink.line`/`raw` 의미 확장)이 넓어졌으나, 외부 소비처(`plan-frontmatter.test.ts`, `spec-link-integrity.test.ts`) 와 호환됨을 확인 | `spec-links.ts` `MdLink`/`LinkViolation` | 조치 불요 |
| 16 | SPEC-FIDELITY | `spec/conventions/spec-impl-evidence.md` §4.2 는 링크 **탐지** 알고리즘(줄단위 vs 마스킹 전문)을 규정하지 않음 — spec 본문과의 직접 불일치는 아니며, 코드 자신의 JSDoc/테스트가 선언한 목표 대비 기능 갭 | `spec/conventions/spec-impl-evidence.md` §4.2 | spec 문서 수정 불요 |
| 17 | 사용자 가이드 동기화 | doc-sync-matrix 22개 trigger 매칭 0건 — 유저 대면 코드/문자열/노드/제공자 변경 없음 | 전체 diff | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 공격표면 사실상 없음(dev-time 가드), 기존 경로 순회 INFO 만 |
| performance | NONE | 정확성 수정의 부수 효과로 성능 오히려 개선, `srcLineOf` 불필요 할당 INFO |
| architecture | LOW | AST 정본 파서와 정규식 부분 재구현 스캐너 공존 — 동일 결함 계열 2회 재발(WARNING) |
| requirement | MEDIUM | `extractLinks` 가 문단 경계 텍스트를 링크로 오판 가능(latent, build-차단 가드 핵심 로직) |
| scope | NONE | 전 파일이 이 결함 수정 사이클과 직접 관련, 위반 없음 |
| side_effect | LOW | 리뷰 산출물에 위험 트리거 문자열 펜스 없이 3회 재인용(현재 스코프 배제로 안전) |
| maintainability | LOW | `writeDoc` 헬퍼 중복 등 사소 INFO 만 |
| testing | NONE | 신규 테스트 9건 탄탄(off-by-one·양방향 케이스 겨냥), INFO 만 |
| documentation | LOW | `extractLinks` JSDoc 이 함수 선언과 물리적으로 분리(WARNING) |
| user_guide_sync | NONE | doc-sync-matrix 매칭 0건, 해당 없음 |

## 발견 없는 에이전트

- user_guide_sync (매칭되는 doc-sync-matrix trigger 없음, 발견사항 명시적으로 "없음")

## 권장 조치사항

1. (requirement WARNING, 최우선) `extractLinks()` 가 문단 경계(빈 줄)로 분리된 텍스트를 링크로 오판하지 않도록 수정 — 빈 줄을 코드펜스와 동일하게 마스킹하거나 `fromMarkdown` AST 순회로 전환하고, "빈 줄로 분리된 문단은 링크가 아니다" 회귀 테스트를 추가한다. 이 함수는 3개 build-차단 가드의 핵심 판정 로직이므로 latent 상태로 방치하지 않는다.
2. (documentation WARNING) `extractLinks` 설계 근거 JSDoc 블록을 함수 선언(`:183`) 바로 위로 이동해 hover/typedoc 에서 정상 노출되도록 한다.
3. (architecture WARNING, 중기) `headingSlugs` 와 대칭되는 `collectLinks`(AST 순회) 로 `extractLinks` 재작성을 백로그에 등록하거나, 최소한 정규식 유지 근거를 JSDoc 에 명시한다.
4. (side_effect WARNING) 리뷰 산출물 등에 위험 트리거 문자열(마스킹 함정 예시)을 인용할 때 펜스 관례를 문서화하고, `review/**` 스코프 배제 불변식을 `collectGovernanceMarkdown` 주석 근처에 교차 참조로 남긴다.
5. (INFO, 여유 시) `writeDoc` 테스트 헬퍼 중복 제거, `MaskedDoc.srcLineOf` 불필요 필드 제거 등 사소 정리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync` (10명)
  - **제외**: 표 참조 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — forced 전원 결과 확보됨(architecture/documentation 은 인라인 전문만 있고 파일이 누락되어 본 통합 과정에서 디스크에 영속화함).

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터 판단(diff 범위에 의존성/패키지 변경 없음으로 판단) |
  | database | 라우터 판단(diff 범위에 DB/쿼리 변경 없음으로 판단) |
  | concurrency | 라우터 판단(diff 범위에 동시성/레이스 관련 코드 없음으로 판단) |
  | api_contract | 라우터 판단(diff 범위에 API 계약 변경 없음으로 판단) |
