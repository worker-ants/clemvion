# RESOLUTION — flaky surfacing fix 커밋 fresh 리뷰 (session 11_30_32)

대상: `SUMMARY.md` (fix 커밋 `926bb1ecf`, 직전 리뷰 11_02_46 Warning 6 조치분).
위험도 LOW · **Critical 0 · Warning 2 · INFO 13**. 두 Warning 모두 직전 fix 과정에서
동반된 회귀/부정확 — 조치 완료.

## 조치 항목 (Warning 2)

| # | 카테고리 | 조치 |
|---|---|---|
| **W1** | testing/scope | **fix** — 테스트 재작성 중 무언급 삭제된 다건 렌더 단언 `self.assertIn("테스트 2", md)` 복원(2번째 이후 행 누락 회귀 가드) |
| **W2** | documentation | **fix** — 신규 테스트 모듈 docstring 이 harness-checks 트리거를 "`scripts/**` 글롭"이라 부정확 서술 → 실제(개별 경로 등재, migration-check 선례)로 정정. 오인으로 인한 트리거 갭 재발 방지 |

### INFO 조치 (fix)

- INFO 7: `_emit_annotations` 전용 테스트(`redirect_stdout` 으로 `::warning::` 포맷 + 개행 escape 단언).
- INFO 8: `_emit_annotations` docstring 추가.
- INFO 9: `GhaEscapeTest` 에 `\r`(→`%0D`) 케이스 추가.
- INFO 10: `test_unexpected_schema_does_not_crash` 에 `written == ""`(malformed 시 summary 미오염) 단언.
- INFO 12: 저장소에 미배선된 Ruff 규칙 참조 `# noqa: BLE001` 제거(일반 주석으로 대체).
- INFO 13: `typing.Iterator` → `collections.abc.Iterator`(deprecated import 정리).

### INFO 미조치 (정당)

- INFO 3(`_spec` docstring 축약)·INFO 4(cross-file 가드 정규식 서식 민감)·INFO 5(`main` 예외 stdout-only)·
  INFO 6(`continue-on-error` 회귀 테스트)·INFO 11(RESOLUTION 라벨/line==0 비대칭)·INFO 13 잔여: 전부
  저위험 관찰. INFO 5 는 non-blocking 관측 스크립트 취지상 stdout print 로 충분(traceback 은 과함).
- security INFO(`file=` property 전용 escaping): 실 Playwright 파일경로엔 `,`·`:`·개행 부재라 현
  `_gha_escape` 로 충분 — 불가능 입력 방어 과잉 회피.

### 출력 파일 부재 2건 (security·requirement)

write-isolation 위양성. `wf_8ccda017-98e/journal.jsonl` 에서 복원 — 둘 다 **INFO only**
(security=annotation escaping 심화 제안, requirement=spec 부재는 CI 인프라라 정상). 숨은
Critical/Warning 없음 → 유일 실질 조치는 위 W1/W2.

## TEST 결과

- **lint**: 통과. **harness python**: 통과 — 파서 20/20, 전체 183/183.
- **unit**: 미재수행 — 본 fix 는 `.claude/tests/*.py`(whitelist)·`scripts/*.py` 만으로 pnpm unit 대상 무변경.
- **e2e**: 통과 — backend Jest e2e `249 passed`(`make e2e-test`). 본 fix 는 python(테스트·스크립트) 전용이라 Playwright/backend 동작 무변경(Playwright json reporter 는 본 PR 초기 e2e-test-full 로 이미 실증).

## 보류·후속 항목

없음.
