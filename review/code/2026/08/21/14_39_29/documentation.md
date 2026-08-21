# 문서화(Documentation) Review — masked-marker-contract-7d2e14 (라운드 9, 14_39_29)

## 발견사항

없음 (CRITICAL/WARNING/INFO 모두 없음).

이 changeset 은 backend `sanitize-error-message.ts` 와 frontend `lib/utils/masked-markers.ts`
에 손으로 복제돼 있던 마스킹 마커 상수·판정 함수·깊이 상한을 신규 공유 패키지
`@workflow/masked-markers` 로 추출하는 순수 리팩터이며, 이미 8라운드(`11_27_29`~`14_19_12`)의
독립 문서화 리뷰를 거쳐 발견된 문제(경로 게이팅 갭 서술 누락, plan 체크박스 stale, 완료형
서술이 거짓, 인접 파일의 낡은 JSDoc 등)가 전부 처분·검증됐다. 이번 라운드에서 실제 소스를
직접 열어 재확인한 결과는 다음과 같다.

- `codebase/packages/masked-markers/src/index.ts` — export 4개(`VALUE_MASK_MARKER` 등)와
  `MASKED_MARKERS`·`isMaskedMarker`·`MAX_MASK_DEPTH` 전부에 "왜 공유 패키지인가"·"리터럴이
  같다고 같은 계약은 아니다"·"두 역할이 왜 같은 수를 공유하는가"를 근거·실측과 함께 담은
  JSDoc 이 있다. `README.md` 서사와 대체로 겹치지만 이는 이미 `14_19_12` 라운드에서 INFO
  로 확인·수용된 항목이라 재지적하지 않는다.
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` — `MAX_REDACT_DEPTH`(지역
  별칭)·`MASKED_MARKERS`·`isMaskedMarker` re-export 각각에 "이 값이 왜 로컬 재선언이 아니라
  패키지 SoT 를 가리켜야 하는가"가 정확히 남아 있고, spec 인용(`12-webhook §5.3`)도 유효한
  링크다.
- `codebase/frontend/src/lib/utils/masked-markers.ts` — "왜 컴포넌트에서 여기로 옮겼나
  (2026-08-20)" 이력, 정확 일치만 잡는 이유, `MAX_MASK_DEPTH` 상한을 공유하는 이유가 실측
  표(중첩 깊이별 `JSON.parse` vs 재귀 탐색 결과)와 함께 남아 있다. 값 검사를 깊이 검사보다
  먼저 해야 하는 이유("off-by-one 이 곧 fail-open")도 정확하다.
- `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts` /
  `.spec.ts` 와 frontend `masked-marker-mirror-guard.ts` / `.test.ts` — 두 사본이 "왜 둘로
  나뉘는가"(CI 경로 게이팅), "왜 리터럴이 아니라 심볼만 보는가"(오탐 방지, 독립 사용 마스커
  5곳 나열), 각 캐너리가 막는 구체적 회귀(`11_53_49`/`12_25_15`/`12_50_37`/`13_14_29`
  라운드 번호까지 인용)를 정확히 서술한다. 직접 대조한 결과 두 사본의 헤더·JSDoc 서사는
  구조적으로 대칭이고(구현 세부의 `SOT_DIR` 선언 스타일 차이만 있음 — 이는 `14_19_12`
  라운드에서 이미 INFO 로 확인·수용됨), stale 하거나 서로 모순되는 서술은 없다.
- `codebase/frontend/src/lib/utils/__tests__/masked-markers.test.ts` — 직전 라운드(`14_19_12`
  W1)가 지적한 "이미 닫힌 항목을 아직 열려 있다고 서술"하는 stale JSDoc 이 정확히 수정돼
  있다(종전 서술을 인용으로 보존하고 무엇이 바뀌었는지 명시).
- `spec/5-system/14-external-interaction-api.md` R17 절 — "마커 집합은 backend
  `sanitize-error-message.ts` 가 SoT" 라는 이관 전 서술이 "SoT 는 공유 패키지
  `@workflow/masked-markers`, 두 스택은 재export shim" 으로 정정됐고 frontmatter `code:`
  목록에도 패키지 경로가 정확히 추가돼 실제 코드와 spec 이 일치한다.
- `plan/in-progress/masked-marker-shared-package.md` — 체크리스트가 실제 상태와 일치한다
  (`- [ ] /ai-review` 하나만 미체크 — 이 리뷰 자체가 그 항목이므로 정상). 후속(이 PR 밖)
  항목 2건도 각각 이유·미룬 근거와 함께 명시적으로 등재돼 있어 `review/**` 산출물에만
  머무르는 유실 위험이 없다.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 두 트래커 항목(`:373`,
  `:757`)이 `[x]` 로 닫히며 "왜 계약 테스트가 아니라 추출을 택했는가"에 대한 대체 근거가
  같은 자리에 남아, 지운 게 아니라 대체했다는 이 저장소의 관례를 지켰다.
- CI/빌드 배선 8곳(`test-stages.sh`, `packages-checks.yml` pathspec/matrix/주석,
  `frontend-checks.yml` pathspec 확장, 두 backend/frontend `package.json`, 3개 Dockerfile
  COPY) — 등록 개수 서술(`packages-checks.yml` "5개 전부 등록" → "6개 전부 등록")과 실제
  matrix 항목 수가 일치하고, `frontend-checks.yml` 신규 주석이 "왜 `channel-web-chat` 경로를
  이 잡의 pathspec 에 추가했는가"를 정확히 설명한다.
- `CHANGELOG.md` — 이 PR 의 diff 에 포함되지 않았고(동작 무변경 내부 리팩터), 최신
  Unreleased 항목도 이 changeset 과 무관한 선행 기능(마커 재제출 서버측 거부)을 가리켜
  일관성 문제가 없다. 신규 사용자 가시 동작이 없으므로 CHANGELOG 갱신 불요 판단은 타당하다.
- README(`codebase/packages/masked-markers/README.md`) — import 경로·export 표·"이 패키지를
  바꾼다면" 섹션이 실제 `index.ts` export 표면과 정확히 일치하고, `MAX_SANITIZE_DEPTH`(WS)와
  혼동하지 말라는 경고까지 포함해 향후 편집자를 위한 실질적 사용 예제 역할을 한다.

## 요약

8라운드에 걸쳐 이미 다수의 문서화 결함(경로 게이팅 서술 누락, plan 체크박스 stale, 완료형
서술의 반증, 인접 테스트 파일의 낡은 JSDoc 등)이 발견·수정됐고, 이번 라운드에서 신규
공유 패키지의 핵심 산출물(README, index.ts JSDoc, 양쪽 미러 가드와 그 테스트, 재export
shim 2개, spec R17 정정, 두 plan 문서의 체크리스트)을 직접 열어 재검증한 결과 새로 발견된
문서화 결함은 없다. 공개 심볼마다 "무엇을"뿐 아니라 "왜"(설계 결정의 근거·기각된 대안·실측
수치)를 근접 주석으로 남기는 수준이 이례적으로 높고, backend/frontend 두 사본 간 서술도
대칭을 유지한다. CI 배선 변경의 주석(등록 개수 5→6, `channel-web-chat` pathspec 확장 사유)도
정확하다. CHANGELOG 는 이 PR 의 무변경 동작 특성상 갱신 불요 판단이 타당하다.

## 위험도
NONE
