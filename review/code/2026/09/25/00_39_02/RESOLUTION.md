# RESOLUTION — `review/code/2026/09/25/00_39_02` (2라운드, 전수 14명)

**Critical 0 · Warning 2 · INFO 12.** forced 7/7. 정지 규칙 미충족 → 둘 다 조치, 3라운드를 돈다.

## 조치 항목

| SUMMARY # | 지적 | 조치 | commit |
| --- | --- | --- | --- |
| Warning 1 (testing) | 컨테이너 수준 «같은 이름 둘 이상» 분기 무검증 — 1라운드에서 고친 리소스 수준과 **같은 형태가 한 칸 안쪽**에 남았다 | **자리 말고 형태로** 처리했다. 추출기 · 판정의 분기를 전수로 세어 빈 칸 다섯을 더 찾았다(리소스 0 · 빈 문자열 image · 비문자열 image · `latest` · distroless). 컨테이너 0 / 2 메시지를 리소스 수준과 같은 `found N` 으로 통일, 판정 둘을 `pin_violation()` · `is_distroless()` 로 빼 주입 입력으로 고정, 픽스처 헬퍼의 유효성도 따로 고정. **분기 11개 각각의 뮤턴트가 그 분기의 테스트 하나를 RED** 로 만든다(plan §B-2) | `647b60ad8` · `69a5e22b9` |
| Warning 2 (documentation) | plan 의 «새 테스트 7개» 가 낡았다 | 취소선 + 측정 시점과 함께 15개로. CHANGELOG · README 도 분기 전수 결과로 갱신 | (이 RESOLUTION 커밋) |

## INFO 처분

- **INFO 12**(리뷰 중 `plan/in-progress/spec-draft-__snapshot_selftest__.md` 가 잠깐 나타났다 사라짐) — 출처 확인:
  `.claude/tests/test_consistency_spec_draft_snapshot.py` 가 **설계상** 실제 `plan/in-progress/` 에 임시 draft 를
  만들었다 지운다(그 파일 주석: orchestrator 가 target 을 저장소 상대경로로 읽기 때문). 리뷰어가 하네스 전체를 돌리며
  생긴 것 — 이 PR 무관.
- **INFO 2**(`setUp` 이 파일을 매 테스트 재파싱) — 파일 셋 · 수 KB, 4회. 테스트 독립성이 이득이라 두었다.
- **INFO 3**(`PlaceNotFound` 가 `AssertionError` 상속) — 재사용 없는 단일 목적 가드, reviewer 판정대로 조치 불요.
- **INFO 6 · 7**(값 검사 반복 · `_mapping` 반환 타입) — 세 번째 자리가 생기면 헬퍼로. 지금은 두 자리.
- **INFO 8**(README 의 PyYAML 예외 목록이 낡음) — 이 PR 이전부터의 drift, 이 diff 는 그 단락을 건드리지 않았다.
- 나머지 — 긍정 관찰 또는 기존 관례.

## TEST 결과

- lint · unit · build · e2e — **해당 없음**: `codebase/**` 무변경. 검증은 하네스 pytest(CLAUDE.md).
- 하네스 `python3 -m pytest .claude/tests -q` — 아래 커밋 직전 실행 결과를 plan 체크리스트에 적는다.
- 분기 전수 뮤턴트 11개 — 전부 KILLED, 각자 예상한 테스트. 첫 실행은 `.pyc` 재사용으로 무효였고(plan §B-2) 바이트코드를
  끈 재실행이 기록이다.
