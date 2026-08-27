# Rationale 연속성 검토 — spec/5-system/ (eia-misc-hygiene, impl-done)

## 검토 범위 확인

diff-base `origin/main` 대비 실제 변경분(`git diff origin/main...HEAD --stat`)을 확인한 결과, 이 PR 은 **위생(hygiene) 전용**이다:

- `spec/5-system/14-external-interaction-api.md` — frontmatter `code:` 목록 경로 1건 갱신 (`shared/utils/node-output-allowlist.ts` → `nodes/core/node-output-allowlist.ts`)
- `spec/conventions/node-output.md` — 같은 경로 갱신 (본문 인용 1곳)
- `spec/conventions/egress-masking.md` — `code:` 목록에 `redact-stored-error.ts` 추가 등재
- 코드: `node-output-allowlist.ts` 를 `shared/utils/` → `nodes/core/` 로 100% 유사도 rename, `redactNodeExecutionRow` → `redactNodeExecutionRowForResponse` 함수명 변경(호출부 동반), `interaction.guard.ts` JSDoc 의 존재하지 않는 `EIA-AU-09` 참조 제거, docstring 보강, 테스트 재조직(describe 블록 분리, 검증 내용 불변), Swagger 테스트 헬퍼(`swagger-probe.ts`) 신설 + 4개 spec 전환, `tsconfig.build.json` exclude 1건 추가.

`## Rationale` 본문(R1~R19, `Rationale 발췌` 포함 관련 spec 들의 Rationale)의 **텍스트 자체는 이 PR 에서 한 글자도 변경되지 않았다.** 즉 과거 결정의 재작성·번복 시도가 없다.

## 발견사항

검토 관점 1~4 (기각된 대안 재도입 / 원칙 위반 / 무근거 번복 / invariant 충돌) 기준으로 이 PR 의 각 변경을 대조한 결과, 위반 사례 없음.

- **`node-output-allowlist.ts` 재배치**(`shared/utils/` → `nodes/core/`): Rationale 본문(R1~R19)은 이 파일의 물리적 위치를 규정하지 않는다 — 위치 정보는 frontmatter `code:` 목록(SoT 아닌 evidence 링크)과 `node-output.md` 본문의 파일 경로 인용뿐이며, 둘 다 이 PR 에서 동반 갱신됐다(`spec-code-paths.test.ts` 가 `code:` 존재를 검사하므로 누락 시 빌드가 깨진다 — 실측 근거는 plan 파일에 기록). 오히려 이 이동은 plan 트래커(`spec-sync-external-interaction-api-gaps.md`)가 별도로 지목해 온 "`shared/utils/` 는 도메인 비의존이어야 하는데 이 파일만 `NodeHandlerOutput` 도메인 타입을 import 해 그 불변식을 어겼다"는 기존 결함을 해소하는 방향이다 — invariant 위반이 아니라 invariant 복원.
- **`redactNodeExecutionRow` → `redactNodeExecutionRowForResponse` 개명**: R17 의 "6표면·2컬럼 열거가 정본" 서술이나 masking 정책(값 마스킹 vs 필드 삭제, copy-on-change, egress-only 원칙)에는 손대지 않았다. 함수 동작(3컬럼 마스킹, 무변화 시 동일 참조 반환)은 `redact-stored-error.spec.ts` diff 상 완전히 보존됐다. 저장소 전체(`spec/`, `codebase/`)에 옛 이름의 잔존 참조 0건(grep 실측) — 미갱신 잔재로 인한 Rationale-코드 괴리 없음.
- **`interaction.guard.ts` JSDoc `EIA-AU-09` 제거**: `EIA-AU-09` 는 spec 요구사항 표(§3.3)에 애초에 존재하지 않는 오기다(R14 의 각주가 이미 이 계열의 오기 이력을 기록). 실재하는 `§3.3.1`(Implementation Note)은 참조를 보존했다. 이는 결정 번복이 아니라 이미 spec 쪽에서 정정된(`spec-text-fixes` 턴) 오기를 코드 주석에도 뒤늦게 맞춘 것.
- **`egress-masking.md` code 목록에 `redact-stored-error.ts` 추가**: R17 의 "적용 범위는 총칭이 아니라 열거다"(6표면·2컬럼) 서술과 정합 — 그 문서 §2 가 `redactStoredFieldsForResponse`/`redactStoredDataForResponse` 를 이미 직접 지목하고 있었으므로 code 목록에 파일을 등재하는 것은 기존 서술을 실증화하는 보완이지 새 결정이 아니다.
- **fanout 테스트 describe 재배치, swagger-probe 헬퍼, tsconfig exclude**: R17 의 fail-closed allowlist 정책, R16 의 202+ack body 계약 등 검증 대상 자체는 변경 없이 테스트 조직·boilerplate 만 재구성됐다(테스트 수 63→63, 통과 케이스 불변 — plan 파일에 실측 기록).

결정을 뒤집거나 대안을 재도입하는 변경은 발견되지 않았고, 그에 수반될 새 Rationale 항목의 부재도 문제되지 않는다(뒤집은 결정이 없으므로).

## 요약

이번 diff 는 `spec/5-system/14-external-interaction-api.md` 를 포함한 EIA 영역 spec 들의 `## Rationale` 본문을 전혀 수정하지 않았고, 코드 변경도 파일 재배치·함수 개명·주석 정정·테스트 재조직 등 순수 위생(hygiene) 성격이다. 유일하게 실질적 구조 변화인 `node-output-allowlist.ts` 재배치는 과거 Rationale/plan 트래커가 지적해 온 "shared = 도메인 비의존" 불변식 위반을 오히려 해소하는 방향이며, `code:` frontmatter·본문 경로 인용이 빠짐없이 동반 갱신되어 spec-코드 참조 정합도 유지된다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 사례 모두 확인되지 않았다.

## 위험도
NONE
