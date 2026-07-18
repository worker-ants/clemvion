# 변경 범위(Scope) 리뷰

## 리뷰 대상 개요

이번 diff 는 21개 파일로 구성되나 실제 "코드" 변경은 1개(`codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts`)뿐이고, 나머지 20개는 두 개의 리뷰 세션이 생성한 산출물이다:
- `review/code/2026/07/17/23_49_51/**` (12개) — 직전 `/ai-review` 코드 리뷰 세션(대상: 커밋 `00b3b05a4`)의 SUMMARY/RESOLUTION/에이전트별 리포트
- `review/consistency/2026/07/18/00_22_41/**` (8개) — 같은 주제(`spec/conventions/frontend-layering.md` status 승격)에 대한 `--impl-prep`/`--impl-done` consistency-check 세션 산출물

RESOLUTION.md 에 따르면 이번 diff 의 유일한 코드 변경(`eslint-layering-guard.test.ts`)은 직전 리뷰의 WARNING #1(메시지 내용 미검증)·WARNING #2(fail-open 에러 메시지의 옛 리터럴 인용)·INFO #11(근접 오탐 케이스 부재)·INFO #12(`src/lib/types/` vs `src/types/` 혼동 케이스 부재) 4건을 그대로 이행한 fix 다.

## 발견사항

- **[INFO]** WARNING #2 조치가 명시적으로 요청된 것(에러 메시지 텍스트 갱신)보다 한 단계 넓은 리팩터를 동반함
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` (신설 `GUARD_BLOCK_KEY = CONFIG_LOWER_LAYERS[0]`, `layeringBlocks` 필터의 `"src/lib/**"` 하드코딩 → `GUARD_BLOCK_KEY` 치환)
  - 상세: 직전 리뷰 WARNING #2 의 지적 대상은 "fail-open 에러 메시지 문자열이 옛 리터럴을 인용한다"는 점뿐이었다. 이번 fix 는 그 메시지 문자열을 `JSON.stringify(CONFIG_LOWER_LAYERS)` 로 파생시키는 것에 더해, 블록 탐색 자체의 필터 predicate(`c.files.includes(...)`)에 쓰이던 하드코딩 리터럴도 `GUARD_BLOCK_KEY` 파생으로 바꿨다. RESOLUTION.md 는 이를 "겸사겸사"(부수적으로) 처리했다고 명시하며 근거(config glob 표기가 바뀔 때 조용히 어긋나는 결합 제거)도 남겨, 목적 없는 리팩토링은 아니다. 다만 엄밀히는 WARNING #2 항목이 요청한 범위(에러 메시지 텍스트 1건)를 살짝 넘어선 부수 변경이므로 스코프 관점에서 기록해 둔다. 위험도는 낮음 — 동일 파일 내, 동일 주제(옛 `"src/lib/**"` 하드코딩 제거)에 대한 직접적 파생 변경이라 무관한 영역 침범은 아니다.
  - 제안: 조치 불필요(허용 가능한 부수 변경). 향후 유사 fix 는 RESOLUTION.md 처럼 "겸사겸사" 항목임을 명시적으로 구분해 기록하는 현재 관행을 유지할 것.

- **[INFO]** diff 의 절대다수(20/21 파일)가 실제 코드가 아니라 두 리뷰 세션의 산출물
  - 위치: `review/code/2026/07/17/23_49_51/**`, `review/consistency/2026/07/18/00_22_41/**`
  - 상세: 코드 리뷰 산출물(`review/code/**`)과 일관성 검토 산출물(`review/consistency/**`)을 코드 변경과 같은 diff/커밋에 포함시키는 것은 CLAUDE.md 가 규정한 표준 워크플로(코드 리뷰어 → `review/code/**`, 일관성 검토자 → `review/consistency/**` 쓰기 권한, developer → `review/**/RESOLUTION.md`)와 직접 부합하며, 최근 커밋 히스토리(`caeeacadb`, `b74eb4e1a` 등)에서도 동일 패턴이 반복돼 이 프로젝트의 확립된 관례임을 확인했다. 따라서 이 자체는 스코프 위반이 아니다. 다만 순수하게 "이번 diff 가 무엇을 바꿨는가"를 훑는 사람 입장에서는 실질 코드 변경(테스트 파일 1개, 약 40줄)이 리뷰 메타문서 20개에 파묻혀 보일 수 있다는 점만 참고로 남긴다.
  - 제안: 조치 불필요 — 프로젝트 관례에 부합.

- **[INFO]** 두 산출물 세트가 서로 다른 세션(23_49_51 코드리뷰, 00_22_41 컨시스턴시체크)에서 왔지만 대상 주제가 동일(`frontend-layering.md` 승격 + `LOWER_LAYERS` 스코프 확장)
  - 위치: 전체 review/** 신규 파일
  - 상세: 두 세션 모두 동일 커밋(`00b3b05a4`, base `29aa918a6`)을 대상으로 하며 서로 독립적으로 실행됐지만 중복 관찰(예: §4/§4.1 PR 번호 각주 비일관 — code-review documentation INFO#13 과 consistency rationale_continuity/convention_compliance 가 각각 별도로 지적)이 존재한다. 이는 리뷰 프로세스 자체의 특성(다중 에이전트 fan-out)이며, 이번 diff 의 "변경 범위"를 벗어나는 문제는 아니다.
  - 제안: 조치 불필요.

### 확인된 사항 (문제 없음)

- 무관한 프로덕션 코드 파일 수정 없음 — 이번 diff 는 `eslint.config.mjs` 자체를 건드리지 않는다(그 변경은 선행 커밋 `00b3b05a4`에서 이미 완료됐고, 이번 diff 는 그 리뷰에 대한 fix + 문서 산출물뿐).
- `eslint-layering-guard.test.ts` 의 모든 변경 라인이 RESOLUTION.md 의 조치 항목(WARNING #1·#2, INFO #11·#12) 중 하나에 직접 대응되며, 근거 없는 추가 코드는 발견되지 않았다.
- 포맷팅 전용 hunk 없음 — 모든 diff 라인이 실질적 내용 변경(주석 갱신, 상수 도입, assertion 추가, 테스트 케이스 추가)을 동반한다.
- 임포트 변경 없음 — 이번 diff 에는 신규/삭제 import 문이 없다.
- 설정 파일(`eslint.config.mjs`, `package.json` 등) 변경 없음.
- 기능 확장(over-engineering) 없음 — 신설된 테스트 케이스(문구 회귀 고정, 근접 디렉터리 음성 케이스, `src/lib/types/` 케이스)는 전부 이전 리뷰가 명시적으로 지적한 커버리지 갭을 메우는 것이지 요청 외 새 기능이 아니다.

## 요약

이번 diff 의 실질 코드 변경은 `eslint-layering-guard.test.ts` 한 파일이며, 그 안의 모든 변경(메시지 상수 파생, 블록 탐색 키 파생, 문구 회귀 테스트, 근접/lib-types 경계 케이스)이 직전 코드 리뷰의 WARNING #1·#2 와 INFO #11·#12 에 1:1 로 대응돼 RESOLUTION.md 에 명시적으로 기록돼 있다. 블록 탐색 키를 하드코딩에서 파생으로 바꾼 것은 엄밀히는 WARNING #2 가 요청한 범위(에러 메시지 텍스트)보다 살짝 넓지만 동일 근본 원인(옛 `"src/lib/**"` 리터럴)에 대한 근거 있는 부수 변경이라 문제 삼을 수준은 아니다. 나머지 20개 파일은 두 리뷰 세션(코드 리뷰 + 일관성 검토)의 산출물로, 프로젝트가 CLAUDE.md 와 기존 커밋 히스토리로 확립한 정상 관례에 부합해 무관한 파일 수정으로 볼 수 없다. 무관한 리팩토링, 요청 외 기능 확장, 포맷팅/주석/임포트/설정의 잡음성 변경은 발견되지 않았다.

## 위험도
NONE
