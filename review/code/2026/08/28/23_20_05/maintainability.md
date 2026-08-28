# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** lockfile 들여쓰기 폭(2/4/6칸)이 세 정규식에 매직 넘버로 흩어져 있다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock-guard.ts:106` (` {2}` 키 정규식), `:115`(` {4}` peerDependencies 정규식), `:123`(` {6}` eslint 정규식) — `readPeerRanges` 함수
  - 상세: 세 정규식이 "키=2칸, peerDependencies=4칸(키+2), eslint=6칸(peerDependencies+2)" 라는 하나의 YAML 들여쓰기 규약을 공유하는데, 그 관계가 코드에 이름으로 드러나지 않고 각 정규식 리터럴에 숫자로만 박혀 있다. lockfile 포맷(pnpm 버전업 등)이 들여쓰기를 바꾸면 세 곳을 동시에 정확히 맞춰 고쳐야 하는데, 어느 하나만 고치는 부분 수정이 조용히 통과할 위험이 있다(회귀 fixture 는 있지만 "왜 2/4/6 인가"를 설명하는 이름은 없다).
  - 제안: `const INDENT = 2;` 류로 기준 폭 하나만 이름 붙이고 나머지 둘을 `INDENT*2`, `INDENT*3` 로 파생시키거나, 최소한 각 정규식 옆 주석에 "부모 블록 대비 +2칸" 관계를 명시. 지금도 주석은 있지만 세 정규식을 묶는 불변식은 코드가 아니라 사람의 기억에 있다.

- **[INFO]** `BLOCKERS` 배열의 "upstream" 세 항목이 `lever` 문자열을 완전히 동일하게 3회 반복
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock-guard.ts:92`, `:97`, `:102` (`BLOCKERS` 상수, `eslint-plugin-react`/`eslint-plugin-jsx-a11y`/`eslint-plugin-import` 항목)
  - 상세: `"상류 릴리스 대기 — \`eslint-config-next\` 가 끌고 오는 전이 의존"` 리터럴이 세 객체에 그대로 복붙돼 있다. 데이터 중복이라 로직 결함으로 이어지지는 않지만, 문구를 고칠 일이 생기면 세 곳을 손으로 맞춰야 하고 하나만 고치면 drift 가 생긴다.
  - 제안: `const UPSTREAM_LEVER = "..."` 상수 하나로 뽑아 세 항목이 참조하게 하면 단일 진실원 문제가 사라진다.

- **[INFO]** `it.each(BLOCKERS)` 콜백의 실패 메시지가 이모지·다중 라인·다음 행동 안내를 한 템플릿 리터럴에 압축해 담고 있어 테스트 로직과 사용자 안내 문구가 강하게 얽혀 있다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock.test.ts:83`-`92` (`allowsEslint10(entry!.eslintPeer)` 단언의 두 번째 인자)
  - 상세: 형제 가드 `typescript-toolchain.test.ts` 의 실패 메시지는 대부분 한 줄인 데 비해, 이 메시지는 7줄 템플릿 리터럴이다. 가드의 "역방향 캐너리" 성격상 발견 시 사람이 바로 다음 행동을 알아야 한다는 의도는 이해되지만, 콜백 본문에서 단언 로직과 안내 텍스트를 시각적으로 분리하기 어렵다.
  - 제안: 메시지 조립을 `describeUnblockMessage(name, kind, lever, entry)` 같은 헬퍼로 뽑으면 `it.each` 콜백은 판정 로직만 남아 더 읽기 쉬워진다. 다만 심각도는 낮음 — 현재도 주석과 구조로 의도가 충분히 전달된다.

- **[INFO]** `readPeerRanges` 의 지역 변수명(`wanted`, `current`, `out`)이 함수 스코프 밖에서는 의미가 즉시 와닿지 않는다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock-guard.ts:98`-`101` (`readPeerRanges` 함수 본문)
  - 상세: 함수가 짧고 JSDoc 이 충실해 실제 이해에 지장은 없으나, `wanted` → `wantedNames`, `current` → `currentPkg` 등으로 조금 더 구체화하면 형제 가드 파일(`typescript-toolchain-guard.ts`)의 변수 네이밍 밀도와 더 맞는다.
  - 제안: 선택 사항. 지금 이름도 로컬 스코프 안에서는 충분히 명확하다.

## 요약

두 신규 파일(`eslint10-unblock-guard.ts`, `eslint10-unblock.test.ts`)은 이 저장소의 기존 repo-guard 컨벤션(순수 로직/테스트 분리, `_shared.ts` 재사용, fail-closed 예외 정책, 합성 fixture 로 파서 자체를 고정)을 그대로 따르고 있으며 형제 파일 `typescript-toolchain-guard.ts` 와 스타일·구조가 일관된다. 각 함수는 단일 책임을 가지고 길이도 적정하며(가장 긴 `readPeerRanges` 도 40줄 내외), 중첩 깊이도 최대 3단계로 과도하지 않다. JSDoc 이 "왜 이렇게 했는가"를 각 함수마다 상세히 남겨 가독성이 높다. 발견된 항목은 모두 INFO 수준으로, lockfile 들여쓰기 폭이 세 정규식에 이름 없는 매직 넘버로 흩어져 있는 점과 `BLOCKERS` 의 동일 `lever` 문자열 3회 반복이 향후 drift 가능성을 남긴다는 정도이며, 즉각 수정이 필요한 구조적 결함은 없다. `plan/in-progress/deps-peer-gating-and-eslint10.md` 의 변경은 취소선으로 원문을 보존하고 정정을 그 자리에 국한한 문서 위생이 양호하다.

## 위험도

LOW
