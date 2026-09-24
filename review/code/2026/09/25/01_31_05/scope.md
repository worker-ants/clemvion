# 변경 범위(Scope) 리뷰 — `test_minio_image_parity.py` / `minio-image-parity-guard.md`

## 검토 방법

이번 리뷰 대상 커밋은 `5f8c1c472`(refactor) + `24803d575`(docs/RESOLUTION) 두 개로, 직전 리뷰 라운드
(`review/code/2026/09/25/01_13_48`)의 Warning 2·3, INFO 1·2·4 에 대한 조치다. `git show`/`git diff`로
실제 diff 를 열어 각 변경 라인이 그 지적 중 어디에 대응하는지 전수 대조했다.

## 발견사항

- **[WARNING] 리뷰 대상 커밋과 무관한 작업 트리 오염 — 다른 병렬 세션/리뷰어의 뮤테이션으로 추정**
  - 위치: `spec/5-system/7-llm-client.md`(파일 끝, 476줄 뒤에 `<!-- uncommitted probe -->` 3줄 추가된
    미커밋 상태) · `plan/in-progress/__probe_plan__.md`(빈 내용의 untracked 신규 파일)
  - 상세: 본 리뷰가 대조해야 할 두 커밋(`5f8c1c472`, `24803d575`)의 diff 에는 이 두 파일이 전혀 등장하지
    않는다. 그런데 리뷰 도중 `git status --short` 로 확인한 결과 `spec/5-system/7-llm-client.md` 가
    수정 상태(` M`)이고, 문서 끝에 `<!-- uncommitted probe -->` 주석 세 줄이 붙어 있으며,
    `plan/in-progress/__probe_plan__.md` 라는 빈 파일이 untracked 로 존재한다. 본 세션은 이 두 파일을
    Write/Edit 한 적이 없다(세션 전체를 통해 Read·Bash(읽기 전용 git 명령)·output_file 하나에 대한 Write
    만 수행). 이 프로젝트가 이미 겪은 "병렬 fan-out 중 다른 reviewer 가 같은 워킹트리를 동시에 뮤테이션한다"
    실패 클래스(4라운드 연속 재발 이력)와 정확히 같은 모양이다 — 다른 병렬 reviewer 가 가설 검증용 뮤테이션을
    저장소 안에 남기고 원복을 마치지 못한 것으로 추정된다.
  - 제안: 이 작업 트리 잔여물은 이번 스코프 판정(위 두 커밋)의 결함이 **아니다** — 별도로 원복이 필요하다.
    본 리뷰어는 규약(`git checkout`/`restore`/`stash` 금지)에 따라 되돌리지 않았다. orchestrator 또는
    다음에 이 워킹트리를 쓰는 세션이 `git diff spec/5-system/7-llm-client.md` 로 확인 후 원복하거나,
    해당 뮤테이션을 남긴 reviewer 가 직접 `cp` 로 원복해야 한다.

### 대조 근거 — 리뷰 대상 두 커밋 자체는 스코프 이상 없음

- **헬퍼 추출(`_dig`/`_seq`/`_expect_one`/`_image_value`) + 추출기 배선-only 전환** — 01_13_48 Warning 2
  ("`k8s_images` 내부 '정확히 하나' 검증 골격이 리소스/컨테이너 두 층위에 복제, `_mapping()` 개별 호출 지점도
  중복")와 Warning 3(개별 call site 미고정)에 대한 직접 조치. plan §B-2·B-3 서술("네 라운드 연속 같은 형태가
  한 칸씩 안쪽에서 나왔다")과 일치하며, 요청 범위를 벗어난 임의 리팩터링이 아니라 리뷰가 반복 지적한 구조적
  결함의 근본 수정이다.
- **`SHA256_HEX_LEN` 상수화** — 01_13_48 INFO 1("SHA-256 다이제스트 길이가 이름 없는 매직 넘버로 4곳 반복")과
  정확히 대응.
- **대문자 hex 거부 테스트 추가** — INFO 2("lowercase hex only 불변식이 주석으로만 존재, 회귀 테스트 없음")와
  정확히 대응.
- **`_PINNED.match` → `_PINNED.fullmatch` 전환 + trailing newline 테스트** — INFO 4("`$` 앵커가
  `\Z` 가 아니라서 trailing 개행 직전까지만 매치")와 정확히 대응. `^...$` 앵커를 제거하고 `fullmatch` 로
  옮긴 것도 이 조치의 일부이며 별도의 무관한 정규식 정리가 아니다.
- **에러 메시지 형식 통일(`"…: image not found"`)** — 여러 호출부가 `_image_value` 헬퍼 하나로 합쳐지며
  생기는 필연적 결과다(헬퍼가 하나면 메시지 포맷도 하나). 기존 관련 테스트(`assertRaisesRegex`)도 같은 커밋
  안에서 갱신됐다 — 리팩터링과 분리되지 않은 정당한 동반 수정.
- **`.claude/tests/README.md` 카탈로그 문구 갱신, `CHANGELOG.md` 항목 갱신, plan 체크리스트 "N passed"
  스냅샷 갱신** — CLAUDE.md 메모리 규약("CHANGELOG 항목은 수정의 일부다", "plan 서술은 철회로 거짓이 될 수
  있다")과 01_13_48 Warning 1(체크리스트 subtests 수 stale)에 대한 조치. plan §B-3 에 뮤턴트 16개 표를
  추가한 것도 이번 라운드에 새로 측정한 실측 결과를 그대로 기록한 것으로, 별도 기능 확장이 아니다.
- **무관 파일 혼입 여부(커밋 diff 자체)** — 이번 두 커밋의 diff 는 `.claude/tests/test_minio_image_parity.py`,
  `.claude/tests/README.md`, `CHANGELOG.md`, `plan/in-progress/minio-image-parity-guard.md`, 그리고
  직전 라운드(`01_13_48`) 자신의 리뷰 산출물(`RESOLUTION.md`/`SUMMARY.md`/각 에이전트 리포트)만 건드린다.
  `self-hosting-deployment.md`/`spec-draft-nullable-notation-followups.md` 등 이전 라운드에서 논의된
  "스코프 밖 이동" 파일은 **이번 두 커밋에는 포함되지 않았다** — 더 이전 커밋에서 이미 처리된 것으로,
  이번 diff 범위 밖이다.
- **포맷팅/공백** — `git diff -w` 대조 결과 의미 없는 재포맷팅은 없다. 표시된 trailing-space 줄은
  unified diff 컨텍스트 표기(공백 한 칸으로 시작하는 문맥 줄)이며 실제 파일의 trailing whitespace가 아니다.
- **뮤테이션 검증** — 코드를 고쳐보는 방식의 재현은 수행하지 않았다(diff 대조만으로 스코프 판정 가능,
  저장소 파일 변경 없음, 커밋 대상 두 파일에 대해 본 세션이 만든 미커밋 변경 없음).

## 요약

리뷰 대상 두 커밋(`5f8c1c472`, `24803d575`) 자체는 직전 리뷰 라운드가 지적한 Warning 2건과 INFO 3건(구조적
중복, 매직 넘버, 대문자 hex 미검증, 정규식 앵커)에 대한 조치로, 추가된 헬퍼·상수·테스트·문서 갱신 모두 그
지적과 1:1로 대응된다. 요청 범위를 벗어난 리팩터링, 기능 확장, 무관한 파일·포맷팅·임포트·설정 변경은
발견되지 않았다. 다만 리뷰 도중 이 두 커밋과 무관한 작업 트리 오염(`spec/5-system/7-llm-client.md` 미커밋
수정 + `plan/in-progress/__probe_plan__.md` untracked 파일)을 관측했다 — 본 세션이 만든 것이 아니며, 병렬
fan-out 중 다른 reviewer 의 뮤테이션 잔여물로 추정된다. 이 오염은 이번 스코프 판정 대상이 아니므로 원복하지
않고 그대로 보고한다.

## 위험도

NONE (리뷰 대상 커밋 기준). 단, 별도 관측된 작업 트리 오염은 원복 필요 — 위 발견사항 참고.
