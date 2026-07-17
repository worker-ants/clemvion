# RESOLUTION — review/code/2026/07/17/18_02_39

위험도 LOW · Critical 0 · Warning 3 · forced 8/8 커버리지 확보.

본 라운드는 직전 전수 라운드(`17_00_55`)의 fix 커밋(`a8c946056`)에 스코프를 맞춘 델타 리뷰다.
전수 라운드 이후 바뀐 코드가 그 커밋 하나뿐이라 리뷰 대상도 정확히 그 7파일이다.

## 조치 항목

| SUMMARY # | 판정 | 조치 | 근거 |
|---|---|---|---|
| W#1 plan SHA 오인용 | **수정** | `plan/…/is-conversation-output-restructure.md:244` 의 `f17fc18dd` → `f0ef4a821` | **리뷰어 지적이 맞다 (실측 확인)**. `git show f17fc18dd --stat -- codebase/frontend/src/lib/conversation/interaction-type-registry.ts` 가 **빈 diff** — 그 커밋은 이 파일을 건드린 적이 없다. `git log --diff-filter=A` 로 신설 커밋이 `f0ef4a821` 임을 확인. 같은 문서 226행이 동일 커밋을 `f0ef4a821` 로 올바르게 인용하고 있어 문서가 자기모순이었다. 직전 라운드의 resolution-applier 가 각주를 쓰며 넣은 오류다. |
| W#2 JSDoc "all four shapes" | **수정** | `output-shape.ts` 의 `isConversationOutput` JSDoc 을 실제 분기에 맞게 재작성 | **리뷰어 지적이 맞다 (실측 확인)**. 실제 인식 경로는 early-return 2개(top-level `interactionType` / `conversationConfig`) + OR-체인 4개(`hasLegacyMessages && (outputInteraction \|\| metaInteraction)` / `hasConvConfig` / `looksLikeConversationEnd` / `isCanonicalWaiting`) 인데 JSDoc 은 4개만 열거했고, **하필 이 PR 의 주제인 `looksLikeConversationEnd`(post-Stage-5 `output.result.messages` + endReason 화이트리스트) 가 목록에 없었다**. 이 PR 의 논지가 "가드·문서의 거짓 서술이 실제 버그를 낳았다"(E-6 이 그런 거짓 보증을 정정)인데 그 게이트 함수 자신의 주석에 부정확한 열거를 남기는 건 같은 실수다. 고정 개수("four") 주장을 제거하고 누락 분기 2개를 추가했으며, **분기가 authoritative 이고 주석은 그것을 bound 하지 않는다**고 명시해 다음 사람이 이 목록을 완전한 것으로 과신하지 않게 했다. |
| W#3 CHANGELOG.md 누락 | **미채택** (사용자 결정) | 조치 없음 | **리뷰어의 근거가 실측으로 반증됐다.** 리뷰어는 "직전 15개 머지 커밋 100% 가 이 컨벤션을 준수" 라 했으나, 실측 결과 직전 12개 머지 커밋 중 **CHANGELOG.md 를 건드린 건 2건뿐**(`5de44d4d6`, `ab19fef67`)이다. 나머지 10건은 사용자 가시 fix 를 포함해 추가하지 않았고, **사용자 제보 버그였던 직계 선행 #959(Inv-8, 대화 미리보기 소실)·#961 조차 넣지 않았다**. 규약은 `PROJECT.md`·`CLAUDE.md`·`.claude/config/doc-sync-matrix.json` 어디에도 문서화돼 있지 않고 CI 강제도 없다(grep 0건). 게다가 기존 CHANGELOG 항목들은 사용자 가시 변경·동작 변경을 서술하는데 **이 PR 은 명시적으로 동작 무변경**(E-3·E-4)이라 성격이 맞지 않는다 — 유일한 동작 델타인 `timeout` 수용은 생산자가 없는 죽은 값이라 도달 불가. 사용자가 미추가를 결정. |

## 미채택 (INFO — 조치 불요 판정)

| # | 사유 |
|---|---|
| INFO#1 README 표제 불일치 | 리뷰어 실측이 맞다 — `chat-channel-validation` 엔 `## 빌드` 가 없어 "형제 4개 전부 동일" 은 과장이었다. 다만 기능 영향 0 이고 5개 패키지 README 표제 통일은 이 PR 범위 밖. |
| INFO#2 Dockerfile 개수 주석 무가드 | 타당. 개수 리터럴 자체를 없애거나 가드하는 건 별건 — 후속 칩 `Guard package-registration lists against drift` 와 같은 계열이라 그쪽으로 흡수된다. |
| INFO#3 `hasResultMessages` 고립 분기 테스트 | `&&` 단락평가로 현재 안전. 이 함수를 다시 만질 때 권장 — OR-체인 재설계 백로그와 함께. |
| INFO#4 OR-체인 복잡도 | plan 이 명시한 의도적 범위 축소(E-4 "동작·조건 무변경"). 기존 백로그로 추적 중. |
| INFO#5 루트 README/PROJECT.md 의 stale 패키지 예시 | `ai-end-reason` 도입 이전부터 존재한 staleness. 범위 밖. |
| INFO#6·#7·#8 | 조치 불요 판정(보안 결함 아님 / 의도적 belt-and-suspenders / 의존성 변경 없음). |

## 검증

마지막 코드 커밋 이후 실행:

- `.claude/tools/run-test.sh lint` — PASS
- `.claude/tools/run-test.sh unit` — PASS (backend jest 8222 · frontend vitest 279 files · `@workflow/ai-end-reason` 5)
- `.claude/tools/run-test.sh build` — PASS
- `.claude/tools/run-test.sh e2e` — PASS (backend supertest 256 / 45 suites · **playwright 51 passed**)

W#2 는 JSDoc 전용 변경이라 런타임 표면이 없다 — 그럼에도 위 4단계를 마지막 코드 커밋 뒤에 재실행해 통과 줄을 남긴다 (PROJECT.md §"마지막 코드 commit 다음에 e2e 통과 줄이 있어야 한다").

## 후속 (칩 등록 완료)

- `Guard package-registration lists against drift` — 내부 패키지 등록 목록 4곳의 손 유지 drift 가드 (이번 세션에서 실제로 2곳 누락 발생).
- `Generify ResumableNodeHandler endReason type` — W#3(17_00_55 라운드) 후속. 파라미터만 넓히면 bivariance 로 악화되므로 제네릭화 필요.
- `Harden interaction-type grep guard regex` — 백틱 주석 오매칭 사각지대.
