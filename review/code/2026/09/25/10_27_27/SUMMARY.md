# Code Review 통합 보고서

## 전체 위험도
**LOW** — 이번 변경은 `.claude/tests/**` pytest 하네스 전용(프로덕션 `codebase/**` 미변경)으로, 병렬 실행 시 실제 저장소 트리에 프로브를 남기던 경쟁 조건을 임시 git 사본/임시 디렉터리 격리로 근본 제거했다. Critical 발견 없음. WARNING 2건은 모두 신설 헬퍼 `make_temp_repo_copy` 의 미문서화 엣지 케이스(현재 호출부에서는 트리거되지 않음)와 호출부 보일러플레이트 중복으로, 병합을 막을 수준은 아니다. forced(router_safety) 화이트리스트 7개(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 강제 목록 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement / testing | `make_temp_repo_copy(path)` 를 `subtrees` 없이(0개) 호출하면 `git add -A` 로 스테이징될 변경이 없어 `git commit -qm "copy of this checkout"` 이 non-zero 종료하고 `git_in` 의 `check=True` 로 `CalledProcessError` 가 그대로 전파된다. 실측 재현됨(`CalledProcessError: ... 'commit' ... returned non-zero exit status 1`). 현재 4개 호출부는 전부 `"spec/5-system"` 1개 이상을 넘겨 안전하지만 docstring 이 이 제약을 언급하지 않는다 | `.claude/tests/_harness.py:138`(`make_temp_repo_copy` 정의), `:164`(`git_in(repo, "commit", ...)`) | `git commit --allow-empty` 로 바꾸거나, `subtrees` 최소 1개 필요를 docstring 에 명시(또는 `assert subtrees`, 시그니처를 `path, first: str, *rest: str` 로 강제) |
| 2 | maintainability | `_harness.make_temp_repo_copy(os.path.join(tmp, "repo"), "spec/5-system")` 부트스트랩 3줄이 5개 테스트에서 바이트 단위로 완전히 동일하게 반복된다. 이번 PR 이 다섯 곳을 전부 손댄 김에 상수/헬퍼로 뽑지 않아, 향후 `subtrees` 인자나 경로 구성이 바뀌면 다섯 곳 중 하나를 놓치는 drift 위험이 남는다 | `.claude/tests/test_consistency_bundle_priority.py:641, 679, 717, 771, 876` | `_harness.py` 에 공용 스니펫 상수/헬퍼를 두고 다섯 호출부가 재사용하게 하거나, 최소한 하나가 바뀌면 나머지도 함께 바꿔야 한다는 주석을 `make_temp_repo_copy` docstring 에 남긴다 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing / concurrency | 새 격리 규약("이 체크아웃에 쓰지 않는다")이 README 산문 관례와 사람 리뷰에만 의존하고, 이번에 만든 감사 훅(`sys.addaudithook`) 기반 census 도구는 스크래치에만 남아 상시 회귀 가드로 승격되지 않았다. 같은 클래스의 문제가 이 워크트리에서 이미 4회 반복된 이력이 있어 재발 가능성이 0은 아니다 | `.claude/tests/README.md:109`(신설 규약), plan §A 감사 훅(scratch, 미커밋) | 감사 훅을 `_harness.py`/fixture 모듈로 승격해 "워크트리 쓰기 이벤트 0" 을 assert 하는 표준 pytest 회귀 테스트 추가를 백로그에 남긴다 |
| 2 | architecture / concurrency | `make_temp_repo_copy` 가 git 객체가 아니라 `shutil.copytree` 로 살아있는 워킹트리 파일을 그대로 읽어 복사한다 — 복사 진행 중 같은 서브트리를 동시에 편집하는 다른 프로세스가 있으면 이론상 부분 쓰기 상태(torn read)를 읽는 좁은 창이 남는다. 이번 PR 이 닫은 경쟁(쓰기 측)과는 다른 축이며 실측된 회귀 클래스와 무관, 발생 확률·영향 모두 낮음 | `.claude/tests/_harness.py:138-166`(`make_temp_repo_copy`) | 이번 스코프에서 조치 불요. 후속 문서화 시 "쓰기 측 경쟁만 해소했다"는 범위를 명확히 하면 "완전 격리"로 오독되지 않는다 |
| 3 | requirement | `make_temp_repo_copy` 가 중첩/겹치는 `subtrees`(예: `("spec", "spec/5-system")`)를 받으면 두 번째 `shutil.copytree` 목적지가 이미 존재해 `FileExistsError` 로 죽는다. 현재 호출부는 모두 단일·비중첩 subtree 만 사용해 무해함 | `.claude/tests/_harness.py:161-162` | 다중 subtree 호출부가 생기면 재확인. 현재는 조치 불요 |
| 4 | architecture | 격리 픽스처 3곳(`_prepare_over`, `test_consistency_target_validation.py::_run`, `test_consistency_spec_draft_snapshot.py::_run`)이 "env/cwd 오버라이드 + subprocess 실행 + stdout 마지막 줄 파싱"이라는 유사 뼈대를 각자 독립 구현하지만, env 변수명·오버라이드 축이 갈려 있어 지금 통합하면 조건분기가 늘어난다(저장소 기존 방침: 발산 축은 defer) | `test_router_decision_trust.py:335`, `test_consistency_target_validation.py:35`, `test_consistency_spec_draft_snapshot.py:57` | 다섯 번째 유사 픽스처가 추가되는 시점에 공용 헬퍼 추출 재검토 |
| 5 | scope / documentation | 원 트래커는 "하네스 테스트 **둘**" 만 지목했으나 이 PR 은 감사 훅+mtime census 로 재조사해 대상을 **넷**으로 넓혔다(`test_router_decision_trust.py`, `test_consistency_target_validation.py` 추가 발견). plan §A 표와 커밋 메시지(`84782583e`)에 근거가 명시된 정당한 확장이며 스코프 이탈이 아니다 | `plan/in-progress/harness-probe-isolation.md:18`(§A) | 조치 불요 |
| 6 | scope / documentation | 커밋된 사전 consistency-check 산출물(`review/consistency/2026/09/25/09_56_00/**`)이 개명 전 식별자 `make_probe_repo` 를 인용한다. 실제 코드는 그 검토의 WARNING(W2, 이름·역할 겹침)을 반영해 `make_temp_repo_copy` 로 개명·`make_temp_git_repo` 위임 구조로 정리됐다(plan §G 명시) — 리뷰 산출물은 시점 스냅샷(불변 이력)이라는 저장소 관례와 일치 | `review/consistency/2026/09/25/09_56_00/{SUMMARY.md,naming_collision.md,convention_compliance.md,plan_coherence.md}` | 조치 불요 |
| 7 | performance | `make_temp_repo_copy` 가 프로브마다 서브트리 전체 복사(`spec/5-system`, 18개 파일·1.4MB) + git commit 2회를 5곳에서 반복해 기존 대비 I/O·git 해싱 비용이 소폭 늘었다. 현재 규모에서는 서브초 단위로 무시 가능하며 프로덕션 런타임에는 영향 없음 | `.claude/tests/_harness.py:138`, 호출부 5곳(`test_consistency_bundle_priority.py:641,679,717,771,876`) | 대상 서브트리가 커지거나 패턴이 확산되면 `setUpClass`/모듈 스코프 fixture 로 사본 1회 공유를 고려 |
| 8 | testing | 자매 테스트 중 하나(`TheDiffOutranksTheFolderDumpTest.test_the_diff_sits_right_after_the_on_topic_files`)만 여전히 실제 `ROOT` 를 대상으로 `collect_context` 를 호출한다(파일을 쓰지 않아 이번 격리 문제와 무관, 실측으로 무해 확인됨). 다만 나란히 있는 다른 테스트는 사본을 쓰기 때문에 왜 이 테스트만 다른지 설명이 없다 | `.claude/tests/test_consistency_bundle_priority.py`(`TheDiffOutranksTheFolderDumpTest`) | 근처에 "이 테스트는 파일을 쓰지 않아 사본이 불필요하다" 주석 한 줄 추가 권장(우선순위 최하) |
| 9 | documentation | `plan/in-progress/harness-review-gate-followups.md` §13 의 "pre-existing 4곳" 목록이 이번 실측(해당 호출은 이미 전부 `_harness.git_in` 경유였음)으로 stale 임이 확인됐으나, developer 가 "이 PR 의 축이 아니다"로 정정을 의도적으로 유보했고 근거를 plan §G 에 남겼다(유예 근거 실측 관례 충족) | `plan/in-progress/harness-probe-isolation.md` §G INFO4 | 조치 불요(별도 후속에서 §13 정정 가능) |
| 10 | security | 커밋된 리뷰 산출물에 개발 머신의 로컬 절대경로(`/Volumes/project/private/clemvion/...`)가 노출되어 있으나 자격증명·키 등 민감정보 아니며, 이 저장소 다른 리뷰 아티팩트에도 동일 관례 존재 | `review/consistency/2026/09/25/09_56_00/_retry_state.json`, `SUMMARY.md` 등 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션·시크릿·인가 등 해당 없음. subprocess 전부 인자 리스트 방식(`shell=True` 없음), 경로 탈출 방지 안전장치 재사용 확인 |
| performance | NONE | 서브트리 복사+커밋 반복 오버헤드 있으나 현재 규모(1.4MB)에서 무시 가능 |
| architecture | LOW | 격리 픽스처 보일러플레이트 잔여 중복(INFO), `shutil.copytree` 라이브 복사의 이론적 torn read(INFO). 위임 구조·확장점 재사용은 양호 |
| requirement | LOW | `make_temp_repo_copy` 0-subtree 호출 시 CalledProcessError(WARNING, 실측 재현). 기능 검증 전량 통과(73 passed, 전체 1174 passed) |
| scope | NONE | 17개 파일 전부 "프로브 격리" 단일 목적에 정확히 묶임. 트래커 대비 대상 확장·구버전 식별자 인용은 문서화된 정당 사항 |
| side_effect | NONE | 실제 쓰기 전부 임시 사본으로 이동 확인(grep 전수 대조), 헬퍼 시그니처 변경은 전부 파일-로컬·하위 호환 유지 |
| maintainability | LOW | `make_temp_repo_copy` 호출 보일러플레이트 5곳 완전 중복(WARNING). 그 외 단일 책임·네이밍·docstring 관례 양호 |
| testing | LOW | 뮤테이션 테스트 P1~P6 전부 KILLED, 73 passed 재실행 확인. 회귀 가드 미승격(INFO), 0-subtree 미검증(INFO) |
| documentation | NONE | README·docstring·CHANGELOG·plan 수치·서술 교차 일치. 구버전 식별자 인용·stale §13 유보는 관례상 결함 아님 |
| concurrency | LOW | 핵심은 경쟁 조건을 락이 아닌 "공유 제거"로 근본 해결 — 신규 경쟁/동기화 결함 없음. 런타임 가드 부재·torn read 여지는 저위험 INFO |

## 발견 없는 에이전트

security, performance, scope, side_effect, documentation — CRITICAL/WARNING 없음(INFO만 존재하거나 전무).

## 권장 조치사항

1. `make_temp_repo_copy` 가 `subtrees` 0개로 호출될 때 불투명한 `CalledProcessError` 로 죽는 문제를 `git commit --allow-empty` 또는 docstring 명시/시그니처 강제로 해소한다(WARNING #1).
2. `test_consistency_bundle_priority.py` 의 5곳 완전 동일한 `make_temp_repo_copy` 호출 보일러플레이트를 공용 상수/헬퍼로 추출해 drift 위험을 없앤다(WARNING #2).
3. (선택, 낮은 우선순위) 이번에 만든 감사 훅 기반 census 도구를 상시 pytest 회귀 가드로 승격해, 같은 클래스의 문제(체크아웃 직접 쓰기)가 다섯 번째로 재발하는 것을 자동으로 막는 방안을 백로그에 남긴다(INFO #1).
4. 나머지 INFO 항목은 모두 조치 불요 또는 우선순위 최하로, 병합을 막지 않는다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency` (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단상 이번 변경(harness 테스트 fixture)과 무관 |
  | database | router 판단상 이번 변경과 무관(DB 접근 코드 없음) |
  | api_contract | router 판단상 이번 변경과 무관(API 표면 미변경) |
  | user_guide_sync | router 판단상 이번 변경과 무관(사용자 가이드 대상 아님) |
