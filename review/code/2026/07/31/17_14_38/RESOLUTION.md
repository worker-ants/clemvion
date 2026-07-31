# RESOLUTION — 17_14_38 (3차 라운드) — **수렴**

**CRITICAL 0 / 전체 MEDIUM.** 14개 reviewer 전원 결과, forced 화이트리스트 7명 미이행 0,
skip·미완 0건. 2R 의 CRITICAL 3건은 security·side_effect·requirement·testing 4개 에이전트가
소스 대조 + 테스트 재실행 + mutation 으로 교차 재검증했다.

| 라운드 | CRITICAL | 성격 |
|---|---|---|
| 1R | 1 | 동작 — 2단계 절단이 진짜 총 줄 수를 오보고 |
| 2R | 3 | 동작 — sentinel 방어가 4개 진입점 중 2곳만 / 잠금 테스트 부재 |
| **3R** | **0** | 커버리지·문서·구조 |

## 이번 라운드 조치

| # | 처분 | 내용 |
|---|---|---|
| W1 | **수정** | `--plan` 과 `--impl-done` diff 의 방어가 테스트로 안 잠겨 있었다(mutation: 호출 제거해도 54건 GREEN). `collect_context` 를 타는 잠금 테스트 2건 추가 |
| W3 | **수정** | `collect_markdown_files` 의 자연정렬이 downstream 재정렬에 가려 **관측 불가**였다(mutation: `.sort()` 로 되돌려도 GREEN). 직접 pin — 미검증 계약은 dead code 와 구분되지 않아 나중에 "정리" 당한다 |

## 리뷰어 지적을 절반만 채택한 건 (실측 근거)

2R 의 C2 는 두 주장이 겹쳐 있었다 — ① diff 텍스트가 sentinel 을 위조할 수 있다 ② diff 에
자기 경계가 없어 이름 없이 버려진다. **①은 성립하지 않는다**: git diff 는 모든 내용 줄에
`+`/`-`/공백 접두를 붙이므로 마커가 `+<!-- @bundle-file -->` 로 나와 줄 시작에 올 수 없다
(실측). 그래서 중화를 넣어도 청크 수가 3으로 동일하고, 중화를 빼도 3이다.

②만 진짜 결함이고 그것만 테스트로 잠갔다. 중화는 "diff 를 다르게 임베드하는 미래 변경" 대비
방어로 남기되, **테스트를 쓰지 않은 이유를 코드에 적었다** — `git diff` 가 만들 수 없는 입력을
지어내는 테스트는 틀린 이유로 통과한다.

> 내 2R 커밋 메시지는 ①②를 함께 결함으로 서술했다. 그 서술이 부정확했다.

## defer (plan 등재)

`_charge_notice` 를 consistency 쪽과 공유(현재 code-review 쪽에만 존재) · `build_files_section`
/`collect_context` god function 분해 · 2차 절단이 `max_file_size` 상한 없는 원본을 대상으로
하는 트레이드오프 · `_lib` 네임스페이스 정책 문서화 · 상태관리 헬퍼 5종 `_shared/` 추출.

INFO 15건 중 스타일(빈 줄·`_DIFF_LABEL` 명명)은 조치, 나머지는 비-행동.

## 검증

- **harness 스위트 711 tests OK** (origin/main 대비 +66).
- **mutation**: 옛 경계 복원 / `_charge_notice` 무력화 / 사전순 복원 / 중화 제거(rationale·
  `--spec` 호출부) / `total_lines` 원복 / diff 고유 경계 제거 — 전부 RED.
- 이번 라운드에도 **헬퍼 테스트 함정**에 한 번 걸렸다: `--spec` 중화 테스트를 처음엔
  `_neutralize_sentinel` 을 직접 부르게 써서 호출부 뮤턴트가 GREEN 이었고, `collect_context`
  를 타도록 바꾼 뒤에야 RED 가 됐다.
