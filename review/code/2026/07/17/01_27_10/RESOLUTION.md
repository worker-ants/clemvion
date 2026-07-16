# RESOLUTION — fix 커버 재리뷰 (01_27_10)

대상 SUMMARY: `./SUMMARY.md` (LOW, Critical 0, Warning 1)
선행 리뷰: `../01_07_43/` (LOW, Critical 0, Warning 6) — 그 fix 커밋 `fdd206ee8` 을 커버.

## 조치 항목

| SUMMARY # | 카테고리 | 판정 | 조치 | commit |
| --- | --- | --- | --- | --- |
| W#1 | Documentation | **fix** | CHANGELOG 절 말미에 통합 `SoT:` 트레일러 추가 — `spec/2-navigation/_layout.md §2.2`(User Guide 의 slug 밖 예외) · `9-user-profile.md §3`(URL slug = FE 라우팅 SoT) · `11-error-empty-states.md §1.3`(존재하지 않는 라우트 → 404). 이 파일의 spec-인용 절 대다수가 `SoT:` 로 닫는 확립된 패턴이라 스캔성 측면에서 타당한 지적 | `4e2b0a1` |

INFO 2건은 리뷰어가 "유지/조치 불요"로 판정 — 미조치.

## 선행 리뷰(01_07_43) 지적의 해소 확인

본 재리뷰의 실질 목적. 독립 reviewer 가 fix 의 유효성을 확인했다:

| 원 지적 | 확인 결과 |
| --- | --- |
| W#3 세그먼트 리터럴 산재 | **해소** (maintainability=NONE) — 상수가 생성부·판별부 결합을 명시하고 docstring 이 실제 코드와 전부 대조 일치, stale 주석 없음 |
| W#5 e2e 404 가드 약함 | **해소** (testing=NONE) — 추가된 assertion 이 "조용한 blank 렌더" 통과 구멍을 실제로 막음. flaky·구현세부 과결합 아님 |
| W#6 CHANGELOG 누락 | **해소** (documentation=LOW) — 관행 충실. `SoT:` 트레일러만 보완(W#1) |
| (신규 회귀 여부) | **없음** (side_effect=NONE) — `buildWorkspaceHref` 출력이 상수 도입 전후 완전 동일, 30+ 소비처 회귀 없음 |

## TEST 결과

W#1 은 `CHANGELOG.md` **문서 1줄 추가**로 코드 변경이 아니다. 그럼에도 TEST WORKFLOW 를 재수행:

- **lint**: 통과
- **unit**: 통과 (5502 tests)
- **build**: 통과
- **e2e**: 통과 — backend 256/256 + playwright 51/51 (`make e2e-test-full`).

> e2e 는 표준 wrapper 가 playwright 를 건너뛰므로(`make e2e-test` = backend only, `Makefile:58`)
> `make e2e-test-full` 로 수행했다. 본 변경은 순수 frontend 라우팅이라 playwright 가 본질적
> 검증 계층이다. wrapper 사각지대 자체는 별도 task(`task_7072eb4a`)로 사용자 보고 완료.

## 보류·후속 항목

선행 리뷰 RESOLUTION(`../01_07_43/RESOLUTION.md`)의 이관 항목이 그대로 유효하며 본 재리뷰가
새로 추가한 후속은 없다:

| 항목 | 이관처 |
| --- | --- |
| catch-all terminal 계약의 spec 본문 반영 (원 W#1 SPEC-DRIFT) | `plan/in-progress/spec-update-catch-all-terminal-contract.md` → project-planner |
| sidebar 테스트 mock 공유 헬퍼 추출 (원 W#4) | 후속 task |
| TEST WORKFLOW e2e 가 playwright 미실행 | `task_7072eb4a` (사용자 보고 완료) |
