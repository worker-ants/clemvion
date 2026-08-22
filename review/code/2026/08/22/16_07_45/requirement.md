# 요구사항(Requirement) 리뷰 — backend-redact-depth-boundary

## 리뷰 방법

`codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` 에 추가된 깊이 경계
테스트(7종 `[경계]` + 1종 `[회귀]`)를 대상 구현 `sanitize-error-message.ts`
(`deepRedactCore`/`deepRedactObject`/`redactSecretsInJsonString`)의 실제 재귀 로직과
line-level 로 직접 대조했다. 추가로:

- 실제 `jest` 실행으로 GREEN 확인(`sanitize-error-message.spec.ts`: 76/76 통과).
- 대표 뮤턴트 1종(`depth >= MAX_REDACT_DEPTH` → `depth > MAX_REDACT_DEPTH`)을 실제 파일에
  주입해 신규 테스트 5건이 즉시 RED 로 전환되는 것을 실측(판별력 확인). 뮤턴트는 검증 직후
  `git checkout --` 로 원복해 깨끗한 상태로 되돌렸다.
- spec 본문(`spec/5-system/14-external-interaction-api.md`)과 자매 상한 3계열
  (`MAX_REDACT_DEPTH` `>=`, `MAX_SANITIZE_DEPTH` `>`, `stripExternalOnlyFields maxDepth` `>`)의
  실제 코드를 grep/Read 로 대조.
- plan 문서(`plan/complete/masked-marker-shared-package.md`,
  `plan/complete/mirror-guard-single-copy.md`, `plan/in-progress/spec-sync-...md`)의 서술적
  주장(체크박스 전환, 캐너리 존재, 비문자열 5종 테스트 존재 등)을 실제 코드/git diff 로 표본
  검증.

> **운영 메모(코드 결함 아님)**: 검증 도중 `sanitize-error-message.ts` 가 내가 주입하지 않은
> 형태로 일시적으로 변형돼 있는 것을 발견했다(같은 공유 worktree 에서 동시에 도는 다른
> reviewer 의 뮤테이션 테스트와 충돌한 것으로 추정). 즉시 `git checkout --` 로 원복해 clean
> 상태를 확인했다 — 최종 리뷰 결과에는 영향 없음. 병렬 reviewer 가 shared worktree 를
> mutate 하는 기존에 알려진 위험 패턴과 동형이라 기록해 둔다.

## 발견사항

- **[INFO]** 경계 테스트 제목의 방향 표현이 실제 값과 다소 어긋나 보임(기능적 문제 아님)
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts:307` (`it('[경계] 상한 한 칸 위(-1)의 서브트리는 살아남는다 — 상한이 작아지면 RED', () => {`)
  - 상세: 제목의 "한 칸 위"는 통상 "상한보다 큰 쪽(cap+1)"으로 읽히기 쉬우나, 실제 테스트는
    `MAX_REDACT_DEPTH - 1`(상한보다 한 칸 **작은/아래** 깊이)을 검사한다. 괄호 안 `(-1)` 표기와
    본문 주석("상한이 작아지면 RED")으로 의미가 명확히 disambiguate 되어 있어 실질적 오독
    가능성은 낮고, 단언 자체는 구현과 정확히 일치한다(직접 트레이스로 확인:
    `nestObj(MAX_REDACT_DEPTH - 1, PLAIN_SUBTREE)` → leaf 는 call-depth `MAX_REDACT_DEPTH - 1`
    에서 `depth >= MAX_REDACT_DEPTH` 를 만족하지 못해 보존됨).
  - 제안: (선택) "한 칸 아래(-1)" 로 표현을 다듬으면 더 명확하나, 현재도 `(-1)` 명시로 충분히
    소통되므로 필수 수정 사항은 아니다.

## 상세 검증 내역 (참고)

- **깊이 계산 원리**: `deepRedactSecrets(nestObj(k, leaf))` 호출 시 `leaf` 는 정확히 call-depth
  `k` 에서 평가된다 (root 객체가 depth 0). 이 저장소 규칙을 트레이스로 재현해 8개 신규 단언 전부
  (경계 상·하, 문자열-우선 순서, 비밀 문자열 fail-closed, 배열/혼합 nesting, JSON 파싱 1-depth
  소모, 5000-depth 스택오버플로 회귀)가 `deepRedactCore`/`deepRedactObject`/
  `redactSecretsInJsonString` 의 실제 분기 순서(① 문자열 → ② null/비객체 → ③ `depth >=
  MAX_REDACT_DEPTH` → ④ 재귀)와 정확히 일치함을 확인했다.
- **"값 검사가 깊이 검사보다 먼저" 주장**: `deepRedactCore` 소스상 `typeof value === 'string'`
  분기가 depth 체크(`if (depth >= MAX_REDACT_DEPTH) ...`)보다 앞서 있어 문서 주석·테스트
  기대값과 정확히 일치.
- **3계열 상한 비교표**(테스트 JSDoc 내 표) — 모두 코드와 line-level 일치 확인:
  - `MAX_REDACT_DEPTH`(`sanitize-error-message.ts:270`) — `depth >= MAX_REDACT_DEPTH` →
    `VALUE_MASK_MARKER`. 일치.
  - `MAX_SANITIZE_DEPTH`(`websocket.service.ts:119`) — `depth > MAX_SANITIZE_DEPTH` →
    `DEPTH_MASK_MARKER`. 일치.
  - `stripExternalOnlyFields`(`strip-external-only-fields.ts:106`) — `depth > maxDepth` →
    서브트리 보존(원값 그대로 return). 일치.
- **SoT 참조**: `MAX_REDACT_DEPTH`(로컬 별칭) = `MAX_MASK_DEPTH`(`@workflow/masked-markers`,
  값 10). 테스트는 리터럴 `10` 을 하드코딩하지 않고 `MAX_REDACT_DEPTH` 를 import 해 사용 —
  SoT 가 바뀌면 테스트가 따라온다는 문서 주장과 일치.
- **프런트 상한 대응관계 주장** — `codebase/frontend/src/lib/utils/__tests__/masked-markers.test.ts`
  에 `nest(10)→true`/`nest(11)→false` 존재 확인, 테스트 docstring 인용과 일치.
- **"이미 닫혀 있었다" 트래커 항목** — `codebase/packages/masked-markers/src/__tests__/index.spec.ts`
  에 `it.each([['number',0],['null',null],['undefined',undefined],['object',{}],['array',[]]])`
  기반 `[캐너리] 비문자열 %s 는 마커가 아니다` 테스트가 실제로 존재, 트래커 서술과 일치.
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md` diff 도 해당 항목만 `[x]` 전환하고
  나머지 미체크 항목은 그대로 유지되는 것으로 확인 — 과도한 일괄 체크(false-close) 없음.
  참고: 이 파일은 프롬프트 크기 제한으로 전체 컨텍스트가 실리지 않아 unified diff 구간만
  대조했다(치명적 판단에 영향 없는 범위로 판단).
- **plan 체크박스 전환의 실제 diff 대조** — `plan/complete/masked-marker-shared-package.md`
  (rename from `plan/in-progress/`) 의 `git diff --find-renames` 로 두 항목이 실제로 `[ ]` →
  `[x]` 전환되고 대체 근거가 함께 기록된 것을 확인:
  - `- [ ] /ai-review` → `- [x] /ai-review — 9라운드 수행...`
  - `- [ ] backend deepRedactSecrets 깊이 경계 테스트` → `- [x] ... 닫았다 (2026-08-22,
    backend-redact-depth-boundary) ... 뮤테이션 9종으로 판별력을 실측했다(생존 0/9)`
  consistency-check(`review/consistency/2026/08/22/15_35_56/SUMMARY.md`)가 착수 전 낸
  BLOCK:YES(naming_collision CRITICAL — "4번째 유사 상한 명명 위험")에 대해 developer 가
  "새 프로덕션 식별자 0개, 기존 `MAX_REDACT_DEPTH`/`VALUE_MASK_MARKER` 만 import, `>` 경계
  파일들 비수정" 으로 처분한 근거도 실제 diff(`git diff --stat`: 오직 `.spec.ts` + plan/review
  문서만 변경, `strip-external-only-fields.ts`/`websocket.service.ts` 미수정)와 일치함을 확인.
- **TODO/FIXME/HACK/XXX**: 신규 파일에 없음(grep 0건).
- **엣지 케이스 커버리지**: 상한-1(경계 아래) / 상한(경계 정확히) / 5000(경계 훨씬 위, 스택오버플로
  회귀) 3구간을 모두 커버. object/array/mixed nesting 보폭 동일성, JSON 파싱 경로의 depth+1 소모,
  비밀/비-비밀 문자열 양쪽 방향(fail-closed 방향 포함) 모두 별도 단언으로 커버되어 있어 반환값
  누락이나 미검증 경로는 발견되지 않음.

## 요약

이번 변경은 순수 테스트 추가(`sanitize-error-message.spec.ts`)와 관련 plan/consistency 문서
갱신으로 구성되며, 프로덕션 코드(`sanitize-error-message.ts` 등)는 수정하지 않는다. 신규 8개
테스트(`[경계]` 7종 + `[회귀]` 1종)를 실제 구현의 재귀 순서(문자열 우선 → null/비객체 pass-through
→ `depth >= MAX_REDACT_DEPTH` → 재귀)와 line-level 로 대조한 결과 전부 정확히 일치했고, 대표
뮤턴트(`>=`→`>`) 주입으로 판별력도 직접 재현 확인했다(5건 즉시 RED). 이전 테스트가 "언젠가
멈춘다"만 검사해 상한 값 자체를 검증하지 못했던 갭(트래커에 명시된 문제의식)을 실제로 해소하며,
spec(`14-external-interaction-api.md`)이 위임한 "SoT 는 공유 패키지" 서술과도 어긋남이 없다.
plan 문서의 체크박스 전환·캐너리 존재·자매 상한 비교표 등 다수의 서술적 주장을 실측으로 표본
검증했고 전부 사실과 일치했다. CRITICAL/WARNING 급 결함은 발견되지 않았고, INFO 1건(테스트
제목의 방향 표현이 다소 모호하나 `(-1)` 명시로 실질적 오독 위험은 낮음)만 남는다.

## 위험도
NONE
