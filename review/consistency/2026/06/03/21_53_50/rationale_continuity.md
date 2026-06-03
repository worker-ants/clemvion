# Rationale 연속성 검토 결과

검토 모드: `--impl-done`, scope=`spec/`, diff-base=`origin/main`

변경 파일 (8개):
- `spec/3-workflow-editor/1-node-common.md`
- `spec/4-nodes/1-logic/9-foreach.md`
- `spec/4-nodes/4-integration/0-common.md`
- `spec/4-nodes/5-data/0-common.md`
- `spec/4-nodes/6-presentation/0-common.md`
- `spec/4-nodes/6-presentation/5-template.md`
- `spec/5-system/5-expression-language.md`
- `spec/5-system/8-embedding-pipeline.md`

---

## 발견사항

### [WARNING] ForEach `$itemIsFirst`/`$itemIsLast` 노출 전환 — Rationale 부재

- **target 위치**: `spec/4-nodes/1-logic/9-foreach.md` §3.3 (diff +68–69행) 및 `spec/5-system/5-expression-language.md` §표 (+2행)
- **과거 결정 출처**: `spec/4-nodes/1-logic/9-foreach.md` (origin/main) §3.3 원문:
  > "엔진 내부 `itemContext` 는 `isFirst`/`isLast` 플래그도 보유하지만(`foreach-executor.ts`), 이는 컨테이너 실행 제어용 내부 상태이며 expression 으로 노출되지 않는다."
  > "`$item.isFirst` / `$item.isLast` 같은 first/last 플래그를 body 표현식에서 직접 읽는 surface 는 **미구현 (Planned)** 이다."
- **상세**: 원본 spec 은 `isFirst`/`isLast` 가 "내부 상태이며 expression 으로 노출되지 않는다"고 명시했다. 이 문구는 단순한 "미구현" 경고를 넘어 **설계 경계**("컨테이너 실행 제어용 내부")를 설명한 진술이었다. target 은 `$itemIsFirst`/`$itemIsLast` 를 top-level 변수로 노출하면서 그 이유("`$item` 이 raw 값이라 속성 부착 불가 → 별도 변수")는 짧게 기술했으나, 이 변경이 왜 원본의 "내부 상태" 결정을 번복하는지에 대한 **Rationale 섹션이 없다**. `9-foreach.md` 에는 `## Rationale` 섹션 자체가 없으며, `5-expression-language.md` 에도 이 변경에 대한 Rationale 이 추가되지 않았다.
- **제안**: `spec/4-nodes/1-logic/9-foreach.md` 에 `## Rationale` 섹션을 추가하고 "왜 `isFirst`/`isLast` 를 내부 상태에서 expression 노출 변수로 승격했는가"를 기록. 특히 "내부 상태" 문구가 의도적 설계 결정이었는지, 아니면 미구현 현황 서술이었는지를 명확히 해야 한다. 관련 `spec/5-system/5-expression-language.md` 의 변수 표 변경도 같은 Rationale 을 참조할 것.

---

### [WARNING] node-common `§2.5.2` 타입별 기본값 → `null` 단일 폴백 전환 — Rationale 부재

- **target 위치**: `spec/3-workflow-editor/1-node-common.md` §2.5.2 (diff -200~215행)
- **과거 결정 출처**: `spec/3-workflow-editor/1-node-common.md` (origin/main) §2.5.2:
  > "사용자가 기본값을 직접 설정하지 않은 경우, 노드 출력 타입에 따라 아래 값이 자동 적용된다: Object→`{}`, Array→`[]`, String→`""`, Number→`0`, Boolean→`false`, Null/Unknown→`null`"
  > "타입 추론: 노드의 마지막 정상 실행 출력에서 타입을 추론한다."
- **상세**: 원본 spec 은 타입별 기본값 테이블과 타입 추론 로직을 **정책**으로 기술했다. target 은 이를 "미구현 (Planned)" 으로 강등하고 런타임 폴백을 `null` 단일값으로 축소했다. 이는 구현 현실에 맞춘 코드-spec 동기화이지만, 원본의 타입별 기본값 테이블은 "계획" 이 아니라 **요구사항처럼 작성**되어 있었다. 해당 정책을 포기하거나 축소 결정하는 Rationale 이 없다. `1-node-common.md` 에는 `## Rationale` 섹션이 없다.
- **제안**: `spec/3-workflow-editor/1-node-common.md` 에 `## Rationale` 섹션(또는 inline 참고 note)을 추가해, "타입별 기본값 추론이 Planned 로 남은 이유 (summaryTemplate DSL 의 타입 추론 미지원 등)" 와 "현재는 `null` 단일 폴백으로 운영"을 기록. 단, `spec/5-system/3-error-handling.md §3.3` 에 타입 추론 없는 Retry 설정 관련 내용이 일관성 있게 맞춰져 있으므로 충돌은 없다.

---

### [INFO] node-common `§2.5.1` 버튼 레이블 변경 ("Reset to Type Default" → "Reset to Default")

- **target 위치**: `spec/3-workflow-editor/1-node-common.md` §2.5.1 (diff -189행, +189행)
- **과거 결정 출처**: origin/main §2.5.1 (계획 UI)
- **상세**: 레이블이 "Reset to Type Default" → "Reset to Default" 로 변경됐다. 이는 §2.5.2 의 타입별 기본값 추론 미구현과 일관성을 맞추는 변경으로 논리적이다. Rationale 이 없지만 §2.5.2 변경 맥락에서 파생된 사소한 UI 레이블 조정이다.
- **제안**: §2.5.2 Rationale 작성 시 이 레이블 변경도 같이 설명하면 충분.

---

### [INFO] Code 노드 캔버스 요약 형식 변경 (`{language} · {N} lines` → `{{language|upper}}`)

- **target 위치**: `spec/4-nodes/5-data/0-common.md` §5 (diff -48, +48행)
- **과거 결정 출처**: origin/main 동일 파일:
  > "`{language} · {N} lines` (코드 줄 수) — **미구현 (Planned)**"
  > "`codeNodeMetadata` 에는 `summaryTemplate` 이 없어 Code 노드는 캔버스 본문 요약이 표시되지 않는다(`null`)."
- **상세**: 원본의 계획 형식(`{language} · {N} lines`)을 포기하고 단순히 언어명만 표시하는 `{{language|upper}}` 를 채택했다. target 의 주석 ("summaryTemplate DSL 이 개행 카운트를 지원하지 않아") 이 이유를 설명하지만, Rationale 섹션은 없다. DSL 한계로 인해 `{N} lines` 를 영구 포기한 것인지 여전히 계획인지 모호하다.
- **제안**: `spec/4-nodes/5-data/0-common.md` inline 주석 또는 `spec/4-nodes/0-overview.md §1.4.1` 의 summaryTemplate DSL 한계 섹션에 "개행 카운트 미지원 → Code 노드 줄 수 표시 불가" 를 명시. 언어만 표시하는 것이 final 결정인지 아니면 DSL 확장 후 revisit 대상인지 분류.

---

### [INFO] Template 노드 캔버스 요약 형식 변경 (두-변형 → 단일 `summaryTemplate`)

- **target 위치**: `spec/4-nodes/6-presentation/0-common.md` §요약 표 (diff -169, -170행, +169행)
- **과거 결정 출처**: origin/main 동일 파일: Template 요약을 "버튼 없음 (`{outputFormat} · {N} lines`)" / "버튼 있음 (`{outputFormat} · {N} buttons`)" 두 변형으로 기술
- **상세**: 버튼 없음 시 `{N} lines` 변형이 포기되고 버튼 수 단일 표현(`{{buttons.length}} buttons`)으로 통일됐다. 버튼이 0개일 때의 표시 (`0 buttons` vs 아무 것도 없음) 가 명시되지 않았다. `spec/4-nodes/6-presentation/0-common.md` 의 기존 `## Rationale` 섹션에 이 변경에 대한 항목이 없다.
- **제안**: 기존 `## Rationale` 에 짧은 항목을 추가해 "`{N} lines` 변형 포기 이유(Code 노드와 동일한 DSL 한계)" 를 기록하고, 버튼 0개 시 표시 동작("0 buttons" 또는 빈 값)을 명시.

---

### [INFO] embedding-pipeline `Document.metadata` page/section 채우기 구현 완료 처리

- **target 위치**: `spec/5-system/8-embedding-pipeline.md` §6.1 표 (diff -147, +147행)
- **과거 결정 출처**: origin/main 동일 파일: "`metadata` — **현재 항상 빈 `{}` 로 INSERT** (page/section 채우는 파서 경로 미구현, Planned)"
- **상세**: 구현 완료로 변경하며 md/pdf 파서 동작을 기술했다. 이 변경에 대한 Rationale 는 없으나, `## Rationale` 의 기존 "spec 정합성 정비" 항목과 맥락이 일치하므로 별도 Rationale 항목이 없어도 허용 가능 수준이다.
- **제안**: (선택) 기존 Rationale "결정: spec 정합성 정비" 항목에 metadata 채우기 구현 완료 내역을 한 줄 추가하면 이력 연속성이 좋아진다.

---

## 요약

전체 변경 8개 파일 중 기존 `## Rationale` 에서 **명시적으로 거부된 대안이 재채택된 CRITICAL 사례는 없다**. 다만 두 건의 WARNING 이 있다. (1) ForEach `$itemIsFirst`/`$itemIsLast` 노출 승격: 원본이 "내부 상태이며 expression 으로 노출되지 않는다"고 설명한 결정을 Rationale 없이 번복했다. (2) node-common `§2.5.2` 타입별 기본값 테이블: 요구사항으로 기술된 내용을 Rationale 없이 "미구현 (Planned)" 으로 강등했다. 나머지 변경 4건은 코드-spec 동기화 성격의 INFO 수준이며 기존 설계 원칙과 충돌하지 않는다. 두 WARNING 모두 해당 파일에 `## Rationale` 섹션을 추가해 번복 근거를 기록하면 해소된다.

## 위험도

MEDIUM
