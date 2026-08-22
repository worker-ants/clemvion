# 요구사항(Requirement) 리뷰 — `16_21_03`

## 리뷰 방법 (독립 재검증)

이 changeset 은 이전 리뷰 세션(`16_07_45`)의 산출물(RESOLUTION 반영 후 트래커 파일 1개를
`git rebase --onto` 로 드롭한 결과)과 거의 동일하다. 이전 라운드가 이미 상세한 line-level 대조를
수행했으므로, 그 결론을 그대로 받지 않고 핵심 주장을 직접 재현·검증했다:

- `codebase/backend/src/shared/utils/sanitize-error-message.ts` 의 `deepRedactCore`/
  `deepRedactObject`/`redactSecretsInJsonString` 실제 소스를 `Read` 로 열어, 신규 8개 테스트
  (`[경계]` 7종 + `[회귀]` 1종, `describe('깊이 상한 경계 (MAX_REDACT_DEPTH)', ...)` 블록)를
  직접 손으로 트레이스했다 — 전부 구현과 정확히 일치함을 확인.
- 뮤테이션 재현: `depth >= MAX_REDACT_DEPTH` → `depth > MAX_REDACT_DEPTH` 로 직접 파일을
  수정해 `jest -t "깊이 상한 경계"` 를 실행 — **8건 중 5건이 즉시 RED** (판별력 확인). 검증 직후
  `cp` 로 원본을 복원하고 `git status --porcelain` 으로 clean 을 재확인했다.
- spec 대조: `spec/5-system/14-external-interaction-api.md:1625-1628` 이 "마커 집합과 깊이
  상한의 SoT 는 공유 패키지 `@workflow/masked-markers`" 이고 backend/frontend 는
  "재export shim" 이라고 명시 — 실제 `sanitize-error-message.ts:9-16,128`(재export/로컬 별칭)과
  일치.
- 세 자매 깊이 상한 비교 연산자(테스트 JSDoc 표에 인용된)를 소스에서 직접 확인:
  - `MAX_REDACT_DEPTH`: `depth >= MAX_REDACT_DEPTH` → `VALUE_MASK_MARKER`
    (`sanitize-error-message.ts:270`)
  - `MAX_SANITIZE_DEPTH`: `depth > MAX_SANITIZE_DEPTH` → `DEPTH_MASK_MARKER`
    (`websocket.service.ts:119`)
  - `stripExternalOnlyFields`: `depth > maxDepth` → 서브트리 보존
    (`strip-external-only-fields.ts:106`)
  세 표 행 모두 테스트 JSDoc 서술과 정확히 일치.
- `it(` 개수 카운트: `describe` 블록 안 정확히 8개 — plan 문서(`masked-marker-shared-package.md`)의
  "경계 7종을 추가" 서술(`[경계]` 태그 7개 + `[회귀]` 태그 1개)과 일치.
- `TODO|FIXME|HACK|XXX` grep: 0건.

## 발견사항

- **[INFO]** 경계 테스트 제목의 방향 표현("한 칸 위(-1)")이 실제로는 상한보다 **작은/아래**
  깊이(`MAX_REDACT_DEPTH - 1`)를 가리켜 통상적 직관과 다소 어긋나 보인다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts:307`
  - 상세: 직접 트레이스 결과 단언 자체(`nestObj(MAX_REDACT_DEPTH - 1, PLAIN_SUBTREE)` →
    변경 없음, `deepRedactCore` 에서 `MAX_REDACT_DEPTH - 1 >= MAX_REDACT_DEPTH` 가 거짓이라
    서브트리로 정상 진입해 leaf 문자열 `'plain'` 이 비밀 패턴에 안 걸려 보존)은 구현과 정확히
    일치한다. 괄호 `(-1)` 표기가 있어 실질적 오독 가능성은 낮다. 동일 이슈가 이전 라운드
    (`16_07_45/requirement.md`)에서도 INFO 로 발견됐고, `review/code/2026/08/22/16_07_45/RESOLUTION.md`
    가 "제목은 상한 기준 한 칸 바깥(=아직 마스킹되지 않는 쪽) 을 뜻하며 그 의미로는 '위' 가
    맞다"는 근거로 조치 불필요 처리했다 — 재확인 결과 그 판단에 동의한다(기능 결함 아님).
  - 제안: 조치 불필요(이미 dispositioned). 재발 방지 목적이 아니라면 추가 수정 불요.

- **[INFO]** `--impl-prep` consistency 라운드(`15_35_56`)의 `naming_collision` CRITICAL
  ("redact 깊이 경계 개념이 이미 3계열로 존재 — 4번째 유사 명명 위험")은 실제 구현이 신규
  프로덕션 식별자를 **0개** 도입하고 기존 `MAX_REDACT_DEPTH`/`VALUE_MASK_MARKER` 만 import 해
  해소됐다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts:4-11` (import 목록에
    `MAX_REDACT_DEPTH` 추가만 있고, 나머지는 파일 전체가 `.spec.ts` — 프로덕션 코드 diff 0)
  - 상세: `git diff --stat` 관점에서 이 changeset 이 건드리는 프로덕션 코드는 없다(테스트 파일
    1개뿐). `websocket.service.ts`/`strip-external-only-fields.ts` 의 `>` 경계도 미수정 —
    consistency 가 요구한 "기존 계열 재사용, `>` 경계 불변식 안 건드림" 조건을 그대로 충족한다.
  - 제안: 조치 불필요(이미 올바르게 준수됨).

## 요약

핵심 코드 변경은 `sanitize-error-message.spec.ts` 에 8개 신규 depth-boundary 테스트를 추가하는
순수 테스트 전용 diff다. 프로덕션 코드는 전혀 수정되지 않았고, 신규 프로덕션 식별자도 없다.
독립적으로 소스(`deepRedactCore`/`deepRedactObject`/`redactSecretsInJsonString`)를 직접 트레이스한
결과 신규 8개 단언 전부가 실제 재귀 순서(①문자열 ②null/비객체 ③`depth >= MAX_REDACT_DEPTH`
④재귀, `depth+1` 전파, JSON 파싱 경로의 `depth+1` 소모)와 정확히 일치했고, 대표 뮤턴트(`>=`→`>`)를
직접 주입·복원해 5/8 즉시 RED 를 재현 확인함으로써 판별력 주장도 검증됐다. spec
(`spec/5-system/14-external-interaction-api.md:1625-1628`)이 서술하는 "SoT = `@workflow/masked-markers`,
backend/frontend 는 재export shim" 구조와 코드가 line-level 로 일치하며, 세 자매 깊이 상한
(`MAX_REDACT_DEPTH`/`MAX_SANITIZE_DEPTH`/`stripExternalOnlyFields.maxDepth`)의 비교 연산자·마커
반환값도 테스트 JSDoc 표와 소스가 전부 일치한다. 종전 vacuous 테스트("25겹, `not.toThrow()`만")가
지적했던 갭 — 상한 값 자체가 실수로 바뀌어도(예: 10→1) 잡지 못했던 문제 — 는 이번 8개 테스트로
완전히 해소된다. TODO/FIXME/HACK/XXX 없음, 반환값 누락 없음, 엣지 케이스(상한-1/상한/상한보다
훨씬 깊은 5000, object/array/mixed nesting, JSON 파싱 진입점, 비밀/비-비밀 문자열 양방향)
빠짐없이 커버. CRITICAL/WARNING 급 결함은 발견되지 않았다.

## 위험도
NONE
