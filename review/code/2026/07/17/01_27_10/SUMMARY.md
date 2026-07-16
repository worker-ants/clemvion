# Code Review 통합 보고서 — fix 커버 재리뷰

**성격**: 직전 리뷰 [`../01_07_43/SUMMARY.md`](../01_07_43/SUMMARY.md) (LOW, Critical 0, Warning 6) 의
**fix 커밋 `fdd206ee8` 을 커버하는 재리뷰**. 원 리뷰가 보지 못한 코드(리뷰 이후 추가된 변경)를
검증하는 것이 목적 — Stop 가드(`review_guard.py`)가 정확히 이 갭을 지적해 수행했다.

리뷰 대상 diff: `89c4b1f6b..HEAD` — 코드 3파일 + CHANGELOG, 총 26줄.

1. `href.ts` — `WORKSPACE_ROUTE_SEGMENT = "w"` 상수 신설 + `buildWorkspaceHref` 가 사용 (원 W#3)
2. `(main)/[...rest]/page.tsx` — 그 상수를 import 해 `rest[0]` 판별에 사용 (원 W#3)
3. `e2e/workspaces/slug-routing.spec.ts` — 404 테스트에 실제 not-found UI 렌더 assertion 추가 (원 W#5)
4. `CHANGELOG.md` — Unreleased 절 추가 (원 W#6)

## 전체 위험도
**LOW** — Critical 0건. 4개 reviewer 중 3명(maintainability·side_effect·testing) NONE,
documentation 만 LOW(Warning 1, CHANGELOG 스타일). **fix 가 새 결함을 유입하지 않았음이 확인됐고,
원 리뷰의 W#3·W#5·W#6 이 실제로 해소됐다.**

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 조치 |
|---|----------|----------|------|------|
| 1 | Documentation | 신규 CHANGELOG 절이 말미의 통합 `SoT:` 트레일러 문장 없이 끝남. 이 파일의 spec-인용 절 대다수(`:31`·`:37`·`:71`·`:83` 등)는 `SoT: \`spec/….md §X\`.` 로 절을 닫는 것이 사실상 표준이라 스캔성이 떨어짐 | `CHANGELOG.md:3-12` | **fix** — `SoT: _layout.md §2.2 · 9-user-profile.md §3 · 11-error-empty-states.md §1.3` 트레일러 추가 |

## 참고 (INFO) — 발췌

| # | 카테고리 | 발견사항 | 처분 |
|---|----------|----------|------|
| 1 | Documentation | `> 검증:` 블록쿼트 분리는 이 파일에서 드문 패턴(전체 2건)이나, "unit 은 이 클래스를 원리적으로 증명 못 한다"는 한계를 눈에 띄게 하는 효과가 있어 단순 스타일 편차로 판정 | 유지 |
| 2 | Side Effect | `buildWorkspaceHref` 출력 문자열이 상수 도입 전후 **완전 동일**함을 확인(30+ 소비처 회귀 없음). 신규 `export` 도 기존 API 를 깨지 않음 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 확인 |
|----------|--------|-----------|
| maintainability | NONE | W#3 해소 확인 — 상수가 생성부·판별부 결합을 명시. docstring 이 실제 코드(두 소비처·두 라우트 그룹)와 전부 대조 일치. stale 주석 없음 |
| side_effect | NONE | 공용 헬퍼(`buildWorkspaceHref`, 30+ 소비처) 출력 불변 확인 — 순수 리팩터. 전역/네트워크/시그니처 부작용 없음 |
| testing | NONE | W#5 해소 확인 — 404 heading + 사이드바 유지 assertion 이 "조용한 blank 렌더" 통과 구멍을 실제로 막음. flaky·구현세부 과결합 아님(playwright 51/51 통과) |
| documentation | LOW | CHANGELOG 절이 관행(굵은 요약·번호 목록·근본원인·미채택 대안·spec 인용)을 충실히 따름. `SoT:` 트레일러만 누락(Warning 1) |

## 라우터 결정

router 미호출(알려진 Workflow router 매핑 버그 회피). main 이 **fix diff 의 성격에 맞춰 4명 선별**:

- **실행**: `maintainability`(W#3 상수화 대상), `side_effect`(공용 헬퍼 출력 불변 검증),
  `testing`(W#5 assertion 강화 검증), `documentation`(W#6 CHANGELOG 검증)
- **제외 사유**: fix diff 는 원 리뷰가 이미 전수 검토한 라우팅 로직의 **표현만 바꾼 것**(상수 추출·
  테스트 assertion·문서)이고 동작 변경이 없다. `security`(신규 입력·권한 경로 없음)·`requirement`
  (기능 요구 변경 없음, 원 리뷰에서 검증 완료)·`scope`(fix 는 원 리뷰 지적에 1:1 대응)·
  `user_guide_sync`(원 리뷰에서 doc-sync-matrix 21 trigger 전수 미매칭 확정)·
  `performance`/`architecture`/`dependency`/`database`/`concurrency`/`api_contract`(해당 없음).
