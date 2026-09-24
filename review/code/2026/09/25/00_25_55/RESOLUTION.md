# RESOLUTION — `review/code/2026/09/25/00_25_55` (1라운드)

**Critical 0 · Warning 3 · INFO 16.** forced 7/7 결과 확보. 선언한 정지 규칙(«Critical 0 · Warning 0 · 그 라운드
가드·워크플로 수정 0건»)은 Warning 3 이라 미충족 → 셋 다 조치하고 2라운드를 돈다.

## 조치 항목

| SUMMARY # | 지적 | 조치 | 판별 확인 | commit |
| --- | --- | --- | --- | --- |
| Warning 1 (testing) | k8s 추출기의 «같은 kind/name 이 둘 이상» 분기 무검증 — `!= 1` → `< 1` 뮤턴트 생존 | 경계 테스트 `test_k8s_duplicate_resource_is_named`(StatefulSet 두 번 + Job → `expected one StatefulSet/minio, found 2`). 추출기 docstring 에 «0 과 중복 둘 다 실패» 한 줄 | 뮤턴트 `!= 1` → `< 1` 에서 **이 테스트 1건만** RED | `c8a1a59b6` |
| Warning 2 (maintainability) | `spec → template → spec → containers` 4단 `.get()` 체인 | 이름 있는 단계(`pod_template`) + `_mapping()` 헬퍼 | 동작 불변 — 기존 7 + 새 2 테스트 통과 | `c8a1a59b6` |
| Warning 3 (scope) | `self-hosting-deployment.md` 에 아바타 정책 세부 노트가 섞였다 | 체크박스 한 줄로 줄이고 방법 · 금지 프리셋은 `scripts/minio/README.md`, 누락 사례는 백로그 트래커 항목을 가리키게 했다 | — | `c8a1a59b6` |
| INFO 15 (동반) | compose 서비스 값이 mapping 이 아니면 원시 `AttributeError` — 가드 자신의 «실패는 자리를 이름으로 댄다» 원칙과 어긋남 | `_mapping()` 으로 `PlaceNotFound` 로 승격 + 경계 테스트 `test_compose_malformed_service_is_named_not_attribute_error` | 뮤턴트(헬퍼를 옛 `or {}` 로)에서 **이 테스트 1건만** RED | `c8a1a59b6` |

## INFO 처분

- **INFO 5**(포트 포함 레지스트리 참조를 `_PINNED` 가 잘못 분해) — 여섯 값 모두 포트가 없다. 프라이빗 레지스트리를 쓰게
  되면 그때 — 지금 넓히면 검증 대상이 없는 분기가 생긴다.
- **INFO 6**(파일 부재 · YAML 파싱 실패는 `PlaceNotFound` 로 포장되지 않음) — 그 경우 pytest 가 파일 경로와 함께
  `FileNotFoundError` / `YAMLError` 를 내므로 «조용히 통과» 가 아니다. 가드의 약속(«자리를 못 찾으면 이름을 댄다»)
  범위 밖이라 두었다.
- **INFO 16**(헬퍼 docstring) — 의도가 가장 덜 자명한 `k8s_images` 에 한 줄을 달았다(위 Warning 1 과 함께).
- 나머지(1~4 · 7~14) — 긍정 관찰 또는 기존 관례, 조치 불요(각 reviewer 판정).

## TEST 결과

- lint · unit · build · e2e — **해당 없음**: 이 PR 은 `codebase/**` 를 건드리지 않는다(`.claude/tests/` · 워크플로
  pathspec · plan · CHANGELOG). CLAUDE.md 대로 검증은 하네스 pytest 가 대신한다.
- 하네스 `python3 -m pytest .claude/tests -q` — **1149 passed**(1라운드 전 1147 + 새 경계 테스트 2)
- 새 경계 테스트 둘의 판별력 — 위 표의 뮤턴트 각각 해당 테스트만 RED, `cp` 원복 뒤 `git status` 빈 것 확인
