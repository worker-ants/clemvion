# 문서화(Documentation) 리뷰 — frontend layering guard 후속 fix + 리뷰 산출물 커밋

## 검증 방법

정적 리뷰에 더해 실제 파일 상태를 직접 확인했다:
- `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` 전체를 읽고 `npx vitest run` 으로 51/51 통과 확인 (RESOLUTION.md 의 "47→48→51" 산식과 일치).
- `codebase/frontend/eslint.config.mjs` 의 `LOWER_LAYERS`/메시지 상수 정의를 직접 확인.
- `spec/conventions/frontend-layering.md` §4/§4.1 의 PR 번호 각주 현재 상태를 직접 확인.
- `npx eslint eslint.config.mjs src/lib/__tests__/eslint-layering-guard.test.ts` → lint 클린.
- `git show 00b3b05a4` 로 이전 커밋의 실제 diff(해당 top-JSDoc 미갱신 여부) 교차 확인.

## 발견사항

- **[WARNING]** 파일 최상단 모듈 JSDoc 이 여전히 `src/lib/**` 단독 스코프만 기술 — 이번 라운드가 정확히 고친 것과 같은 종류의 staleness 가 몇 줄 위에 남아 있음
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:7-18`
  - 상세: 이번 diff(파일 1)는 fail-open 에러 메시지의 `files: ["src/lib/**"]` 하드코딩 리터럴을 `JSON.stringify(CONFIG_LOWER_LAYERS)` 파생으로 고치고(WARNING#2 fix), 블록 탐색 키 주석도 "레이어 가드 블록" 이라는 계층-중립 표현으로 갱신했다(`GUARD_BLOCK_KEY` 주석, L21-26). 그런데 바로 위, 파일 전체를 설명하는 모듈 JSDoc(L7-18)은 이 리팩터를 거치지 않아 여전히:
    - "Guard: `src/lib/**` 는 정적 import 뿐 아니라 ... 소비할 수 없다"
    - "`src/lib` 에 현재 위반이 0건이라 `npx eslint src/lib` 는 ..."
    - "픽스처를 ... `eslint.config.mjs` 의 실제 `src/lib/**` 블록 ... 을 그대로 가져와"
    처럼 `src/lib/**` 단독만 언급한다. 실제로는 `LOWER_LAYERS = ["src/lib/**", "src/types/**"]` 로 스코프가 확장된 지 이미 한 커밋(`00b3b05a4`) 지났고, 이 파일 자체에 `src/types` 전용 회귀를 검증하는 두 번째 `describe` 블록("가드 스코프 — 실제 ESLint 경로 매칭")까지 있다. 즉 파일을 처음 읽는 사람은 모듈 JSDoc 만 보고 "이 가드는 `src/lib` 전용" 이라고 오인할 수 있다 — 정확히 이번 라운드가 fail-open 메시지에서 고친 문제(오래된 스코프 리터럴이 확장된 실제 config 를 오기)와 같은 패턴이 한 블록 위에 미수정 상태로 남아 있는 것.
  - 제안: 모듈 JSDoc 의 `src/lib/**` 언급을 "레이어 가드(`src/lib/**` · `src/types/**`)" 나 `LOWER_LAYERS` 참조로 일반화하고, "`src/lib` 에 현재 위반이 0건" 부분도 두 계층을 포괄하는 표현으로 바꾼다. WARNING#2 fix 와 같은 커밋/PR 에서 함께 처리하기 좋은 대상이었다.

## 확인된 양호 사항 (참고)

- 이전 라운드(`review/code/2026/07/17/23_49_51/documentation.md`) WARNING("fail-open 에러 메시지가 옛 `files: ["src/lib/**"]` 리터럴 인용")은 이번 diff 에서 정확히 고쳐졌다 — `` `files: ${JSON.stringify(CONFIG_LOWER_LAYERS)}` `` 파생으로 전환, 실측(`CONFIG_LOWER_LAYERS` 현재 값)과 일치.
- 같은 라운드의 INFO#11(근접 오탐 케이스 부재)·INFO#12(`src/lib/types/` vs `src/types/` 혼동 회귀 부재)도 각각 `types-legacy`/`libs` 근접 케이스와 `src/lib/types/probe.ts` 케이스로 반영됐고, 새 주석("근접 디렉터리 — glob 이 앵커 없이 느슨해지면 여기 걸린다", "규약이 명시적으로 구분하는 두 'types 홈'")이 각 케이스가 왜 필요한지 명확히 설명한다.
- `GUARD_BLOCK_KEY = CONFIG_LOWER_LAYERS[0]` 도입에 대한 주석은 정확하다 — "하드코딩 리터럴이면 그쪽 glob 표기가 바뀔 때 조용히 어긋난다"는 근거가 실제 코드 동작과 일치.
- `spec/conventions/frontend-layering.md` §4/§4.1 의 PR 번호 각주 비일관(§4 는 "PR #969" 유지, §4.1 은 삭제)은 직전 라운드에서 이미 INFO 로 지적됐고 "조치 불필요(승격 편집 중간 상태 아니라 최종 정합)"로 처분됐다 — 이번 실측으로도 그 판단이 여전히 유효함을 확인(§4 본문 서술 성격상 PR 근거 남기고, §4.1 테스트 고정 목록은 근거 각주 없이도 의미가 통함). 새로운 문제는 아니므로 재차 차단 사유로 격상하지 않음.
- RESOLUTION.md 의 "51 케이스(47→48→51)" 수치를 `npx vitest run --reporter=verbose` 로 직접 재현 — 51/51 정확히 일치.
- 이번 diff 에 새로 추가된 21개 파일 중 20개는 `review/code/**`·`review/consistency/**` 산출물로, CLAUDE.md 가 규정한 저장 위치와 명명 규칙(`<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)을 정확히 따른다 — 별도 README/CHANGELOG 갱신 대상 아님.

## 요약

이번 라운드의 실질 변경(파일 1, `eslint-layering-guard.test.ts`)은 직전 `/ai-review` 가 지적한 WARNING#1(메시지 텍스트 미검증)·WARNING#2(fail-open 메시지 오래된 스코프 리터럴)·INFO#11·#12(근접 오탐/타입 혼동 회귀 부재)를 정확하고 실측 가능한 방식(51/51 통과, mutation 재현)으로 반영했다. 다만 그 fix 가 정확히 겨냥한 문제(스코프 확장 후 남은 `src/lib/**` 전용 문구)와 동일한 패턴이 파일 최상단 모듈 JSDoc 에 그대로 남아 있는 것을 새로 발견했다 — WARNING 1건. 나머지 20개 파일(이전 라운드 리뷰·컨시스턴시 체크 산출물)은 저장 위치·명명 규칙을 정확히 따르고 있고, 그 안의 문서화 관련 판단(§4/§4.1 각주 비일관 = 조치 불필요)도 실측 재확인 결과 유효하다. 차단 사유는 없음.

## 위험도

LOW
