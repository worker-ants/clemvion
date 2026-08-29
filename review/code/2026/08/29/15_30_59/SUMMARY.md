# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 발견 없음. 이번 diff(`extractLinks()` 멀티라인 링크 매칭 수정)의 핵심 로직은 3라운드에 걸쳐 지적된 결함이 모두 실측(vitest 재실행 175/19/194건 GREEN, CommonMark 파서 대조, 격리 입력 뮤테이션 프로브)으로 해소됐음이 확인됐다. 남은 WARNING 5건은 전부 문서/테스트 정합성 성격(plan 서술 불일치, 과거 리뷰 산출물 내 잔존 함정 문자열, 분기를 못 가르는 테스트 fixture, JSDoc 교차 참조 stale, plan 문서 백틱 렌더링 결함)이며 라이브 버그나 런타임 영향은 없다. forced(router_safety) 7개 reviewer 전원 결과 확보 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | plan 요약의 "남는 이유는 이제 **둘**" 재계산이 같은 목록 안에서 취소선 없이 남은 "병렬 fan-out" 불릿(실제로는 이미 `[x]` 완료 상태, origin/main 시점부터 그랬음)과 모순 — "plan 서술은 철회로 거짓이 될 수 있다" 패턴의 3번째 재발 | `plan/in-progress/harness-review-gate-followups.md:25`(둘 서술), `:35`(unstruck 병렬 fan-out 불릿) | "병렬 fan-out" 불릿도 취소선 처리하고 "→ 해소(날짜)" 표기, 또는 별도 트랙이라면 그 근거를 명시해 숫자와 불릿 개수를 일치시킨다 |
| 2 | side_effect | 이 PR 이 스스로 두 차례(라운드1 Critical, 라운드2 Warning) 겪은 "인라인 코드 마스킹이 예시 문구를 진짜 링크로 만드는" 함정 문자열이, 같은 diff 로 커밋되는 과거 리뷰 산출물 안에 펜스 없이 여전히 여러 곳 남아 있음. 현재는 4개 공개 스캔 진입점이 전부 `review/**` 를 스캔 대상에서 제외해 안전하나, 이 배제는 문서화된 교차 참조가 없는 암묵적 의존 | `review/code/2026/08/29/14_36_39/RESOLUTION.md:19`, `SUMMARY.md:10`, `requirement.md:18,68`; `15_01_34/requirement.md` 상단 | `collectGovernanceMarkdown` 근처 주석에 "이 배제가 깨지면 `review/**` 안 과거 산출물이 위험하다"는 교차 참조 한 줄 추가 (즉시 차단 사유 아님 — 과거 라운드가 이미 "역사적 기록 보존"으로 처분) |
| 3 | testing | "코드펜스를 사이에 둔 `[`/`](` 는 링크가 아니다" 테스트가 실제로는 같은 입력에 섞인 **빈 줄 마스킹**만으로 통과 — 펜스 마스킹 조건을 통째로 제거해도 GREEN 유지(격리 입력으로 재현 시 RED 확인, 프로덕션 코드 자체는 정상 동작). "분기를 못 가르는 fixture" 패턴 재발 | `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts:374,376`; 원인 로직 `spec-links.ts:139-142` | 테스트 바디에서 펜스 앞뒤 빈 줄을 제거(예: `"# T\n[열린 텍스트\n\`\`\`\ncode\n\`\`\`\n](./a.md)\n"`)해 펜스 마스킹 단독으로 결과가 갈리게 한다 |
| 4 | documentation | `buildMaskedDoc()` JSDoc 이 "§1~§3 을 담당한다"고 적혀 있으나 실제로는 §4(빈 줄/문단 경계 마스킹)도 이 함수가 구현 — 2라운드에서 §4 불변식이 추가될 때 이 교차 참조가 갱신에서 빠진 stale 주석 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:118` (vs `extractLinks` JSDoc `:180-192`의 4항목, `isBlank` 분기 `:139-142`) | `§1~§3`→`§1~§4`로 수정하거나 번호 대신 항목명을 직접 나열 |
| 5 | documentation | plan 신규 문단에서 백틱 개수 불일치(`` `^\s*```' ``)로 코드 스팬이 닫히지 않고 다음 줄까지 삼킴 — "백틱 인용 함정을 세 번째로 밟았다"고 경고하는 바로 그 문장 옆에서 네 번째로 같은 실수 재현(mdast-util-from-markdown 파싱으로 확인, 대괄호 없어 빌드 가드는 미발동, 렌더링/가독성 결함) | `plan/in-progress/harness-review-gate-followups.md:155` | 백틱 3개를 말로 풀어 쓰거나(`` `^\s*` ``), 이중 백틱 구분자(`` ``^\s*``` `` ``)로 내부 런과 구분자 길이를 다르게 만든다 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 링크 타깃 경로 해석(`path.resolve`)이 상위 디렉터리 이탈을 정규화/화이트리스트하지 않음 — 기존 로직, 입력이 저장소 내 신뢰된 markdown 이고 노출도 존재 여부뿐이라 현재 스코프에선 실질 공격 표면 없음 | `spec-links.ts` `findBrokenLinksInFiles` 내 `path.resolve`/`fs.existsSync` (약 330-331행) | 조치 불요. 신뢰되지 않는 소스로 재사용 시 재검토 |
| 2 | security | 신규 `LINK_RE`(`/\[([^\]]*)\]\(([^)\n]+)\)/g`)는 부정 문자 클래스 단일 정량자로 ReDoS 위험 없음(비-중첩) | `spec-links.ts:82` | 조치 불요 |
| 3 | security | `buildMaskedDoc`/`lineForOffset` 은 순수 함수, 외부 프로세스/파일쓰기/eval 없음, 배열 인덱스도 범위 내 고정 | `spec-links.ts:124-,156-` | 조치 불요 |
| 4 | security | 테스트 fixture 의 `mkdtempSync` 임시 디렉터리는 예측 불가 유일 경로 + 자기 root 만 삭제, 경쟁 상태 없음 | `spec-links.test.ts` 신규 describe 블록들 | 조치 불요 |
| 5 | security | plan/review 신규 markdown 에 하드코딩 시크릿/자격증명 없음 | `plan/in-progress/harness-review-gate-followups.md`, `review/code/2026/08/29/{14_36_39,15_01_34}/**` | 조치 불요 |
| 6 | requirement | `extractLinks`/`buildMaskedDoc`/`lineForOffset` 핵심 로직 정확성을 vitest 재실행(175+19 passed) + `mdast-util-from-markdown` 독립 재검증으로 확인 | `spec-links.ts:124-223` | 조치 불요 |
| 7 | requirement | `MdLink.line`/`.raw` 계약 변경의 외부 파급은 실측(`grep` 전수) 0건 — 소비처가 자기 파일뿐 | `spec-links.ts:73-77,260-265` | 조치 불요 |
| 8 | requirement | 이 변경 영역을 규정하는 spec(`spec-impl-evidence.md` §4.2)은 탐지 알고리즘 세부를 규정하지 않아 spec fidelity 이슈 없음(회색지대) | `spec/conventions/spec-impl-evidence.md` §4.2 | 조치 불요 |
| 9 | requirement | 라운드1 Critical(plan 예시 문구가 진짜 링크가 됨)·라운드2 Warning(문단 경계 오판)이 재현 테스트로 실제 해소 확인됨 | `harness-review-gate-followups.md:104-116`, `spec-links.ts:139` | 조치 불요 |
| 10 | requirement | AST 순회 전환 판정, ANCHOR 경로 멀티라인 통합 테스트 부재는 근거와 함께 plan 에 defer 등재 — developer SKILL 수렴 예외 충족 | `harness-review-gate-followups.md:138-162` | 조치 불요 |
| 11 | scope | 리뷰 세션 산출물 26개 파일이 같은 diff 에 포함되나, 전부 이 저장소 표준 워크플로("구현 완료 후 자동 review/fix") 산출물이며 지시된 조치와 1:1 대응 | `review/code/2026/08/29/{14_36_39,15_01_34}/**` | 조치 불요 |
| 12 | scope | 워크트리 슬러그(`eslint10-upgrade-5e3cf9`)와 실제 작업 주제(spec-link 매칭 버그) 불일치 — 직전 2라운드가 이미 기록한 반복 관찰, eslint10 관련 코드 diff 는 여전히 0건 | 워크트리 경로 (인프라 메타데이터) | 조치 불요 |
| 13 | side_effect | `extractLinks()` 반환 계약 확장(`.line`=시작줄, `.raw`=개행 포함 가능)은 이미 필드 주석으로 문서화, 외부 소비처 0건 | `spec-links.ts` | 조치 불요 |
| 14 | side_effect | 모듈 스코프 공유 `LINK_RE`(`g` 플래그)는 diff 이전부터 존재, 현재 동기·순차 호출 패턴에서 상태 누수 없음 | `spec-links.ts` `LINK_RE` 선언부 | 조치 불요, 병렬/재진입 확장 시 재검토 |
| 15 | side_effect | 신규 테스트 fixture 는 OS 임시 디렉터리에만 쓰기, 저장소 트리 부작용 없음 | `spec-links.test.ts` | 조치 불요 |
| 16 | side_effect | `review/code/**` 신규 파일 생성은 프로젝트 관례 부합, `_retry_state.json` 의 로컬 절대경로 노출은 기존 반복 패턴 | `review/code/2026/08/29/{14_36_39,15_01_34}/**` | 조치 불요 |
| 17 | maintainability | 테스트 헬퍼 `writeDoc` 이 두 describe 블록에 글자 그대로 중복 정의(이번 diff 로 신규 발생) | `spec-links.test.ts:229,282` | 우선순위 낮음 — 모듈 스코프로 추출해 공유 |
| 18 | maintainability | `MaskedDoc` 이 `startOf`/`srcLineOf` 두 병렬 배열로 표현 — 이미 이전 라운드에서 트리아지된 잔존 관찰, 이번 diff 로 악화/개선 없음 | `spec-links.ts:107-115,146,149-151` | 조치 불요(트리아지 완료) |
| 19 | maintainability | `lineForOffset` 이진 탐색은 호출 패턴상 단순 전진 포인터로도 충분했을 자리이나, 독립 재사용성/테스트 용이성 트레이드오프로 수용 가능 | `spec-links.ts:155-165,212-220` | 조치 불요 |
| 20 | testing | `findBrokenPlanLinks`/`findBrokenSpecLinksInSources` 진입점은 멀티라인 DEAD 픽스처로 통합 검증되지 않음(코어 공유로 판별력은 낮음, 대칭성 차원 낮은 우선순위) | `spec-links.test.ts:399` 부근 | 낮은 우선순위 — 여유 있으면 대칭 회귀 추가 |
| 21 | testing | CRLF 줄바꿈 멀티라인 링크 테스트 없음(`buildMaskedDoc` 이 `/\r?\n/` 로 정규화해 동작상 문제는 낮음) | `spec-links.ts` `buildMaskedDoc` | 여유 있으면 CRLF 회귀 케이스 1건 추가 |
| 22 | documentation | plan 상단 "현재 상태 (2026-08-11 갱신)" 헤더 날짜가 2026-08-29 편집 이후에도 stale(본문 내용은 최신 사실 정확히 반영, 오독 위험 낮음) | `harness-review-gate-followups.md:23` | 여유 있으면 `(2026-08-29 갱신)`으로 갱신 |
| 23 | documentation | 직전 2라운드 documentation WARNING(필드 계약 미문서화, plan 상단 stale, JSDoc-선언 분리) 전부 이번 diff 시점에 실제 해소 확인 | `spec-links.ts:74-76,167-202,263` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | Critical/Warning 없음. 기존 경로 이탈 미정규화는 INFO(신뢰 입력이라 무해) |
| requirement | LOW | plan "둘" 서술과 unstruck 불릿 모순(WARNING #1) 외 핵심 로직은 실측 검증 통과 |
| scope | NONE | 실질 변경은 단일 결함 수정에 정확히 국한, 대량 리뷰 산출물 커밋은 표준 워크플로 |
| side_effect | LOW | 과거 리뷰 산출물 내 잔존 함정 문자열(WARNING #2, 현재 스코프 배제로 안전) |
| maintainability | LOW | `writeDoc` 테스트 헬퍼 중복(INFO) 외 Critical/Warning 없음 |
| testing | LOW | 펜스 마스킹 테스트가 빈 줄 마스킹에 의해 우연히 통과(WARNING #3), 그 외 테스트 설계 우수 |
| documentation | LOW | JSDoc §1~§3 stale 참조(WARNING #4), plan 백틱 렌더링 결함(WARNING #5) |

## 발견 없는 에이전트

없음 — 7개 reviewer 전원이 최소 1건 이상의 발견(Warning 또는 Info)을 보고했다. Critical 발견은 전 reviewer 공통으로 없음.

## 권장 조치사항

1. `plan/in-progress/harness-review-gate-followups.md` 의 "이제 둘" 요약과 unstruck "병렬 fan-out" 불릿 간 숫자/목록 불일치를 정정한다 (WARNING #1) — 이 저장소가 이미 3번째로 겪는 패턴이므로 우선순위를 높게 둔다.
2. 테스트 `"코드펜스를 사이에 둔 링크는 아니다"` 를 펜스 마스킹만으로 분기가 갈리도록 fixture 를 교체한다 (WARNING #3) — 실측 대체 입력이 리뷰에 제시되어 있어 적용 비용이 낮다.
3. `plan/in-progress/harness-review-gate-followups.md:155` 의 백틱 개수 불일치를 고쳐 렌더링 깨짐을 없앤다 (WARNING #5).
4. `buildMaskedDoc()` JSDoc 의 `§1~§3` 교차 참조를 `§1~§4` 로 갱신한다 (WARNING #4).
5. 여유가 되면 `collectGovernanceMarkdown` 근처에 "review/** 배제가 깨지면 과거 산출물의 함정 문자열이 위험하다"는 교차 참조 주석을 추가한다 (WARNING #2, 즉시 차단 아님).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 실행된 7명 전원이 router_safety 강제 목록에 해당한다. forced 전원 결과 확보됨 (화이트리스트 미이행 없음).
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 이번 diff(devtool 정적 분석 로직 재구현) 범위와 낮은 관련성 (구체적 사유는 manifest 에 미포함) |
  | architecture | 라우터 판단 — 동일 |
  | dependency | 라우터 판단 — 동일 (신규 의존성/패키지 변경 없음) |
  | database | 라우터 판단 — 동일 (DB 접근 코드 없음) |
  | concurrency | 라우터 판단 — 동일 (순차 동기 함수만, 병렬/재진입 없음) |
  | api_contract | 라우터 판단 — 동일 (외부 API 계약 변경 없음) |
  | user_guide_sync | 라우터 판단 — 동일 (사용자 대면 문서/가이드 변경 없음) |
