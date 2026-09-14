# 정식 규약 준수 검토 — convention_compliance

## 검토 범위와 방법

target 은 `spec/conventions/` (scope 델타 0개 파일 — 이 PR 은 그 영역을 바꾸지 않는다. 코드 전용
PR 이므로 정상이며 그 자체로 CRITICAL 사유가 아니다). 실제 구현 diff 는
`origin/main...HEAD` 기준 `codebase/` 6개 파일(트리거 비밀 컬럼 3중 사본 정합 가드 신설 +
캐너리 self-spec 표기 정리 + schedule/e2e teardown·양성 케이스 보강)이며, HEAD 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/trigger-canary-hardening-a71e04`)를
절대경로로 직접 열어 전문을 대조했다.

이 검토 시각(13:31) 직전 `7420cede1`("라운드 5") 커밋이 13:31:14 에 얹혔고, 이는 바로 직전
라운드 리뷰(`review/consistency/2026/09/14/13_04_59/convention_compliance.md`)가 다룬 상태
**이후**의 변경이다. 따라서 이번 검토는 (a) 라운드 5 가 새로 만든 코드 diff, (b) 그 이전 상태에
대한 기존 발견의 재확인 두 가지를 함께 수행했다.

**라운드 5 의 실제 diff** (`git show 7420cede1 -- codebase/`):
- `trigger-secret-columns.spec.ts` — `tmp` 변수 옆에 "왜 `string | undefined` 로 안 바꿨는가"
  주석 8줄 추가 (기존 리뷰 INFO 를 적용했다가 타입체크 ratchet 회귀로 철회한 판단 기록).
- `trigger-workflow-ref.spec.ts` — self-spec 헤더의 "다섯 자리" 수치 서술을 제거하고 형제
  e2e 파일을 SoT 로 가리키는 문장으로 대체 (14줄).

대조 대상 규약: `spec/conventions/secret-store.md`, `spec/conventions/review-citations.md`,
`spec/conventions/swagger.md`.

## 발견사항

### INFO — `secret-store.md §R4` 의 메서드명 드리프트 (PR 이전부터 존재, 라운드 5 도 미수정)

- target 위치: `spec/conventions/secret-store.md` `### R4. Trigger FK 미설정` (약 428행)
- 위반 규약: 같은 문서 `## 6. Trigger 삭제 시 cascade` (약 390행) — 문서 내부 자기 정합성
- 상세: §R4 는 "trigger 삭제 시의 명시적 cleanup 책임은 **`TriggersService.delete()`**가
  진다"라고 적었는데, 같은 문서 §6 과 실제 코드(`triggers.service.ts`)는 `remove()` →
  `deleteByPrefix(...)` 를 쓴다. 메서드명이 문서 내부에서 서로 다르다. 이번 PR(라운드 1·5 모두)의
  신규 주석은 §R4 를 인용하며 정확한 이름(`remove()`)을 쓰므로 이 PR 이 드리프트를 만들지도,
  악화시키지도 않았다 — 직전 라운드(13:04:59) 검토와 동일한 결론이며 라운드 5 에서 이 절을
  건드리지 않았으므로 상태 변화 없음.
- 제안: `spec/conventions/secret-store.md` §R4 의 `TriggersService.delete()` 를
  `TriggersService.remove()` 로 정정 — 이 PR 의 scope(diff-base `spec/conventions` 델타 0)
  밖이라 이번 PR 에서 요구하지 않는다. `project-planner` 턴에서 처리 권장 (반복 지적이므로
  다음 세션이 다시 잡아내는 비용을 줄이려면 지금 처리하는 편이 낫다).

### 검토했지만 위반 없음

- **리뷰 인용 형식** (`spec/conventions/review-citations.md` §2/§3): 라운드 5 가 추가한 두
  주석 모두 전체 경로 형식을 쓴다 — `` `/ai-review` `review/code/2026/09/14/13_04_49` side_effect INFO#4 ``,
  `` `origin/main` 에도 있던 기존 결함 · `/ai-review` `review/code/2026/09/14/13_04_49` documentation WARNING#1 ``.
  bare `hh_mm_ss` 없음. 적용 대상(`codebase/**` 의 `//` 주석)과 정확히 일치하고, 대상이
  응답 DTO 의 `/** */` JSDoc 도 아니므로(`trigger-secret-columns.spec.ts`·
  `trigger-workflow-ref.spec.ts` 모두 `describe`/`it` 옆 `//`·블록 주석) §3 의 DTO 예외
  문제도 없다.
- **DTO/Swagger 규약** (`spec/conventions/swagger.md`): 라운드 5 는 순수 주석 편집이며 DTO·
  엔드포인트·데코레이터를 전혀 건드리지 않는다. 대상 없음.
- **`secret-store.md` 가 예고한 드리프트 방지 장치**: 라운드 1(`efb0e4b36`)에서 신설된
  `trigger-secret-columns-guard.ts`/`trigger-secret-columns.spec.ts` 는 `secret-store.md`
  69~77행이 스스로 경고해 둔 "정본-사본 3자리 함께 갱신" 위험을 AST 로 강제한다. 명명
  (`<name>-guard.ts` + `<name>.spec.ts`)도 기존 `redis-fail-open-catalog-guard.ts`/
  `masked-reject-callers-guard.ts` 선례와 정확히 일치 — 실측 확인(`ls repo-guards/__tests__/`).
  라운드 5 는 이 구조를 바꾸지 않았다.
- **`nullable-type-lie-cast` 가드 인용의 정확성**: 라운드 5 신규 주석이 "`let tmp!: string`
  은 이 저장소의 `nullable-type-lie-cast` 가드가 겨누는 형태"라고 주장 — 실제로
  `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` /
  `nullable-type-lie-cast.spec.ts` 가 존재함을 확인. 인용 대상이 실재하며 오기재 없음.
- **명명 규약**: 라운드 5 는 신규 파일을 추가하지 않았다(기존 두 파일의 주석 편집뿐). 대상 없음.

## 요약

라운드 5(`7420cede1`)는 `codebase/` 기준 두 테스트 파일의 **주석만** 편집했다 — 직전
`/ai-review` INFO 를 적용했다가 타입체크 ratchet 회귀(사용처 10곳)로 철회한 판단과, self-spec
헤더의 자리 수 서술을 제거하고 형제 e2e 를 SoT 로 가리키도록 바꾼 판단을 코드 주석에 남긴
것이다. 두 편집 모두 `review-citations.md` 의 전체 경로 인용 형식을 지켰고, DTO/Swagger·
node-output 등 다른 정식 규약 표면을 건드리지 않는다. 유일한 잔여 발견은 `secret-store.md
§R4` 의 메서드명 자기모순으로, 이 PR 이전부터 있었고 이번 PR 이 만들지도 악화시키지도 않았으며
라운드 5 도 그 절을 건드리지 않아 상태 변화가 없다 — 비차단 INFO 로 유지한다.

## 위험도

LOW
