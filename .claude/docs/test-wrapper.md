# Test Wrapper — main ctx 절감용

## 목적

TEST WORKFLOW 의 lint / unit / build / e2e 4단계 출력이 main ctx 에 직주입되는 것을 막는다. 통과 시 stdout 100토큰 이내, 실패 시도 2K 토큰 이내로 제한.

## 사용

```bash
.claude/tools/run-test.sh lint
.claude/tools/run-test.sh unit
.claude/tools/run-test.sh build
.claude/tools/run-test.sh e2e
```

각 stage 의 실제 명령은 `.claude/test-stages.sh` (프로젝트 채택 시 작성) 에 정의:

```bash
cmd_lint()  { cd codebase/backend && npm run lint; }
cmd_unit()  { cd codebase/backend && npm test; }
cmd_build() { cd codebase/backend && npm run build; }
cmd_e2e()   { make e2e-test; }
```

샘플: [`.claude/test-stages.sh.example`](.claude/test-stages.sh.example).

## 출력 형식

**통과**:

```
stage=lint status=PASS duration=12s log=/abs/path/_test_logs/lint-20260519-074200.log
```

**통과 (테스트 카운트 포함, 흔한 패턴 자동 감지)**:

```
stage=unit status=PASS duration=87s tests=142 passed log=/abs/path/_test_logs/unit-20260519-074330.log
```

**실패**:

```
stage=e2e status=FAIL exit=1 duration=412s log=/abs/path/_test_logs/e2e-20260519-075000.log
--- 마지막 30줄 ---
... (e2e 마지막 30줄) ...
--- 실패 마커 (FAIL/Error/✗) ---
123: FAIL: auth.e2e-spec.ts › should reject expired token
456: Error: socket hang up
... (최대 50줄) ...
```

## ctx 영향

| 케이스 | main 으로 들어가는 토큰 |
|---|---|
| 통과 | ≤ 100 |
| 실패 (작은 로그) | ≤ 1K |
| 실패 (큰 로그) | ≤ 2K |
| 전체 로그 | 디스크 보존 (`_test_logs/<stage>-<ts>.log`), main 안 들어옴 |

main 이 실패 상세를 더 봐야 하면 사용자 결정으로 그 log 파일을 명시 Read.

## 적용 위치

- `developer/SKILL.md` TEST WORKFLOW 4단계의 각 단계 명령을 본 wrapper 호출로 교체.
- `resolution-applier` sub-agent (D-3 e2e 로그 truncation) 도 본 wrapper 를 사용.
- CI / 사용자 직접 호출도 그대로 사용 가능 (raw 명령 대신).

## 로그 정리

`_test_logs/` 는 누적되므로 주기적으로 정리. 예:

```bash
find _test_logs -mtime +7 -delete
```

`.gitignore` 에 `_test_logs/` 추가 권장.
