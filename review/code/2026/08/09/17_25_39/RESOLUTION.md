# RESOLUTION — 17_25_39 (backend CI 신설 + 타입체크 ratchet)

**Critical 0 · WARNING 5 · INFO 13 · risk MEDIUM.** router 가 9명 선별(forced 7 + architecture
+ user_guide_sync), 9/9 리포트 확보 — `forced_missing=[]`, `unfinished=[]`.

**5건 전부 수정.** 값이 컸던 것은 **내 테스트가 `run_tsc` 를 통째로 대체해 fail-closed
분기를 한 번도 실행하지 않았다**는 지적(W2)과, **내가 문서에 쓴 수치가 또 틀렸다**는
지적(W5)이다.

## 조치 항목

| # | 카테고리 | 발견 | 처분 |
|---|---|---|---|
| W1 | scope | `deleteByPrefix` LIKE 가드가 plan 이 스스로 "이 PR 밖" 이라 적어 둔 채 함께 실렸다 — 프로덕션 동작 변경(신규 throw)이 문서 갱신 없이 포함 | **수정(문구 정정).** 제목을 "**타입체크 갭 PR 에 포함**" 으로 바꾸고 판단 근거를 남겼다: 조사(호출부 전수)와 조치(4줄+테스트)가 둘 다 작고 같은 plan 의 마지막 잔여 두 항목이라 하나로 닫는 편이 추적 비용이 낮다. INFO 12(타입체크 절의 "별 항목, 이 PR 밖" 제목)도 같은 이유로 정정 |
| **W2** | testing | `run_tsc()` 의 fail-closed 3분기(timeout · `OSError` · 비-0 + 빈 stdout)가 **한 번도 실행되지 않았다** — `VerdictTest` 가 `run_tsc` 자체를 주입으로 대체했기 때문. 모듈 docstring 이 보장하는 불변식의 절반이 무증거 | **수정.** `RunTscFailClosedTest` 신설 — `subprocess.run` **만** 바꿔 실제 함수를 태운다. 4번째로 **정상 clean 실행**(exit 0 + 빈 stdout)이 throw 하지 않는 것도 고정했다: 위 세 번째 분기와 **입력이 같고(빈 stdout) returncode 로만 갈리는** 자리라 한쪽만 있으면 경계가 안 잡힌다 |
| W3 | testing | `--update` / `write_baseline()` 정상 경로 미검증(파일 내 "update" 0건) | **수정.** round-trip 테스트 — 기록한 JSON 이 실측과 일치 · `total` 이 합과 일치 · 정렬 · **방금 쓴 baseline 으로 곧바로 검사하면 통과**. 마지막 단언이 핵심이다: 안 되면 `--update` 후에도 CI 가 빨간불이라 낮추는 경로가 사실상 없는 것이다. clean 트리(빈 map) 케이스도 함께 |
| W4 | documentation | 신설 `typecheck-ratchet` 잡이 `PROJECT.md` 에 없다 — `run-test.sh` 4단계 밖이라 개발자가 push 후 CI 에서 처음 실패를 본다 | **수정.** "wrapper 4단계 밖의 CI 게이트" 표 신설 — ratchet · deps-security · harness 셋의 로컬 명령과 "언제" 를 함께 적었다. ratchet 은 **감소도 실패**라는 것과 `--update` 경로를 명시 |
| **W5** | documentation | 스크립트 docstring 의 "199건 / **39**파일" 이 커밋된 baseline(199건 / **38**파일)과 어긋난다 | **수정.** `json.load` 로 재확인하고 정정. 착수 시점(209/40) → 이 PR 이 10건 수정 → 커밋본(199/38) 의 인과도 함께 적었다(INFO 8 도 같은 요청) |

### 미조치 (INFO 13건)

대부분 "확인 완료(긍정)" 이거나 다른 트랙 항목이다. 판단이 필요했던 셋만 기록한다:

- **INFO 1** (`deleteByPrefix` 에러 메시지가 `prefix` 원문을 절단 없이 포함 — 같은 파일의
  `assertRefFormat` 은 절단한다) — **하지 않았다.** 바로 위 줄의 기존 `secret://` 검사도
  원문을 그대로 싣고 있어, 새 검사만 절단하면 **같은 메서드 안에서 두 정책이 갈린다.**
  통일하려면 기존 줄까지 함께 바꿔야 하고 그건 이 PR 이 건드리지 않기로 한 표면이다.
  reviewer 도 "현재 유일한 호출부는 서버 생성 UUID 라 실질 위험 없음" 으로 봤다.
- **INFO 5** (hand-mirror 타입 drift 를 `Parameters<...>` 파생으로 구조적 차단) — 좋은
  방향이지만 이 PR 은 **그 drift 를 잡는 게이트**를 넣는 것이고, 개별 스펙의 타입 리팩터는
  범위가 다르다. reviewer 도 "세 번째 drift 전에 별도 plan" 으로 표기.
- **INFO 7** (in-memory mock 이 LIKE 와일드카드 의미론을 재현하지 않아 "가드가 없으면 실제
  Postgres 가 과다삭제한다" 는 근거가 주석뿐) — 정당한 지적이다. 다만 재현하려면 mock 에
  SQL LIKE 해석기를 넣거나 e2e 를 추가해야 하는데, 전자는 **테스트가 DB 를 흉내 내다 틀릴**
  위험을 새로 만들고 후자는 이 PR 범위를 넘는다. plan §후속 에 등재.

## TEST 결과

fix 는 테스트·문서·docstring 에 한정돼 `codebase/**` 런타임을 건드리지 않는다(secret-store
가드는 fix 이전에 이미 포함). 아래는 fix 이전 실행분이며, 이후 변경이 런타임에 닿지 않음을
harness 964건 + ratchet 재실행으로 확인했다.

- lint : **PASS** (55s)
- unit : **PASS** (91s)
- build : **PASS** (150s)
- e2e : **PASS** (312s — backend jest 46 suites/261 + playwright 51, 로그 전수 확인)
- harness : **964 tests OK** (fix 후 재실행. 신규 22건)
- ratchet : `199건 / 38파일 — baseline 과 일치` (fix 후 재실행)

## 보류·후속 항목

`plan/in-progress/backend-lint-gate-broken-on-main.md` §후속 에 등재:

- INFO 7 — `deleteByPrefix` 가드의 존재 근거를 실행 가능한 테스트로 고정(LIKE 의미론
  재현 stub 또는 e2e)
- INFO 4 — 4번째 워크플로가 skip-job 패턴을 따를 때 composite action 추출
  (`#1106` 의 W7 과 같은 항목)
- INFO 11 — `spec/conventions/secret-store.md §2.1` 에 새 invariant 각주 (planner 권한)
