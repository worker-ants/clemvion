# 코드 리뷰 SUMMARY — @nestjs/swagger 11.2.7 핀 제거 + deep-import 공개 타입 파생 (§2)

- 범위: `--range HEAD~1..HEAD` (커밋 `3f1df0dcd`)
- reviewer 4종 (focused): dependency, api_contract, requirement, documentation

## 종합 위험도: **LOW** (Critical 0 / Warning 1 / Info 다수)

| reviewer | 위험도 | Critical | Warning | Info |
|---|---|---|---|---|
| dependency | LOW | 0 | 1 | 6 |
| api_contract | (info-only) | 0 | 0 | 4 |
| requirement | LOW | 0 | 0 | 2 |
| documentation | NONE | 0 | 0 | 6 |

**차단 사유 없음.** 핵심 검증(양호): 신규 의존성 0(공개 타입 파생), 라이선스·peer 불변, 11.3.0~11.4.5 구간 BREAKING 없음, DTO 스키마 회귀 28 tests 불변, activeCVE 0.

## Warning (1) — 처분

**[dependency WARNING]** 커밋 메시지의 "lockfile churn 은 swagger + swagger-ui-dist 뿐" 주장이 실제 diff 와 불일치 — vite/jest 툴체인의 무관한 patch(js-yaml·nanoid·picomatch·postcss·@napi-rs/wasm-runtime·@tybys/wasm-util)가 동반됨.
→ **기록 정정 + benign 확인**. 실측: 이 patch bump 들은 pnpm 이 lockfile 재생성 시 **overrides(picomatch·next>postcss 등)를 latest-satisfying 으로 재평가**하는 불가피한 특성이며(origin/main 미포함분), 신규 top-level·major 없음, 253 e2e 통과로 benign. swagger-only 는 lockfile 수동 편집 없인 불가능해 테스트된 lockfile 유지. **base 가 origin/main 대비 2 commit behind** 확인 → PR 전 rebase 필요(그때 lockfile 정합 재확인). plan §2·RESOLUTION 에 정확히 기록.

## Info 처분 (비차단)
- (dependency) 3파일에 `type SchemaObject` shim 중복 — 테스트 파일 self-contained 관례상 수용, RESOLUTION 기록.
- (dependency) `gray-matter → js-yaml@3.14.2` moderate CVE 잔존(본 diff 무관) — plan §4 "js-yaml 추적" 에 이미 백로그.
- (convention_compliance/documentation) swagger.md 에 deep-import 회피 원칙 명문화 — 선택(JSDoc 이미 존재), 미조치.
- (api_contract/requirement) OpenAPI 계약·spec 정합 INFO — 회귀 없음 확인, 조치 불요.
