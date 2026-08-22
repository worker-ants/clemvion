# 부작용(Side Effect) 리뷰

## 리뷰 범위 요약

이번 diff(22 파일, `origin/main..HEAD`)는 **프로덕션 코드 변경이 없다.** 실제 구성:

1. `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` — 테스트 전용 추가(신규 `describe('깊이 상한 경계 (MAX_REDACT_DEPTH)')` 블록 8개 `it` + `MAX_REDACT_DEPTH` import 1개). `sanitize-error-message.ts` 자체는 diff 에 없음 — 직접 `Read` 로 열어 현재 HEAD 상태가 프로덕션 로직 변경 없이 그대로임을 확인했다(`DEEP_REDACT_CACHE`/`deepRedactCore`/`deepRedactObject`/`redactSecretsInJsonString` 전부 기존과 동일).
2. `plan/complete/*.md`(2건 신규) / `plan/in-progress/*.md`(2건 삭제) — plan lifecycle 이동(`in-progress` → `complete`, 두 선행 PR #1190/#1191 이 이미 머지된 데 대한 stale 상태 정정).
3. `review/code/2026/08/22/16_07_45/**`(11건) — 직전 `/ai-review` 라운드 산출물 + RESOLUTION.md.
4. `review/consistency/2026/08/22/15_35_56/**`(8건) — 착수 전 `consistency-check --impl-prep` 산출물.

프로덕션 로직 파일(`sanitize-error-message.ts`, `websocket.service.ts`, `strip-external-only-fields.ts` 등)은 이번 diff 에 포함되지 않는다. 따라서 함수 시그니처 변경·공개 API 변경·환경 변수·네트워크 호출·이벤트/콜백 관점은 해당 사항 없음.

## 발견사항

- **[INFO]** 신규 테스트가 의존하는 모듈 레벨 캐시(`DEEP_REDACT_CACHE`)와의 상호작용을 직접 소스 대조로 재확인
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` 신규 `describe('깊이 상한 경계 (MAX_REDACT_DEPTH)', ...)` (게이트 274~383) / 근거 소스: `codebase/backend/src/shared/utils/sanitize-error-message.ts:202`(`const DEEP_REDACT_CACHE = new WeakMap<object, unknown>();`), `:222-235`(`deepRedactSecrets`, depth===0 전용 캐시)
  - 상세: `deepRedactSecrets` 는 `depth === 0 && typeof value === 'object'` 인 최상위 호출 인자에서만 `WeakMap` 을 조회/기록한다. 신규 블록의 `PLAIN_SUBTREE`(게이트 299, `describe` 콜백 실행 시 1회 생성돼 그 안의 모든 `it` 이 **같은 참조**를 공유)는 항상 `nestObj`/`nestArr`/`nestMixed` 로 감싸진 **하위 잎**으로만 전달되고, 이 세 헬퍼는 매 호출 새 wrapper 객체를 루프로 생성하므로 `deepRedactSecrets` 에 전달되는 depth-0 루트는 매 `it` 마다 새 참조다. 즉 캐시 키가 매번 새 객체라 서로 다른 테스트의 기대값이 캐시를 통해 오염될 경로가 없다. `deepRedactObject` 의 copy-on-change 설계(변경 없는 서브트리는 원본 참조를 그대로 반환)로 인해 `PLAIN_SUBTREE` 참조 자체가 결과값 안에 그대로 나타날 수 있으나, 어느 쪽 코드도 이를 mutate 하지 않으므로(구조 비교 `toEqual` 만 사용) 실질 위험은 없다.
  - 제안: 조치 불필요. 확인 기록.

- **[INFO]** plan/`review/**` 신규 파일 추가는 프로젝트 컨벤션상 의도된 문서 산출물
  - 위치: `plan/complete/masked-marker-shared-package.md`, `plan/complete/mirror-guard-single-copy.md`, `plan/in-progress/masked-marker-shared-package.md`(삭제), `plan/in-progress/mirror-guard-single-copy.md`(삭제), `review/code/2026/08/22/16_07_45/*`(11건 신규), `review/consistency/2026/08/22/15_35_56/*`(8건 신규)
  - 상세: `plan/` 이동은 CLAUDE.md 가 규정한 plan lifecycle(`in-progress` → `complete`)이고, `review/**` 는 gitignore 대상이 아니라 `/ai-review`·`/consistency-check` 의무 절차의 필수 증적으로 커밋되는 것이 정책이다(`.claude/docs/plan-lifecycle.md`). 이번 라운드는 직전 `16_07_45` 리뷰의 RESOLUTION(트래커 무관 커밋 `5d5d4565f` 를 `git rebase --onto` 로 드롭)이 실제로 적용됐는지 `git diff --name-only`(위 명령 재실행 결과)로 재확인했고, `spec-sync-external-interaction-api-gaps.md` 는 현재 diff 목록에 없다 — RESOLUTION 이 주장한 축소가 실측과 일치한다.
  - 제안: 조치 불필요.

- **[INFO]** 스택오버플로 회귀 테스트가 5,000-깊이 트리를 두 번(`not.toThrow()` + `toEqual()`) 생성·순회 — side-effect 카테고리로는 실질 영향 없음
  - 위치: `sanitize-error-message.spec.ts:377-382`
  - 상세: `run()` 클로저가 호출마다 새 트리를 만들 뿐 전역/공유 상태를 남기지 않는다. 실제 재귀는 `MAX_REDACT_DEPTH`(10)에서 조기 종료되므로 stack 문제 없음. (동일 관찰이 maintainability/testing 리뷰에도 있음 — 여기서는 side-effect 관점에서만 재확인.)
  - 제안: 조치 불필요.

## 확인한 것 (부작용 없음)

- `process.env` / `fs.*` / `require(` / `global(This)` / `jest.mock` / `jest.spyOn` / `beforeAll` / `afterAll` / `beforeEach` / `afterEach` — 신규 테스트 파일 전체에서 grep 0건. 환경 변수·파일시스템·모킹·훅 부작용 없음.
- `sanitize-error-message.ts` — 이번 diff 에 없음을 직접 `Read` 로 재확인(HEAD 상태가 클린). 직전 라운드 `requirement.md` 가 기록한 "공유 worktree 뮤테이션 충돌 후 `git checkout --` 로 원복" 운영 메모와 무관하게, 현재 커밋 시점 소스는 정상 상태다.
- 신규 `describe` 블록 안 지역 헬퍼(`nestObj`/`nestArr`/`nestMixed`)와 `PLAIN_SUBTREE` 는 파일 스코프가 아니라 `describe` 콜백 스코프에 선언돼 다른 `describe`/파일로 누출되지 않는다.
- `MAX_REDACT_DEPTH` import 는 기존에 이미 export 되어 있던 심볼(`sanitize-error-message.ts:128`)을 스펙 파일이 추가로 가져다 쓰는 것뿐이라 공개 인터페이스 변경이 아니다.

## 요약

프로덕션 소스 변경이 전혀 없는 테스트 전용 + plan lifecycle 문서 + 리뷰 산출물 diff다. 신규 8개 `it`(깊이 상한 경계 7종 + 스택오버플로 회귀 1종)가 의존하는 모듈 레벨 `WeakMap` 캐시(`DEEP_REDACT_CACHE`, depth-0 키)를 실제 구현과 대조 확인한 결과, 테스트 헬퍼가 매 호출 새 루트 객체를 생성하므로 `PLAIN_SUBTREE` 같은 공유 leaf 참조가 캐시 오염이나 테스트 간 상태 누출로 이어지지 않는다. 전역 변수 신설, 함수 시그니처/공개 API 변경, 환경 변수, 네트워크 호출, 이벤트/콜백 변경은 모두 해당 사항이 없다. plan/`review/**` 파일 추가·이동은 저장소가 명시적으로 규정한 워크플로 산출물이며, 직전 리뷰 RESOLUTION 이 주장한 트래커 커밋 드롭도 `git diff --stat` 재실측으로 확인됐다.

## 위험도
NONE
