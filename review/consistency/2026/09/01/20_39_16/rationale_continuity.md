# Rationale 연속성 검토 — spec/5-system/ (impl-done)

## 검토 범위 재확인 (실측)

- `spec/5-system/**` 델타: **0 파일** (`git diff origin/main..HEAD` 기준). 이 브랜치는 해당 spec 영역을 전혀 건드리지 않는다.
- 실제 구현 diff (`git diff origin/main..HEAD --stat`): `codebase/packages/{ai-end-reason,chat-channel-validation,expression-engine,graph-warning-rules,masked-markers,node-summary}/package.json` 의 lint 스크립트 따옴표 수정(6곳, 각 1줄) + `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts`(타입 유도 리팩터, 24줄) + `codebase/packages/expression-engine/src/parser.ts`(switch-case 블록 스코프 수정, 5줄).
- 그 외 diff 는 `plan/in-progress/spec-draft-avatar-storage-key.md` → `plan/complete/`(rename, plan-lifecycle 이동 + 링크 정정 + 완료 배너), `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md`(체크리스트 갱신·정정 배너), `review/code/2026/09/01/20_07_34/**`(직전 코드 리뷰 산출물)이며 spec 본문 변경은 없다.

이 실측에 따라, "target 문서(`spec/5-system/`)가 Rationale 에서 기각된 결정을 재도입하는가" 라는 질문은 **적용 대상 자체가 없다**(spec 변경 0건). 아래는 이 브랜치의 실제 코드 변경이 `spec/5-system/` 에 이미 기록된 Rationale·원칙과 충돌하지 않는지를 확인한 결과다.

## 확인한 항목별 대조

### 1. `error-shape.spec.ts` 타입 유도 리팩터 — §6.3.1 C2 캐너리와의 관계

이 테스트는 `spec/5-system/3-error-handling.md` §6.3.1 의 `Error.cause` 부착 기준(C1/C2)을 실행하는 캐너리다(테스트 파일 상단 주석이 명시적으로 그 절을 인용). 이번 diff 는:

- 하위 클래스 열거를 **명시 배열**로 좁히지 않고 `Object.entries(errors)` **런타임 발견**을 유지한 채, 타입만 `typeof errors` 에서 매핑 타입으로 유도했다(`SubclassName`).
- 이는 `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md` 체크리스트가 명시적으로 기각한 대안("명시 배열로 좁힌다")을 **다시 채택하지 않고**, 오히려 "전수성 단언이 무력해지는" 결과를 피하는 방향으로 남았다 — 캐너리의 존재 이유(§6.3.1 C2 의 실제 집행)를 유지.
- 테스트 자체의 단언(ALLOWED_KEYS 화이트리스트, enumerable own-key 축, 클래스↔코드 1:1 대조)은 변경 없음. 순수 타입 레벨 변경이며 §6.3.1 C1/C2 기준을 약화시키지 않는다.

결론: 위반 없음. 오히려 Rationale 문서가 요구하는 "전수 열거" 취지를 코드 차원에서 더 안전하게 재확인한 변경.

### 2. `parser.ts` switch-case 블록 스코프 수정

`case TokenType.LParen` 블록에 중괄호를 추가해 `no-case-declarations` 를 해소한 순수 문법 수정. 파싱 동작·AST 산출 로직 변경 없음. `spec/5-system/5-expression-language.md` §8.1(파서/평가기 구조)·Rationale(§`$trigger`/`$env` 런타임 주입) 어느 쪽과도 접점 없음.

### 3. 6개 패키지 lint 스크립트 따옴표 수정

`eslint src/**/*.ts` → `eslint "src/**/*.ts"`. 셸 글롭 확장 버그 수정(빌드 도구 설정)이며 `spec/5-system/**` 의 제품 계약·Rationale 과 무관.

### 4. plan 문서 이동/정정 (`spec-draft-avatar-storage-key.md`, `expression-engine-error-shape-spec-broken-on-main.md`)

`spec-draft-avatar-storage-key.md` 는 **이미 별도 PR(#1258, origin/main 에 병합됨)에서 `spec/0-overview.md` §2.7 Rationale 을 정정 완료한** 작업의 lifecycle 마무리(이동 지연분 정리)다 — 이번 브랜치가 새로 Rationale 을 바꾸는 것이 아니다. 흥미롭게도 이 plan 문서 자체가 "Rationale 연속성 checker 가 과거에 본문·표만 고치고 Rationale 절을 빠뜨린 초안을 지적해 정정했다" 는 이력을 담고 있다 — 이 checker 클래스가 의도대로 작동해 과거 결함을 잡은 사례이며, 그 결과가 이미 `origin/main` 에 반영돼 있음을 재확인했다(`spec/0-overview.md` 자체는 이번 diff 대상이 아니므로 재검증 범위 밖).

`expression-engine-error-shape-spec-broken-on-main.md` 는 진단 경과·정정 배너 갱신이며 spec 변경을 유발하지 않는다.

## 발견사항

없음 — 이 브랜치의 실제 변경분(코드 6+2 파일, plan 문서 2건)에서 `spec/5-system/` 의 `## Rationale` 에 기록된 결정·원칙과 충돌하는 재도입·번복·우회는 발견되지 않았다. `spec/5-system/**` 자체에 대한 변경이 없어 이번 검토는 "충돌 여지가 있는 target 변경이 없음"을 실측으로 확인하는 데 그친다.

## 요약

target 범위(`spec/5-system/`)의 실제 델타는 0파일이며, 이 브랜치가 건드린 코드는 lint 글롭 따옴치·switch-case 블록 스코프·에러 클래스 열거 타입 유도라는 순수 기계적 수정으로 어느 것도 `spec/5-system/` 의 Rationale 이 기각한 대안을 재도입하거나 명시된 설계 원칙(특히 §6.3.1 `Error.cause` C1/C2 캐너리)을 훼손하지 않는다. 오히려 `error-shape.spec.ts` 변경은 그 캐너리가 "명시 배열로 좁혀 전수성을 잃는" 기각된 방향으로 가지 않도록 지킨 사례다. 함께 포함된 plan 문서 변경은 이미 별도 병합 PR(#1258)에서 완료된 spec Rationale 정정의 lifecycle 마무리일 뿐, 이번 브랜치가 새로 Rationale 을 다시 쓰는 것이 아니다.

## 위험도

NONE
