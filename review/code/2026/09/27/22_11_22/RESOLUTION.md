# RESOLUTION — 2R (`review/code/2026/09/27/22_11_22`, 판정 기준 HEAD `c747f2405`)

리뷰 뒤 `git status --short` 는 이 세션 디렉터리만, `git diff --stat HEAD` 는 빈 출력. 리뷰어 transcript 의 쓰기 명령은 세션 디렉터리
밖 0건. 13명 전원 리포트 확보(`forced_missing` · `unfinished` 없음).

## 조치 항목

| SUMMARY # | 판정 | 조치 | 커밋 |
|---|---|---|---|
| W1 (testing) 버전 복원(`skipLegacyDataGates=true`)에서도 참조 검사를 건너뛰지 않는다는 설계를 고정하는 테스트 없음 | 수용 — 이 PR 의 보안 수정을 지키는 회귀 그물 | `workflows.service.spec.ts` «버전 복원 경로에서도 참조 검사를 건너뛰지 않는다». 뮤턴트 M6(검사를 `if (!skipLegacyDataGates)` 안으로) → **KILLED 1**(그 테스트만) | `421b69088` |
| W2 (architecture · maintainability) 여러 참조를 한 번에 검사하는 형태가 네 자리에 따로 | **수렴 예외로 등재** | 트래커 «교차 워크스페이스 참조 후속» 의 developer 불릿. 근거는 아래 | — |
| W3 (performance) 폴더 생성의 부모 조회 두 번(`exists` + `getDepth` 첫 조회) | **수렴 예외로 등재** | 같은 트래커 불릿. `getDepth` 조회 순서에 묶인 단위 테스트가 여럿이라 따로 한다 | — |
| INFO 1 · 2 · 3 · 4 · 6 · 10 · 11 | 조치 불요 | TOCTOU(기존 관례 · FK 최종 방어) · 이미 저장된 교차 행 · 트리거 `config` 비밀 참조 · 새 노드 id 존재 신호(spec Rationale 수용) · 구조적 강제 부재 · 메시지 · 코드 갈래(spec §1.1 승인) · API 문서 미러 — 1R 과 같은 처분(트래커 · spec Rationale) | — |
| INFO 5 · 7 · 8 | 조치 불요 | KB 순차 `await`(1R INFO 9 처분) · 메시지 리터럴 · `!= null` 혼용(W2 불릿에 함께 등재) · 트리거 spec provider 복사(기존 파일 구조) | — |
| INFO 9 (세부 테스트 갭 셋) | 조치 불요 | (a) 노드 «한쪽만 무효» — «둘 다 무효» 가 배치 경로를 이미 덮는다 (b) 워크플로 수정의 `folderId` 미제공 — 생성의 «미제공 · null 미조회» 가 같은 헬퍼를 덮는다 (c) `In()` 의 `.value` 는 TypeORM 공개 getter | — |

**수렴 예외 판정** (`developer` SKILL §ISSUE FIX 정책 «수렴 예외»): (a) W2 · W3 는 동작 결함이 아니다 — 재현되는 오동작이 없고 구조 · 성능
수준이다(리뷰어도 «급하지 않은 백로그성 개선» · «기능 결함 아님» 으로 적었다). (b) 고치면 `codebase/` 수정이라 리뷰 게이트가 다시
무장되고, W2 는 네 자리를 한 헬퍼로 재구성하는 리팩터라 그 라운드가 또 잔여를 낼 형태다. (c) 이 판정과 조항을 여기 인용한다. (d) 등재는
이 턴에 했다 — 트래커 «교차 워크스페이스 참조 후속».

## TEST 결과

- lint: PASS (`_test_logs/lint-20260927-222622.log`)
- unit: PASS (`_test_logs/unit-20260927-222719.log`)
- build: PASS (`_test_logs/build-20260927-222839.log`)
- e2e: 통과 — 477 passed / 477 (`_test_logs/e2e-20260927-223123.log`)
