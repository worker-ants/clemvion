# RESOLUTION — 2026-08-10 00:04:39 (타겟 재리뷰)

직전 라운드(`23_43_28`) fix 가 codebase 2파일을 건드려 push gate 가 stale 로 막았다.
그 2파일만 타겟 재리뷰. SUMMARY: Critical 0 · WARNING 2 (reviewer 6/6, forced 전원 확보).

## WARNING 2/2 조치

### W1 — 스캔 소스가 둘로 갈려 있었다 (maintainability · testing · requirement 수렴)

**지적**: `plan-frontmatter.test.ts` 상단 주석이 "`collectLivePlanMarkdown` 은
`collectTopLevelPlans` 와 같은 top-level 스코프" 라고 주장하는데, 실제로는 전자가
`0-`/`_` 접두 인덱스 파일을 **거르지 않아** 둘이 어긋나 있었다. 게다가 그 파일은
`collectLivePlanMarkdown` 을 import 하면서도 `collectTopLevelPlans` 를 손으로 재구현해,
**자기 상단 주석이 경고하는 "두 곳이 조용히 틀어진다" 를 스스로 재현**하고 있었다.

내가 쓴 문서가 구현보다 넓었던 경우다 — 이 저장소가 반복해 학습한 클래스.

**조치**: 접두 면제 규칙을 `collectLivePlanMarkdown` 한 곳으로 옮기고,
`collectTopLevelPlans` 는 그 결과에서 절대경로만 뽑는 **파생**으로 축소했다. 스캔 소스가
하나가 되어 두 검사(frontmatter · 링크)가 같은 집합을 본다.

### W2 — 신규 진입점에 negative-path 픽스처 부재 (testing)

**지적**: 자매 진입점 둘은 `spec-links.test.ts` 에 픽스처 테스트를 갖는데
`findBrokenPlanLinks` 만 없었다. 실저장소 가드는 positive-only("위반 0건")라 **스캐너가
작동한다는 증거가 아니다**.

**조치**: 같은 파일에 임시 저장소 픽스처 5건 추가 — 이동이 남긴 DEAD 형제 링크 탐지 ·
코드펜스 내 링크 무시 · self-anchor 무시 · top-level 스코프(하위 폴더/`0-`/`_` 제외) ·
정상 경로 0건.

## 뮤테이션 3/3 RED — 그 과정에서 **내 테스트 하나가 vacuous 였다**

| 뮤턴트 | 결과 |
|---|---|
| `0-`/`_` 접두 필터 제거 | RED (`top level only`) |
| `checkSelfAnchors` 를 `true` 로 | **초판 GREEN → 픽스처 수정 후 RED** |
| 스캐너가 빈 배열 반환 | RED (`DEAD sibling`) |

self-anchor 픽스처가 `#live-plan` 이었는데 그 문서의 헤딩이 `# Live Plan` 이라 **실제로
해소되는 앵커**였다. 검사를 켜도 위반이 안 나므로 "무시된다" 단언이 제3상태에서 참이 되는
형태 — 이 저장소가 이름 붙여 둔 vacuous 4형태 중 하나다. 없는 헤딩(`#no-such-heading`)으로
바꿔 뮤턴트가 죽는 것을 확인했다. **리뷰가 아니라 뮤테이션이 잡았다.**

## INFO — 미조치 (전부 실측 0건 또는 강제 아님)

경로 경계 검증(현 신뢰 모델상 무해) · `walkDir` 유틸화(6번째 스캐너 시) · violation 생성
헬퍼화 · `isExternal` 죽은 분기 · 매직넘버 상수화 · `TERMINAL_STATUSES` 희소 어휘 픽스처 ·
completed frontmatter 파싱 실패 침묵 · 비-문자열 status · 거울상 미검사.
앞 라운드에서 이미 판단한 둘(비-문자열 · 거울상)은 재확인만 했다.

## 검증

- 문서 가드 **18파일 / 2828 tests PASS** (2823 → 2828, 픽스처 5건 증가)
- 뮤테이션 3/3 RED
- e2e — 아래 줄
