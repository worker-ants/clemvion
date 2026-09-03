# 요구사항(Requirement) 리뷰 — `repo-guards` walker 통합 + 낡은 spec 캐스트 가드 (7라운드 이후 재검토)

## 검증 방법

이 diff 는 이미 6라운드 리뷰(`01_48_39` → `01_49_18` → `02_12_38` → `02_35_22` → `02_57_22` →
`03_17_44` → `03_37_37`, 커밋 `63d5cdaa6`~`d44a8b637`)를 거쳤다. `HEAD` 는 6R 수정 커밋
(`d44a8b637`)이라 이번 라운드가 리뷰하는 코드는 6R 조치가 전부 반영된 상태다. 기존 발견사항이
실제로 반영됐는지 소스를 직접 열어 재확인하고, 실행 가능한 것은 직접 돌렸다(저장소 트리에는
아무것도 쓰지 않음).

- `npx jest --testPathPatterns="(source-scan|audit-action-binding|engine-error-code-anchor|masked-reject-callers|nullable-type-lie-cast|redis-fail-open-catalog)"`
  → **6 suites / 119 tests 전부 PASS** (5R 재검토 시점 117 → 6R 이 W1 조치로 2건 추가, 정확히
  일치).
- `npx tsc --noEmit -p tsconfig.json` → 대상 8개 파일 관련 에러 **0**.
- `npx eslint` (대상 8개 파일) → 경고/에러 **0**.
- `grep -rn includeSpec src/` → 실사용 호출부가 `masked-reject-callers-guard.ts:51` 과
  `nullable-type-lie-cast.spec.ts:399` **두 곳**임을 재확인(아래 INFO 참조, 5R 재검토가 이미
  찾은 것과 동일).
- `plan/in-progress/entity-nullable-column-type-mismatch.md` §"한 자리만 고치는 버릇" — 6R 이
  헤딩을 "네 번"→"여섯 번" 으로 고치고 6번째 행을 추가했다고 주장한 것을 직접 열어 대조 —
  헤딩 "여섯 번"(289행)·표 행 6개(292~298행)·표 렌더링(빈 줄 없음) 모두 일치.
- `spec/` 전체에서 `source-scan|collectTsFiles|repo-guards|masked-reject-callers` grep →
  `spec/4-nodes/7-trigger/1-manual-trigger.md`·`spec/5-system/14-external-interaction-api.md`
  가 `masked-reject-callers-guard.ts` 를 **참조만**(동작 서술 없음), `spec/conventions/raw-query-results.md`
  는 `source-scan.ts` 를 코드 증거 링크로만 사용 — 이 변경 영역(내부 test-tooling/repo-guard)을
  규정하는 spec 본문 없음, 회색지대 확인(5R 재검토와 일치).

## 발견사항

- **[정보성, 이미 추적/유예됨]** `CollectTsFilesOptions.includeSpec` JSDoc 이 "실사례가 하나
  있다" 고 적었지만 실제로는 두 곳(`masked-reject-callers-guard.ts:51` ·
  `nullable-type-lie-cast.spec.ts:399`)이다.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:214-216`
  - 상세: 5R 재검토(`03_17_44/requirement.md`)가 먼저 찾았고, 6R `RESOLUTION.md`(INFO#1)가
    "이 라운드는 개수 서술을 다시 늘리지 않는다 … 다음에 그 파일을 만질 때 개수 표현을 빼는
    것으로 남긴다" 로 명시적으로 유예했다. 새 발견이 아니라 그 유예가 이번 라운드에도
    그대로 유효함을 재확인한 것이다. 기능 영향 없음(두 호출부 모두 정상 동작, 테스트 GREEN).
  - 제안: 조치 불필요(기존 유예 유지). 다음에 `source-scan.ts` 를 만질 때 "실사례가 하나
    있다" 라는 개수 표현을 지우고 두 사례를 나열하는 편이 이 저장소가 반복 확립한 "검증되지
    않는 숫자는 적지 않는다" 원칙과도 맞다.

- **[관측, 코드 결함 아님]** 리뷰 도중 공유 워크트리에서 `masked-reject-callers-guard.ts` 가
  일시적으로 수정 상태(` M`)였고 `masked-reject-callers-guard.ts.bak` 이 존재하는 것을
  관측했다. 다음 확인 시점에는 두 흔적 모두 사라져 `git status --short` 가 다시 clean(리뷰
  세션 디렉터리만 untracked)이었다. `git diff` 도 빈 결과였다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` (일시적)
  - 상세: 이 프로젝트 컨벤션 문서(`.claude/docs/subagent-call-contract.md` 계열 교훈)가 이미
    기록한 "병렬 fan-out reviewer 가 같은 워킹트리를 동시에 뮤테이션 검증하며 서로를 오염시킨다"
    패턴과 일치한다(6R `RESOLUTION.md` INFO#19 도 자기 자신의 뮤테이션 잔재를 같은 방식으로
    보고했다). 이 요구사항 리뷰가 만든 뮤테이션이 아니며, 리뷰 종료 시점에는 저장소가 clean
    이었다.
  - 제안: 조치 불필요 — 관측 사실만 기록. 통합 SUMMARY 단계에서 다른 reviewer 도 같은 잔재를
    봤다면 대조용으로 참고.

## 확인 결과 — 문제 없음 (누적 라운드 발견사항의 현재 상태)

- **1R W1~W4, 2R W1(동명 필드 오탐), 5R INFO(개수 표현 유예)**: 전부 5R 재검토가 이미
  코드 대조로 반영 확인했고, 이번 라운드에서 소스를 다시 열어 동일하게 확인했다 — 재기재
  생략.
- **6R W1(`masked-reject-callers` `includeSpec` 배선 미검증)**: `masked-reject-callers.spec.ts`
  에 `describe('스캔 대상에 \`.spec.ts\` 가 포함된다', …)` 블록이 실제로 존재하고(tmpdir
  픽스처로 `listSourceFiles` 가 `.spec.ts` 를 담는 것을 직접 단언 + `ALLOWED_DIRECT_CALLERS`
  가 `.spec.ts` 항목을 실제로 갖는지의 전제 테스트), `masked-reject-callers-guard.ts:49-51` 의
  `listSourceFiles` 가 `collectTsFiles(rootDir, { includeSpec: true })` 로 위임하는 것도 확인
  — 반영 확인. jest 실행으로 GREEN 도 직접 재확인(119/119).
- **6R W2·W3(plan 문서 "한 자리만 고치는 버릇" 절의 헤딩/표 불일치)**: 위 검증 방법에서
  직접 대조 — 헤딩·행 수·렌더링 모두 일치, 반영 확인.
- **`nullable-type-lie-cast-guard.ts` — `widenedEntityFields` 이름 충돌 제외 로직**:
  `for (const f of nonNull) widened.delete(f);` 가 현재 코드에 있고, 대조군 테스트(`userId`
  충돌 제외 · `onlyHereAt` 충돌 없음 그대로 잡음)도 spec 에 존재 — 반영 확인. 저장소 전수
  스위트(`describe('저장소 전수', …)`)도 잔존 0 을 직접 단언하고 GREEN.
- **plan 문서의 완료 체크박스**(배치 1~3, walker 통합, 낡은 spec 캐스트 가드) — 서술이
  실제 코드·테스트 구조와 일치. 미완료로 남은 두 항목("§2.9 next_run_at 표기 정정",
  "§2.2 /api/auth/* 예외 조항")은 developer 권한 밖(planner 턴 필요)이라는 서술과 실제
  체크박스 상태(미체크)가 일치 — 스코프 판단 정확.

## 요약

이 diff 는 `repo-guards/__tests__/` 의 디렉터리 walker 사본 5개를 `source-scan.ts` 의
`collectTsFiles(root, { includeSpec })` 하나로 통합하고, `| null` 로 넓혀진 엔티티 필드를
겨눈 낡은 `.spec.ts` `null as unknown as` 캐스트를 잡는 신규 가드
(`widenedEntityFields`/`findStaleSpecCasts`)를 추가한 것이다. 이미 6라운드에 걸친 리뷰가
정렬 커버리지 봉인 오류·전용 테스트 부재·헬퍼 중복·JSDoc orphan·동명 필드 오탐·옵션 배선
미검증·plan 문서 자기모순이라는 일곱 개의 실질적 결함을 순차로 잡았고, 이번 재검토에서 그
수정 전부가 현재 소스(`HEAD=d44a8b637`)에 정확히 반영돼 있음을 직접 실행(119/119 GREEN,
`tsc`/`eslint` 클린)과 소스 대조로 재확인했다. 이 변경 영역(내부 test-tooling/repo-guard)을
규정하는 `spec/` 본문은 없어 spec fidelity 축은 회색지대다. 남은 유일한 항목은 5R 이 먼저
찾고 6R 이 명시적으로 유예한 `includeSpec` JSDoc 의 개수 표현 하나뿐이며, 기능에 영향이
없고 이미 처분(다음 접촉 시 정리)이 정해져 있다. CRITICAL/WARNING 급 결함은 발견되지
않았다. 리뷰 도중 공유 워크트리에서 다른 병렬 reviewer 로 추정되는 일시적 뮤테이션 흔적을
관측했으나 종료 시점엔 해소돼 있었다(코드 결함 아님, 관측 사실만 기록).

## 위험도

LOW
