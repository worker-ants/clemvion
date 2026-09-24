# 문서화(Documentation) 코드 리뷰

## 발견사항

- **[WARNING]** 워크플로 헤더 주석이 이번 변경 후 스코프를 더 이상 정확히 서술하지 않음 (오래된 주석)
  - 위치: `.github/workflows/spec-link-checks.yml:2`, `.github/workflows/spec-link-checks.yml:11`
  - 상세: 파일 최상단 헤더는 여전히 "`spec-link-integrity` 가드로 검증한다"(2행), "본 workflow 는 **가드 vitest 하나만** 도는 lightweight 대체 트리거다"(11행)라고 서술한다. 그런데 이번 diff 로 잡의 실행 커맨드가 `spec-link-integrity.test.ts` 단일 파일에서 `src/lib/docs/__tests__/` **디렉터리 전체**(plan-frontmatter·spec-frontmatter·spec-code-paths·spec-pending-plan-existence·spec-status-lifecycle 등 다수 가드)로 바뀌었다. 뒤에 새로 추가된 2026-09-24 단락(19~29행)은 이 확장을 정확히 설명하지만, 정작 파일의 첫 인상을 결정하는 최상단 요약 두 줄은 갱신되지 않아 "이 워크플로 = spec-link-integrity 가드 하나"라는 이제는 틀린 진술이 파일 서두에 그대로 남는다. 새 독자가 2행·11행만 읽고 중간의 2026-09-24 단락을 놓치면 실제 실행 범위를 오해한다.
  - 제안: 2행을 "`spec-link-integrity` 등 `src/lib/docs/__tests__/` 의 docs 가드 전체로 검증한다" 식으로, 11행을 "가드 vitest 디렉터리 전체를 도는" 식으로 갱신해 최상단 요약과 본문 하단의 2026-09-24 설명을 일치시킨다.

- **[WARNING]** 동일 성격의 선행 커밋들과 달리 이번 변경에는 CHANGELOG 항목이 없음
  - 위치: `CHANGELOG.md` (신규 항목 없음)
  - 상세: `CHANGELOG.md` 최상단에는 이번 커밋 바로 직전 이력으로 "`pending_plans` 가드가 plan 이 아닌 파일도 실존만 하면 통과시키던 것"과 "jest 가 ESM 의존성을 네이티브로 로드한다" 두 항목이 있다 — 둘 다 이번 변경과 마찬가지로 **테스트/CI 가드의 동작을 바꾼** 순수 harness 성격 변경이다. 이번 변경은 그와 동급이거나 더 무거운 사안이다: `plan/`·`spec/` 만 바꾼 PR 에서 `plan-frontmatter`·`spec-pending-plan-existence` 등 다수 가드가 CI 에서 통째로 안 돌던 실제 갭을 닫으며, 그 갭 때문에 `#1387` 1라운드 Critical 이 로컬에서만 잡혔던 사고 이력까지 커밋 메시지에 적혀 있다. 이 저장소는 과거에 정확히 이런 누락(`#1387` CHANGELOG 누락)을 스스로 backfill 커밋으로 정정한 전례가 있음에도, 이번 커밋(`1e047b716`)은 `CHANGELOG.md` 를 건드리지 않았다.
  - 제안: 같은 패턴(harness/CI 가드 fix)의 두 선행 항목과 나란히, "CI 에서 plan/spec 만 바꾼 PR 이 docs 가드를 우회하던 것" 항목을 추가한다.

- **[INFO]** job 정의부 주석에 박힌 "지금은 필수 체크가 없다" 는 시점부 사실이 향후 자동 갱신되지 않음
  - 위치: `.github/workflows/spec-link-checks.yml:87`~`89`
  - 상세: "**지금은 등록된 required check 가 없다**(2026-09-24 실측 — branch protection·ruleset 모두 없음)" 는 문장은 날짜를 명시해 시점 실측임을 밝혀 뒀고, 주석의 논지("이름을 바꾸면 나중에 문제가 된다")는 이 사실의 참/거짓과 무관하게 유효하므로 즉시 고칠 필요는 없다. 다만 이후 required status check 가 실제로 등록되면 이 문장 자체는 오래된 상태로 남는다 — 코드 리뷰어 관점에서 참고용으로만 남긴다(조치 불요).

## 요약

이번 변경은 CI 워크플로(`spec-link-checks.yml`) 확장, `PROJECT.md` 서술 갱신, plan 문서 신설, consistency-check 산출물 커밋으로 구성된다. `PROJECT.md` 갱신은 새 실행 범위·트리거 조건을 정확하고 명료하게 반영했고("스코프 3가지"가 이제 `spec-link-integrity` 하위 범위임을 명시한 점 포함), plan 문서의 실측·판별 근거도 문서화 품질이 높다. 다만 워크플로 파일 자체의 최상단 헤더 주석 두 줄이 이번 확장 이후에도 "가드 하나만 돈다"는 이전 진술을 그대로 유지해 본문 하단의 새 설명과 모순되고, 이 저장소가 스스로 설정한 전례(harness/CI 가드 fix 는 CHANGELOG 대상)에도 불구하고 이번 변경에는 CHANGELOG 항목이 빠졌다. 두 항목 모두 기능을 깨뜨리지 않는 문서 정합성 이슈이므로 WARNING 으로 평가한다.

## 위험도

LOW
