# 문서화(Documentation) Review — Re-run 모달 typed 폼 (V-14)

## 발견사항

- **[INFO]** `run-results.mdx` 가 Re-run 버튼의 "typed 입력 폼" 신규 동작을 설명하지 않음 (요청된 FOCUS 항목)
  - 위치: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx:128`, `:149`
  - 상세: 이 mdx 의 두 문장은 "드로어 상단의 **Re-run** 버튼을 눌러 해당 실행의 입력값으로 새 실행을 시작"한다고만 설명하고, 입력 폼 자체의 동작(텍스트 입력이었는지 typed 위젯인지)에 대해서는 서술이 없다. `run-results-drawer.tsx` 가 이번에 typed 로 바뀐 `ReRunModal` 을 그대로 사용하므로(코드 확인: `codebase/frontend/src/components/editor/run-results/run-results-drawer.tsx:25,482`), 이 문서가 가리키는 화면이 바로 이번 변경의 대상이다. 다만 기존 문장이 "입력값으로 다시 실행할 수 있다"는 사실 자체는 여전히 정확 — **stale(오류)은 아니고, 사용자 가이드가 새 UX(원본 ID 클릭 시 새 탭·필드별 checkbox/number 위젯)를 다루지 못하는 커버리지 공백**에 가깝다.
  - 제안: `run-results.mdx` §"노드별 입출력 확인 팁" 또는 Re-run 관련 Step 에 한 문장 추가 권장 — 예: "Re-run 모달의 입력 필드는 워크플로우의 Manual Trigger 파라미터 스키마를 따라 타입에 맞는 위젯(숫자·체크박스·JSON 등)으로 나타나며, 원본 실행 ID 를 클릭하면 새 탭에서 원본 상세를 볼 수 있어요." spec-coverage 관점에서 필수는 아니나(사용자 가이드는 spec 의 1차 SoT 가 아님), 신규 사용자 대면 UX 라 문서 커버리지를 높이는 편이 유용.

- **[INFO]** `running-a-workflow.mdx` 는 이번 변경과 무관 — stale 없음
  - 위치: `codebase/frontend/src/content/docs/05-run-and-debug/running-a-workflow.mdx:122`
  - 상세: Manual Trigger 를 트리거 종류 목록에서만 언급하고 Re-run 모달·입력 폼에 대한 서술이 없으므로 이번 diff 로 인해 stale 해질 내용이 없다.

- **[INFO]** CHANGELOG 엔트리 자체는 신뢰할 만한 서술 — 형식·근거 적절
  - 위치: `CHANGELOG.md:34-38`
  - 상세: 변경 배경(spec §10.2 명세 vs 종전 plain text/텍스트 전용 폼), 타입 매핑(string→text·number→number·boolean→checkbox·object/array→JSON), fallback 정책(스키마 부재 시 원본 키 text), SoT 링크가 모두 정확하고 코드(`rerun-modal.tsx`)·plan(`spec-code-cross-audit-2026-06-10.md` V-14)과 일치한다. 추가 조치 불요.

- **[INFO]** 컴포넌트 내 JSDoc/인라인 주석은 신규 로직에 적절히 동반됨
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:96-101(TriggerParameterDefinition)`, `:109(RerunField)`, `:116(displayValue)`, `:125-130(coerceInput)`, `:226-228(fields useMemo)`, `:288(ID 링크)`, `:324(폼 렌더 주석 갱신)`
  - 상세: 새 타입·헬퍼 함수마다 목적과 spec 근거(§10.2)를 명시한 주석이 붙어 있고, 기존 "입력 폼 — useOriginalInput=ON 이면 read-only" 주석도 "manual_trigger 스키마 기반 typed 필드"로 정확히 갱신되어 오래된 주석(stale comment) 이슈 없음. `paramKeys` → `fields` 리네임에 따른 주석 교체도 일관됨.

- **[INFO]** 새 export 되는 public 함수(`ReRunModal`)의 컴포넌트 레벨 JSDoc은 이번 변경 반영 여부 확인
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:1017-1022` (컴포넌트 상단 JSDoc, "입력 편집 / dry-run toggle 을 제공한다")
  - 상세: 컴포넌트 레벨 JSDoc 은 "입력 편집"이라고만 서술해 여전히 정확하다(텍스트/typed 여부를 명시하지 않으므로 stale 아님). 다만 새로 추가된 원본 ID 링크(새 탭 네비게이션) 기능은 이 JSDoc 에 언급이 없다 — 필수는 아니지만 "원본 실행 정보(id 링크 포함)" 정도로 한 구절 보강하면 컴포넌트 계약이 더 명확해진다.
  - 제안: 우선순위 낮음(cosmetic). 강제 아님.

- **[INFO]** README/설정/환경변수/신규 API 변경 없음 — 해당 없음
  - 상세: 이번 변경은 프론트엔드 컴포넌트 내부 로직(순수 UI 렌더링 분기)이며 신규 API 엔드포인트, 환경변수, 설정 옵션을 도입하지 않는다(backend `resolveTriggerParameters` 는 기존에 이미 native-typed 값을 수용하던 기능으로 이번 PR 범위 밖). README 갱신 불요.

## 요약

이번 변경의 CHANGELOG 엔트리는 배경·구현 내용·SoT 를 정확하고 충실하게 기록했고, 코드 내 JSDoc/인라인 주석도 새 타입·헬퍼·fallback 정책을 잘 설명하며 기존 주석의 stale 갱신도 정확히 이루어졌다. FOCUS 로 지정된 사용자 가이드(`run-results.mdx`, `running-a-workflow.mdx`)를 직접 확인한 결과, `running-a-workflow.mdx` 는 이번 변경과 무관해 문제가 없고, `run-results.mdx` 는 Re-run 버튼의 존재만 언급할 뿐 입력 폼의 구체적 동작(텍스트 vs typed)을 서술하지 않으므로 "오류(stale)"라기보다는 "커버리지 공백" 수준이다 — 틀린 내용은 아니지만, 사용자 대면 UX 가 이번에 의미 있게 개선(원본 ID 새 탭 링크·필드별 타입 위젯)되었으므로 가이드에 한두 문장을 보강하면 사용자 경험 설명이 더 완전해진다. 이는 차단 사유가 아닌 개선 권고(INFO) 수준이다.

## 위험도

LOW
