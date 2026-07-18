# 변경 범위(Scope) 리뷰

## 검토 방법

리뷰 대상 두 파일의 실제 diff 를 fork-point(`463aee139`, `origin/main` 기준)부터 `HEAD` 까지 확인하고, 대응하는 plan(`plan/in-progress/interaction-type-guard-comment-false-negative.md`)의 체크리스트·후속 섹션과 대조했다.

```
git diff 463aee139..HEAD --name-only | grep -v '^review/'
  codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts
  codebase/frontend/src/lib/conversation/interaction-type-registry.ts
  plan/in-progress/interaction-type-guard-comment-false-negative.md
```

`review/**` 산출물(리뷰·consistency 세션 폴더)을 제외하면 실제 코드 변경은 리뷰 대상으로 지정된 정확히 그 두 파일뿐이고, 세 번째 파일은 plan 체크리스트 진행 기록(developer 가 `plan/**` 쓰기 권한 보유, 정상 절차)이다.

## 발견사항

없음 — 아래는 위 diff 를 8개 관점으로 대조한 근거.

- **의도 이상의 변경 / 무관한 수정**: 없음. 변경은 정확히 두 파일로 국한되고, 다른 소스·config·spec 파일은 건드리지 않았다.
- **불필요한 리팩토링**: `scriptKindForFile` 추출은 리팩토링처럼 보이나 plan 후속 체크리스트의 W1(`.tsx` 사이트에서 리터럴이 유실되는 파싱 결함) 수정 그 자체다 — 무관한 정리가 아니라 버그 수정의 본체.
- **기능 확장**: 없음. 추가된 3개 self-test(`union/property/ternary` 형태, regex 오수집 배제, `.tsx` 캐스트 대칭 테스트)는 모두 plan 이 명시한 `/ai-review` INFO #2·#3·#4 / WARNING #1·#2 재발 방지 대상과 1:1 대응하며, 새 프로덕션 기능은 추가되지 않았다.
- **포맷팅 변경**: `git diff` 상 실질 변경과 분리된 순수 공백/개행 전용 hunk 없음. 신규 `describe`/`it` 블록 사이 빈 줄은 기존 파일의 기존 스타일과 일치.
- **주석 변경**: `interaction-type-registry.ts` 의 "grep 가드" → "AST 가드" 문구 교정 3곳은 plan 의 명시적 developer 후속 항목(`/ai-review` INFO #1)이고, 실제 구현(정규식→TS AST, PR #972)과 문구를 맞추는 정정이라 스코프 안.
- **임포트 변경**: 없음(신규 import 추가/제거 없음, 기존 `ts`/`node:fs`/`node:path` import 그대로).
- **설정 변경**: 없음(`tsconfig`/`package.json`/lint 설정 등 미변경).

Plan 파일 자체의 diff 도 확인했는데, 체크박스 `[ ]→[x]` 갱신과 각 항목에 대응하는 리뷰 세션 경로(`review/code/2026/07/18/11_39_42`, `12_07_35`)를 사후 기록한 것뿐으로 코드 스코프와 무관한 문서 갱신이며 CLAUDE.md 의 "완료 후에만 체크하고 그 커밋에 포함" 규약에도 부합한다.

## 요약

두 파일의 모든 변경분(`scriptKindForFile` 추출, self-test 3종 추가, JSDoc 문구 정정)이 `plan/in-progress/interaction-type-guard-comment-false-negative.md` 의 "후속" 섹션에 사전 기록된 항목이며, 각각 이전 `/ai-review` 라운드의 특정 INFO/WARNING(INFO #1, INFO #2·#3·#4, WARNING #1·#2 1·2차)을 정확히 겨냥한다. `review/**` 산출물을 제외하면 코드 변경은 리뷰 대상으로 지정된 두 파일에만 국한되고, 포맷팅/임포트/설정 파일에는 손대지 않았다. 스코프 이탈 징후 없음.

## 위험도

NONE
