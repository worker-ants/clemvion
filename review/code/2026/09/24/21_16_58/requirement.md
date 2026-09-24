# 요구사항(Requirement) 충족 리뷰 — docs-guard-trigger

## 검토 대상

1. `.github/workflows/spec-link-checks.yml` — `changes` job pathspec 에 `plan/**` 추가, `spec-link-integrity` job 이 단일 테스트 파일 대신 `src/lib/docs/__tests__/` 디렉터리 전체를 실행
2. `PROJECT.md` §문서 링크 검증 — 위 변경을 반영한 서술·명령 갱신
3. `plan/in-progress/docs-guard-trigger.md` — 신규 plan (결함 서술 · 처방 · 실측 · 판별 · 체크리스트)
4. `review/consistency/2026/09/24/21_04_26/**` — `--impl-prep` 산출물 (5개 checker + SUMMARY)

## 실측 검증 (뮤테이션 없이 read-only 명령만 사용)

- `pnpm --filter frontend test src/lib/docs/__tests__/` → **23 files / 3567 tests 전부 통과**, 4.77s. plan 체크리스트가 주장한 "23파일 3567개" 와 정확히 일치.
- `python3 -m pytest .claude/tests -q` → **1138 passed**, plan 체크리스트 주장과 일치.
- `.claude/tests/test_workflow_yaml_structure.py:262` 의 `("spec-link-checks.yml", "spec-link-integrity"): "${{ !cancelled() }}"` 앵커가 현재 job id·조건과 실제로 일치 — 잡 이름을 유지해야 하는 근거(주석의 `#1106` 인용)가 하네스에 실재.
- `_changed-paths.yml` 헤더 주석에 `` `#` 로 시작하는 줄은 주석으로 버린다 `` 는 서술이 있어, `plan/**` 항목에 붙인 2줄 인라인 주석이 pathspec 파싱을 깨지 않음을 코드 근거로 확인(plan §D 의 실측 판별과 정합).
- `spec/conventions/spec-impl-evidence.md` 는 CI 워크플로 이름을 언급하지 않고 가드(vitest 파일) 자체의 스캔 범위만 정의한다 — 이번 PR 은 그 파일을 건드리지 않았고 실제로 무변경(diff 0, `spec_impact: none`)이므로 spec fidelity 관점에서 충돌 없음. CI 트리거 매핑의 SoT 는 `PROJECT.md`(프로젝트 규약)이며, 그 문서도 함께 갱신됨.
- `PROJECT.md:305`(§자동 가드) 의 `spec-link-integrity.test.ts` 개별 스코프 서술은 그 파일 자체의 동작을 설명하는 것이라 워크플로 트리거 변경과 무관하게 여전히 정확 — 갱신 불필요 항목이 실제로 안 건드려졌음을 확인.

## 발견사항

- **[INFO]** job 이름(`spec-link-integrity`)이 실제 실행 범위(디렉터리 전체 — plan-frontmatter·spec-frontmatter 등 포함)보다 좁게 읽힘
  - 위치: `.github/workflows/spec-link-checks.yml` — `spec-link-integrity:` job 정의 (헤더 주석 및 인접 주석에 이미 명시)
  - 상세: 함수명·주석과 구현이 문자 그대로는 어긋나 보이지만(§4 "의도와 구현 간 괴리" 관점), 코드 자체에 "잡 이름은 유지한다 — `test_workflow_yaml_structure.py` 가 required-check 앵커로 고정" 이라는 근거가 명시돼 있고, `.claude/tests/test_workflow_yaml_structure.py:262` 로 그 앵커가 실재함을 확인했다. `naming_collision` consistency checker 도 동일하게 INFO 로 평가(BLOCK 아님).
  - 제안: 조치 불필요 — 의도적 트레이드오프이며 근거가 코드에 남아 있다. (기존 consistency-check 가 이미 선택 사항으로 제안한 "주석 한 줄 추가"는 구현 커밋에 이미 반영돼 있음 — 재제안 불필요.)

- **[INFO]** 착수 전 consistency-check(SUMMARY.md) 가 제안한 "PROJECT.md 동시 갱신" 권고사항이 같은 커밋에 실제로 반영됐는지 대조
  - 위치: `PROJECT.md:376-388`
  - 상세: SUMMARY.md 권장 조치 #2("workflow 변경과 같은 PR 에서 PROJECT.md 서술도 함께 갱신")·#3(job 주석 추가) 을 실제 diff 와 대조한 결과 둘 다 반영됨 — 사후 보정 없이 같은 커밋에서 완결.
  - 제안: 조치 불필요 (검증 완료 기록용).

CRITICAL/WARNING 급 결함은 발견하지 못했다. TODO/FIXME/HACK/XXX 주석 없음. 에러 시나리오(`needs.changes` 실패/취소 시에도 `if: ${{ !cancelled() }}` 로 job 실행 보장, required-check 데드락 회피)는 기존 패턴을 그대로 유지해 변경으로 인한 새 회귀 경로 없음. 반환값·데이터 유효성 관점은 YAML/문서 변경이라 해당 사항 제한적이며, 유일한 "판정 로직"인 pathspec 매칭은 §D 실측(과거 plan-only 커밋에 대해 `relevant=false→true` 전이)으로 직접 검증됐다.

## 요약

이 변경은 plan(`docs-guard-trigger.md`)이 서술한 결함(“plan/spec 만 바꾼 PR 에서 docs 가드가 하나도 안 돈다”)을 정확히 해소한다 — pathspec 에 `plan/**` 을 추가하고 실행 대상을 단일 테스트 파일에서 디렉터리 전체로 넓힌 조치가 실제 CI 판정 스크립트로 재현 검증됐고(과거 plan-only 커밋에서 `relevant=false→true` 전이 확인), 로컬 재현(vitest 23파일/3567테스트, 하네스 pytest 1138개)도 plan 이 주장한 숫자와 정확히 일치한다. 착수 전 consistency-check(`--impl-prep`, BLOCK:NO)가 제안한 INFO 권고(PROJECT.md 동시 갱신, job 주석 보강)도 같은 커밋에 이미 반영돼 사후 보정 패턴이 없다. 관련 spec 본문(`spec/conventions/spec-impl-evidence.md §4.2`)은 이번 변경으로 내용이 바뀌지 않았고 CI 워크플로 트리거를 규정하지도 않으므로 spec fidelity 충돌도 없다. Job 이름과 실제 실행 범위 사이의 표면적 불일치는 하네스 required-check 앵커 제약에 따른 의도적 설계로, 코드 주석에 근거가 남아 있어 결함이 아니다.

## 위험도
NONE
