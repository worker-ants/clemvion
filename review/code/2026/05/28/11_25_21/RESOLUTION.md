# RESOLUTION — 11_25_21

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| INFO 1 (KO/EN 501 vs 500) | false-positive | — | verified: ko/en both 500 keys (`grep -c '^  "cafe24'`). requirement reviewer line-count 오류. |
| W5 (documentation) | 코드 | 9fcc63e6 | KO/EN cafe24Catalog JSDoc 의 "backend metadata.label 에서 자동 추출" → "operation id 기반으로 작성. KO/EN 동반 갱신 필요" 로 교체. |
| W2 (testing) | 코드 | 9fcc63e6 | `cafe24-catalog-sync.spec.ts` 신규 추가 — 모든 supported (resource, op.id) 가 KO dict 에 `cafe24.<resource>.<op.id>` 로 존재하는지 검증. |
| W3 (testing) | 코드 | 9fcc63e6 | 동일 spec 파일 — 모든 supported (resource, op.id) 가 EN dict 에 존재하는지 검증. |
| W4 (testing) | 코드 | 9fcc63e6 | 동일 spec 파일 — KO/EN dict 가 동일 key set 보유 (parity guard). |
| W6 (maintainability) | — | — | 보류 — useT + useLocaleStore 혼재는 현재 JSDoc 설명으로 수용. 자동 수정 대상 아님. |
| W1 (api_contract) | — | — | 보류 (본 PR scope 밖) — dual-field 이행 기간 미채택. §보류·후속 항목 참조. |
| I2 (requirement) | 코드 | 9fcc63e6 | `resolveCafe24OperationLabel` 의 `locale: "ko" \| "en"` → `locale: Locale` 로 변경. `Locale` type import 추가. |
| I3 (requirement) | plan | 9fcc63e6 | `plan/in-progress/cafe24-mcp-label-i18n.md` Phase 0~4 체크박스 `[x]` 로 갱신. |
| I4 (documentation) | — | — | spec frontmatter `status: spec-only` 유지. PR 머지 시 사용자가 implemented 승격 예정. |
| I5 (documentation) | — | — | types.ts / planned.ts 인라인 이주 주석 본 PR 안에 유지 (히스토리 단서). 후속 cleanup PR 으로 분리. |
| I6 (documentation) | 코드 | 9fcc63e6 | `resolveCafe24OperationLabel` @param JSDoc 보강 (locale, labelKey, returns). |
| I7 (documentation) | 코드 | 9fcc63e6 | `toPublicSupportedOperation` + `toPublicPlannedOperation` @param JSDoc 보강 (op, resource). |
| I8 (api_contract) | — | — | 보류 — labelKey 허용 문자 집합 BNF. 본 PR scope 외 (후속 spec 보강). |
| I9 (api_contract) | — | — | 보류 — fallback console.warn. 본 PR scope 외 (운영 모니터링 별도). |
| I10 (testing) | 코드 | 9fcc63e6 | `cafe24-catalog-sync.spec.ts` 내 `resolveCafe24OperationLabel` 직접 unit test 추가 (locale=ko/en, fallback, KO≠EN 검증). |
| I11 (testing) | 코드 | 9fcc63e6 | `cafe24-catalog-sync.spec.ts` 내 dict key 포맷 regexp guard 추가 (regression guard). |
| I12, I13 | — | — | 보류 — 본 PR 외 cleanup / docs polish. |

## TEST 결과

- lint  : 통과 (28s)
- unit  : 통과 (4975 backend passed + 2789 frontend incl. 12 new cafe24-catalog-sync tests)
- build : 통과 (72s, 직전 REVIEW 진입 시점 기준 — 코드 변경은 documentation/type only, 재빌드 불필요)
- e2e   : 통과 (123/123, 60s)

## 보류·후속 항목

- **W1 (api_contract)**: dual-field 이행 기간 채택 — 큰 변경, 본 PR scope 밖. spec §7.5 Rationale 에 미채택 근거 1줄 추가는 project-planner 위임 또는 후속 PR 에서 처리 권장.
- **W6 (maintainability)**: useT + useLocaleStore 혼재 — 현재 JSDoc 설명으로 수용. 별도 리팩토링 PR 필요 시 project-planner 위임.
- **I4 (documentation)**: spec frontmatter `status: spec-only` → PR 머지 후 사용자가 `implemented` 로 승격.
- **I5 (documentation)**: types.ts / planned.ts 인라인 이주 주석 → 후속 cleanup PR.
- **I8 (api_contract)**: labelKey BNF 문서화 → 후속 spec 보강.
- **I9 (api_contract)**: fallback console.warn → 운영 모니터링 별도 PR.
- **I12, I13**: 본 PR 외 cleanup / docs polish.
- **INFO 1 (false-positive)**: false-positive — verified ko/en both 500 keys. requirement reviewer 의 line count 오류. 재검증 불필요.
