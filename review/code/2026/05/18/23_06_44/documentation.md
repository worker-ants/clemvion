# 문서화(Documentation) 리뷰

## 발견사항

### PROJECT.md

- **[INFO]** 신규 테스트 파일 3개(`backend-labels.test.ts`, `hardcoded-korean-ratchet.test.ts`, `nodes-coverage.test.ts`)가 "자동 가드" 목록에 모두 정확히 반영되어 있음
  - 위치: PROJECT.md, 자동 가드 섹션 (lines 162–167)
  - 상세: 기존 `i18n.test.ts` / `locale.test.ts` / `registry.test.ts` 3종 목록에 신규 테스트 3종이 추가되었으며, 설명도 테스트 동작과 일치함
  - 제안: 특이사항 없음

- **[INFO]** "변경 유형 → 갱신 위치 매핑" 표에 `신규 errorCode·warningCode 발행` 행이 신규 추가됨
  - 위치: PROJECT.md, line 35(diff 기준)
  - 상세: 검증 명령(`npm test -- backend-labels`)과 갱신 위치(`backend-labels.ts`)가 실제 테스트 파일과 일치함
  - 제안: 특이사항 없음

- **[INFO]** 마지막 단락에 `spec/conventions/i18n-userguide.md` 및 `convention-compliance-checker` 참조가 추가됨
  - 위치: PROJECT.md, line 52(diff 기준)
  - 상세: 링크 대상 파일(`spec/conventions/i18n-userguide.md`)이 실제로 존재하는지 이 리뷰 범위에서는 확인 불가. 만약 해당 파일이 이번 PR에서 함께 신설된 것이 아니라면 dangling link 위험
  - 제안: `spec/conventions/i18n-userguide.md`가 실제로 존재하고 Principle 1·3·4가 정의되어 있는지 확인. 미존재 시 신설 또는 링크 제거

---

### nodes-coverage.test.ts (신규)

- **[INFO]** 모듈 상단 JSDoc 블록이 충실하게 작성되어 있음. 가드의 목적, `registry.test.ts` 와의 보완 관계(정방향 vs 역방향 검증), spec 참조(`Principle 4`)를 모두 기술
  - 위치: lines 248–264
  - 상세: 문서화 품질 양호. 개선 여지 없음

- **[INFO]** `collectNodeSchemaFiles` 함수에 JSDoc이 있고 `_` prefix 제외 규칙·`core/` 제외 이유도 명시됨
  - 위치: lines 289–292
  - 상세: 향후 유지보수자가 exclusion 기준을 파악하기 충분

- **[WARNING]** `describe.runIf(hasBackend && hasDocs)` 조건부 실행의 의도(CI 격리 환경 대응)가 테스트 블록 바깥 주석에 설명되지 않음
  - 위치: line 322
  - 상세: `backend-labels.test.ts`는 `hasBackend` 플래그 상단에 "격리·CI 환경에서 backend 가 부재할 수 있으므로…" 주석이 있으나, 이 파일에는 동일 패턴에 대한 설명이 없음
  - 제안: `const hasBackend = fs.existsSync(backendNodesRoot)` 바로 위에 "격리·CI 환경에서 backend / docs 가 부재할 수 있으므로 존재 시에만 검증" 형태의 단행 주석 추가

---

### backend-labels.test.ts (신규)

- **[INFO]** 모듈 상단 JSDoc 블록이 배경·목적·spec 참조를 충분히 설명함. `PR #57`, `cbffad22` 같은 구체적 사례 인용이 유지보수 맥락을 높임
  - 위치: lines 514–524
  - 상세: 문서화 품질 양호

- **[INFO]** `extractWarningMessages` / `extractNodeMetadataTopFields` 두 핵심 파싱 함수에 JSDoc이 있고 설계상의 트레이드오프(validateConfig imperative 반환은 정적 추출이 어렵다는 한계)도 명시됨
  - 위치: lines 559–562, 587–591
  - 상세: 향후 보강 지점을 "Principle 3 의 후속 보강 후보"로 표기한 점은 기술 부채 문서화로서 적절

- **[WARNING]** `collectTopLevelStringFields` 및 `skipString` / `unescape` 헬퍼 함수에 JSDoc 또는 인라인 설명이 없음
  - 위치: lines 618, 664, 674
  - 상세: 이 함수들은 직접 작성한 미니 파서 로직으로, 각 함수의 역할과 한계(예: backtick template literal의 완전 지원 여부)가 불분명함. 특히 `skipString`은 백틱 다중행 문자열을 단일 라인처럼 처리한다는 가정이 있을 수 있으나 주석이 없음
  - 제안: 각 헬퍼 함수 상단에 1-2줄 JSDoc 또는 단행 주석으로 역할·한계 설명 추가

- **[INFO]** `// __dirname = codebase/frontend/src/lib/i18n/__tests__` 와 "6 hops back lands at repo root" 같은 경로 추론 주석이 있어 절대경로 계산의 의도가 명확함
  - 위치: line 527
  - 상세: 특이사항 없음

---

### hardcoded-korean-ratchet.test.ts (신규)

- **[INFO]** 모듈 상단 JSDoc 블록이 ratchet 패턴 설명, false-positive 가능성, 화이트리스트 정책, 갱신 방법(`BASELINE_UPDATE=1`)을 모두 기술함
  - 위치: lines 1035–1053
  - 상세: 환경변수 기반 갱신 플로우(`BASELINE_UPDATE=1 npm test -- hardcoded-korean-ratchet`)가 문서·코드·baseline.json `_updateCommand` 세 곳에 일관되게 기록됨

- **[WARNING]** `countKoreanCodeLines` 에 블록 주석/라인 주석 처리 방식이 인라인 주석으로 설명되어 있으나, 백틱 template literal 멀티라인 내부의 `[가-힣]` 처리 방침에 대한 언급이 없음
  - 위치: lines 1099–1113
  - 상세: 현재 구현은 블록 주석 제거 후 라인 단위로 처리하므로 template literal 안의 한국어 문자열도 일반 코드 라인과 동일하게 카운트된다. 이는 의도된 동작일 수 있으나 명시되지 않았음
  - 제안: JSDoc에 "template literal 내부 한국어도 코드 라인으로 카운트" 또는 "false-positive 의 일종으로 baseline 갱신으로 수용" 방침을 한 줄 추가

- **[INFO]** `isExcluded` 함수에 `/** 의도된 한국어 보유 영역 — ratchet 에서 제외 */` JSDoc이 있어 역할이 명확함
  - 위치: line 1069
  - 상세: 특이사항 없음

- **[INFO]** `writeBaseline` 내 이중 `writeFileSync` 패턴(JSON safety를 위해 total 주석 없이 재작성)이 인라인 주석으로 설명됨
  - 위치: lines 1411–1417
  - 상세: 문서화 양호

---

### hardcoded-korean-baseline.json (신규)

- **[INFO]** `_schema` / `_updateCommand` 두 메타 필드가 파일 목적과 갱신 방법을 자체 문서화함
  - 위치: lines 986–988
  - 상세: JSON 파일이 외부 문서 없이도 용도를 설명할 수 있는 좋은 패턴

---

### backend-labels.ts (수정)

- **[INFO]** `WARNING_KO` / `NODE_LABEL_KO` / `NODE_DESCRIPTION_KO` 세 상수가 `const` → `export const`로 변경되었으나, 파일 상단 JSDoc(`Translation table for UI strings shipped in backend Zod schemas...`)은 변경 없이 유지됨
  - 위치: lines 1546–1557
  - 상세: export 추가 이유(테스트에서 직접 import)를 파일 상단 JSDoc에 언급할 필요는 없으나, 이 세 테이블이 외부 테스트 전용 export임을 알리는 `/** @internal test-only export */` 수준의 표기가 있으면 향후 API 범위 파악에 도움이 될 수 있음
  - 제안: 각 exported 상수 앞에 `/** @internal — exported for test parity guard (backend-labels.test.ts) */` 단행 주석 선택적 추가 (필수 아님)

- **[INFO]** 신규 `WARNING_KO` 항목 2건 ("Merge partialOnTimeout is dormant in Phase P1", "Merge timeout is dormant in Phase P1")에 별도 주석은 없음
  - 위치: lines 1517–1519
  - 상세: 이 경고들은 Phase P1/P2 개발 단계에 종속된 메시지로, 향후 Phase P2 도입 시 제거해야 할 tech debt임. 그러나 이 파일의 일반적인 컨벤션이 키-값 나열이므로 인라인 주석 부재가 규칙 위반은 아님
  - 제안: Phase P2 구현 plan에 "backend-labels.ts의 Phase P1 dormant warning 항목 제거" 항목을 추가하는 것을 권장 (documentation 범위 외)

---

## 요약

이번 변경은 i18n 가드 확장 목적의 테스트 파일 3종 신설 및 PROJECT.md 문서 갱신으로 구성된다. 문서화 품질은 전반적으로 높다. 주요 테스트 파일 모두 모듈 상단 JSDoc을 보유하고, spec 참조(`Principle 1/3/4`)와 유지보수 지점이 명시되어 있으며, PROJECT.md의 "자동 가드" 목록과 "변경 유형 매핑" 표도 코드와 일치하게 갱신되었다. 주요 지적 사항은 두 가지다. 첫째, `nodes-coverage.test.ts`의 `describe.runIf` 조건부 실행에 대한 CI 격리 이유 주석이 누락되어 있다. 둘째, `backend-labels.test.ts`의 파서 헬퍼 함수(`collectTopLevelStringFields`, `skipString`, `unescape`)에 JSDoc이 없어 복잡한 상태 기계 코드임에도 설명이 부족하다. 두 항목 모두 WARNING 수준이며 기능에는 영향이 없으나 향후 유지보수성에 영향을 줄 수 있다. `spec/conventions/i18n-userguide.md` 링크의 실존 여부는 별도 확인이 필요하다.

## 위험도

LOW
