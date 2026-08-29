# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건, WARNING 1건(테스트 커버리지 갭). Forced reviewer 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 화이트리스트 미이행 없음. 8개 reviewer(6개는 위험도 NONE, 2개는 LOW) 전원 전문 확보, 재시도 필요 항목 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | 통합 테스트("멀티라인 링크의 깨진 타깃도 잡힌다")가 이 PR의 핵심 계약 — `LinkViolation.line`이 멀티라인 링크에서도 올바른 **원본** 줄 번호를 보고하는가 — 를 단언하지 않는다. `fingerprint()`(kind+target 문자열)만 검증하고 `.line` 값(3이어야 함)은 어디서도 확인되지 않는다. | `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` — `describe("멀티라인 링크의 깨진 타깃도 잡힌다")` 블록 | `expect(findBrokenLinks(root)).toMatchObject([{ kind: "DEAD", line: 3, target: "./nope.md" }])` 형태로 `.line`도 함께 단언 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement, side_effect, testing, documentation (중복 통합) | `MdLink.raw`(및 `LinkViolation`이 전달하는 원본 매치 문자열)는 멀티라인 링크에 인라인 코드가 섞이면 마스킹된(백틱 제거) 문자열을 담아 원문 그대로가 아니게 된다. 현재 `.raw`를 소비하는 코드는 전혀 없어(grep 0건) 즉각적 파급 없음. | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` `MdLink` 인터페이스 필드 및 `extractLinks`의 `raw: m[0]` | dead field 이므로 급하지 않음. 인터페이스 주석에 "원문 그대로가 아닐 수 있음" 한 줄 보강 고려. 향후 `.raw` 소비 코드 추가 시 회귀 테스트 동반 |
| 2 | security | `findBrokenLinksInFiles`의 `path.resolve`+`fs.existsSync` 경로 해석이 형태상 경로 탐색(path traversal) 패턴이나, 입력이 저장소 내 신뢰된 마크다운뿐이고 이 모듈이 `__tests__/` 스코프 밖에서 import 되지 않아 실공격 표면 없음 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:331-332` | 조치 불요. 런타임 사용자 입력 경로로 재사용될 때만 정규화 추가 |
| 3 | security, performance | 신규 정규식(`LINK_RE`, `FENCE_RE` 등)에 중첩 정량자 없어 ReDoS 위험 없음 확인 | `spec-links.ts:82-83`, `:218`, `:470` | 조치 불요(긍정적 확인) |
| 4 | performance | `lineForOffset`의 매치당 이진 탐색은 호출 패턴(정규식 `g` 플래그로 단조 증가하는 매치 오프셋)을 고려하면 상각 O(1) 전진 포인터로 대체 가능하나, 파일당 규모(수십~수백 줄)와 CI/테스트 전용 실행 특성상 측정 가능한 영향 없음 | `spec-links.ts:157-166`(`lineForOffset`), 호출부 `:213-220` | 조치 불요. 가드가 대용량 파일 스캔으로 확장될 때만 재검토 |
| 5 | performance | 마스킹 버퍼(`body`/`masked`/`srcLineOf`/`startOf`) 추가 할당은 사전 필터(`cannotContainLink`) 통과율(11.9%)과 대상 파일 크기를 고려하면 무시 가능한 수준 | `spec-links.ts:125-154`(`buildMaskedDoc`) | 조치 불요 |
| 6 | maintainability | 테스트 헬퍼 `writeDoc`이 두 `describe` 블록에 동일하게 중복 정의됨(3라운드 연속 재확인, 상태 불변) | `spec-links.test.ts` 두 describe 블록 상단 | 세 번째 사본이 추가되는 시점에 모듈 스코프로 추출 고려 |
| 7 | maintainability | `MaskedDoc`이 `startOf`/`srcLineOf` 두 병렬 배열로 줄 지도를 표현(실질 위험 낮음, 상태 불변) | `spec-links.ts` `interface MaskedDoc` | 재구성 시 단일 배열 병합 고려 |
| 8 | testing | ANCHOR 위반의 멀티라인 링크 탐지를 직접 고정하는 통합 테스트 부재(DEAD 경로만 커버). 이전 라운드가 "판별력 낮음"으로 우선순위 낮음 판정, 이번 라운드도 동의 | `spec-links.test.ts` | 여유 있으면 "멀티라인 링크의 깨진 자기참조 앵커도 잡힌다" 케이스 1개 추가 |
| 9 | testing | `review/code/2026/08/29/14_36_39/RESOLUTION.md`의 "신규 테스트 9건" claim이 실측(10건)과 어긋남 | `review/code/2026/08/29/14_36_39/RESOLUTION.md` `## TEST 결과` 절 | "신규 9건" → "신규 10건"으로 정정 |
| 10 | requirement | spec fidelity 확인 — `extractLinks()` 내부 매칭 전략은 spec에 규정되지 않은 구현 세부사항이며, `spec/conventions/spec-impl-evidence.md` §4.2 표가 정의하는 스코프(4개 진입점의 filter 조합)는 코드와 일치. Spec drift 없음 | `spec/conventions/spec-impl-evidence.md` §4.2 vs `spec-links.ts` | 조치 불요 |
| 11 | side_effect | 이 PR이 스스로 두 차례 겪은 트리거 문자열(인라인 코드가 예시 문구를 진짜 링크로 재구성하는 패턴)이 같은 커밋에 포함된 과거 리뷰 산출물(`review/code/2026/08/29/{14_36_39,15_01_34}/**`) 안에 펜스 없이 남아 있으나, 4개 스캔 진입점이 전부 `review/**`를 스코프에서 제외해 현재도 안전함을 재확인(2라운드 연속 "무조치" 처분) | `review/code/2026/08/29/14_36_39/RESOLUTION.md:19` 등 다수 | 즉시 조치 불요. 여유 있으면 `collectGovernanceMarkdown` 근처에 배제 근거 교차 참조 주석 추가 |
| 12 | documentation | plan 상단 `## 현재 상태 (2026-08-11 갱신)` 헤더 날짜가 본문 최신 내용(2026-08-29 갱신 서술)보다 낡음(3라운드 연속 재확인, 실질 오독 위험 낮음) | `plan/in-progress/harness-review-gate-followups.md:23` | 여유 있으면 헤더를 `(2026-08-29 갱신)`으로 갱신 |
| 13 | scope | 워크트리 슬러그(`eslint10-upgrade-5e3cf9`)와 실제 작업 주제(spec-link 멀티라인 매칭 버그 수정)가 불일치(4라운드 연속 관찰, scope 위반 아님) | 워크트리 경로 자체 | 조치 불요 |
| 14 | scope | 같은 diff에 이전 3개 리뷰 라운드 산출물(37개 파일)이 포함 — 프로젝트 표준 review/fix 워크플로 산출물로 확인됨 | `review/code/2026/08/29/{14_36_39,15_01_34,15_30_59}/**` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 형태상 경로 탐색 패턴 있으나 신뢰 경계상 무해, ReDoS 없음, 시크릿/인증 이슈 없음 |
| performance | NONE | 알고리즘 변경은 중립~소폭 개선(정규식 호출 파일당 1회로 감소), 이진 탐색 O(log L)은 규모상 무해 |
| requirement | NONE | 4개 불변식(멀티라인 포착·목적지 개행 금지·펜스/빈 줄 경계 차단) 전부 CommonMark 대조 검증, 이전 CRITICAL/WARNING 3건 전부 해소 재확인(vitest 194 passed) |
| scope | NONE | 40개 파일 전부 단일 결함의 수정/검증/조치 사이클, import·설정 변경 0건 |
| side_effect | NONE | 함수 시그니처 불변, 새 전역 상태 없음, fs/env/network 부작용 없음 |
| maintainability | LOW | 이전 WARNING 전부 조치 완료(함수 분리, 계약 주석), 잔존 INFO 2건은 상태 불변 |
| testing | LOW | 신규 테스트 설계 품질 높음(off-by-one/축 분리/양방향 잠금)이나 통합 테스트가 핵심 `.line` 계약을 단언 안 함(WARNING) |
| documentation | LOW | 이전 3라운드 WARNING 전부 해소, 잔존 INFO는 plan 헤더 날짜 stale뿐 |

## 발견 없는 에이전트

없음 (전 8개 reviewer가 최소 INFO 이상 발견사항 보고).

## 권장 조치사항
1. [WARNING] 통합 테스트("멀티라인 링크의 깨진 타깃도 잡힌다")에 `LinkViolation.line` 값 단언 추가 — `spec-links.test.ts`의 `toMatchObject`에 `line: 3` 포함.
2. [INFO, 선택] `review/code/2026/08/29/14_36_39/RESOLUTION.md`의 "신규 9건"을 "신규 10건"으로 정정.
3. [INFO, 선택] `plan/in-progress/harness-review-gate-followups.md:23` 헤더 날짜를 `(2026-08-29 갱신)`으로 갱신.
4. 나머지 INFO 항목은 이전 라운드에서 반복 트리아지된 낮은 우선순위 사안으로, 이번 병합을 막을 사유 없음.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, requirement, scope, side_effect, maintainability, testing, documentation (8명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — forced 전원 결과 확보됨, 화이트리스트 미이행 없음
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | 라우터 판단 (프롬프트에 상세 사유 미전달 — diff 범위(문서/테스트 유틸리티 국소 수정)상 아키텍처 영향 낮다고 판단된 것으로 추정) |
  | dependency | 라우터 판단 (diff에 의존성/package.json 변경 없음) |
  | database | 라우터 판단 (diff에 DB 관련 코드 없음) |
  | concurrency | 라우터 판단 (diff는 동기 순차 실행 devtool, 동시성 표면 없음) |
  | api_contract | 라우터 판단 (diff에 API 계약 변경 없음) |
  | user_guide_sync | 라우터 판단 (diff는 내부 CI devtool로 사용자 가이드 영향 없음) |
