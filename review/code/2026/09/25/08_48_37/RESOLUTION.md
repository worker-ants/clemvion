# RESOLUTION — `review/code/2026/09/25/08_48_37` (2라운드, 파일 범위 지정)

**Critical 0 · Warning 2 · INFO 16.** forced 7/7. 범위: 가드 테스트 · `scripts/minio/README.md` · plan · k8s 매니페스트.
정지 규칙 미충족 → 둘 다 조치, 3라운드를 돈다.

## 조치 항목

| SUMMARY # | 지적 | 조치 | 판별 확인 | commit |
| --- | --- | --- | --- | --- |
| Warning 2 (testing, 뮤턴트로 실증) | heredoc 의 `cat > PATH` 대상과 `set-json` 의 소스가 같은 문자열이어야 하는데 아무것도 안 봤다 — 경로를 바꿔도 전부 초록 | `_HEREDOC` 이 `cat > PATH` 대상을 `path` 그룹으로 꺼내고, 새 단언 `test_set_json_reads_the_file_the_heredoc_wrote` 가 `set-json` 소스 목록이 **정확히 [그 경로]** 임을 본다(가드가 요구하는 형식 `cat > PATH <<EOF` 를 docstring 주석에 명시) | 뮤턴트 D8(set-json 경로만 변경) · D9(cat 대상만 변경) 모두 이 단언이 RED | `fd3810242` |
| Warning 1 (testing · documentation) | `scripts/minio/README.md` 의 «이 파일은 CI 트리거에 등재» 에서 «이 파일» 이 README 로 읽힌다(실제로는 정책 JSON 을 가리켰다 — INFO 16) | 명시적 명사로: «정책 JSON 과 k8s 매니페스트가 등재 · 이 README 는 가드가 읽지 않는 설명 문서라 등재 대상 아님» | — | `fd3810242` |

## INFO 처분

- **INFO 10**(형제 모듈의 밑줄 헬퍼를 import — 이름 규약과 사용이 어긋남, 2명 지적) — 유지한다. 헬퍼를 `_harness` 로 옮겨
  공개하면 이미 머지된 `test_minio_image_parity.py` 까지 고치는 리팩터가 되고 이 PR 의 축이 아니다. 이름이 바뀌면
  `ImportError` 로 **즉시** 드러난다(조용한 실패가 아니다). 헬퍼를 쓰는 세 번째 가드가 생기면 그때 공용 모듈로.
- **INFO 12**(경로 리터럴이 스크립트에 두 번) — 경로를 변수로 모으는 대신 **두 사본의 일치를 단언**했다(W2). 매니페스트를
  또 고치면 동작 실측을 다시 해야 하는데, 단언은 같은 보장을 준다.
- **INFO 5 · 6**(`<<-EOF` 탭 종료 · 닫는 EOF 뒤 개행 필요) — 둘 다 현재 형식에서 문제없고, 어긋나면 `PlaceNotFound`
  (found 0)로 **시끄럽게** 실패한다.
- **INFO 7**(`NotAction` 미검사) — 원본과의 **동일성** 단언이 `NotAction` 추가도 잡는다(원본에 없으므로). 따로 둘 필요가 없다.
- **INFO 11 · 13 · 14 · 15 · 16** — 소규모 중복 · 관례상 근거 반복 · 클래스명 · 클래스 docstring · (W1 에 반영).
- **INFO 1 · 2 · 3 · 4 · 8 · 9** — 기존에 검토된 설계 · 범위 밖 · 의도된 부작용.

## 판별 확인 — 전수 17개

`fd3810242` 뒤, 바이트코드 끔, 앵커 1회 매칭 assert, `cp` 원복: 데이터 D1~D9 · 배선 W1~W6 · 판정 P1~P2 — **전부 KILLED,
각자 의도한 테스트로**. k8s 매니페스트는 1 · 2라운드에서 바뀌지 않아 Job 동작 실측(plan §C-2)은 그대로 유효하다.

## TEST 결과

- lint · unit · build · e2e — **해당 없음**: `codebase/**` 무변경. 검증은 하네스 pytest(CLAUDE.md).
- 하네스 `python3 -m pytest .claude/tests -q` — **1173 passed**(`fd3810242` 직전).
