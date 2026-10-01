# 성능(Performance) 리뷰 — NERV 정본 전환 단계 1 (spec 미러 도입)

## 발견사항

- **[INFO]** `area_map` 이 부모 사슬에 순환이 있으면 끝나지 않는다
  - 위치: `.claude/tools/nerv-mirror/pull.py:204-211`
  - 상세: `while cur is not None` 루프는 방문 집합도 깊이 상한도 없다. `parent_id` 가 `a → b → a` 로 도는 두 노드 트리를 넣어 프로브했고(scratch 사본, 5초 타임아웃), 반환하지 않았다. NERV 서버가 순환을 막는다고 믿는 한 닿지 않는 경로다. 하지만 `--task` 는 에이전트 세션의 Bash 안에서 도는 CLI 라 한 번 걸리면 도구 타임아웃까지 세션이 멈춘다. 노드마다 조상을 다시 걷는 구조(O(n·깊이))라 메모이즈를 겸하면 순환 검사가 거의 공짜다.
  - 제안: `seen` 집합을 두고 재방문하면 `SystemExit("pull: specs/tree 의 parent 사슬에 순환이 있다 — <key>")` 로 끝낸다. 이미 계산한 노드의 영역을 `out` 에서 재사용하면 노드당 상수 시간이 된다.

- **[INFO]** `--task` 가 스펙 키마다 curl 프로세스를 직렬로 띄운다
  - 위치: `.claude/tools/nerv-mirror/pull.py:310-329`, `.claude/tools/nerv-mirror/pull.py:225-241`
  - 상세: 키 N 개면 `Nerv.get` 이 N 번 `subprocess.run(curl)` 을 부른다. 호출마다 프로세스 생성과 TLS 핸드셰이크를 새로 하고, 연결을 재사용하지 않으며, 요청 하나의 상한이 120초다. 이 값은 실측하지 않았고(네트워크 호출 금지 규약), 코드 구조로만 판단한 것이다. 클레임 scope 가 몇 개면 문제없다. scope 가 수십 개로 늘면 왕복 시간이 키 수에 그대로 비례한다. 전부 304 인 재실행에서도 같다.
  - 제안: 지금은 조치 불요. scope 가 커지면 `curl --next` 로 여러 URL 을 한 프로세스에 묶거나(연결 재사용) `ThreadPoolExecutor` 로 4~8 병렬로 돌린다. 어느 쪽이든 결과는 `sorted(keys)` 순서로 모아 `apply` 의 결정성을 지킨다.

- **[INFO]** CI 잡 `spec-mirror-integrity` 가 공용 `changes.relevant` 에 묶여 codebase 만 바꾼 PR 에도 돈다
  - 위치: `.github/workflows/spec-link-checks.yml:125-140`
  - 상세: 이 파일의 `changes` 잡 pathspecs 는 `codebase/backend/**` · `codebase/frontend/**` · `plan/**` 등을 포함하는 넓은 목록이다(같은 파일 앞부분). 새 잡의 실제 의존은 `spec/CLE-*` · `spec/README.md` · `.claude/tools/nerv-mirror/**` 뿐이다. `pull.py --check` 자체는 이 저장소 실측 0.06초(169편 · 5.76MB)인데, 잡은 러너 기동과 저장소 전체 checkout 을 매번 낸다. 그래서 백엔드 코드만 바꾼 PR 마다 러너 1개를 태우고 비용의 대부분이 checkout 이다. 스킵 메시지("spec · .claude 경로 변경 없음")도 실제 트리거 집합과 다르다.
  - 제안: 잡 전용 `changes` 호출(`spec/**` · `.claude/tools/nerv-mirror/**` · `.claude/hooks/guard_nerv_owned_paths.py` · 이 워크플로 파일)로 좁히거나, 최소한 `actions/checkout` 에 `sparse-checkout: |\n  spec\n  .claude/tools/nerv-mirror` 를 준다. 스킵 메시지는 실제 조건에 맞춘다. 좁힌 뒤에도 `test_workflow_yaml_structure.py` 의 `!cancelled()` 등록(파일 8)은 그대로 유효하다.

## 측정 (저장소 밖 scratch 에서 재현, 저장소 트리는 쓰지 않음)

| 대상 | 결과 | 판정 |
| --- | --- | --- |
| `guard_nerv_owned_paths.py` 1회 호출 (Write/Edit 마다) | 20.7ms, 빈 `python3 -c pass` 13.9ms 대비 약 7ms | 허용. 부모 디렉터리를 올라가며 `.git` 을 stat 하는 것이 전부(깊이 약 10) |
| `pull.py --check` (미러 169편, 5.76MB) | 0.06초 | 허용. 파일 수에 선형 |
| consistency 오케스트레이터 `is_nerv_mirror` 필터 | 557개 중 170개 제외, 필터 7.8ms, walk+정렬 8.9ms | 허용. 미러를 먼저 걷고 정렬한 뒤 걸러 내지만 절대값이 작다 |
| 미러를 뺀 옛 트리 코퍼스 번들 | 유효 입력이 387파일로 유지 | 개선. 미러를 섞었다면 같은 내용이 두 모양으로 예산을 두 번 썼을 것 |
| `spec-links.ts` `inNervMirror` | `includeFile` 에서 정규식 1회, 제외 파일은 내용을 읽지 않음 | 개선. 링크 가드가 읽는 파일이 169개 줄어듦 |
| `stray-tool-tags` (미수정 walker) 가 미러도 훑는 비용 | 미러 170파일 19ms(옛 트리 387파일 31ms) | 허용. 다만 이 가드는 `spec` 전체를 걸으므로 미러가 늘면 선형으로 는다 |
| 신규 harness 테스트 | `test_guard_nerv_owned_paths` 1.16초(7건), `test_nerv_mirror_pull` 0.16초(20건) | 허용. CI 러너가 6~7배라 해도 `harness-checks` 예산(15분, 실측 566초)에 여유 |

## 검토했고 문제없다고 본 것

- `pull.py` `apply` · `write_if_changed`: 문서마다 기존 파일을 읽어 비교하는 O(문서 수 × 파일 크기)이고 첫 미러 기준 수십 ms 규모다. 바뀐 파일만 쓰므로 두 번째 실행은 쓰기 0이다.
- `rewrite_links` 의 `os.path.relpath` 는 링크마다 `getcwd` 를 부르지만 링크 수가 수천 개 수준이라 무시할 만하다. 세 정규식(`LINK_RE` · `SOURCE_LINE_RE` · `SOURCE_PATH_RE`)은 중첩 정량자가 없고 입력 길이에 선형이다.
- `cmd_all` 은 export.zip 을 통째로 메모리에 올린다(바이트, `BytesIO`, 문서별 `raw` 와 디코드 문자열이 겹침). 현재 압축 해제 기준 5.76MB 라 문제없다. 미러가 수십 배로 커지기 전에는 손댈 이유가 없다.
- `--task` 의 ETag(`If-None-Match`) 증분은 본문 전송을 건너뛰는 올바른 캐시 전략이다. `specs/tree` 는 영역 계산에 매번 필요하므로 캐시 대상이 아니다.
- 훅 fail-open 경로(`except Exception → exit 0`)와 `BYPASS` 우회는 핫패스에 추가 비용이 없다.

## 요약

이번 변경은 성능 위험이 낮다. 매 Write/Edit 마다 붙는 훅은 실측 약 7ms 오버헤드이고, `--check` 는 0.06초, 옛 트리 walker 의 미러 제외 필터는 수 ms 이며 오히려 링크 가드와 번들이 읽는 파일 수를 줄인다. 실질적으로 남는 것은 세 가지 INFO 다. `area_map` 은 순환 데이터에서 끝나지 않는다(프로브로 확인). `--task` 는 키마다 curl 을 직렬로 띄운다. 새 CI 잡은 공용 트리거에 묶여 codebase 만 바꾼 PR 에도 러너를 태운다. 셋 다 지금 규모에서는 차단 사유가 아니다. 저장소 트리는 수정하지 않았고 `git status --short` 는 리뷰 산출물 디렉터리 두 개만 보인다.

## 위험도

LOW
